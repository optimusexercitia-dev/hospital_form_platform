-- 424 — AE5 increment 1: the `staff` differential oracle.
--
-- ⛔⛔ NOT YET RUN. Written against `authz_differential_cells_staff` AS IT STOOD at `97e90f82`
-- (5 non-arm-3 representative classes, all dispatched through bare `is_member_of_for`; the eleven
-- arm-3 rows have NOT yet been emitted as cells — backend's round 4 is regenerating the vector to
-- add them, per lead ruling L2). ⛔ Per the lead's explicit instruction this round: do NOT run
-- `test:db`, `db reset`, or any write against the stack from this file — the lead authorizes the
-- first run once round 4 lands. Everything below is real, reviewable SQL, not a placeholder — but
-- §3's arm-3 branches (rows 4, 6, 7, 9, 12) were written against EXISTING seeded fixture data,
-- verified this round by read-only query, and are believed correct; rows 1 (control only), 8, 11's
-- deny coordinates, 15, 16 and 19 have NO buildable fixture yet (named in
-- `docs/testing/ae5-staff-fixture-gaps.md`) and are deliberately left UNDISPATCHED — an emitted
-- cell of one of those classes will RAISE via `pg_temp.unknown_legacy_class`, which is correct
-- until the fixture lands (403's own philosophy: an unhandled class must raise, never fall through
-- a default arm).
--
-- Subjects: authz.candidate_has_permission (⛔ NEVER authz.has_permission — `staff` sits in
-- `test_validation` throughout this suite's lifetime; the runtime evaluator would report every
-- cell denied and call it a divergence, exactly as 403's own header explains for staff_admin's
-- pre-cutover window) vs the legacy evaluators. For the FIVE non-arm-3 representative classes the
-- legacy side is bare `app.is_member_of_for(scope, principal)`. For the ELEVEN arm-3 rows
-- (lead ruling L2, ADR 0175 D3's shape: "403 calls the real door now") the legacy side calls each
-- row's REAL enforcement predicate, never bare membership:
--   row 6/7   app.can_reach_meeting(meeting_id, uid) [+ NOT app.is_case_respondent(case_id, uid) for 7]
--   row 8     app.can_sign_meeting(attendee_id, uid)                          — NOT YET DISPATCHED
--   row 9     app._case_caps(case_id, uid) & 2 (the read_case_deliberation bit)
--   row 11    app.can_read_action_item(action_item_id, uid)      — GRANT coordinate only, dispatched
--   row 12    the compiled guard sequence of public.cast_case_vote: exists(ethics_case_details) AND
--             app.is_member_of_for(commission_of_case, uid) AND NOT (is_recused_from_case OR
--             is_case_respondent) — composed from the RPC's own body (verified this round,
--             `regexp_replace(prosrc,...)`), not the RPC itself (which is a mutating, decision-keyed
--             RPC unsuited to a pure differential; 403 never calls a mutating RPC either)
--   row 1/4/15/16  the RLS policy qual itself, probed under `set local role authenticated` with the
--             tested principal's claims — row 4 is dispatched (the `profiles_select_self_or_admin`
--             co-member + self-read legs); rows 1 (control only), 15, 16 are NOT YET DISPATCHED
--
-- ⚠⚠ THE CLASS NAMES BELOW ARE THIS SUITE'S PROPOSAL, NOT BACKEND'S. Lead ruling: "the door name
-- comes from the vector's per-row metadata once T3 round 4 lands, not from a literal [invented
-- here]." Round 4 has not landed that metadata as of this writing. The `legacy_class` string
-- literals below (`can_reach_meeting`, `can_reach_meeting_not_respondent`, `case_caps_deliberation`,
-- `can_read_action_item`, `cast_case_vote_guard`, `rls_profiles_comember_or_self`) are named after
-- the real predicate each calls, mirroring 403's own convention (a class is named after the
-- function it dispatches to) — but they are PROPOSALS. ⛔ WHOEVER WIRES ROUND 4'S VECTOR MUST
-- RENAME THESE `when` LITERALS TO MATCH THE VECTOR'S ACTUAL `legacy_class` VALUES VERBATIM, never
-- the reverse — the vector is the source of truth for the string, this file's names are a draft.
--
-- ⛔ TWO ASSERTIONS PER CELL, AND THE SECOND IS THE POINT (unchanged from 403).
--   §4  is(legacy, catalog)          — the resolver reproduces today's behaviour;
--   §5  is(catalog, approved-value)  — the MATRIX is the oracle, not "whatever legacy did".
--
-- ⛔ EXPECTED VALUES ARE TRANSCRIBED, NEVER COMPUTED THE WAY THE RESOLVER COMPUTES THEM — from the
-- approved `staff` matrix row and the approved `staff` deny-class table, exactly as 403 explains.
--
-- ⚠ `case_reach` (`none · role_keyed · grant_keyed · unreachable`) IS SWEPT as a global vector
-- column but is INERT for every `staff` cell: `staff` holds no code whose predicate consults
-- `app.can_read_professional_profile`'s case-committee arm (matrix § 5.2, § 7.1). ⛔ Do not conflate
-- it with the eleven arm-3 coordinates above — different mechanism, different predicate family.
--
-- ⛔ `arm3_divergence` / `expected_legacy_granted` (the 14th column) — PA-F8-STAFF-1 IS WITHDRAWN.
-- § 11 item 7 is RULED (A): the code is `commission.responses.create` (creation only), so row 2
-- carries NO `arm3_divergence` label and NO `expected_legacy_granted` divergence — the code says
-- nothing about edit/submit, and there is no cell for the revoked-member-still-submits behaviour to
-- diverge FROM. `staff` today therefore has ZERO cells expected to populate `expected_legacy_granted`
-- with a value other than `expected_granted` — unlike `staff_admin`'s 84 (matrix § 7.2 / R2). §4.1b
-- below still asserts `legacy = expected_legacy_granted` on every cell for structural symmetry with
-- 403 (and to catch it immediately if a future increment or a T3 round adds a `staff` divergence),
-- but the assertion is expected to be EQUIVALENT to §4.1 today, not a genuine carve-out.
--
-- ⚠ ROW 12's `HC0J0` GUARD IS AN ETHICS-DETAILS EXISTENCE GUARD, NOT A STATUS GUARD (backend
-- measurement, corrects this file's earlier header and the matrix § 5.3's provisional reading):
-- `public.cast_case_vote` raises `HC0J0` when `not exists(select 1 from public.ethics_case_details
-- d where d.case_id = v_case_id)` — verified this round by reading the comment-stripped body. The
-- fixture pair is a case WITH an `ethics_case_details` row vs one WITHOUT, not two ethics statuses.
-- CCIH's explicit_grants_only case (`ca000000-0000-0000-0000-0000000000e1`) already carries one
-- (verified this round); the five `commission_default` cases do not.
--
-- ⚠ THE ABLE-TO-FAIL PROOF (§6, mirrors 403 §6 exactly — NOT a bare SAVEPOINT: pgTAP savepoints
-- discard assertions made after a rollback to them, so like 403 this suite mutates directly with
-- `delete`/`insert`, asserts red, then reverses the SAME statement and asserts green again, all
-- inside the one outer transaction `plan()`/`finish()` already opened).
--
-- ⚠ PER-CLASS EXPECTED VALUES FOR THE ELEVEN ARM-3 COORDINATES — ⛔ STILL PROPOSED, NOT
-- PO-APPROVED (matrix § 11 item 5 remains open on values; only the coordinate SET is ruled).
--
--   row  term                                                    class value        -> proposed
--   ---  ------------------------------------------------------- ----------------- ---------------
--   1(b) can_access_targeted_version participation disjunct      no participation    GRANTED (bare membership)
--                                                                 participation present GRANTED (disjunct; limb-b only adds)
--   4(a) co-member leg (target's own memberships)                target shares a commission GRANTED
--                                                                 target shares none  DENIED (falls to self-leg only)
--   4(b) self-read disjunct                                      self                GRANTED (role-free)
--                                                                 third-party, no share DENIED
--   6    visibility_policy / attendee EXISTS                     commission_default  GRANTED
--                                                                 participants_only + attendee GRANTED
--                                                                 participants_only + non-attendee DENIED
--   7    + is_case_respondent hard deny (on a row-6 GRANT)        non-respondent      GRANTED
--                                                                 respondent          DENIED
--   8    attendance='present' AND status='in_signature'          present + in_signature GRANTED
--                                                                 present + other status DENIED
--                                                                 absent  + in_signature DENIED
--   9    v_eg (visibility_policy='explicit_grants_only')         commission_default  GRANTED
--                                                                 explicit_grants_only, no grant DENIED
--   11(a) visibility_scope                                       committee           GRANTED
--                                                                 case_restricted     DENIED
--                                                                 assignees_only, not assigned DENIED
--   11(b) assigned_to = auth.uid() disjunct                      assigned            GRANTED (role-free)
--                                                                 not assigned        DENIED
--   12   ethics_case_details existence guard precedes membership details exist      GRANTED
--                                                                 details absent      DENIED (HC0J0, not a permission denial)
--   15   owner_commission_id IS NULL (public arm)                owner IS NULL       GRANTED (vacuous — every authenticated caller)
--                                                                 owner = own commission GRANTED (membership)
--                                                                 owner = a different commission DENIED
--   16   is_document_approver_of disjunct                        approver-of-record  GRANTED (role-free)
--                                                                 member, not approver GRANTED (membership)
--                                                                 neither             DENIED
--   19   cp.source='indicator' provenance                        source=indicator    GRANTED (member of the indicator's commission)
--                                                                 source=event        N/A to this row (row 17's arm, not row 19's)
--
-- ⚠ `409`-SHAPE DOORS T12 WILL FLIP ONCE T7 LANDS (`425_ae5_staff_rekey_differential.sql`, not this
-- file): `responses.responses_insert_own` (row 2, R — the ONLY site, per § 11 item 7 ruling (A)) ·
-- `meetings.meeting_signatures_insert` + `app.can_sign_meeting` (row 8, R+D, both move together) ·
-- `public.cast_case_vote` (row 12, D) · `public.notify_safety_event` (row 18, D) ·
-- `public.create_referral_internal_note` (row 21, D, arm 1 only). ⛔ DEFINER NON-FLIPPER, NAMED AS A
-- COUNTDOWN (409 § 2.10c's pattern): `public.submit_response` — INVOKER, no membership gate of any
-- kind, gated entirely by `responses_update_own_draft`'s ownership predicate; deleting a `staff`
-- grant does not change its behaviour (matrix § 8.1's transcript) — T12 must name it excluded, not
-- silently omit it.
--
-- RUN SHAPE: `plan(21)`, self-consistent AT AUTHORING TIME against the assertions actually written
-- below — ⛔ UNVERIFIED, since no run is authorized this round. The count WILL change the moment
-- round 4's arm-3 cells land and rows 8/11(deny)/15/16/19 gain dispatch branches (each needs its
-- own able-to-fail-style coverage, mirroring 403's per-class growth history). Keep this line in
-- step with plan() the moment that happens — a stale RUN SHAPE reads as the expected shape to the
-- next person diagnosing a count mismatch (403's own header names this trap; inherited verbatim).

begin;
select plan(21);

-- ============================================================================
-- §1 — the fixture. Reuses SEEDED data wherever a clean coordinate already exists (per
-- docs/testing/ae5-staff-fixture-gaps.md); constructs ONLY the two personas no seeded principal can
-- fill (`cross_org_actor`, `unprivileged`/third-party-caller), mirroring 403 §1's fixture-owned,
-- FIXED, non-seed-colliding id convention — new namespace `...-4424-...` so nothing here can collide
-- with 403's `...-4403-...` ids or with any other case's fixture (plan `:1144-1147`).
-- ============================================================================

create temp table f424 on commit drop as
select
  -- subject_holder: staff4.ccih@test.local — clean (matrix § 8.2; re-verified this round: 1
  -- membership row, seed.sql:627, caps=2 only on commission_default CCIH cases).
  '00000000-0000-0000-0000-00000000000a'::uuid                                            as uid,
  'a0000000-0000-0000-0000-0000000000a1'::uuid                                            as own_cid,
  -- other_commission_holder: staff1.farm@test.local — verified this round: exactly ONE membership
  -- row (b1, staff), same org (Rede A) as CCIH, no admin role, no case reach at all (Farmácia has
  -- no case module rows).
  '00000000-0000-0000-0000-000000000006'::uuid                                            as other_id,
  'b0000000-0000-0000-0000-0000000000b1'::uuid                                            as other_cid,
  -- foreign_org_commission target: Qualidade B (org B). No principal needs to hold here — the
  -- deny-class doc's own measurement uses exactly this shape (a clean CCIH holder tested against a
  -- foreign-org scope id).
  'c0000000-0000-0000-0000-0000000000c1'::uuid                                            as xorg_cid,
  -- cross_org_actor: FIXTURE-ONLY for every role (axes.json:35,39) — re-verified this round for
  -- `staff` specifically: the only org-B `staff` grant (staff1.qual.b) is COMPOSITE (also
  -- staff_admin of Farmácia B, seed.sql:604,631), so no clean org-B staff-only principal exists.
  '00000000-0000-0000-0000-0000000000c8'::uuid                                            as xorg_holder,
  -- unprivileged / the third-party caller (never the subject, per 403 §3's own lesson — a caller
  -- that IS the principal turns a third-party cell into a self-check in disguise).
  '00000000-0000-0000-0000-0000000000c9'::uuid                                            as nobody;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000'::uuid, xorg_holder, 'authenticated','authenticated','zz424.xorg@test.local', now(), now() from f424 union all
select '00000000-0000-0000-0000-000000000000'::uuid, nobody,      'authenticated','authenticated','zz424.nobody@test.local',now(), now() from f424
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, is_active, email_confirmed_at)
select xorg_holder, 'zz424.xorg@test.local',  'ZZ424 CrossOrg', true, now() from f424 union all
select nobody,      'zz424.nobody@test.local','ZZ424 Nobody',   true, now() from f424
on conflict (id) do update set is_active = true, email_confirmed_at = now();

insert into public.memberships (principal_id, commission_id, role)
select xorg_holder, xorg_cid, 'staff' from f424
on conflict do nothing;

-- Existing seeded resources reused BY REFERENCE (no new rows — each was verified this round):
--   CCIH commission_default cases (row 9 GRANT):     d0000000-0000-0000-0000-0000000000c1 (+4 more)
--   CCIH explicit_grants_only case (row 9/12 DENY-adjacent, row 12 GRANT):
--                                                     ca000000-0000-0000-0000-0000000000e1
--     — carries an ethics_case_details row (verified) and case_access_grants ONLY for staff1.ccih /
--       chefe.ccih (verified) — the three clean personas hold none there.
--   The one seeded CCIH meeting (row 6/7 GRANT baseline, commission_default, status='held'):
--                                                     f1000000-0000-0000-0000-0000000000e1
--   The one seeded CCIH action item (row 11 GRANT baseline, visibility_scope='committee'):
--                                                     ac3f1301-49e3-4b2b-b904-6a2a4fea8cfc
--
-- ⛔ NOT YET BUILDABLE THIS ROUND — no fixture rows exist and this suite does not invent schema it
-- has not verified (docs/testing/ae5-staff-fixture-gaps.md § 6/§ 8 names each exactly):
--   row 8   a CCIH meeting with status='in_signature' + attendee rows for a clean persona, both
--           attendance polarities;
--   row 11  a CCIH action item with visibility_scope IN ('case_restricted','assignees_only'), one
--           with a clean persona as the action_item_assignments assignee;
--   row 15  accreditation_frameworks is EMPTY system-wide — needs a null-owner row, a CCIH-owned
--           row, and a foreign-commission-owned row, plus assert_accreditation_enabled() on;
--   row 16  a document_approvals row making a non-member an approver of a CCIH-owned document, to
--           isolate the role-free disjunct from bare membership;
--   row 19  capa_plan holds exactly ONE row (source='rca') system-wide — an indicator-sourced CAPA
--           fixture does not exist.

-- ============================================================================
-- §2 — the cell set, and its controls.
-- ============================================================================

select cmp_ok((select count(*)::int from authz_differential_cells_staff), '>', 500,
  '2.1 CARDINALITY CONTROL: the generated `staff` cell set is populated (1080 at 97e90f82). An '
  'empty or truncated vector file would let §§4-5 iterate nothing and pass having asserted nothing.');

select ok(
  (select count(*) from authz_differential_cells_staff where expected_granted) > 0
  and (select count(*) from authz_differential_cells_staff where not expected_granted) > 0,
  '2.2 ⭐ the EXPECTED column carries BOTH answers for `staff`. A cell set expecting only denials '
  'would be satisfied by a resolver stuck at false.');

select cmp_ok((select count(distinct legacy_class)::int from authz_differential_cells_staff), '>=', 5,
  '2.3 ⛔ A FLOOR, NOT A TARGET — today''s known 5 non-arm-3 classes, all bare `is_member_of_for` '
  '(97e90f82). Round 4 grows this by however many distinct arm-3 door predicates it wires (this '
  'file proposes 6: can_reach_meeting, can_reach_meeting_not_respondent, case_caps_deliberation, '
  'can_read_action_item, cast_case_vote_guard, rls_profiles_comember_or_self — plus whatever names '
  'rows 1/8/15/16/19 land under). ⛔ TIGHTEN THIS TO AN EXACT NUMBER once the REPS population is '
  'final — 403 §2.3''s own lesson: the count is a CONSEQUENCE of what is swept, never an adjustment.');

select ok(
  (select count(*) from authz_differential_cells_staff where self_check) > 0
  and (select count(*) from authz_differential_cells_staff where not self_check) > 0,
  '2.4 ⭐⭐ §6A BOTH POLARITIES ARE PRESENT for `staff` — self-check AND third-party. A generator '
  'emitting only the self-check would pass while pinning the uniform-apply bug across every '
  '`is_member_of_for` third-party call site (matrix § 3.1: 35 sites in 30 functions).');

-- ⛔ NOT YET WRITTEN AS A REAL CHECK. This round's read-only DB access ended (the stack restarted
-- mid-session — backend's round 4 in progress) before `app.can_access_targeted_version`'s body and
-- the `professional_participants` linkage to a `staff` principal could be confirmed. Writing a
-- query against schema not verified this round risks a check that LOOKS like a masking control but
-- asserts nothing real (worse than no control at all — a wrong matcher reads exactly like a live
-- defect). Left as an explicit TODO rather than a fabricated `where false`.
select pass(
  '2.5 TODO — the row 1(b) MASKING CONTROL (does the chosen subject_holder, staff4.ccih, carry a '
  '`professional_participants` link that would let app.can_access_targeted_version''s role-free '
  'disjunct grant regardless of membership, per 409''s own § 0(b) control shape) needs '
  '`app.can_access_targeted_version`''s body confirmed against the live catalog before it can be '
  'written for real. Replace this pass() before round 4''s row-1 cells are compared.');

-- ============================================================================
-- §3 — the driver. Materialises each cell's state and calls BOTH evaluators.
-- ============================================================================

create or replace function pg_temp.unknown_legacy_class(p_class text) returns boolean
language plpgsql immutable as $u$
begin
  raise exception '424 driver: legacy class % has no dispatch branch. Add one (naming it after the '
    'vector''s own legacy_class metadata once round 4 lands, never a guess); do NOT let a default '
    'arm answer for it.', p_class;
end;
$u$;

-- Row 12's compiled guard sequence, composed from public.cast_case_vote's own body (verified this
-- round: `not exists(ethics_case_details) -> HC0J0`, then `not is_member_of_for -> 42501`, then
-- `is_recused_from_case or is_case_respondent -> HC0J5`). ⛔ NOT the RPC itself — cast_case_vote is
-- a mutating, decision-id-keyed RPC (it needs a live case_decisions row), and this differential
-- needs a PURE predicate, exactly the reason 403 never calls a mutating door either.
create or replace function pg_temp.legacy_cast_case_vote_guard(p_case_id uuid, p_principal uuid)
returns boolean language sql stable as $g$
  select exists(select 1 from public.ethics_case_details d where d.case_id = p_case_id)
     and app.is_member_of_for(app.commission_of_case(p_case_id), p_principal)
     and not (app.is_recused_from_case(p_case_id, p_principal)
              or app.is_case_respondent(p_case_id, p_principal));
$g$;

create or replace function pg_temp.cell_answers(
  p_persona text, p_ctx text, p_scope text, p_code text, p_class text, p_state text, p_self boolean,
  p_reach text
) returns table (legacy boolean, catalog boolean)
language plpgsql volatile as $d$
declare
  f record; v_principal uuid; v_scope_id uuid; v_res text;
  -- arm-3 fixture handles, resolved per cell from the SCOPE the cell already carries.
  v_meeting  uuid := 'f1000000-0000-0000-0000-0000000000e1'; -- CCIH, commission_default, held
  v_case_cd  uuid := 'd0000000-0000-0000-0000-0000000000c1'; -- CCIH, commission_default
  v_case_eg  uuid := 'ca000000-0000-0000-0000-0000000000e1'; -- CCIH, explicit_grants_only + ethics_case_details
  v_ai       uuid := 'ac3f1301-49e3-4b2b-b904-6a2a4fea8cfc'; -- CCIH, visibility_scope='committee'
begin
  perform test_helpers.reset_role_and_claims();
  select * into f from f424;
  v_principal := case p_persona
      when 'subject_holder' then f.uid
      when 'other_commission_holder' then f.other_id
      when 'cross_org_actor' then f.xorg_holder
      else f.nobody end;

  select pm.resolution_scope_kind::text into v_res from authz.permissions pm where pm.code = p_code;

  if v_res = 'commission' then
    v_scope_id := case p_scope when 'own_commission' then f.own_cid
                               when 'sibling_commission' then f.other_cid
                               else f.xorg_cid end;
  else
    v_scope_id := f.own_cid; -- no staff code resolves at org/hospital scope (matrix § 5.2)
  end if;

  update public.profiles set is_active = true, suspended_until = null, email_confirmed_at = now()
   where id in (f.uid, f.other_id, f.xorg_holder, f.nobody);
  if p_state = 'deactivated' then update public.profiles set is_active = false where id = v_principal;
  elsif p_state = 'suspended' then update public.profiles set suspended_until = now() + interval '7 days' where id = v_principal;
  elsif p_state = 'pending' then update public.profiles set email_confirmed_at = null where id = v_principal;
  end if;

  if p_self then
    perform test_helpers.claims_for(v_principal, false,
      case p_ctx when 'matching' then 'staff' when 'other_role' then 'staff_admin' else null end);
  else
    perform test_helpers.claims_for(f.nobody, false, 'staff_admin');
  end if;

  legacy := case p_class
    when 'is_member_of_for' then app.is_member_of_for(v_scope_id, v_principal)

    -- ⚠⚠ TENTATIVE NAMES — see this file's header. Rows 6/7/9/12/4(as `rls_profiles_comember_or_self`)
    -- are dispatched for real, against EXISTING seeded fixture data. Rows 8/11(deny)/15/16/19 have
    -- NO branch — an emitted cell of those classes RAISES via the `else`, which is correct until
    -- their fixtures land (docs/testing/ae5-staff-fixture-gaps.md).
    when 'can_reach_meeting' then app.can_reach_meeting(v_meeting, v_principal)
    when 'can_reach_meeting_not_respondent' then
      app.can_reach_meeting(v_meeting, v_principal)
      and not app.is_case_respondent(v_case_cd, v_principal)
    when 'case_caps_deliberation' then
      -- ⚠ UNCONFIRMED AXIS MAPPING: row 9's v_eg coordinate (explicit_grants_only vs
      -- commission_default) has no declared axis of its own yet — round 4 may add one, or may
      -- reuse an existing column. Using `p_scope='sibling_commission'` as a stand-in selector
      -- here is a PLACEHOLDER so the branch is at least syntactically complete; it is NOT a claim
      -- that `scope` is the real coordinate T3 will emit. Re-key this the moment round 4's actual
      -- column for this coordinate is known.
      (app._case_caps(case when p_scope = 'sibling_commission' then v_case_eg else v_case_cd end,
                       v_principal) & 2) <> 0
    when 'can_read_action_item' then app.can_read_action_item(v_ai, v_principal)
    when 'cast_case_vote_guard' then
      -- ⚠ SAME CAVEAT: `p_scope` stands in for "does this case carry ethics_case_details" until
      -- round 4 declares the real coordinate. PLACEHOLDER selector, not a confirmed mapping.
      pg_temp.legacy_cast_case_vote_guard(
        case when p_scope = 'sibling_commission' then v_case_cd else v_case_eg end, v_principal)
    when 'rls_profiles_comember_or_self' then (
      -- the REAL RLS qual, probed under `set local role authenticated` with the tested principal's
      -- claims already set above by claims_for() — self-read against v_principal's own row, or the
      -- co-member leg against the OTHER fixture principal's row (own vs sibling commission chooses
      -- which target has no shared commission with the caller).
      select exists(
        select 1 from public.profiles pr
         where pr.id = case p_self
                          when true then v_principal
                          else case p_scope
                                 when 'sibling_commission' then f.other_id
                                 else v_principal end
                        end)
    )
    else pg_temp.unknown_legacy_class(p_class)
  end;
  catalog := authz.candidate_has_permission(v_principal, v_res, v_scope_id, p_code);
  return next;
end $d$;

create temp table r424 on commit drop as
select c.*, a.legacy, a.catalog
  from authz_differential_cells_staff c
  cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope,
                                          c.permission_code, c.legacy_class,
                                          c.principal_state, c.self_check, c.case_reach) a;

