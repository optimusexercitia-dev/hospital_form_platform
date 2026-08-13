-- =============================================================================
-- ETH·E3a P0-1 — case_events reader-non-writer split (ADR 0079).
--
-- SELECT on a table = the OR of EVERY permissive policy's USING, and a `cmd=ALL`
-- policy's USING participates in SELECT. `case_events_writer_write` was `FOR ALL` with a
-- BARE `USING (can_write_case_content(...))` — no visibility clause — so it re-admitted
-- EVERY event (incl. `coordinator_only`) to any content-WRITE grantee during SELECT,
-- bypassing `case_events_select`'s narrowing. QA proved the leak live (a write-granted
-- non-staff_admin saw a `coordinator_only` vote_cast).
--
-- Fix: make `case_events_select` the SOLE SELECT authority. Convert both `FOR ALL` write
-- policies to write-command-specific (INSERT/UPDATE/DELETE) policies — preserving their
-- existing USING/WITH CHECK (including the BE-6 `coordinator_only` insert gate) — so their
-- USING no longer serves SELECT. Policy-only; t19 N/A.
--
-- Post-fix read matrix (governed by case_events_select alone):
--   plain member (can_read_case, non-coord)           → case_readers only
--   write-grantee non-coord (can_read via grant)      → case_readers only, 0 coordinator_only
--   staff_admin / commission_admin (can_read_case)    → all incl. coordinator_only
--   respondent / recused                              → nothing (can_read_case floor)
-- Also closes the latent respondent-who-is-staff_admin read bypass: the old
-- staff_admin_write ALL-USING re-admitted rows above the floor; now _select's
-- can_read_case floor governs every read.
--
-- Requires can_write_case_content ⊆ can_read_case (a write-grantee still READS their
-- case_readers events via _select) — proven by the keystone in 267 (write-grantee reads
-- the case_readers event > 0 AND 0 coordinator_only).
-- =============================================================================

-- polcmd is immutable via ALTER → drop + recreate command-specific.
drop policy case_events_writer_write on public.case_events;
drop policy case_events_staff_admin_write on public.case_events;

-- --- content-writer: INSERT / UPDATE / DELETE (no SELECT arm) ---------------
create policy case_events_writer_insert on public.case_events
  for insert to authenticated
  with check (
    app.can_write_case_content(case_id, auth.uid())
    and (
      visibility = 'case_readers'
      or app.is_staff_admin_of(app.commission_of_case(case_id))
      or app.is_commission_admin_of(app.commission_of_case(case_id))
    )
  );

create policy case_events_writer_update on public.case_events
  for update to authenticated
  using (app.can_write_case_content(case_id, auth.uid()))
  with check (
    app.can_write_case_content(case_id, auth.uid())
    and (
      visibility = 'case_readers'
      or app.is_staff_admin_of(app.commission_of_case(case_id))
      or app.is_commission_admin_of(app.commission_of_case(case_id))
    )
  );

create policy case_events_writer_delete on public.case_events
  for delete to authenticated
  using (app.can_write_case_content(case_id, auth.uid()));

-- --- staff_admin: INSERT / UPDATE / DELETE (no SELECT arm) ------------------
create policy case_events_staff_admin_insert on public.case_events
  for insert to authenticated
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id))
    and not app.is_case_excluded(case_id, auth.uid())
  );

create policy case_events_staff_admin_update on public.case_events
  for update to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id))
    and not app.is_case_excluded(case_id, auth.uid())
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id))
    and not app.is_case_excluded(case_id, auth.uid())
  );

create policy case_events_staff_admin_delete on public.case_events
  for delete to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id))
    and not app.is_case_excluded(case_id, auth.uid())
  );
