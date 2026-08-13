-- =============================================================================
-- ETH·E3a BE-3 — case_events procedural kinds + per-event visibility.
-- (plan §2.1 / §2.4; ADR 0064 D4.) Additive, forward-only, reset-OK.
--
--  * Widen the `kind` CHECK with the 8 ethics procedural kinds (the existing 6 stay
--    unchanged — additive only, no data migration).
--  * Add a `visibility` column (default 'case_readers' = today's behavior byte-for-
--    byte; 'coordinator_only' = an ADDITIONAL narrowing on top of can_read_case).
--  * Extend case_events_select as a NARROWING-only AND: can_read_case stays the floor
--    (unchanged); 'coordinator_only' ADDITIONALLY requires staff_admin / commission-
--    admin. Never an OR arm — a respondent/recused reader (denied by can_read_case)
--    sees NEITHER visibility regardless. Write policies are untouched.
-- =============================================================================

-- --- kind CHECK widen (additive) -------------------------------------------
alter table public.case_events drop constraint case_events_kind_check;
alter table public.case_events add constraint case_events_kind_check
  check (kind = any (array[
    -- existing (unchanged)
    'note', 'meeting', 'decision', 'interview', 'safety_event', 'other',
    -- NEW ethics procedural kinds (auto-derived by E2 RPCs — O-3, wired in BE-5)
    'admissibility_decided', 'allegation_added', 'finding_recorded',
    'notification_issued', 'hearing_scheduled', 'vote_cast',
    'decision_issued', 'appeal_submitted'
  ]));

-- --- per-event visibility ---------------------------------------------------
alter table public.case_events
  add column visibility text not null default 'case_readers'
    check (visibility in ('case_readers', 'coordinator_only'));

comment on column public.case_events.visibility is
  'E3a per-event visibility: case_readers (default = today''s behavior; every can_read_case-eligible reader sees it) or coordinator_only (an ADDITIONAL narrowing on top of can_read_case — never a widening; see case_events_select). Deliberation-sensitive auto-derived events (votes, findings) are written coordinator_only.';

-- --- narrowing-only SELECT extension ---------------------------------------
-- can_read_case is the FLOOR (unchanged). The appended AND only ever REMOVES the
-- coordinator_only subset from a non-coordinator reader; it can never add a reader
-- can_read_case already excludes.
alter policy case_events_select on public.case_events
  using (
    app.can_read_case(case_id, auth.uid())
    and (
      visibility = 'case_readers'
      or app.is_staff_admin_of(app.commission_of_case(case_id))
      or app.is_commission_admin_of(app.commission_of_case(case_id))
    )
  );
