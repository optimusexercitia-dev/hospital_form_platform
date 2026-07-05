-- WS-5 · Cheap pre-launch performance (P9 indexes + auth.uid wraps, P10 FK indexes).
-- Migration: 20260711000800_perf_indexes.sql. (P7 audit_log partition DEFERRED.)
--
-- The lock: this suite fails if a P9/P10 index is dropped, or if a P9 auth.uid()
-- InitPlan wrap is silently reverted to a bare per-row auth.uid() on a hot policy.
-- The FUNCTIONAL correctness of the wrapped policies (no meaning change) is proven by
-- the existing RLS suites (40/70/80/30/172/184/189) on the green ordered run.
--
-- Covers:
--   §1 the 2 new P9 composite indexes exist.
--   §2 the 5 new P10 FK indexes exist.
--   §3 each of the 9 hot-table policies' predicate now contains ( SELECT auth.uid())
--      (the InitPlan wrap) and NO bare auth.uid() (locked against silent revert).

begin;
select plan(16);

-- ============================================================================
-- §1: P9 composite indexes.
-- ============================================================================
select has_index('public', 'organization_members', 'organization_members_user_role_hosp_idx',
  '1.1: organization_members(user_id, role, hospital_id) composite index exists');
select has_index('public', 'audit_log', 'audit_log_hospital_occurred_idx',
  '1.2: audit_log(hospital_id, occurred_at DESC) partial index exists');

-- ============================================================================
-- §2: P10 unindexed-FK indexes.
-- ============================================================================
select has_index('public', 'answers', 'answers_group_instance_idx',
  '2.1: answers.group_instance_id indexed');
select has_index('public', 'answers', 'answers_form_version_idx',
  '2.2: answers.form_version_id indexed');
select has_index('public', 'responses', 'responses_last_section_idx',
  '2.3: responses.last_section_id indexed');
select has_index('public', 'case_phases', 'case_phases_result_idx',
  '2.4: case_phases.result_id indexed');
select has_index('public', 'commission_members', 'commission_members_title_idx',
  '2.5: commission_members.title_id indexed');

-- ============================================================================
-- §3: P9 auth.uid() InitPlan wraps — each of the 9 hot policies has ( SELECT auth.uid())
--     in its predicate and NO bare auth.uid(). A helper asserts both per policy.
-- ============================================================================
-- Helper: the combined USING+WITH CHECK expression text of a policy on a table.
create or replace function pg_temp.pol_expr(p_table text, p_policy text)
returns text language sql stable as $$
  select coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
         coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
  from pg_policy pol join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = p_table and pol.polname = p_policy;
$$;

-- ( SELECT auth.uid()) present AND no bare auth.uid() remains. pg_get_expr renders the
-- wrap as "( SELECT auth.uid() AS uid)"; a bare call renders as "auth.uid()" not
-- preceded by "SELECT ". Assert the wrapped form is present and the count of "auth.uid()"
-- occurrences all sit inside a SELECT (i.e. no occurrence lacks a preceding SELECT).
-- Simpler + robust: assert the predicate contains 'select auth.uid()' AND does NOT
-- contain a bare 'auth.uid()' outside a select — we check the wrapped marker is present
-- and that stripping every '( select auth.uid()...)' leaves no residual 'auth.uid('.
create or replace function pg_temp.is_wrapped(p_table text, p_policy text)
returns boolean language sql stable as $$
  select position('select auth.uid()' in lower(pg_temp.pol_expr(p_table, p_policy))) > 0
     and position('auth.uid()' in
           replace(lower(pg_temp.pol_expr(p_table, p_policy)), 'select auth.uid()', '')) = 0;
$$;

select ok(pg_temp.is_wrapped('answers','answers_select'),
  '3.1: answers_select wraps auth.uid() as ( select auth.uid())');
select ok(pg_temp.is_wrapped('answers','answers_write_own_draft'),
  '3.2: answers_write_own_draft wraps auth.uid()');
select ok(pg_temp.is_wrapped('answer_selected_options','answer_selected_options_select'),
  '3.3: answer_selected_options_select wraps auth.uid()');
select ok(pg_temp.is_wrapped('answer_selected_options','answer_selected_options_write_own_draft'),
  '3.4: answer_selected_options_write_own_draft wraps auth.uid()');
select ok(pg_temp.is_wrapped('responses','responses_select'),
  '3.5: responses_select wraps auth.uid()');
select ok(pg_temp.is_wrapped('responses','responses_insert_own'),
  '3.6: responses_insert_own wraps auth.uid()');
select ok(pg_temp.is_wrapped('responses','responses_update_own_draft'),
  '3.7: responses_update_own_draft wraps auth.uid()');
select ok(pg_temp.is_wrapped('cases','cases_select'),
  '3.8: cases_select wraps auth.uid()');
select ok(pg_temp.is_wrapped('organization_members','organization_members_select'),
  '3.9: organization_members_select wraps auth.uid()');

select * from finish();
rollback;
