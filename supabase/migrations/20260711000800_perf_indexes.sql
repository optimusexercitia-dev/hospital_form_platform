-- =============================================================================
-- WS-5 · Cheap pre-launch performance — P1 (app-side), P9 (indexes + auth.uid wraps),
--        P10 (unindexed FK columns). P7 (audit_log partition) is DEFERRED — see below.
-- =============================================================================
-- Pre-pilot DB hardening, the perf wave. Detail:
--   docs/plans/pre-pilot-db-hardening-program.md §1 WS-5;
--   docs/reviews/external-db-audit-2026-07-perf-datamodel-analysis.md §1 (P1/P7/P9/P10).
--
-- P7 DEFERRED (recorded, not done): declarative range-partitioning audit_log by
-- occurred_at would force the partition key into EVERY unique index — including each of
-- the four partial-unique per-chain seq indexes (commission/hospital/org/platform). That
-- turns `(chain_key, seq)` into `(chain_key, seq, occurred_at)`, which would ALLOW the
-- same seq for a chain in two different months and BREAK the global-per-chain
-- monotonic-and-gap-free seq invariant the hash chain + verify_audit_chain depend on. A
-- wrong partition on the tamper-evidence table is worse than none, even while empty. If
-- audit volume ever demands partitioning, the correct axis is chain_key LIST/HASH (NOT
-- time) — a designed track, backlogged alongside D3. So P7 is intentionally omitted here.
--
-- P1 (getSessionContext React cache()) is an app-side one-liner (src/lib/queries/
-- session.ts), NOT a migration. Reset-OK.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- P9 · Composite indexes for the hot membership/audit lookups (only the 2 missing;
--      commission_members(commission_id,user_id) + pqs_members(hospital_id,user_id)
--      already exist).
-- -----------------------------------------------------------------------------
-- getSessionContext reads organization_members by user_id (+ role); the existing
-- identity unique leads with organization_id, so it does not serve a user_id-first scan.
create index if not exists organization_members_user_role_hosp_idx
  on public.organization_members using btree (user_id, role, hospital_id);

-- The hospital-tier audit rollup (NSP-per-hospital) has no usable index — only
-- (commission_id, occurred_at) exists. Partial to match the hospital-tier query shape
-- and stay small (commission-tier rows carry hospital_id too but read via the other idx).
create index if not exists audit_log_hospital_occurred_idx
  on public.audit_log using btree (hospital_id, occurred_at desc)
  where hospital_id is not null;

-- -----------------------------------------------------------------------------
-- P10 · Index the unindexed cascade/lookup FK columns. (The program's new FK columns
--       — capa_plan.hospital_id, pqs_*_types.hospital_id — are already backed by their
--       unique constraints / explicit indexes, so they are skipped here.)
-- -----------------------------------------------------------------------------
create index if not exists answers_group_instance_idx
  on public.answers using btree (group_instance_id) where group_instance_id is not null;
create index if not exists answers_form_version_idx
  on public.answers using btree (form_version_id);
create index if not exists responses_last_section_idx
  on public.responses using btree (last_section_id) where last_section_id is not null;
create index if not exists case_phases_result_idx
  on public.case_phases using btree (result_id) where result_id is not null;
create index if not exists commission_members_title_idx
  on public.commission_members using btree (title_id) where title_id is not null;

-- -----------------------------------------------------------------------------
-- P9 · (select auth.uid()) InitPlan wraps on the HOT-table policies. auth.uid() is
--      STABLE, so `(select auth.uid())` is evaluated ONCE per query (InitPlan) instead
--      of per candidate row — a documented Supabase win, SEMANTICALLY IDENTICAL. Scoped
--      to the 9 highest-velocity direct-auth.uid() policies (answers / selections /
--      responses / cases / organization_members); helper-predicate policies
--      (is_staff_admin_of, …) can't be InitPlan'd (their arg varies per row) and are the
--      separate deferred helper-inlining track, NOT touched here. Policies can't be
--      ALTERed in place → drop + recreate. Meaning-preserving; the RLS pgTAP suites
--      (40/70/80/30/172/184/189) prove it on the green run.
-- -----------------------------------------------------------------------------

-- answers -------------------------------------------------------------------
drop policy if exists answers_select on public.answers;
create policy answers_select on public.answers for select to authenticated
  using (exists (
    select 1 from public.responses r
    where r.id = answers.response_id
      and (r.created_by = (select auth.uid())
           or app.is_commission_admin_of(r.commission_id)
           or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)))));

drop policy if exists answers_write_own_draft on public.answers;
create policy answers_write_own_draft on public.answers for all to authenticated
  using (exists (
    select 1 from public.responses r
    where r.id = answers.response_id
      and r.created_by = (select auth.uid()) and r.status = 'in_progress'))
  with check (exists (
    select 1 from public.responses r
    where r.id = answers.response_id
      and r.created_by = (select auth.uid()) and r.status = 'in_progress'));

-- answer_selected_options ---------------------------------------------------
drop policy if exists answer_selected_options_select on public.answer_selected_options;
create policy answer_selected_options_select on public.answer_selected_options for select to authenticated
  using (exists (
    select 1 from public.answers a join public.responses r on r.id = a.response_id
    where a.id = answer_selected_options.answer_id
      and (r.created_by = (select auth.uid())
           or app.is_commission_admin_of(r.commission_id)
           or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)))));

drop policy if exists answer_selected_options_write_own_draft on public.answer_selected_options;
create policy answer_selected_options_write_own_draft on public.answer_selected_options for all to authenticated
  using (exists (
    select 1 from public.answers a join public.responses r on r.id = a.response_id
    where a.id = answer_selected_options.answer_id
      and r.created_by = (select auth.uid()) and r.status = 'in_progress'))
  with check (exists (
    select 1 from public.answers a join public.responses r on r.id = a.response_id
    where a.id = answer_selected_options.answer_id
      and r.created_by = (select auth.uid()) and r.status = 'in_progress'));

-- responses -----------------------------------------------------------------
drop policy if exists responses_select on public.responses;
create policy responses_select on public.responses for select to authenticated
  using (created_by = (select auth.uid())
         or app.is_commission_admin_of(commission_id)
         or (status = 'submitted' and app.is_staff_admin_of(commission_id)));

drop policy if exists responses_insert_own on public.responses;
create policy responses_insert_own on public.responses for insert to authenticated
  with check (created_by = (select auth.uid()) and app.is_member_of(commission_id));

drop policy if exists responses_update_own_draft on public.responses;
create policy responses_update_own_draft on public.responses for update to authenticated
  using (created_by = (select auth.uid()) and status = 'in_progress')
  with check (created_by = (select auth.uid()));

-- cases ---------------------------------------------------------------------
drop policy if exists cases_select on public.cases;
create policy cases_select on public.cases for select to authenticated
  using (app.can_read_case(id, (select auth.uid()))
         or app.is_commission_admin_of(app.commission_of_case(id)));

-- organization_members ------------------------------------------------------
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members for select to authenticated
  using (app.is_admin()
         or app.is_org_admin_of(organization_id)
         or user_id = (select auth.uid()));
comment on policy organization_members_select on public.organization_members is
  'A member reads their OWN grants (user_id = auth.uid()) so getSessionContext can resolve hospital_admin/nsp_org_admin standing (ADR 0051); an admin/org_admin reads the full org roster. Minimum-necessary. WS-5 P9: auth.uid() InitPlan-wrapped (semantically identical).';
