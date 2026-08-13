-- QO·B M1 — org_admin / hospital_admin content wall: the response & answer plane.
--
-- ADR 0100 D12 ("org_admin FULL CONTENT WALL, A4-style"), classification ratified by
-- the PO on 2026-08-08 (docs/plans/quality-office-oversight-phase-b-inventory.md §6).
--
-- WHAT THIS SUBTRACTS, and why it is a clean cut:
--   app.is_commission_admin_of(_for) is NOT the commission's own admin. Read from the
--   live catalog, its body is
--       has_role('organization', c.organization_id, 'org_admin',      u)
--    OR has_role('hospital',     c.hospital_id,     'hospital_admin', u)
--   i.e. it is the TENANCY admin, and it returns FALSE for staff_admin (measured:
--   chefe.ccih -> false against CCIH). The committee's own coordinator is admitted by
--   the separate app.is_staff_admin_of disjunct that sits beside it in every policy
--   below. Removing the is_commission_admin_of term therefore subtracts EXACTLY
--   org_admin + hospital_admin and leaves the committee's own arm untouched.
--
-- MEASURED PRE-IMAGE (seeded local DB, under RLS as each principal):
--   responses               org_admin 36 · hospital_admin 36 · staff_admin 25 · staff 23
--   answers                 org_admin 81 · hospital_admin 81 · staff_admin 49 · staff 32
--   answer_selected_options org_admin 76 · hospital_admin 76 · staff_admin 51 · staff 35
--   The tenancy admins read MORE committee content than the committee's coordinator,
--   because they span every commission in the org/hospital.
--
-- ⚠ responses_admin_all was a bare FOR ALL tenancy grant with no other term. Proven by
--   execution before this migration: orgadmin.a DELETEd 6 in-progress responses owned
--   by other users (control: the same statement as plain staff removed 0 rows, RLS
--   having filtered them away). Submitted rows were saved only by the
--   guard_submitted_response trigger — a data-integrity guard, not an authorization
--   boundary. Filed as BUG-QOB-001. This migration is its fix.
--
-- The four answer satellites (matrix cells, references, risk matrix, group instances)
-- hold ZERO rows in the seed for every persona, so their cut is structurally correct
-- but NOT behaviourally observable on this fixture. The pgTAP suite makes a fixture
-- for them rather than letting an empty pre-image read as "no change".

begin;

-- ---------------------------------------------------------------------------
-- responses
-- ---------------------------------------------------------------------------

-- The whole policy goes: its only term was the tenancy-admin grant.
drop policy if exists responses_admin_all on public.responses;

drop policy if exists responses_select on public.responses;
create policy responses_select on public.responses
  as permissive for select to authenticated
  using (
    created_by = (select auth.uid())
    or (status = 'submitted' and app.is_staff_admin_of(commission_id))
    or app.can_read_correction_response(id, (select auth.uid()))
  );

comment on policy responses_select on public.responses is
  'QO·B (ADR 0100 D12): the tenancy-admin arm app.is_commission_admin_of is deliberately '
  'ABSENT. org_admin/hospital_admin hold administration and PHI-free aggregates, never '
  'row-level response content. Re-adding it re-opens the wall — see '
  'docs/plans/quality-office-oversight-phase-b-inventory.md.';

-- ---------------------------------------------------------------------------
-- answers
-- ---------------------------------------------------------------------------

drop policy if exists answers_select on public.answers;
create policy answers_select on public.answers
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.responses r
      where r.id = answers.response_id
        and ( r.created_by = (select auth.uid())
              or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)) )
    )
    or app.can_read_correction_response(response_id, (select auth.uid()))
  );

comment on policy answers_select on public.answers is
  'QO·B (ADR 0100 D12): tenancy-admin arm removed — see responses_select.';

-- ---------------------------------------------------------------------------
-- answer satellites — same shape, one level down through answers -> responses
-- ---------------------------------------------------------------------------