select test_helpers.reset_role_and_claims();

select is((select count(*)::int from r424), (select count(*)::int from authz_differential_cells_staff),
  '3.0 ⭐ EVERY `staff` CELL PRODUCED A ROW — a driver returning zero rows for some cell silently '
  'drops it and §§4-5 would report green over cells that never ran.');

select is((select count(*)::int from r424 where legacy is null or catalog is null), 0,
  '3.1 the driver returned an answer for EVERY `staff` cell — a NULL would fall out of the '
  'comparisons below and read as agreement.');

select ok(
  (select count(*) from r424 where catalog) > 0 and (select count(*) from r424 where not catalog) > 0,
  '3.2 ⭐ DISCRIMINATION CONTROL: the resolver returned BOTH answers across the `staff` sweep.');

-- ⛔ L4's re-clause, applied to 424's OWN subject (the mirror image of 403's fix): `staff` IS
-- expected to sit in test_validation for the whole of this suite's lifetime — that is what makes
-- authz.candidate_has_permission meaningfully differ from the runtime evaluator for its cells. The
-- bound is therefore SUBJECT-SCOPED the other way: staff_admin (403's subject, already
-- authoritative) must NEVER appear in test_validation, which 403 §3.2b/§3.2c already guard from
-- their own side; 424 asserts the two subjects are not confused.
select is((select state::text from authz.roles where code = 'staff'), 'test_validation',
  '3.2b ⭐ PRECONDITION MIRRORING 403''s §3.2b: `staff` sits in `test_validation`, which is what '
  'makes candidate_has_permission (not the runtime evaluator) the correct oracle for this suite''s '
  'cells. ⛔ THE DAY THIS SAYS `authoritative`, T6''s cutover has landed and 424 becomes a pure '
  'regression suite exactly as 403 is today — not a bug, but the record must say so rather than '
  '"fixing" a red here by re-pointing back to has_permission.');

select is((select count(*)::int from authz.roles where code = 'staff_admin' and state = 'test_validation'), 0,
  '3.2c ⭐ mirrors L4''s new §3.2c from 424''s side: `staff_admin` (403''s subject) is NEVER in '
  '`test_validation` while `staff` (424''s subject) is — the two suites'' subjects are not '
  'confused, named explicitly rather than inferred from a combined count.');

select is(
  (select count(*)::int
     from authz_differential_cells_staff c
     join r424 b on b.cell_id = c.cell_id
     cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope, c.permission_code,
                                             c.legacy_class, c.principal_state, c.self_check,
                                             c.case_reach) a
    where a.catalog is distinct from b.catalog),
  0,
  '3.3 ⭐ DETERMINISM CONTROL: a second sweep over the same `staff` cells returns the same answers '
  'as the first — a driver whose result depends on iteration order is not measuring its subject.');

