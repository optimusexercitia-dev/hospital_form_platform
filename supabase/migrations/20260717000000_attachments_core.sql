-- =============================================================================
-- F2 (ADR 0063 / ADR 0065) — Centralized Attachments (14e), migration 1 of 6:
--   the attachments core table, the two non-authorizing companion tables
--   (attachment_references, attachment_subjects — participant-keyed, C-β), the
--   interview external-links table, the DEFINER dispatchers, the physical-column
--   immutability guard, the audit trigger, RLS + K9 grants, and the audit
--   triple-mirror extension (attachment.read).
--
-- Reset-OK / pre-launch: additive, correct shape landed ONCE. Reachability of the
-- write/open RPCs is gated by the `attachments` feature flag (seeded OFF in
-- migration 6). RLS is enabled on EVERY new table from creation regardless of the
-- flag (Rule 1) — the flag gates RPC/feature reachability, never the boundary.
--
-- Polymorphism dialect 2 (ADR 0065 §1): the attachments authorizing owner
-- (owner_type,owner_id) is the platform's first and only owner-dispatch polymorphism
-- — NO FK, authorization dispatched by a SECURITY DEFINER CASE dispatcher, two-step
-- reads only. `owner_type='form_upload'` is permanently reserved-INERT (C-ζ): the
-- dispatcher returns false / null; no writes reach it.
--
-- attachment_subjects uses dialect 3 (participants registry, F1) — one subject
-- vocabulary, not two (C-β). This is why F1 (participants) preceded F2.
--
-- New custom SQLSTATEs (HC high-water was HC095; ADR 0065 §9 / contract §H):
--   HC096 — immutability guard: a frozen physical/owner/bucket/tier column changed
--           outside the app.in_attachments_rpc bracket (this migration).
--   HC097/HC098 — allocated by the disposal door (migration 3). kind-invalid and all
--   flag/authz/CHECK violations reuse check_violation / 42501 (contract §H, Q8).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · public.attachments — core (single authorizing owner + six ADR-0063 seams).
--     Superset of case_documents / meeting_attachments / interview *file* rows.
-- -----------------------------------------------------------------------------
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),

  -- === single AUTHORIZING owner (dialect 2; the ONLY access root) ===
  owner_type text not null
    check (owner_type in ('case', 'meeting', 'interview', 'action_item', 'form_upload')),
  owner_id uuid not null,                            -- polymorphic; NO real FK → no PostgREST embeds

  -- === display / classification metadata ===
  kind text not null default 'outro',                -- validated PER owner_type in create_attachment
  title text not null check (btrim(title) <> ''),
  description text,
  occurred_on date,                                  -- was case_documents.occurred_at

  -- === physical file facts (frozen after insert; Rule 6 / guard_attachment_immutable) ===
  storage_bucket text not null
    check (storage_bucket in ('attachments', 'attachments-phi')),
  storage_path text not null,                        -- '{owner_type}/{owner_id}/{uuid}.{ext}'
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text,                                       -- recorded, NOT unique

  -- === PHI tiering (physical) + semantic regime (orthogonal) ===
  sensitivity_tier text not null default 'phi'
    check (sensitivity_tier in ('phi', 'standard')),
  confidentiality_label text                         -- ADR-0063 §4 — SEMANTIC regime; §F value-set
    check (confidentiality_label is null or confidentiality_label in (
      'non_phi_internal', 'phi_standard', 'phi_restricted',
      'peer_review_confidential', 'legal_privileged', 'ethics_investigation',
      'credentialing_sensitive')),

  scan_status text not null default 'skipped'        -- ADR-0063 §6 — malware gate (no scanner in v1)
    check (scan_status in ('skipped', 'pending', 'clean', 'infected')),

  -- === versioning / redaction seam (reserved; ADR-0063 §3, §9 — inert this phase) ===
  document_group_id uuid,
  supersedes_id uuid references public.attachments(id) on delete set null,

  -- === retention / legal hold (reserved; ADR-0063 §10 — inert this phase) ===
  legal_hold boolean not null default false,         -- true blocks dispose_attachment_phi (HC098)

  -- === disposal accountability (mirrors patient_safety_event / case_referral) ===
  phi_disposed_at timestamptz,                       -- set by dispose_attachment_phi; one-shot
  phi_disposed_by uuid references public.profiles(id),
  phi_disposed_reason text
    check (phi_disposed_reason is null or phi_disposed_reason in (
      'retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other')),

  -- === provenance / soft-delete / stamps ===
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),

  -- bucket <-> tier must agree (14e "bucket↔tier consistency").
  constraint attachments_bucket_tier_ck check (
    (sensitivity_tier = 'phi' and storage_bucket = 'attachments-phi') or
    (sensitivity_tier = 'standard' and storage_bucket = 'attachments')),

  -- path is owner-scoped (14e D4) — a row can't point outside its owner's folder.
  constraint attachments_path_scope_ck check (
    storage_path like owner_type || '/' || owner_id::text || '/%'),

  -- HARD PHI-segregation invariant (Q3, lead §J): only the two Class-1 patient-PHI
  -- labels FORCE the phi bucket. The four Class-2 labels are tier-free (§F). Do NOT
  -- add a non_phi_internal ⇒ standard rule (leave that to the RPC defaults so a
  -- defensively phi-tiered non_phi_internal blob is harmless over-protection).
  constraint attachments_phi_label_tier_ck check (
    confidentiality_label is null
    or not (confidentiality_label in ('phi_standard', 'phi_restricted')
            and sensitivity_tier <> 'phi'))
);

