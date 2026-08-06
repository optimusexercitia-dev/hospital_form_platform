-- AFF F2 — "hospital inexistente" gets a DEDICATED SQLSTATE (HC0R5).
--
-- The three affiliation kernels raised it as `errcode = 'check_violation'`, a NAMED
-- CONDITION rather than a five-character code. Two things followed, and the second is
-- the one worth the migration:
--
--  1. `toState` had no arm for either spelling, so a caller naming a hospital that does
--     not exist got the generic "Não foi possível concluir. Tente novamente." — a retry
--     instruction for a condition retrying cannot fix. Identical to the HC0R4 defect.
--  2. **A shared code cannot be mapped honestly.** `check_violation` IS `23514`, which
--     every CHECK constraint on the table also raises (`hospital_affiliations_period_ck`,
--     `..._employee_id_not_blank`) and which `guard_affiliation_no_delete` raises too.
--     Mapping 23514 to "Hospital não encontrado" would be right only because no OTHER
--     23514 happens to be reachable on these paths today — reasoning that rots the
--     moment a constraint is added. A dedicated code makes the message provably correct
--     instead of circumstantially correct, and it is what every other refusal in these
--     kernels already does (HC0R0–HC0R4).
--
-- After this migration the kernels raise NO named conditions, so a 23514 arriving at the
-- action layer means a genuine integrity surprise — and `generic` is then the honest
-- answer rather than a mislabel.
--
-- ⚠ `guard_affiliation_no_delete` keeps `check_violation`, deliberately: it fires only
-- on DELETE, which no door performs, so it never reaches `toState`. It mirrors
-- `guard_profile_no_delete` and is not a door refusal.
--
-- All three bodies regenerated from LIVE `pg_get_functiondef` with one anchored
-- replacement each, asserted to match exactly once; `create or replace`, parameter lists
-- unchanged, so the owner-only ACLs that make `p_actor` unforgeable survive.

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
    raise exception 'hospital inexistente' using errcode = 'HC0R5';
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

CREATE OR REPLACE FUNCTION app.end_affiliation_impl(p_actor uuid, p_user uuid, p_hospital uuid, p_ended_on date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_org      uuid;
  v_id       uuid;
  v_started  date;
  v_end      date := coalesce(p_ended_on, current_date);
  v_blockers jsonb;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'HC0R5';
  end if;

  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select id, started_on into v_id, v_started
  from public.hospital_affiliations
  where principal_id = p_user and hospital_id = p_hospital and ended_on is null;

  if v_id is null then
    -- Not an existence oracle: the caller has already proven authority OVER THIS
    -- HOSPITAL, so "nobody by that id works here" is information they already hold.
    raise exception 'vínculo ativo não encontrado' using errcode = 'HC0R2';
  end if;

  -- ANY TIER. Hospital-tier rows carry `hospital_id` directly; commission-tier rows
  -- carry `organization_id IS NULL` and resolve through `commissions.hospital_id`
  -- (`memberships_scope_shape`). An EXPIRED seat is not an active seat.
  select jsonb_agg(jsonb_build_object('role', x.role, 'commission', x.commission_name)
                   order by x.role, x.commission_name)
    into v_blockers
  from (
    select m.role, c.name as commission_name
    from public.memberships m
    left join public.commissions c on c.id = m.commission_id
    where m.principal_id = p_user
      and coalesce(m.hospital_id, c.hospital_id) = p_hospital
      and (m.expires_at is null or m.expires_at > now())
  ) x;

  if v_blockers is not null then
    raise exception 'não é possível encerrar o vínculo: a pessoa ainda ocupa funções ativas neste hospital'
      using errcode = 'HC0R1', detail = v_blockers::text;
  end if;

  if v_end < v_started then
    raise exception 'data de encerramento anterior ao início do vínculo'
      using errcode = 'HC0R3';
  end if;

  update public.hospital_affiliations
     set ended_on = v_end, ended_by = p_actor
   where id = v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION app.update_affiliation_impl(p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date, p_clear_employee_id boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_org      uuid;
  v_id       uuid;
  v_ended    date;
  v_emp      text := nullif(btrim(coalesce(p_employee_id, '')), '');
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'HC0R5';
  end if;

  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select id, ended_on into v_id, v_ended
  from public.hospital_affiliations
  where principal_id = p_user and hospital_id = p_hospital and ended_on is null;

  if v_id is null then
    -- Not an existence oracle: the caller has already proven authority OVER THIS
    -- HOSPITAL. Same code and same reasoning as `end_affiliation`.
    raise exception 'vínculo ativo não encontrado' using errcode = 'HC0R2';
  end if;

  -- A start date cannot be moved past an end date. Active rows have `ended_on IS NULL`
  -- so this cannot fire today, but the CHECK exists and the door must not be the thing
  -- that discovers it — an explicit refusal beats a raw 23514 reaching the UI.
  if p_started_on is not null and v_ended is not null and p_started_on > v_ended then
    raise exception 'data de início posterior ao encerramento do vínculo'
      using errcode = 'HC0R3';
  end if;

  -- `coalesce` on both: an omitted argument leaves the stored value alone, so a caller
  -- correcting only the matrícula cannot blank the start date by not mentioning it.
  -- Clearing the matrícula is therefore an EXPLICIT flag rather than "pass null",
  -- because "null means leave it" and "null means clear it" cannot both be true.
  update public.hospital_affiliations
     set hospital_employee_id = case when p_clear_employee_id then null
                                     else coalesce(v_emp, hospital_employee_id) end,
         started_on           = coalesce(p_started_on, started_on)
   where id = v_id;

  return v_id;
end;
$function$;
