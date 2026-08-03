-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration A: schema.
-- ADR 0093 (D2/D3/D4/D7 + Amendment 1 A1·2 + Amendment 2) +
-- docs/plans/phase-16-standards-crosswalk-program.md (Wave 1). Five tables:
-- accreditation_frameworks, accreditation_standards, evidence_links,
-- standard_assessments, standard_ownerships. RLS-on, no `authenticated` write
-- grant anywhere (indicators/documents posture) — every write is a Wave 2
-- DEFINER RPC. Audit triggers clone app.trg_audit_indicators. Flag
-- `accreditation` seeded OFF (app.feature_flags.enabled defaults TRUE — an
-- explicit `enabled = false` is required, Amendment 2 A2·3).
--
-- Scope: schema + RLS + audit only. `app.artifact_belongs_to_commission` /
-- `app.evidence_status_of` (Migration B), the RPCs/doors, and the seed packs
-- are NOT part of this migration.

-- ---------------------------------------------------------------------------
-- accreditation_frameworks
-- ---------------------------------------------------------------------------

create table public.accreditation_frameworks (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  version text not null,
  description text,
  -- NULL = a global admin-curated pack (ONA/JCI); set = a commission-owned
  -- clone that may carry pasted licensed manual text (D2).
  owner_commission_id uuid references public.commissions (id) on delete cascade,
  cloned_from_framework_id uuid references public.accreditation_frameworks (id) on delete set null,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_frameworks_status_check check (status in ('ativo', 'arquivado')),
  constraint accreditation_frameworks_key_not_blank check (btrim(key) <> ''),
  constraint accreditation_frameworks_name_not_blank check (btrim(name) <> ''),
  constraint accreditation_frameworks_version_not_blank check (btrim(version) <> '')
);

comment on table public.accreditation_frameworks is
  'Phase 16 (ADR 0093 D2). A global admin-curated skeleton pack (owner_commission_id NULL — ONA/JCI; codes + short titles + hierarchy + level ONLY, never description_md manual text) or a commission-owned clone (cloned_from_framework_id set) a staff_admin pasted licensed text into via clone_framework. PHI-free (Rule 12 N/A).';

comment on column public.accreditation_frameworks.description is
  'Short administrative blurb about the pack/edition (e.g. "ONA — edição 2024"). NOT the licensed manual text — that lives, skeleton-only by design, on accreditation_standards.description_md.';

-- Uniques (ADR 0093 Wave 1): one global (key, version) per key; one owned
-- (owner, key) per commission.
create unique index accreditation_frameworks_global_key_version_uq
  on public.accreditation_frameworks (key, version)
  where owner_commission_id is null;

create unique index accreditation_frameworks_owned_key_uq
  on public.accreditation_frameworks (owner_commission_id, key)
  where owner_commission_id is not null;

create index accreditation_frameworks_owner_idx
  on public.accreditation_frameworks (owner_commission_id)
  where owner_commission_id is not null;

create trigger touch_accreditation_frameworks_updated_at
  before update on public.accreditation_frameworks
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- accreditation_standards
-- ---------------------------------------------------------------------------

create table public.accreditation_standards (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.accreditation_frameworks (id) on delete cascade,
  parent_id uuid,
  code text not null,
  title text not null,
  description_md text,
  "position" integer not null default 0,
  -- ADR 0093 D3: 1 = Segurança, 2 = Gestão Integrada, 3 = Excelência; NULL for
  -- non-leveled (JCI-shaped) frameworks.
  level smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_standards_level_check check (level is null or level between 1 and 3),
  constraint accreditation_standards_code_not_blank check (btrim(code) <> ''),
  constraint accreditation_standards_title_not_blank check (btrim(title) <> ''),
  -- Referenced side of the same-framework composite parent FK below (mirrors
  -- the form_items_container_uq precedent: a self-FK needs a matching UNIQUE
  -- on the referenced columns).
  constraint accreditation_standards_id_framework_uq unique (id, framework_id),
  constraint accreditation_standards_framework_code_uq unique (framework_id, code)
);

comment on table public.accreditation_standards is
  'Phase 16 (ADR 0093 D2/D3). One node of a framework''s standard hierarchy. description_md is NULL on every global-pack row (skeleton-only) and populated only on a commission-owned clone, under the hospital''s own manual license. PHI-free (Rule 12 N/A).';

comment on column public.accreditation_standards.description_md is
  'Sanitized Markdown (Rule 7). NEVER populated on a global pack (D2 — no copyrighted manual text ships in the seed); populated only when a staff_admin pastes text into a commission-owned clone under their own license. Excluded from audit diffs (Rule 11) — licensed/long-form text never rides the audit trail.';

