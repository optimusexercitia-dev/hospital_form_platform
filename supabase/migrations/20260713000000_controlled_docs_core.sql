-- =============================================================================
-- Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados) · B1
-- Core schema: public.controlled_documents + controlled_document_versions +
-- document_approvals, per-commission code mint, the controlled-documents immutable
-- Storage bucket + policies (approver-read DEFINER predicate), the version status
-- state-machine guard + frozen-approver-set invariant, audit AFTER-triggers
-- (non-sensitive allow-list — NEVER title/summary_of_changes_md/note/storage_path),
-- and the controlled_docs flag (seeded OFF).
--
-- Plan: /Users/mike/.claude/plans/create-a-new-branch-resilient-hammock.md · ADR 0057 ·
-- ARCHITECTURE.md Rules 1, 6, 8, 11. Spec docs/phases/accreditation-track.md:427-506.
-- Additive, forward-only. Mirrors the Phase-15 indicators core (posture (b):
-- member-read SELECT policy + grant, DEFINER-RPC-only writes) + the case_access
-- grant-read arm + the nsp-evidence/meeting-attachments storage-policy shape.
--
-- SQLSTATEs allocated (raised by the guards here; the B2 RPCs raise the rest):
--   HC089 — wrong-state / illegal status transition
--   HC093 — frozen-approver-set (roster change while em_aprovacao)
-- (HC090 publish-with-pending/rejected, HC091 approver-not-entitled, HC092
--  duplicate-approver are raised by the B2 RPCs.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · public.controlled_documents — a controlled document header. Commission-owned.
--     status is DERIVED from the current version (maintained by the B2 RPCs).
-- -----------------------------------------------------------------------------
create table public.controlled_documents (
  id                  uuid primary key default gen_random_uuid(),
  commission_id       uuid not null references public.commissions(id) on delete restrict,
  code                text not null,                    -- per-commission mint 'DOC-####'
  title               text not null check (length(btrim(title)) > 0),
  doc_type            text not null
                        check (doc_type in ('politica', 'pop', 'protocolo', 'regimento', 'manual', 'outro')),
  review_cycle_months integer check (review_cycle_months is null or review_cycle_months > 0),
  status              text not null default 'rascunho'
                        check (status in ('rascunho', 'em_aprovacao', 'vigente', 'obsoleto')),
  current_version_id  uuid,                             -- FK added after the versions table (self-ref cycle)
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint controlled_documents_commission_code_uq unique (commission_id, code)
);

comment on table public.controlled_documents is
  'Phase 17: a controlled document (política/POP/protocolo/regimento/manual) under a '
  'controlled lifecycle. Commission-owned; the hospital tier sees only the read-only '
  'hospital_document_register DEFINER rollup (no table grant). status DERIVED from the '
  'current version. PHI-free governance artifact (ADR 0057).';
comment on column public.controlled_documents.title is
  'User-facing pt-BR title. NOT audited (governance metadata but kept out of the diff '
  'allow-list — Rule 11 minimizes what the log carries).';

create index controlled_documents_commission_id_idx on public.controlled_documents (commission_id);
create index controlled_documents_commission_status_idx
  on public.controlled_documents (commission_id, status);

-- -----------------------------------------------------------------------------
-- 2 · public.controlled_document_versions — an immutable, versioned artifact.
--     storage_path is NEW per upload (Rule 6). status is the version's own state;
--     the header mirrors the CURRENT version.
-- -----------------------------------------------------------------------------
create table public.controlled_document_versions (
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid not null references public.controlled_documents(id) on delete cascade,
  version_number        integer not null check (version_number > 0),
  storage_path          text,                           -- immutable; new per upload; null until first upload
  summary_of_changes_md text,                           -- sanitized Markdown (Rule 7); NEVER audited
  effective_date        date,
  review_due_date       date,                           -- effective + review_cycle_months (override wins), set at publish
  expiry_date           date,
  status                text not null default 'rascunho'
                          check (status in ('rascunho', 'em_aprovacao', 'vigente', 'obsoleto')),
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint controlled_document_versions_number_uq unique (document_id, version_number),
  constraint controlled_document_versions_expiry_ck
    check (expiry_date is null or effective_date is null or expiry_date >= effective_date)
);

comment on table public.controlled_document_versions is
  'Phase 17: one version of a controlled document. storage_path is IMMUTABLE and NEW '
  'per upload (Rule 6) — objects are never overwritten. review_due_date computed at '
  'publish (effective + review_cycle_months; override wins). Status transitions guarded '
  'by app.guard_controlled_document_status (RPC-only).';
comment on column public.controlled_document_versions.storage_path is
  'Immutable path {commission_id}/{document_id}/{uuid}.{ext} in the controlled-documents '
  'bucket. NEVER audited (Rule 11).';
comment on column public.controlled_document_versions.summary_of_changes_md is
  'Sanitized Markdown (Rule 7). NEVER copied into the audit log (Rule 11).';

create index controlled_document_versions_document_id_idx
  on public.controlled_document_versions (document_id);

-- The header → current-version FK (added now that the target table exists).
alter table public.controlled_documents
  add constraint controlled_documents_current_version_fkey
  foreign key (current_version_id)
  references public.controlled_document_versions(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 3 · public.document_approvals — one named-approver e-signature slot per version.
--     Created PENDING at submit (decision null) — the pending row GRANTS READ (the
--     approver arm). signature_hash set at decision time.
-- -----------------------------------------------------------------------------
create table public.document_approvals (
  id                  uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references public.controlled_document_versions(id) on delete cascade,
  approver_id         uuid not null references public.profiles(id) on delete restrict,
  approver_title      text,                             -- NEVER audited
  decision            text check (decision is null or decision in ('aprovado', 'rejeitado')),
  decided_at          timestamptz,
  note                text,                             -- NEVER audited (free-text, Rule 11)
  signature_hash      text,                             -- sha256 hex over storage_path:approver_id:decision
  created_at          timestamptz not null default now(),

  constraint document_approvals_version_approver_uq unique (document_version_id, approver_id),
  -- pending ⇔ unsigned: decision, decided_at, signature_hash all set together or all null.
  constraint document_approvals_pending_decided_ck
    check ((decision is null) = (decided_at is null)),
  constraint document_approvals_pending_hash_ck
    check ((decision is null) = (signature_hash is null))
);

comment on table public.document_approvals is
  'Phase 17: a named-approver e-signature slot for a version. A PENDING row (decision '
  'null) GRANTS READ of the document/version/storage object to an approver from OUTSIDE '
  'the commission (the case_access-style OR-arm). Frozen roster while the version is '
  'em_aprovacao (app.guard_frozen_approver_set). signature_hash mirrors '
  'meeting_signatures.content_hash, per-signer + per-artifact.';
comment on column public.document_approvals.note is
  'Free-text decision note (sanitized Markdown, Rule 7). NEVER copied into the audit log (Rule 11).';
comment on column public.document_approvals.signature_hash is
  'sha256 hex over (storage_path : approver_id : decision) — bound to BOTH the artifact '
  'and the signer (non-transferable). NEVER audited.';

create index document_approvals_version_id_idx on public.document_approvals (document_version_id);
create index document_approvals_approver_id_idx on public.document_approvals (approver_id);

-- -----------------------------------------------------------------------------
-- 4 · Code mint ('DOC-####' per commission) + updated_at touch — mirrors
--     app.mint_indicator_code / app.touch_indicator_updated.
-- -----------------------------------------------------------------------------
create or replace function app.mint_controlled_document_code() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_next integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('controlled_document_code:' || new.commission_id::text, 0));

  v_next := coalesce(
    (select max((substring(code from 5))::integer)
     from public.controlled_documents
     where code ~ '^DOC-[0-9]+$' and commission_id = new.commission_id),
    0
  ) + 1;

  new.code := 'DOC-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;
alter function app.mint_controlled_document_code() owner to postgres;

create trigger mint_controlled_document_code_trg
  before insert on public.controlled_documents
  for each row execute function app.mint_controlled_document_code();

create or replace function app.touch_controlled_updated() returns trigger
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
alter function app.touch_controlled_updated() owner to postgres;

create trigger touch_controlled_documents_updated_trg
  before update on public.controlled_documents
  for each row execute function app.touch_controlled_updated();

create trigger touch_controlled_document_versions_updated_trg
  before update on public.controlled_document_versions
  for each row execute function app.touch_controlled_updated();

-- -----------------------------------------------------------------------------
-- 5 · Commission-resolution helpers (mirror app.commission_of_version).
-- -----------------------------------------------------------------------------
create or replace function app.commission_of_document(p_document_id uuid) returns uuid
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select commission_id from public.controlled_documents where id = p_document_id;
$$;
alter function app.commission_of_document(uuid) owner to postgres;

create or replace function app.commission_of_document_version(p_version_id uuid) returns uuid
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select d.commission_id
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
$$;
alter function app.commission_of_document_version(uuid) owner to postgres;

-- Approver-read arm helpers — SECURITY DEFINER so the RLS SELECT policies can consult
-- document_approvals / controlled_document_versions WITHOUT re-triggering those tables'
-- own policies (which would be mutually recursive — the versions policy references
-- approvals and vice-versa). This is how the case_access arm avoids cross-referential
-- RLS recursion.
create or replace function app.is_document_approver_of(p_document_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.document_approvals a
    join public.controlled_document_versions v on v.id = a.document_version_id
    where v.document_id = p_document_id and a.approver_id = p_uid
  );
$$;
alter function app.is_document_approver_of(uuid, uuid) owner to postgres;

create or replace function app.is_document_version_approver(p_version_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1 from public.document_approvals a
    where a.document_version_id = p_version_id and a.approver_id = p_uid
  );
$$;
alter function app.is_document_version_approver(uuid, uuid) owner to postgres;

-- Member/commission-admin read of the commission that owns the version's document,
-- resolved via the DEFINER commission-lookup so the document_approvals policy can gate
-- on the parent doc WITHOUT re-entering the versions/documents RLS.
create or replace function app.can_read_document_of_version(p_version_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select
    app.is_member_of_for(app.commission_of_document_version(p_version_id), p_uid)
    or app.is_commission_admin_of_for(app.commission_of_document_version(p_version_id), p_uid);
$$;
alter function app.can_read_document_of_version(uuid, uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 6 · Feature flag (OFF) + assert helper. Flips ON in B6 (phase close).
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values ('controlled_docs', false, 'Documentos controlados (Fase 17)')
on conflict (key) do update set description = excluded.description;

create or replace function app.assert_controlled_docs_enabled() returns void
  language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('controlled_docs') then
    raise exception 'o recurso de documentos controlados não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;
alter function app.assert_controlled_docs_enabled() owner to postgres;

-- -----------------------------------------------------------------------------
-- 7 · RLS — posture (b): member-read + APPROVER-READ arm; DEFINER-RPC-only writes.
--     The approver arm is the case_access-style OR-term (Rule 1). Header arm is
--     document-scoped; version arm is version-scoped (tighter, by design).
-- -----------------------------------------------------------------------------
alter table public.controlled_documents enable row level security;
alter table public.controlled_document_versions enable row level security;
alter table public.document_approvals enable row level security;

-- Header: member OR commission_admin OR (named approver on ANY version of this doc).
-- The approver arm goes through a DEFINER helper (app.is_document_approver_of) so it
-- does NOT re-trigger the versions/approvals policies (avoids cross-referential recursion).
create policy "controlled_documents_select" on public.controlled_documents
  for select to authenticated
  using (
    app.is_member_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or app.is_document_approver_of(controlled_documents.id, auth.uid())
  );

-- Version: member OR commission_admin of the owning doc's commission, OR (named approver
-- on THIS version — version-scoped, tighter than the header arm). Both arms resolved via
-- DEFINER helpers (no inline cross-table subquery → no recursion into the other policies).
create policy "controlled_document_versions_select" on public.controlled_document_versions
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_document(controlled_document_versions.document_id))
    or app.is_commission_admin_of(app.commission_of_document(controlled_document_versions.document_id))
    or app.is_document_version_approver(controlled_document_versions.id, auth.uid())
  );

