-- AE5 increment 1, T7 — the PER-SITE RE-KEY of `staff`, end to end.
--
-- ⭐ 21 DOORS, NOT 20: the 20 R-4 doors plus `app.can_cases_deliberation_read_in_commission`
--   (lead ruling L20), which sits OUTSIDE the ruled set — it takes NO grant, so R-4's mapping
--   and its 13 `to authenticated` grants are unchanged. 13 granted to `authenticated`,
--   8 DEFINER-only.
-- door-sweep-targets: app.can_accreditation_read(uuid, uuid)
--                     app.can_cases_deliberation_read_in_commission(uuid, uuid)
--                     app.can_action_items_read(uuid, uuid)
--                     app.can_capa_read(uuid, uuid)
--                     app.can_cases_deliberation_read(uuid, uuid)
--                     app.can_cases_vocabulary_read(uuid, uuid)
--                     app.can_cases_vote(uuid, uuid)
--                     app.can_charter_read(uuid, uuid)
--                     app.can_documents_read(uuid, uuid)
--                     app.can_forms_read(uuid, uuid)
--                     app.can_indicators_read(uuid, uuid)
--                     app.can_meetings_cases_shell_read(uuid, uuid)
--                     app.can_meetings_minutes_sign(uuid, uuid)
--                     app.can_meetings_read(uuid, uuid)
--                     app.can_process_templates_read(uuid, uuid)
--                     app.can_referrals_metadata_read(uuid, uuid)
--                     app.can_referrals_notes_author(uuid, uuid)
--                     app.can_responses_create(uuid, uuid)
--                     app.can_roster_read(uuid, uuid)
--                     app.can_safety_events_read(uuid, uuid)
--                     app.can_safety_events_report(uuid, uuid)
--                     app.can_reach_case_on_member_surface(uuid, uuid)
--
-- ONE MIGRATION, per lead condition C3. Parts, in order:
--   1  the 20 layer-3 doors (13 authenticated-executable per PO ruling R-4(a), 7 not)
--   2  40 policy re-keys, GENERATED from the live pg_policies snapshot
--   3  23 gate-carrying functions re-emitted WHOLE under search_path = ''
--   4  the 1 hand policy (meeting_cases_select, lead ruling L16)
--   5  C1 — row 9's authority wired, its comment corrected
--   7  C1 — the 4 inline copies deleted (4 sites / 5 call sites, lead ruling L18)
-- ==========================================================================
-- PART 1 — the 20 layer-3 domain authorizers, one per staff permission code.
--
-- Each carries its code as a STRING LITERAL (ADR 0176 D7, statically greppable) and
-- composes authz.has_permission ALONE. ⛔ It does NOT compose
-- app.is_commission_staff_of(_for): the enforcement manifest refuses a re-keyed row whose
-- authorizer composes a non-permission grant path that is not a declared
-- residualLegacyAuthority, and the wrapper is not one — it is layer 1. (ADR 0211 D1 as
-- amended 2026-09-14; the wrapper stays caller-less until AE5-MEMBER-PREDICATE-REEXPRESSION.)
-- ⛔ search_path = '' on every one (ADR 0208 D4), body fully schema-qualified.
-- ==========================================================================

create or replace function app.can_accreditation_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.accreditation.read');
$fn$;
alter function app.can_accreditation_read(uuid, uuid) owner to postgres;
revoke all on function app.can_accreditation_read(uuid, uuid) from public;
grant execute on function app.can_accreditation_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_accreditation_read(uuid, uuid) to authenticated;

create or replace function app.can_action_items_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.action_items.read');
$fn$;
alter function app.can_action_items_read(uuid, uuid) owner to postgres;
revoke all on function app.can_action_items_read(uuid, uuid) from public;
grant execute on function app.can_action_items_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_action_items_read(uuid, uuid) to authenticated;

create or replace function app.can_capa_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.capa.read');
$fn$;
alter function app.can_capa_read(uuid, uuid) owner to postgres;
revoke all on function app.can_capa_read(uuid, uuid) from public;
grant execute on function app.can_capa_read(uuid, uuid) to service_role;
-- ⛔ NO `authenticated` grant: this door is called only from DEFINER bodies, where
--    the privilege check is against the owner. One of the 7 R-4 excludes.

