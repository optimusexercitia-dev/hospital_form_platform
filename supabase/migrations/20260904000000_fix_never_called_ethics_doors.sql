-- Fix three SECURITY DEFINER doors whose AUTHORIZED path could never succeed.
--
-- Found by ADR 0079 ARM 2 (the never-called-door floor): all three had 0 recorded
-- calls across the full pgTAP suite. Writing the ADR-0079-mandated POSITIVE twin for
-- each keystone (supabase/tests/290_authz_never_called_door_floor.sql) is what
-- surfaced them — the deny arm of each door works, so a deny-only test passes while
-- the door is 100% broken for the principal it is meant to serve.
--
-- They stayed invisible because nothing ever called them: none is wired to any
-- component, and `pg_stat_user_functions` does not count a call that raises, so a
-- permanently-throwing door reads as "never called" rather than "failing".
--
--   1. assign_ethics_remediation     — 22P02: create_committee_action_item returns
--                                      `action_items`, not uuid; assigning the row
--                                      into `v_id uuid` throws on every call.
--   2. open_ethics_external_referral — 22P02: same shape, with create_referral_draft
--                                      returning `case_referral`.
--   3. set_case_phase_assignment_role — 23514: wrote public.case_phases WITHOUT
--                                      setting app.in_case_rpc, so
--                                      app.guard_case_phase_status rejected it. Its
--                                      siblings (activate_phase, reassign_phase,
--                                      add_ad_hoc_phase, …) all set the flag; this
--                                      door never inherited that arm.
--
-- Bodies are otherwise byte-identical to the live catalog definitions; signatures,
-- defaults, volatility, SECURITY DEFINER and search_path are unchanged, so the
-- generated types are unaffected (Rule 8 needs no regen) and `create or replace`
-- preserves the existing grants.

create or replace function public.assign_ethics_remediation(
  p_decision_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_date date default null)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $fn$
declare v_case_id uuid; v_commission uuid; v_id uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then raise exception 'decisão não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  -- create_committee_action_item returns the action_items ROW; take its id.
  v_id := (public.create_committee_action_item(
    v_commission, 'case', null, null, v_case_id, p_title, p_description,
    p_assigned_to, null, p_due_date, null, 'case_restricted')).id;
  perform app.audit_write('ethics.remediation_assigned', 'case', v_case_id, v_commission,
    'Ação de remediação criada', jsonb_build_object('decision_id', p_decision_id, 'action_item_id', v_id));
  return v_id;
end;
$fn$;

create or replace function public.open_ethics_external_referral(
  p_decision_id uuid,
  p_target_commission_id uuid,
  p_referral_type_id uuid,
  p_subject text,
  p_description_md text)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $fn$
declare v_case_id uuid; v_commission uuid; v_referral_id uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then raise exception 'decisão não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  -- create_referral_draft returns the case_referral ROW; take its id.
  v_referral_id := (public.create_referral_draft(
    v_case_id, p_target_commission_id, p_referral_type_id, p_subject, true, p_description_md)).id;
  update public.ethics_decision_details
    set external_reporting_referral_id = v_referral_id, updated_at = now()
  where decision_id = p_decision_id;
  perform app.audit_write('ethics.external_referral_opened', 'case', v_case_id, v_commission,
    'Encaminhamento externo aberto', jsonb_build_object('decision_id', p_decision_id, 'referral_id', v_referral_id));
  return v_referral_id;
end;
$fn$;

create or replace function public.set_case_phase_assignment_role(
  p_phase_id uuid,
  p_role_id uuid default null)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $fn$
declare v_case_id uuid; v_commission uuid; v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_phases where id = p_phase_id;
  if v_case_id is null then raise exception 'fase não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  v_org := app.org_of_commission(v_commission);
  if p_role_id is not null and not exists (
       select 1 from public.case_assignment_roles r where r.id = p_role_id and r.organization_id = v_org) then
    raise exception 'papel de atribuição inválido' using errcode = 'HC0J0';
  end if;
  -- app.guard_case_phase_status blocks any direct case_phases write; every sibling
  -- phase RPC opens the same window around its update.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases set assignment_role_id = p_role_id where id = p_phase_id;
  perform set_config('app.in_case_rpc', 'off', true);
end;
$fn$;