-- Approvals: own rows (the queue + sign-own-row) OR rows on a readable document (so members
-- see the approval state of their docs). The parent-doc read is resolved via the DEFINER
-- app.can_read_document (which itself does not re-enter these policies).
create policy "document_approvals_select" on public.document_approvals
  for select to authenticated
  using (
    approver_id = auth.uid()
    or app.can_read_document_of_version(document_approvals.document_version_id, auth.uid())
  );

-- No INSERT/UPDATE/DELETE policy (posture (b)). SELECT grant only; belt-and-braces
-- revoke of any re-inherited write grant.
grant select on public.controlled_documents to authenticated;
grant select on public.controlled_document_versions to authenticated;
grant select on public.document_approvals to authenticated;
revoke insert, update, delete on public.controlled_documents from authenticated;
revoke insert, update, delete on public.controlled_document_versions from authenticated;
revoke insert, update, delete on public.document_approvals from authenticated;

-- -----------------------------------------------------------------------------
-- 8 · Immutable Storage bucket controlled-documents (25 MB; PDF + Office + images).
--     INSERT by staff_admin/commission_admin; SELECT via the DEFINER read predicate
--     that INCLUDES the approver arm; NO update/delete (Rule 6). Path seg[1] =
--     commission_id, seg[2] = document_id. Models nsp-evidence/meeting-attachments.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'controlled-documents', 'controlled-documents', false, 26214400,
  '{application/pdf,image/png,image/jpeg,image/webp,image/gif,'
  'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,'
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,'
  'application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,'
  'text/csv,text/plain}'::text[]
)
on conflict (id) do nothing;