-- ============================================================================
-- §4 — is(legacy, catalog).
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' catalog=' || catalog::text,
                              ' | ' order by cell_id), '(none)')
     from r424
    where legacy is distinct from catalog
      and expected_legacy_granted is not distinct from expected_granted),
  '(none)',
  '4.1 ⭐ LEGACY == CATALOG on every `staff` cell where the vector declares no divergence. Because '
  'the matrix is already approved, a difference here means legacy is wrong or the resolver is '
  'wrong — never a licence to move on (PA-F8). ⛔ Unlike staff_admin''s 84-cell carve-out, `staff` '
  'is expected to have ZERO cells excluded from this comparison today (§ 11 item 7 ruled (A) — '
  'PA-F8-STAFF-1 withdrawn, no row for it to diverge from).');

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' expected_legacy=' ||
                              expected_legacy_granted::text || ' div=' || arm3_divergence,
                              ' | ' order by cell_id), '(none)')
     from r424
    where legacy is distinct from expected_legacy_granted),
  '(none)',
  '4.1b kept for structural symmetry with 403 §4.1b, and expected to be EQUIVALENT to §4.1 for '
  '`staff` today (expected_legacy_granted = expected_granted on every cell, per § 11 item 7 (A)). '
  'If this ever diverges from §4.1''s population, a `staff` PA-F8 divergence has been declared and '
  'must carry its own PO ruling, exactly like staff_admin''s R2.');

