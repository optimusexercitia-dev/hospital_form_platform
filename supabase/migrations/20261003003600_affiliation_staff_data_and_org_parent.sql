-- AFF4 B4 (increment 2 of 3) — the two affiliation impls gain D9 staff data, and
-- `affiliate_person` gains the D5 org-parent ensure. ADR 0151 D4/D5/D9.
--
-- ⚠ THIS IS A DROP+CREATE, NOT A REPLACE, and it has to be. `CREATE OR REPLACE` cannot
-- change an argument list — it would create an OVERLOAD, and two arities of the same
-- PostgREST-visible name resolve ambiguously (HTTP 300). Both arities must never coexist,
-- so every function is dropped by its OLD signature first.
--
-- ⚠ A DROP DISCARDS THE ACLs. Every grant is re-applied below, and the shape is the
-- security property, not decoration:
--     app.*_impl        postgres only            — the kernel takes an explicit actor, so
--                                                  anyone who can call it can forge one.
--     public.*          authenticated + service  — the auth.uid() wrapper.
--     public.*_for      service_role ONLY        — `authenticated` must never hold EXECUTE
--                                                  on a twin that names its own actor.
-- ⛔ `app` has no default ACL, so a new function there gets the built-in default, which
-- INCLUDES PUBLIC EXECUTE. The explicit revoke on the impls is load-bearing; omitting it
-- would publish the unforgeable-actor kernels to every role.
--
-- ⚠ `p_work_email` is `text`, NOT `extensions.citext`, and that is deliberate. The COLUMN
-- stays citext, so comparison semantics are unchanged; but a citext PARAMETER must resolve
-- against the SESSION search_path at CREATE time, which is exactly the 42704 "type citext
-- does not exist" that hit 20260911000600 on the remote db-push role after six migrations
-- had already landed. A text argument assigned to a citext column casts implicitly and
-- loses nothing.
--
-- D5 — the org-parent ensure. `affiliate_person_impl` now creates the active organization
-- affiliation if it is absent, audited as its own `org_affiliation.created` row naming the
-- actor. Without it a hospital admin's rehire would stall waiting for an org_admin ticket
-- for someone the hospital is actively trying to re-employ, because the org-tier door is
-- org_admin-only. D4 containment is therefore satisfied BY CONSTRUCTION in this door; the
-- structural backstop trigger lands after B5's backfill, deliberately, because before that
-- backfill it would reject legitimate writes against rows that have no parent yet.
--
-- ⚠ All six bodies are transformed BY SCRIPT from the live `pg_get_functiondef`, never
-- retyped — the same method as increment 1, and the reason no pt-BR message in any of them
-- can be corrupted or drift.
--
-- Proof: supabase/tests/378_affiliation_staff_data_and_org_parent.sql.

drop function if exists public.affiliate_person(uuid,uuid,text,date);
drop function if exists public.affiliate_person_for(uuid,uuid,uuid,text,date);
drop function if exists app.affiliate_person_impl(uuid,uuid,uuid,text,date);
drop function if exists public.update_affiliation(uuid,uuid,text,date,boolean);
drop function if exists public.update_affiliation_for(uuid,uuid,uuid,text,date,boolean);
drop function if exists app.update_affiliation_impl(uuid,uuid,uuid,text,date,boolean);

