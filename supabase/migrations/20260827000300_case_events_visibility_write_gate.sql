-- =============================================================================
-- ETH·E3a BE-6 (FE-C) — coordinator gate for the manual case_events.visibility write.
--
-- The manual create path is a DIRECT RLS-gated insert (createCaseEvent server action;
-- no RPC). BE-3 added `visibility`; the write policies did not restrict its VALUE, so a
-- can_write_case_content writer could set `coordinator_only` via direct PostgREST. Gate
-- it in the DB (not just the action): a writer may only write `coordinator_only` if they
-- are staff_admin / commission_admin of the case's commission — mirroring the auto-derive
-- (BE-5) coordinator posture. `case_readers` stays writable by any legitimate writer.
--
-- WITH CHECK only (controls the VALUE written); USING is unchanged. staff_admin_write is
-- untouched (it already requires staff_admin, so coordinator_only is inherently allowed).
-- DEFINER auto-derive (BE-5) bypasses RLS, so it is unaffected. Policy-only change → no
-- new RPC, no t19, no type change.
-- =============================================================================

alter policy case_events_writer_write on public.case_events
  with check (
    app.can_write_case_content(case_id, auth.uid())
    and (
      visibility = 'case_readers'
      or app.is_staff_admin_of(app.commission_of_case(case_id))
      or app.is_commission_admin_of(app.commission_of_case(case_id))
    )
  );