-- PHI-bearing free text → redacted by disposal, NEVER audited (Rule 11).
comment on column public.attachments.title is
  'PHI-BEARING display title (Rule 11/12). Redacted by dispose_attachment_phi / dispose_case_phi; '
  'never entered into audit_diff. Member-readable (the blob is the audited PHI — §A.1 rationale).';
comment on column public.attachments.description is
  'PHI-BEARING free text (Rule 11/12). Redacted by disposal; never in audit_diff.';
comment on column public.attachments.sensitivity_tier is
  'Physical PHI segregation → bucket. EXPORT MUST withhold/redact phi-tier rows (Phase-19 exporter, D11).';
comment on column public.attachments.confidentiality_label is
  'ADR-0063 §4 — SEMANTIC access regime, orthogonal to tier. phi_standard/phi_restricted force the '
  'phi bucket (attachments_phi_label_tier_ck); the four Class-2 labels are tier-free (§F).';
comment on column public.attachments.document_group_id is
  'ADR-0063 §3/§9 reserved — groups versions + original/redacted siblings. Inert until versioning is built.';
comment on column public.attachments.legal_hold is
  'ADR-0063 §10 reserved — true blocks disposal (HC098). No writer this phase (reserved-inert). '
  'ANVISA/CFM 20-yr retention stays procedural, not schema-modeled.';

create index attachments_owner_idx on public.attachments (owner_type, owner_id);
create index attachments_owner_live_idx on public.attachments (owner_type, owner_id) where deleted_at is null;
create index attachments_tier_idx on public.attachments (sensitivity_tier);
create index attachments_uploaded_by_idx on public.attachments (uploaded_by);
create index attachments_group_idx on public.attachments (document_group_id) where document_group_id is not null;

-- -----------------------------------------------------------------------------
-- 2 · public.attachment_references — non-authorizing "also appears here" (ADR-0063 §1).
-- -----------------------------------------------------------------------------
create table if not exists public.attachment_references (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  owner_type text not null
    check (owner_type in ('case', 'meeting', 'interview', 'action_item', 'form_upload')),
  owner_id uuid not null,                            -- polymorphic display target; NO access effect
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (attachment_id, owner_type, owner_id)
);
comment on table public.attachment_references is
  'ADR-0063 §1 — DISPLAY-ONLY. Surfaces one attachment on additional resources without re-upload. '
  'Grants NO access; readability is inherited from the parent attachment''s single authorizing owner.';