CREATE OR REPLACE FUNCTION app.affiliate_person_impl(p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date, p_job_title text DEFAULT NULL::text, p_work_email text DEFAULT NULL::text, p_work_phone text DEFAULT NULL::text)
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
  -- D9 staff data, normalised exactly as `v_emp` is: blank means "the box was empty",
  -- which is not a fact, and the not-blank CHECKs would reject it anyway.
  --
  -- text, NOT extensions.citext, and deliberately: the COLUMN stays citext so
  -- comparison semantics are unchanged, but a citext PARAMETER would have to resolve at
  -- CREATE time against the session search_path — the exact 42704 that bit
  -- 20260911000600 on the remote db-push role. A text parameter assigned to a citext
  -- column casts implicitly and loses nothing.
  v_job        text := nullif(btrim(coalesce(p_job_title, '')), '');
  v_wemail     text := nullif(btrim(coalesce(p_work_email, '')), '');
  v_wphone     text := nullif(btrim(coalesce(p_work_phone, '')), '');
  v_org_aff    uuid;
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

  -- D5 — THE ORG-PARENT ENSURE, and it is what makes rehire ONE STEP. A hospital admin
  -- may not create org affiliations (that door is org_admin-only), so without this a
  -- rehire would stall waiting for an org_admin ticket for someone the hospital is
  -- actively trying to re-employ. The ensure is audited as its own
  -- `org_affiliation.created` row naming this actor, by the trigger on that table.
  --
  -- D4 (an active hospital affiliation implies an active org affiliation in the same
  -- org) is satisfied BY CONSTRUCTION here: after this block the parent exists, so a
  -- separate check would be unreachable code asserting what the lines above just
  -- guaranteed. The STRUCTURAL guarantee is the deferred constraint trigger, which lands
  -- AFTER B5's backfill — before that backfill it would reject legitimate writes against
  -- pre-existing rows that have no parent yet.
  select id into v_org_aff
  from public.organization_affiliations
  where principal_id = p_user and organization_id = v_org
    and ended_on is null and voided_at is null;

  if v_org_aff is null then
    insert into public.organization_affiliations (principal_id, organization_id, created_by)
    values (p_user, v_org, p_actor);
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
       set hospital_employee_id = coalesce(v_emp, hospital_employee_id),
           job_title            = coalesce(v_job, job_title),
           work_email           = coalesce(v_wemail, work_email),
           work_phone           = coalesce(v_wphone, work_phone)
     where id = v_existing;
    return v_existing;
  end if;

  insert into public.hospital_affiliations
    (principal_id, organization_id, hospital_id, hospital_employee_id, started_on, created_by,
     job_title, work_email, work_phone)
  values
    (p_user, v_org, p_hospital, v_emp, coalesce(p_started_on, current_date), p_actor,
     v_job, v_wemail, v_wphone)
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION app.update_affiliation_impl(p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date, p_clear_employee_id boolean DEFAULT false, p_job_title text DEFAULT NULL::text, p_work_email text DEFAULT NULL::text, p_work_phone text DEFAULT NULL::text, p_clear_job_title boolean DEFAULT false, p_clear_work_email boolean DEFAULT false, p_clear_work_phone boolean DEFAULT false)
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
  -- text rather than extensions.citext for the same reason as the sibling door.
  v_job      text := nullif(btrim(coalesce(p_job_title, '')), '');
  v_wemail   text := nullif(btrim(coalesce(p_work_email, '')), '');
  v_wphone   text := nullif(btrim(coalesce(p_work_phone, '')), '');
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
         started_on           = coalesce(p_started_on, started_on),
         -- One clear-flag PER FIELD (the `p_clear_employee_id` precedent). A single
         -- shared flag would make "clear the cargo" and "clear the work phone"
         -- inseparable, and "null means leave it" and "null means clear it" still
         -- cannot both be true of one argument.
         job_title            = case when p_clear_job_title then null
                                     else coalesce(v_job, job_title) end,
         work_email           = case when p_clear_work_email then null
                                     else coalesce(v_wemail, work_email) end,
         work_phone           = case when p_clear_work_phone then null
                                     else coalesce(v_wphone, work_phone) end
   where id = v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.affiliate_person(p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date, p_job_title text DEFAULT NULL::text, p_work_email text DEFAULT NULL::text, p_work_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
  select app.affiliate_person_impl((select auth.uid()), p_user, p_hospital, p_employee_id, p_started_on,
                                    p_job_title, p_work_email, p_work_phone);
$function$;

CREATE OR REPLACE FUNCTION public.affiliate_person_for(p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date, p_job_title text DEFAULT NULL::text, p_work_email text DEFAULT NULL::text, p_work_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
  select app.affiliate_person_impl(p_actor, p_user, p_hospital, p_employee_id, p_started_on,
                                    p_job_title, p_work_email, p_work_phone);
$function$;

CREATE OR REPLACE FUNCTION public.update_affiliation(p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date, p_clear_employee_id boolean DEFAULT false, p_job_title text DEFAULT NULL::text, p_work_email text DEFAULT NULL::text, p_work_phone text DEFAULT NULL::text, p_clear_job_title boolean DEFAULT false, p_clear_work_email boolean DEFAULT false, p_clear_work_phone boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
  select app.update_affiliation_impl((select auth.uid()), p_user, p_hospital,
                                     p_employee_id, p_started_on, p_clear_employee_id,
                                     p_job_title, p_work_email, p_work_phone,
                                     p_clear_job_title, p_clear_work_email, p_clear_work_phone);
$function$;

CREATE OR REPLACE FUNCTION public.update_affiliation_for(p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date, p_clear_employee_id boolean DEFAULT false, p_job_title text DEFAULT NULL::text, p_work_email text DEFAULT NULL::text, p_work_phone text DEFAULT NULL::text, p_clear_job_title boolean DEFAULT false, p_clear_work_email boolean DEFAULT false, p_clear_work_phone boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
  select app.update_affiliation_impl(p_actor, p_user, p_hospital,
                                     p_employee_id, p_started_on, p_clear_employee_id,
                                     p_job_title, p_work_email, p_work_phone,
                                     p_clear_job_title, p_clear_work_email, p_clear_work_phone);
$function$;

-- ---------------------------------------------------------------------------------------------
-- ACLs, re-applied after the DROP (see the header — the shape IS the security property).
-- ---------------------------------------------------------------------------------------------

revoke all on function app.affiliate_person_impl(uuid,uuid,uuid,text,date,text,text,text) from public;
revoke all on function app.update_affiliation_impl(uuid,uuid,uuid,text,date,boolean,text,text,text,boolean,boolean,boolean) from public;

revoke all on function public.affiliate_person(uuid,uuid,text,date,text,text,text) from public;
grant execute on function public.affiliate_person(uuid,uuid,text,date,text,text,text) to authenticated, service_role;

revoke all on function public.affiliate_person_for(uuid,uuid,uuid,text,date,text,text,text) from public;
grant execute on function public.affiliate_person_for(uuid,uuid,uuid,text,date,text,text,text) to service_role;

revoke all on function public.update_affiliation(uuid,uuid,text,date,boolean,text,text,text,boolean,boolean,boolean) from public;
grant execute on function public.update_affiliation(uuid,uuid,text,date,boolean,text,text,text,boolean,boolean,boolean) to authenticated, service_role;

revoke all on function public.update_affiliation_for(uuid,uuid,uuid,text,date,boolean,text,text,text,boolean,boolean,boolean) from public;
grant execute on function public.update_affiliation_for(uuid,uuid,uuid,text,date,boolean,text,text,text,boolean,boolean,boolean) to service_role;