-- Same-framework parent: a child can only point at a parent in the SAME
-- framework (precedent: form_items_parent_item_id_fkey /
-- form_items_container_uq). Kept as a separate ALTER so the referenced
-- UNIQUE above is fully established first.
alter table public.accreditation_standards
  add constraint accreditation_standards_parent_fkey
  foreign key (parent_id, framework_id)
  references public.accreditation_standards (id, framework_id)
  on delete cascade;

create index accreditation_standards_parent_idx
  on public.accreditation_standards (parent_id)
  where parent_id is not null;

create trigger touch_accreditation_standards_updated_at
  before update on public.accreditation_standards
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- evidence_links
-- ---------------------------------------------------------------------------

create table public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  standard_id uuid not null references public.accreditation_standards (id) on delete cascade,
  -- ADR 0093 D4 + Amendment 1: the 8 (2026-07) + charter + ethics_procedure —
  -- the SAME 10 values as ArtifactKind in src/lib/accreditation/types.ts.
  -- Migration B's app.artifact_belongs_to_commission / app.evidence_status_of
  -- must carry one arm per value here — never drift the two lists apart.
  artifact_kind text not null,
  artifact_id uuid not null,
  note text,
  linked_by uuid references public.profiles (id),
  linked_at timestamptz not null default now(),
  constraint evidence_links_artifact_kind_check check (
    artifact_kind in (
      'form', 'form_version', 'meeting', 'case', 'indicator',
      'controlled_document', 'action_item', 'capa_plan', 'charter',
      'ethics_procedure'
    )
  ),
  -- Deliberately permits the SAME artifact uuid under both 'case' and
  -- 'ethics_procedure' — distinct evidentiary claims (plan Wave 1; pinned in
  -- E2E per phase16-accreditation-restricted.spec.ts).
  constraint evidence_links_unique unique (commission_id, standard_id, artifact_kind, artifact_id)
);

comment on table public.evidence_links is
  'Phase 16 (ADR 0093 D4/D5/D8). A commission''s claim that an artifact it already produced evidences a standard. Freshness (valida/atencao/vencida) is COMPUTED at read time from the artifact''s own lifecycle (app.evidence_status_of, Migration B) — never stored here. PHI-free (Rule 12 N/A); restricted targets (case/ethics_procedure) are masked at the read door, not here.';

comment on column public.evidence_links.note is
  'Free-text evidence note (governance metadata). PHI-FREE MODULE (Rule 12 N/A) — do NOT paste patient identifiers or clinical narrative here; if evidence needs patient context, link the case/ethics_procedure artifact itself rather than describing it here. Excluded from audit diffs (Rule 11) and from every hospital-tier/export surface (D8 — counts only, never note).';

create index evidence_links_standard_idx on public.evidence_links (standard_id);

-- ---------------------------------------------------------------------------
-- standard_assessments
-- ---------------------------------------------------------------------------

create table public.standard_assessments (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  standard_id uuid not null references public.accreditation_standards (id) on delete cascade,
  status text not null,
  assessed_by uuid references public.profiles (id),
  assessed_at timestamptz not null default now(),
  note_md text,
  constraint standard_assessments_status_check check (
    status in ('conforme', 'parcial', 'nao_conforme', 'nao_aplicavel')
  ),
  constraint standard_assessments_unique unique (commission_id, standard_id)
);

comment on table public.standard_assessments is
  'Phase 16 (ADR 0093 D3/D7). A commission''s self-assessed conformity against one standard — one row per (commission, standard), re-assessed in place (assessed_at advances). PHI-free (Rule 12 N/A).';

comment on column public.standard_assessments.note_md is
  'Assessor free-text rationale (sanitized Markdown, Rule 7). PHI-FREE MODULE (Rule 12 N/A) — do NOT paste patient identifiers or clinical narrative here. Excluded from audit diffs (Rule 11) and from every hospital-tier/export surface (D8 — the ReadinessRow / HospitalReadinessRow contract carries NO note field at all).';

create index standard_assessments_standard_idx on public.standard_assessments (standard_id);

-- ---------------------------------------------------------------------------
-- standard_ownerships
-- ---------------------------------------------------------------------------

create table public.standard_ownerships (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id) on delete cascade,
  standard_id uuid not null references public.accreditation_standards (id) on delete cascade,
  responsible_commission_id uuid not null references public.commissions (id) on delete cascade,
  assigned_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now(),
  constraint standard_ownerships_unique unique (hospital_id, standard_id)
);

