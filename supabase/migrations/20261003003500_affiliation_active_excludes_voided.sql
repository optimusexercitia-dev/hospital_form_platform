-- AFF4 B4 (increment 1 of 3) — "ACTIVE" LEARNS THE VOIDED TENSE, in the four function
-- bodies that decide it. ADR 0151 D6/D7.
--
-- D6 defines active ONCE: an affiliation is active when `ended_on IS NULL AND voided_at IS
-- NULL`. B1 and B2 taught that to the two partial unique indexes; these four bodies still
-- test `ended_on IS NULL` alone, and each one is a live defect the moment B4's void door
-- exists (increment 3). Enumerated by regex over `pg_proc.prosrc` with `--` comments
-- stripped first — a line-filtered `prosrc` under-reports multiline guards — and all four
-- are here. The two audit triggers also match that regex and are deliberately ABSENT: they
-- test `old.ended_on is null` to detect a TRANSITION, which is correct as written.
--
-- What each one does wrong today, and what it would do wrong tomorrow:
--
--   app.affiliate_person_impl   — the idempotency probe. A voided row would be found as
--                                 "the existing active row" and REFRESHED instead of a new
--                                 one being inserted, so voiding a mis-entry and
--                                 re-affiliating the same person would silently resurrect
--                                 the voided row. That defeats the entire purpose of the
--                                 tense, and it is the reason B2 swapped the unique index.
--   app.end_affiliation_impl    — would offer to END a row that was never true. `end` and
--                                 `void` make contradictory claims about history; a row
--                                 must not be able to hold both by accident.
--   app.update_affiliation_impl — would let a voided row's dates be corrected, which is
--                                 editing a record that asserts it never happened.
--   public.list_org_people      — the add-a-person search. A voided affiliation would show
--                                 as prior employment, so a mis-entered hospital would
--                                 reappear as a rehire suggestion. This is the one a user
--                                 SEES, and it is B6's surface: the fix lands here now
--                                 because the predicate is wrong now, and B6 re-predicates
--                                 the roster separately.
--
-- ⚠ ALL FOUR BODIES ARE RE-EMITTED VERBATIM FROM THE LIVE `pg_get_functiondef`, generated
-- rather than retyped, with exactly ONE line changed in each. This repo rewrites function
-- bodies at runtime, so a body rebuilt from migration text silently reverts intervening
-- patches. No signature changes here, so no DROP and no ACL churn — the arity changes are
-- increment 2, deliberately not mixed in.
--
-- Proof: supabase/tests/377_affiliation_active_excludes_voided.sql — one differential arm
-- per body, each observed RED before this migration.

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
  where principal_id = p_user and hospital_id = p_hospital
    and ended_on is null and voided_at is null;

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
  where principal_id = p_user and hospital_id = p_hospital
    and ended_on is null and voided_at is null;

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
  where principal_id = p_user and hospital_id = p_hospital
    and ended_on is null and voided_at is null;

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

CREATE OR REPLACE FUNCTION public.list_org_people(p_org_id uuid, p_search text DEFAULT NULL::text, p_cpf text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, full_name text, email text, professional_category text, is_active boolean, affiliations jsonb, date_of_birth date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_uid     uuid := (select auth.uid());
  v_q       text := nullif(btrim(coalesce(p_search, '')), '');
  v_cpf     text := nullif(btrim(coalesce(p_cpf, '')), '');
  v_matched uuid;
begin
  -- THE GATE (D10). Inline, deliberately — see the header.
  if not (
    app.is_org_admin_of(p_org_id)
    or (
      app.is_active(v_uid)
      and exists (
        select 1 from public.memberships m
        where m.organization_id = p_org_id
          and m.principal_id = v_uid
          and m.role = 'hospital_admin'
          and (m.expires_at is null or m.expires_at > now())
          -- ACT (ADR 0106) P0: the caller's ACTIVE hat must match this row's role.
          and m.role is not distinct from app.active_role()
      )
    )
  ) then
    return;   -- empty, never raises
  end if;

  -- CPF is EXACT-MATCH ONLY, and only at full storage length. A short or malformed
  -- value matches nothing rather than degrading to a prefix search.
  if v_cpf is not null then
    select pr.id into v_matched
    from public.profiles pr
    where pr.home_organization_id = p_org_id
      and not pr.is_admin
      and pr.cpf = v_cpf;

    -- D11 / audit LOW-2: EVERY CPF-parameterised call emits an audit row — actor, org,
    -- and whether it matched (with the matched user_id when it did). NEVER the digits:
    -- Rule 11 records THAT and WHO, never the payload. Name/email searches do not emit,
    -- matching the existing directory door.
    perform app.audit_write(
      'person.cpf_lookup', 'organization', p_org_id, null,
      case when v_matched is null
           then 'Consulta de pessoa por CPF (sem correspondência)'
           else 'Consulta de pessoa por CPF (com correspondência)' end,
      jsonb_build_object('matched', v_matched is not null, 'user_id', v_matched,
                         'source', 'directory'),
      p_org_id, null);

    if v_matched is null then
      return;
    end if;
  end if;

  return query
  select pr.id,
         pr.full_name,
         pr.email::text,
         pc.label_pt,
         pr.is_active,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'hospital_id',   a.hospital_id,
                     'hospital_name', h.name,
                     'started_on',    a.started_on)
                   order by h.name)
              from public.hospital_affiliations a
              join public.hospitals h on h.id = a.hospital_id
             where a.principal_id = pr.id
               and a.ended_on is null
               and a.voided_at is null
               and a.organization_id = p_org_id),
           '[]'::jsonb),
         pr.date_of_birth          -- AFF2 B3 / ADR 0133 D11 (edit (b))
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.home_organization_id = p_org_id
     -- platform_admin is not a tenant person and never belongs on a tenant roster
     -- (the noun rule, ADR 0078 A35).
     and not pr.is_admin
     and (v_matched is null or pr.id = v_matched)
     and (v_q is null
          or pr.full_name ilike '%' || v_q || '%'
          or pr.email ilike '%' || v_q || '%')
   order by pr.full_name nulls last, pr.email
   limit 500;
end;
$function$;
