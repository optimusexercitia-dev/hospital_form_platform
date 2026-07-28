-- FF-2 — the FOURTH parity gap, found by the systematic sweep rather than by the
-- review: the matrix AXIS tables do not carry the targeted-read arm that the rest
-- of the form-definition chain carries.
--
-- Live catalog, form-definition SELECT policies:
--   form_versions      → form_versions_select_targeted  (can_access_targeted_version) ✅
--   form_sections      → form_sections_select_targeted  (can_access_targeted_version) ✅
--   form_items         → form_items_select_targeted     (can_access_targeted_version) ✅
--   form_matrix_rows   → membership only                                              ❌
--   form_matrix_columns→ membership only                                              ❌
--
-- WHY IT MATTERS: B-1 lets a targeted respondent WRITE a matrix cell. Without
-- this they still cannot read the axis rows, so the wizard cannot render the grid
-- at all — the respondent gets an empty table with nothing to click, and the cell
-- they somehow saved redraws blank. A door that admits a write but not the read
-- that makes the write meaningful is half a feature; §O asserts the ROUND TRIP
-- for exactly this reason.
--
-- Caught by §O3 going red (`have: NULL want: dc_ok`) with the write already
-- succeeding — the write arm alone was not enough, and only asserting the read
-- back showed it.
--
-- Membership is preserved as the first arm; this is strictly additive, and a
-- targeted respondent already reads the items these axes belong to.

drop policy if exists form_matrix_rows_select on public.form_matrix_rows;
create policy form_matrix_rows_select on public.form_matrix_rows
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_version(form_version_id))
    or app.is_commission_admin_of(app.commission_of_version(form_version_id))
    or app.can_access_targeted_version(form_version_id, (select auth.uid()))
  );

drop policy if exists form_matrix_columns_select on public.form_matrix_columns;
create policy form_matrix_columns_select on public.form_matrix_columns
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_version(form_version_id))
    or app.is_commission_admin_of(app.commission_of_version(form_version_id))
    or app.can_access_targeted_version(form_version_id, (select auth.uid()))
  );

-- ⚠ REPORTED, DELIBERATELY NOT FIXED HERE — `form_item_options_select` has the
-- SAME gap and is NOT FF-2's table. Its consequence is that a targeted
-- respondent cannot read the options of a `multiple_choice` / `dropdown` /
-- `checkbox` question either, so ETH·E2's targeted flow renders those inputs
-- with no choices today, independently of matrices. That is a pre-existing
-- defect of the same family, recorded in PROGRESS.md for the lead to rule on
-- rather than widened silently into this phase's diff.