-- DEFINER read predicate: member/commission-admin of seg[1], OR named approver on
-- any version of seg[2] (the version arm — an outside-commission signer downloads
-- only the doc they were named on). SECURITY DEFINER so it can consult the tables.
create or replace function app.can_read_document_object(p_name text, p_uid uuid) returns boolean
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select
    app.is_member_of_for((storage.foldername(p_name))[1]::uuid, p_uid)
    or app.is_commission_admin_of_for((storage.foldername(p_name))[1]::uuid, p_uid)
    or exists (
      select 1
      from public.document_approvals a
      join public.controlled_document_versions v on v.id = a.document_version_id
      where v.document_id = (storage.foldername(p_name))[2]::uuid
        and a.approver_id = p_uid
    );
$$;
alter function app.can_read_document_object(text, uuid) owner to postgres;

-- INSERT: staff_admin OR commission_admin of the path's commission (seg[1]).
create policy "controlled_documents_obj_insert_writable" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'controlled-documents'
    and (
      app.is_commission_admin_of((storage.foldername(name))[1]::uuid)
      or app.is_staff_admin_of((storage.foldername(name))[1]::uuid)
    )
  );

-- SELECT: the DEFINER predicate incl. the approver arm.
create policy "controlled_documents_obj_select_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'controlled-documents'
    and app.can_read_document_object(name, auth.uid())
  );

