-- ADR 0096 — Process-template versioning · M7: the RLS policy swap.
--
-- ============================================================================
-- THE D11 MIGRATION. This is the single most dangerous file in the phase.
-- ============================================================================
-- All eight policies below currently read app.commission_of_template(template_id).
-- They are DROPPED and RECREATED against app.commission_of_template_version.
--
-- The hazard is NOT "Postgres forgets to update the policy when the column
-- changes". It is the opposite, and it is worse: `ALTER TABLE ... RENAME COLUMN`
-- stores policy expressions as parsed node trees over column attnums, so a
-- rename REWRITES every policy FOR you — silently producing
-- app.commission_of_template(template_version_id), which looks a version id up
-- in process_templates.id, finds nothing, returns NULL, and makes
-- app.is_member_of(NULL) false. RLS then fails CLOSED: no error, no failing
-- deny-test, the feature simply goes blank for legitimate users.
--
-- That is why M2 added a new column instead of renaming, why the replacement
-- helper has a DISTINCT NAME (so a mis-keyed policy is greppable), and why the
-- pgTAP keystone for this asserts that the owning commission CAN STILL READ
-- ROWS. A fail-closed re-key passes every deny-side test ever written; only an
-- ALLOW arm catches it. See ADR 0096 Amendment A1.2.

drop policy process_template_phases_select on public.process_template_phases;
create policy process_template_phases_select
  on public.process_template_phases
  for select
  using (
    app.is_member_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  );

drop policy process_template_phases_staff_admin_write on public.process_template_phases;
create policy process_template_phases_staff_admin_write
  on public.process_template_phases
  for all
  using (
    app.is_staff_admin_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  );

drop policy process_template_narratives_select on public.process_template_narratives;
create policy process_template_narratives_select
  on public.process_template_narratives
  for select
  using (
    app.is_member_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  );

drop policy process_template_narratives_staff_admin_write on public.process_template_narratives;
create policy process_template_narratives_staff_admin_write
  on public.process_template_narratives
  for all
  using (
    app.is_staff_admin_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  );

drop policy process_template_outcomes_select on public.process_template_outcomes;
create policy process_template_outcomes_select
  on public.process_template_outcomes
  for select
  using (
    app.is_member_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  );

drop policy process_template_outcomes_staff_admin_write on public.process_template_outcomes;
create policy process_template_outcomes_staff_admin_write
  on public.process_template_outcomes
  for all
  using (
    app.is_staff_admin_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  );

drop policy process_template_custom_fields_select on public.process_template_custom_fields;
create policy process_template_custom_fields_select
  on public.process_template_custom_fields
  for select
  using (
    app.is_member_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  );

drop policy process_template_custom_fields_staff_admin_write on public.process_template_custom_fields;
create policy process_template_custom_fields_staff_admin_write
  on public.process_template_custom_fields
  for all
  using (
    app.is_staff_admin_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template_version(template_version_id))
    or app.is_commission_admin_of(app.commission_of_template_version(template_version_id))
  );

-- ---------------------------------------------------------------------------
-- Migration-time D11 sweep.
--
-- The pgTAP keystone is the real proof, but it only runs on `npm run test:db`.
-- This block runs during `supabase db push` too, so a mis-keyed policy can never
-- reach the remote silently. `commission_of_template\(` requires the literal
-- paren, so it does NOT match commission_of_template_version( — the whole point
-- of giving the replacement a distinct name.
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  select string_agg(tablename || '.' || policyname, ', ')
    into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'process_template_phases', 'process_template_narratives',
      'process_template_outcomes', 'process_template_custom_fields'
    )
    and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'commission_of_template\(';

  if v_bad is not null then
    raise exception
      'D11: políticas de tabela-filha ainda resolvem pelo helper de IDENTIDADE (%). '
      'Isso falha FECHADO e é invisível a testes de negação.', v_bad
      using errcode = 'check_violation';
  end if;
end;
$$;