create index attachment_references_target_idx on public.attachment_references (owner_type, owner_id);

-- -----------------------------------------------------------------------------
-- 3 · public.attachment_subjects — descriptive, PHI-safe, PARTICIPANT-keyed (C-β).
--     Dialect 3: subject IS a participant (F1 registry). One subject vocabulary.
-- -----------------------------------------------------------------------------
create table if not exists public.attachment_subjects (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,   -- dialect 3
  role_id uuid references public.case_participant_roles(id),                           -- NULLABLE
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (attachment_id, participant_id, role_id)
);
comment on table public.attachment_subjects is
  'ADR-0063 §2 + C-β — DESCRIPTIVE + PHI-SAFE. Records the RELATIONSHIP (participant + optional role) '
  'only; patient/professional IDENTITY stays in the F1 registry / patient_identifiers behind the audited '
  'door (Rule 12). NO free-text names. Grants NO access (parent-inherited RLS).';
create index attachment_subjects_participant_idx on public.attachment_subjects (participant_id);

-- -----------------------------------------------------------------------------
-- 4 · public.case_interview_links — interview external links (14e D3; ADR-0063 unchanged).
--     Absorbs the LINK rows of the folded case_interview_attachments; file rows go to
--     public.attachments (owner_type='interview').
-- -----------------------------------------------------------------------------
create table if not exists public.case_interview_links (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.case_interviews(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  external_url text not null check (external_url like 'https://%'),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id)
);
comment on table public.case_interview_links is
  '14e D3 — interview external links (files-only core keeps storage_path NOT NULL, so links live here). '
  'Read mirrors the interview arm of can_read_attachment.';
create index case_interview_links_interview_idx on public.case_interview_links (interview_id) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 5 · Feature-flag assertion (clone of assert_interviews_enabled; flag 'attachments').
-- -----------------------------------------------------------------------------
create or replace function app.assert_attachments_enabled() returns void
  language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('attachments') then
    raise exception 'o recurso de anexos não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;
alter function app.assert_attachments_enabled() owner to postgres;
revoke all on function app.assert_attachments_enabled() from public;
grant execute on function app.assert_attachments_enabled() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6 · Dispatchers (schema app, STABLE SECURITY DEFINER) — CASE to existing resolvers.
-- -----------------------------------------------------------------------------
create or replace function app.commission_of_attachment(p_owner_type text, p_owner_id uuid)
  returns uuid
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  return case p_owner_type
    when 'case'        then app.commission_of_case(p_owner_id)
    when 'meeting'     then app.commission_of_meeting(p_owner_id)
    when 'interview'   then app.commission_of_interview(p_owner_id)
    when 'action_item' then app.commission_of_action_item(p_owner_id)
    else null                                        -- form_upload / unknown: reserved-inert
  end;
end;
$$;
alter function app.commission_of_attachment(text, uuid) owner to postgres;
revoke all on function app.commission_of_attachment(text, uuid) from public;
grant execute on function app.commission_of_attachment(text, uuid) to authenticated, service_role;

