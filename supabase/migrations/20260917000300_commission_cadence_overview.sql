-- Cadence oversight for the tenancy tier — a READ-ONLY overview on the registry the
-- tenancy admin already owns (`/o/[org]/manage/comissoes`).
--
-- PO ruling 2026-08-09 (charter ruling ③): `manage/charter` stays coordinator-only —
-- granting it would be a widening at BOTH layers (no tenancy arm on the read policy or the
-- write door; `authenticated` holds SELECT only on `commission_charters`), and it would hand
-- out WRITE to satisfy a READ need, one committee at a time. The real question is
-- accreditation-shaped and org-wide: *which of my committees are behind on meetings?*
--
-- WHY THIS IS D12-CLEAN. Cadence is derived from whether meetings HAPPENED and when — never
-- from what was discussed. It is the committee's constitutional rhythm, the most
-- container-like thing there is: "the admin shapes the containers, never reads what goes in
-- them". Nothing here exposes an agenda, a minute, a case or a participant.
--
-- ⚠ The restricted-meeting filter is INHERITED DELIBERATELY, not re-derived: only
-- `visibility_policy = 'commission_default'` meetings count, exactly as
-- `meeting_cadence_status` has always done. A closed-session meeting must not become visible
-- — not even as a date — by way of a cadence badge.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1/3 · The classification gets ONE home.
--
-- `meeting_cadence_status` carried this logic inline. A second caller would have meant a
-- second copy, and two copies of a rule drift silently — the failure this repo keeps
-- recording. So it is extracted FIRST and both callers are made to use it, rather than
-- copied into the new door and reconciled later. Pure: no auth, no table reads, no side
-- effects; it is a lookup table with a clock comparison.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function app.cadence_status_of(
  p_meeting_frequency text,
  p_last_held_at timestamptz
)
returns text
language sql
-- ⚠ STABLE, never IMMUTABLE. This reads the clock (`now()`), so its result is not a
-- function of its arguments alone. Declaring it IMMUTABLE — which the first draft of this
-- migration did — lets the planner fold a call into a constant, cache one row's answer
-- across every other row, or accept it in an index expression where a timestamp would be
-- baked in permanently. It would have been wrong intermittently and only under load.
stable
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select case
    when p_meeting_frequency is null then 'sem_regimento'
    when p_last_held_at is null      then 'sem_reunioes'
    -- boundary INCLUSIVE: a meeting exactly one period old is still em_dia. Preserved
    -- from the original (`<=`), and pinned by pgTAP — flipping it to `<` would move a
    -- committee to "overdue" a day early and no other assertion would notice.
    when (now() - p_last_held_at) <= (case p_meeting_frequency
           when 'semanal'    then interval '1 week'
           when 'quinzenal'  then interval '2 weeks'
           when 'mensal'     then interval '1 month'
           when 'bimestral'  then interval '2 months'
           when 'trimestral' then interval '3 months'
           else null end)   then 'em_dia'
    else 'em_atraso'
  end;
$function$;

comment on function app.cadence_status_of(text, timestamptz) is
  'Single home for the meeting-cadence classification. Called by meeting_cadence_status '
  '(member-scoped, one commission) and commission_cadence_overview (tenancy-scoped, many). '
  'Pure — authority belongs to the callers.';

