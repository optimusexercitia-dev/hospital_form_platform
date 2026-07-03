-- =============================================================================
-- Phase A · A1 — Hospital-admin role on `organization_members` (ADR 0051)
-- =============================================================================
-- Widens the ADR-0041 role seam so an admin LOCAL to one hospital can mirror
-- org_admin authority over that hospital's commissions. This migration ONLY
-- lays the schema seam (the role, the hospital_id column, the cardinality); the
-- combined predicate + the ~60-site swap is A2, the audit tier is A3, the
-- appointment RPCs are A4.
--
-- Phase-A CHECK phasing (ADR 0051 Decision 2; approved Q1): the hospital_id-iff-
-- role CHECK binds hospital_id ONLY for `hospital_admin` in this phase.
-- `nsp_coordinator` STAYS org-level (hospital_id NULL) exactly as ADR 0042 left
-- it — so every NSP seed row + spec stays green. `nsp_org_admin` is admitted to
-- the role CHECK now (org-level, NULL); its BEHAVIOR ships in Phase B (the row is
-- inert this phase). Phase B (ADR 0052) re-keys nsp_coordinator per-hospital and
-- widens this CHECK in the same migration that migrates the coordinator rows.
-- =============================================================================

-- 1. The hospital scope column (nullable; set only for hospital-bound roles).
alter table public.organization_members
  add column if not exists hospital_id uuid
  references public.hospitals(id) on delete cascade;

comment on column public.organization_members.hospital_id is
  'The hospital a hospital-bound role row scopes to (ADR 0051). NULL for org-level roles (org_admin, nsp_org_admin, nsp_coordinator). Phase A: set IFF role = hospital_admin. Phase B widens the iff-CHECK to include nsp_coordinator.';

-- 2. Widen the role CHECK. No existing row violates it (org_admin / nsp_coordinator
--    stay valid); nsp_org_admin + hospital_admin are admitted.
alter table public.organization_members
  drop constraint if exists organization_members_role_check;
alter table public.organization_members
  add constraint organization_members_role_check
  check (role = any (array['org_admin','nsp_org_admin','hospital_admin','nsp_coordinator']));

comment on constraint organization_members_role_check on public.organization_members is
  'Hospital-admin tier (ADR 0051): {org_admin, nsp_org_admin, hospital_admin, nsp_coordinator}. org_admin = org super-user; hospital_admin = org_admin mirrored over ONE hospital (Phase A); nsp_org_admin = org-level NSP admin (behavior in Phase B); nsp_coordinator = curates the org PQS roster (ADR 0042, org-level in Phase A).';

-- 3. hospital_id present IFF the role is hospital-bound. Phase A: hospital_admin
--    ONLY (Decision 2 / Q1). nsp_coordinator + nsp_org_admin stay on the NULL arm.
alter table public.organization_members
  add constraint organization_members_hospital_scope
  check (
    (role = 'hospital_admin' and hospital_id is not null)
    or (role in ('org_admin','nsp_org_admin','nsp_coordinator') and hospital_id is null)
  );

comment on constraint organization_members_hospital_scope on public.organization_members is
  'Phase A (ADR 0051 Decision 2): hospital_id is set IFF role = hospital_admin; all other roles are org-level (NULL). Phase B re-keys nsp_coordinator per-hospital and moves it to the NOT-NULL arm.';

-- 4. Cardinality: one user may hold MANY roles and administer MANY hospitals.
--    Move off the (org, user) unique to a composite that includes role + hospital.
--    UNIQUE NULLS NOT DISTINCT (PG17) so a second org-level role for the same
--    (org, user) — both hospital_id NULL — still collides (idempotent appointments)
--    while distinct hospitals for hospital_admin coexist.
alter table public.organization_members
  drop constraint if exists organization_members_org_user_key;
alter table public.organization_members
  add constraint organization_members_identity_key
  unique nulls not distinct (organization_id, user_id, role, hospital_id);

comment on constraint organization_members_identity_key on public.organization_members is
  'Hospital-admin tier (ADR 0051): a user may hold multiple roles and administer multiple hospitals. NULLS NOT DISTINCT (PG17) so two org-level rows of the same (org,user,role) still collide (idempotent), while per-hospital hospital_admin rows coexist.';

-- 5. Same-org integrity: hospital_id's org must equal organization_id. A CHECK
--    cannot sub-query, so guard with a BEFORE INSERT/UPDATE trigger (mirrors the
--    commissions derive/guard pattern).
create or replace function app.guard_org_member_hospital_org()
  returns trigger
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if new.hospital_id is not null then
    if (select organization_id from public.hospitals where id = new.hospital_id)
       is distinct from new.organization_id then
      raise exception 'hospital_id % does not belong to organization %',
        new.hospital_id, new.organization_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
alter function app.guard_org_member_hospital_org() owner to postgres;

comment on function app.guard_org_member_hospital_org() is
  'Same-org integrity for organization_members (ADR 0051): a hospital-bound row''s hospital must belong to the row''s organization. Raises check_violation otherwise.';

drop trigger if exists guard_org_member_hospital_org_trg on public.organization_members;
create trigger guard_org_member_hospital_org_trg
  before insert or update on public.organization_members
  for each row execute function app.guard_org_member_hospital_org();

-- 6. Index the new scope column for the hospital_admin predicate's lookups.
create index if not exists organization_members_hospital_idx
  on public.organization_members using btree (hospital_id)
  where hospital_id is not null;