create or replace function app.can_read_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)
  returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_uid is null then
    return false;
  end if;
  return case p_owner_type
    when 'case' then
      app.can_read_case(p_owner_id, p_uid)
    when 'meeting' then
      -- HONOR THE EXPLICIT p_uid (backend fix, reset-OK local-only pass): the single-arg
      -- is_member_of/is_commission_admin_of read auth.uid() implicitly, which silently
      -- diverges from p_uid whenever this dispatcher is invoked outside an RLS/auth.uid()
      -- context (surfaced by the 208_attachments.sql pgTAP keystones, which call the pure
      -- predicate directly). The _for variants exist precisely for this; use them, matching
      -- the explicit-uid pattern the case/interview/action_item arms already follow.
      app.is_member_of_for(app.commission_of_meeting(p_owner_id), p_uid)
        or app.is_commission_admin_of_for(app.commission_of_meeting(p_owner_id), p_uid)
    when 'interview' then
      -- CONTRACT CORRECTION (flagged to lead): §B.2 wrote is_member_of, but the shipped
      -- interview-attachment read is CASE-SCOPED (INFO-N1, migration 20260713001200 —
      -- a deliberate PHI tightening, Rule 12). Using is_member_of here would REVERT that
      -- security boundary, so the interview arm gates on can_read_case, matching the
      -- sibling case-child tables. The org-admin arm keeps commission_of_interview and
      -- (same explicit-p_uid fix as the meeting arm above) uses the _for variant.
      app.can_read_case(app.case_of_interview(p_owner_id), p_uid)
        or app.is_commission_admin_of_for(app.commission_of_interview(p_owner_id), p_uid)
    when 'action_item' then
      -- scope-aware (Q5a): committee / case_restricted / assignees_only.
      app.can_read_action_item(p_owner_id, p_uid)
    else false                                       -- form_upload / unknown: reserved-inert
  end;
end;
$$;
alter function app.can_read_attachment(text, uuid, uuid) owner to postgres;
revoke all on function app.can_read_attachment(text, uuid, uuid) from public;
grant execute on function app.can_read_attachment(text, uuid, uuid) to authenticated, service_role;
comment on function app.can_read_attachment(text, uuid, uuid) is
  'Owner-dispatch READ authorization for an attachment. Pure owner-auth: the scan_status<>''infected'' '
  'gate lives in the read paths (open_attachment / list query), not here. Q5a: action_item dispatches '
  'to the scope-aware can_read_action_item.';

