-- =============================================================================
-- DM1 / M3 — the document-model core tables (ADR 0114 D3/D7/D9/D10; plan
-- docs/plans/dm1-substrate-cutover-plan.md §3 step 3; decisions ADR 0116).
--
-- Posture on EVERY table here: RLS enabled at creation; authenticated holds
-- SELECT only (command-only mutations — the DM2 doors are the only writers);
-- SELECT policies land with the kernel in 20260923000400, so between M3 and M4
-- the tables are RLS-on/zero-policy = deny-all. Guards are STRICT with no
-- bypass GUC: nothing but DEFINER commands / service role / fixtures can write
-- these tables, and the guards exist to catch exactly those writers' bugs —
-- fixtures walk legal transitions instead of skipping them.
--
-- Parked-seam SQLSTATE family minted for this program (recorded in ADR 0116):
--   HC0DM parked feature arm · HC0D1 illegal file-object transition ·
--   HC0D2 immutable-field/row write · HC0D3 disposal blocked by legal hold ·
--   HC0D4 illegal document transition (incl. soft-delete under hold, D10).
-- =============================================================================

-- 1. documents — the logical governed record (D3).
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  home_resource_id uuid not null references public.securable_resources(id) on delete restrict,
  title            text not null constraint documents_title_not_blank check (btrim(title) <> ''),
  description      text,
  kind             text,
  status           text not null default 'active'
    constraint documents_status_check
    check (status in ('active', 'soft_deleted', 'disposal_pending', 'disposed')),
  -- D6 seam: referenced by NOTHING until a future ADR defines the sharing
  -- plane's policy tables. No FK on purpose.
  access_policy_id uuid,
  created_by       uuid not null references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint documents_soft_delete_stamped
    check (status <> 'soft_deleted' or deleted_at is not null)
);

comment on table public.documents is
  'ADR 0114 D3 logical document. Access = home-resource access via app.can_read_document (M4). Titles/descriptions are contractually non-PHI (D12).';
comment on column public.documents.access_policy_id is
  'ADR 0114 D6 seam — deliberately unreferenced; a future ADR defines the sharing plane. Verify against the catalog, never this comment.';

-- 2. document_versions — immutable revisions (D3).
create table public.document_versions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.documents(id) on delete restrict,
  version_number integer not null constraint document_versions_number_positive check (version_number > 0),
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  constraint document_versions_document_number_uniq unique (document_id, version_number)
);

