# Attachments core — revised schema draft (Phase 14e + ADR 0063)

> **Status:** DRAFT for backend review. Not a migration — do **not** place under
> `supabase/migrations/` (it would apply on `db reset`). This is the concrete DDL that revises
> Phase-14e §3.1 to fold in the ADR [0063](../decisions/0063-centralized-attachments-substrate.md)
> seams. It supersedes nothing until B1/B4 turn it into real migrations.
>
> **Legend:** 🆕 = new vs 14e §3.1 (an ADR-0063 seam) · ⏸ = reserved-but-inert (column present,
> feature not built this phase) · ⚙ = mirrors an existing convention (cite in-line).
>
> **Baked-in conventions** (confirmed against `20260620000000_baseline.sql`): all data tables in
> `public`, all helpers in `app.*` (`SECURITY DEFINER`, `set search_path`); classification is
> **CHECK-constrained `text`, never enum** (14e D2 + `controlled_documents`); soft-delete via
> `deleted_at/deleted_by → profiles(id)`; `created_at/updated_at timestamptz not null default now()`;
> writes bracket `set_config('app.in_attachments_rpc','on'/'off', true)`; the `audit_diff` allow-list
> **never** carries `title`/`description`/`storage_path`/`sha256`/subject identity (Rule 11).

---

## 1. Core table `public.attachments`

Superset of `case_documents`, `meeting_attachments`, and the *file* rows of
`case_interview_attachments`, plus the six ADR-0063 additions.

```sql
create table public.attachments (
  id             uuid primary key default gen_random_uuid(),

  -- === single AUTHORIZING owner (14e; the ONLY access root) ===
  owner_type     text not null
                   check (owner_type in ('case','meeting','interview','action_item','form_upload')),
  owner_id       uuid not null,                    -- polymorphic; NO real FK (14e D2) → no PostgREST embeds

  -- === display / classification metadata ===
  kind           text not null default 'outro',    -- validated PER owner_type in create_attachment (see §5)
  title          text not null check (btrim(title) <> ''),
  description    text,
  occurred_on    date,                             -- was case_documents.occurred_at

  -- === physical file facts (immutable after insert; Rule 6) ===
  storage_bucket text not null
                   check (storage_bucket in ('attachments','attachments-phi')),
  storage_path   text not null,                    -- '{owner_type}/{owner_id}/{uuid}.{ext}'
  mime_type      text,
  size_bytes     bigint check (size_bytes is null or size_bytes >= 0),
  sha256         text,                             -- recorded, NOT unique (14e)

  -- === PHI tiering ===
  sensitivity_tier    text not null default 'phi'  -- picks the bucket (physical PHI segregation)
                        check (sensitivity_tier in ('phi','standard')),
  confidentiality_label text                       -- 🆕 ADR-0063 §4 — SEMANTIC regime, orthogonal to tier
                        check (confidentiality_label is null or confidentiality_label in (
                          'non_phi_internal','phi_standard','phi_restricted',
                          'peer_review_confidential','legal_privileged','ethics_investigation',
                          'credentialing_sensitive')),

  scan_status    text not null default 'skipped'   -- 🆕 ADR-0063 §6 — malware gate (no scanner in v1)
                   check (scan_status in ('skipped','pending','clean','infected')),

  -- === versioning / redaction seam (reserved; ADR-0063 §3, §9) ===
  document_group_id uuid,                          -- 🆕⏸ groups versions + original/redacted siblings
  supersedes_id     uuid references public.attachments(id) on delete set null,  -- 🆕⏸ 'v2 supersedes v1'

  -- === retention / legal hold (reserved; ADR-0063 §10) ===
  legal_hold     boolean not null default false,   -- 🆕⏸ true blocks dispose_attachment_phi

  -- === disposal accountability (⚙ mirrors patient_safety_event / case_referral) ===
  phi_disposed_at     timestamptz,                 -- 🆕 set by dispose_attachment_phi; one-shot
  phi_disposed_by     uuid references public.profiles(id),
  phi_disposed_reason text                         -- CONSTRAINED category, never free text (Rule 11 + LGPD)
                        check (phi_disposed_reason is null or phi_disposed_reason in (
                          'retention_expired','subject_request','entered_in_error','duplicate','other')),

  -- === provenance / soft-delete / stamps ===
  uploaded_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  deleted_by     uuid references public.profiles(id),

  -- bucket ↔ tier must agree (14e "bucket↔tier consistency")
  constraint attachments_bucket_tier_ck check (
    (sensitivity_tier = 'phi'      and storage_bucket = 'attachments-phi') or
    (sensitivity_tier = 'standard' and storage_bucket = 'attachments')),

  -- path is owner-scoped (14e D4) — enforced so a row can't point outside its owner's folder
  constraint attachments_path_scope_ck check (
    storage_path like owner_type || '/' || owner_id::text || '/%')
);

-- PHI-bearing free text → redacted by disposal, NEVER audited (Rule 11).
comment on column public.attachments.title       is 'PHI-BEARING display title (Rule 11/12). Redacted by dispose_attachment_phi; never entered into audit_diff.';
comment on column public.attachments.description is 'PHI-BEARING free text (Rule 11/12). Redacted by dispose_attachment_phi; never entered into audit_diff.';
-- Binding export contract (14e D11 / ADR-0063).
comment on column public.attachments.sensitivity_tier    is 'Physical PHI segregation → bucket. EXPORT MUST withhold/redact phi-tier rows (Phase-19 exporter honors this).';
comment on column public.attachments.confidentiality_label is 'ADR-0063 §4 — SEMANTIC access regime, orthogonal to tier. Convention: non_phi_internal ⇒ standard; all else default phi. Value set finalized with clinical governance (ADR-0063 open item a).';
comment on column public.attachments.document_group_id is 'ADR-0063 §3/§9 reserved — groups versions + original/redacted siblings. Inert until versioning/redaction is built.';
comment on column public.attachments.legal_hold        is 'ADR-0063 §10 reserved — true blocks disposal. ANVISA/CFM 20-yr retention stays procedural, not schema-modeled.';

create index attachments_owner_idx        on public.attachments (owner_type, owner_id);
create index attachments_owner_live_idx   on public.attachments (owner_type, owner_id) where deleted_at is null;
create index attachments_tier_idx         on public.attachments (sensitivity_tier);
create index attachments_uploaded_by_idx  on public.attachments (uploaded_by);
create index attachments_group_idx        on public.attachments (document_group_id) where document_group_id is not null;
```

