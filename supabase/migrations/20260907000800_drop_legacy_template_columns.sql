-- ADR 0096 — Process-template versioning · M8: drop the legacy columns.
--
-- LAST in the sequence, and deliberately so. Every DROP below is an ASSERTION:
-- Postgres refuses to drop a column that a policy, index or constraint still
-- depends on, so if M7's policy swap had missed an arm, or a unique had not
-- been re-pointed in M4, this migration fails LOUDLY here rather than leaving a
-- fail-closed policy in production.
--
-- That forcing function is defence 1 of the three in ADR 0096 Amendment A1.2.
-- It is deliberately NOT the only defence — a policy recreated against the
-- WRONG helper would still satisfy the dependency and drop cleanly. Defence 2
-- (the distinct helper name + M7's migration-time sweep) and defence 3 (the
-- ALLOW-arm pgTAP keystone) cover that case.

-- ---------------------------------------------------------------------------
-- 1. Child tables: drop the legacy template_id.
--    The FK constraints and the *_template_idx indexes drop with the columns.
-- ---------------------------------------------------------------------------

alter table public.process_template_phases drop column template_id;
alter table public.process_template_narratives drop column template_id;
alter table public.process_template_outcomes drop column template_id;
alter table public.process_template_custom_fields drop column template_id;

-- ---------------------------------------------------------------------------
-- 2. cases: drop the legacy template_id.
--
-- This is the audit's ON DELETE SET NULL gap closing for good. The replacement
-- (cases.template_version_id, ON DELETE RESTRICT, added in M2) means a version a
-- case ran under can no longer be deleted out from under it.
--
-- Note this DOES remove the direct cases -> process_templates link. "All cases
-- of this process, across versions" is now a join through
-- process_template_versions. That is intentional: with title/description living
-- on the version (D1), the identity carries nothing a case reader wants, and
-- the provenance surface (CaseTemplateProvenance) projects templateId back out
-- of the join anyway.
-- ---------------------------------------------------------------------------

alter table public.cases drop column template_id;

-- ---------------------------------------------------------------------------
-- 3. process_templates becomes a bare identity (D1).
--
-- title / description / collects_patient / case_type_id now live on the version.
-- status is dropped outright (ADR 0096 Amendment A1.1 item 3): a template is
-- archived if and only if ALL of its versions are archived, which
-- archive_process_template now enforces by archiving every non-archived version.
--
-- The status CHECK constraint and the case_type_id index drop with their columns.
-- ---------------------------------------------------------------------------

alter table public.process_templates drop column title;
alter table public.process_templates drop column description;
alter table public.process_templates drop column status;
alter table public.process_templates drop column collects_patient;
alter table public.process_templates drop column case_type_id;

comment on table public.process_templates is
  'ADR 0096 — the process-template IDENTITY: a commission-scoped anchor owning an '
  'ordered list of process_template_versions. Carries no authored content; '
  'title/description/collects_patient/case_type_id live on the version (D1).';

-- ---------------------------------------------------------------------------
-- 4. Post-conditions. These run on `db push` against the populated remote.
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- No policy anywhere may still reference the identity-grain helper on a child
  -- table. (M7 asserted this too; re-asserted here because the column drops
  -- above are the point at which a survivor becomes unrecoverable.)
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
    raise exception 'D11: política ainda no grão de identidade: %', v_bad
      using errcode = 'check_violation';
  end if;

  -- Every template must still own at least one version. A template stranded
  -- without one would be invisible and un-editable in the UI.
  select t.id::text into v_bad
  from public.process_templates t
  where not exists (
    select 1 from public.process_template_versions v where v.template_id = t.id
  )
  limit 1;
  if v_bad is not null then
    raise exception 'processo % ficou sem nenhuma versão', v_bad
      using errcode = 'check_violation';
  end if;

  -- No template may carry two published versions (the partial unique index
  -- enforces this, but assert it explicitly so a future index drop is caught).
  select template_id::text into v_bad
  from public.process_template_versions
  where status = 'published'
  group by template_id
  having count(*) > 1
  limit 1;
  if v_bad is not null then
    raise exception 'processo % tem mais de uma versão publicada', v_bad
      using errcode = 'check_violation';
  end if;
end;
$$;
