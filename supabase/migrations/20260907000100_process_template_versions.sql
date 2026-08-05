-- ADR 0096 — Process-template versioning · M1: the version substrate.
--
-- Introduces `process_template_versions`, mirroring `forms` / `form_versions`
-- (Architecture Rule 5). Purely ADDITIVE: nothing existing is re-keyed here, so
-- this migration is safe to apply on its own and leaves every current reader
-- working. The re-key lands in M4-M7.
--
-- D1 (PO-locked): `title` / `description` / `collects_patient` / `case_type_id`
-- live on the VERSION, not the identity. This deliberately DIVERGES from `forms`,
-- where they sit on the identity row and therefore still drift across all
-- versions. Putting them on the version is what closes the one real provenance
-- gap the integrity audit found (a template's title/description were never
-- snapshotted per-case, so "what was this process called when the case ran" was
-- unanswerable).
--
-- NOT added, deliberately: a composite `(id, template_id)` unique to hang a
-- composite child FK from (the ADR 0094 pattern that ADR 0095 M4 applied to
-- form versions). That pattern exists to stop TWO columns on one child row from
-- disagreeing — `case_phases` carries both `form_id` and `form_version_id`, which
-- can drift apart. No child here carries a second path to the template: a phase
-- references `template_version_id` and nothing else, and the version determines
-- the template. With no second path there is nothing to disagree, so a composite
-- FK would be ceremony, not a guard.

create table public.process_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null
    references public.process_templates (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  title text not null check (btrim(title) <> ''),
  description text,
  collects_patient boolean not null default false,
  case_type_id uuid references public.case_types (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (template_id, version_number)
);

comment on table public.process_template_versions is
  'ADR 0096 — one immutable-once-published version of a process template. '
  'Mirrors form_versions: draft -> published -> archived, at most one published '
  'and at most one draft per template, editing clones to a new draft.';

-- At most ONE published version per template (mirrors form_versions_one_published_idx).
-- publish_template_version archives the incumbent in the same statement, so this
-- index is the substrate proof that a template never has two live definitions.
create unique index process_template_versions_one_published_idx
  on public.process_template_versions (template_id)
  where status = 'published';

-- At most ONE open draft per template. form_versions has NO such index — it relies
-- on clone_form_version returning the existing draft. We enforce it in the
-- substrate as well, because `clone_template_version`'s idempotency contract is
-- part of the TYPED surface the UI builds against (a second draft would make
-- `draftVersionId` ambiguous), and a UI-only guarantee is not a guarantee.
create unique index process_template_versions_one_draft_idx
  on public.process_template_versions (template_id)
  where status = 'draft';

-- ADR 0096: app.published_version_of_template becomes a HOT PATH (every single
-- case creation resolves through it), hence an index on (template_id, status).
create index process_template_versions_template_status_idx
  on public.process_template_versions (template_id, status);

create index process_template_versions_case_type_idx
  on public.process_template_versions (case_type_id);

create index process_template_versions_created_by_idx
  on public.process_template_versions (created_by);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The VERSION-grain commission resolver. This is a NEW NAME on purpose: the
-- re-key in M6 must not be able to silently reuse app.commission_of_template,
-- which takes a TEMPLATE id. Feeding it a version id returns NULL, is_member_of
-- (NULL) is false, and RLS then fails CLOSED — invisible to every deny-side test.
-- A distinct name makes a mis-keyed policy textually greppable (see the M6 sweep).
create or replace function app.commission_of_template_version(p_version_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select t.commission_id
  from public.process_template_versions v
  join public.process_templates t on t.id = v.template_id
  where v.id = p_version_id;
$$;

-- Mirrors app.published_version_of_form. The one-published partial unique index
-- makes the order/limit redundant; they are kept so the two helpers read
-- identically and neither looks like it is relying on a different invariant.
create or replace function app.published_version_of_template(p_template_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select id
  from public.process_template_versions
  where template_id = p_template_id and status = 'published'
  order by version_number desc
  limit 1;
$$;

create or replace function app.draft_version_of_template(p_template_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select id
  from public.process_template_versions
  where template_id = p_template_id and status = 'draft'
  limit 1;
$$;

-- The public read helper (lead-approved). Deliberately SECURITY INVOKER: it adds
-- no authority, it is just a named projection, so RLS on
-- process_template_versions filters it exactly as a direct select would. Making
-- it DEFINER would create a new door for zero benefit.
create or replace function public.draft_version_of_template(p_template_id uuid)
returns uuid
language sql
stable
set search_path = public, pg_catalog
as $$
  select id
  from public.process_template_versions
  where template_id = p_template_id and status = 'draft'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Immutability (mirrors public.guard_published_version on form_versions)
-- ---------------------------------------------------------------------------

-- NOTE the GUC is app.in_template_publish_rpc, NOT the form side's
-- app.in_publish_rpc. Sharing one switch would mean an in-flight
-- publish_form_version also unlocked template-version status changes for the rest
-- of the transaction. Separate switch, separate blast radius.
create or replace function app.guard_published_template_version()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    -- STRONGER than the form-version guard, which blocks only 'published'.
    -- An archived version is the historical record a surveyor asks about
    -- ("which process was in force in Q2"), so it is undeletable too. This also
    -- matches the typed contract already published to the frontend:
    -- discardTemplateDraft is legal ONLY for a draft.
    if old.status <> 'draft' then
      raise exception 'versões publicadas ou arquivadas do processo não podem ser excluídas'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE. Status transitions are permitted only inside the publish/archive RPCs.
  if new.status is distinct from old.status then
    if coalesce(current_setting('app.in_template_publish_rpc', true), 'off') <> 'on' then
      raise exception 'a mudança de status da versão deve passar por publish_template_version()'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Non-status update: forbidden once the version is no longer a draft.
  if old.status <> 'draft' then
    raise exception 'versões publicadas ou arquivadas do processo são imutáveis'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger guard_published_template_version_trg
  before delete or update on public.process_template_versions
  for each row execute function app.guard_published_template_version();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.process_template_versions enable row level security;

-- IDENTITY-grain resolution is correct HERE and only here: this table's own
-- template_id genuinely is a template id. The four CHILD tables re-key to
-- app.commission_of_template_version in M6.
create policy process_template_versions_select
  on public.process_template_versions
  for select
  using (
    app.is_member_of(app.commission_of_template(template_id))
    or app.is_commission_admin_of(app.commission_of_template(template_id))
  );

create policy process_template_versions_staff_admin_write
  on public.process_template_versions
  for all
  using (
    app.is_staff_admin_of(app.commission_of_template(template_id))
    or app.is_commission_admin_of(app.commission_of_template(template_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template(template_id))
    or app.is_commission_admin_of(app.commission_of_template(template_id))
  );

-- ---------------------------------------------------------------------------
-- Grants — mirror the sibling template tables EXACTLY (authenticated=arwdm,
-- service_role=all, anon=nothing). Supabase's default privileges grant ALL in
-- `public` to anon/authenticated, so the revokes are load-bearing, not tidying:
-- without them `authenticated` would hold TRUNCATE/REFERENCES/TRIGGER here while
-- ADR 0095 M5/M6 deliberately revoked exactly those on every sibling.
-- A missing GRANT on a new table is a 42501 on every read.
-- ---------------------------------------------------------------------------

revoke all on public.process_template_versions from anon;
revoke all on public.process_template_versions from authenticated;
grant select, insert, update, delete on public.process_template_versions to authenticated;
grant all on public.process_template_versions to service_role;