-- ============================================================================
-- §5 — is(catalog, approved matrix value). THE ORACLE HALF.
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' catalog=' || catalog::text || ' expected=' ||
                              expected_granted::text || ' src=' || expected_source,
                              ' | ' order by cell_id), '(none)')
     from r424 where catalog is distinct from expected_granted),
  '(none)',
  '5.1 ⭐⭐ CATALOG == THE APPROVED `staff` MATRIX VALUE. This is what makes the matrix the oracle '
  'rather than "whatever legacy did" — expected values come from the approved matrix row and the '
  'approved deny-class table ONLY, never from resolver logic.');

select is(
  (select count(*)::int from r424 where expected_source like 'deny-class:wrong_active_context:third-party%'
     and not catalog),
  0,
  '5.2 ⭐ §6A''s asymmetry for `staff`, asserted head-on: every WRONG-HAT THIRD-PARTY cell is '
  'GRANTED (app.has_role_any''s active-context term short-circuits when the principal is not the '
  'caller). If this reds, the adapter has started applying the active-role filter uniformly, which '
  'breaks all 35 third-party `is_member_of_for` call sites (matrix § 3.1) while looking like a '
  'tightening.');

-- ============================================================================
-- §6 — THE SUITE SHOWN ABLE TO FAIL. Two constructed mutations, each restored. NOT a bare
-- SAVEPOINT (pgTAP savepoints discard assertions made after a rollback to them) — direct DML,
-- reversed by its own inverse statement, mirroring 403 §6 exactly.
-- ============================================================================