**Notes**

- `kind` stays a generic `text default 'outro'`; the *per-owner-type allowed set* is validated in
  `create_attachment` (§5), preserving the union of today's per-table CHECKs
  (`case_documents`: `ata|digitalizacao|registro|other`; `meeting_attachments`:
  `pauta|apresentacao|literatura|lista_presenca|ata_assinada|outro`; `interview`:
  `gravacao_audio|transcricao_assinada|evidencia|outro`; `action_item`: `evidencia|outro`).
- Interview **external links** do **not** live here (14e D3) — file rows only; links go to
  `case_interview_links` (§4).
- No `external_url` column (unlike `case_interview_attachments`): the core is **files-only**
  (`storage_path not null`).

---

## 2. 🆕 `public.attachment_references` — non-authorizing "also appears here" pointers (ADR-0063 §1)

```sql
create table public.attachment_references (
  id            uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  owner_type    text not null
                  check (owner_type in ('case','meeting','interview','action_item','form_upload')),
  owner_id      uuid not null,                     -- polymorphic display target; NO access effect
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (attachment_id, owner_type, owner_id)
);
comment on table public.attachment_references is
  'ADR-0063 §1 — DISPLAY-ONLY. Surfaces one attachment on additional resources without re-upload. Grants NO access; readability is inherited from the parent attachment''s single authorizing owner.';
create index attachment_references_target_idx on public.attachment_references (owner_type, owner_id);
```

---

## 3. 🆕 `public.attachment_subjects` — descriptive, PHI-safe "what it's about" (ADR-0063 §2)