-- NO update/delete policy on this bucket — objects are immutable (Rule 6).

-- -----------------------------------------------------------------------------
-- 9 · Version status state-machine guard (RPC-only) — mirrors guard_published_version's
--     app.in_publish_rpc session-flag pattern via app.in_controlled_docs_rpc.
--     Outside an RPC: block any status change + any column write once status <>
--     'rascunho'; block DELETE of a non-rascunho version. Inside an RPC: allow only
--     legal transitions. Illegal transition → HC089.
-- -----------------------------------------------------------------------------
create or replace function app.guard_controlled_document_status() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_controlled_docs_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    -- Only a rascunho version may be deleted directly (and only inside an RPC path,
    -- e.g. a cancelled draft); published/superseded artifacts are retained (Rule 6 spirit).
    if old.status <> 'rascunho' and not v_in_rpc then
      raise exception 'apenas versões em rascunho podem ser removidas'
        using errcode = 'HC089';
    end if;
    return old;
  end if;

  -- UPDATE. A status change is permitted ONLY inside a controlled-docs RPC, and only
  -- along a legal edge; a non-status update on a non-rascunho version is forbidden.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de status devem passar por uma operação de documento controlado'
        using errcode = 'HC089';
    end if;
    -- Legal edges: rascunho→em_aprovacao ; em_aprovacao→{vigente,rascunho} ;
    -- vigente→obsoleto. Anything else is HC089.
    if not (
      (old.status = 'rascunho'     and new.status = 'em_aprovacao')
      or (old.status = 'em_aprovacao' and new.status in ('vigente', 'rascunho'))
      or (old.status = 'vigente'      and new.status = 'obsoleto')
    ) then
      raise exception 'transição de status inválida (% → %)', old.status, new.status
        using errcode = 'HC089';
    end if;
    return new;
  end if;

  -- Non-status update: forbidden once the version leaves rascunho (immutable artifact),
  -- except inside an RPC (e.g. publish stamps effective/review-due while flipping status —
  -- that path takes the status branch above; a stray non-status write on a frozen version
  -- outside an RPC is what this blocks).
  if old.status <> 'rascunho' and not v_in_rpc then
    raise exception 'versões publicadas/obsoletas são imutáveis'
      using errcode = 'HC089';
  end if;

  return new;
