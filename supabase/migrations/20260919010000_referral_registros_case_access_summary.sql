-- Referral detail redesign — Phase 1 (Backend).
-- Plan: docs/plans/referral-detail-redesign.md (§ "Phase 1 — Backend", amendments A1–A9).
--
-- Three things land here:
--   1a. `referral_note_types` — a per-commission vocabulary for internal notes,
--       mirroring the LIVE `case_narrative_types` (verified from the catalog, not
--       from migration text): direct RLS-gated writes + ONE reorder RPC (A6).
--   1b. `referral_internal_notes` extended IN PLACE (body -> body_md + title, type,
--       assignee, open/concluded lifecycle). The K-R5-1 lattice (RLS + column-list
--       grants + the audited single door) evolves rather than being rebuilt.
--   1c. The note-lifecycle doors + `get_referral_case_access_summary`.
--
-- ⚠ COLUMN-LIST GRANTS (A4). `referral_internal_notes` has NO table-level ACL for
-- `authenticated` at all — reads work only because each PHI-free column carries its
-- own `GRANT SELECT (col)`. `body` is the one column without one, and that ABSENCE is
-- the K-R5-2 hardening. Every column added below therefore needs its own explicit
-- grant, and `body_md` must receive none.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1a. referral_note_types — mirrors public.case_narrative_types
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mirrored from the live sibling, including the two UNIQUE constraints the plan's
-- DDL omitted. The (commission_id, position) unique is DEFERRABLE on purpose: the
-- reorder RPC rewrites every position in ONE `update ... from`, which transiently
-- collides. A non-deferrable constraint would make reorder fail on any swap.
-- The sibling carries NO composite tenant FK (checked in pg_constraint), so neither
-- does this table.
create table public.referral_note_types (
  id            uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  label         text not null,
  description   text,
  archived      boolean not null default false,
  position      integer not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint referral_note_types_label_not_blank check (btrim(label) <> ''),
  constraint referral_note_types_commission_label_key unique (commission_id, label),
  constraint referral_note_types_commission_position_key
    unique (commission_id, position) deferrable
);

create index referral_note_types_commission_idx
  on public.referral_note_types (commission_id);

comment on table public.referral_note_types is
  'Per-commission vocabulary for referral internal notes (Registros internos). Mirrors case_narrative_types: RLS-gated direct writes by staff_admin, one DEFINER-free reorder RPC. PHI-free by input policy (labels are governance metadata).';

alter table public.referral_note_types enable row level security;

-- Predicates copied verbatim from the LIVE case_narrative_types policies.
create policy referral_note_types_select
  on public.referral_note_types
  for select
  to authenticated
  using (app.is_member_of(commission_id) or app.is_tenancy_admin_of(commission_id));

create policy referral_note_types_staff_admin_write
  on public.referral_note_types
  to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_tenancy_admin_of(commission_id))
  with check (app.is_staff_admin_of(commission_id) or app.is_tenancy_admin_of(commission_id));

revoke all on public.referral_note_types from public;
revoke all on public.referral_note_types from anon;
grant select, insert, update, delete on public.referral_note_types to authenticated;