comment on table public.standard_ownerships is
  'Phase 16 (ADR 0093 D7 — a narrow exception to ADR 0057 §2''s no-new-write-tier stance: this table writes an ASSIGNMENT POINTER, never an assessment or evidence). When a row exists, responsible_commission_id''s own standard_assessments row IS the hospital''s institutional answer for that standard (resolution = ''responsavel''); absent, the hospital rollup falls back to worst-status-wins across all reporting commissions. Written by is_hospital_admin_of ONLY (Wave 2). PHI-free (Rule 12 N/A).';

create index standard_ownerships_standard_idx on public.standard_ownerships (standard_id);
create index standard_ownerships_responsible_commission_idx
  on public.standard_ownerships (responsible_commission_id);

-- Cross-row invariant (schema-level defense-in-depth; the Wave 2
-- set_standard_ownership RPC validates + raises its own curated pt-BR HC0xx
-- error BEFORE ever reaching this trigger — precedent: guard_membership_hospital_org,
-- which uses the same plain check_violation shape for the same kind of
-- backstop guard).
create function app.guard_standard_ownership_hospital()
returns trigger
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if app.hospital_of_commission(new.responsible_commission_id) is distinct from new.hospital_id then
    raise exception 'responsible_commission_id % does not belong to hospital %',
      new.responsible_commission_id, new.hospital_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger guard_standard_ownership_hospital_trg
  before insert or update on public.standard_ownerships
  for each row execute function app.guard_standard_ownership_hospital();

-- ---------------------------------------------------------------------------
-- Audit trigger functions (Rule 11) — clone app.trg_audit_indicators; c_cols
-- allow-lists exclude free text: note / note_md / description_md. Defined
-- BEFORE the CREATE TRIGGER statements that reference them.
-- ---------------------------------------------------------------------------