revoke all on function app.cadence_status_of(text, timestamptz) from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2/3 · Refactor the existing door onto the helper. BEHAVIOUR MUST NOT CHANGE.
-- Identical gate (is_member_of → HC0K2), identical meeting filter, identical payload keys.
-- Only the classification moves. pgTAP pins the two paths agree.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.meeting_cadence_status(p_commission uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_freq text;
  v_last_held timestamptz;
begin
  perform app.assert_charters_enabled();

  if not app.is_member_of(p_commission) then
    raise exception 'você não é membro desta comissão' using errcode = 'HC0K2';
  end if;

  select meeting_frequency into v_freq
  from public.commission_charters
  where commission_id = p_commission;

  -- last held qualifying (commission_default) meeting — over full data, not RLS-filtered.
  select max(held_at) into v_last_held
  from public.meetings
  where commission_id = p_commission
    and held_at is not null
    and visibility_policy = 'commission_default';

  return jsonb_build_object(
    'status',           app.cadence_status_of(v_freq, v_last_held),
    'lastHeldAt',       v_last_held,
    'meetingFrequency', v_freq
  );
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3/3 · The new tenancy-scoped overview.
--
-- ⚠ IT TAKES NO ARGUMENTS, and that is the security design, not an ergonomic choice. A door
-- that accepted a caller-supplied list of commission ids would have to validate every id,
-- and the validation is the thing that gets subtly wrong (skip-vs-raise, empty list, ids
-- from another org). By DERIVING its own row set from `is_tenancy_admin_of`, the caller
-- cannot ask about a commission it does not administer — there is no parameter through
-- which to ask. Tenant isolation is structural here rather than checked.
--
-- Returns cadence ONLY. No charter row, no document link, no meeting identity — a caller
-- learns that a committee is behind, never what it was supposed to be discussing.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.commission_cadence_overview()
returns table (
  commission_id uuid,
  status text,
  last_held_at timestamptz,
  meeting_frequency text
)
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.assert_charters_enabled();

  return query
  select c.id,
         app.cadence_status_of(ch.meeting_frequency, m.last_held),
         m.last_held,
         ch.meeting_frequency
  from public.commissions c
  left join public.commission_charters ch on ch.commission_id = c.id
  left join lateral (
    select max(mt.held_at) as last_held
    from public.meetings mt
    where mt.commission_id = c.id
      and mt.held_at is not null
      -- INHERITED, not re-decided: closed sessions never feed the badge.
      and mt.visibility_policy = 'commission_default'
  ) m on true
  where app.is_tenancy_admin_of(c.id);
end;
$function$;

comment on function public.commission_cadence_overview() is
  'Read-only meeting-cadence overview for every commission the caller administers as a '
  'tenancy admin (org_admin / hospital_admin). Takes no arguments BY DESIGN — the row set is '
  'derived from is_tenancy_admin_of, so a caller cannot ask about a commission it does not '
  'administer. ADR 0100 D12: cadence is container-level (that meetings happened, and when), '
  'never content. PO ruling 2026-08-09, charter ruling 3.';

revoke all on function public.commission_cadence_overview() from public;
grant execute on function public.commission_cadence_overview() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- POSTCONDITION
-- ─────────────────────────────────────────────────────────────────────────────
do $post$
declare
  v_src text;
begin
  if to_regprocedure('app.cadence_status_of(text, timestamptz)') is null then
    raise exception 'CADENCE postcondition: the shared helper does not exist';
  end if;
  if to_regprocedure('public.commission_cadence_overview()') is null then
    raise exception 'CADENCE postcondition: the overview door does not exist';
  end if;

  -- The refactor must have REMOVED the inline classification from the old door, not merely
  -- added a call beside it. If both survive, the drift this extraction exists to prevent is
  -- still live and every parity test would pass while measuring one copy.
  select p.prosrc into v_src from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'meeting_cadence_status';
  if v_src !~ 'cadence_status_of' then
    raise exception 'CADENCE postcondition: meeting_cadence_status does not call the shared helper';
  end if;
  if v_src ~ 'sem_reunioes' or v_src ~ 'em_atraso' then
    raise exception 'CADENCE postcondition: meeting_cadence_status still classifies inline — two copies of the rule remain';
  end if;

  -- The overview must be tenancy-gated and must NOT have acquired a member arm (that would
  -- silently turn a tenancy-oversight door into a general listing).
  select p.prosrc into v_src from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'commission_cadence_overview';
  if v_src !~ 'is_tenancy_admin_of' then
    raise exception 'CADENCE postcondition: the overview door is not tenancy-gated';
  end if;
  if v_src !~ 'commission_default' then
    raise exception 'CADENCE postcondition: the overview door lost the restricted-meeting filter';
  end if;

  -- The helper reads now(); IMMUTABLE would let the planner fold or cache it. Asserted
  -- here because the first draft got this wrong and nothing else would have caught it —
  -- every test passes under either marking until the planner decides to fold.
  if (select provolatile from pg_proc
       where pronamespace = 'app'::regnamespace and proname = 'cadence_status_of') <> 's' then
    raise exception 'CADENCE postcondition: app.cadence_status_of must be STABLE — it reads now()';
  end if;

  -- ACL: authenticated must reach it (else the feature is inert), anon must not.
  if not has_function_privilege('authenticated', 'public.commission_cadence_overview()', 'execute') then
    raise exception 'CADENCE postcondition: authenticated cannot execute the overview door';
  end if;
  if has_function_privilege('anon', 'public.commission_cadence_overview()', 'execute') then
    raise exception 'CADENCE postcondition: anon can execute the overview door';
  end if;

  raise notice 'CADENCE postcondition: OK — helper extracted, old door refactored onto it, overview tenancy-gated';
end
$post$;
