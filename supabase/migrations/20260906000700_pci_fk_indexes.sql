-- PCI/M6 (process-case integrity audit, finding M6) — index the unindexed FK
-- columns in the process/case cluster.
--
-- Postgres indexes the REFERENCED side of a foreign key automatically (it must, to
-- enforce uniqueness) and the REFERENCING side never. So every FK column without
-- its own index turns any delete/update of the parent row into a sequential scan
-- of the child table, and the cost lands on operations that look unrelated —
-- deactivating a user, retiring a department, archiving a case type.
--
-- ── THE LIST IS DERIVED, NOT TRANSCRIBED ───────────────────────────────────────
--
-- Every entry below came out of a catalog query (pg_constraint ⋈ pg_index, "FK
-- whose leading index columns do not match its conkey"), not from reading the
-- audit notes. That caught `case_narrative_revisions.snapshotted_by`, which the
-- hand-written finding had missed. Re-run the same query after this migration and
-- the cluster returns zero rows.
--
-- ── ONE COMPOSITE ──────────────────────────────────────────────────────────────
--
-- `case_phases (form_version_id, form_id)` is deliberately composite and
-- deliberately in that column order: 20260906000500 replaces the single-column
-- form_version FK with the composite (form_version_id, form_id) -> form_versions
-- (id, form_id), and an FK is served only by an index whose LEADING columns match
-- its referencing columns in order. A plain index on form_version_id alone would
-- leave the new FK unserved. `form_id` still gets its own index for
-- case_phases_form_id_fkey -> forms.
--
-- Plain CREATE INDEX (not CONCURRENTLY): migrations run inside a transaction,
-- where CONCURRENTLY is not permitted, and every table here is small pre-pilot.
--
-- No mutation proof — an index changes no observable behaviour, so a behavioural
-- keystone would be vacuous by construction. §M6 of the pgTAP suite instead
-- asserts the catalog property directly: zero unindexed FKs remain in the cluster.

create index if not exists case_custom_field_values_template_field_idx
  on public.case_custom_field_values (template_field_id);

create index if not exists case_narrative_revisions_correction_request_idx
  on public.case_narrative_revisions (correction_request_id);

create index if not exists case_narrative_revisions_snapshotted_by_idx
  on public.case_narrative_revisions (snapshotted_by);

create index if not exists case_narratives_concluded_by_idx
  on public.case_narratives (concluded_by);

create index if not exists case_narratives_created_by_idx
  on public.case_narratives (created_by);

create index if not exists case_narratives_updated_by_idx
  on public.case_narratives (updated_by);

create index if not exists case_phases_assignment_role_idx
  on public.case_phases (assignment_role_id);

create index if not exists case_phases_current_response_idx
  on public.case_phases (current_response_id);

create index if not exists case_phases_form_idx
  on public.case_phases (form_id);

-- Column order is load-bearing — see the header.
create index if not exists case_phases_form_version_idx
  on public.case_phases (form_version_id, form_id);

create index if not exists case_phases_result_override_idx
  on public.case_phases (result_override_id);

create index if not exists cases_case_type_idx
  on public.cases (case_type_id);

create index if not exists cases_closed_by_idx
  on public.cases (closed_by);

create index if not exists cases_created_by_idx
  on public.cases (created_by);

create index if not exists cases_department_idx
  on public.cases (department_id);

create index if not exists cases_organization_idx
  on public.cases (organization_id);

create index if not exists process_templates_case_type_idx
  on public.process_templates (case_type_id);

create index if not exists process_templates_created_by_idx
  on public.process_templates (created_by);