-- Rule 11: writes here are DIRECT (RLS-gated), not funnelled through an audited RPC,
-- so the audit row has to come from a trigger — exactly as the sibling does.
create or replace function app.trg_audit_referral_note_types()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['label', 'position', 'archived'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('referral_note_type.created', 'referral_note_type', new.id,
      new.commission_id, 'Tipo de registro criado: ' || coalesce(new.label, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
  else
    perform app.audit_write('referral_note_type.updated', 'referral_note_type', new.id,
      new.commission_id, 'Tipo de registro atualizado: ' || coalesce(new.label, ''),
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

create or replace function app.touch_referral_note_updated_at()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger audit_referral_note_types_trg
  after insert or update on public.referral_note_types
  for each row execute function app.trg_audit_referral_note_types();

create trigger touch_referral_note_types_updated_at
  before update on public.referral_note_types
  for each row execute function app.touch_referral_note_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1b. referral_internal_notes — extend in place
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.referral_internal_notes rename column body to body_md;

alter table public.referral_internal_notes
  add column title        text,
  add column note_type_id uuid references public.referral_note_types(id) on delete set null,
  add column type_label   text,
  add column assigned_to  uuid references public.profiles(id),
  add column status       text not null default 'open'
                          check (status in ('open', 'concluded')),
  add column concluded_at timestamptz,
  add column concluded_by uuid references public.profiles(id),
  add column updated_at   timestamptz not null default now(),
  add column updated_by   uuid references public.profiles(id),
  add constraint referral_notes_concluded_shape
    check ((status = 'concluded') = (concluded_at is not null));

-- No backfill by design: pre-existing rows become untitled, untyped, OPEN notes.
comment on column public.referral_internal_notes.body_md is
  'PHI-bearing sanitized Markdown (Rule 12 free-text). Column-REVOKED from authenticated — served ONLY by list_referral_internal_notes (K-R5-2).';
comment on column public.referral_internal_notes.type_label is
  'Label snapshotted from referral_note_types at pick time; NULL = untyped/legacy. Survives a later rename or archive of the type.';

create index referral_internal_notes_assigned_idx
  on public.referral_internal_notes (assigned_to)
  where assigned_to is not null;

create trigger touch_referral_internal_notes_updated_at
  before update on public.referral_internal_notes
  for each row execute function app.touch_referral_note_updated_at();

-- The CHECK follows the rename by OID, but its NAME does not. A constraint called
-- `..._body_not_blank` guarding `body_md` is the stale-name class; re-key it.
alter table public.referral_internal_notes
  rename constraint referral_internal_notes_body_not_blank
  to referral_internal_notes_body_md_not_blank;

-- ── A RENAME ORPHANS EVERY NAME-KEYED REFERENCE ───────────────────────────────
-- Column privileges and CHECKs follow a rename by OID; plpgsql function bodies do
-- NOT — they resolve column names at RUNTIME. Swept `pg_proc` for every app/public
-- body mentioning `referral_internal_notes` (13 functions): exactly one writes the
-- renamed column, and it is `public.dispose_referral_phi` — the LGPD Art. 18 erasure
-- path (Rule 12). Left unpatched, the rename does not fail the migration; it fails
-- PHI DISPOSAL at runtime, which is the worst possible place to discover it.
-- (`get_referral_detail`'s `m.body` is referral_MESSAGES, a different table;
--  `app._audit_access_authorized` calls the plural *_notes predicate, no column.)
--
-- Re-emitted from the LIVE `pg_get_functiondef`, never from migration text — every
-- other property of the function (and its ACL, via CREATE OR REPLACE) is preserved.
-- The equality guard is mandatory: a `replace()` that matches nothing silently
-- no-ops, leaving disposal broken behind a green migration.
do $orphan$
declare
  v_def text := pg_get_functiondef('public.dispose_referral_phi(uuid, text)'::regprocedure);
  v_new text;
begin
  v_new := replace(
    v_def,
    'update public.referral_internal_notes set body = v_redacted where referral_id = p_referral_id;',
    'update public.referral_internal_notes set body_md = v_redacted where referral_id = p_referral_id;');
  if v_new = v_def then
    raise exception
      'dispose_referral_phi: the internal-note redaction statement was not found; refusing to leave PHI disposal orphaned by the body -> body_md rename';
  end if;
  execute v_new;
end
$orphan$;

-- A4 — the column-list grant matrix. Privileges DO follow a rename, but body_md is a
-- keystone column: re-assert the REVOKE explicitly and grant each NEW column.
revoke select (body_md) on public.referral_internal_notes from authenticated;
revoke select (body_md) on public.referral_internal_notes from anon;
grant select (title, note_type_id, type_label, assigned_to, status,
              concluded_at, concluded_by, updated_at, updated_by)
  on public.referral_internal_notes to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1c-i. Named authority predicates for the note lifecycle
-- ═══════════════════════════════════════════════════════════════════════════════
-- These are deliberately NAMED boolean gates rather than inline `if` conditions:
-- ADR 0079 Amendment 5 — a scalar-returning DEFINER door is invisible to ARM=census,
-- while a prosecdef BOOLEAN is in its LIVE domain. Naming the gate is what puts it
-- inside the standing invariant's field of view.
--
-- AUTHORITY ONLY — no lifecycle term. Mixing `status = 'open'` in here would make the
-- 42501-before-HC0A9 ordering inexpressible (a concluded note would report "sem
-- permissão" to its own author).

create or replace function app.can_edit_referral_internal_note(p_note_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.can_read_referral_internal_note(p_note_id, p_uid)
     and exists (
       select 1
       from public.referral_internal_notes n
       where n.id = p_note_id
         and (
           n.author_user_id = p_uid
           or n.assigned_to = p_uid
           or app.is_staff_admin_of_for(n.committee_id, p_uid)
         )
     );
$$;

comment on function app.can_edit_referral_internal_note(uuid, uuid) is
  'Authority to author-edit / conclude a referral internal note: an owning-side reader who is the author, the assignee, or a coordinator of the note''s own committee. Carries NO lifecycle term — the open/concluded check is the RPC''s domain step (HC0A9), applied after this one (42501).';

create or replace function app.can_manage_referral_internal_note(p_note_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.can_read_referral_internal_note(p_note_id, p_uid)
     and exists (
       select 1
       from public.referral_internal_notes n
       where n.id = p_note_id
         and app.is_staff_admin_of_for(n.committee_id, p_uid)
     );
$$;

comment on function app.can_manage_referral_internal_note(uuid, uuid) is
  'Authority to assign/unassign a referral internal note: a coordinator (staff_admin) of the note''s OWNING committee side only. Strictly narrower than can_edit_referral_internal_note.';

revoke all on function app.can_edit_referral_internal_note(uuid, uuid) from public;
revoke all on function app.can_manage_referral_internal_note(uuid, uuid) from public;
grant execute on function app.can_edit_referral_internal_note(uuid, uuid) to authenticated;
grant execute on function app.can_manage_referral_internal_note(uuid, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1c-ii. create_referral_internal_note — re-created (params added + body renamed)
-- ═══════════════════════════════════════════════════════════════════════════════
-- `create or replace` CANNOT add parameters: it would mint a SECOND overload and leave
-- the 3-arg door live, giving PostgREST two candidates. Drop and re-create, then
-- re-issue the EXECUTE grant — a param add/rename is a privilege reset (A3).
--
-- ⛔ LIVE DEFECT FIXED HERE (proven against the catalog, not inferred). The previous
-- gate read:
--     if p_committee_id not in (v_ref.source_commission_id, v_ref.target_commission_id)
--        or not app.is_member_of_for(p_committee_id, auth.uid()) then raise 42501
-- On a `technical_director`-target referral `target_commission_id IS NULL`, so
-- `x not in (source, null)` evaluates to NULL for any x <> source. `NULL or false` is
-- NULL, and plpgsql's `if` treats NULL as false — so the raise never fired. Verified
-- live: a member of Farmácia A (NEITHER side of a DT-target referral) successfully
-- authored a note owned by their own commission. It is a write-only orphan (no side
-- of `can_read_referral_internal_note` matches it, so nobody can read it back), i.e.
-- unauthorized write + audit noise rather than a read leak — but it is unauthorized.
-- `is distinct from` is NULL-safe and closes it.
drop function if exists public.create_referral_internal_note(uuid, uuid, text);

create function public.create_referral_internal_note(
  p_referral_id  uuid,
  p_committee_id uuid,
  p_body_md      text,
  p_title        text default null,
  p_note_type_id uuid default null,
  p_assigned_to  uuid default null
)
returns public.referral_internal_notes
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
  v_type public.referral_note_types;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (42501, distinct SQLSTATE). The committee must be one of the
  -- referral's two sides AND the caller a member of THAT side.
  if (p_committee_id is distinct from v_ref.source_commission_id
      and p_committee_id is distinct from v_ref.target_commission_id)
     or not app.is_member_of_for(p_committee_id, auth.uid()) then
    raise exception 'apenas um membro da comissão de origem ou destino pode registrar uma nota interna'
      using errcode = '42501';
  end if;

  -- DOMAIN validation (after authority).
  if nullif(btrim(p_body_md), '') is null then
    raise exception 'a nota interna não pode estar vazia' using errcode = 'HC0A9';
  end if;

  if p_note_type_id is not null then
    select * into v_type from public.referral_note_types where id = p_note_type_id;
    if v_type.id is null or v_type.commission_id is distinct from p_committee_id then
      raise exception 'tipo de registro inválido para esta comissão' using errcode = 'HC0A9';
    end if;
    if v_type.archived then
      raise exception 'este tipo de registro está arquivado' using errcode = 'HC0A9';
    end if;
  end if;

  if p_assigned_to is not null
     and not app.is_member_of_for(p_committee_id, p_assigned_to) then
    raise exception 'o responsável deve ser um membro ativo desta comissão'
      using errcode = 'HC0A9';
  end if;

  insert into public.referral_internal_notes
    (referral_id, committee_id, author_user_id, body_md, title,
     note_type_id, type_label, assigned_to, updated_by)
  values
    (p_referral_id, p_committee_id, auth.uid(), btrim(p_body_md),
     nullif(btrim(p_title), ''), p_note_type_id, v_type.label, p_assigned_to, auth.uid())
  returning * into v_row;

  perform app.audit_write(
    'referral.note_created', 'referral', p_referral_id, p_committee_id,
    'Nota interna registrada no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_row.id, 'committee_id', p_committee_id));

  return v_row;
end;
$$;

revoke all on function public.create_referral_internal_note(uuid, uuid, text, text, uuid, uuid) from public;
revoke all on function public.create_referral_internal_note(uuid, uuid, text, text, uuid, uuid) from anon;
grant execute on function public.create_referral_internal_note(uuid, uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.create_referral_internal_note(uuid, uuid, text, text, uuid, uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1c-iii. Note lifecycle doors
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.update_referral_internal_note(
  p_note_id      uuid,
  p_title        text,
  p_body_md      text,
  p_note_type_id uuid default null
)
returns public.referral_internal_notes
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_type public.referral_note_types;
  v_row  public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  -- AUTHORITY FIRST (42501).
  if not app.can_edit_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas o autor, o responsável ou a coordenação desta comissão pode editar este registro'
      using errcode = '42501';
  end if;

  -- DOMAIN (after authority).
  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído e não pode ser editado'
      using errcode = 'HC0A9';
  end if;
  if v_note.redacted_at is not null then
    raise exception 'este registro foi redigido e não pode ser editado' using errcode = 'HC0A9';
  end if;
  if nullif(btrim(p_body_md), '') is null then
    raise exception 'a nota interna não pode estar vazia' using errcode = 'HC0A9';
  end if;

  if p_note_type_id is not null then
    select * into v_type from public.referral_note_types where id = p_note_type_id;
    if v_type.id is null or v_type.commission_id is distinct from v_note.committee_id then
      raise exception 'tipo de registro inválido para esta comissão' using errcode = 'HC0A9';
    end if;
    if v_type.archived then
      raise exception 'este tipo de registro está arquivado' using errcode = 'HC0A9';
    end if;
  end if;

  -- p_note_type_id NULL means "untyped": both the pointer and the snapshot clear.
  update public.referral_internal_notes
     set title        = nullif(btrim(p_title), ''),
         body_md      = btrim(p_body_md),
         note_type_id = p_note_type_id,
         type_label   = v_type.label,
         updated_by   = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_updated', 'referral', v_note.referral_id, v_note.committee_id,
    'Nota interna atualizada no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id, 'committee_id', v_note.committee_id));

  return v_row;
end;
$$;

create or replace function public.assign_referral_internal_note(
  p_note_id uuid,
  p_user_id uuid
)
returns public.referral_internal_notes
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  -- AUTHORITY FIRST (42501) — coordinator of the note's OWN side only.
  if not app.can_manage_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas a coordenação desta comissão pode atribuir um responsável'
      using errcode = '42501';
  end if;

  -- DOMAIN (after authority).
  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído e não pode receber um responsável'
      using errcode = 'HC0A9';
  end if;
  if p_user_id is null
     or not app.is_member_of_for(v_note.committee_id, p_user_id) then
    raise exception 'o responsável deve ser um membro ativo desta comissão'
      using errcode = 'HC0A9';
  end if;

  update public.referral_internal_notes
     set assigned_to = p_user_id, updated_by = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_assigned', 'referral', v_note.referral_id, v_note.committee_id,
    'Responsável definido para uma nota interna do encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id, 'assigned_to', p_user_id));

  return v_row;
end;
$$;

create or replace function public.unassign_referral_internal_note(p_note_id uuid)
returns public.referral_internal_notes
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  if not app.can_manage_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas a coordenação desta comissão pode remover o responsável'
      using errcode = '42501';
  end if;

  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído' using errcode = 'HC0A9';
  end if;

  update public.referral_internal_notes
     set assigned_to = null, updated_by = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_unassigned', 'referral', v_note.referral_id, v_note.committee_id,
    'Responsável removido de uma nota interna do encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id));

  return v_row;
end;
$$;

create or replace function public.conclude_referral_internal_note(p_note_id uuid)
returns public.referral_internal_notes
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  if not app.can_edit_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas o autor, o responsável ou a coordenação desta comissão pode concluir este registro'
      using errcode = '42501';
  end if;

  -- DOMAIN: conclusion is one-way (the note freezes; redaction stays the only
  -- post-conclusion correction — D10).
  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído' using errcode = 'HC0A9';
  end if;

  update public.referral_internal_notes
     set status = 'concluded', concluded_at = now(),
         concluded_by = auth.uid(), updated_by = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_concluded', 'referral', v_note.referral_id, v_note.committee_id,
    'Nota interna concluída no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id));

  return v_row;
end;
$$;

revoke all on function public.update_referral_internal_note(uuid, text, text, uuid) from public;
revoke all on function public.update_referral_internal_note(uuid, text, text, uuid) from anon;
grant execute on function public.update_referral_internal_note(uuid, text, text, uuid) to authenticated;
grant execute on function public.update_referral_internal_note(uuid, text, text, uuid) to service_role;

revoke all on function public.assign_referral_internal_note(uuid, uuid) from public;
revoke all on function public.assign_referral_internal_note(uuid, uuid) from anon;
grant execute on function public.assign_referral_internal_note(uuid, uuid) to authenticated;
grant execute on function public.assign_referral_internal_note(uuid, uuid) to service_role;

revoke all on function public.unassign_referral_internal_note(uuid) from public;
revoke all on function public.unassign_referral_internal_note(uuid) from anon;
grant execute on function public.unassign_referral_internal_note(uuid) to authenticated;
grant execute on function public.unassign_referral_internal_note(uuid) to service_role;

revoke all on function public.conclude_referral_internal_note(uuid) from public;
revoke all on function public.conclude_referral_internal_note(uuid) from anon;
grant execute on function public.conclude_referral_internal_note(uuid) to authenticated;
grant execute on function public.conclude_referral_internal_note(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1c-iv. list_referral_internal_notes — new projection + ordering
-- ═══════════════════════════════════════════════════════════════════════════════
-- K-R5-1 gate and the Rule 11 read audit are UNCHANGED. What changes: the element
-- shape (the `body` key becomes `body_md`, plus the new fields) and the order —
-- open notes first, then concluded, created_at DESC within each group.
create or replace function public.list_referral_internal_notes(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uid    uuid := auth.uid();
  v_result jsonb;
  v_count  int;
  v_ref    public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'referral_id', n.referral_id,
           'committee_id', n.committee_id,
           'author_user_id', n.author_user_id,
           'author_name', (select full_name from public.profiles where id = n.author_user_id),
           'title', n.title,
           'note_type_id', n.note_type_id,
           'type_label', n.type_label,
           -- Redacted notes render [redigido] (the real body stays in the table,
           -- append-only + audited); distinct from disposal's [PHI removido].
           'body_md', case when n.redacted_at is not null then '[redigido]' else n.body_md end,
           'assigned_to', n.assigned_to,
           'assigned_to_name', (select full_name from public.profiles where id = n.assigned_to),
           'status', n.status,
           'concluded_at', n.concluded_at,
           'concluded_by', n.concluded_by,
           'concluded_by_name', (select full_name from public.profiles where id = n.concluded_by),
           'created_at', n.created_at,
           'updated_at', n.updated_at,
           'redacted_at', n.redacted_at,
           'redacted_by', n.redacted_by,
           'redacted_by_name', (select full_name from public.profiles where id = n.redacted_by),
           'redacted_reason', n.redacted_reason
         ) order by (n.status = 'concluded'), n.created_at desc), '[]'::jsonb)
    into v_result
  from public.referral_internal_notes n
  where n.referral_id = p_referral_id
    and app.can_read_referral_internal_note(n.id, v_uid);

  -- Rule 11: a served note body is a PHI read → log THAT + WHO (never the payload).
  -- No notes served (cross-side / unauthorized reader) → nothing read → no audit.
  v_count := jsonb_array_length(v_result);
  if v_count > 0 then
    select * into v_ref from public.case_referral where id = p_referral_id;
    perform public.log_audit_access(
      'referral.note_viewed', 'referral', p_referral_id,
      v_ref.source_commission_id,
      'Leitura de ' || v_count || ' nota(s) interna(s) do encaminhamento '
        || coalesce(v_ref.code, ''),
      jsonb_build_object('referral_id', p_referral_id, 'note_count', v_count)
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.list_referral_internal_notes(uuid) from public;
revoke all on function public.list_referral_internal_notes(uuid) from anon;
grant execute on function public.list_referral_internal_notes(uuid) to authenticated;
grant execute on function public.list_referral_internal_notes(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1c-v. reorder_referral_note_types
-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY INVOKER, mirroring the LIVE public.reorder_case_narrative_types
-- (`prosecdef = false` in pg_proc — amendment A6 asserts it is a DEFINER RPC and the
-- catalog says otherwise; the live sibling wins). RLS therefore remains the security
-- boundary (Rule 1): referral_note_types_staff_admin_write gates the UPDATE, and the
-- explicit raise below only converts a silent zero-row no-op into a pt-BR 42501.
create or replace function public.reorder_referral_note_types(
  p_commission_id uuid,
  p_ordered_ids   uuid[]
)
returns void
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_referrals_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_tenancy_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.referral_note_types d
  set position = o.ord
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

revoke all on function public.reorder_referral_note_types(uuid, uuid[]) from public;
revoke all on function public.reorder_referral_note_types(uuid, uuid[]) from anon;
grant execute on function public.reorder_referral_note_types(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_referral_note_types(uuid, uuid[]) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1c-vi. get_referral_case_access_summary
-- ═══════════════════════════════════════════════════════════════════════════════
-- Powers the "Abrir registro do caso" fallback dialog: when the viewer cannot read
-- the side's case, tell them WHO can, so they know whom to ask.
--
-- PARITY BY CONSTRUCTION (A7). The roster is not a re-implementation of
-- `app.can_read_case`'s arms — re-implementing them is exactly how the two drift. The
-- five arms below are used ONLY to enumerate CANDIDATES; inclusion is then decided by
-- calling `app.has_case_capability(case, uid, 'read_case_content')` — the very
-- resolver `app.can_read_case` projects. So the returned roster is, definitionally,
-- "the people for whom can_read_case is true", merely grouped by how they got there.
-- The hard denies (`is_case_respondent`, `is_recused_from_case`, `app.is_active`) and
-- the S6/S7 side conditions come along for free, inside the resolver.
--
-- Candidate completeness is checkable against app._case_caps: read_case_content is
-- conferred by S1 (coordinator), S3 (case_access_grants), S4 (phase/narrative
-- assignee), S6 (PQS/NSP operator) and S7 (quality reviewer) and by nothing else.
-- S2 (org_admin) and S5 (plain member) confer only manage_case_access /
-- read_case_deliberation, so they are correctly absent.
--
-- PHI-free: full_name only. Never an e-mail, a role, a grant reason or an expiry.
create or replace function public.get_referral_case_access_summary(
  p_referral_id   uuid,
  p_commission_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_ref        public.case_referral;
  v_case       uuid;
  v_commission uuid;
  v_hospital   uuid;
  v_result     jsonb;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (42501). Three terms, all required:
  --   1. p_commission_id is one of the referral's two sides (NULL-safe: a
  --      technical_director target leaves target_commission_id NULL);
  --   2. the caller is an active member of THAT side;
  --   3. the caller can read the referral at all (this is what denies a target-side
  --      member while the referral is still a draft).
  if (p_commission_id is distinct from v_ref.source_commission_id
      and p_commission_id is distinct from v_ref.target_commission_id)
     or not app.is_member_of_for(p_commission_id, auth.uid())
     or not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'apenas um membro da comissão de origem ou destino pode consultar o acesso ao caso'
      using errcode = '42501';
  end if;

  -- The case is SIDE-DERIVED, never caller-chosen.
  if p_commission_id = v_ref.source_commission_id then
    v_case := v_ref.source_case_id;
  else
    v_case := v_ref.target_case_id;
  end if;

  -- Target side with no linked case yet → nothing to describe.
  if v_case is null then
    return null;
  end if;

  select c.commission_id into v_commission from public.cases c where c.id = v_case;
  if v_commission is null then
    return null;
  end if;
  v_hospital := app.hospital_of_commission(v_commission);

  with cand as (
    -- S1 · committee coordinators of the case's OWN commission
    select m.principal_id as uid, 1 as grp
      from public.memberships m
     where m.commission_id = v_commission
       and m.role = 'staff_admin'
       and (m.expires_at is null or m.expires_at > now())
    union all
    -- S3 · explicit per-case grants (any live grant; the resolver decides if it reads)
    select g.principal_id, 2
      from public.case_access_grants g
     where g.case_id = v_case
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
    union all
    -- S4 · phase + narrative assignees
    select cp.assigned_to, 3
      from public.case_phases cp
     where cp.case_id = v_case and cp.assigned_to is not null
    union all
    select cn.assigned_to, 3
      from public.case_narratives cn
     where cn.case_id = v_case and cn.assigned_to is not null
    union all
    -- S6 · patient-safety (PQS/NSP) operators of the case's hospital
    select m.principal_id, 4
      from public.memberships m
     where v_hospital is not null
       and m.hospital_id = v_hospital
       and m.role in ('nsp_coordinator', 'pqs_member')
       and (m.expires_at is null or m.expires_at > now())
    union all
    -- S7 · quality reviewers of the case's hospital
    select m.principal_id, 5
      from public.memberships m
     where v_hospital is not null
       and m.hospital_id = v_hospital
       and m.role = 'quality_reviewer'
       and (m.expires_at is null or m.expires_at > now())
  ),
  ranked as (
    -- De-dupe a person into their HIGHEST group (A7 order).
    select uid, min(grp) as grp
      from cand
     where uid is not null
     group by uid
  ),
  eff as (
    select r.grp, p.full_name
      from ranked r
      join public.profiles p on p.id = r.uid
     where app.has_case_capability(v_case, r.uid, 'read_case_content')
       and coalesce(nullif(btrim(p.full_name), ''), '') <> ''
  )
  select jsonb_build_object(
           'case_id', v_case,
           'can_read', app.can_read_case(v_case, auth.uid()),
           'coordinators',   coalesce(to_jsonb(eff_agg.g1), '[]'::jsonb),
           'grantees',       coalesce(to_jsonb(eff_agg.g2), '[]'::jsonb),
           'assignees',      coalesce(to_jsonb(eff_agg.g3), '[]'::jsonb),
           'patient_safety', coalesce(to_jsonb(eff_agg.g4), '[]'::jsonb),
           'quality',        coalesce(to_jsonb(eff_agg.g5), '[]'::jsonb)
         )
    into v_result
  from (
    select array_agg(full_name order by full_name) filter (where grp = 1) as g1,
           array_agg(full_name order by full_name) filter (where grp = 2) as g2,
           array_agg(full_name order by full_name) filter (where grp = 3) as g3,
           array_agg(full_name order by full_name) filter (where grp = 4) as g4,
           array_agg(full_name order by full_name) filter (where grp = 5) as g5
    from eff
  ) eff_agg;

  -- Rule 11: this discloses WHO may read another commission's case. PHI-free
  -- (referral + case ids and a count; never a name).
  perform public.log_audit_access(
    'referral.case_access_summary_viewed', 'referral', p_referral_id, p_commission_id,
    'Consulta do acesso ao caso vinculado ao encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('referral_id', p_referral_id, 'case_id', v_case,
                       'commission_id', p_commission_id));

  return v_result;
end;
$$;

-- ── Registering the read action (Rule 11) ─────────────────────────────────────
-- `public.log_audit_access` is a CLOSED allow-list, and it delegates to the
-- `app._audit_access_authorized` dispatcher so a caller cannot forge a read-audit row
-- for something they may not read. A new `.viewed` action therefore needs BOTH: the
-- allow-list entry AND a dispatch arm. Registering only the first raises
-- 'sem permissão'; registering neither raises 'ação de acesso não permitida'. Both
-- are regenerated from the LIVE definition (never migration text), each behind an
-- equality guard so a stale anchor fails the migration instead of silently no-opping.
do $audit_allow$
declare
  v_def text := pg_get_functiondef('public.log_audit_access(text,text,uuid,uuid,text,jsonb)'::regprocedure);
  v_new text;
begin
  v_new := replace(
    v_def,
    E'    ''minutes_transcript.read''\n  ) then',
    E'    ''minutes_transcript.read'',\n'
    || E'    -- Referral registros: the audited case-access roster read.\n'
    || E'    ''referral.case_access_summary_viewed''\n  ) then');
  if v_new = v_def then
    raise exception 'log_audit_access: allow-list anchor not found; refusing to leave referral.case_access_summary_viewed unregistered';
  end if;
  execute v_new;
end
$audit_allow$;

do $audit_dispatch$
declare
  v_def text := pg_get_functiondef('app._audit_access_authorized(text,uuid,uuid)'::regprocedure);
  v_new text;
begin
  v_new := replace(
    v_def,
    E'    when ''referral.note_viewed'' then\n'
    || E'      return app.can_read_referral_internal_notes(p_entity_id, v_uid);',
    E'    when ''referral.note_viewed'' then\n'
    || E'      return app.can_read_referral_internal_notes(p_entity_id, v_uid);\n'
    || E'    -- Referral registros: the entity is the referral id and p_commission is the\n'
    || E'    -- SIDE whose case is being described. Mirrors get_referral_case_access_summary''s\n'
    || E'    -- own gate so the registry cannot be laxer than the door it records.\n'
    || E'    when ''referral.case_access_summary_viewed'' then\n'
    || E'      return p_commission is not null\n'
    || E'             and app.is_member_of_for(p_commission, v_uid)\n'
    || E'             and app.can_read_referral(p_entity_id, v_uid);');
  if v_new = v_def then
    raise exception 'app._audit_access_authorized: dispatch anchor not found; refusing to leave referral.case_access_summary_viewed unauthorized';
  end if;
  execute v_new;
end
$audit_dispatch$;

revoke all on function public.get_referral_case_access_summary(uuid, uuid) from public;
revoke all on function public.get_referral_case_access_summary(uuid, uuid) from anon;
grant execute on function public.get_referral_case_access_summary(uuid, uuid) to authenticated;
grant execute on function public.get_referral_case_access_summary(uuid, uuid) to service_role;

comment on function public.get_referral_case_access_summary(uuid, uuid) is
  'Grouped, PHI-free roster of who can read the referral side''s case, plus whether the caller can. Side-derived (never caller-chosen); gated on membership of that side AND can_read_referral. Inclusion is decided by app.has_case_capability(...,''read_case_content''), so the roster cannot drift from app.can_read_case.';