end;
$$;
alter function app.guard_controlled_document_status() owner to postgres;

create trigger guard_controlled_document_status_trg
  before update or delete on public.controlled_document_versions
  for each row execute function app.guard_controlled_document_status();

-- -----------------------------------------------------------------------------
-- 10 · Frozen-approver-set invariant — the roster of approver_ids cannot change
--      while the version is em_aprovacao (changing the set = resubmit, which happens
--      while transitioning rascunho→em_aprovacao under the RPC flag). Only the
--      decision/signature of an EXISTING row may change (approve/reject). HC093.
-- -----------------------------------------------------------------------------
create or replace function app.guard_frozen_approver_set() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_controlled_docs_rpc', true), 'off') = 'on';
  v_version_status text;
  v_version uuid := coalesce(new.document_version_id, old.document_version_id);
begin
  select status into v_version_status
  from public.controlled_document_versions where id = v_version;

  -- INSERT / DELETE change the ROSTER — forbidden once em_aprovacao unless the RPC
  -- flag is on (submit builds the set while flipping the status; resubmit-after-reject
  -- rebuilds it from rascunho). UPDATE that changes approver_id is likewise a roster
  -- change; UPDATE of decision/signature on an existing row is allowed (sign path).
  if tg_op = 'INSERT' then
    if v_version_status = 'em_aprovacao' and not v_in_rpc then
      raise exception 'o conjunto de aprovadores está congelado durante a aprovação'
        using errcode = 'HC093';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if v_version_status = 'em_aprovacao' and not v_in_rpc then
      raise exception 'o conjunto de aprovadores está congelado durante a aprovação'
        using errcode = 'HC093';
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if new.approver_id is distinct from old.approver_id then
      raise exception 'o aprovador de uma assinatura não pode ser alterado'
        using errcode = 'HC093';
    end if;
    return new;
  end if;
  return null;
end;
$$;
alter function app.guard_frozen_approver_set() owner to postgres;

create trigger guard_frozen_approver_set_trg
  before insert or update or delete on public.document_approvals
  for each row execute function app.guard_frozen_approver_set();