create or replace function app.can_write_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)
  returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  -- HONOR THE EXPLICIT p_uid (backend fix, reset-OK local-only pass — same rationale as
  -- can_read_attachment's meeting/interview arms above): use the _for explicit-uid variants
  -- rather than the implicit-auth.uid() single-arg predicates.
  case p_owner_type
    when 'case' then
      v_commission := app.commission_of_case(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);
    when 'meeting' then
      v_commission := app.commission_of_meeting(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);
    when 'action_item' then
      -- Q5b: staff_admin / org-admin OR the assignee (assigned_to OR active assignment).
      v_commission := app.commission_of_action_item(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or app.is_commission_admin_of_for(v_commission, p_uid)
          or exists (select 1 from public.action_items ai
                     where ai.id = p_owner_id and ai.assigned_to = p_uid)
          or exists (select 1 from public.action_item_assignments a
                     where a.action_item_id = p_owner_id and a.user_id = p_uid and a.completed_at is null);
    when 'interview' then
      return app.can_write_interview(p_owner_id, p_uid);
    else
      return false;                                  -- form_upload / unknown: reserved-inert
  end case;
end;
$$;
alter function app.can_write_attachment(text, uuid, uuid) owner to postgres;
revoke all on function app.can_write_attachment(text, uuid, uuid) from public;
grant execute on function app.can_write_attachment(text, uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7 · Immutability guard (BEFORE UPDATE) — freezes the 7 physical/owner/bucket/tier
--     columns unless the vetted RPC bracket app.in_attachments_rpc is active. The six
--     ADR-0063 seam columns are NOT frozen (inert / RPC-managed — Q3 / §B.4). HC096.
-- -----------------------------------------------------------------------------
create or replace function app.guard_attachment_immutable() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_attachments_rpc', true), 'off') = 'on';
begin
  if v_in_rpc then
    return new;
  end if;
  if new.owner_type is distinct from old.owner_type
     or new.owner_id is distinct from old.owner_id
     or new.storage_bucket is distinct from old.storage_bucket
     or new.storage_path is distinct from old.storage_path
     or new.sha256 is distinct from old.sha256
     or new.size_bytes is distinct from old.size_bytes
     or new.sensitivity_tier is distinct from old.sensitivity_tier then
    raise exception 'anexo imutável: coluna física alterada fora do fluxo permitido'
      using errcode = 'HC096';
  end if;
  return new;
end;
$$;
alter function app.guard_attachment_immutable() owner to postgres;
create trigger guard_attachment_immutable
  before update on public.attachments
  for each row execute function app.guard_attachment_immutable();

-- -----------------------------------------------------------------------------
-- 8 · Audit trigger (AFTER I/U/D). audit_diff allow-list is DELIBERATELY narrow —
--     PHI columns (title/description/storage_path/sha256/subject) are NEVER included
--     (Rule 11). commission derived via commission_of_attachment (null for form_upload).
-- -----------------------------------------------------------------------------
create or replace function app.trg_audit_attachment() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array['owner_type', 'owner_id', 'kind', 'sensitivity_tier',
    'confidentiality_label', 'storage_bucket', 'scan_status', 'occurred_on', 'legal_hold',
    'phi_disposed_reason', 'deleted_at'];
  v_comm uuid;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_comm := app.commission_of_attachment(new.owner_type, new.owner_id);
    perform app.audit_write('attachment.created', 'attachment', new.id, v_comm,
      'Anexo criado', app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  elsif tg_op = 'DELETE' then
    v_comm := app.commission_of_attachment(old.owner_type, old.owner_id);
    perform app.audit_write('attachment.deleted', 'attachment', old.id, v_comm,
      'Anexo removido', app.audit_diff(to_jsonb(old), null, v_cols));
    return null;
  else
    v_comm := app.commission_of_attachment(new.owner_type, new.owner_id);
    if old.deleted_at is null and new.deleted_at is not null then
      v_action := 'attachment.deleted';               -- soft-delete
    elsif new.sensitivity_tier is distinct from old.sensitivity_tier
       or new.storage_bucket is distinct from old.storage_bucket
       or new.confidentiality_label is distinct from old.confidentiality_label then
      v_action := 'attachment.reclassified';
    else
      v_action := 'attachment.updated';
    end if;
    perform app.audit_write(v_action, 'attachment', new.id, v_comm,
      'Anexo atualizado', app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
    return null;
  end if;
end;
$$;
alter function app.trg_audit_attachment() owner to postgres;
create trigger trg_audit_attachment
  after insert or update or delete on public.attachments
  for each row execute function app.trg_audit_attachment();

-- -----------------------------------------------------------------------------
-- 9 · RLS + K9 grants. Every "to authenticated" policy is paired with a matching
--     table GRANT (F1 MAJOR-1 / K9: a policy without a grant is an inert boundary —
--     "permission denied" fires before RLS is ever evaluated). Writes are DEFINER-only
--     (RPCs owned by postgres) — NO insert/update/delete grant to authenticated.
-- -----------------------------------------------------------------------------
alter table public.attachments enable row level security;
create policy attachments_select on public.attachments
  for select to authenticated
  using (app.can_read_attachment(owner_type, owner_id, auth.uid()));
grant select on public.attachments to authenticated;

alter table public.attachment_references enable row level security;
create policy attachment_references_select on public.attachment_references
  for select to authenticated
  using (exists (
    select 1 from public.attachments a
    where a.id = attachment_references.attachment_id
      and app.can_read_attachment(a.owner_type, a.owner_id, auth.uid())));
grant select on public.attachment_references to authenticated;

alter table public.attachment_subjects enable row level security;
create policy attachment_subjects_select on public.attachment_subjects
  for select to authenticated
  using (exists (
    select 1 from public.attachments a
    where a.id = attachment_subjects.attachment_id
      and app.can_read_attachment(a.owner_type, a.owner_id, auth.uid())));
grant select on public.attachment_subjects to authenticated;

alter table public.case_interview_links enable row level security;
-- CASE-SCOPED read (INFO-N1 parity — see the can_read_attachment interview-arm note):
-- links follow can_read_case exactly like the folded interview attachments.
create policy case_interview_links_select on public.case_interview_links
  for select to authenticated
  using (app.can_read_case(app.case_of_interview(interview_id), auth.uid())
         or app.is_commission_admin_of(app.commission_of_interview(interview_id)));
-- Write (insert a link, soft-delete a link) mirrors the interview write authority
-- (can_write_interview) — there is no link RPC; links are thin RLS-gated rows.
create policy case_interview_links_write on public.case_interview_links
  for all to authenticated
  using (app.can_write_interview(interview_id, auth.uid())
         or app.is_commission_admin_of(app.commission_of_interview(interview_id)))
  with check (app.can_write_interview(interview_id, auth.uid())
              or app.is_commission_admin_of(app.commission_of_interview(interview_id)));
grant select, insert, update on public.case_interview_links to authenticated;

-- -----------------------------------------------------------------------------
-- 10 · Audit triple-mirror — add attachment.read (Rule 11). The verb must be in BOTH
--      the allow-list (else check_violation) AND _audit_access_authorized (else the C-4
--      forge-guard silently blocks the read). F1's MOST-RECENT bodies
--      (20260716000100) are the ones extended. create-or-replace preserves grants.
-- -----------------------------------------------------------------------------
create or replace function public.log_audit_access(
  p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid,
  p_summary text, p_metadata jsonb default '{}'::jsonb
) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened',
    'safety_event.viewed', 'triage.viewed', 'rca.viewed', 'capa.viewed',
    'meeting.viewed', 'interview.viewed',
    'referral_patient.read', 'referral.viewed',
    'case_patient.read',
    'professional_profile.read',
    -- ADR 0063 F2: the audited attachment PHI-blob open.
    'attachment.read'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  if not app._audit_access_authorized(p_action, p_entity_id, p_commission) then
    raise exception 'log_audit_access: sem permissão para registrar este acesso'
      using errcode = '42501';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;
alter function public.log_audit_access(text, text, uuid, uuid, text, jsonb) owner to postgres;

create or replace function app._audit_access_authorized(
  p_action text, p_entity_id uuid, p_commission uuid
) returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_resp_commission uuid;
  v_commission uuid;
  v_att_owner_type text;
  v_att_owner_id uuid;
begin
  if v_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  case p_action
    when 'case.opened' then
      return app.can_read_case(p_entity_id, v_uid);
    when 'case_patient.read' then
      return app.can_read_case_patient(p_entity_id, v_uid);
    when 'professional_profile.read' then
      return app.can_read_professional_profile(p_entity_id, v_uid);

    -- ADR 0063 F2: the entity is the attachment id; resolve its owner and gate.
    when 'attachment.read' then
      select a.owner_type, a.owner_id into v_att_owner_type, v_att_owner_id
        from public.attachments a where a.id = p_entity_id;
      return v_att_owner_type is not null
             and app.can_read_attachment(v_att_owner_type, v_att_owner_id, v_uid);

    when 'event_patient.read' then
      return app.can_read_event_patient(p_entity_id, v_uid);
    when 'safety_event.viewed' then
      return app.can_read_event(p_entity_id, v_uid);
    when 'triage.viewed' then
      return app.can_read_event(p_entity_id, v_uid);

    when 'rca.viewed' then
      select event_id into v_event from public.rca where id = p_entity_id;
      return v_event is not null and app.can_read_event(v_event, v_uid);

    when 'capa.viewed' then
      return app.can_read_capa(p_entity_id, v_uid);

    when 'meeting.viewed' then
      select commission_id into v_commission from public.meetings where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));
    when 'interview.viewed' then
      select commission_id into v_commission from public.case_interviews where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));

    when 'referral.viewed' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    when 'referral_patient.read' then
      return app.can_read_referral_phi(p_entity_id, v_uid);

    when 'response.opened_foreign' then
      select commission_id into v_resp_commission from public.responses where id = p_entity_id;
      return v_resp_commission is not null
             and (app.is_staff_admin_of(v_resp_commission)
                  or app.is_commission_admin_of(v_resp_commission));

    when 'response.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));
    when 'audit.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));

    else
      return false;
  end case;
end;
$$;
alter function app._audit_access_authorized(text, uuid, uuid) owner to postgres;