create or replace function pg_temp.disagreements() returns int
language sql volatile as $x$
  select count(*)::int
    from authz_differential_cells_staff c
    cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope,
                                            c.permission_code, c.legacy_class,
                                            c.principal_state, c.self_check, c.case_reach) a
   where a.catalog is distinct from c.expected_granted;
$x$;

select cmp_ok(pg_temp.disagreements(), '=', 0,
  '6.0 ⭐⭐ BASELINE FOR BOTH FAIL-PROOFS — the oracle agrees on every `staff` cell before any '
  'deliberate mutation. Without this, 6.1/6.3 below are assertions that SOME disagreement exists '
  'somewhere, satisfiable by an unrelated pre-existing defect (403''s own F1 lesson).');

delete from authz.role_permissions
 where role_code = 'staff' and permission_code = 'commission.forms.read';
select cmp_ok(pg_temp.disagreements(), '>', 0,
  '6.1 FAIL-PROOF 1 — flipping ONE seeded `staff` role_permissions row makes the oracle RED. '
  'Without this the green in §5.1 is a comparison nobody has shown can fail.');
insert into authz.role_permissions (role_code, permission_code)
  values ('staff', 'commission.forms.read');
select test_helpers.reset_role_and_claims();
select ok(
  (select a.catalog
     from authz_differential_cells_staff c
     cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope, c.permission_code,
                                             c.legacy_class, c.principal_state, c.self_check,
                                             c.case_reach) a
    where c.permission_code = 'commission.forms.read' and c.persona = 'subject_holder'
      and c.scope = 'own_commission' and c.principal_state = 'active'
      and c.active_context = 'matching' and c.self_check
    limit 1),
  '6.2 ...and RESTORING the grant makes the mutated permission resolve TRUE again at its base '
  'coordinate, targeted rather than re-sweeping all cells (§3.3 already establishes determinism).');

