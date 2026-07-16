-- =============================================================================
-- AUTHZ · A4 — Organization administration ceases to be a Case Content source.
-- ADR 0078 D4 (all clauses), A21 (D4·1's true scope), A22/A23, A24·2, A36·2.
--
-- ⛔ THIS UNIT IS A **NARROWING**, NOT A MECHANISM SWAP. §7.7 inverts the risk: a
-- denial's danger is that it does not bind; a narrowing's danger is that it BINDS TOO
-- MUCH — and a narrowing that denies everyone passes its negative keystone by
-- construction. THE POSITIVE TWIN IS THE REVIEW. The population proof is the
-- 1960-cell A/B matrix (28 profiles x 7 cases x 5 predicates x 2 flag states):
--   LOST = 60, GAINED = 0, measured on the live catalog, and every LOST cell is an
--   org-admin case-content cell INTENDED to be lost (see 235 + a4-mutation-audit.sh).
-- A LOST cell outside the intended set is the defect; a missing one equally so.
--
-- ⭐ WHY 5 PREDICATES, NOT A2's 4. A2 swapped four bodies; `can_read_case_or_admin` was
-- NOT among them. **A4 edits it.** A 4-predicate matrix is structurally blind to A4's
-- second target — a probe that cannot observe the thing you are using it to rule out
-- (§7.10). The fifth column is `can_read_case_or_admin`, and it must collapse to
-- `can_read_case` (F1) once the org arm leaves.
--
-- WHAT A4 REMOVES (the org-admin arm, `is_commission_admin_of[_for]`), by target:
--   FUNCTIONS (4):
--     1. app._case_caps         — S2 org branch: DROP read_case_content +
--                                 read_case_deliberation; KEEP manage_case_access
--                                 (A4's scope is Content and PHI; granting is neither
--                                 — A24·2. The bit has 0 consumers today — A36 — so
--                                 this is a SCOPE decision, NOT a functional need; do
--                                 not justify keeping it with "the door needs it" —
--                                 that would be a false arrow, §7.11).
--     2. app.can_read_case_or_admin — DROP the trailing org OR. F1: the wrapper then
--                                 collapses to can_read_case (proven: shadow of the
--                                 collapsed wrapper == can_read_case over 196 cells,
--                                 50 reachable-true, 0 disagreements). D2's one-source
--                                 claim stops being aspirational for this path.
--     3. app.can_read_attachment — DROP the org OR from the **'interview'** arm ONLY
--                                 (D4·2's surviving half; A9 keeps this "at Stage A /
--                                 plan A4"). The **'meeting'** arm KEEPS its org term —
--                                 its removal is the meeting-surface unit (A8/A9),
--                                 post-pilot, NOT A4. Do not over-reach into it.
--     4. app.can_write_interview  — DROP the org arm. The residual predicate the 7
--                                 interview-family policies route; without this their
--                                 org-arm removal is a NO-OP for the org_admin (A21's
--                                 "no-op as specified", recursed — found by 235 K2).
--   POLICIES (18 — A21's EIGHT are NOT the population; its CLOSURE is wrong, §7.9):
--     A21's eight FOR ALL case tables .......... cases, case_narratives, case_phases,
--        case_events, case_offered_outcomes, case_tag_assignments,
--        case_phase_allowed_results, case_phase_offered_results
--     interview family (7) ..................... case_interview_subjects_write,
--        case_interview_links_write, case_interview_interviewers_write,
--        interview_sessions_write, case_interviews_update/_delete/_insert
--        (⭐ A22 is WRONG that action_items is "the SINGLE place" ETH·E1's exclusion was
--         missed — interview_sessions_write + case_interviews_{update,delete,insert}
--         carry NO exclusion term. A4 removes their ORG arm; the residual paths
--         (can_write_interview / is_staff_admin_of) each carry the deny, so removing
--         the org arm ALSO closes those missing-exclusion gaps FOR FREE — the org arm
--         was the only path bypassing the read-predicate perimeter.)
--     action_items_staff_admin_write (SCOPED) .. org arm removed for
--        visibility_scope = 'case_restricted' ONLY. `committee` items are legitimate
--        commission governance — deleting the arm outright is over-reach (trap 2), and
--        K3's positive twin (`committee` still readable by the org_admin) IS the review.
--        ⛔ C7 (keystone 27): this policy STILL lacks the recusal exclusion on its
--        `is_staff_admin_of` arm. A4 did NOT fix that half. Do not inherit this policy
--        believing it clean.
--     storage.objects (2 SELECT) .............. case_documents_select_member,
--        interview_attachments_obj_select_member — DROP the org arm (byte-level case
--        material; A9 precedent removed the org arm from the meeting storage policies).
--        ⛔ THE `is_member_of` ARM ON THESE TWO IS A SEPARATE, WORSE DEFECT and is NOT
--        A4's: the policy is COMMISSION-scoped (path folder[1] is a commission id) so
--        it CANNOT test case-level exclusion — a RECUSED member reads case-document
--        bytes (proven by execution; the hard deny is a read-PREDICATE mechanism and
--        this door routes none). That is THE EXCLUSION PERIMETER unit, after A5. A4
--        removes only the org arm here.
--
-- WHAT A4 DELIBERATELY DOES NOT TOUCH (measured, flagged to lead — belongs to the
-- A21 correction / the perimeter unit / C7, NOT A4; folding them in is the §7.5
-- scope-explosion the catalog's 108 org-arm functions guarantee):
--   • app.can_write_attachment 'case'/'interview' arms (write-side org arm — A21·1)
--   • storage INSERT policies case_documents_insert_staff_admin,
--     interview_attachments_obj_insert_writable (org arm in WITH CHECK — write)
--   • the case RPCs (create_case, update_case_meta, … — A21·1: "most are legitimate";
--     per-function judgement, not a sweep)
--   • can_read_attachment 'meeting' arm + all meeting policies (A8/A9, post-pilot)
--
-- ⚠ SWEEP HAZARD FOR THE NEXT AUTHOR (recorded because it cut me): FUNCTIONS call
-- `is_commission_admin_of_for`; POLICIES call the bare `is_commission_admin_of`. Two
-- different helpers. `\yis_commission_admin_of\y` CANNOT match the `_for` variant (`_`
-- is a word char), so a `\b`/`\y`-anchored sweep MANUFACTURES false negatives when the
-- target is a prefix of a longer identifier — this codebase is full of `X`/`X_for`
-- pairs. Sweep for BOTH, or you miss half the surface (§7.2, §7.4).
--
-- METHOD (re-emit lesson): functions are RE-EMITTED from LIVE pg_get_functiondef and
-- edited by a guarded regexp_replace — NOT pasted from migration text (which is stale
-- by design; some bodies are rewritten at runtime). Each edit is followed by a HARD
-- guard that the body CHANGED (a replace that matches nothing silently no-ops — the
-- mutation audit's own lesson) plus structural post-conditions that the untouched
-- invariants (hard deny, NSP arm, is_active gate, the meeting arm) SURVIVE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCTION EDITS — re-emit from live, guarded.
-- -----------------------------------------------------------------------------
do $mig$
declare
  d_old text;
  d_new text;
  n_admin_for int;
begin
  ---------------------------------------------------------------------------
  -- 1. app._case_caps — S2 org branch: drop content + deliberation, keep manage.
  ---------------------------------------------------------------------------
  d_old := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
  d_new := regexp_replace(
    d_old,
    'if v_orgadmin then\s+v_caps := v_caps \| app\._cap_bit\(''read_case_deliberation''\)\s*\| app\._cap_bit\(''read_case_content''\)\s*\| app\._cap_bit\(''manage_case_access''\);\s+end if;',
    E'if v_orgadmin then\n'
    || E'     -- A4 (D4·1): org-admin CEASES to be a Case Content source. The content\n'
    || E'     -- and deliberation bits are REMOVED here; manage_case_access is RETAINED\n'
    || E'     -- (A24·2: A4''s scope is Content and PHI; granting is neither). That bit\n'
    || E'     -- has 0 consumers today (A36) -- kept on SCOPE grounds, not because a door\n'
    || E'     -- needs it; justifying it with "the door needs it" would be a false arrow.\n'
    || E'     v_caps := v_caps | app._cap_bit(''manage_case_access'');\n'
    || E'   end if;'
  );
  if d_new = d_old then
    raise exception 'A4/1: _case_caps S2 org branch not matched — body drifted from A2 state; re-derive from live before editing';
  end if;
  execute d_new;

  -- post-conditions: the swap removed ONLY the two content bits from the org branch,
  -- and every untouched invariant survives (comment-stripped, catches over-reach).
  d_new := regexp_replace(pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure), '--[^\n]*', '', 'g');
  if d_new ~ 'if v_orgadmin then\s+v_caps := v_caps \| app\._cap_bit\(''read_case' then
    raise exception 'A4/1 POST: org branch still confers a read bit — content not removed';
  end if;
  if d_new !~ 'v_orgadmin' or d_new !~ 'manage_case_access' then
    raise exception 'A4/1 POST: manage_case_access arm lost — over-reach';
  end if;
  if d_new !~ 'is_case_respondent' or d_new !~ 'is_recused_from_case' then
    raise exception 'A4/1 POST: the hard deny was damaged — over-reach';
  end if;
  if d_new !~ 'case_referral' or d_new !~ 'is_active' then
    raise exception 'A4/1 POST: the NSP arm or the is_active gate was damaged — over-reach';
  end if;

  ---------------------------------------------------------------------------
  -- 2. app.can_read_case_or_admin — drop the trailing org OR (F1: collapses).
  ---------------------------------------------------------------------------
  d_old := pg_get_functiondef('app.can_read_case_or_admin(uuid,uuid)'::regprocedure);
  d_new := regexp_replace(
    d_old,
    'return app\.can_read_case\(p_case_id, p_uid\)\s+or app\.is_commission_admin_of_for\(app\.commission_of_case\(p_case_id\), p_uid\);',
    E'-- A4 (D4·3): the org arm is GONE. The wrapper is now a pure projection of\n'
    || E'  -- can_read_case behind the same hard deny (F1: proven byte-equivalent to\n'
    || E'  -- can_read_case over the population). Retired at Stage G.\n'
    || E'  return app.can_read_case(p_case_id, p_uid);'
  );
  if d_new = d_old then
    raise exception 'A4/2: can_read_case_or_admin org OR not matched — body drifted';
  end if;
  execute d_new;
  d_new := regexp_replace(pg_get_functiondef('app.can_read_case_or_admin(uuid,uuid)'::regprocedure), '--[^\n]*', '', 'g');
  if d_new ~ 'is_commission_admin_of' then
    raise exception 'A4/2 POST: an org arm survives in can_read_case_or_admin';
  end if;
  if d_new !~ 'is_case_respondent' or d_new !~ 'is_recused_from_case' then
    raise exception 'A4/2 POST: the wrapper hard deny was damaged';
  end if;

  ---------------------------------------------------------------------------
  -- 3. app.can_read_attachment — drop the org OR from the 'interview' arm ONLY.
  --    The 'meeting' arm KEEPS its org term (A8/A9's unit, not A4).
  ---------------------------------------------------------------------------
  d_old := pg_get_functiondef('app.can_read_attachment(text,uuid,uuid)'::regprocedure);
  d_new := regexp_replace(
    d_old,
    'app\.can_read_case\(app\.case_of_interview\(p_owner_id\), p_uid\)\s+or app\.is_commission_admin_of_for\(app\.commission_of_interview\(p_owner_id\), p_uid\)',
    'app.can_read_case(app.case_of_interview(p_owner_id), p_uid)   -- A4: org arm removed (D4.2)'
  );
  if d_new = d_old then
    raise exception 'A4/3: can_read_attachment interview arm not matched — body drifted';
  end if;
  execute d_new;
  -- post: exactly ONE is_commission_admin_of_for remains (the meeting arm); the
  -- interview arm no longer names commission_of_interview beside an org term.
  d_new := regexp_replace(pg_get_functiondef('app.can_read_attachment(text,uuid,uuid)'::regprocedure), '--[^\n]*', '', 'g');
  n_admin_for := (length(d_new) - length(replace(d_new, 'is_commission_admin_of_for', ''))) / length('is_commission_admin_of_for');
  if n_admin_for <> 1 then
    raise exception 'A4/3 POST: expected exactly 1 org arm (the meeting arm) to survive, found %', n_admin_for;
  end if;
  if d_new !~ 'is_commission_admin_of_for\(app\.commission_of_meeting' then
    raise exception 'A4/3 POST: the meeting arm org term was removed — over-reach into A8/A9''s unit';
  end if;
  if d_new ~ 'is_commission_admin_of_for\(app\.commission_of_interview' then
    raise exception 'A4/3 POST: the interview arm org term survived — under-reach';
  end if;

  ---------------------------------------------------------------------------
  -- 4. app.can_write_interview — drop the org arm.
  -- ⛔ WHY THIS IS TARGET 4 AND NOT OPTIONAL (found by 235's K2). The interview-family
  -- policies (case_interview_{subjects,links,interviewers}_write, interview_sessions_write,
  -- case_interviews_{update,delete}) all route `can_write_interview` as their residual
  -- arm after A4 drops THEIR org arm. But `can_write_interview` ITSELF carries the org
  -- arm — so removing it from the policies is a **NO-OP for the org_admin** (A21's "D4·1
  -- is a no-op as specified", recursed to the residual predicate; §7.6: a removal is only
  -- as strong as the predicate the residual routes). Because those write policies are
  -- FOR ALL, the org_admin READ interview subjects/links/interviewers through this arm.
  -- Removing it here is the WRITE-side of the interview family A21·1 already mandates
  -- ("remove read AND write"): coordinators (is_staff_admin_of_for) and interviewers keep
  -- write; only the org_admin loses it. Verified: after removal an org_admin resolves
  -- can_write_interview = false and reads 0 interview subjects (235 K2).
  ---------------------------------------------------------------------------
  d_old := pg_get_functiondef('app.can_write_interview(uuid,uuid)'::regprocedure);
  d_new := regexp_replace(
    d_old,
    '\s+or app\.is_commission_admin_of_for\(i\.commission_id, p_uid\)',
    ''
  );
  if d_new = d_old then
    raise exception 'A4/4: can_write_interview org arm not matched — body drifted';
  end if;
  execute d_new;
  d_new := regexp_replace(pg_get_functiondef('app.can_write_interview(uuid,uuid)'::regprocedure), '--[^\n]*', '', 'g');
  if d_new ~ 'is_commission_admin_of' then
    raise exception 'A4/4 POST: an org arm survives in can_write_interview';
  end if;
  if d_new !~ 'is_staff_admin_of_for' or d_new !~ 'is_case_excluded' then
    raise exception 'A4/4 POST: the coordinator arm or the exclusion was damaged — over-reach';
  end if;
end;
$mig$;

-- ACLs unchanged (bodies re-emitted in place; pg keeps the grants on CREATE OR REPLACE).

-- -----------------------------------------------------------------------------
-- POLICY EDITS — remove the org arm. ALTER POLICY preserves cmd/roles/permissive.
-- Every FOR ALL policy's USING == WITH CHECK; both are reset. The residual arm on
-- each carries the read-predicate perimeter (is_staff_admin_of / can_write_interview),
-- so the deny reaches it.
-- -----------------------------------------------------------------------------

-- A21's eight FOR ALL case tables --------------------------------------------
alter policy cases_staff_admin_write on public.cases
  using ( app.is_staff_admin_of(commission_id) and (not app.is_case_excluded(id, auth.uid())) )
  with check ( app.is_staff_admin_of(commission_id) and (not app.is_case_excluded(id, auth.uid())) );

alter policy case_narratives_staff_admin_write on public.case_narratives
  using ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) )
  with check ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) );

alter policy case_phases_staff_admin_write on public.case_phases
  using ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) )
  with check ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) );