drop policy if exists answer_selected_options_select on public.answer_selected_options;
create policy answer_selected_options_select on public.answer_selected_options
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.answers a
        join public.responses r on r.id = a.response_id
      where a.id = answer_selected_options.answer_id
        and ( r.created_by = (select auth.uid())
              or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)) )
    )
    or exists (
      select 1 from public.answers a2
      where a2.id = answer_selected_options.answer_id
        and app.can_read_correction_response(a2.response_id, (select auth.uid()))
    )
  );

drop policy if exists answer_references_select on public.answer_references;
create policy answer_references_select on public.answer_references
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.answers a
        join public.responses r on r.id = a.response_id
      where a.id = answer_references.answer_id
        and ( r.created_by = (select auth.uid())
              or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)) )
    )
    or exists (
      select 1 from public.answers a2
      where a2.id = answer_references.answer_id
        and app.can_read_correction_response(a2.response_id, (select auth.uid()))
    )
  );

drop policy if exists answer_matrix_cells_select on public.answer_matrix_cells;
create policy answer_matrix_cells_select on public.answer_matrix_cells
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.answers a
        join public.responses r on r.id = a.response_id
      where a.id = answer_matrix_cells.answer_id
        and ( r.created_by = (select auth.uid())
              or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)) )
    )
    or exists (
      select 1 from public.answers a2
      where a2.id = answer_matrix_cells.answer_id
        and app.can_read_correction_response(a2.response_id, (select auth.uid()))
    )
    or exists (
      select 1 from public.answers a3
      where a3.id = answer_matrix_cells.answer_id
        and app.can_access_targeted_response(a3.response_id, (select auth.uid()))
    )
  );

drop policy if exists answer_risk_matrix_select on public.answer_risk_matrix;
create policy answer_risk_matrix_select on public.answer_risk_matrix
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.answers a
        join public.responses r on r.id = a.response_id
      where a.id = answer_risk_matrix.answer_id
        and ( r.created_by = (select auth.uid())
              or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)) )
    )
    or exists (
      select 1 from public.answers a2
      where a2.id = answer_risk_matrix.answer_id
        and app.can_read_correction_response(a2.response_id, (select auth.uid()))
    )
    or exists (
      select 1 from public.answers a3
      where a3.id = answer_risk_matrix.answer_id
        and app.can_access_targeted_response(a3.response_id, (select auth.uid()))
    )
  );

drop policy if exists response_group_instances_select on public.response_group_instances;
create policy response_group_instances_select on public.response_group_instances
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.responses r
      where r.id = response_group_instances.response_id
        and ( r.created_by = auth.uid()
              or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)) )
    )
  );

-- ---------------------------------------------------------------------------
-- Postcondition: the cut is real and complete for this wave's tables.
-- Fails the migration (and therefore `db reset`) if any of these policies ever
-- regains a tenancy-admin arm — the enumeration is DERIVED from pg_policies, not
-- a hardcoded list, so a policy added later to these tables is covered too.
-- ---------------------------------------------------------------------------
do $$
declare v_bad text;
begin
  select string_agg(tablename||'.'||policyname, ', ')
    into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename in ('responses','answers','answer_selected_options','answer_references',
                      'answer_matrix_cells','answer_risk_matrix','response_group_instances')
    and coalesce(qual,'')||' '||coalesce(with_check,'') ~ '\yis_commission_admin_of\y';
  if v_bad is not null then
    raise exception 'QO·B M1 postcondition: tenancy-admin arm still present on: %', v_bad;
  end if;

  -- Non-vacuity twin: the population this asserts over must be non-empty, or the
  -- check above passes for the wrong reason (no such policies at all).
  if (select count(*) from pg_policies
      where schemaname='public'
        and tablename in ('responses','answers','answer_selected_options','answer_references',
                          'answer_matrix_cells','answer_risk_matrix','response_group_instances')) = 0 then
    raise exception 'QO·B M1 postcondition is VACUOUS: no policies found on the response plane';
  end if;
end $$;

commit;
