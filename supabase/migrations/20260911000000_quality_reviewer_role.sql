-- =============================================================================
-- QO·A M1 — the `quality_reviewer` membership role (ADR 0100 D1).
--
-- Hospital-scoped (organization_id + hospital_id NOT NULL, commission_id NULL —
-- the nsp_coordinator shape). Multi-hospital coverage = one row per hospital,
-- enforced by memberships_grant_uq (NULLS NOT DISTINCT). This migration is the
-- SUBSTRATE only: the CHECK admits the role and the predicate helpers exist, but
-- the grant/revoke doors still refuse it (HC0G0, RED-proven 2026-08-06) until M3,
-- and no policy/resolver arm consumes the helpers until M4-M7. Fail-closed at
-- every step.
--
-- Constraint rebuild discipline: DROP + ADD under the SAME names, every existing
-- arm re-emitted VERBATIM from the live catalog (pg_get_constraintdef, 2026-08-06)
-- + exactly one new arm. memberships_title_scope is deliberately untouched.
-- =============================================================================

alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships add constraint memberships_role_check
  check (role = any (array[
    'org_admin'::text,
    'nsp_org_admin'::text,
    'hospital_admin'::text,
    'nsp_coordinator'::text,
    'staff_admin'::text,
    'staff'::text,
    'pqs_member'::text,
    'technical_director'::text,
    'technical_director_deputy'::text,
    'quality_reviewer'::text
  ]));

alter table public.memberships drop constraint memberships_scope_shape;
alter table public.memberships add constraint memberships_scope_shape
  check (
    case role
      when 'org_admin'::text                 then ((organization_id is not null) and (hospital_id is null)     and (commission_id is null))
      when 'nsp_org_admin'::text             then ((organization_id is not null) and (hospital_id is null)     and (commission_id is null))
      when 'hospital_admin'::text            then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'nsp_coordinator'::text           then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'pqs_member'::text                then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'technical_director'::text        then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'technical_director_deputy'::text then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      -- QO·A (ADR 0100 D1): hospital-scoped, mirrors nsp_coordinator.
      when 'quality_reviewer'::text          then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'staff_admin'::text               then ((commission_id is not null)   and (organization_id is null) and (hospital_id is null))
      when 'staff'::text                     then ((commission_id is not null)   and (organization_id is null) and (hospital_id is null))
      else false
    end);

-- -----------------------------------------------------------------------------
-- Predicate helpers, mirroring app.is_nsp_coordinator_of/_of_for byte-for-byte
-- (is_active outer gate + has_role, which already filters expires_at). Explicit
-- ACLs (the admin-helper shape): REVOKE PUBLIC, GRANT authenticated+service_role
-- — policies evaluate these as the querying role.
-- -----------------------------------------------------------------------------

create function app.is_quality_reviewer_of_for(p_hospital_id uuid, p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active(p_user_id)
     and app.has_role('hospital', p_hospital_id, 'quality_reviewer', p_user_id);
$function$;

create function app.is_quality_reviewer_of(p_hospital_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_quality_reviewer_of_for(p_hospital_id, auth.uid());
$function$;

revoke all on function app.is_quality_reviewer_of_for(uuid, uuid) from public;
revoke all on function app.is_quality_reviewer_of(uuid) from public;
grant execute on function app.is_quality_reviewer_of_for(uuid, uuid) to authenticated, service_role;
grant execute on function app.is_quality_reviewer_of(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Self-check: the rebuild kept both constraint names and admits exactly the
-- 10-role vocabulary (a loosened re-add is the documented rebuild-loss trap).
-- -----------------------------------------------------------------------------
do $$
declare v_roles int;
begin
  if (select count(*) from pg_constraint
      where conrelid = 'public.memberships'::regclass
        and conname in ('memberships_role_check', 'memberships_scope_shape', 'memberships_title_scope')) <> 3 then
    raise exception 'M1 postcondition: a memberships CHECK constraint is missing';
  end if;
  select count(*) into v_roles
  from (select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''::text', 'g'))[1]
        from pg_constraint
        where conrelid = 'public.memberships'::regclass and conname = 'memberships_role_check') r;
  if v_roles <> 10 then
    raise exception 'M1 postcondition: memberships_role_check admits % roles, expected 10', v_roles;
  end if;
end $$;