alter policy case_events_staff_admin_write on public.case_events
  using ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) )
  with check ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) );

alter policy case_offered_outcomes_staff_admin_write on public.case_offered_outcomes
  using ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) )
  with check ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) );

alter policy case_tag_assignments_staff_admin_write on public.case_tag_assignments
  using ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) )
  with check ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) );

alter policy case_phase_allowed_results_staff_admin_write on public.case_phase_allowed_results
  using ( app.is_staff_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id))) and (not app.is_case_excluded(app.case_of_case_phase(case_phase_id), auth.uid())) )
  with check ( app.is_staff_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id))) and (not app.is_case_excluded(app.case_of_case_phase(case_phase_id), auth.uid())) );

alter policy case_phase_offered_results_staff_admin_write on public.case_phase_offered_results
  using ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) )
  with check ( app.is_staff_admin_of(app.commission_of_case(case_id)) and (not app.is_case_excluded(case_id, auth.uid())) );

-- interview family (7) -- A22's "single place" is false; these carried the org arm ---
-- The residual `can_write_interview` carries its own respondent/recusal deny, so
-- removing the org arm ALSO closes the missing-top-level-exclusion gap FOR FREE on the
-- three that lacked it (interview_sessions_write, case_interviews_update/_delete).
alter policy case_interview_subjects_write on public.case_interview_subjects
  using ( app.can_write_interview(interview_id, auth.uid()) and (not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid())) )
  with check ( app.can_write_interview(interview_id, auth.uid()) and (not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid())) );

