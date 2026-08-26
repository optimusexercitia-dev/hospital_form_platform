-- AFF4 B1 — ADR 0151 D1: `organization_affiliations`, the person <-> organization edge with
-- a lifecycle. Until now the only such edge was `profiles.home_organization_id`: single-valued,
-- trigger-enforced NOT NULL for non-admin profiles, and with no tense at all — which is why
-- org-level offboarding was *unrepresentable* rather than merely un-built.
--
-- Shape mirrors `public.hospital_affiliations` deliberately, measured from the live catalog
-- (columns, CHECK shapes, FK actions, the no-delete guard, the audit trigger, the RLS
-- audience). Two deliberate differences, both from ADR 0151 D7 (the voided tense):
--
--   * `voided_at/voided_by/void_reason` exist HERE FROM BIRTH (the hospital table gains them
--     in the next migration). Void is not end: end says "was true and stopped", void says
--     "was never true". A row may be both; voided takes precedence.
--   * the active partial unique therefore excludes voided rows as well as ended ones, so a
--     mis-entered affiliation can be voided and the person re-affiliated the same day.
--
-- Affiliation is a VISIBILITY input, never a capability input (ADR 0097 D2, extended to the
-- org tier by 0151 D1). `memberships` stays the sole role store: nothing here grants anything.
--
-- Writes are door-only. RLS is enabled with a single SELECT policy and NO write policies, so
-- every INSERT/UPDATE from `authenticated` is refused by RLS default-deny; the doors land in
-- AFF4 B4 (`affiliate_person_to_org`, `end_org_affiliation`, `update_org_affiliation`,
-- `void_org_affiliation`). Between this migration and B4 the table is intentionally
-- append-nothing from the client: correct, and the reason the missing writer is not a hole.
--
-- Proof: supabase/tests/ (AFF4 B9) — policy audience, no-delete guard, audit verbs, the
-- voided-shape CHECK, and the active-unique index's void exclusion.

-- ---------------------------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------------------------