create function app.trg_audit_accreditation_frameworks()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array[
    'key', 'name', 'version', 'description', 'owner_commission_id',
    'cloned_from_framework_id', 'status'
  ];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('accreditation_framework.created', 'accreditation_framework', new.id,
      new.owner_commission_id, 'Framework de acreditação criado: ' || new.key,
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('accreditation_framework.updated', 'accreditation_framework', new.id,
      new.owner_commission_id, 'Framework de acreditação atualizado: ' || new.key,
      app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
  elsif tg_op = 'DELETE' then
    perform app.audit_write('accreditation_framework.deleted', 'accreditation_framework', old.id,
      old.owner_commission_id, 'Framework de acreditação removido: ' || old.key,
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;

create function app.trg_audit_accreditation_standards()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array['framework_id', 'parent_id', 'code', 'title', 'position', 'level'];
  v_commission uuid;
begin
  select f.owner_commission_id into v_commission
  from public.accreditation_frameworks f
  where f.id = coalesce(new.framework_id, old.framework_id);

  if tg_op = 'INSERT' then
    perform app.audit_write('accreditation_standard.created', 'accreditation_standard', new.id,
      v_commission, 'Padrão de acreditação criado: ' || new.code,
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('accreditation_standard.updated', 'accreditation_standard', new.id,
      v_commission, 'Padrão de acreditação atualizado: ' || new.code,
      app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
  elsif tg_op = 'DELETE' then
    perform app.audit_write('accreditation_standard.deleted', 'accreditation_standard', old.id,
      v_commission, 'Padrão de acreditação removido: ' || old.code,
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;

create function app.trg_audit_evidence_links()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array['commission_id', 'standard_id', 'artifact_kind', 'artifact_id', 'linked_by'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('evidence_link.created', 'evidence_link', new.id, new.commission_id,
      'Evidência vinculada: ' || new.artifact_kind,
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('evidence_link.updated', 'evidence_link', new.id, new.commission_id,
      'Evidência atualizada: ' || new.artifact_kind,
      app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
  elsif tg_op = 'DELETE' then
    perform app.audit_write('evidence_link.deleted', 'evidence_link', old.id, old.commission_id,
      'Evidência desvinculada: ' || old.artifact_kind,
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;

create function app.trg_audit_standard_assessments()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array['commission_id', 'standard_id', 'status', 'assessed_by'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('standard_assessment.created', 'standard_assessment', new.id, new.commission_id,
      'Autoavaliação registrada: ' || new.status,
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('standard_assessment.updated', 'standard_assessment', new.id, new.commission_id,
      'Autoavaliação atualizada: ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
  elsif tg_op = 'DELETE' then
    perform app.audit_write('standard_assessment.deleted', 'standard_assessment', old.id, old.commission_id,
      'Autoavaliação removida',
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;

create function app.trg_audit_standard_ownerships()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array['hospital_id', 'standard_id', 'responsible_commission_id', 'assigned_by'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('standard_ownership.created', 'standard_ownership', new.id,
      null, 'Comissão responsável atribuída', app.audit_diff(null, to_jsonb(new), c_cols),
      p_hospital => new.hospital_id);
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('standard_ownership.updated', 'standard_ownership', new.id,
      null, 'Comissão responsável alterada', app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols),
      p_hospital => new.hospital_id);
  elsif tg_op = 'DELETE' then
    perform app.audit_write('standard_ownership.deleted', 'standard_ownership', old.id,
      null, 'Comissão responsável removida', app.audit_diff(to_jsonb(old), null, c_cols),
      p_hospital => old.hospital_id);
  end if;
  return null;
end;
$$;

-- Now that every audit function exists, attach the triggers.

create trigger audit_accreditation_frameworks_trg
  after insert or delete or update on public.accreditation_frameworks
  for each row execute function app.trg_audit_accreditation_frameworks();

create trigger audit_accreditation_standards_trg
  after insert or delete or update on public.accreditation_standards
  for each row execute function app.trg_audit_accreditation_standards();

create trigger audit_evidence_links_trg
  after insert or delete or update on public.evidence_links
  for each row execute function app.trg_audit_evidence_links();

create trigger audit_standard_assessments_trg
  after insert or delete or update on public.standard_assessments
  for each row execute function app.trg_audit_standard_assessments();

create trigger audit_standard_ownerships_trg
  after insert or delete or update on public.standard_ownerships
  for each row execute function app.trg_audit_standard_ownerships();

-- ---------------------------------------------------------------------------
-- RLS (Rule 1) — enabled on all five; no `authenticated` write grant anywhere
-- (indicators/documents posture). Every write is a Wave 2 DEFINER RPC.
-- ---------------------------------------------------------------------------

alter table public.accreditation_frameworks enable row level security;
alter table public.accreditation_standards enable row level security;
alter table public.evidence_links enable row level security;
alter table public.standard_assessments enable row level security;
alter table public.standard_ownerships enable row level security;

-- Amendment 1 A1·2 (narrows D10's letter): global packs SELECT-able by every
-- authenticated user; a commission-owned clone (pasted licensed text) is
-- readable ONLY by that commission's members.
create policy accreditation_frameworks_select on public.accreditation_frameworks
  for select to authenticated
  using (owner_commission_id is null or app.is_member_of(owner_commission_id));

create policy accreditation_standards_select on public.accreditation_standards
  for select to authenticated
  using (
    exists (
      select 1
      from public.accreditation_frameworks f
      where f.id = accreditation_standards.framework_id
        and (f.owner_commission_id is null or app.is_member_of(f.owner_commission_id))
    )
  );

create policy evidence_links_select on public.evidence_links
  for select to authenticated
  using (app.is_member_of(commission_id));

create policy standard_assessments_select on public.standard_assessments
  for select to authenticated
  using (app.is_member_of(commission_id));

create policy standard_ownerships_select on public.standard_ownerships
  for select to authenticated
  using (app.is_hospital_member_of(hospital_id) or app.is_hospital_admin_of(hospital_id));

grant select on public.accreditation_frameworks to authenticated;
grant select on public.accreditation_standards to authenticated;
grant select on public.evidence_links to authenticated;
grant select on public.standard_assessments to authenticated;
grant select on public.standard_ownerships to authenticated;

-- ---------------------------------------------------------------------------
-- Feature flag — seeded OFF. app.feature_flags.enabled DEFAULTS TRUE
-- (Amendment 2 A2·3), so `enabled` is set explicitly. Flipped by its own
-- enable migration at the Phase 16 gate (Migration G) — never here.
-- ---------------------------------------------------------------------------

insert into app.feature_flags (key, enabled, description)
values (
  'accreditation',
  false,
  'Phase 16 (ADR 0093) — Standards Crosswalk & Readiness/Gap Engine v2: commissions link the artifacts they already produce as evidence against ONA/JCI/custom framework standards, self-assess conformity, and get a readiness/gap report. Gates the framework/standard CRUD + clone RPCs, the evidence/assessment/ownership write doors, and the three readiness read doors (app.assert_accreditation_enabled(), Migration B/C+). Ships OFF; flipped at the Phase 16 gate.'
)
on conflict (key) do nothing;