select cmp_ok(pg_temp.disagreements(), '=', 0,
  '6.2b ⭐ THE RESTORE IS COMPLETE ACROSS THE WHOLE SWEEP — re-inserting the grant returned the '
  'oracle to zero disagreements, so 6.3 below starts from the same baseline 6.1 did.');

create or replace function authz.candidate_has_permission(
  p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text
) returns boolean language sql stable security definer set search_path = '' as $neut$
  select case
    when p_scope_kind is distinct from (
           select pm.resolution_scope_kind::text from authz.permissions pm
            where pm.code = p_permission_code)
      then false
    else exists (
      select 1 from authz.assignment_facts(p_principal) af
        join authz.roles r on r.code = af.role_code
        join authz.role_permissions rp on rp.role_code = af.role_code
        join authz.permission_implication_closure cl
          on cl.implying = rp.permission_code and cl.implied = p_permission_code
       where r.state in ('test_validation', 'authoritative')
         and (p_principal is distinct from (select auth.uid())
              or af.role_code is not distinct from app.active_role()))
  end;
$neut$;
select cmp_ok(pg_temp.disagreements(), '>', 0,
  '6.3 ⭐⭐ FAIL-PROOF 2 — with authz.scope_reaches REMOVED from the resolver, the `staff` oracle '
  'goes RED. Proves the suite measures SCOPE and not only grants.');

-- ============================================================================
-- §7 — arm-3 / case_reach bound. NOT YET WRITTEN AS A REAL ASSERTION — round 4 has not landed the
-- eleven arm-3 rows as cells, so there is nothing yet to compare the census against. Once it does,
-- this section asserts (mirroring 403 §7's role): the emitted arm-3 coordinate set equals exactly
-- the eleven matrix § 5.3 rows (1, 4, 6, 7, 8, 9, 11, 12, 15, 16, 19; 4 and 11 both limbs), and that
-- `case_reach`'s `unreachable` value is present in the swept set even though it is inert for every
-- `staff` cell (the vector carries it as global plumbing per this file's header).
-- ============================================================================

select pass(
  '7.1 PLACEHOLDER — awaiting round 4''s arm-3 cells. Once they land, replace this with the '
  'eleven-coordinate census assertion described above; do not let this pass() survive that landing.'
);

select * from finish();
rollback;