-- ⭐⭐ ROW 9 IS THE ONE DOOR OF TWENTY WITH A DECLARED RESIDUAL ARM (lead ruling L17).
-- ⛔ `authz.has_permission` ALONE WOULD NARROW THIS DOOR. Measured: `app.has_case_capability`
-- never consults `authz.has_permission` — it is a CASE-GRANT path, not a permission path — so
-- composing the permission arm alone would drop the case reach, which is arm 3's entire subject and
-- the thing 424/426 exist to measure. Dropping it would be a BEHAVIOUR change; keeping it is the
-- matrix's own shape (row 9's arm 3 IS the case reach, ruled under P1–P3).
-- ⚠ A non-permission grant path in a re-keyed row's authorizer is refused by the manifest
-- validator UNLESS declared. ⚠ AT AE5 T7 THIS ROW DECLARED `app.has_case_capability` as its
-- `residualLegacyAuthority`; lead ruling L24 WITHDREW that declaration, because with the
-- permission disjunct gone the capability path is no longer a residual arm BESIDE the
-- permission — it is the only arm, and the permission is enforced inside it at S5. Nothing
-- residual remains on this row.
-- ⚠ CASE-KEYED, not commission-keyed: the scope is resolved from the case inside the door.
--
-- ⭐⭐ ONE ARM, NOT TWO (lead ruling L24, superseding L17). ⛔⛔ THE DEFECT L24 REPAIRS, AND IT
-- IS A WIDENING. This door was first written as
--     authz.has_permission(…, 'commission.cases.deliberation.read')
--       or app.has_case_capability(p_case_id, p_user_id, 'read_case_deliberation')
-- and `or` is the whole bug. The SECOND arm routes through `app._case_caps`, which applies
-- STEP-4's `is_case_respondent` / `is_recused_from_case` hard denies and guards its S5
-- member-default arm with `not v_eg`. The FIRST arm applies NONE of them, and one true disjunct
-- grants. So a plain member reached an `explicit_grants_only` case, and an EXCLUDED RESPONDENT
-- reached his own case — measured, not reasoned: 233 M6·7 read `have: true / want: false` on
-- both, and 241 K5 / 242 K14 / 243 A26 / 228 QA MAJOR-3 returned deliberation substance where
-- they pin NULL. Class-1 case content (Architecture Rule 12).
--
-- ⛔ AND IT WAS INVISIBLE TO THE ARM THAT SHOULD HAVE SEEN IT. 410 § 6.2 derives a row's
-- hard-deny classes from the transitive closure at its declared sites; that closure DOES reach
-- `app.is_case_respondent` — inside `_case_caps`, down the second disjunct — so the row's
-- committed `respondent_exclusion` measured as satisfied while the granting arm walked around
-- it. A deny class present in the closure is not a deny class applied on every disjunct. Filed
-- as FUP-AE5-STAFF-HARD-DENY-CLOSURE-IS-BLIND-TO-OR-AROUND, which keeps the two-arm text above
-- as its fixture.
--
-- ⭐ THE PERMISSION IS STILL ENFORCED, one level down and subject to the denies: `_case_caps`'s
-- S5 arm asks `app.can_cases_deliberation_read_in_commission` (the 21st door, above), which is
-- `authz.has_permission` and nothing else. So the row is re-keyed, the code is carried in the
-- catalog by that sibling, and the grant path is
--     this door -> app.has_case_capability -> app._case_caps -> S5 -> the sibling -> authz
-- which the manifest declares hop by hop and 410 § 8.1 walks under lead ruling L23.
create or replace function app.can_cases_deliberation_read(p_case_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select app.has_case_capability(p_case_id, p_user_id, 'read_case_deliberation');
$fn$;
alter function app.can_cases_deliberation_read(uuid, uuid) owner to postgres;
revoke all on function app.can_cases_deliberation_read(uuid, uuid) from public;
grant execute on function app.can_cases_deliberation_read(uuid, uuid) to service_role;
-- ⛔ NO `authenticated` grant: this door is called only from DEFINER bodies, where
--    the privilege check is against the owner. One of the 7 R-4 excludes.

-- ⭐⭐ THE 21st DOOR (lead ruling L20), OUTSIDE THE R-4 SET OF 20 AND DELIBERATELY SO.
-- The COMMISSION-keyed, permission-only sibling of the door above. It exists for exactly one
-- caller: `app._case_caps`'s S5 `committee_member_default` arm, 500 lines below.
--
-- ⛔⛔ WHY A SIBLING AND NOT THE DOOR ITSELF — THE DEFECT THIS AVERTS, MEASURED. The first
-- draft of this migration rewrote S5 mechanically ACROSS A SIGNATURE CHANGE:
--     pre-T7   v_member := app.is_member_of_for(v_commission, p_uid);   -- COMMISSION-keyed
--     draft    v_member := app.can_cases_deliberation_read(v_commission, p_uid);
-- Both arguments are `uuid`, so that call compiles and runs; it then resolves
-- `cases.id = v_commission`, finds no row, and the permission arm evaluates on a NULL scope.
-- S5 became PERMANENTLY FALSE — every ordinary member lost `read_case_deliberation` on every
-- case. It fails CLOSED (a narrowing, never a leak), and verification caught it BEFORE this
-- file was committed: pgTAP 425 § 2.0 read `have: 46 / want: 47`, the one denied site being
-- `app._case_caps`, and a bare catalog probe for `staff4.ccih` (a plain `staff` member of CCIH
-- holding NO case_access_grants row) on case `d0000000-...-00c1` read `_case_caps = 0` and
-- `has_case_capability(read_case_deliberation) = false`, while
-- `can_cases_deliberation_read(case, uid) = true` — the door was never the broken part.
--
-- ⛔ AND WHY NOT SIMPLY PASS THE CASE ID: the case-keyed door composes
-- `app.has_case_capability` -> `app._case_caps`. Calling it from inside `_case_caps` is
-- INFINITE RECURSION. S5 needs the PERMISSION half alone, keyed on the commission the case has
-- already resolved — which is what this door is, and why it composes NO residual arm.
--
-- ⚠ BLAST RADIUS, SWEPT NOT ASSUMED (live catalog, every call of both non-commission-keyed
-- doors with its first argument): `app.can_reach_case_on_member_surface` passes `p_case_id`,
-- `meeting_cases_select` passes `meeting_id`, and all 18 commission-keyed doors receive a
-- commission id at every one of their policy and function call sites. EXACTLY ONE wrong-keyed
-- call site ever existed, and it is the S5 line this file now writes correctly.
create or replace function app.can_cases_deliberation_read_in_commission(
  p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(
           p_user_id, 'commission', p_commission_id, 'commission.cases.deliberation.read');
$fn$;
alter function app.can_cases_deliberation_read_in_commission(uuid, uuid) owner to postgres;
-- ⛔ NO GRANT AT ALL, to anyone. `create function` grants EXECUTE to PUBLIC by default, so
--    this revoke is not decorative: without it the door would be callable by `anon`. Its only
--    caller is a SECURITY DEFINER body, where the privilege check is against the owner. This
--    is why the 21st door does NOT move R-4's ceiling — app=339 / public=433 / total=772 is
--    unchanged, asserted by 320 § U4.
revoke all on function app.can_cases_deliberation_read_in_commission(uuid, uuid) from public;
revoke all on function app.can_cases_deliberation_read_in_commission(uuid, uuid) from anon;
revoke all on function app.can_cases_deliberation_read_in_commission(uuid, uuid) from authenticated;

create or replace function app.can_cases_vocabulary_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.cases.vocabulary.read');
$fn$;
alter function app.can_cases_vocabulary_read(uuid, uuid) owner to postgres;
revoke all on function app.can_cases_vocabulary_read(uuid, uuid) from public;
grant execute on function app.can_cases_vocabulary_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_cases_vocabulary_read(uuid, uuid) to authenticated;

create or replace function app.can_cases_vote(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.cases.vote');
$fn$;
alter function app.can_cases_vote(uuid, uuid) owner to postgres;
revoke all on function app.can_cases_vote(uuid, uuid) from public;
grant execute on function app.can_cases_vote(uuid, uuid) to service_role;
-- ⛔ NO `authenticated` grant: this door is called only from DEFINER bodies, where
--    the privilege check is against the owner. One of the 7 R-4 excludes.

create or replace function app.can_charter_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.charter.read');
$fn$;
alter function app.can_charter_read(uuid, uuid) owner to postgres;
revoke all on function app.can_charter_read(uuid, uuid) from public;
grant execute on function app.can_charter_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_charter_read(uuid, uuid) to authenticated;

create or replace function app.can_documents_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.documents.read');
$fn$;
alter function app.can_documents_read(uuid, uuid) owner to postgres;
revoke all on function app.can_documents_read(uuid, uuid) from public;
grant execute on function app.can_documents_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_documents_read(uuid, uuid) to authenticated;

create or replace function app.can_forms_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.forms.read');
$fn$;
alter function app.can_forms_read(uuid, uuid) owner to postgres;
revoke all on function app.can_forms_read(uuid, uuid) from public;
grant execute on function app.can_forms_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_forms_read(uuid, uuid) to authenticated;

create or replace function app.can_indicators_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.indicators.read');
$fn$;
alter function app.can_indicators_read(uuid, uuid) owner to postgres;
revoke all on function app.can_indicators_read(uuid, uuid) from public;
grant execute on function app.can_indicators_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_indicators_read(uuid, uuid) to authenticated;

-- ⭐⭐ THE ONE DOOR OF THE TWENTY KEYED ON A MEETING, NOT A COMMISSION (lead ruling L16).
-- `public.meeting_cases` has no `commission_id` column (id, meeting_id, case_id, agenda_item_id,
-- summary, decision, created_at), so a commission-keyed door has nothing to bind at its only site.
-- The scope is resolved from the meeting INSIDE the door, so the policy stays a one-argument
-- substitution and the resolution lives in one place instead of in every caller.
-- ⚠ THE SIGNATURE DIFFERENCE IS DECLARED IN THE MANIFEST, not left to be noticed: nineteen doors
-- take (commission, uid) and this one takes (meeting, uid).
-- ⛔ It still composes `authz.has_permission` ALONE, like the other nineteen.
create or replace function app.can_meetings_cases_shell_read(p_meeting_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(
           p_user_id, 'commission',
           (select m.commission_id from public.meetings m where m.id = p_meeting_id),
           'commission.meetings.cases.shell.read');
$fn$;
alter function app.can_meetings_cases_shell_read(uuid, uuid) owner to postgres;
revoke all on function app.can_meetings_cases_shell_read(uuid, uuid) from public;
grant execute on function app.can_meetings_cases_shell_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_meetings_cases_shell_read(uuid, uuid) to authenticated;

create or replace function app.can_meetings_minutes_sign(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.meetings.minutes.sign');
$fn$;
alter function app.can_meetings_minutes_sign(uuid, uuid) owner to postgres;
revoke all on function app.can_meetings_minutes_sign(uuid, uuid) from public;
grant execute on function app.can_meetings_minutes_sign(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_meetings_minutes_sign(uuid, uuid) to authenticated;

create or replace function app.can_meetings_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.meetings.read');
$fn$;
alter function app.can_meetings_read(uuid, uuid) owner to postgres;
revoke all on function app.can_meetings_read(uuid, uuid) from public;
grant execute on function app.can_meetings_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_meetings_read(uuid, uuid) to authenticated;

create or replace function app.can_process_templates_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.process_templates.read');
$fn$;
alter function app.can_process_templates_read(uuid, uuid) owner to postgres;
revoke all on function app.can_process_templates_read(uuid, uuid) from public;
grant execute on function app.can_process_templates_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_process_templates_read(uuid, uuid) to authenticated;

create or replace function app.can_referrals_metadata_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.referrals.metadata.read');
$fn$;
alter function app.can_referrals_metadata_read(uuid, uuid) owner to postgres;
revoke all on function app.can_referrals_metadata_read(uuid, uuid) from public;
grant execute on function app.can_referrals_metadata_read(uuid, uuid) to service_role;
-- ⛔ NO `authenticated` grant: this door is called only from DEFINER bodies, where
--    the privilege check is against the owner. One of the 7 R-4 excludes.

create or replace function app.can_referrals_notes_author(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.referrals.notes.author');
$fn$;
alter function app.can_referrals_notes_author(uuid, uuid) owner to postgres;
revoke all on function app.can_referrals_notes_author(uuid, uuid) from public;
grant execute on function app.can_referrals_notes_author(uuid, uuid) to service_role;
-- ⛔ NO `authenticated` grant: this door is called only from DEFINER bodies, where
--    the privilege check is against the owner. One of the 7 R-4 excludes.

create or replace function app.can_responses_create(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.responses.create');
$fn$;
alter function app.can_responses_create(uuid, uuid) owner to postgres;
revoke all on function app.can_responses_create(uuid, uuid) from public;
grant execute on function app.can_responses_create(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_responses_create(uuid, uuid) to authenticated;

create or replace function app.can_roster_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.roster.read');
$fn$;
alter function app.can_roster_read(uuid, uuid) owner to postgres;
revoke all on function app.can_roster_read(uuid, uuid) from public;
grant execute on function app.can_roster_read(uuid, uuid) to service_role;
-- ⭐ R-4(a): policy-called, so `authenticated` EXECUTE is REQUIRED and RULED.
grant execute on function app.can_roster_read(uuid, uuid) to authenticated;

create or replace function app.can_safety_events_read(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.safety_events.read');
$fn$;
alter function app.can_safety_events_read(uuid, uuid) owner to postgres;
revoke all on function app.can_safety_events_read(uuid, uuid) from public;
grant execute on function app.can_safety_events_read(uuid, uuid) to service_role;
-- ⛔ NO `authenticated` grant: this door is called only from DEFINER bodies, where
--    the privilege check is against the owner. One of the 7 R-4 excludes.

create or replace function app.can_safety_events_report(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.has_permission(p_user_id, 'commission', p_commission_id, 'commission.safety_events.report');
$fn$;
alter function app.can_safety_events_report(uuid, uuid) owner to postgres;
revoke all on function app.can_safety_events_report(uuid, uuid) from public;
grant execute on function app.can_safety_events_report(uuid, uuid) to service_role;
-- ⛔ NO `authenticated` grant: this door is called only from DEFINER bodies, where
--    the privilege check is against the owner. One of the 7 R-4 excludes.
-- ==========================================================================
-- PART 2 — the 40 UNIFORM policy re-keys, GENERATED FROM THE LIVE CATALOG.
--
-- ⛔ Generated from a `pg_policies` snapshot taken on a settle-checked stack, never from
-- migration text (ADR 0078: migration text is stale by design). The snapshot is kept as
-- t7-wip/INPUT_live_quals.txt beside this file, so the transformation is reproducible.
--
-- The transformation is exactly one substitution per policy:
--     app.is_member_of(X)   ->   app.can_<code>(X, (select auth.uid()))
-- Every other conjunct of every qual is carried through UNCHANGED — that is why this is
-- generated rather than retyped: 39 hand-rewritten quals is 39 chances to drop a term.
-- ⚠ The door takes the uid EXPLICITLY where the bare predicate read `auth.uid()` itself;
-- `(select auth.uid())` preserves the initplan-wrapped form 387 §A pins.
-- ==========================================================================

-- commission.accreditation.read  ->  app.can_accreditation_read
alter policy accreditation_frameworks_select on public.accreditation_frameworks
  using (((owner_commission_id IS NULL) OR app.can_accreditation_read(owner_commission_id, (select auth.uid()))));

-- commission.accreditation.read  ->  app.can_accreditation_read
alter policy accreditation_standards_select on public.accreditation_standards
  using ((EXISTS ( SELECT 1
   FROM accreditation_frameworks f
  WHERE ((f.id = accreditation_standards.framework_id) AND ((f.owner_commission_id IS NULL) OR app.can_accreditation_read(f.owner_commission_id, (select auth.uid())))))));

-- commission.accreditation.read  ->  app.can_accreditation_read
alter policy evidence_links_select on public.evidence_links
  using (app.can_accreditation_read(commission_id, (select auth.uid())));

-- commission.accreditation.read  ->  app.can_accreditation_read
alter policy standard_assessments_select on public.standard_assessments
  using (app.can_accreditation_read(commission_id, (select auth.uid())));

-- commission.action_items.read  ->  app.can_action_items_read
alter policy action_items_select on public.action_items
  using ((((visibility_scope = 'committee'::text) AND app.can_action_items_read(commission_id, (select auth.uid()))) OR ((visibility_scope = 'case_restricted'::text) AND app.can_read_case_committee(COALESCE(source_case_id, linked_case_id), auth.uid())) OR ((visibility_scope = 'assignees_only'::text) AND (app.is_staff_admin_of(commission_id) OR ((assigned_to IS NOT NULL) AND (assigned_to = auth.uid())) OR (EXISTS ( SELECT 1
   FROM action_item_assignments a
  WHERE ((a.action_item_id = action_items.id) AND (a.user_id = auth.uid()) AND (a.completed_at IS NULL))))))));

-- commission.cases.vocabulary.read  ->  app.can_cases_vocabulary_read
alter policy case_narrative_types_select on public.case_narrative_types
  using ((app.can_cases_vocabulary_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.cases.vocabulary.read  ->  app.can_cases_vocabulary_read
alter policy case_outcomes_select on public.case_outcomes
  using ((app.can_cases_vocabulary_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.cases.vocabulary.read  ->  app.can_cases_vocabulary_read
alter policy case_tags_select on public.case_tags
  using ((app.can_cases_vocabulary_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.charter.read  ->  app.can_charter_read
alter policy commission_charters_select on public.commission_charters
  using (app.can_charter_read(commission_id, (select auth.uid())));

-- commission.documents.read  ->  app.can_documents_read
alter policy controlled_document_versions_select on public.controlled_document_versions
  using ((app.can_documents_read(app.commission_of_document(document_id), (select auth.uid())) OR app.is_document_version_approver(id, auth.uid())));

-- commission.documents.read  ->  app.can_documents_read
alter policy controlled_documents_select on public.controlled_documents
  using ((app.can_documents_read(commission_id, (select auth.uid())) OR app.is_document_approver_of(id, auth.uid())));

-- commission.documents.read  ->  app.can_documents_read
alter policy securable_resources_select on public.securable_resources
  using ((app.can_documents_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.forms.read  ->  app.can_forms_read
alter policy form_item_options_select on public.form_item_options
  using ((app.can_forms_read(app.commission_of_version(form_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id))));

-- commission.forms.read  ->  app.can_forms_read
alter policy form_item_validations_select on public.form_item_validations
  using ((app.can_forms_read(app.commission_of_version(form_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id))));

-- commission.forms.read  ->  app.can_forms_read
alter policy form_items_select on public.form_items
  using ((app.can_forms_read(app.commission_of_version(form_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id))));

-- commission.forms.read  ->  app.can_forms_read
alter policy form_matrix_columns_select on public.form_matrix_columns
  using ((app.can_forms_read(app.commission_of_version(form_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id)) OR app.can_access_targeted_version(form_version_id, ( SELECT auth.uid() AS uid))));

-- commission.forms.read  ->  app.can_forms_read
alter policy form_matrix_rows_select on public.form_matrix_rows
  using ((app.can_forms_read(app.commission_of_version(form_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id)) OR app.can_access_targeted_version(form_version_id, ( SELECT auth.uid() AS uid))));

-- commission.forms.read  ->  app.can_forms_read
alter policy form_sections_select on public.form_sections
  using ((app.can_forms_read(app.commission_of_version(form_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id))));

-- commission.forms.read  ->  app.can_forms_read
alter policy form_versions_select on public.form_versions
  using ((app.can_forms_read(app.commission_of_version(id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_version(id))));

-- commission.forms.read  ->  app.can_forms_read
alter policy forms_select on public.forms
  using ((app.can_forms_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.forms.read  ->  app.can_forms_read
alter policy form_assets_select_member on storage.objects
  using (((bucket_id = 'form-assets'::text) AND (app.is_tenancy_admin_of(((storage.foldername(name))[1])::uuid) OR app.can_forms_read(((storage.foldername(name))[1])::uuid, (select auth.uid())))));

-- commission.indicators.read  ->  app.can_indicators_read
alter policy indicator_measurements_select on public.indicator_measurements
  using ((EXISTS ( SELECT 1
   FROM indicators i
  WHERE ((i.id = indicator_measurements.indicator_id) AND app.can_indicators_read(i.commission_id, (select auth.uid()))))));

-- commission.indicators.read  ->  app.can_indicators_read
alter policy indicators_select on public.indicators
  using ((app.can_indicators_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.meetings.read  ->  app.can_meetings_read
alter policy meeting_settings_select on public.commission_meeting_settings
  using ((app.can_meetings_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.meetings.read  ->  app.can_meetings_read
alter policy meeting_types_select on public.commission_meeting_types
  using ((app.can_meetings_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.meetings.read  ->  app.can_meetings_read
alter policy meetings_select on public.meetings
  using ((app.can_meetings_read(commission_id, (select auth.uid())) AND ((visibility_policy = 'commission_default'::text) OR (EXISTS ( SELECT 1
   FROM meeting_attendees a
  WHERE ((a.meeting_id = meetings.id) AND (a.user_id = ( SELECT auth.uid() AS uid))))))));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy phase_results_select on public.phase_results
  using ((app.can_process_templates_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy process_template_custom_fields_select on public.process_template_custom_fields
  using ((app.can_process_templates_read(app.commission_of_template_version(template_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_template_version(template_version_id))));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy process_template_narratives_select on public.process_template_narratives
  using ((app.can_process_templates_read(app.commission_of_template_version(template_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_template_version(template_version_id))));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy process_template_outcomes_select on public.process_template_outcomes
  using ((app.can_process_templates_read(app.commission_of_template_version(template_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_template_version(template_version_id))));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy process_template_phase_allowed_results_select on public.process_template_phase_allowed_results
  using ((app.can_process_templates_read(app.commission_of_template_phase(template_phase_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_template_phase(template_phase_id))));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy process_template_phase_offered_results_select on public.process_template_phase_offered_results
  using ((app.can_process_templates_read(app.commission_of_template_phase(template_phase_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_template_phase(template_phase_id))));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy process_template_phases_select on public.process_template_phases
  using ((app.can_process_templates_read(app.commission_of_template_version(template_version_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_template_version(template_version_id))));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy process_template_versions_select on public.process_template_versions
  using ((app.can_process_templates_read(app.commission_of_template(template_id), (select auth.uid())) OR app.is_tenancy_admin_of(app.commission_of_template(template_id))));

-- commission.process_templates.read  ->  app.can_process_templates_read
alter policy process_templates_select on public.process_templates
  using ((app.can_process_templates_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.responses.create  ->  app.can_responses_create
alter policy responses_insert_own on public.responses
  with check (((created_by = ( SELECT auth.uid() AS uid)) AND app.can_responses_create(commission_id, (select auth.uid()))));

-- commission.roster.read  ->  app.can_roster_read
alter policy member_titles_select on public.commission_member_titles
  using ((app.can_roster_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id)));

-- commission.roster.read  ->  app.can_roster_read
alter policy commissions_select_member_or_admin on public.commissions
  using ((app.can_roster_read(id, (select auth.uid())) OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(hospital_id) OR app.is_pqs_operator_of(hospital_id) OR app.is_nsp_org_admin_of(organization_id) OR (app.is_quality_reviewer_of(hospital_id) AND (quality_oversight = 'visible'::text))));

-- commission.roster.read  ->  app.can_roster_read
alter policy memberships_select on public.memberships
  using (((principal_id = ( SELECT auth.uid() AS uid)) OR app.is_admin() OR ((commission_id IS NOT NULL) AND (app.can_roster_read(commission_id, (select auth.uid())) OR app.is_tenancy_admin_of(commission_id))) OR ((organization_id IS NOT NULL) AND (commission_id IS NULL) AND (hospital_id IS NULL) AND app.is_org_admin_of(organization_id)) OR ((hospital_id IS NOT NULL) AND (app.is_org_admin_of(app.org_of_hospital(hospital_id)) OR app.is_hospital_admin_of(hospital_id)))));

-- commission.roster.read  ->  app.can_roster_read
alter policy profiles_select_self_or_admin on public.profiles
  using (((id = ( SELECT auth.uid() AS uid)) OR app.can_administer_person_via_affiliation(id) OR (EXISTS ( SELECT 1
   FROM (memberships cm
     JOIN commissions c ON ((c.id = cm.commission_id)))
  WHERE ((cm.commission_id IS NOT NULL) AND (cm.principal_id = profiles.id) AND app.is_tenancy_admin_of(c.id)))) OR (app.is_active(( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM memberships them
  WHERE ((them.commission_id IS NOT NULL) AND (them.principal_id = profiles.id) AND app.can_roster_read(them.commission_id, (select auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM hospital_affiliations ha
  WHERE ((ha.principal_id = profiles.id) AND (ha.voided_at IS NULL) AND app.is_hospital_admin_of(ha.hospital_id)))) OR (EXISTS ( SELECT 1
   FROM (memberships hm
     LEFT JOIN commissions hc ON ((hc.id = hm.commission_id)))
  WHERE ((hm.principal_id = profiles.id) AND (COALESCE(hm.hospital_id, hc.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm.hospital_id, hc.hospital_id)))))));
-- ==========================================================================
-- PART 3 — the 23 gate-carrying function sites, RE-EMITTED WHOLE under search_path = ''.
--
-- ⛔ WHOLE, via pg_get_functiondef, never `ALTER FUNCTION ... SET search_path`: ALTER does
-- NOT re-validate the body, so a reference that stops resolving under the new path is
-- accepted silently and fails at runtime. CREATE OR REPLACE makes Postgres resolve a
-- `sql` body at create time (7 of these); the 15 `plpgsql` bodies are validated by
-- plpgsql_check BEFORE this migration is placed.
-- ⚠ MEASURED FIRST: all 23 bodies are ALREADY fully schema-qualified — zero unqualified
-- relation references and zero unqualified calls to a real app/public/authz function,
-- proven with a planted control. So convergence here is a proconfig change plus the gate
-- substitution, NOT the mass body re-emission ADR 0208 D4 says is not required.
-- ==========================================================================

-- app._case_caps  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_cases_deliberation_read   [bare=0 _for=2]
CREATE OR REPLACE FUNCTION app._case_caps(p_case_id uuid, p_uid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_caps       int  := 0;
  v_commission uuid;
  v_policy     text;
  v_eg         boolean;
  v_coord      boolean;
  v_orgadmin   boolean;
  v_member     boolean;
  v_g          record;
begin
  -- STEP 1 — null user => 0.
  if p_uid is null then
    return 0;
  end if;

  -- STEP 2 — D3 outer gate: a deactivated/suspended principal reaches nothing.
  if not app.is_active(p_uid) then
    return 0;
  end if;

  -- STEP 3 — tenant anchors. Unknown case => fail closed.
  select commission_id, visibility_policy
    into v_commission, v_policy
  from public.cases where id = p_case_id;
  if v_commission is null then
    return 0;
  end if;

  -- STEP 4 — HARD DENY, before every positive arm (ADR 0072 D2). A respondent or a
  -- recused user is denied even where a positive arm would grant.
  if app.is_case_respondent(p_case_id, p_uid) then
    return 0;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return 0;
  end if;

  -- STEP 5 — union the positive sources.
  v_eg       := (v_policy = 'explicit_grants_only');
  v_coord    := app.is_staff_admin_of_for(v_commission, p_uid);
  v_orgadmin := app.is_tenancy_admin_of_for(v_commission, p_uid);
  v_member   := app.can_cases_deliberation_read_in_commission(v_commission, p_uid);

  -- ── S6 · nsp_referral_touched — content + deliberation ONLY; NO PHI. The
  --         read_standard_phi bit was REMOVED here (ADR 0078 D8/N1): an NSP operator
  --         keeps Case Content reach on a referral-touched case (its oversight job) but
  --         LOSES the automatic patient-identifier arm — D1 (Standard PHI is separate
  --         from Case Content) applied consistently. Until Stage D, NSP obtains case PHI
  --         through an explicit grant (the S1 coordinator / S3 manual_grant arms below
  --         still confer read_standard_phi). ────────────────────────────────────────
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('read_case_deliberation');
  end if;

  -- ── S1 · committee_coordinator — all EXCEPT read_restricted_phi (D5·6). ───────
  if v_coord then
    v_caps := v_caps | app._cap_bit('view_case_overview')
                     | app._cap_bit('read_case_deliberation')
                     | app._cap_bit('read_case_content')
                     | app._cap_bit('read_standard_phi')
                     | app._cap_bit('write_case_content')
                     | app._cap_bit('manage_case_access');
  end if;

  -- ── S2 · org_admin — manage_case_access ONLY (A4 removed content/deliberation). ─
  if v_orgadmin then
    v_caps := v_caps | app._cap_bit('manage_case_access');
  end if;

  -- ── S5 · committee_member_default — read_case_deliberation ONLY (A15). ────────
  if v_member and not v_eg then
    v_caps := v_caps | app._cap_bit('read_case_deliberation');
  end if;

  -- ── S7 · quality_reviewer (ADR 0100 D1/D3) — read_case_content +
  --         view_case_overview, on an oversight-VISIBLE commission of a hospital
  --         the principal reviews. DELIBERATE ABSENCES: no read_case_deliberation
  --         (D4 — the S3/S4 read-closure rung is intentionally NOT applied here),
  --         no PHI bits (D5), no write bits (D7). Locked cases (v_eg) are fully
  --         invisible to the arm (D6) — exceptions ride case_access_grants (S3).
  --         Inherits STEP-2 is_active, STEP-3 fail-closed-unknown-case and the
  --         STEP-4 hard denies by position. Cost: `not v_eg` short-circuits
  --         first, then one memberships_hospital_idx probe + one commissions PK
  --         read. ─────────────────────────────────────────────────────────────
  if not v_eg
     and app.is_quality_reviewer_of_for(app.hospital_of_commission(v_commission), p_uid)
     and (select quality_oversight from public.commissions where id = v_commission) = 'visible' then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('view_case_overview');
  end if;

  -- ── S8 · administrativo_read_cases (ADR 0134 D6; bounded by Amendment 4;
  --         mechanism corrected by Amendment 6) — read_case_content ONLY, for an
  --         appointed Administrativo of the case's commission holding the ADR-0061
  --         `read_cases` capability. Management ≠ authorship: NO write bits (content
  --         authorship still needs an explicit S3 grant), NO PHI bits (Rule 12), NO
  --         view_case_overview (that bit is S1/S7 only), NO manage_case_access.
  --         Locked cases (v_eg) are fully invisible to the arm (Amdt 4, PO-ruled
  --         2026-08-22) — reach there rides an explicit grant (S3) or nothing, exactly
  --         as for S5 and S7. Routed through the flag-aware capability chokepoint, so
  --         the `administrativo` kill switch darkens it with the rest of ADR 0061.
  --         Inherits STEP-2 is_active, STEP-3 fail-closed-unknown-case and the STEP-4
  --         hard denies BY POSITION, exactly as S5/S7 do.
  --         ⭐ member_can_FOR, not member_can (Amdt 6): `app.member_can` resolves
  --         `auth.uid()`, but this resolver is a (case, p_uid) function whose callers
  --         routinely ask about a THIRD party. The bare form would answer about the
  --         CALLER — under-firing wherever auth.uid() is null and, worse, setting
  --         content-without-deliberation for a non-member p_uid, which is
  --         is_oversight_only_reader's exact bit shape and the very collision Amdt 4
  --         exists to close.
  --         ⚠ WHY S5 PAIRS WITH THIS ARM — CONTINGENTLY SINCE AE5 T7, NOT STRUCTURALLY.
  --         Before the re-key both this guard and S5 resolved the SAME predicate:
  --         app.member_can_for's third conjunct is `app.is_member_of_for(v_commission,
  --         p_uid)`, which was literally the call that assigned v_member. S5 now assigns
  --         from `app.can_cases_deliberation_read_in_commission`, a PERMISSION check, while
  --         member_can_for still asks the MEMBERSHIP question — measured in the live
  --         catalog 2026-09-14, not read off this migration. The pairing still holds, but
  --         as a fact about the CATALOG rather than about the text: the only two
  --         commission-tier roles in public.memberships are `staff` and `staff_admin`, and
  --         BOTH hold commission.cases.deliberation.read. ⛔ A future commission-tier role
  --         WITHOUT that code would set content-without-deliberation —
  --         is_oversight_only_reader's exact bit shape, the collision Amdt 4 §A4.2 exists
  --         to close. Filed as FUP-AE5-STAFF-S8-S5-PAIRING-NOW-CONTINGENT.
  --         ⚠ `read_cases` is the ADR-0061 delegation vocabulary, NOT app._cap_bit's
  --         `read_case_content`. Two vocabularies, one word apart. ─────────────────
  if not v_eg
     and app.member_can_for(v_commission, 'read_cases', p_uid) then
    v_caps := v_caps | app._cap_bit('read_case_content');
  end if;

  -- ── S3 · manual_grant (case_access_grants — per-column capabilities). ─────────
  -- ⭐ DEFECT ①·2 CLOSED: read_standard_phi is conferred iff its COLUMN is set,
  -- NEVER inferred from a read/write grant and NEVER from write (A16). Lattice
  -- closure applied on read. NO feature-flag branch (the flag is retired); the
  -- flag-OFF legacy member arm (S5L) is DELETED (D9). Multiple active grants union
  -- (the active partial-unique bounds it to one per source, but the loop is robust).
  for v_g in
    select read_case_content, read_case_deliberation, read_standard_phi,
           read_restricted_phi, write_case_content
    from public.case_access_grants g
    where g.case_id = p_case_id and g.principal_id = p_uid
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  loop
    -- Faithful to the pre-cut grant arm: it conferred content + deliberation (NOT
    -- view_case_overview — grants never confer it; since ADR 0100 D3 that bit
    -- comes from the S1 coordinator and S7 quality_reviewer arms only), so the
    -- mechanism swap keeps GAINED=0 on the raw bitmask, not only on consumed reach.
    if v_g.write_case_content then
      v_caps := v_caps | app._cap_bit('write_case_content')
                       | app._cap_bit('read_case_content')
                       | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_case_content then
      v_caps := v_caps | app._cap_bit('read_case_content')
                       | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_case_deliberation then
      v_caps := v_caps | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_standard_phi then
      v_caps := v_caps | app._cap_bit('read_standard_phi');
    end if;
    if v_g.read_restricted_phi then
      v_caps := v_caps | app._cap_bit('read_restricted_phi')
                       | app._cap_bit('read_standard_phi');
    end if;
  end loop;

  -- ── S4 · case_assignment — read_case_content + read_case_deliberation ONLY
  --         (NEVER PHI — defect ①; NEVER write — D10). Unchanged from A2. ────────
  if exists (select 1 from public.case_phases cp
             where cp.case_id = p_case_id and cp.assigned_to = p_uid)
     or exists (select 1 from public.case_narratives cn
                where cn.case_id = p_case_id and cn.assigned_to = p_uid) then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('read_case_deliberation');
  end if;

  -- STEP 6 — return. (No lifecycle step; guard_case_status owns terminal-freeze.)
  return v_caps;
end;
$function$;

-- app.can_reach_meeting  (sql, search_path="")  ->  app.can_meetings_read   [bare=0 _for=1]
CREATE OR REPLACE FUNCTION app.can_reach_meeting(p_meeting_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select app.can_meetings_read(app.commission_of_meeting(p_meeting_id), p_uid)
     and (
       (select m.visibility_policy from public.meetings m where m.id = p_meeting_id)
         = 'commission_default'
       or exists (
         select 1 from public.meeting_attendees a
         where a.meeting_id = p_meeting_id and a.user_id = p_uid
       )
     );
$function$;

-- app.can_read_action_item  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_action_items_read   [bare=0 _for=1]
CREATE OR REPLACE FUNCTION app.can_read_action_item(p_action_item_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_commission_id uuid;
  v_scope text;
  v_source_case_id uuid;
  v_case_id uuid;
  v_assigned_to uuid;
  v_anchor_case uuid;
begin
  if not app.is_active(p_uid) then                    -- A24·5 outer gate (K28 pin)
    return false;
  end if;

  select commission_id, visibility_scope, source_case_id, linked_case_id, assigned_to
    into v_commission_id, v_scope, v_source_case_id, v_case_id, v_assigned_to
  from public.action_items where id = p_action_item_id;
  if v_commission_id is null then
    return false;
  end if;

  v_anchor_case := coalesce(v_source_case_id, v_case_id);
  if v_anchor_case is not null and app.is_case_excluded(v_anchor_case, p_uid) then   -- K27 pin
    return false;
  end if;

  if v_scope = 'committee' then
    return app.can_action_items_read(v_commission_id, p_uid);                 -- C7: org arm removed (A11)

  elsif v_scope = 'case_restricted' then
    return app.can_read_case_committee(v_anchor_case, p_uid);                      -- unchanged (K19: follows can_read_case)

  elsif v_scope = 'assignees_only' then
    return app.is_staff_admin_of_for(v_commission_id, p_uid)             -- C7: org arm removed (A11)
        or (v_assigned_to is not null and v_assigned_to = p_uid)
        or exists (
          select 1 from public.action_item_assignments a
          where a.action_item_id = p_action_item_id
            and a.user_id = p_uid
            and a.completed_at is null
        );
  end if;

  return false;
end;
$function$;

-- app.can_read_capa  (sql, search_path=app, public, pg_catalog)  ->  app.can_capa_read   [bare=0 _for=1]
CREATE OR REPLACE FUNCTION app.can_read_capa(p_capa_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    app.is_pqs_operator_of_for(
      (select hospital_id from public.capa_plan where id = p_capa_id), p_user_id)
    or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id)
    or exists (
      -- Phase 15: an indicator-sourced plan is readable by the indicator's
      -- commission members (the two-tier escalation read arm).
      select 1
      from public.capa_plan cp
      join public.indicators i on i.id = cp.source_indicator_id
      where cp.id = p_capa_id and cp.source = 'indicator'
        and app.can_capa_read(i.commission_id, p_user_id)
    );
$function$;

-- app.can_read_document  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_documents_read   [bare=0 _for=2]
CREATE OR REPLACE FUNCTION app.can_read_document(p_document_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
  v_conf text;
  v_case uuid;
  v_print_kind text;
  v_print_source uuid;
  v_ok boolean;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id, d.confidentiality_level
    into v_resource, v_type, v_commission, v_conf
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;

  -- DM5 S3 (ADR 0120 D7/D11/D13): THE PRINT ARM, and it must stay HERE —
  -- below the is_active guard, above the ceiling. A printed rendition is a
  -- `documents` row referenced by `printed_documents`; its authority is the
  -- print predicate, NOT its home type's arm, because D13 homes it on its
  -- source's resource where the home arm can be wider (the meeting case). This
  -- is a relational test, never `documents.kind` — that column has no CHECK
  -- (0 constraints) and unchecked text fails OPEN when it is typo'd or NULL.
  select pd.source_kind, pd.source_id
    into v_print_kind, v_print_source
  from public.printed_documents pd
  where pd.document_id = p_document_id;

  if v_print_source is not null then
    -- Deliberately the SAME predicate `printed_documents_select` uses, so the
    -- D12 conjunction in open_printed_document is a STRICT NARROWING and the
    -- "kernel passes but the print check fails" direction is structurally
    -- unreachable. 342 S3d pins that delegation from the catalog; it is a
    -- fact, not a coincidence to be re-derived by the next reader.
    v_ok := app.can_view_printed_document(v_print_kind, v_print_source, p_uid);
  else
    v_ok := case v_type
      when 'case' then app.can_read_case(v_resource, p_uid)
      when 'meeting' then app.can_documents_read(v_commission, p_uid)
      when 'interview' then app.can_read_interview(v_resource, p_uid)
      when 'action_item' then app.can_read_action_item(v_resource, p_uid)
      -- DM3 Wave B: the owning commission's members, PLUS the entitled approver
      -- corridor inherited from the retiring bucket policy. v_resource IS the
      -- controlled_documents.id (shared-PK registry link, ADR 0114 D4).
      when 'controlled_document' then
        app.can_documents_read(v_commission, p_uid)
        or app.is_document_approver_of(v_resource, p_uid)
      -- DM4 Wave C: the referral METADATA tier (broad half of the two-tier
      -- asymmetry — ADR 0119 D2). Bytes are gated separately, and narrower,
      -- in open_document_version.
      when 'case_referral' then app.can_read_referral_metadata(v_resource, p_uid)
      -- DM5 Wave D (ADR 0120 D2): CUSTODY-FOLLOWING, resolved at read time.
      -- ⚠ Deliberately NOT `v_commission` — see the header. The registry pins the
      -- REPORTING commission for tenancy; who may READ follows custody, and
      -- can_read_event is the single place that knows how.
      when 'rca' then app.can_read_event(app.event_of_rca(v_resource), p_uid)
      -- DM5 Wave D (ADR 0120 D14): EXPLICITLY through can_read_capa, which
      -- carries all three of its arms (PQS operator of the plan's hospital, the
      -- event corridor, and the Phase-15 indicator-commission escalation).
      -- v_resource IS the capa_action.id; can_read_capa takes the PLAN id.
      -- Inlined rather than given an `app.capa_of_action` helper on purpose: a
      -- new DEFINER function would have to join the census domain AND the
      -- committed findings file in this same phase (ADR 0079 Am. 7), and this
      -- resolves structure, not authority.
      when 'capa_action' then app.can_read_capa(
        (select ca.capa_id from public.capa_action ca where ca.id = v_resource), p_uid)
      -- DM5 S3: `form_response` is a securable type ONLY so a print of a form
      -- response has a home (ADR 0120 D1/D6). Nothing else homes there —
      -- begin_document_upload refuses it (M4) — so a non-print document on a
      -- form_response home is unrepresentable and falls to the fail-closed
      -- ELSE rather than being given an arm that could never be exercised.
      else false
    end;
  end if;

  if not v_ok then
    return false;
  end if;
  -- D15 ceiling (ADR 0114 Amendment 1; ADR 0072 D7 semantics): the two
  -- enforcing labels gate ABOVE home-resource read, as an AND-conjunct.
  -- Clearance = case_access_grants.max_confidentiality via the surviving
  -- app.confidentiality_clearance_ok (reused, never reimplemented).
  -- DM5 S3 note: prints reach this in principle but never in practice today —
  -- every print carries confidentiality_level NULL, and
  -- app.guard_document_confidentiality independently refuses an enforcing label
  -- on a form_response or meeting home. So D15 is satisfied VACUOUSLY for S3.
  -- The FUTURE property is the one worth recording: a case- or interview-homed
  -- print carrying an enforcing label resolves v_case and is gated by
  -- clearance; any other home falls to the backstop below and is readable by
  -- NO ONE. Fail-closed, not silently downgraded.
  if v_conf in ('legal_privileged', 'credentialing_sensitive') then
    v_case := case v_type
      when 'case' then v_resource
      when 'interview' then app.case_of_interview(v_resource)
      else null
    end;
    if v_case is null then
      -- Fail-closed backstop: an enforcing label with no clearance plane is
      -- readable by NO ONE. Unrepresentable while the S1 seam guard stands;
      -- this arm governs any bypass and any future home type until the
      -- Phase-19 access plane (D16) absorbs the column. DM3 note: a
      -- controlled_document home lands HERE by design — Wave B documents can
      -- never carry an enforcing label, which is precisely why ethics letters
      -- home on the CASE resource instead (ADR 0114 Amendment 2). DM4 note:
      -- a case_referral home lands here too — and the FREEZE of an
      -- enforcing-labelled case document is refused outright (HC0DC,
      -- ADR 0119 D4), so the ceiling cannot be laundered through a referral.
      -- DM5 note: `rca` and `capa_action` land here too, deliberately — NSP
      -- evidence has no clearance plane, so an enforcing label on it is
      -- unreadable by everyone rather than silently downgraded.
      return false;
    end if;
    return app.confidentiality_clearance_ok(v_case, v_conf, p_uid);
  end if;
  return true;
end;
$function$;

-- app.can_read_document_of_version  (sql, search_path=app, public, pg_catalog)  ->  app.can_documents_read   [bare=0 _for=1]
CREATE OR REPLACE FUNCTION app.can_read_document_of_version(p_version_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- QO·B (ADR 0100 D12): the app.is_tenancy_admin_of_for arm is deliberately ABSENT.
  -- Committee membership and the approver corridor remain; the tenancy admin does not
  -- read document content.
  select
    app.can_documents_read(app.commission_of_document_version(p_version_id), p_uid);
$function$;

-- app.can_read_event  (sql, search_path=app, public, pg_catalog)  ->  app.can_safety_events_read   [bare=0 _for=2]
CREATE OR REPLACE FUNCTION app.can_read_event(p_event_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.can_safety_events_read(e.current_owner_commission_id, p_user_id)
        or app.can_safety_events_read(e.reporting_commission_id, p_user_id)
        or app.is_pqs_operator_of_for(app.hospital_of_event(e.id), p_user_id)
      )
  );
$function$;

-- app.can_read_referral_internal_note  (sql, search_path=app, public, pg_catalog)  ->  app.can_referrals_metadata_read   [bare=0 _for=2]
CREATE OR REPLACE FUNCTION app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select app.is_active(p_uid) and exists (
    select 1
    from public.referral_internal_notes n
    join public.case_referral r on r.id = n.referral_id
    where n.id = p_note_id and (
      (n.committee_id = r.source_commission_id
        and app.can_referrals_metadata_read(r.source_commission_id, p_uid))
      or (n.committee_id = r.target_commission_id
        and r.status <> 'draft'
        and app.can_referrals_metadata_read(r.target_commission_id, p_uid))
    )
  );
$function$;

-- app.can_read_referral_internal_notes  (sql, search_path=app, public, pg_catalog)  ->  app.can_referrals_metadata_read   [bare=0 _for=2]
CREATE OR REPLACE FUNCTION app.can_read_referral_internal_notes(p_referral_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select app.is_active(p_uid) and exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.can_referrals_metadata_read(r.source_commission_id, p_uid)
        or (r.status <> 'draft' and app.can_referrals_metadata_read(r.target_commission_id, p_uid))
      )
  );
$function$;

-- app.can_read_referral_metadata  (sql, search_path=app, public, pg_catalog)  ->  app.can_referrals_metadata_read   [bare=0 _for=2]
CREATE OR REPLACE FUNCTION app.can_read_referral_metadata(p_referral_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        -- PQS reads every referral at every status (ADR 0037 D6).
        app.is_pqs_operator_of_for(app.hospital_of_commission(r.source_commission_id), p_uid)
        or app.is_pqs_operator_of_for(app.hospital_of_commission(r.target_commission_id), p_uid)
        -- The SOURCE committee authors the draft and sees it on the case card.
        or app.can_referrals_metadata_read(r.source_commission_id, p_uid)
        -- The TARGET committee only once the referral has actually been SENT.
        or (r.status <> 'draft' and app.can_referrals_metadata_read(r.target_commission_id, p_uid))
        -- ADR 0094 W4 — the target HOSPITAL's technical direction, same rule.
        or (r.status <> 'draft'
            and r.target_type = 'technical_director'
            and app.is_technical_director_of_for(r.target_hospital_id, p_uid))
      )
  );
$function$;

-- app.can_sign_meeting  (sql, search_path=app, public, pg_catalog)  ->  app.can_meetings_minutes_sign   [bare=0 _for=1]
CREATE OR REPLACE FUNCTION app.can_sign_meeting(p_attendee_id uuid, p_signer uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.id = p_attendee_id
      and a.user_id is not null
      and a.user_id = p_signer
      and a.attendance = 'present'
      and m.status = 'in_signature'
      and app.can_meetings_minutes_sign(m.commission_id, p_signer)
  );
$function$;

-- public.cast_case_vote  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_cases_vote   [bare=0 _for=1]
CREATE OR REPLACE FUNCTION public.cast_case_vote(p_decision_id uuid, p_vote text, p_rationale_md text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_id uuid;
begin
  -- (a) flag.
  perform app.assert_ethics_enabled();

  -- (b) the decision must exist; resolve its case.
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then
    raise exception 'decisão não encontrada' using errcode = 'P0002';
  end if;
  v_commission := app.commission_of_case(v_case_id);

  -- (c) ethics-typed (Lead ruling 1: existence of ethics_case_details IS the marker).
  if not exists (select 1 from public.ethics_case_details d where d.case_id = v_case_id) then
    raise exception 'ação inválida para o status atual do processo ético'
      using errcode = 'HC0J0';
  end if;

  -- (d) AUTHORITY FIRST — a commission member may vote. DISTINCT SQLSTATE (42501), so a
  -- non-member is NEVER mistaken for an excluded member (the non-vacuity requirement).
  if not app.can_cases_vote(v_commission, auth.uid()) then
    raise exception 'usuário não autorizado a votar neste caso' using errcode = '42501';
  end if;

  -- (e) EXCLUSION — consume E1. A recused OR respondent member is refused (HC0J5). This
  -- is reached ONLY by an authority-passing member, so the HC0J5 keystones are non-vacuous.
  if app.is_recused_from_case(v_case_id, auth.uid())
     or app.is_case_respondent(v_case_id, auth.uid()) then
    raise exception 'membro impedido (recusado ou denunciado) não pode votar'
      using errcode = 'HC0J5';
  end if;

  -- (f) value.
  if p_vote not in ('approve', 'reject', 'abstain') then
    raise exception 'valor de voto inválido' using errcode = 'check_violation';
  end if;

  -- (g) insert. case_votes.case_id = the decision's case_id (coherence in the RPC).
  begin
    insert into public.case_votes (case_id, decision_id, voter_id, vote, rationale_md)
    values (v_case_id, p_decision_id, auth.uid(), p_vote, nullif(btrim(p_rationale_md), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'já existe um voto deste membro para esta decisão'
      using errcode = 'HC0J4';
  end;

  -- Rule 11: THAT + WHO + the vote value, never case content.
  insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (v_case_id, 'vote_cast', null,
          'Voto registrado',
          'coordinator_only', current_date, auth.uid());
  perform app.audit_write('case.vote_cast', 'case', v_case_id, v_commission,
    'Voto registrado na decisão do caso',
    jsonb_build_object('decision_id', p_decision_id, 'vote', p_vote));
  return v_id;
end;
$function$;

-- public.create_referral_internal_note  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_referrals_notes_author   [bare=0 _for=2]
CREATE OR REPLACE FUNCTION public.create_referral_internal_note(p_referral_id uuid, p_committee_id uuid, p_body_md text, p_title text DEFAULT NULL::text, p_kind text DEFAULT 'note'::text, p_assigned_to uuid DEFAULT NULL::uuid)
 RETURNS referral_internal_note_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'note');
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (42501, distinct SQLSTATE). The committee must be one of the
  -- referral's two sides AND the caller a member of THAT side.
  if (p_committee_id is distinct from v_ref.source_commission_id
      and p_committee_id is distinct from v_ref.target_commission_id)
     or not app.can_referrals_notes_author(p_committee_id, auth.uid()) then
    raise exception 'apenas um membro da comissão de origem ou destino pode registrar uma nota interna'
      using errcode = '42501';
  end if;

  -- DOMAIN validation (after authority).
  if nullif(btrim(p_body_md), '') is null then
    raise exception 'a nota interna não pode estar vazia' using errcode = 'HC0A9';
  end if;

  -- Shared case-Registro vocabulary; the CHECK is the backstop, this is the
  -- pt-BR-speaking front door.
  if v_kind <> all (array['note', 'meeting', 'decision', 'update', 'follow_up', 'other']) then
    raise exception 'tipo de registro inválido' using errcode = 'HC0A9';
  end if;

  if p_assigned_to is not null
     and not app.can_referrals_notes_author(p_committee_id, p_assigned_to) then
    raise exception 'o responsável deve ser um membro ativo desta comissão'
      using errcode = 'HC0A9';
  end if;

  insert into public.referral_internal_notes
    (referral_id, committee_id, author_user_id, body_md, title,
     kind, assigned_to, updated_by)
  values
    (p_referral_id, p_committee_id, auth.uid(), btrim(p_body_md),
     nullif(btrim(p_title), ''), v_kind, p_assigned_to, auth.uid())
  returning * into v_row;

  perform app.audit_write(
    'referral.note_created', 'referral', p_referral_id, p_committee_id,
    'Nota interna registrada no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_row.id, 'committee_id', p_committee_id));

  return app._project_referral_internal_note(v_row);
end;
$function$;

-- public.documents_due_for_review  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_documents_read   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.documents_due_for_review(p_commission uuid)
 RETURNS TABLE(source_kind text, document_id uuid, form_version_id uuid, code text, title text, commission_id uuid, commission_name text, review_due_date date, is_overdue boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_commission_name text;
begin
  perform app.assert_controlled_docs_enabled();
  if not (app.can_documents_read(p_commission, (select auth.uid()))) then
    return;
  end if;

  select name into v_commission_name from public.commissions where id = p_commission;

  return query
  -- DOCUMENT arm: the current vigente version of each document with a review_due_date.
  select
    'document'::text,
    d.id,
    null::uuid,
    d.code,
    d.title,
    d.commission_id,
    v_commission_name,
    v.review_due_date,
    (v.review_due_date < current_date) as is_overdue
  from public.controlled_documents d
  join public.controlled_document_versions v on v.id = d.current_version_id
  where d.commission_id = p_commission
    and v.status = 'effective'
    and v.review_due_date is not null

  union all

  -- FORM arm: published form versions carrying a B4 review_due_date (a form treated
  -- as a controlled document). code = 'FORM-v<n>'; title = the form title.
  select
    'form'::text,
    null::uuid,
    fv.id,
    'FORM-v' || fv.version_number,
    f.title,
    f.commission_id,
    v_commission_name,
    fv.review_due_date,
    (fv.review_due_date < current_date) as is_overdue
  from public.form_versions fv
  join public.forms f on f.id = fv.form_id
  where f.commission_id = p_commission
    and fv.status = 'published'
    and fv.review_due_date is not null

  order by review_due_date nulls last;
end;
$function$;

-- public.get_referral_case_access_summary  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_referrals_metadata_read   [bare=0 _for=1]
CREATE OR REPLACE FUNCTION public.get_referral_case_access_summary(p_referral_id uuid, p_commission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ref        public.case_referral;
  v_case       uuid;
  v_commission uuid;
  v_hospital   uuid;
  v_result     jsonb;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (42501). Three terms, all required:
  --   1. p_commission_id is one of the referral's two sides (NULL-safe: a
  --      technical_director target leaves target_commission_id NULL);
  --   2. the caller is an active member of THAT side;
  --   3. the caller can read the referral at all (this is what denies a target-side
  --      member while the referral is still a draft).
  if (p_commission_id is distinct from v_ref.source_commission_id
      and p_commission_id is distinct from v_ref.target_commission_id)
     or not app.can_referrals_metadata_read(p_commission_id, auth.uid())
     or not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'apenas um membro da comissão de origem ou destino pode consultar o acesso ao caso'
      using errcode = '42501';
  end if;

  -- The case is SIDE-DERIVED, never caller-chosen.
  if p_commission_id = v_ref.source_commission_id then
    v_case := v_ref.source_case_id;
  else
    v_case := v_ref.target_case_id;
  end if;

  -- Target side with no linked case yet → nothing to describe.
  if v_case is null then
    return null;
  end if;

  select c.commission_id into v_commission from public.cases c where c.id = v_case;
  if v_commission is null then
    return null;
  end if;
  v_hospital := app.hospital_of_commission(v_commission);

  with cand as (
    -- S1 · committee coordinators of the case's OWN commission
    select m.principal_id as uid, 1 as grp
      from public.memberships m
     where m.commission_id = v_commission
       and m.role = 'staff_admin'
       and (m.expires_at is null or m.expires_at > now())
    union all
    -- S3 · explicit per-case grants (any live grant; the resolver decides if it reads)
    select g.principal_id, 2
      from public.case_access_grants g
     where g.case_id = v_case
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
    union all
    -- S4 · phase + narrative assignees
    select cp.assigned_to, 3
      from public.case_phases cp
     where cp.case_id = v_case and cp.assigned_to is not null
    union all
    select cn.assigned_to, 3
      from public.case_narratives cn
     where cn.case_id = v_case and cn.assigned_to is not null
    union all
    -- S6 · patient-safety (PQS/NSP) operators of the case's hospital
    select m.principal_id, 4
      from public.memberships m
     where v_hospital is not null
       and m.hospital_id = v_hospital
       and m.role in ('nsp_coordinator', 'pqs_member')
       and (m.expires_at is null or m.expires_at > now())
    union all
    -- S7 · quality reviewers of the case's hospital
    select m.principal_id, 5
      from public.memberships m
     where v_hospital is not null
       and m.hospital_id = v_hospital
       and m.role = 'quality_reviewer'
       and (m.expires_at is null or m.expires_at > now())
  ),
  ranked as (
    -- De-dupe a person into their HIGHEST group (A7 order).
    select uid, min(grp) as grp
      from cand
     where uid is not null
     group by uid
  ),
  eff as (
    select r.grp, p.full_name
      from ranked r
      join public.profiles p on p.id = r.uid
     where app.has_case_capability(v_case, r.uid, 'read_case_content')
       and coalesce(nullif(btrim(p.full_name), ''), '') <> ''
  )
  select jsonb_build_object(
           'case_id', v_case,
           'can_read', app.can_read_case(v_case, auth.uid()),
           'coordinators',   coalesce(to_jsonb(eff_agg.g1), '[]'::jsonb),
           'grantees',       coalesce(to_jsonb(eff_agg.g2), '[]'::jsonb),
           'assignees',      coalesce(to_jsonb(eff_agg.g3), '[]'::jsonb),
           'patient_safety', coalesce(to_jsonb(eff_agg.g4), '[]'::jsonb),
           'quality',        coalesce(to_jsonb(eff_agg.g5), '[]'::jsonb)
         )
    into v_result
  from (
    select array_agg(full_name order by full_name) filter (where grp = 1) as g1,
           array_agg(full_name order by full_name) filter (where grp = 2) as g2,
           array_agg(full_name order by full_name) filter (where grp = 3) as g3,
           array_agg(full_name order by full_name) filter (where grp = 4) as g4,
           array_agg(full_name order by full_name) filter (where grp = 5) as g5
    from eff
  ) eff_agg;

  -- Rule 11: this discloses WHO may read another commission's case. PHI-free
  -- (referral + case ids and a count; never a name).
  perform public.log_audit_access(
    'referral.case_access_summary_viewed', 'referral', p_referral_id, p_commission_id,
    'Consulta do acesso ao caso vinculado ao encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('referral_id', p_referral_id, 'case_id', v_case,
                       'commission_id', p_commission_id));

  return v_result;
end;
$function$;

-- public.get_standard_assessment  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_accreditation_read   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.get_standard_assessment(p_commission uuid, p_standard uuid)
 RETURNS TABLE(status text, note_md text, assessed_at timestamp with time zone, assessed_by_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform app.assert_accreditation_enabled();

  if not app.can_accreditation_read(p_commission, (select auth.uid())) then
    return;
  end if;

  return query
  select sa.status, sa.note_md, sa.assessed_at, p.full_name
  from public.standard_assessments sa
  left join public.profiles p on p.id = sa.assessed_by
  where sa.commission_id = p_commission and sa.standard_id = p_standard;
end;
$function$;

-- public.indicator_series  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_indicators_read   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.indicator_series(p_indicator uuid, p_from text DEFAULT NULL::text, p_to text DEFAULT NULL::text)
 RETURNS TABLE(period_label text, period_start date, value numeric, target numeric, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ind public.indicators;
begin
  perform app.assert_quality_indicators_enabled();
  select * into v_ind from public.indicators where id = p_indicator;
  if v_ind is null then return; end if;
  if not (app.can_indicators_read(v_ind.commission_id, (select auth.uid()))
          or app.is_tenancy_admin_of(v_ind.commission_id)) then
    return;
  end if;

  return query
  select m.period_label, m.period_start, m.value,
         v_ind.target_value as target, m.status
  from public.indicator_measurements m
  where m.indicator_id = p_indicator
    and (p_from is null or m.period_label >= p_from)
    and (p_to   is null or m.period_label <= p_to)
  order by m.period_start nulls last, m.period_label;
end;
$function$;

-- public.list_commission_documents  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_documents_read   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.list_commission_documents(p_commission uuid)
 RETURNS TABLE(id uuid, commission_id uuid, hospital_id uuid, code text, title text, doc_type text, category text, tags text[], description text, review_cycle_months integer, status text, current_version_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, current_version_number integer, effective_date date, review_due_date date, obsolete_kind text, has_open_revision boolean, approvals_signed_count integer, approvals_total_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform app.assert_controlled_docs_enabled();
  if not (app.can_documents_read(p_commission, (select auth.uid()))) then
    return;
  end if;

  return query
  select
    d.id,
    d.commission_id,
    c.hospital_id,
    d.code,
    d.title,
    d.doc_type,
    d.category,
    d.tags,
    d.description,
    d.review_cycle_months,
    d.status,
    d.current_version_id,
    d.created_at,
    d.updated_at,
    cv.version_number,
    cv.effective_date,
    cv.review_due_date,
    cv.obsolete_kind,
    (cv.status = 'effective' and exists (
       select 1 from public.controlled_document_versions ov
       where ov.document_id = d.id
         and ov.id <> d.current_version_id
         and ov.status in ('draft', 'in_approval', 'changes_requested')
    )) as has_open_revision,
    coalesce((
      select count(*) filter (where a.decision = 'approved')
      from public.document_approvals a
      where a.document_version_id = ia.ia_version
    ), 0)::integer as approvals_signed_count,
    coalesce((
      select count(*)
      from public.document_approvals a
      where a.document_version_id = ia.ia_version
    ), 0)::integer as approvals_total_count
  from public.controlled_documents d
  join public.commissions c on c.id = d.commission_id
  left join public.controlled_document_versions cv on cv.id = d.current_version_id
  left join lateral (
    select v.id as ia_version
    from public.controlled_document_versions v
    where v.document_id = d.id and v.status = 'in_approval'
    limit 1
  ) ia on true
  where d.commission_id = p_commission
  order by d.created_at desc;
end;
$function$;

-- public.meeting_cadence_status  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_charter_read   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.meeting_cadence_status(p_commission uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_freq text;
  v_last_held timestamptz;
begin
  perform app.assert_charters_enabled();

  if not app.can_charter_read(p_commission, (select auth.uid())) then
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

-- public.notify_safety_event  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_safety_events_report   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.notify_safety_event(p_reporting_commission_id uuid, p_title text, p_description_md text DEFAULT NULL::text, p_suspected_harm_level text DEFAULT 'unknown'::text, p_case_id uuid DEFAULT NULL::uuid, p_event_type_id uuid DEFAULT NULL::uuid, p_location text DEFAULT NULL::text, p_discovered_at date DEFAULT NULL::date)
 RETURNS patient_safety_event
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event public.patient_safety_event;
  v_attempts int := 0;
  v_case_commission uuid;
begin
  perform app.assert_patient_safety_enabled();

  -- Authorize: ANY member of the reporting commission (just-culture), or admin.
  if not (app.can_safety_events_report(p_reporting_commission_id, (select auth.uid()))) then
    raise exception 'apenas membros da comissão notificante podem registrar um evento'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para o evento' using errcode = 'check_violation';
  end if;

  -- A case-linked event's case must belong to the reporting commission (honesty).
  if p_case_id is not null then
    select commission_id into v_case_commission from public.cases where id = p_case_id;
    if v_case_commission is null then
      raise exception 'caso não encontrado' using errcode = 'P0002';
    end if;
    if v_case_commission <> p_reporting_commission_id then
      raise exception 'o caso não pertence à comissão notificante' using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);

  -- Insert with a bounded retry over the minted code (the trigger mints it; the
  -- unique(code) backstops a rare concurrent collision).
  loop
    begin
      insert into public.patient_safety_event (
        reporting_commission_id, case_id, discovered_at, location, reported_by,
        event_type_id, suspected_harm_level, title, description_md,
        status, current_owner_kind, current_owner_commission_id
      ) values (
        p_reporting_commission_id, p_case_id, p_discovered_at, p_location, auth.uid(),
        p_event_type_id, coalesce(p_suspected_harm_level, 'unknown'), p_title, p_description_md,
        'reported', 'pqs', null
      )
      returning * into v_event;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;

  -- Open the initial custody interval at the NSP.
  insert into public.event_custody (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values (v_event.id, 'pqs', null, auth.uid(), 'Notificação inicial ao NSP');

  -- Case-linked: write the Phase-12 timeline entry (body is NOT NULL).
  if p_case_id is not null then
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (
      p_case_id, 'safety_event',
      'Evento de segurança ' || v_event.code,
      'Evento ' || v_event.code || ' notificado ao NSP: ' || p_title,
      coalesce(p_discovered_at, current_date), auth.uid()
    );
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_event;
end;
$function$;

-- public.readiness_evidence  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_accreditation_read   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.readiness_evidence(p_commission uuid, p_standard uuid)
 RETURNS TABLE(id uuid, standard_id uuid, artifact_kind text, artifact_id uuid, status text, label text, note text, restricted boolean, linked_by_name text, linked_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  perform app.assert_accreditation_enabled();

  if not app.can_accreditation_read(p_commission, (select auth.uid())) then
    return;
  end if;

  return query
  with links as (
    select el.*,
      (el.artifact_kind in ('case', 'ethics_procedure')
       and not app.can_read_case(el.artifact_id, v_uid)) as is_restricted
    from public.evidence_links el
    where el.commission_id = p_commission and el.standard_id = p_standard
  )
  select
    l.id,
    l.standard_id,
    l.artifact_kind,
    l.artifact_id,
    app.evidence_status_of(l.artifact_kind, l.artifact_id),
    case when l.is_restricted then 'Evidência restrita'
         else app.evidence_label_of(l.artifact_kind, l.artifact_id) end,
    case when l.is_restricted then null else l.note end,
    l.is_restricted,
    p.full_name,
    l.linked_at
  from links l
  left join public.profiles p on p.id = l.linked_by
  order by l.linked_at desc;
end;
$function$;

-- public.readiness_report  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_accreditation_read   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.readiness_report(p_commission uuid, p_framework uuid)
 RETURNS TABLE(standard_id uuid, standard_code text, standard_title text, level smallint, assessment_status text, evidence_valida bigint, evidence_atencao bigint, evidence_vencida bigint, evidence_restrita bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  perform app.assert_accreditation_enabled();

  if not app.can_accreditation_read(p_commission, (select auth.uid())) then
    return;
  end if;

  return query
  with links as (
    select el.standard_id,
      case
        when el.artifact_kind in ('case', 'ethics_procedure')
             and not app.can_read_case(el.artifact_id, v_uid)
          then 'restrita'
        else app.evidence_status_of(el.artifact_kind, el.artifact_id)
      end as bucket
    from public.evidence_links el
    where el.commission_id = p_commission
  )
  select
    s.id,
    s.code,
    s.title,
    s.level,
    sa.status,
    count(*) filter (where l.bucket = 'valida'),
    count(*) filter (where l.bucket = 'atencao'),
    count(*) filter (where l.bucket = 'vencida'),
    count(*) filter (where l.bucket = 'restrita')
  from public.accreditation_standards s
  join public.accreditation_frameworks f on f.id = s.framework_id
  left join public.standard_assessments sa
    on sa.standard_id = s.id and sa.commission_id = p_commission
  left join links l on l.standard_id = s.id
  where s.framework_id = p_framework
    and (f.owner_commission_id is null or f.owner_commission_id = p_commission)
  group by s.id, s.code, s.title, s.level, sa.status
  order by s."position";
end;
$function$;

-- public.suggest_carry_forward  (plpgsql, search_path=app, public, pg_catalog)  ->  app.can_charter_read   [bare=1 _for=0]
CREATE OR REPLACE FUNCTION public.suggest_carry_forward(p_commission uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_last_meeting uuid;
  v_agenda jsonb;
  v_actions jsonb;
begin
  perform app.assert_charters_enabled();

  if not app.can_charter_read(p_commission, (select auth.uid())) then
    raise exception 'você não é membro desta comissão' using errcode = 'HC0K2';
  end if;

  -- Most-recent held commission_default meeting of the commission.
  select id into v_last_meeting
  from public.meetings
  where commission_id = p_commission
    and held_at is not null
    and visibility_policy = 'commission_default'
  order by held_at desc
  limit 1;

  -- Agenda: unresolved items (resolution IS NULL) from that meeting.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title',          a.title,
        'description',    a.description,
        'sourceMeetingId', a.meeting_id
      ) order by a.position
    ) filter (where a.id is not null),
    '[]'::jsonb
  ) into v_agenda
  from public.meeting_agenda_items a
  where v_last_meeting is not null
    and a.meeting_id = v_last_meeting
    and a.resolution is null;

  -- Actions: open (non-terminal) meeting-sourced items across the commission's
  -- commission_default meetings, confidentiality-filtered per item.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',      ai.id,
        'title',   ai.title,
        'status',  s.key,
        'dueDate', ai.due_date
      ) order by ai.created_at
    ) filter (where ai.id is not null),
    '[]'::jsonb
  ) into v_actions
  from public.action_items ai
  join public.action_item_statuses s on s.id = ai.status_id
  join public.meetings m on m.id = ai.source_meeting_id
  where ai.commission_id = p_commission
    and ai.source_type = 'meeting'
    and m.commission_id = p_commission
    and m.visibility_policy = 'commission_default'
    and s.is_terminal = false
    and app.can_read_action_item(ai.id, v_uid);

  return jsonb_build_object(
    'agendaItems', v_agenda,
    'actionItems', v_actions
  );
end;
$function$;
-- ==========================================================================
-- PART 4 — the ONE hand-treated policy, per lead ruling L16.
--
-- `meeting_cases_select` is row 7's site (`commission.meetings.cases.shell.read`) but it composes
-- `app.can_reach_meeting`, which part 3 re-keyed to row 6's door (`app.can_meetings_read`) because
-- row 6 is the code that DECLARES that function. Letting it simply inherit would enforce row 6's
-- code at row 7's site and leave row 7's door with zero callers.
--
-- ⛔ SO ROW 7's DOOR IS ADDED AS AN EXPLICIT CONJUNCT, NOT SUBSTITUTED. The layer-1 gate is
-- already composed INSIDE `can_reach_meeting`, so there is no bare `is_member_of` here to replace;
-- substituting would have deleted row 6's reachability rule. Reading (ii) — that rows 6 and 7 share
-- one authorizer and row 7's door is a manifest defect — would merge two PO-approved rows and was
-- refused at the lead level.
--
-- OLD: (app.can_reach_meeting(meeting_id, (select auth.uid()))
--       AND (NOT app.is_case_respondent(case_id, (select auth.uid()))))
-- NEW: adds `app.can_meetings_cases_shell_read(meeting_id, (select auth.uid()))` between them.
-- ==========================================================================

alter policy meeting_cases_select on public.meeting_cases
  using (
    app.can_reach_meeting(meeting_id, (select auth.uid()))
    and app.can_meetings_cases_shell_read(meeting_id, (select auth.uid()))
    and not app.is_case_respondent(case_id, (select auth.uid()))
  );
-- ==========================================================================
-- PART 5 — C1: row 9's designated authority is WIRED, and its stale comment corrected.
--
-- `app.can_reach_case_on_member_surface` is row 9's re-key target (matrix 8.3) and has had ZERO
-- callers since its last production conjunct was dropped by 20260805000000 — measured
-- comment-stripped: 0 policies, 0 function bodies. Meanwhile the bit it names is tested INLINE at
-- exactly four sites. A layer-3 authorizer carrying a code as a greppable literal that nothing
-- calls satisfies the grep and enforces nothing (8.3's own words).
--
-- ⛔ THE FOUR INLINE COPIES ARE DELETED IN THIS SAME MIGRATION. A wired authority standing beside
-- four surviving inline copies of its own predicate is FIVE authorities, not one, and the next
-- reader cannot tell which one decides.
-- ⚠ Census witness: callers 0 -> 4.
-- ⚠ Two of the five objects converge off the frozen path on touch (ADR 0208 D4):
-- app.can_reach_case_on_member_surface and app.resolve_document_version_bytes. With part 3's 22
-- that is 419's baseline 860 -> 836.
-- ==========================================================================

-- The authority delegates to row 9's door, so the member-facing entry point its comment names
-- stays the thing callers use, and the door gains its callers through it.
create or replace function app.can_reach_case_on_member_surface(p_case_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select app.can_cases_deliberation_read(p_case_id, p_uid);
$fn$;
alter function app.can_reach_case_on_member_surface(uuid, uuid) owner to postgres;

-- ⛔ THE COMMENT IS CORRECTED, NOT LEFT. The live one claims it is "consumed by exactly one policy
-- (meeting_cases_select)" — which the live qual disproves — and warns against
-- `can_read_case_or_admin`, a predicate RETIRED by 20260814000000. A stale instruction beside a
-- dead authority (matrix 8.3).
comment on function app.can_reach_case_on_member_surface(uuid, uuid) is
  'ADR 0072 D2-8 / AE5 T7 — may p_uid see that this case is referenced, and its deliberation, on a '
  'MEMBER-FACING surface? Carries commission.cases.deliberation.read through '
  'app.can_cases_deliberation_read, whose residual arm is app.has_case_capability. '
  'CONSUMERS (wired by T7, census 0 -> 4): app._project_meeting_case, '
  'app._project_meeting_agenda_item, public.get_reserved_session_items, '
  'app.resolve_document_version_bytes. THIN PROJECTION of read_case_deliberation: the commission_default/explicit_grants_only split lives at the ONE site that has it by design (get_reserved_session_items), NOT in this body. Three further bodies compose the bit for other surfaces and are NOT consumers here - classification pending, see FUP-AE5-STAFF-THREE-BIT-TESTING-BODIES-UNCLASSIFIED. Use this on member-facing case-reach surfaces.';
-- ==========================================================================
-- PART 7 — C1 (L18): the four inline copies of row 9's bit are DELETED.
--
-- Each site tested `app.has_case_capability(<case>, <uid>, 'read_case_deliberation')`
-- inline while the DESIGNATED authority for that question had zero callers. After this
-- NO body tests the bit inline. ⚠ CENSUS AT BOTH GRAINS: 4 SITES / 5 CALL SITES —
-- `public.get_reserved_session_items` tests it three times.
--
-- ⛔ L18: `c.visibility_policy = 'commission_default'` is CARRIED THROUGH, not collapsed.
-- It is a RESOURCE-SHAPE condition on the session — the same class as row 7's
-- `NOT app.is_case_respondent` — so the template substitutes the authority where the BIT
-- is tested and leaves the shape condition standing. Collapsing the disjunction into the
-- authority would change a designated authority's meaning for its other three callers.
-- ==========================================================================

-- app._project_meeting_agenda_item  (plpgsql, search_path="")  — 1 call site(s) re-pointed at the authority
CREATE OR REPLACE FUNCTION app._project_meeting_agenda_item(r meeting_agenda_items, p_uid uuid)
 RETURNS meeting_agenda_items
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cases uuid[];
begin
  select array_agg(mc.case_id) into v_cases
  from public.meeting_cases mc where mc.agenda_item_id = r.id;

  if v_cases is null then
    return r;  -- not case-linked → member-wide, no masking
  end if;

  -- title (process number): propriety tier — hidden from a respondent of ANY
  -- linked case (he must not read his own process number).
  if exists (select 1 from unnest(v_cases) c where app.is_case_respondent(c, p_uid)) then
    r.title := null;
  end if;

  -- description / discussion_notes / resolution: substance tier — visible only
  -- with read_case_deliberation on EVERY linked case.
  --   ⭐ `description` joined this tier in the Gate-2 fix wave (MAJOR-1). It is
  --   PHI-BEARING by its own column comment and was the last unmasked free-text
  --   field on a case-linked agenda item.
  if exists (
    select 1 from unnest(v_cases) c
    where not app.can_reach_case_on_member_surface(c, p_uid)
  ) then
    r.description := null;
    r.discussion_notes := null;
    r.resolution := null;
  end if;

  return r;
end;
$function$;

-- app._project_meeting_case  (plpgsql, search_path="")  — 1 call site(s) re-pointed at the authority
CREATE OR REPLACE FUNCTION app._project_meeting_case(r meeting_cases, p_uid uuid)
 RETURNS meeting_cases
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- summary: substance tier — read_case_deliberation only.
  if not app.can_reach_case_on_member_surface(r.case_id, p_uid) then
    r.summary := null;
  end if;
  -- decision: outcome tier — any non-excluded reacher (already gated on reach by
  -- the caller). is_case_excluded hard-denies the respondent/recused.
  if app.is_case_excluded(r.case_id, p_uid) then
    r.decision := null;
  end if;
  return r;
end;
$function$;

-- app.resolve_document_version_bytes  (plpgsql, search_path=app, public, pg_catalog)  — 1 call site(s) re-pointed at the authority
CREATE OR REPLACE FUNCTION app.resolve_document_version_bytes(p_document_version_id uuid, p_rendition_kind text, p_uid uuid)
 RETURNS TABLE(file_object_id uuid, storage_bucket text, storage_path text, sensitivity_tier text, mime_type text, size_bytes bigint, document_id uuid, version_number integer, title text, created_by uuid, commission_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ver public.document_versions;
  v_doc public.documents;
  v_res public.securable_resources;
  v_file public.file_objects;
  v_case uuid;
begin
  if p_uid is null or not app.is_active(p_uid) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select * into v_ver from public.document_versions where id = p_document_version_id;
  if v_ver.id is null then
    raise exception 'versão de documento não encontrada' using errcode = 'P0002';
  end if;
  select * into v_doc from public.documents where id = v_ver.document_id;

  -- THE kernel — home access (incl. the M3 print arm) AND the D15 ceiling.
  -- Denial is byte-identical to absence (oracle-kill), and nothing below runs
  -- for a denied caller.
  if not app.can_read_document(v_doc.id, p_uid) then
    raise exception 'versão de documento não encontrada' using errcode = 'P0002';
  end if;

  select * into v_res from public.securable_resources where id = v_doc.home_resource_id;

  -- QO·B byte discrimination (P0-1): case- and interview-homed BYTES
  -- additionally require read_case_deliberation — conferred by every content
  -- source EXCEPT the S7 oversight arm. Metadata reach (the kernel, above) is
  -- deliberately WIDER: the reviewer keeps titles (M8), never bytes (M9). A
  -- distinct error is safe here — metadata visibility already discloses
  -- existence to every kernel-passing caller.
  v_case := case v_res.resource_type
    when 'case' then v_doc.home_resource_id
    when 'interview' then app.case_of_interview(v_doc.home_resource_id)
    else null
  end;
  if v_case is not null
     and not app.can_reach_case_on_member_surface(v_case, p_uid) then
    raise exception 'sem autorização para baixar este documento' using errcode = '42501';
  end if;

  -- DM4 byte discrimination (ADR 0119 D2, same pattern one home over):
  -- referral-homed BYTES require the PHI tier; the kernel above already
  -- granted metadata. Same 42501 reasoning — existence is already disclosed.
  if v_res.resource_type = 'case_referral'
     and not app.can_read_referral_phi(v_doc.home_resource_id, p_uid) then
    raise exception 'sem autorização para baixar este documento' using errcode = '42501';
  end if;

  if v_doc.status in ('disposal_pending', 'disposed') then
    raise exception 'documento descartado' using errcode = 'HC0DD';
  end if;
  if v_doc.status <> 'active' then
    raise exception 'documento indisponível' using errcode = 'HC0D8';
  end if;

  -- The ONE parameterized line. Everything above and below is identical for
  -- every rendition kind, which is exactly why this is shared rather than
  -- duplicated per door.
  select f.* into v_file
    from public.document_version_files vf
    join public.file_objects f on f.id = vf.file_object_id
   where vf.document_version_id = v_ver.id
     and vf.rendition_kind = p_rendition_kind
   order by vf.created_at desc
   limit 1;
  if v_file.id is null then
    raise exception 'arquivo ainda não disponível' using errcode = 'HC0D8';
  end if;
  if v_file.disposal_state <> 'none' then
    raise exception 'documento descartado' using errcode = 'HC0DD';
  end if;
  if v_file.upload_state not in ('clean', 'unscanned_accepted') then
    raise exception 'arquivo indisponível para download' using errcode = 'HC0D8';
  end if;

  return query select
    v_file.id, v_file.storage_bucket, v_file.storage_path, v_file.sensitivity_tier,
    v_file.mime_type, v_file.size_bytes,
    v_doc.id, v_ver.version_number, v_doc.title, v_doc.created_by,
    v_res.commission_id;
end;
$function$;

-- public.get_reserved_session_items  (plpgsql, search_path="")  — 2 call site(s) re-pointed at the authority
CREATE OR REPLACE FUNCTION public.get_reserved_session_items(p_meeting_id uuid)
 RETURNS TABLE(id uuid, closed_session_id uuid, case_id uuid, item_position integer, quorum_met boolean, started_at timestamp with time zone, ended_at timestamp with time zone, process_number integer, withdrawals text, substance text, decision text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid  uuid := (select auth.uid());
  v_comm uuid := app.commission_of_meeting(p_meeting_id);
begin
  -- C7/A8: no org arm. Reach is the only door.
  if not app.can_reach_meeting(p_meeting_id, v_uid) then
    return;  -- no reach → the reserved session is invisible
  end if;

  -- Rule 11: the reserved-session read is an audited meeting access (reuse
  -- 'meeting.viewed'; no new action — see Wave-2 audit ruling).
  perform public.log_audit_access(
    'meeting.viewed', 'meeting', p_meeting_id, v_comm,
    'Leitura da sessão reservada da reunião', '{}'::jsonb);

  return query
  select
    i.id,
    i.closed_session_id,
    i.case_id,
    i.position,
    i.quorum_met,                                            -- stub: reach
    -- propriety · times: A7 — the respondent sees NO times on his own case.
    -- Case-less (case_id IS NULL) → is_case_respondent is FALSE → times shown
    -- (A24·4; the stub must render for the reader list).
    case when not app.is_case_respondent(i.case_id, v_uid) then i.started_at end,
    case when not app.is_case_respondent(i.case_id, v_uid) then i.ended_at end,
    -- propriety · process number: case-linked AND not the respondent.
    case when i.case_id is not null
              and not app.is_case_respondent(i.case_id, v_uid)
         then c.case_number end,
    -- propriety · withdrawal names: case-linked, not respondent, and A26 —
    -- member-wide for commission_default; deliberation-gated for explicit_grants_only.
    case when i.case_id is not null
              and not app.is_case_respondent(i.case_id, v_uid)
              and (c.visibility_policy = 'commission_default'
                   or app.can_reach_case_on_member_surface(i.case_id, v_uid))
         then i.withdrawals end,
    -- substance: case-anchored → read_case_deliberation; case-less → reader list.
    case
      when i.case_id is null then
        case when exists (select 1 from public.meeting_closed_session_item_readers r
                          where r.item_id = i.id and r.user_id = v_uid)
             then i.substance end
      else
        case when app.can_reach_case_on_member_surface(i.case_id, v_uid)
             then i.substance end
    end,
    -- decision: case-anchored → NOT excluded; case-less → reader list.
    case
      when i.case_id is null then
        case when exists (select 1 from public.meeting_closed_session_item_readers r
                          where r.item_id = i.id and r.user_id = v_uid)
             then i.decision end
      else
        case when not app.is_case_excluded(i.case_id, v_uid)
             then i.decision end
    end
  from public.meeting_closed_session_items i
  join public.meeting_closed_sessions s on s.id = i.closed_session_id
  left join public.cases c on c.id = i.case_id
  where s.meeting_id = p_meeting_id
  order by s.opened_at, i.position;
end;
$function$;
