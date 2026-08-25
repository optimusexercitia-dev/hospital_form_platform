-- ============================================================================
-- PDF·P3 (ADR 0144 D8) — `app.can_read_full_case_content`, the A7 full-sight
-- conjunct for the case kind, plus the COMMENT ADR 0104 has owed the meeting
-- twin since P2.
--
-- ADR 0104 Amendment **A7**: where a domain masks content PER CALLER, the right
-- to mint is `reach AND unmasked-full-content`, applied to mint AND download
-- alike, because the canonical bytes are always the COMPLETE artifact. A PDF is
-- ONE frozen view; arm-parity is not content-parity.
--
-- ⚠ **MEASURED 2026-08-25, and the answer was WIDER than D8 assumed.** D8 named
--    one masking axis (deliberation). The live SELECT policies over the tables
--    `src/lib/pdf/documents/case.ts` renders carry SIX distinct ones:
--
--      A  read_case_deliberation — `app.is_oversight_only_reader` is exactly
--         "content without deliberation", and `app.resolve_document_version_bytes`
--         ALREADY refuses case-homed BYTES on this same bit (QO·B P0-1). This
--         predicate is the mint-side mirror of a download-side rule that shipped.
--      B  case_events.visibility = 'coordinator_only' — `case_events_select`
--         adds `app.is_staff_admin_of(...)` for anything that is not
--         'case_readers'.
--      C  phase ANSWERS — `responses_select` / `answers_select` admit the
--         creator, a staff_admin over a SUBMITTED row, the correction corridor
--         and the targeted-respondent corridor. ⭐ A plain committee member
--         holding read_case_content sees the PHASES and none of the ANSWERS.
--      D  interviews — `app.can_read_interview` (committee reach AND
--         confidentiality clearance).
--      E  action items — `assignees_only` / `case_restricted` scopes.
--      F  meeting links — `meeting_cases_select` needs `can_reach_meeting` PER
--         MEETING; a case discussed in a meeting the caller cannot reach is a
--         masked line.
--      G  referrals — `app.can_read_referral` for the frozen snapshot + reply.
--
--    Every remaining dossier table (`case_narratives`, `case_participants`,
--    `case_phases`, `case_tag_assignments`, `case_correction_requests`) gates on
--    plain `app.can_read_case`, so the reach conjunct already covers them and
--    they get NO axis of their own. That is a measurement, not an omission.
--
-- ⛔ **DO NOT COPY `app.can_read_full_meeting_content`'s SHAPE.** That predicate
--    is a single `not exists (...)` over agenda rows, which makes it FAIL-OPEN
--    STANDALONE: a meeting with zero agenda items has nothing to find, the
--    NOT EXISTS is vacuously true, and it returns TRUE for a caller who cannot
--    reach the meeting at all. It is safe only because
--    `app.can_view_printed_document` never calls it except behind
--    `app.can_reach_meeting`. ADR 0104's own P3 note owed it a COMMENT saying so;
--    that debt is paid at the bottom of this file.
--
--    The case twin is fail-CLOSED standalone by CONSTRUCTION, not by care: the
--    two leading conjuncts are capability tests, and `app._case_caps` returns 0
--    for a null uid (STEP 1), an inactive principal (STEP 2), an UNKNOWN CASE
--    (STEP 3, `v_commission is null`) and for a respondent or a recused user
--    (STEP 4's hard deny). So an empty case, a deleted case and a bare call all
--    return FALSE before any `not exists` is evaluated. The per-axis arms below
--    are individually vacuous-true on zero rows — which is CORRECT ("no masked
--    content exists ⇒ nothing is masked") and is safe only because they are
--    AND-ed after a conjunct that cannot be vacuous. pgTAP 368 proves the
--    standalone direction rather than trusting this paragraph.
-- ============================================================================

create or replace function app.can_read_full_case_content(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  -- ── FAIL-CLOSED PREAMBLE ────────────────────────────────────────────────
  -- Explicit, ahead of everything, so the fail direction is readable rather
  -- than inherited. `app._case_caps` would answer 0 here anyway; stating it
  -- means a future edit to the capability chain cannot quietly change it.
  if p_uid is null or p_case_id is null then
    return false;
  end if;
  select c.commission_id into v_commission from public.cases c where c.id = p_case_id;
  if v_commission is null then
    return false;                              -- unknown case: nothing to see
  end if;

  -- ── AXIS A — the deliberation bit ───────────────────────────────────────
  -- Content WITHOUT deliberation is `app.is_oversight_only_reader`'s exact bit
  -- shape (the S7 quality-reviewer arm, and the S8 administrativo arm on a
  -- locked case). Those readers get titles, never bodies — so they must not
  -- mint a dossier whose bytes contain the bodies.
  if not app.has_case_capability(p_case_id, p_uid, 'read_case_content') then
    return false;
  end if;
  if not app.has_case_capability(p_case_id, p_uid, 'read_case_deliberation') then
    return false;
  end if;

  -- ── AXIS B — coordinator-only timeline events ───────────────────────────
  if not app.is_staff_admin_of_for(v_commission, p_uid)
     and exists (
       select 1 from public.case_events e
        where e.case_id = p_case_id and e.visibility <> 'case_readers') then
    return false;
  end if;

  -- ── AXIS C — phase answers ──────────────────────────────────────────────
  -- The dossier INLINES each phase's response answers (D2), so the caller must
  -- be entitled to the printed form of every one of them.
  --
  -- ⭐ Reuses `app.can_view_printed_document`'s form_response arm rather than
  -- restating the `responses_select` disjunction, which would be a SECOND
  -- authority for one rule — this codebase's recurring drift class, and the very
  -- thing ADR 0104's single-dispatch design exists to avoid.
  -- ⚠ Termination, stated because the call LOOKS recursive: the `case` arm of
  -- that dispatch calls THIS function, and this call re-enters the dispatch with
  -- kind `'form_response'`, a different branch that calls nothing here. The
  -- chain is case → form_response → ∅, depth 2, fixed. It cannot deepen without
  -- someone routing a form_response through a case, which the dispatch's own
  -- `case` statement forbids.
  if exists (
    select 1
    from public.case_phases cp
    join public.responses r on r.id = cp.current_response_id
    where cp.case_id = p_case_id
      and not app.can_view_printed_document('form_response', r.id, p_uid)
  ) then
    return false;
  end if;

  -- ── AXIS D — interviews ─────────────────────────────────────────────────
  if exists (
    select 1 from public.case_interviews ci
     where ci.case_id = p_case_id
       and not app.can_read_interview(ci.id, p_uid)
  ) then
    return false;
  end if;

  -- ── AXIS E — action items ───────────────────────────────────────────────
  -- Mirrors `action_items_select`'s three scopes for the case-linked rows only.
  -- `committee` scope needs plain membership, which every capability source
  -- above already implies for a case-reaching principal, so it carries no arm.
  if exists (
    select 1 from public.action_items ai
     where coalesce(ai.source_case_id, ai.linked_case_id) = p_case_id
       and (
         (ai.visibility_scope = 'case_restricted'
          and not app.can_read_case_committee(p_case_id, p_uid))
         or (ai.visibility_scope = 'assignees_only'
             and not app.is_staff_admin_of_for(ai.commission_id, p_uid)
             and (ai.assigned_to is null or ai.assigned_to <> p_uid)
             and not exists (
               select 1 from public.action_item_assignments a
                where a.action_item_id = ai.id
                  and a.user_id = p_uid
                  and a.completed_at is null))
       )
  ) then
    return false;
  end if;

  -- ── AXIS F — meeting links ──────────────────────────────────────────────
  if exists (
    select 1 from public.meeting_cases mc
     where mc.case_id = p_case_id
       and not app.can_reach_meeting(mc.meeting_id, p_uid)
  ) then
    return false;
  end if;

  -- ── AXIS G — referrals ──────────────────────────────────────────────────
  -- `app.can_read_referral` (content), not `_metadata`: the dossier renders the
  -- frozen snapshot and the structured reply, not just the row's existence.
  if exists (
    select 1 from public.case_referral cr
     where cr.source_case_id = p_case_id
       and not app.can_read_referral(cr.id, p_uid)
  ) then
    return false;
  end if;

  return true;
end;
$$;

comment on function app.can_read_full_case_content(uuid, uuid) is
  'ADR 0104 A7 / ADR 0144 D8 — does this caller see the case dossier UNMASKED? '
  'Seven measured axes (deliberation · coordinator-only events · phase answers · '
  'interviews · action items · meeting links · referrals); every other dossier '
  'table gates on plain app.can_read_case and is covered by the reach conjunct. '
  '⭐ FAIL-CLOSED STANDALONE, unlike app.can_read_full_meeting_content: the '
  'leading conjuncts are capability tests, and app._case_caps returns 0 for a '
  'null uid, an inactive principal, an unknown case and a respondent/recused '
  'user — so no vacuous NOT EXISTS is ever reached on an empty case. Proven by '
  'pgTAP 368, not by this comment. ⚠ Its axis list is coupled to what '
  'src/lib/pdf/documents/case.ts renders: a new template section over a table '
  'with a per-caller SELECT policy needs a new axis here.';

-- ---------------------------------------------------------------------------
-- ADR 0104's outstanding P3 debt, paid: the meeting twin's fail direction, in
-- the catalog, where the next reader of that function will actually see it.
-- ⛔ NO BEHAVIOUR CHANGE — this is a COMMENT only. Rewriting the meeting
-- predicate to be fail-closed standalone would move a shipped, QA-approved
-- authorization boundary inside a phase that is not about meetings; ADR 0144 D10
-- files the meeting kind's sibling gap the same way rather than fixing it here.
-- ---------------------------------------------------------------------------
comment on function app.can_read_full_meeting_content(uuid, uuid) is
  '⛔ FAIL-OPEN STANDALONE — a single NOT EXISTS over meeting_agenda_items, so a '
  'meeting with zero agenda rows (or an id that does not exist) returns TRUE for '
  'ANY caller, including one who cannot reach the meeting at all. It is safe '
  'ONLY behind app.can_reach_meeting, which is how its one consumer '
  '(app.can_view_printed_document''s meeting arm) calls it. ⛔ NEVER call it '
  'bare, and never copy its shape — app.can_read_full_case_content is the '
  'fail-closed pattern (ADR 0144 D8). Debt recorded by ADR 0104''s P3 note, paid '
  'in migration 20261003002300.';
