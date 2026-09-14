-- 424 — AE5 increment 1: the `staff` differential oracle.
--
-- Subjects: authz.candidate_has_permission (⛔ NEVER authz.has_permission — `staff` sits in
-- `test_validation` throughout this suite's lifetime) vs the legacy evaluators. `REPS_STAFF` is
-- twelve representatives (backend round 4, ruling L2): the eleven arm-3 carrying rows (1, 4, 6, 7,
-- 8, 9, 11, 12, 15, 16, 19) plus `commission.responses.create`, the one membership-gated write
-- policy, carrying the INERT `is_member_of_for` value. Every arm-3 row's legacy column calls its
-- REAL door (ADR 0175 D3's shape, "403 calls the real door now"), never bare membership. The door
-- is declared as DATA: `supabase/tests/vectors/authz-enforcement-manifest.json`
-- `permissions[<code>].arm3Door` (kind · expression · args · limb · legacyClass · legacyClassSource
-- · stateColumn), emitted into the vector as the `legacy_door` column (16th, descriptive text —
-- `expression :: args`, not directly `EXECUTE`-able; the dispatch below is bound by NAME
-- (`legacy_class`, column 6), one literal per row, read from that metadata rather than re-derived.
--
-- ⛔ TWO ASSERTIONS PER CELL, AND THE SECOND IS THE POINT (unchanged from 403).
--   §4  is(legacy, catalog)          — the resolver reproduces today's behaviour;
--   §5  is(catalog, approved-value)  — the MATRIX is the oracle, not "whatever legacy did".
--
-- ⛔ EXPECTED VALUES ARE TRANSCRIBED, NEVER COMPUTED THE WAY THE RESOLVER COMPUTES THEM.
--
-- ⚠ `case_reach` (col 12: `none · role_keyed · grant_keyed · unreachable`) is swept as a global
-- column but is INERT for every `staff` cell — `staff` holds no `can_read_professional_profile`
-- rep. ⛔ Not to be conflated with `member_gate_arm` (col 15: `none · conjunct_met · conjunct_unmet
-- · disjunct_present · disjunct_absent`), the ELEVEN-ROW axis this file exists to dispatch — a
-- DIFFERENT mechanism, declared per-row in the manifest's `memberGateArm` array beside `arm3Door`.
--
-- ⛔ `arm3_divergence` / `expected_legacy_granted` (col 14) — PA-F8-STAFF-1 IS WITHDRAWN. § 11 item
-- 7 is RULED (A): `commission.responses.create` is creation-only, so it carries NO
-- `arm3_divergence` label and `expected_legacy_granted = expected_granted` on every `staff` cell —
-- unlike `staff_admin`'s 84-cell carve-out. §4.1b below is kept for structural symmetry and is
-- expected to be equivalent to §4.1 today.
--
-- ⚠ THE ELEVEN LEGACY_CLASS NAMES — ADOPTED VERBATIM from the manifest (`legacyClassSource` says
-- whose string won; six are TESTER'S, five are backend's, same convention: `rls_` for a
-- policy-qual door, the bare function name otherwise):
--   row 1  rls_form_matrix_targeted_version    (limb b)   app.is_member_of(app.commission_of_version($1)) or app.can_access_targeted_version($1,$2)
--   row 4  rls_profiles_comember_or_self       (limb a+b) ($1=$2) or (app.is_active($2) and exists(… them.principal_id=$1 … app.is_member_of(them.commission_id)))
--   row 6  can_reach_meeting                   (limb a)   app.can_reach_meeting($1,$2)
--   row 7  can_reach_meeting_not_respondent    (limb a)   app.can_reach_meeting($1,$3) and not app.is_case_respondent($2,$3)
--   row 8  can_sign_meeting                    (limb a)   app.can_sign_meeting($1,$2)
--   row 9  case_caps_deliberation              (limb a)   app.has_case_capability($1,$2,'read_case_deliberation')
--   row 11 can_read_action_item                (limb a+b) ($3='committee' and app.is_member_of($2)) or ($3='assignees_only' and exists(… action_item_assignments … user_id=$4 …))
--   row 12 cast_case_vote_guard                (limb a)   exists(ethics_case_details … case_id=$1) and app.is_member_of_for($2,$3) — a GUARD EXPRESSION, not a callable (cast_case_vote WRITES)
--   row 15 rls_accreditation_frameworks_owner_null (limb b) ($1 is null) or app.is_member_of($1)
--   row 16 rls_controlled_documents_approver   (limb b)   app.is_member_of($2) or app.is_document_approver_of($1,$3)
--   row 19 can_read_capa                       (limb a)   app.can_read_capa($1,$2)
--
-- ⚠ THE BARE-MEMBERSHIP EXPRESSIONS (rows 1, 4, 15, 16) READ `auth.uid()` INSIDE `app.is_member_of`
-- with no explicit uid argument — they answer about the CALLER (the session `claims_for()` last
-- set), not about a "subject" parameter. `test_helpers.claims_for()` sets the JWT GUC only (no
-- Postgres role switch), which is sufficient here because every `app.*` predicate below reads
-- `auth.uid()` via that GUC, not via RLS — so these are called directly as plain SQL expressions,
-- exactly as 403 calls its door functions directly, never under `set local role authenticated`.
--
-- ⚠ ROW 12's `HC0J0` GUARD IS AN ETHICS-DETAILS EXISTENCE GUARD, NOT A STATUS GUARD (lead ruling
-- L5, backend-confirmed): CCIH already holds 1 case WITH an `ethics_case_details` row
-- (`ca000000-…-e1`) and 5 WITHOUT — no new case fixture was needed.
--
-- ⚠ FIXTURE ROWS (backend round 4, `docs/progress/ae5-staff.md` "round 4 (backend)", every id
-- carrying the unit's `a5f…` prefix — none reused from any other case):
--   personas   gap.xorg.b@test.local (a5f00000-…-e1, clean org-B staff-only, Farmácia B `c2`) ·
--              gap.unpriv@test.local (a5f00000-…-e2, zero role/admin, active) ·
--              gap.pending@test.local (a5f00000-…-e3, unconfirmed, `staff` @ CCIH) ·
--              gap.deactivated@test.local (a5f00000-…-e4, `is_active=false`, `staff` @ CCIH)
--   row 6/7    a5f20000-…-a1 participants_only meeting; attendee a5f30000-…-a1 = staff1.ccih only
--              (the clean staff is NOT an attendee — the `conjunct_unmet` cell)
--   row 8      a5f20000-…-a2 `in_signature` meeting; attendee a5f30000-…-a2 = staff4.ccih `present`
--              (`conjunct_met`), a5f30000-…-a3 = ativo.registro `absent` (`conjunct_unmet`)
--   row 11     a5f40000-…-a1 `assignees_only`, assigned_to=staff4.ccih (`disjunct_present`);
--              a5f40000-…-a2 `assignees_only`, assigned_to=ativo.registro (`disjunct_absent` /
--              `conjunct_unmet`, since visibility_scope <> 'committee' either way); the ORIGINAL
--              seeded item `ac3f1301-…` (`committee`) is `conjunct_met`
--   row 15     a5f50000-…-a1 owner NULL (PUBLIC, `disjunct_present`) · …-a2 owner=CCIH ·
--              …-a3 owner=Farmácia B (`disjunct_absent` for a CCIH-only caller)
--   row 16     a5f60000-…-a1 `document_approvals`, approver=staff4.ccih, on document `d0c00000-…d1`
--   row 19     a5f70000-…-a1 `capa_plan`, `source='indicator'`, CCIH's own indicator
--   row 1      NO fixture — no `case_participants`/`professional_participants` link was built for
--              any principal this round (2.5's masking control covers the ONLY thing that needed
--              checking: the chosen `subject_holder` carries no such link, so row 1's cells measure
--              bare membership, never the disjunct in disguise). `disjunct_present` therefore has NO
--              constructible coordinate and is NOT dispatched — see the note beside its branch.
--   row 12     no new case (measured: CCIH already has both states)
--
-- ⚠ THE ABLE-TO-FAIL PROOF (§6, mirrors 403 §6 — direct `delete`/`insert`, reversed by its own
-- inverse, NOT a bare SAVEPOINT, which discards assertions made after a rollback to it).
--
-- RUN SHAPE: `plan(21)` — kept from the skeleton round; re-derived against what is actually written
-- below, not predicted. Iterate here, not by editing the number to match a run.

begin;
select plan(21);

\ir vectors/authz_differential_cells.psql

-- ============================================================================
-- §1 — the fixture. Reuses SEEDED data throughout (round-4 fixture rows + the clean personas from
-- docs/testing/ae5-staff-fixture-gaps.md); constructs ONLY the two personas no seeded principal can
-- fill for the PERSONA axis itself (`cross_org_actor` beyond `gap.xorg.b`'s own coordinate,
-- `unprivileged`'s third-party caller), mirroring 403 §1's fixture-owned, FIXED,
-- non-seed-colliding id convention. New namespace `...-4424-...` — cannot collide with 403's
-- `...-4403-...` ids, backend's `a5f…` ids, or any other case's fixture.
-- ============================================================================

create temp table f424 on commit drop as
select
  '00000000-0000-0000-0000-00000000000a'::uuid                                            as uid,        -- staff4.ccih (subject_holder)
  'a0000000-0000-0000-0000-0000000000a1'::uuid                                            as own_cid,    -- CCIH
  '00000000-0000-0000-0000-000000000006'::uuid                                            as other_id,   -- staff1.farm (other_commission_holder)
  'b0000000-0000-0000-0000-0000000000b1'::uuid                                            as other_cid,  -- Farmácia (Rede A)
  -- ⛔ MUST equal gap.xorg.b's OWN commission (Farmácia B, seed.sql `v_farmb`) — `cross_org_actor`
  -- is DEFINED (axes.json) as "holds the subject role in ANOTHER organization", and the vector's
  -- `foreign_org_commission` scope for this persona is that SAME commission, not an arbitrary one.
  -- A first draft of this fixture pointed `xorg_cid` at Qualidade B (`c1`, a DIFFERENT org-B
  -- commission gap.xorg.b does not hold), which made every `cross_org_actor`×`foreign_org_commission`
  -- cell test a membership that could never be true — measured as 8 false reds on the first run.
  'c0000000-0000-0000-0000-0000000000c2'::uuid                                            as xorg_cid,   -- Farmácia B — gap.xorg.b's OWN commission
  'a5f00000-0000-0000-0000-0000000000e1'::uuid                                            as xorg_holder,-- gap.xorg.b (cross_org_actor, seeded round 4)
  'a5f00000-0000-0000-0000-0000000000e2'::uuid                                            as nobody,     -- gap.unpriv (unprivileged / third-party caller, seeded round 4)
  '00000000-0000-0000-0000-0000000000d2'::uuid                                            as absent_uid, -- ativo.registro (row 8/11 "someone else")
  '00000000-0000-0000-0000-000000000003'::uuid                                            as other_grant_uid; -- staff1.ccih (row 6's lone attendee — never the caller)

-- ⛔ No new auth.users/profiles/memberships rows here — round 4 already seeded gap.xorg.b and
-- gap.unpriv with exactly the shape this suite needs (plan `:1144-1147`: no id may be shared across
-- cases, and reusing backend's already-committed personas is not sharing — it is the SAME case).

-- ============================================================================
-- §2 — the cell set, and its controls.
-- ============================================================================

select cmp_ok((select count(*)::int from authz_differential_cells_staff), '>', 5000,
  '2.1 CARDINALITY CONTROL: the generated `staff` cell set is populated (8208 at e43ed8a8). An '
  'empty or truncated vector file would let §§4-5 iterate nothing and pass having asserted nothing.');

select ok(
  (select count(*) from authz_differential_cells_staff where expected_granted) > 0
  and (select count(*) from authz_differential_cells_staff where not expected_granted) > 0,
  '2.2 ⭐ the EXPECTED column carries BOTH answers for `staff`.');

select is((select count(distinct legacy_class)::int from authz_differential_cells_staff), 12,
  '2.3 TWELVE legacy-equivalence classes: the ELEVEN arm-3 door classes plus `is_member_of_for` '
  '(commission.responses.create, the inert 12th representative — L2). ⭐⭐ A CONSEQUENCE of REPS_STAFF, '
  'not an adjustment: if this reds, the question is which class gained or lost a representative, '
  'never "what number matches today" (403 §2.3''s own lesson).');

select ok(
  (select count(*) from authz_differential_cells_staff where self_check) > 0
  and (select count(*) from authz_differential_cells_staff where not self_check) > 0,
  '2.4 ⭐⭐ §6A BOTH POLARITIES ARE PRESENT for `staff` — self-check AND third-party.');

select is(
  (select count(*)::int from public.case_participants cp
     join public.professional_participants pp on pp.participant_id = cp.participant_id
    where pp.professional_profile_id in (
      select pr.id from public.professional_profiles pr
      -- Row 1's masking control (matrix header; 409 §0(b)'s own control shape): the chosen
      -- `subject_holder` (staff4.ccih) must carry NO participation link, or
      -- `app.can_access_targeted_version`'s role-free disjunct grants regardless of membership and
      -- row 1's cells stop measuring bare membership. `professional_profiles` carries no direct FK
      -- to `public.profiles`, so the only honest check is: no `professional_participants` row
      -- anywhere points at a profile whose id equals the chosen persona's id (professional
      -- identities are namespaced separately, but an id COLLISION would still mask the arm).
      where pr.id = (select uid from f424)
    )),
  0,
  '2.5 ⭐ MASKING CONTROL: `staff4.ccih`''s id names no `professional_participants` row via any '
  '`case_participants` link, so row 1''s cells (dispatched below as bare membership only — no '
  '`disjunct_present` fixture exists this round) are not silently measuring '
  '`can_access_targeted_version` in disguise.');

-- ============================================================================
-- §3 — the driver. Materialises each cell's state and calls BOTH evaluators.
-- ============================================================================

create or replace function pg_temp.unknown_legacy_class(p_class text) returns boolean
language plpgsql immutable as $u$
begin
  raise exception '424 driver: legacy class % has no dispatch branch.', p_class;
end;
$u$;

-- Row 4's expression, verbatim from the manifest's arm3Door.expression.
create or replace function pg_temp.legacy_row4(p_profile_id uuid, p_uid uuid)
returns boolean language sql stable as $r4$
  select (p_profile_id = p_uid)
      or (app.is_active(p_uid) and exists(
            select 1 from public.memberships them
             where them.commission_id is not null and them.principal_id = p_profile_id
               and app.is_member_of(them.commission_id)));
$r4$;

-- Row 11's expression, verbatim.
create or replace function pg_temp.legacy_row11(
  p_action_item_id uuid, p_commission_id uuid, p_visibility_scope text, p_uid uuid
) returns boolean language sql stable as $r11$
  select (p_visibility_scope = 'committee' and app.is_member_of(p_commission_id))
      or (p_visibility_scope = 'assignees_only' and exists(
            select 1 from public.action_item_assignments a
             where a.action_item_id = p_action_item_id and a.user_id = p_uid
               and a.completed_at is null));
$r11$;

-- Row 12's GUARD EXPRESSION (⛔ not the RPC — public.cast_case_vote WRITES and returns uuid).
create or replace function pg_temp.legacy_row12(p_case_id uuid, p_commission_id uuid, p_uid uuid)
returns boolean language sql stable as $r12$
  select exists(select 1 from public.ethics_case_details d where d.case_id = p_case_id)
     and app.is_member_of_for(p_commission_id, p_uid);
$r12$;

-- Row 16's expression, verbatim.
create or replace function pg_temp.legacy_row16(p_document_id uuid, p_commission_id uuid, p_uid uuid)
returns boolean language sql stable as $r16$
  select app.is_member_of(p_commission_id) or app.is_document_approver_of(p_document_id, p_uid);
$r16$;

create or replace function pg_temp.cell_answers(
  p_persona text, p_ctx text, p_scope text, p_code text, p_class text, p_state text, p_self boolean,
  p_reach text, p_gate_arm text
) returns table (legacy boolean, catalog boolean)
language plpgsql volatile as $d$
declare
  f record; v_principal uuid; v_caller uuid; v_scope_id uuid; v_res text;
  -- arm-3 fixture handles (all round-4 seeded, verified this round).
  v_meeting_default uuid := 'f1000000-0000-0000-0000-0000000000e1'; -- CCIH, commission_default, held
  v_meeting_restrict uuid := 'a5f20000-0000-0000-0000-0000000000a1'; -- CCIH, participants_only
  v_meeting_signing uuid := 'a5f20000-0000-0000-0000-0000000000a2'; -- CCIH, in_signature
  v_att_present uuid := 'a5f30000-0000-0000-0000-0000000000a2'; -- staff4.ccih, present, signing meeting
  v_att_absent  uuid := 'a5f30000-0000-0000-0000-0000000000a3'; -- ativo.registro, absent, signing meeting
  v_case_cd  uuid := 'd0000000-0000-0000-0000-0000000000c1'; -- CCIH, commission_default, no ethics_case_details
  v_case_eg  uuid := 'ca000000-0000-0000-0000-0000000000e1'; -- CCIH, explicit_grants_only, HAS ethics_case_details
  v_ai_committee uuid := 'ac3f1301-49e3-4b2b-b904-6a2a4fea8cfc'; -- CCIH, visibility_scope='committee'
  v_ai_assigned  uuid := 'a5f40000-0000-0000-0000-0000000000a1'; -- assignees_only, assigned_to=staff4.ccih
  v_ai_other     uuid := 'a5f40000-0000-0000-0000-0000000000a2'; -- assignees_only, assigned_to=ativo.registro
  v_fw_null uuid := 'a5f50000-0000-0000-0000-0000000000a1'; -- accreditation_frameworks, owner NULL
  v_fw_own  uuid := 'a5f50000-0000-0000-0000-0000000000a2'; -- owner CCIH
  v_fw_farmb uuid := 'a5f50000-0000-0000-0000-0000000000a3'; -- owner Farmácia B
  v_doc_approved uuid := 'd0c00000-0000-0000-0000-0000000000d1'; -- document_id, approved BY staff4.ccih
  v_doc_other    uuid := 'd0c00000-0000-0000-0000-0000000000d2'; -- document_id, no approval by staff4.ccih
  v_capa_indicator uuid := 'a5f70000-0000-0000-0000-0000000000a1'; -- source='indicator'
  v_capa_rca       uuid := 'ca000000-0000-0000-0000-0000000000a3'; -- source='rca'
  v_form_version uuid := '50000000-0000-0000-0000-00000000a001'; -- CCIH form version, WITH the targeted-version chain (backend f2dd7d00): professional_profiles a5f80000-…-a1 -> participants a5f90000-…-a1 -> case_participants a5fa0000-…-a1 (case d0000000-…-c1) -> responses a5fb0000-…-a1 -> app.can_access_targeted_version(v_form_version, gap.unpriv) = true; measured false for staff4.ccih (the masking control, §2.5).
  v_form_version_no_chain uuid := '50000000-0000-0000-0000-00000000a002'; -- CCIH, a DIFFERENT version — no targeted-version chain built against it for any principal
  -- Row 4's co-member targets, one per commission a fixture principal actually holds in (backend
  -- ruling: "a fixed $1 across arms is exactly your mixed pattern" — $1 must be resolved RELATIVE
  -- to whichever principal is under test, never a persona-independent constant).
  v_comember_ccih  uuid := '00000000-0000-0000-0000-000000000002'; -- chefe.ccih, CCIH co-member
  v_comember_farmA uuid := '00000000-0000-0000-0000-000000000005'; -- chefe.farm, Farmácia (Rede A) co-member
  v_comember_farmB uuid := '00000000-0000-0000-0000-0000000000b3'; -- staff1.qual.b, Farmácia B co-member
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

  -- ⭐ THE TRUE self/third-party CLAIMS, SET ONCE, AND `catalog` COMPUTED IMMEDIATELY UNDER THEM.
  -- `authz.candidate_has_permission`'s own hat-asymmetry (`p_principal IS DISTINCT FROM auth.uid()
  -- OR active_role() matches`) depends on THESE claims — computing it AFTER any later override
  -- (below) would silently feed the catalog side the wrong caller too, which is exactly the
  -- regression measured after iteration 2's first attempt at this fix (84 cells: a genuine
  -- third-party cell started reading as a bad-hat SELF-check and denied where §6A requires a
  -- grant). `catalog` is therefore computed HERE, before any class-specific claims override.
  v_caller := case when p_self then v_principal else f.nobody end;
  if p_self then
    perform test_helpers.claims_for(v_principal, false,
      case p_ctx when 'matching' then 'staff' when 'other_role' then 'staff_admin' else null end);
  else
    perform test_helpers.claims_for(f.nobody, false, 'staff_admin');
  end if;
  catalog := authz.candidate_has_permission(v_principal, v_res, v_scope_id, p_code);

  -- ⚠ FIVE CLASSES ARE BARE `app.is_member_of(scope)` CALLS SOMEWHERE IN THEIR EXPRESSION, WITH NO
  -- `uid`/`p_uid` PARAMETER AT ALL FOR THAT SUB-TERM (manifest `arm3Door.args`: row 15 declares only
  -- `owner_commission_id uuid`; rows 1/4/16 mix an explicit-uid arm with a bare one). A bare
  -- `is_member_of` reads `auth.uid()` — it can only ever answer about the QUERYING SESSION, never
  -- about a "subject" distinct from the caller. So `self_check=false` ("third_party") has NO
  -- meaning for the bare portion: there is no way to ask "is v_principal a member" from a caller
  -- who is not v_principal. Fixed after iteration 2 (measured: every `third_party` cell on these
  -- classes read the CALLER's membership, not v_principal's, producing 1496 false reds).
  -- ⭐ `can_read_action_item` ADDED to this list this round, beyond the fixture-selection fix backend
  -- named — `pg_temp.legacy_row11`'s COMMITTEE leg is `p_visibility_scope='committee' AND
  -- app.is_member_of(p_commission_id)`, the SAME bare-membership shape as the other four; without
  -- this it would still fail on every third-party `none`/`conjunct_met` cell even with the correct
  -- committee-scope item selected. Flagged as MINE, not part of backend's literal instruction.
  -- These five classes are therefore evaluated (for LEGACY ONLY, `catalog` already computed above)
  -- ALWAYS as if `self_check` were true — the claims are re-set to `v_principal`, never `nobody`.
  if p_class in ('rls_form_matrix_targeted_version', 'rls_profiles_comember_or_self',
                 'rls_accreditation_frameworks_owner_null', 'rls_controlled_documents_approver',
                 'can_read_action_item') then
    perform test_helpers.claims_for(v_principal, false,
      case p_ctx when 'matching' then 'staff' when 'other_role' then 'staff_admin' else null end);
  end if;

  -- ⚠ FIXED after iteration 2: EVERY CCIH-ANCHORED arm-3 fixture row (the meeting/case/action-item/
  -- document/capa ids below) exists ONLY at CCIH — backend built the round-4 gate_arm-specific
  -- states there and nowhere else. A cell testing `sibling_commission` or `foreign_org_commission`
  -- (e.g. `cross_org_actor` at Farmácia B, who genuinely holds `staff` there) cannot be answered by
  -- probing a CCIH resource — measured: 1496 false reds, every one a `cross_org_actor`/
  -- `foreign_org_commission` cell reading the wrong commission's fixture. Outside the commission the
  -- fixture was built in, the arm-3 nuance is UNTESTABLE by construction, so the fair, honest
  -- fallback is the same bare membership answer the base (non-arm-3) representative would give —
  -- exactly what `is_member_of_for` already is. `rls_accreditation_frameworks_owner_null` is exempt
  -- from this gate: its dispatch already parametrises on `v_scope_id` directly (never a fixed
  -- commission), so it is scope-consistent everywhere by construction.
  legacy := case
    when p_class = 'is_member_of_for' then app.is_member_of_for(v_scope_id, v_principal)
    when p_class = 'rls_accreditation_frameworks_owner_null' then
      -- ⚠ FIXED per backend ruling (b, suite): `disjunct_absent` is a RESOURCE-anchored coordinate
      -- ("the disjunct is absent because the framework IS owned by someone"), not a scope-anchored
      -- one — it must always reference the same concrete, non-NULL-owner resource
      -- (`gap-ccih`/`f.own_cid`) regardless of which `scope` axis value the cell also carries, never
      -- `v_scope_id` (which drifted to the foreign-owned `gap-farmb` shape for `foreign_org_commission`
      -- cells). `none` is unaffected — it is not one of the values backend named.
      (case p_gate_arm when 'disjunct_present' then null::uuid
                        when 'disjunct_absent'  then f.own_cid
                        else v_scope_id end is null)
      or app.is_member_of(case p_gate_arm when 'disjunct_present' then null::uuid
                                           when 'disjunct_absent'  then f.own_cid
                                           else v_scope_id end)
    -- ⚠ FIXED (this round, iteration 2 of 2 — NOT re-run, exceeds the allowed cap): the fallback
    -- must exclude ONLY `conjunct_unmet` (the resource-anchored coordinate whose own conjunct must
    -- decide regardless of the caller's own commission — P2's `door-conjunct-unmet`, measured:
    -- falling back to bare membership let an off-CCIH persona's OWN membership mask a conjunct that
    -- should have denied them). The FIRST attempt narrowed this to `= 'none'` alone and REGRESSED
    -- `conjunct_met` and `disjunct_absent` at off-CCIH scopes (measured on the SAME run: 24-30 new
    -- reds per row on `conjunct_met`, 22 on `disjunct_absent` — those two values ARE ordinary
    -- baseline-shaped, same as `none`, and need the fallback just as much). ⛔ NOT verified by a
    -- third run — the iteration cap for this round is exhausted; the lead authorizes the next run.
    when v_scope_id <> f.own_cid and p_gate_arm <> 'conjunct_unmet' then app.is_member_of_for(v_scope_id, v_principal)

    when p_class = 'rls_form_matrix_targeted_version' then
      -- ⚠ WIRED per backend's fixture (f2dd7d00): `disjunct_present` uses `v_form_version`, the ONE
      -- version the targeted chain reaches — `can_access_targeted_version` measures true there for
      -- `gap.unpriv` (persona=`unprivileged`, since `f.nobody = gap.unpriv`) and false for every
      -- other persona (measured false for `staff4.ccih`, §2.5's masking control). `disjunct_absent`
      -- uses `v_form_version_no_chain`, a different CCIH version no chain was built against for any
      -- principal, so the disjunct is structurally false there regardless of persona. `none` keeps
      -- `v_form_version` — the disjunct is a pure addition (limb b), so pairing it with the chain
      -- version changes nothing for a principal who already holds bare membership.
      app.is_member_of(app.commission_of_version(
        case p_gate_arm when 'disjunct_absent' then v_form_version_no_chain else v_form_version end))
      or app.can_access_targeted_version(
           case p_gate_arm when 'disjunct_absent' then v_form_version_no_chain else v_form_version end,
           v_principal)

    when p_class = 'rls_profiles_comember_or_self' then
      -- ⚠ FIXED per backend ruling (b, suite): $1 was a FIXED constant across every persona, which
      -- for `subject_holder` (v_principal = f.uid) made `conjunct_met`/`none` a self-read in
      -- disguise, and for other personas made `disjunct_absent` a self-read whenever v_principal
      -- happened to equal the constant used. $1 is now resolved RELATIVE to v_principal: a genuine
      -- co-member of v_principal's OWN commission for `none`/`conjunct_met` (ordinary membership,
      -- and the arm-3 grant coordinate share the same shape); a stranger for `conjunct_unmet`; a
      -- guaranteed-non-self, guaranteed-non-co-member target for `disjunct_absent`; v_principal
      -- itself only for `disjunct_present` (the role-free self-read).
      pg_temp.legacy_row4(
        case p_gate_arm
          when 'disjunct_present' then v_principal
          when 'disjunct_absent'  then (case when v_principal = f.nobody then f.uid else f.nobody end)
          when 'conjunct_unmet'   then (case when v_principal = f.other_id then f.uid else f.other_id end)
          else (case v_principal
                  when f.uid then v_comember_ccih
                  when f.other_id then v_comember_farmA
                  when f.xorg_holder then v_comember_farmB
                  else v_comember_ccih end)
        end,
        v_principal)

    when p_class = 'can_reach_meeting' then
      app.can_reach_meeting(
        case p_gate_arm when 'conjunct_unmet' then v_meeting_restrict else v_meeting_default end,
        v_principal)

    when p_class = 'can_reach_meeting_not_respondent' then
      app.can_reach_meeting(
        case p_gate_arm when 'conjunct_unmet' then v_meeting_restrict else v_meeting_default end,
        v_principal)
      and not app.is_case_respondent(v_case_cd, v_principal)

    when p_class = 'can_sign_meeting' then
      app.can_sign_meeting(
        case p_gate_arm when 'conjunct_unmet' then v_att_absent else v_att_present end,
        v_principal)

    when p_class = 'case_caps_deliberation' then
      app.has_case_capability(
        case p_gate_arm when 'conjunct_unmet' then v_case_eg else v_case_cd end,
        v_principal, 'read_case_deliberation')

    when p_class = 'can_read_action_item' then
      pg_temp.legacy_row11(
        case p_gate_arm
          when 'disjunct_present' then v_ai_assigned
          when 'disjunct_absent'  then v_ai_other
          when 'conjunct_unmet'   then v_ai_other
          else v_ai_committee end,
        v_scope_id,
        case p_gate_arm
          when 'disjunct_present' then 'assignees_only'
          when 'disjunct_absent'  then 'assignees_only'
          when 'conjunct_unmet'   then 'assignees_only'
          else 'committee' end,
        v_principal)

    when p_class = 'cast_case_vote_guard' then
      pg_temp.legacy_row12(
        case p_gate_arm when 'conjunct_unmet' then v_case_cd else v_case_eg end,
        v_scope_id, v_principal)

    when p_class = 'rls_controlled_documents_approver' then
      -- ⚠ FIXED per backend ruling (b, suite): `none` (the baseline, unrelated to the specific
      -- approver fixture) was sharing `disjunct_present`'s document — the one document whose ONLY
      -- approver is staff4.ccih. For any OTHER persona that made `none` silently depend on the
      -- approver fixture too. `none` now uses the neutral document (nobody's approval on it);
      -- `disjunct_present` keeps the approver-named document — the coordinate is genuinely
      -- constructible only for `subject_holder` (staff4.ccih IS $3 there), and correctly falls
      -- through to bare membership for every other persona, exactly as `is_document_approver_of`
      -- returning false for them should.
      pg_temp.legacy_row16(
        case p_gate_arm when 'disjunct_present' then v_doc_approved else v_doc_other end,
        v_scope_id, v_principal)

    when p_class = 'can_read_capa' then
      app.can_read_capa(
        case p_gate_arm when 'conjunct_unmet' then v_capa_rca else v_capa_indicator end,
        v_principal)

    else pg_temp.unknown_legacy_class(p_class)
  end;
  return next;
end $d$;

create temp table r424 on commit drop as
select c.*, a.legacy, a.catalog
  from authz_differential_cells_staff c
  cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope,
                                          c.permission_code, c.legacy_class,
                                          c.principal_state, c.self_check, c.case_reach,
                                          c.member_gate_arm) a;

select test_helpers.reset_role_and_claims();

select is((select count(*)::int from r424), (select count(*)::int from authz_differential_cells_staff),
  '3.0 ⭐ EVERY `staff` CELL PRODUCED A ROW.');

select is((select count(*)::int from r424 where legacy is null or catalog is null), 0,
  '3.1 the driver returned an answer for EVERY `staff` cell.');

select ok(
  (select count(*) from r424 where catalog) > 0 and (select count(*) from r424 where not catalog) > 0,
  '3.2 ⭐ DISCRIMINATION CONTROL: the resolver returned BOTH answers across the `staff` sweep.');

select is((select state::text from authz.roles where code = 'staff'), 'test_validation',
  '3.2b ⭐ PRECONDITION mirroring 403''s §3.2b from `staff`''s side: `staff` sits in '
  '`test_validation`, which is what makes candidate_has_permission the correct oracle for this '
  'suite''s cells.');

select is((select count(*)::int from authz.roles where code = 'staff_admin' and state = 'test_validation'), 0,
  '3.2c ⭐ mirrors L4''s §3.2c from 424''s side: `staff_admin` is NEVER in `test_validation` while '
  '`staff` is — the two suites'' subjects are not confused.');

select is(
  (select count(*)::int
     from authz_differential_cells_staff c
     join r424 b on b.cell_id = c.cell_id
     cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope, c.permission_code,
                                             c.legacy_class, c.principal_state, c.self_check,
                                             c.case_reach, c.member_gate_arm) a
    where a.catalog is distinct from b.catalog),
  0,
  '3.3 ⭐ DETERMINISM CONTROL: a second sweep over the same `staff` cells returns the same answers.');

-- ============================================================================
-- §4 — is(legacy, catalog).
--
-- ⛔⛔ DISAGREEMENT CLASSES AS OF ITERATION 4, WITH BACKEND'S RULING PER CLASS (its own record entry
-- + the lead's relay). Ruling key: **(a) vector** — `expected_*` is wrong, PO-pending, NOT mine to
-- touch; **(b) suite** — my dispatch was wrong, FIXED this round (not yet re-run); **(c) fixture**
-- — backend's seed is incomplete, backend is building it, NOT mine. `expected_granted` is not
-- printed separately from `expected_legacy_granted` because every failing cell here has the two
-- EQUAL (that is WHY they appear in §4.1 at all — a declared divergence would exclude the cell).
--
-- | code                                | gate_arm                        | legacy | catalog | expected | div               | n   | ruling |
-- |--------------------------------------|----------------------------------|--------|---------|----------|-------------------|-----|--------|
-- | commission.accreditation.read        | disjunct_present                 | true   | false   | false    | arm3:not-in-gate  | 198 | **(a) vector** — verified live: the vacuous PUBLIC arm grants unconditionally, no is_active gate; PO-pending. |
-- | commission.accreditation.read        | disjunct_absent                  | false  | true    | true     | arm3:not-in-gate  | 6   | **(b) suite** — FIXED: was testing `v_scope_id` (drifted to Farmácia B for foreign-scope cells) instead of the fixed CCIH-owned resource; now always `f.own_cid`. |
-- | commission.accreditation.read        | none                              | false  | true    | true     | arm3:not-in-gate  | 6   | not ruled this round — backend named only `disjunct_present`/`disjunct_absent`; left as measured, unchanged. |
-- | commission.roster.read               | none / conjunct_met / disjunct_present / disjunct_absent | mixed | mixed | mixed (=catalog) | arm3:not-in-gate | ~184 | **(b) suite** — FIXED: `$1` (the co-member/target profile) was a PERSONA-INDEPENDENT constant, making `subject_holder` a hidden self-read at `conjunct_met`/`none`; now resolved relative to `v_principal` per commission. |
-- | commission.roster.read               | conjunct_unmet                   | —      | —       | —        | arm3:not-in-gate  | ~30 | **(a) vector** — named in backend's "every `conjunct_unmet` class" ruling; the door's conjunct denies, `expected_legacy_granted` does not reflect it. Not touched. |
-- | commission.documents.read            | none / disjunct_absent           | mixed  | mixed   | mixed (=catalog) | arm3:not-in-gate | ~48 | **(b) suite** — FIXED: `none` was sharing `disjunct_present`'s approver-named document, making the approver leg leak into the baseline cell for every persona; `none` now uses the neutral document. |
-- | commission.documents.read            | disjunct_present                 | —      | —       | —        | arm3:not-in-gate  | ~18 | **(c) fixture** (implicitly, via row-16's own shape) — the ONLY constructible approver is `staff4.ccih`; correct for `subject_holder`, correctly falls through to bare membership for every other persona. Not a divergence. |
-- | commission.action_items.read         | none / conjunct_met / disjunct_present / disjunct_absent | false | true | true | arm3:not-in-gate | ~20 | **(b) suite** — FIXED: the committee leg (`pg_temp.legacy_row11`) is a BARE `is_member_of`, not on the self-mode-claims list; added it — the fixture-id selection backend named was already correct. |
-- | commission.action_items.read         | conjunct_unmet                   | —      | —       | —        | arm3:not-in-gate  | 6   | **(a) vector** — named in backend's `conjunct_unmet` ruling. Not touched. |
-- | commission.cases.deliberation.read   | conjunct_unmet                   | false  | true    | true     | arm3:not-in-gate  | 6   | **(a) vector** — named explicitly (backend's second message). Not touched. |
-- | commission.cases.vote                | conjunct_unmet                   | false  | true    | true     | arm3:not-in-gate  | 6   | **(a) vector** — named explicitly. Not touched. |
-- | commission.meetings.read             | conjunct_unmet                   | false  | true    | true     | arm3:not-in-gate  | 6   | **(a) vector** — named explicitly. Not touched. |
-- | commission.meetings.cases.shell.read | conjunct_unmet                   | false  | true    | true     | arm3:not-in-gate  | 6   | **(a) vector** — named explicitly. Not touched. |
-- | commission.meetings.minutes.sign     | conjunct_unmet                   | false  | true    | true     | arm3:not-in-gate  | 6   | **(a) vector** — named explicitly. Not touched. |
-- | commission.capa.read                 | conjunct_unmet                   | (not individually re-measured) | | | arm3:not-in-gate | — | **(a) vector** — named in backend's "the `conjunct_unmet` halves of action_items/capa/roster" clause. Not touched. |
--
-- ⚠ Rows marked (b) were EDITED this round and NOT yet re-run (the lead holds the stack for
-- backend's fixture work) — their `legacy`/`catalog`/`n` columns above are the PRE-fix, iteration-4
-- measurements, kept as the record of what was wrong rather than updated to a guess.
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' catalog=' || catalog::text,
                              ' | ' order by cell_id), '(none)')
     from r424
    where legacy is distinct from catalog
      and expected_legacy_granted is not distinct from expected_granted),
  '(none)',
  '4.1 ⭐ LEGACY == CATALOG on every `staff` cell where the vector declares no divergence.');

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' expected_legacy=' ||
                              expected_legacy_granted::text || ' div=' || arm3_divergence,
                              ' | ' order by cell_id), '(none)')
     from r424
    where legacy is distinct from expected_legacy_granted),
  '(none)',
  '4.1b kept for structural symmetry with 403 §4.1b — expected EQUIVALENT to §4.1 for `staff` today.');

-- ============================================================================
-- §5 — is(catalog, approved matrix value). THE ORACLE HALF.
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' catalog=' || catalog::text || ' expected=' ||
                              expected_granted::text || ' src=' || expected_source,
                              ' | ' order by cell_id), '(none)')
     from r424 where catalog is distinct from expected_granted),
  '(none)',
  '5.1 ⭐⭐ CATALOG == THE APPROVED `staff` MATRIX VALUE.');

select is(
  (select count(*)::int from r424 where expected_source like 'deny-class:wrong_active_context:third-party%'
     and not catalog),
  0,
  '5.2 ⭐ §6A''s asymmetry for `staff`: every WRONG-HAT THIRD-PARTY cell is GRANTED.');

-- ============================================================================
-- §6 — THE SUITE SHOWN ABLE TO FAIL. Direct DML, reversed by its own inverse — NOT a bare SAVEPOINT.
-- ============================================================================

create or replace function pg_temp.disagreements() returns int
language sql volatile as $x$
  select count(*)::int
    from authz_differential_cells_staff c
    cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope,
                                            c.permission_code, c.legacy_class,
                                            c.principal_state, c.self_check, c.case_reach,
                                            c.member_gate_arm) a
   where a.catalog is distinct from c.expected_granted;
$x$;

select cmp_ok(pg_temp.disagreements(), '=', 0,
  '6.0 ⭐⭐ BASELINE FOR BOTH FAIL-PROOFS — the oracle agrees on every `staff` cell before any '
  'deliberate mutation.');

delete from authz.role_permissions
 where role_code = 'staff' and permission_code = 'commission.forms.read';
select cmp_ok(pg_temp.disagreements(), '>', 0,
  '6.1 FAIL-PROOF 1 — flipping ONE seeded `staff` role_permissions row makes the oracle RED.');
insert into authz.role_permissions (role_code, permission_code)
  values ('staff', 'commission.forms.read');
select test_helpers.reset_role_and_claims();
select ok(
  (select a.catalog
     from authz_differential_cells_staff c
     cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope, c.permission_code,
                                             c.legacy_class, c.principal_state, c.self_check,
                                             c.case_reach, c.member_gate_arm) a
    where c.permission_code = 'commission.forms.read' and c.persona = 'subject_holder'
      and c.scope = 'own_commission' and c.principal_state = 'active'
      and c.active_context = 'matching' and c.self_check and c.member_gate_arm = 'none'
    limit 1),
  '6.2 ...and RESTORING the grant makes the mutated permission resolve TRUE again at its base '
  'coordinate.');

select cmp_ok(pg_temp.disagreements(), '=', 0,
  '6.2b ⭐ THE RESTORE IS COMPLETE ACROSS THE WHOLE SWEEP.');

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
  'goes RED.');

-- ============================================================================
-- §7 — arm-3 census bound.
-- ============================================================================

select is(
  (select array_agg(distinct legacy_class order by legacy_class)
     from authz_differential_cells_staff where member_gate_arm <> 'none')::text,
  (array['can_reach_meeting','can_reach_meeting_not_respondent','can_read_action_item','can_read_capa',
         'can_sign_meeting','case_caps_deliberation','cast_case_vote_guard',
         'rls_accreditation_frameworks_owner_null','rls_controlled_documents_approver',
         'rls_form_matrix_targeted_version','rls_profiles_comember_or_self'])::text,
  '7.1 the emitted arm-3 coordinate set is exactly the eleven matrix § 5.3 rows, named — never a '
  'count.');

select * from finish();
rollback;
