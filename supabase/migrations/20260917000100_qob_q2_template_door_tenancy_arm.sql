-- Q2 CONSISTENCY — give the two process-template DEFINER doors the tenancy arm their
-- own table's RLS policy already grants.
--
-- PO approved 2026-08-09 ("setTemplateCaseType Q2 consistency"). Q2 of the ratified
-- Q1–Q9 classification puts `process_template_*` on the KEEP side: process templates are
-- CONFIGURATION — "the admin shapes the containers, never reads what goes in them".
--
-- ⚠ THIS IS NOT A WIDENING, and the distinction is the whole justification. Measured live
-- on a bare tenancy admin (`orgadmin.a`, org_admin of org A, ZERO commission memberships),
-- inside a rolled-back transaction, under `set local role authenticated`:
--
--   A · direct UPDATE on process_template_versions through RLS → 1 ROW WRITTEN,
--       read back `true`.  ← the capability is ALREADY LIVE
--   B · set_template_case_type(…)          → 42501 'sem permissão'
--   C · set_template_collects_patient(…)   → 42501 'sem permissão'
--
-- All 16 process_template policies carry the tenancy arm (SELECT *and* the FOR ALL
-- `*_staff_admin_write` pair), and `authenticated` holds table- AND column-level UPDATE
-- on both target columns. So RLS — the actual security boundary, Rule 1 — already admits
-- this principal; only the app's own doors refuse it. A SECURITY DEFINER's gate REPLACES
-- RLS, which is exactly how the two drifted apart from the plane they belong to.
-- This migration makes the doors agree with the authorization that already exists. It is
-- the same shape as the ratified audit ruling: the DB grants it, the app is made to match.
--
-- ⚠ TWO DOORS, NOT ONE. The follow-up named only `set_template_case_type`.
-- `set_template_collects_patient` is the identical shape on the identical table with the
-- identical defect, and was found by sweeping the plane by PROPERTY rather than acting on
-- the remembered name. Fixing one and leaving its twin is the recurring failure in this
-- repo (an enumeration's boundary must be the property, never a remembered list), so both
-- move together. `create_case_from_template` deliberately does NOT: it CREATES A CASE,
-- which is content, not a container — it stays staff_admin-only, on the D12 line.
--
-- CREATE OR REPLACE throughout (DROP+CREATE would silently drop the ACL). Only the
-- authority line changes in each body; every other guard — draft-only, org-ownership of
-- the case type, the case_patient feature gate — is preserved verbatim.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1/2 · set_template_case_type (ADR 0088)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_template_case_type(p_template_version_id uuid, p_case_type_id uuid default null::uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_status text;
begin
  select t.commission_id, v.status into v_commission_id, v_status
  from public.process_template_versions v
  join public.process_templates t on t.id = v.template_id
  where v.id = p_template_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;

  -- Q2 KEEP (ADR 0100 D12): the committee coordinator OR the tenancy tier. The second
  -- arm is not new authority — process_template_versions' own FOR ALL write policy
  -- already grants it, and this door was the only thing refusing it.
  if not (app.is_staff_admin_of(v_commission_id)
          or app.is_commission_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Was "archived cannot be edited". Now DRAFT-ONLY: a published version is
  -- immutable, so the previous test would have let a publish-time edit through.
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  if p_case_type_id is not null
     and not exists (
       select 1
       from public.case_types ct
       where ct.id = p_case_type_id
         and ct.organization_id = app.org_of_commission(v_commission_id)
     ) then
    raise exception 'este tipo de caso não pertence à organização desta comissão'
      using errcode = 'HC0F7';
  end if;

  update public.process_template_versions
  set case_type_id = p_case_type_id
  where id = p_template_version_id;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2/2 · set_template_collects_patient — the twin the follow-up did not name.
-- Note what this door does and does NOT do: it toggles whether a template's process
-- COLLECTS patient data. That is a container property (Rule 12 posture for the process),
-- not a PHI read — no patient row is reachable through it, and `assert_case_patient_enabled`
-- still gates the whole feature. The tenancy admin can already flip this exact column by
-- direct DML (probe A above), so refusing it here bought nothing.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_template_collects_patient(p_template_version_id uuid, p_collects boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_status text;
begin
  perform app.assert_case_patient_enabled();

  select t.commission_id, v.status into v_commission_id, v_status
  from public.process_template_versions v
  join public.process_templates t on t.id = v.template_id
  where v.id = p_template_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id)
          or app.is_commission_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  update public.process_template_versions
  set collects_patient = coalesce(p_collects, false)
  where id = p_template_version_id;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- POSTCONDITION — correspondence to enumerated NAMES on both sides.
-- Asserts what GAINED the arm, and equally that the door which must NOT gain it did not.
-- A postcondition that only checks the additions cannot see an over-reach.
-- ─────────────────────────────────────────────────────────────────────────────
do $post$
declare
  v_gain constant text[] := array['set_template_case_type', 'set_template_collects_patient'];
  v_name text;
  v_src  text;
begin
  foreach v_name in array v_gain loop
    select p.prosrc into v_src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_name;

    if v_src is null then
      raise exception 'Q2 postcondition: public.% does not exist', v_name;
    end if;
    if v_src !~ 'is_commission_admin_of' then
      raise exception 'Q2 postcondition: public.% did not gain the tenancy arm', v_name;
    end if;
    -- No over-cut: the coordinator arm must SURVIVE the edit.
    if v_src !~ 'is_staff_admin_of' then
      raise exception 'Q2 postcondition: public.% lost its coordinator arm', v_name;
    end if;
    -- The draft-only guard is what stops a published version being edited; losing it
    -- while adding an arm would be a far worse widening than the one being made.
    if v_src !~ 'rascunho' then
      raise exception 'Q2 postcondition: public.% lost its draft-only guard', v_name;
    end if;
  end loop;

  -- THE NEGATIVE HALF: case creation is content, not a container. It must NOT have
  -- gained the arm — named explicitly so an accidental sweep of the plane is caught.
  select p.prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_case_from_template';
  if v_src is null then
    raise exception 'Q2 postcondition: create_case_from_template does not exist (control lost)';
  end if;
  if v_src ~ 'is_commission_admin_of' then
    raise exception 'Q2 postcondition: create_case_from_template gained a tenancy arm — it creates CONTENT and must stay staff_admin-only';
  end if;
end
$post$;
