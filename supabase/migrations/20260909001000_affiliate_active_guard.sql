-- AFF W3 / T3.1 support — a DEACTIVATED account cannot be affiliated.
--
-- ADR 0097 D12 + ADR 0098 §W3.3. The identifier-first flow's third outcome is "found
-- in my org, unaffiliated -> offer to affiliate", and `list_org_people` returns
-- `is_active` precisely so the UI can refuse. Rule 1: the UI is not the boundary, so
-- the refusal lives in the kernel.
--
-- ⚠ The guard reads `profiles.is_active`, the MASTER SWITCH — deliberately NOT
-- `app.is_active(p_user)`, which also folds `suspended_until`. Employment is an HR
-- fact; a temporary suspension must not block recording it.
--
-- ⚠ THIS MIGRATION DOES NOT MAKE DATES EDITABLE. An earlier draft added
-- `started_on = coalesce(p_started_on, started_on)` to the update path and was
-- WITHDRAWN before commit: the audit trigger emits `affiliation.created` /
-- `affiliation.ended` only, so a date change through the create door would have been an
-- UNAUDITED mutation (Rule 11). Dates move to `update_affiliation`
-- (20260909001100), with its own `affiliation.updated` arm. The create door's
-- now-explicit "p_started_on is ignored here" is pinned by pgTAP `304`.
--
-- Body regenerated from LIVE `pg_get_functiondef` with three anchored replacements,
-- each asserted to match exactly once; `create or replace`, parameter list unchanged,
-- so the owner-only ACL that makes `p_actor` unforgeable survives.

CREATE OR REPLACE FUNCTION app.affiliate_person_impl(p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_org        uuid;
  v_person_org uuid;
  v_existing   uuid;
  v_id         uuid;
  v_person_active boolean;
  v_emp        text := nullif(btrim(coalesce(p_employee_id, '')), '');
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;

  -- AUTHORITY (D13). No `is_admin_for` arm: platform_admin administers tenancy and
  -- identity, but no decision of record extends that to employment rows.
  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- TENANT CHECK (D13) — the check `resolveOrInviteUser` was missing. A person may
  -- only be affiliated inside the organisation they are anchored to.
  --
  -- ⚠ "not found" and "wrong organisation" are DELIBERATELY the same error. Splitting
  -- them would make this door a cross-tenant existence oracle over `profiles.id` for
  -- any hospital admin of any tenant — the recorded TV lesson that a DEFINER helper is
  -- safe to CALL and unsafe to REPORT THROUGH.
  select home_organization_id, is_active into v_person_org, v_person_active
  from public.profiles where id = p_user;
  if v_person_org is null or v_person_org is distinct from v_org then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- AFF W3/T3.1 (ADR 0098 §W3.3). A DEACTIVATED account cannot be affiliated. The
  -- identifier-first flow (D12) surfaces `is_active` from `list_org_people` so the UI
  -- can say so, but Rule 1 forbids relying on that: the UI is not the boundary.
  --
  -- ⚠ `profiles.is_active` — the MASTER SWITCH — NOT `app.is_active(p_user)`, which
  -- also folds `suspended_until`. A suspension is temporary and reversible; refusing to
  -- record someone's employment because they are suspended this week would be wrong,
  -- and would quietly turn an HR record into a disciplinary one.
  if not coalesce(v_person_active, false) then
    raise exception 'conta desativada' using errcode = 'HC0R4';
  end if;

  -- Idempotent by (person, hospital) over the ACTIVE row: the partial unique index
  -- would reject a duplicate anyway, and a 23505 reaching the caller as a generic
  -- pt-BR error is a worse answer than the intended one.
  select id into v_existing
  from public.hospital_affiliations
  where principal_id = p_user and hospital_id = p_hospital and ended_on is null;

  if v_existing is not null then
    -- ⚠ `p_started_on` IS DELIBERATELY IGNORED ON THIS PATH. It applies to the INSERT
    -- below and nowhere else: this is the idempotent CREATE door, and a create door
    -- that quietly acquires a date-mutation capability is how doors grow undeclared
    -- powers. Changing an existing employment's dates is `update_affiliation`
    -- (20260909001100), which emits `affiliation.updated` — routing a date change
    -- through here would mutate a row with no audit arm to record it (Rule 11).
    -- Pinned by pgTAP `304`, so this comment cannot rot into a lie.
    update public.hospital_affiliations
       set hospital_employee_id = coalesce(v_emp, hospital_employee_id)
     where id = v_existing;
    return v_existing;
  end if;

  insert into public.hospital_affiliations
    (principal_id, organization_id, hospital_id, hospital_employee_id, started_on, created_by)
  values
    (p_user, v_org, p_hospital, v_emp, coalesce(p_started_on, current_date), p_actor)
  returning id into v_id;

  return v_id;
end;
$function$;