alter policy case_interview_links_write on public.case_interview_links
  using ( app.can_write_interview(interview_id, auth.uid()) and (not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid())) )
  with check ( app.can_write_interview(interview_id, auth.uid()) and (not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid())) );

alter policy case_interview_interviewers_write on public.case_interview_interviewers
  using ( app.can_write_interview(interview_id, auth.uid()) and (not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid())) )
  with check ( app.can_write_interview(interview_id, auth.uid()) and (not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid())) );

alter policy interview_sessions_write on public.interview_sessions
  using ( app.can_write_interview(interview_id, (select auth.uid())) )
  with check ( app.can_write_interview(interview_id, (select auth.uid())) );

alter policy case_interviews_update on public.case_interviews
  using ( app.can_write_interview(id, auth.uid()) )
  with check ( app.can_write_interview(id, auth.uid()) );

alter policy case_interviews_delete on public.case_interviews
  using ( app.can_write_interview(id, auth.uid()) );

alter policy case_interviews_insert on public.case_interviews
  with check ( app.is_staff_admin_of(commission_id) );

-- action_items — SCOPED. Org arm removed for case_restricted ONLY (trap 2 avoidance).
-- `committee` / `assignees_only` keep the org arm (commission governance). `IS DISTINCT
-- FROM` is defensive (visibility_scope is NOT NULL default 'committee' today, but a
-- future nullable path must not silently deny the org arm).
alter policy action_items_staff_admin_write on public.action_items
  using ( app.is_staff_admin_of(commission_id)
          or (app.is_commission_admin_of(commission_id) and visibility_scope is distinct from 'case_restricted') )
  with check ( app.is_staff_admin_of(commission_id)
          or (app.is_commission_admin_of(commission_id) and visibility_scope is distinct from 'case_restricted') );

-- storage (2 SELECT) — org arm removed; the is_member_of arm stays for the perimeter unit.
alter policy case_documents_select_member on storage.objects
  using ( (bucket_id = 'case-documents')
          and ( app.is_member_of(((storage.foldername(name))[1])::uuid)
                or app.can_read_snapshot_document(name, auth.uid()) ) );

alter policy interview_attachments_obj_select_member on storage.objects
  using ( (bucket_id = 'interview-attachments')
          and app.is_member_of(((storage.foldername(name))[1])::uuid) );
