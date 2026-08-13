-- AFF W1 / T1.1 — `public.hospital_affiliations`: "this person works at this hospital".
--
-- ADR 0097 (hospital affiliation, person identity, org people directory), decisions
-- D1–D4 + D6. Affiliation is a **VISIBILITY input, never a CAPABILITY input** (D2):
-- it answers "whom may this administrator see"; it grants the affiliated person
-- nothing. That is the clean split `profiles.home_hospital_id`'s RLS leg was reaching
-- for before it went inert (dropped in 20260909000300).
--
-- Shape notes that are decisions, not taste:
--
--  * **The `(hospital_id, organization_id)` composite FK REPLACES a single-column
--    `hospital_id` FK — it does not join it.** A second FK to an already-reachable
--    target is the PostgREST **PGRST201** ambiguous-embed shape (ADR 0094's recorded
--    lesson; `memberships_hospital_id_fkey` is the precedent this mirrors exactly).
--    Any future embed on this table must be FK-hinted by constraint name.
--  * **Leaving a hospital is a soft `ended_on`, never a DELETE** (D4; the 20-year
--    retention regime of ADR 0035). History is legitimate and unbounded, so there is
--    NO `unique (principal_id, hospital_id)` — only a PARTIAL unique over the active
--    rows.
--  * **Matrícula (`hospital_employee_id`) lives HERE, not on `profiles`** (D3): a
--    professional working at two hospitals holds a different matrícula at each.
--  * **`authenticated` gets SELECT only — no DML grant.** Writes go through the W2
--    DEFINER doors (`affiliate_person` / `end_affiliation`, D13), because a write that
--    grants read access to a person's profile is an authorization mutation regardless
--    of its HR clothing. Same posture as `memberships` (`authenticated=r`).

create table public.hospital_affiliations (
  id                   uuid primary key default gen_random_uuid(),
  principal_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  hospital_id          uuid not null,
  hospital_employee_id text,
  started_on           date not null default current_date,
  ended_on             date,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  ended_by             uuid references public.profiles(id),

  -- The composite FK IS the hospital FK (see header). It also pins the row's org to
  -- the hospital's org, so `organization_id` can never drift from the hierarchy.
  constraint hospital_affiliations_hospital_id_fkey
    foreign key (hospital_id, organization_id)
    references public.hospitals (id, organization_id) on delete cascade,

  constraint hospital_affiliations_period_ck
    check (ended_on is null or ended_on >= started_on),
  constraint hospital_affiliations_employee_id_not_blank
    check (hospital_employee_id is null or btrim(hospital_employee_id) <> ''),
  -- `ended_by` records WHO ended it; it cannot exist without an end.
  constraint hospital_affiliations_ended_by_shape
    check (ended_by is null or ended_on is not null)
);

-- One ACTIVE affiliation per (person, hospital); any number of historical ones (D4).
create unique index hospital_affiliations_active_uq
  on public.hospital_affiliations (principal_id, hospital_id)
  where ended_on is null;

create index hospital_affiliations_principal_idx
  on public.hospital_affiliations (principal_id);
create index hospital_affiliations_hospital_active_idx
  on public.hospital_affiliations (hospital_id, principal_id)
  where ended_on is null;
create index hospital_affiliations_org_idx
  on public.hospital_affiliations (organization_id);

comment on table public.hospital_affiliations is
  'Employment link person <-> hospital (ADR 0097 D1). A VISIBILITY input, never a capability input: it never grants the affiliated person anything. Ended with a soft ended_on, NEVER deleted (D4). Writes go through the W2 DEFINER doors; authenticated holds SELECT only.';
comment on column public.hospital_affiliations.hospital_employee_id is
  'Matricula, per EMPLOYMENT (ADR 0097 D3) — a person working at two hospitals holds a different one at each. Moved off profiles by 20260909000300.';
comment on column public.hospital_affiliations.ended_on is
  'Soft end (ADR 0097 D4). NULL = active. Ending is refused while the person holds active memberships of any tier under the hospital (D5, enforced by the W2 end_affiliation door).';