```sql
create table public.attachment_subjects (
  id            uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  subject_type  text not null
                  check (subject_type in ('patient','physician','staff','complainant',
                                          'witness','department','committee','hospital')),
  subject_id    uuid,                              -- OPTIONAL structured ref to a domain row; NO free-text name
  subject_role  text not null
                  check (subject_role in ('patient_of_record','physician_under_review','complainant',
                                          'witness','involved_staff','department_involved','institution')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (attachment_id, subject_type, subject_id, subject_role)
);
comment on table public.attachment_subjects is
  'ADR-0063 §2 — DESCRIPTIVE + PHI-SAFE. Records the RELATIONSHIP (role) only; patient/physician IDENTITY stays in the domain''s isolated PHI table (Rule 12). NO free-text names here. Grants NO access.';
create index attachment_subjects_subject_idx on public.attachment_subjects (subject_type, subject_id);
```

---

## 4. `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063)

```sql
create table public.case_interview_links (
  id           uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.case_interviews(id) on delete cascade,
  title        text not null check (btrim(title) <> ''),
  external_url text not null check (external_url like 'https://%'),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  deleted_by   uuid references public.profiles(id)
);
-- RLS mirrors the interview arm of can_read_attachment / can_write_interview; the UI merges
-- links (here) + file rows (attachments where owner_type='interview') into one panel.
```

---

## 5. Triggers, dispatchers, RPCs (surface sketch — bodies at B1/B3)

### 5.1 Immutability guard ⚙ (clone of `app.guard_case_narrative_frozen`)

```sql
-- BEFORE UPDATE on public.attachments. Freezes physical + owner + bucket/tier columns unless the
-- vetted RPC bracket is active. Mirrors guard_case_narrative_frozen's current_setting gate.
create function app.guard_attachment_immutable() returns trigger
  language plpgsql security definer set search_path to 'app','public','pg_catalog' as $$
declare v_in_rpc boolean := coalesce(current_setting('app.in_attachments_rpc', true), 'off') = 'on';
begin
  if v_in_rpc then return new; end if;
  if new.owner_type    is distinct from old.owner_type
     or new.owner_id   is distinct from old.owner_id
     or new.storage_bucket is distinct from old.storage_bucket
     or new.storage_path   is distinct from old.storage_path
     or new.sha256     is distinct from old.sha256
     or new.size_bytes is distinct from old.size_bytes
     or new.sensitivity_tier is distinct from old.sensitivity_tier then
    raise exception 'anexo imutável: coluna física alterada fora do fluxo permitido'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
```

### 5.2 Audit trigger ⚙ (`app.audit_write` + `app.audit_diff` — allow-list excludes PHI columns)

```sql
-- AFTER INSERT/UPDATE/DELETE. action ∈ attachment.created|updated|reclassified|deleted.
-- audit_diff allow-list is DELIBERATELY narrow — physical/PHI columns are NEVER included (Rule 11):
--   {owner_type, owner_id, kind, sensitivity_tier, confidentiality_label, storage_bucket,
--    scan_status, occurred_on, legal_hold, phi_disposed_reason, deleted_at}
-- commission derived via app.commission_of_attachment(owner_type, owner_id) (null for form_upload).
```

### 5.3 Dispatchers (schema `app`, DEFINER — CASE to existing domain predicates)

```sql
-- commission_of_attachment: case→commission_of_case; meeting→commission_of_meeting;
--   interview→commission_of_interview; action_item→commission_of_action_item; form_upload→null.
-- can_read_attachment(owner_type, owner_id, uid):
--   case      → app.can_read_case(owner_id, uid)  OR org-admin of its commission
--   meeting   → is_member_of(commission_of_meeting) OR is_commission_admin_of(...)
--   interview → is_member_of(commission_of_interview) OR is_commission_admin_of(...)
--   action_item → membership OR org-admin
--   form_upload → false   (reserved; 14e D8/D9)
--   AND scan_status <> 'infected' (ADR-0063 §6 gate)
-- can_write_attachment(owner_type, owner_id, uid):
--   case/meeting/action_item → is_staff_admin_of OR is_org_admin_of_commission
--                              (recommended: also action_items.assigned_to = uid)
--   interview → app.can_write_interview(owner_id, uid)
--   form_upload → false
```