-- 3. file_objects — physical identity (D3/D9/D10).
create table public.file_objects (
  id                       uuid primary key default gen_random_uuid(),
  storage_bucket           text not null
    constraint file_objects_bucket_check
    check (storage_bucket in ('documents-standard', 'documents-phi')),
  storage_path             text not null
    constraint file_objects_path_not_blank check (btrim(storage_path) <> ''),
  sensitivity_tier         text not null
    constraint file_objects_tier_check check (sensitivity_tier in ('standard', 'phi')),
  upload_state             text not null default 'reserved'
    constraint file_objects_upload_state_check
    check (upload_state in ('reserved', 'uploaded', 'verifying', 'scan_pending',
                            'clean', 'unscanned_accepted', 'infected', 'rejected',
                            'abandoned', 'failed')),
  disposal_state           text not null default 'none'
    constraint file_objects_disposal_state_check
    check (disposal_state in ('none', 'disposal_pending', 'disposed')),
  size_bytes               bigint
    constraint file_objects_size_nonnegative check (size_bytes is null or size_bytes >= 0),
  mime_type                text,
  sha256                   text,
  created_by               uuid not null references public.profiles(id),
  created_at               timestamptz not null default now(),
  uploaded_at              timestamptz,
  verified_at              timestamptz,
  disposed_at              timestamptz,
  disposed_by              uuid references public.profiles(id),
  disposal_reason_category text
    constraint file_objects_disposal_reason_check
    check (disposal_reason_category is null or disposal_reason_category in
           ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other')),
  -- F-09's fix, by construction: one physical object, one row.
  constraint file_objects_bucket_path_uniq unique (storage_bucket, storage_path),
  -- D8: the bucket is DERIVED from the tier, never caller-chosen (F-03 class).
  constraint file_objects_bucket_from_tier check (
    (sensitivity_tier = 'phi' and storage_bucket = 'documents-phi')
    or (sensitivity_tier = 'standard' and storage_bucket = 'documents-standard')
  )
);

comment on table public.file_objects is
  'ADR 0114 D3/D9/D10 physical object. Paths server-generated {org}/{file_object}/{generation} (D8); size/MIME/hash derived+verified at finalize, caller values are hints (F-04); reclassification is copy→verify→commit→retire, never a pointer update (F-03) — bucket/path/tier are trigger-immutable.';

-- 4. document_version_files — the version↔file binding with rendition kinds.
create table public.document_version_files (
  id                  uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references public.document_versions(id) on delete restrict,
  file_object_id      uuid not null references public.file_objects(id) on delete restrict,
  rendition_kind      text not null
    constraint document_version_files_rendition_check
    check (rendition_kind in ('source', 'redacted', 'preview', 'signed', 'printed_pdf')),
  created_at          timestamptz not null default now(),
  -- Provisional (plan Q6, carried to DM2): one file per rendition per version.
  constraint document_version_files_version_rendition_uniq
    unique (document_version_id, rendition_kind)
);

-- 5. document_placements — non-authorizing, EVER (D6).
create table public.document_placements (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  resource_id uuid not null references public.securable_resources(id) on delete cascade,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  constraint document_placements_document_resource_uniq unique (document_id, resource_id)
);

comment on table public.document_placements is
  'ADR 0114 D6: placements surface a document in another resource''s UI and are NON-AUTHORIZING, ever — no predicate may read this table; an authorizing placement requires a new ADR.';

-- 6. upload_sessions — the reservation a future begin_document_upload mints
--    (DM2). In DM1 nothing can write this table: the M5 bucket INSERT
--    policies predicate over it and are therefore live, fail-closed, inert.
create table public.upload_sessions (
  id             uuid primary key default gen_random_uuid(),
  file_object_id uuid not null references public.file_objects(id) on delete restrict,
  reserved_by    uuid not null references public.profiles(id),
  state          text not null default 'reserved'
    constraint upload_sessions_state_check
    check (state in ('reserved', 'consumed', 'expired', 'cancelled')),
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  constraint upload_sessions_file_object_uniq unique (file_object_id)
);

-- 7. document_retention — STRUCTURE now, VALUES provisional (ADR 0114 O1).
create table public.document_retention (
  id              uuid primary key default gen_random_uuid(),
  applies_to_kind text,
  applies_to_tier text
    constraint document_retention_tier_check
    check (applies_to_tier is null or applies_to_tier in ('standard', 'phi')),
  retention_years integer not null
    constraint document_retention_years_positive check (retention_years > 0),
  trigger_event   text not null
    constraint document_retention_trigger_check
    check (trigger_event in ('creation', 'case_closure', 'discharge', 'last_activity')),
  notes           text,
  is_provisional  boolean not null default true,
  created_at      timestamptz not null default now()
);

-- One conservative catch-all row, PROVISIONAL until the O1 sign-off: the CFM
-- 1821/2007 20-year floor from creation.
insert into public.document_retention (applies_to_kind, applies_to_tier, retention_years, trigger_event, notes, is_provisional)
values (null, null, 20, 'creation',
        'Provisional catch-all (ADR 0114 O1): CFM 1821/2007 20-year floor. Values await PO + legal/clinical sign-off; the disposal job (DM2+) must refuse to run on is_provisional rows.',
        true);

-- 8. document_legal_holds — issuer, reason category, lifecycle (replaces the
--    old bare boolean; D7/D10).
create table public.document_legal_holds (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.documents(id) on delete restrict,
  issued_by       uuid not null references public.profiles(id),
  reason_category text not null
    constraint document_legal_holds_reason_check
    check (reason_category in ('litigation', 'regulatory', 'audit', 'investigation', 'other')),
  placed_at       timestamptz not null default now(),
  released_at     timestamptz,
  released_by     uuid references public.profiles(id),
  constraint document_legal_holds_release_order
    check (released_at is null or released_at >= placed_at)
);

-- Posture for all eight (RLS on; SELECT-only for authenticated; policies in M4).
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.file_objects enable row level security;
alter table public.document_version_files enable row level security;
alter table public.document_placements enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.document_retention enable row level security;
alter table public.document_legal_holds enable row level security;

revoke all on public.documents, public.document_versions, public.file_objects,
  public.document_version_files, public.document_placements, public.upload_sessions,
  public.document_retention, public.document_legal_holds
  from anon, authenticated;
grant select on public.documents, public.document_versions, public.file_objects,
  public.document_version_files, public.document_placements, public.upload_sessions,
  public.document_retention, public.document_legal_holds
  to authenticated;

-- =============================================================================
-- Guards (strict, no bypass GUC — see header).
-- =============================================================================

-- Versions and their file bindings are immutable rows (D3): corrections mint a
-- NEW version; disposal lives on file_objects and keeps the binding metadata.
create function app.guard_document_version_immutable() returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  raise exception 'versões de documento são imutáveis (crie uma nova versão)'
    using errcode = 'HC0D2';
end;
$$;

revoke all on function app.guard_document_version_immutable() from public, anon, authenticated;

create trigger guard_document_version_immutable
  before update or delete on public.document_versions
  for each row execute function app.guard_document_version_immutable();
create trigger guard_document_version_file_immutable
  before update or delete on public.document_version_files
  for each row execute function app.guard_document_version_immutable();

-- file_objects: INSERT shape + the D9 upload machine + the D10 disposal
-- machine + physical-identity immutability + the hold block.
create function app.guard_file_object_transition() returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_hold_exists boolean;
begin
  if tg_op = 'INSERT' then
    if new.upload_state <> 'reserved' or new.disposal_state <> 'none'
       or new.uploaded_at is not null or new.verified_at is not null
       or new.disposed_at is not null or new.disposed_by is not null
       or new.disposal_reason_category is not null then
      raise exception 'objeto de arquivo deve nascer reservado (estado inicial inválido)'
        using errcode = 'HC0D1';
    end if;
    return new;
  end if;

  -- Physical identity is immutable (F-03: reclassification = new row).
  if new.storage_bucket is distinct from old.storage_bucket
     or new.storage_path is distinct from old.storage_path
     or new.sensitivity_tier is distinct from old.sensitivity_tier
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or (old.sha256 is not null and new.sha256 is distinct from old.sha256) then
    raise exception 'identidade física do objeto de arquivo é imutável'
      using errcode = 'HC0D2';
  end if;

  -- D9 upload machine (same-state updates allowed; everything else named).
  if new.upload_state is distinct from old.upload_state then
    if not (
      (old.upload_state = 'reserved'
        and new.upload_state in ('uploaded', 'abandoned', 'failed'))
      or (old.upload_state = 'uploaded'
        and new.upload_state in ('verifying', 'failed'))
      or (old.upload_state = 'verifying'
        and new.upload_state in ('scan_pending', 'rejected', 'failed'))
      or (old.upload_state = 'scan_pending'
        and new.upload_state in ('clean', 'infected', 'unscanned_accepted', 'failed'))
      or (old.upload_state = 'unscanned_accepted'
        and new.upload_state in ('clean', 'infected'))
    ) then
      raise exception 'transição de estado de upload inválida (% → %)',
        old.upload_state, new.upload_state using errcode = 'HC0D1';
    end if;
  end if;

  -- D10 disposal machine.
  if new.disposal_state is distinct from old.disposal_state then
    if not (
      (old.disposal_state = 'none' and new.disposal_state = 'disposal_pending')
      or (old.disposal_state = 'disposal_pending' and new.disposal_state in ('disposed', 'none'))
    ) then
      raise exception 'transição de estado de descarte inválida (% → %)',
        old.disposal_state, new.disposal_state using errcode = 'HC0D1';
    end if;
    -- Legal hold blocks entering any disposal state (D10), resolved through
    -- every document that binds this object.
    if new.disposal_state in ('disposal_pending', 'disposed') then
      select exists (
        select 1
        from public.document_version_files dvf
        join public.document_versions dv on dv.id = dvf.document_version_id
        join public.document_legal_holds h on h.document_id = dv.document_id
        where dvf.file_object_id = new.id
          and h.released_at is null
      ) into v_hold_exists;
      if v_hold_exists then
        raise exception 'descarte bloqueado por retenção legal ativa'
          using errcode = 'HC0D3';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.guard_file_object_transition() from public, anon, authenticated;

create trigger guard_file_object_transition
  before insert or update on public.file_objects
  for each row execute function app.guard_file_object_transition();

-- documents: lifecycle machine + soft-delete honors hold (D10) + anchor
-- immutability.
create function app.guard_document_transition() returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_hold_exists boolean;
begin
  if new.home_resource_id is distinct from old.home_resource_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'âncora do documento é imutável' using errcode = 'HC0D2';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'active' and new.status in ('soft_deleted', 'disposal_pending'))
      or (old.status = 'soft_deleted' and new.status in ('active', 'disposal_pending'))
      or (old.status = 'disposal_pending' and new.status in ('disposed', 'active'))
    ) then
      raise exception 'transição de estado do documento inválida (% → %)',
        old.status, new.status using errcode = 'HC0D4';
    end if;
    -- D10: soft-delete AND disposal both honor an active hold.
    if new.status in ('soft_deleted', 'disposal_pending', 'disposed') then
      select exists (
        select 1 from public.document_legal_holds h
        where h.document_id = new.id and h.released_at is null
      ) into v_hold_exists;
      if v_hold_exists then
        raise exception 'operação bloqueada por retenção legal ativa'
          using errcode = 'HC0D3';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.guard_document_transition() from public, anon, authenticated;

create trigger guard_document_transition
  before update on public.documents
  for each row execute function app.guard_document_transition();