-- -----------------------------------------------------------------------------
-- 11 · Audit AFTER-triggers (Rule 11) — non-sensitive allow-lists ONLY; NEVER
--      title / summary_of_changes_md / note / storage_path / approver_title.
--      audit_write derives org+hospital from the commission internally.
-- -----------------------------------------------------------------------------
create or replace function app.trg_audit_controlled_documents() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array['code', 'doc_type', 'status', 'review_cycle_months'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('document.created', 'controlled_document', new.id, new.commission_id,
      'Documento controlado criado: ' || new.code,
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform app.audit_write('document.status_changed', 'controlled_document', new.id, new.commission_id,
        'Documento ' || new.code || ': status ' || old.status || ' → ' || new.status,
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    else
      perform app.audit_write('document.updated', 'controlled_document', new.id, new.commission_id,
        'Documento controlado atualizado: ' || new.code,
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    end if;
  elsif tg_op = 'DELETE' then
    perform app.audit_write('document.deleted', 'controlled_document', old.id, old.commission_id,
      'Documento controlado removido: ' || old.code,
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;
alter function app.trg_audit_controlled_documents() owner to postgres;

create trigger audit_controlled_documents_trg
  after insert or update or delete on public.controlled_documents
  for each row execute function app.trg_audit_controlled_documents();

create or replace function app.trg_audit_controlled_document_versions() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array[
    'version_number', 'status', 'effective_date', 'review_due_date', 'expiry_date'
  ];
  v_commission uuid;
  v_code text;
  v_doc uuid := coalesce(new.document_id, old.document_id);
begin
  select d.commission_id, d.code into v_commission, v_code
  from public.controlled_documents d where d.id = v_doc;
  if v_commission is null then
    return null;  -- document gone (cascade delete path); nothing to attribute.
  end if;

  if tg_op = 'INSERT' then
    perform app.audit_write('document_version.added', 'controlled_document_version', new.id, v_commission,
      'Versão ' || new.version_number || ' adicionada (' || v_code || ')',
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform app.audit_write('document_version.status_changed', 'controlled_document_version', new.id, v_commission,
        'Versão ' || new.version_number || ' (' || v_code || '): status ' || old.status || ' → ' || new.status,
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    else
      perform app.audit_write('document_version.updated', 'controlled_document_version', new.id, v_commission,
        'Versão ' || new.version_number || ' atualizada (' || v_code || ')',
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    end if;
  elsif tg_op = 'DELETE' then
    perform app.audit_write('document_version.deleted', 'controlled_document_version', old.id, v_commission,
      'Versão ' || old.version_number || ' removida (' || v_code || ')',
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;
alter function app.trg_audit_controlled_document_versions() owner to postgres;

create trigger audit_controlled_document_versions_trg
  after insert or update or delete on public.controlled_document_versions
  for each row execute function app.trg_audit_controlled_document_versions();

create or replace function app.trg_audit_document_approvals() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array['decision'];   -- decision ONLY; never note/hash/title.
  v_commission uuid;
  v_version uuid := coalesce(new.document_version_id, old.document_version_id);
begin
  v_commission := app.commission_of_document_version(v_version);
  if v_commission is null then
    return null;  -- version gone (cascade); nothing to attribute.
  end if;

  if tg_op = 'INSERT' then
    perform app.audit_write('document_approval.requested', 'document_approval', new.id, v_commission,
      'Aprovação solicitada',
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    if new.decision is distinct from old.decision and new.decision = 'aprovado' then
      perform app.audit_write('document_approval.signed', 'document_approval', new.id, v_commission,
        'Documento aprovado (assinatura registrada)',
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    elsif new.decision is distinct from old.decision and new.decision = 'rejeitado' then
      perform app.audit_write('document_approval.rejected', 'document_approval', new.id, v_commission,
        'Documento rejeitado',
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    else
      perform app.audit_write('document_approval.updated', 'document_approval', new.id, v_commission,
        'Aprovação atualizada',
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    end if;
  elsif tg_op = 'DELETE' then
    perform app.audit_write('document_approval.removed', 'document_approval', old.id, v_commission,
      'Aprovação removida',
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;
alter function app.trg_audit_document_approvals() owner to postgres;

create trigger audit_document_approvals_trg
  after insert or update or delete on public.document_approvals
  for each row execute function app.trg_audit_document_approvals();