create table public.organization_affiliations (
  id              uuid primary key default gen_random_uuid(),
  principal_id    uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  started_on      date not null default current_date,
  ended_on        date,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  ended_by        uuid references public.profiles(id),
  voided_at       timestamptz,
  voided_by       uuid references public.profiles(id),
  void_reason     text,

  constraint organization_affiliations_period_ck
    check (ended_on is null or ended_on >= started_on),

  -- Mirrors `hospital_affiliations_ended_by_shape`: an actor may only be recorded on a row
  -- that is actually ended, and a service path may end a row without an actor (NULL).
  constraint organization_affiliations_ended_by_shape
    check (ended_by is null or ended_on is not null),

  -- ADR 0151 D7. `voided_at IS NULL` <=> nothing else about the void is set; and when the row
  -- IS voided the reason is MANDATORY and non-blank (D7/D8: "every void is audited with its
  -- reason"). `voided_by` may be NULL on a service path, exactly as `ended_by` may — the actor
  -- is a nice-to-have, the justification is not.
  constraint organization_affiliations_voided_shape
    check (
      (voided_at is null     and voided_by is null and void_reason is null)
      or
      (voided_at is not null and void_reason is not null and btrim(void_reason) <> '')
    )
);

comment on table public.organization_affiliations is
  'Person <-> organization employment edge with a lifecycle (ADR 0151 D1). Visibility input '
  'only, never a capability input — `memberships` remains the sole role store. Writes are '
  'door-only: RLS carries a SELECT policy and no write policies.';

comment on column public.organization_affiliations.voided_at is
  'ADR 0151 D7 — the voided tense. Void ("was never true") is not end ("was true and '
  'stopped"). A voided row is excluded from the active-unique index, the footprint resolver '
  'and every person-read leg, but the ROW itself stays visible to this table''s own audience.';

-- ---------------------------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------------------------

-- "Active" is defined once (ADR 0151 D6): ended_on IS NULL AND voided_at IS NULL.
create unique index organization_affiliations_active_uq
  on public.organization_affiliations (principal_id, organization_id)
  where ended_on is null and voided_at is null;

create index organization_affiliations_principal_idx
  on public.organization_affiliations (principal_id);

-- (organization_id, principal_id) rather than (organization_id) alone: this is the roster
-- lookup `list_org_people` re-predicates onto in B6 — an EXISTS keyed on both columns, which
-- this serves index-only. Same two-column shape as the sibling
-- `hospital_affiliations_hospital_active_idx`.
create index organization_affiliations_org_active_idx
  on public.organization_affiliations (organization_id, principal_id)
  where ended_on is null and voided_at is null;

-- ---------------------------------------------------------------------------------------------
-- 3. No-delete guard (ADR 0151 D1/D7 — minimise, never destroy; Rule 12 posture)
-- ---------------------------------------------------------------------------------------------

create function app.guard_org_affiliation_no_delete()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  raise exception 'vínculos organizacionais não são excluídos; encerre com end_org_affiliation ou anule com void_org_affiliation (ADR 0151 D1/D7)'
    using errcode = 'check_violation';
end;
$$;

revoke all on function app.guard_org_affiliation_no_delete() from public;

create trigger guard_org_affiliation_no_delete_trg
  before delete on public.organization_affiliations
  for each row execute function app.guard_org_affiliation_no_delete();

-- ---------------------------------------------------------------------------------------------
-- 4. Audit trigger (Architecture Rule 11)
-- ---------------------------------------------------------------------------------------------

create function app.trg_audit_organization_affiliations()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_row      public.organization_affiliations;
  v_action   text;
  v_summary  text;
  v_metadata jsonb;
begin
  if tg_op = 'INSERT' then
    v_row     := new;
    v_action  := 'org_affiliation.created';
    v_summary := 'Vínculo organizacional criado';
  elsif tg_op = 'DELETE' then
    -- Reachable ONLY under session_replication_role = replica: the BEFORE guard raises first
    -- in every other mode. This arm exists so that the one window in which the no-delete rule
    -- can be violated is not also invisible. Mirrors the hospital trigger's D-arm.
    v_row     := old;
    v_action  := 'org_affiliation.deleted';
    v_summary := 'Vínculo organizacional EXCLUÍDO (contrário à ADR 0151 D1)';
  else
    -- Void is tested FIRST: a single UPDATE may set both `ended_on` and `voided_at`, and
    -- ADR 0151 D7 rules that voided takes precedence. Testing `ended_on` first would report
    -- the weaker verb for the stronger act.
    if new.voided_at is not null and old.voided_at is null then
      v_row     := new;
      v_action  := 'org_affiliation.voided';
      v_summary := 'Vínculo organizacional anulado';
    elsif new.ended_on is not null and old.ended_on is null then
      v_row     := new;
      v_action  := 'org_affiliation.ended';
      v_summary := 'Vínculo organizacional encerrado';
    elsif new.started_on is distinct from old.started_on then
      v_row     := new;
      v_action  := 'org_affiliation.updated';
      v_summary := 'Vínculo organizacional atualizado';
    else
      return null;
    end if;
  end if;

  v_metadata := jsonb_build_object(
    'user_id',         v_row.principal_id,
    'organization_id', v_row.organization_id
  );

  -- D8: the reason is part of the audit record, not merely of the row. It is administrative
  -- justification text (no PHI, no payload) — Rule 11 records that + who, never content.
  if v_action = 'org_affiliation.voided' then
    v_metadata := v_metadata || jsonb_build_object('void_reason', v_row.void_reason);
  end if;

  perform app.audit_write(
    v_action, 'organization_affiliation', v_row.id, null, v_summary,
    v_metadata,
    v_row.organization_id, null);

  return null;
end;
$$;

revoke all on function app.trg_audit_organization_affiliations() from public;

create trigger trg_audit_organization_affiliations
  after insert or update or delete on public.organization_affiliations
  for each row execute function app.trg_audit_organization_affiliations();

-- ---------------------------------------------------------------------------------------------
-- 5. RLS + grants (Architecture Rule 1)
-- ---------------------------------------------------------------------------------------------

alter table public.organization_affiliations enable row level security;

-- ADR 0151 D1. Narrower than the hospital sibling by design: there is no hospital tier here,
-- so no `is_hospital_admin_of` arm and no memberships-derived arm. `auth.uid()` is wrapped in
-- a scalar sub-select so the planner hoists it to an InitPlan instead of re-evaluating it
-- per row (the sibling policy's shape).
create policy organization_affiliations_select
  on public.organization_affiliations
  for select
  to authenticated
  using (
    principal_id = (select auth.uid())
    or app.is_org_admin_of(organization_id)
  );

-- No INSERT/UPDATE/DELETE policies: RLS default-deny is the write lock, doors are the only
-- writer (AFF4 B4). Deleting is additionally barred by the BEFORE DELETE guard above.

-- A table created by `postgres` in `public` inherits the default ACL
-- {postgres=arwdDxtm, service_role=arwdDxtm} — anon and authenticated get nothing. The grant
-- below is the only client-visible privilege; the revoke states the anon bound explicitly so
-- a later default-ACL change cannot quietly widen it.
revoke all on table public.organization_affiliations from anon;
grant select on table public.organization_affiliations to authenticated;
grant all on table public.organization_affiliations to service_role;