`attachment_references` and `attachment_subjects` **RLS SELECT** = readability of the *parent*:
`exists (select 1 from public.attachments a where a.id = attachment_id and
app.can_read_attachment(a.owner_type, a.owner_id, auth.uid()))`. They never introduce a new grant.

### 5.4 RPCs (`public`, DEFINER) + feature flag

```sql
-- assert flag first in every RPC:
--   app.assert_attachments_enabled()  ⚙ (clone of assert_interviews_enabled; flag 'attachments')
--
-- create_attachment(...)        : assert flag → can_write_attachment → validate kind per owner_type
--                                 → tier default 'phi' (declassify requires staff_admin)
--                                 → verify object exists in the tier bucket → insert (bracketed).
-- open_attachment(id) → (bucket, path)
--                                 : re-gate can_read_attachment; for phi (and, per §5, standard/denied)
--                                   log_audit_access('attachment.read', … , metadata⊇{access_decision}).
-- reclassify_attachment(id,new_tier): staff_admin-only, DIRECTIONAL (declassify gated); brackets the
--                                 RPC flag; flips bucket+tier; Next orchestrates copy → RPC → remove-source
--                                 (Rule-6 PHI-safety exception, 14e D5).
-- soft_delete_attachment(id)    : set deleted_at/deleted_by (object retained).
-- dispose_attachment_phi(id, reason) ⚙ (clone of dispose_event_phi): reason ∈ the 5-value set;
--                                 REJECT if legal_hold; null title/description; stamp
--                                 phi_disposed_at/_by/_reason; audit 'attachment.phi_disposed';
--                                 also redact via the D10 per-owner line keyed on (owner_type, owner_id).
```

### 5.5 Audit triple-mirror (add `attachment.read` in all three — Rule 11)

1. `public.log_audit_access` allow-list (baseline `…:11987`).
2. `app._audit_access_authorized` dispatch arm → `app.can_read_attachment` (`20260711000100_grant_hardening.sql`).
3. TS union `AuditAccessAction` in `src/lib/audit/access.ts`.
4. Extend `supabase/tests/191_grant_hardening.sql` with an authorized-vs-unauthorized `attachment.read` pair.

---

## 6. Storage buckets

Two private buckets `attachments` / `attachments-phi` (25 MiB, superset MIME: images + PDF + full
Office + csv/plain). Path `{owner_type}/{owner_id}/{uuid}.{ext}` → `foldername(name)[1]=owner_type`,
`[2]=owner_id` (⚙ same `storage.foldername(...)` dispatch as `case-documents`).

- `attachments`: INSERT + SELECT policies dispatch to `can_write_attachment` / `can_read_attachment`
  on `(foldername[1], foldername[2])`.
- `attachments-phi`: INSERT via `can_write_attachment`; **NO authenticated SELECT** — only the
  service-role client (`src/lib/supabase/admin.ts::createAdminClient()`) signs, and only the
  `(bucket, path)` the audited `open_attachment` door returned, short TTL (14e D7 hard door).

---

## 7. What changed vs Phase-14e §3.1 (review checklist)

| # | Change | ADR-0063 | Retrofit cost if deferred |
|---|--------|----------|---------------------------|
| 1 | `attachment_references` (non-authorizing) | §1 | High — code assumes one owner |
| 2 | `attachment_subjects` (descriptive, PHI-safe) | §2 | High — subject collapsed into owner |
| 3 | `document_group_id` + `supersedes_id` columns | §3, §9 | High — versioning/redaction identity |
| 4 | `confidentiality_label` column | §4 | Low (additive) |
| 5 | all-tier + denied read audit (`access_decision`) | §5 | Low (metadata) |
| 6 | `scan_status` column + `<>'infected'` gate | §6 | Low (additive) |
| 7 | `legal_hold` + `phi_disposed_*` + `dispose_attachment_phi` | §10 | Low (additive) |

Items 4–7 are additive and could technically follow B1; **1–3 must land in B1** because they set the
cardinality/shape of the core. Recommended: create all columns + both companion tables in B1; leave
references/subjects **unpopulated** until later surfaces need them (ADR-0063 open item b).