-- ---------------------------------------------------------------------------
-- RLS. Rule 1: the DB is the security boundary.
-- ---------------------------------------------------------------------------
alter table public.hospital_affiliations enable row level security;

-- Supabase's default privileges grant ALL on new public tables to anon +
-- authenticated; revoke first, then grant the single privilege this table has
-- (mirrors `memberships`, whose relacl is `authenticated=r`).
revoke all on public.hospital_affiliations from anon, authenticated;
grant select on public.hospital_affiliations to authenticated;

-- FOUR legs (ADR 0097 D6; audit MEDIUM-4 — a bare mirror of the two ADMIN legs would
-- hide a person's own affiliations from their own account page and hide everything
-- from an org_admin, and would then also red the W2 dominance grid):
--
--   1. self          — the person reads their own employment rows;
--   2. org_admin     — the org is the tenant boundary (ADR 0097 finding 1 / LOW-1);
--   3. affiliation   — I administer THIS ROW's hospital;
--   4. membership    — the principal holds a membership of ANY tier under a hospital
--                      I administer (hospital-tier rows carry `hospital_id`;
--                      commission-tier rows resolve via `commissions.hospital_id`,
--                      per `memberships_scope_shape`). This is the leg that closes
--                      ADR 0097 finding 3 (six membership rows whose `principal_id`
--                      a hospital admin could not resolve).
--
-- ⚠ Leg 3 is deliberately ROW-scoped (`this row's hospital`) rather than
-- principal-scoped: a principal-scoped affiliation leg would have to read
-- `hospital_affiliations` from inside a policy ON `hospital_affiliations`, which is
-- infinite policy recursion (42P17) unless laundered through a new SECURITY DEFINER
-- helper — a new `prosecdef` gate to census, sweep and keystone forever, for reach the
-- W2 directory door (`list_org_people`, D10/D11) already serves by design.
--
-- ⚠ `app.is_admin()` is deliberately ABSENT. ADR 0097 D6 specifies four legs; the noun
-- rule (ADR 0078 A35) grants platform_admin tenancy + identity administration, but no
-- decision of record extends it to employment rows, and an undeclared fifth leg is
-- exactly the drive-by widening ADR 0079 exists to catch. If it is wanted, it is a
-- one-line amendment with its own keystone.
create policy hospital_affiliations_select
  on public.hospital_affiliations
  for select
  to authenticated
  using (
    principal_id = (select auth.uid())
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(hospital_id)
    or exists (
      select 1
      from public.memberships m
      left join public.commissions c on c.id = m.commission_id
      where m.principal_id = hospital_affiliations.principal_id
        and coalesce(m.hospital_id, c.hospital_id) is not null
        and app.is_hospital_admin_of(coalesce(m.hospital_id, c.hospital_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Audit (Rule 11). Records THAT and WHO, never a payload — the metadata carries the
-- scope ids and the principal only. `hospital_employee_id` is deliberately NOT logged:
-- it is an employer-issued identifier, i.e. payload.
-- ---------------------------------------------------------------------------
create or replace function app.trg_audit_hospital_affiliations()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row     public.hospital_affiliations;
  v_action  text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    v_row     := new;
    v_action  := 'affiliation.created';
    v_summary := 'Vínculo hospitalar criado';
  else
    -- Only the transition active -> ended is an event. A matrícula or date edit is
    -- not (same discipline as trg_audit_memberships' title_id-only update).
    if new.ended_on is not null and old.ended_on is null then
      v_row     := new;
      v_action  := 'affiliation.ended';
      v_summary := 'Vínculo hospitalar encerrado';
    else
      return null;
    end if;
  end if;

  perform app.audit_write(
    v_action, 'hospital_affiliation', v_row.id, null, v_summary,
    jsonb_build_object(
      'user_id',         v_row.principal_id,
      'organization_id', v_row.organization_id,
      'hospital_id',     v_row.hospital_id
    ),
    v_row.organization_id, v_row.hospital_id);

  return null;
end;
$$;

revoke all on function app.trg_audit_hospital_affiliations() from public;

create trigger trg_audit_hospital_affiliations
  after insert or update on public.hospital_affiliations
  for each row execute function app.trg_audit_hospital_affiliations();
