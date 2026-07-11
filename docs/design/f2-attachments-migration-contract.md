# F2 — Centralized Attachments (14e) migration contract (plan-in-text)

> **Status:** ✅ **REVIEWED & APPROVED BY LEAD 2026-07-10** — rulings on Q1–Q10 recorded in
> **§J (Lead rulings)** at the foot of this file; build proceeds against them. Still design-only
> at time of approval (no migration/`src` edits/SQL applied yet).
> This is the F2 analog of F1's approved Q1–Q6 contract. The lead reviewed it and ruled the
> **open questions (§I)** — see **§J**. **Binding inputs conformed to (not re-litigated):**
> Pre-Pilot Foundations Program §1 C-α…C-θ + §3 F2 + §4; ADR 0063; ADR 0065 (F0 conventions);
> ADR 0064/0066 (F1); the attachments schema draft; phase-14e §5. Where the ADR-0063 draft
> conflicts with a §1 C-resolution, the **plan wins** and the conflict is named (§0).
>
> **Verified against the live migrations** (not summaries): the three F1 migrations
> `20260716000000`–`…000200`; the fold-in source tables + FK delete-actions in
> `20260620000000_baseline.sql`; `action_items` + `visibility_scope` + `can_read_action_item`
> in `20260706000000` / `20260707000000`; the `dispose_case_phi` F2 SEAM in F1 part 3.
>
> **Reset-OK / pre-pilot / local-only.** Forward-only, additive migrations from
> `20260717000000+`. Flag `attachments` seeded **OFF**. Remote deploy deferred to the pilot.

---

## 0. Conflicts named (plan wins) + verified-fact corrections

| # | Draft / spec said | Binding resolution | Action |
|---|---|---|---|
| N1 | Draft §3 `attachment_subjects (subject_type, subject_id, subject_role)` free CHECK columns | **C-β:** re-key to `(participant_id → participants(id), role_id → case_participant_roles(id) NULL, note)` — dialect 3; one subject vocabulary | **Plan wins.** §A.3 drops the draft's CHECK columns entirely. |
| N2 | Draft §3.8 / ADR-0063 D9 reserve `form_items.phi_policy` | **C-ζ:** dropped — no `form_items` co-edit; `form_upload` stays reserved-**inert** | **Plan wins.** F2 does not touch `form_items`; `owner_type='form_upload'` dispatcher returns `false`. |
| N3 | Plan §1 C-θ calls `meeting`/`interview` files **"(mime-only)"** needing a per-owner_type default `kind` | **Verified fact:** `meeting_attachments.kind` (6 values) and `case_interview_attachments.kind` (4 values) **exist** — they are NOT mime-only | **Fidelity-preserving refinement** (honours the plan's "preserve, don't flatten" intent): fold-in copies each source's real `kind`/`doc_type` verbatim; the per-owner_type default `kind` governs **new** uploads only. See §A.1 + open Q6. |
| N4 | Draft §5.1 immutability guard raises `errcode='check_violation'` | F1 precedent gives guards a precise HC code (HC094/HC095) | **Recommend HC096** for a catchable code; lead-rulable (open Q8). |
| N5 | Draft §5 adds all-tier + **denied**-read auditing (`access_decision`) | Plan F2 gate names only "PHI-door single-open audit" | **Core contract = phi-open audited; standard = direct-sign no audit.** Denied/all-tier audit offered as additive metadata (open Q4). |

---

## A. Table / column DDL plan (attachments + companions)

All data tables in `public`; all helpers in `app.*` (`SECURITY DEFINER`, `set search_path`).
Classification columns are **CHECK-constrained `text`, never enum** (14e D2). Every RLS policy
`to authenticated` is paired with a matching table **GRANT** (F1 MAJOR-1 / K9 lesson — a policy
without a grant is an inert boundary).

### A.1 `public.attachments` — core (single authorizing owner + six ADR-0063 seams)

Columns (superset of `case_documents` / `meeting_attachments` / interview *file* rows):

| Column | Type / default | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `owner_type` | `text not null` CHECK ∈ `case,meeting,interview,action_item,form_upload` | **dialect 2** authorizing owner (no FK) |
| `owner_id` | `uuid not null` | polymorphic; **NO FK** → no PostgREST embeds, two-step reads |
| `kind` | `text not null default 'outro'` | validated per `owner_type` in `create_attachment`; fold-in preserves source value |
| `title` | `text not null` CHECK `btrim<>''` | **PHI-bearing**; redacted by disposal; never audited |
| `description` | `text` | **PHI-bearing**; redacted by disposal; never audited |
| `occurred_on` | `date` | was `case_documents.occurred_at` |
| `storage_bucket` | `text not null` CHECK ∈ `attachments,attachments-phi` | |
| `storage_path` | `text not null` | `{owner_type}/{owner_id}/{uuid}.{ext}` (Rule 6, files-only D3) |
| `mime_type` | `text` | |
| `size_bytes` | `bigint` CHECK `null or >=0` | |
| `sha256` | `text` | recorded, NOT unique |
| `sensitivity_tier` | `text not null default 'phi'` CHECK ∈ `phi,standard` | **physical** PHI segregation → bucket |
| `confidentiality_label` | `text` CHECK null-or ∈ 7-value set (§F) | 🆕 **semantic** regime, orthogonal to tier |
| `scan_status` | `text not null default 'skipped'` CHECK ∈ `skipped,pending,clean,infected` | 🆕 malware gate; read gated on `<>'infected'` |
| `document_group_id` | `uuid` | 🆕⏸ reserved (versioning/redaction); inert this phase |
| `supersedes_id` | `uuid references public.attachments(id) on delete set null` | 🆕⏸ reserved; inert this phase |
| `legal_hold` | `boolean not null default false` | 🆕⏸ true blocks `dispose_attachment_phi` (HC098) |
| `phi_disposed_at` | `timestamptz` | set by disposal; one-shot |
| `phi_disposed_by` | `uuid references public.profiles(id)` | |
| `phi_disposed_reason` | `text` CHECK null-or ∈ 5-value set | `retention_expired,subject_request,entered_in_error,duplicate,other` |
| `uploaded_by` | `uuid references public.profiles(id)` | |
| `created_at`/`updated_at` | `timestamptz not null default now()` | |
| `deleted_at`/`deleted_by` | `timestamptz` / `uuid references profiles(id)` | soft-delete |

Table constraints:
- `attachments_bucket_tier_ck` — `(phi ↔ attachments-phi) or (standard ↔ attachments)`.
- `attachments_path_scope_ck` — `storage_path like owner_type||'/'||owner_id::text||'/%'`.
- **`attachments_phi_label_tier_ck` (NEW, proposed)** — `not (confidentiality_label in
  ('phi_standard','phi_restricted') and sensitivity_tier <> 'phi')`. Enforces "any patient-PHI
  label forces the phi bucket" at the DB, not just the RPC (open Q3 — hard CHECK vs RPC-only).

Indexes: `(owner_type, owner_id)`; partial `(owner_type, owner_id) where deleted_at is null`;
`(sensitivity_tier)`; `(uploaded_by)`; partial `(document_group_id) where not null`.

Binding COMMENTs: on `title`/`description` (PHI-bearing, redacted by disposal, never in
`audit_diff`); on `sensitivity_tier` (export MUST withhold/redact phi rows — Phase-19, D11); on
`confidentiality_label`, `document_group_id`, `legal_hold` (reserved-seam semantics).

**RLS + GRANT (K9-paired):**
```
alter table public.attachments enable row level security;
create policy attachments_select on public.attachments for select to authenticated
  using (app.can_read_attachment(owner_type, owner_id, auth.uid()));
grant select on public.attachments to authenticated;          -- K9: policy inert without this
-- NO insert/update/delete grant: all writes via DEFINER RPCs (owner=postgres, grant/RLS-immune).
```
Rationale for member-readable metadata rows: `title`/`description` are PHI-bearing but
case-worker-visible (exactly as `case_narratives`/`cases.label`/today's `case_documents` are).
The **file blob** is the PHI gated by the phi bucket + the audited door; the metadata row read is
not audited (like a narrative read is not). This preserves the current posture.

**Per-`owner_type` `kind` validation set** (enforced in `create_attachment`, preserving today's
per-table CHECKs; fold-in copies verbatim — N3/Q6):

| owner_type | allowed `kind` | default (new uploads) |
|---|---|---|
| `case` | `ata, digitalizacao, registro, other` | `other` |
| `meeting` | `pauta, apresentacao, literatura, lista_presenca, ata_assinada, outro` | `outro` |
| `interview` | `gravacao_audio, transcricao_assinada, evidencia, outro` | `outro` |
| `action_item` | `evidencia, outro` | `outro` |
| `form_upload` | — (inert; no writes) | — |

### A.2 `public.attachment_references` — non-authorizing "also appears here" (ADR-0063 §1)

`id`, `attachment_id → attachments(id) on delete cascade`, `owner_type` (same 5-value CHECK),
`owner_id uuid` (display target, **no access effect**), `note text`, `created_by → profiles(id)`,
`created_at`, `unique (attachment_id, owner_type, owner_id)`. Index `(owner_type, owner_id)`.

**RLS + GRANT** — read = parent readability; **no new grant of access**:
```
create policy attachment_references_select on public.attachment_references for select to authenticated
  using (exists (select 1 from public.attachments a
                 where a.id = attachment_id
                   and app.can_read_attachment(a.owner_type, a.owner_id, auth.uid())));
grant select on public.attachment_references to authenticated;   -- K9
```
No write grant this phase (populated by later surfaces — ADR-0063 open item b). Open Q7 asks
whether this should instead be DEFINER-read-only (no policy/grant).

### A.3 `public.attachment_subjects` — descriptive, PHI-safe, **participant-keyed (C-β)**

**Drops the draft's `subject_type`/`subject_id`/`subject_role` CHECK columns.** New shape:
```
create table public.attachment_subjects (
  id             uuid primary key default gen_random_uuid(),
  attachment_id  uuid not null references public.attachments(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,   -- dialect 3
  role_id        uuid references public.case_participant_roles(id),                    -- NULLABLE
  note           text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  unique (attachment_id, participant_id, role_id)
);
create index attachment_subjects_participant_idx on public.attachment_subjects (participant_id);
```
Non-authorizing + PHI-safe by construction: a `participants` row carries only identity + type;
patient identity stays in `patient_identifiers` behind the F1 audited door (Rule 12). One subject
vocabulary, not two.

**RLS + GRANT** — read = parent readability (same predicate as §A.2) + `grant select`. No same-org
subject guard at E0 (non-authorizing display metadata; the participant carries its own org) — open
Q7 notes the option. No write grant this phase.

### A.4 `public.case_interview_links` — interview external links (14e D3; unchanged by ADR-0063)

`id`, `interview_id → case_interviews(id) on delete cascade`, `title text not null` CHECK
`btrim<>''`, `external_url text not null` CHECK `like 'https://%'`, `created_by → profiles(id)`,
`created_at`, `deleted_at`, `deleted_by`. Absorbs the **link** rows of the folded
`case_interview_attachments` (its `source_xor` CHECK: file rows → `attachments`; link rows → here).

**RLS + GRANT** — read = interview readability (mirror the `interview` arm of
`can_read_attachment`); write via the interview DEFINER RPCs (`can_write_interview`):
```
create policy case_interview_links_select on public.case_interview_links for select to authenticated
  using (app.is_member_of(app.commission_of_interview(interview_id))
         or app.is_commission_admin_of(app.commission_of_interview(interview_id)));
grant select on public.case_interview_links to authenticated;   -- K9
```
Open Q2 asks whether this stays a separate table or becomes an `owner_type` on the core.

---

## B. DEFINER dispatchers (schema `app`) + immutability guard + audit mirror

### B.1 `app.commission_of_attachment(owner_type text, owner_id uuid) returns uuid`
`STABLE SECURITY DEFINER`, search_path pinned. CASE dispatch to **existing, verified** resolvers:

| owner_type | resolves commission via | verified symbol |
|---|---|---|
| `case` | `app.commission_of_case(owner_id)` | baseline |
| `meeting` | `app.commission_of_meeting(owner_id)` | baseline L1662 |
| `interview` | `app.commission_of_interview(owner_id)` | baseline L1651 |
| `action_item` | `app.commission_of_action_item(owner_id)` | `20260706000000` L279 (non-recursive; reads `action_items.commission_id`) |
| `form_upload` | `null` | reserved-inert |

### B.2 `app.can_read_attachment(owner_type text, owner_id uuid, uid uuid) returns boolean`
`STABLE SECURITY DEFINER`. Returns **false** unless `scan_status<>'infected'` is also satisfied at
the row level — so the scan gate is applied in the **RPC/read paths** that hold the row, while this
dispatcher answers pure owner-authorization (it does not see `scan_status`). CASE:

| owner_type | read authorization |
|---|---|
| `case` | `app.can_read_case(owner_id, uid)` (F1-safe: DEFINER over base tables) |
| `meeting` | `app.is_member_of(commission_of_meeting) or app.is_commission_admin_of(...)` |
| `interview` | `app.is_member_of(commission_of_interview) or app.is_commission_admin_of(...)` |
| `action_item` | **`app.can_read_action_item(owner_id, uid)`** — the shipped scope-aware predicate (committee / case_restricted / assignees_only). Non-recursive; resolves commission + scope itself. |
| `form_upload` | `false` (reserved-inert) |
| else | `false` |

> **action_item resolution (open Q5):** dispatching to `can_read_action_item` is the clean answer
> to "action-item attachment RLS given `visibility_scope`" — a `case_restricted` action item's
> attachments become visible exactly to `can_read_case` readers, `assignees_only` to its assignees,
> `committee` to members. I recommend this; the lead should ratify (vs a flat membership read).

### B.3 `app.can_write_attachment(owner_type text, owner_id uuid, uid uuid) returns boolean`
`STABLE SECURITY DEFINER`. CASE:

| owner_type | write authorization |
|---|---|
| `case` | `app.is_staff_admin_of(commission_of_case) or app.is_org_admin_of_commission(...)` |
| `meeting` | `app.is_staff_admin_of(commission_of_meeting) or app.is_org_admin_of_commission(...)` |
| `action_item` | `is_staff_admin_of(commission) or is_org_admin_of_commission(...)` **or** the assignee (`action_items.assigned_to = uid` or an active `action_item_assignments` row) — open Q5 |
| `interview` | `app.can_write_interview(owner_id, uid)` (baseline L1536 — row-level participant-write) |
| `form_upload` | `false` |
| else | `false` |

### B.4 Immutability guard `app.guard_attachment_immutable()` (BEFORE UPDATE)
`SECURITY DEFINER`, search_path pinned. Clone of the narrative-freeze pattern:
`v_in_rpc := coalesce(current_setting('app.in_attachments_rpc', true),'off')='on'; if v_in_rpc then
return new; end if;` then raise if any **frozen column** changed:
`owner_type, owner_id, storage_bucket, storage_path, sha256, size_bytes, sensitivity_tier`.
Raise `HC096` (proposed; draft said `check_violation` — Q8) with pt-BR message. The
`reclassify_attachment` RPC brackets `app.in_attachments_rpc='on'` so it may flip `bucket`+`tier`.
`document_group_id`/`supersedes_id`/`confidentiality_label` are **not** frozen (inert/RPC-managed;
open Q3).

### B.5 Audit trigger `app.trg_audit_attachment()` (AFTER I/U/D)
`app.audit_write('attachment.'||{created|updated|reclassified|deleted}, 'attachment', id,
app.commission_of_attachment(owner_type, owner_id), <pt-BR>, app.audit_diff(old,new, ALLOWLIST))`.
**`audit_diff` allow-list (Rule 11 — NEVER title/description/storage_path/sha256/subject):**
`{owner_type, owner_id, kind, sensitivity_tier, confidentiality_label, storage_bucket, scan_status,
occurred_on, legal_hold, phi_disposed_reason, deleted_at}`.

### B.6 Audit triple-mirror — add `attachment.read` (Rule 11; ties into F1's `log_audit_access`)
1. **allow-list** in `public.log_audit_access` — add `'attachment.read'` to the `p_action not in (…)`
   set (the F1 migration's most-recent body is the one to extend).
2. **`app._audit_access_authorized` dispatch arm** — add
   `when 'attachment.read' then …`. The entity is the **attachment id**; the arm resolves its owner
   and gates: `select owner_type, owner_id into … from public.attachments where id = p_entity_id;
   return app.can_read_attachment(v_owner_type, v_owner_id, v_uid);`
3. **TS union** `AuditAccessAction` in `src/lib/audit/access.ts` — add `'attachment.read'` (B7/TS).
4. Extend `supabase/tests/191_grant_hardening.sql` with an authorized-vs-unauthorized
   `attachment.read` pair.
`app.assert_attachments_enabled()` = clone of `assert_interviews_enabled` on flag `attachments`
(raises `check_violation` when off).

---

## C. PHI-door design (bucket policy + audited service-role read + NULL-out-of-scope)

### C.1 Two physically-tiered buckets (25 MiB, superset MIME — Office+PDF+images+csv/plain)
- **`attachments`** (standard tier): INSERT + SELECT policies dispatch to
  `can_write_attachment` / `can_read_attachment` on
  `(storage.foldername(name)[1]=owner_type, [2]=owner_id)` — same `foldername` dispatch as
  `case-documents` today.
- **`attachments-phi`** (phi tier): INSERT via `can_write_attachment`; **NO `authenticated` SELECT
  policy at all** (the hard door — mirrors F1's Class-1 REVOKE posture). Only the service-role
  client signs, and only the `(bucket, path)` the audited door returned, short TTL.

### C.2 The audited door `public.open_attachment(p_id uuid) returns record(bucket text, path text)`
`SECURITY DEFINER`, t19 (`REVOKE ALL FROM PUBLIC` + `GRANT authenticated, service_role`). Contract:
1. `assert_attachments_enabled()`.
2. Load the row; if not found → return null.
3. Gate `scan_status <> 'infected'` — else return null (never serve an infected object).
4. **`if not app.can_read_attachment(owner_type, owner_id, auth.uid()) then return null;`** —
   NULL-out-of-scope (the F1 `get_participant_patient` contract): a foreigner gets **no row, no
   signed URL, and no audit row**. This is the provable-isolation keystone.
5. If `sensitivity_tier='phi'` → `perform public.log_audit_access('attachment.read','attachment',
   p_id, app.commission_of_attachment(owner_type,owner_id), <pt-BR>, '{}'::jsonb)` then return
   `(storage_bucket, storage_path)`. Next signs with the **service-role** key (server-only,
   `src/lib/supabase/admin.ts`), short TTL — the only reader of the phi bucket.
6. If `sensitivity_tier='standard'` → the list path already minted a signed URL directly (standard
   bucket SELECT policy), **no audit** (D7). `open_attachment` for a standard row simply returns the
   `(bucket, path)` without a `.read` (or the caller never calls it). Open Q4: whether to also audit
   standard opens + denied attempts (`access_decision` metadata) at E0.

**NULL-out-of-scope contract (binding):** every door (`open_attachment`) returns `null` — not an
error, not a partial — when `can_read_attachment` is false, and writes **no** audit row for the
denied case in the core contract. The audit row is written **only** on an allowed phi open, exactly
once per open. (This is the phase-14e §5 "PHI-door single-open audit" + "phi bucket denies
authenticated SELECT" keystone pair.)

---

## D. Atomic fold-in / FK-repoint migration (exact statement order; what breaks if split)

**Verified inbound coupling to `case_documents`:**
- `rca_evidence.cited_document_id → case_documents(id)` **ON DELETE RESTRICT**
  (`20260711000300_schema_integrity_checks.sql` L42–44).
- `referral_shared_item.source_document_id → case_documents(id)` **ON DELETE SET NULL**
  (baseline L21165).

Both must be repointed to `attachments(id)` in the **same** migration as the `case_documents` drop.
At migration time on a fresh `db reset` all tables are empty (seed runs after all migrations), so
this is pure DDL — **no data migration**. Statement order in `20260717000300_attachments_foldin.sql`:

```
-- 1. Repoint the two inbound FKs OFF case_documents → attachments (preserve each delete-action).
alter table public.rca_evidence      drop constraint rca_evidence_cited_document_id_fkey;
alter table public.rca_evidence      add  constraint rca_evidence_cited_document_id_fkey
  foreign key (cited_document_id)  references public.attachments(id) on delete restrict;
alter table public.referral_shared_item drop constraint referral_shared_item_source_document_id_fkey;
alter table public.referral_shared_item add  constraint referral_shared_item_source_document_id_fkey
  foreign key (source_document_id) references public.attachments(id) on delete set null;

-- 2. Rewire the readers/writers that named case_documents:
--    - add_referral_shared_item  (baseline L6729): its p_source_document_id lookup now targets
--      public.attachments (owner_type='case', owner_id=source_case_id, deleted_at is null).
--    - get_referral_detail       (jsonb builder incl. source_document_id): re-point to attachments.
--    (Both recreated with t19 REVOKE→GRANT since DROP/CREATE resets grants.)

-- 3. Drop the three folded tables + their RPCs/policies/triggers (now free of inbound FKs):
drop function ... (add/update/delete document, meeting-attachment, interview-attachment RPCs) ...;
drop table if exists public.case_documents            cascade;
drop table if exists public.meeting_attachments       cascade;
drop table if exists public.case_interview_attachments cascade;
```

**owner_type='action_item' is a new capability with NO fold-in** — it is already a legal value in
the core CHECK (§A.1); no table drop, no repoint. The dispatcher (§B) resolves it via
`action_items.commission_id` / `can_read_action_item` — non-recursive.

**What breaks if split** (why atomic): if the `case_documents` drop lands in a different migration
than the repoint, then (a) with `cited_document_id` still `ON DELETE RESTRICT`, the drop **fails**
(RESTRICT blocks); or (b) had it been `SET NULL`, the drop would **null every referral citation** —
silent data loss. A half-applied migration leaves either `rca_evidence` or `referral_shared_item`
pointing at a dropped table. Single migration only. (This is phase-14e Risk #1 / plan C-θ.)

**Legacy buckets** `case-documents` / `meeting-attachments` / `interview-attachments`: leave their
objects + policies in place at cutover; retire in a later cleanup migration (post-gate), not in the
atomic fold-in (keeps the risky migration minimal).

---

## E. D10 disposal composition — layered on F1's participant-keyed `dispose_case_phi`

F1 landed the final `dispose_case_phi` body in `20260716000200_disposal_and_flags.sql` with an
**explicit F2 SEAM** between arm (g) and arm (h). Quoting F1's body around the seam:

```
  -- (g) per-(meeting,case) notes.
  update public.meeting_cases set summary = v_redacted, decision = v_redacted where case_id = p_case_id;

  -- === F2 SEAM (ADR 0065 §4): the D10 per-owner attachment-redaction line +
  --     dispose_attachment_phi call LAYERS HERE, on top of the arms above. Do not
  --     weave it into (a)-(g); F2 appends after this comment. ===

  -- (h) flags.
  update public.cases
     set has_patient = false, phi_disposed_at = now(), ...
```

F2's `20260717000400_attachments_disposal.sql` does `create or replace function
public.dispose_case_phi(...)` re-emitting F1's body **verbatim** and inserting **exactly at the
seam** (arms a–g and h unchanged):

```
  -- === F2 (ADR 0063 D10 / ADR 0065 §4): attachment redaction, layered on F1's body. ===
  -- Redact PHI-bearing metadata (title/description) of every LIVE attachment owned by this
  -- case; retain the row + the storage object (Rule 6). Bracketed so guard_attachment_immutable
  -- permits the write. Keyed on (owner_type, owner_id) = ('case', p_case_id).
  perform set_config('app.in_attachments_rpc', 'on', true);
  update public.attachments
     set title = v_redacted,
         description = null,
         phi_disposed_at     = coalesce(phi_disposed_at, now()),
         phi_disposed_by     = auth.uid(),
         phi_disposed_reason = p_reason
   where owner_type = 'case'
     and owner_id   = p_case_id
     and deleted_at is null
     and legal_hold = false;      -- legal-hold rows skipped — see open Q9
  perform set_config('app.in_attachments_rpc', 'off', true);
```

The same one-line D10 pattern is added to `dispose_event_phi` (owner_type-less today — events have
no attachments yet, so **no line needed** unless/until an `event` owner_type exists; forward-note
only) and `dispose_referral_phi` (referrals fold in later — forward-note; no `referral` owner_type
in F2's CHECK). **Net F2 disposal edits:** the `case` D10 line above + the standalone
`dispose_attachment_phi` door (§below). Event/referral D10 lines are forward-notes (their file
tables — `rca_evidence`, `capa_action_evidence`, `referral_reply_attachment` — are deliberately NOT
folded; C-θ).

**`public.dispose_attachment_phi(p_id uuid, p_reason text)`** (single-attachment door; clone of
`dispose_event_phi`; in `20260717000200_attachments_rpcs.sql`): assert flag → `can_write_attachment`
→ reason ∈ 5-value set (else `check_violation`) → **reject if `legal_hold`** (HC098) → reject if
already disposed (HC097) → bracket `app.in_attachments_rpc` → null `title`/set `description=null` →
stamp `phi_disposed_at/_by/_reason` → `audit_write('attachment.phi_disposed', …)`. Object retained
(Rule 6; ADR 0056 narrowed-erasure footnote).

---

## F. Confidentiality-default + escalation / declassify rules

**`confidentiality_label` value-set (7 values, aligned to the merged Rule-12 taxonomy — 0065 §3;
finalizes ADR-0063 open item a):**

| Label | Class / regime | Default tier coupling |
|---|---|---|
| `non_phi_internal` | neither — internal governance | ⇒ `standard` |
| `phi_standard` | Class 1 (patient PHI) | forces `phi` |
| `phi_restricted` | Class 1 (patient PHI, tighter) | forces `phi` |
| `peer_review_confidential` | Class 2 / governance-confidential | tier free (default `standard`) |
| `legal_privileged` | Class 2 / governance-confidential | tier free |
| `ethics_investigation` | Class 2 (professional identity) | tier free |
| `credentialing_sensitive` | Class 2 (credentialing) | tier free |

**Defaults per `owner_type` (resolves ADR-0063 open item c):**

| owner_type | default tier | default label | uploader may… |
|---|---|---|---|
| `case` | `phi` | `phi_standard` | escalate to `phi_restricted`; **declassify staff_admin-only** |
| `interview` | `phi` | `phi_standard` | escalate; declassify staff_admin-only |
| `meeting` | `standard` | `non_phi_internal` | **escalate to `phi`** (any `phi_*` label forces phi tier); declassify staff_admin-only |
| `action_item` | `standard` | `non_phi_internal` | escalate to `phi`; declassify staff_admin-only |
| `form_upload` | — (inert) | — | — |

**Escalation / declassify rules:**
- **Anyone who `can_write_attachment` may ESCALATE** (raise to `phi`, or apply a `phi_*` label — the
  `phi_label_tier_ck` then forces the phi bucket). Set at upload (`create_attachment`) or later.
- **Only `staff_admin` (or org-admin) may DECLASSIFY** (de-escalate `phi → standard`), via
  `reclassify_attachment` — DIRECTIONAL authz (reuse `42501` for a non-staff_admin declassify).
  Audited as **`attachment.reclassified`**. Server-side re-home: Next orchestrates copy → RPC (flips
  bucket+tier under the bracket) → remove-source (documented Rule-6 PHI-safety exception, D5).

---

## G. Migration batching + pgTAP keystones

### G.1 File list (timestamps `20260717000000+`, forward-only; regen types after)

| # | File | Review | Contents |
|---|---|---|---|
| 1 | `20260717000000_attachments_core.sql` | **FULL** | `attachments` + `attachment_references` + `attachment_subjects` (participant-keyed) + `case_interview_links`; indexes; `guard_attachment_immutable`; `trg_audit_attachment`; dispatchers `commission_of_attachment`/`can_read_attachment`/`can_write_attachment`; `assert_attachments_enabled`; RLS + **K9 grants**; audit triple-mirror (allow-list + `_audit_access_authorized` arm). |
| 2 | `20260717000100_attachments_storage.sql` | **FULL** | two buckets + 3 policies (standard INSERT+SELECT; phi INSERT only, **no authenticated SELECT**). |
| 3 | `20260717000200_attachments_rpcs.sql` | one-line + ack | `create_attachment`, `open_attachment`, `reclassify_attachment`, `soft_delete_attachment`, `dispose_attachment_phi` (all DEFINER + t19). |
| 4 | `20260717000300_attachments_foldin.sql` | **FULL** | ATOMIC FK-repoint (rca + referral → `attachments`) + rewire `add_referral_shared_item`/`get_referral_detail` + drop the 3 folded tables/RPCs/policies. |
| 5 | `20260717000400_attachments_disposal.sql` | **FULL** | layer the D10 line into `dispose_case_phi` at the F2 SEAM (verbatim re-emit of F1's body). |
| 6 | `20260717000500_attachments_flag.sql` | one-line + ack | seed `attachments` flag **OFF** (gate flips ON via seed for E2E; prod flip deferred — Q10). |

Migrations 1/2/4/5 are the 🔴 novel/security-sensitive set (new RLS *shape* = dialect 2 owner
dispatch; new `SECURITY DEFINER` read door on a phi bucket; a service-role read path; the
immutability guard; a `dispose_*` edit) — **FULL plan review**. Migration 3 follows an
already-approved pattern (routine RPC set mirroring existing doors) — one-line + ack.

### G.2 pgTAP keystones (`supabase/tests/207_attachments.sql` + extend `191_grant_hardening.sql`)

Derived from phase-14e §5 + the plan's added tests. Re-run the **full ordered** `supabase test db`
after a fresh reset with the `attachments` flag **enabled in the fixture** (memory
`pgtap-fixture-flag-gaps` — a flag-guarded suite that forgets to enable the flag silently skips).

1. **RLS truth table** — `can_read_attachment` / `can_write_attachment` per `owner_type`
   (case/meeting/interview/action_item) for member vs foreigner vs staff_admin vs org-admin;
   `form_upload` → both false.
2. **action_item scope arm** — a `case_restricted` action-item attachment is readable exactly by
   `can_read_case` readers; `assignees_only` by an assignee only; `committee` by any member.
3. **PHI-door single-open audit** — one allowed phi `open_attachment` writes **exactly one**
   `attachment.read` (correct actor / entity=attachment_id / commission / empty metadata).
4. **NULL-out-of-scope** — `open_attachment` for a foreigner returns null AND writes **zero**
   `attachment.read` rows.
5. **phi bucket denies authenticated SELECT** — no `authenticated` SELECT policy on
   `attachments-phi`; a direct authenticated select of a phi object fails.
6. **Immutability guard** — updating a frozen physical column (`storage_path`/`sha256`/
   `sensitivity_tier`/…) outside `app.in_attachments_rpc` raises **HC096**; inside the bracket
   (`reclassify_attachment`) it succeeds.
7. **Fold-in FK-repoint integrity** — `rca_evidence.cited_document_id` +
   `referral_shared_item.source_document_id` now reference `attachments(id)`; `case_documents` no
   longer exists; `add_referral_shared_item` resolves against `attachments`.
8. **`attachment_subjects → participants` FK/RLS** — a subject row requires a real
   `participants(id)`; a bad participant FK fails; the subject row is readable **iff** the parent
   attachment is (parent-inherited RLS), and carries no raw PHI.
9. **Disposal composition** — `dispose_case_phi` redacts a case's attachment `title`/`description`
   and stamps `phi_disposed_*` (non-legal-hold rows), with F1's arms (a–h) all still firing;
   `dispose_attachment_phi` rejects a `legal_hold` row (HC098) and a double-dispose (HC097).
10. **K9 grant+policy-as-`authenticated`** (regression lock — reverting a grant re-breaks the suite):
    for each of `attachments` / `attachment_references` / `attachment_subjects` /
    `case_interview_links`, assert **as `authenticated`** that the SELECT policy is live AND the
    table GRANT exists (a policy without a grant → `permission denied` before RLS). Extend
    `191_grant_hardening.sql` with the authorized-vs-unauthorized `attachment.read` pair.

Vitest (B7 TS): list returns `signedUrl:null, containsPhi:true` for phi vs a real URL for standard;
`openAttachment` signs via service-role only for phi; upload rejects bad MIME/size, routes to the
tier bucket, blocks a non-staff_admin declassify. (TS layer is contract-first — post typed stubs in
`src/lib/queries/attachments.ts` + `src/lib/attachments/actions.ts` before frontend starts.)

---

## H. HC SQLSTATE allocations (HC096+ — high-water is HC095)

New codes for genuinely new guarded conditions. Flag-disabled, authz, and CHECK violations **reuse
existing codes** (no new allocation): flag off → `check_violation` (assert pattern); write/declassify
/dispose authz → `42501`; bad MIME/size/bucket-tier/path-scope/label-tier → `check_violation`;
object-not-in-bucket → `check_violation`.

| Code | Condition | pt-BR message intent |
|---|---|---|
| **HC096** | Immutability guard: a frozen physical/owner/bucket/tier column changed outside the `app.in_attachments_rpc` bracket | "anexo imutável: coluna física alterada fora do fluxo permitido" |
| **HC097** | Double-dispose: `dispose_attachment_phi` on an already-disposed attachment (mirrors HC056 for cases) | "os dados deste anexo já foram descartados" |
| **HC098** | Legal hold: disposal blocked while `legal_hold = true` | "anexo sob retenção legal não pode ser descartado" |
| **HC099** | `kind` not valid for the given `owner_type` in `create_attachment` | "tipo de documento inválido para este anexo" |

(Leaves **HC09A+** for F3.) Open Q8 asks whether HC096 replaces the draft's `check_violation` for
the guard (recommended) and whether HC099 is worth a distinct code vs `check_violation`.

---

## I. Open questions for the lead to rule (the F2 analog of F1's Q1–Q6)

> I have **not** decided these. Each is a genuine design fork surfaced by the sources; my
> recommendation is noted but the lead rules.

**Q1 — `confidentiality_label` value-set finalization.** Keep all **7** values (incl. the
ADR-0063-"reserved" `credentialing_sensitive`) as in §F, or trim `credentialing_sensitive` to a
later phase? *Rec: keep all 7 — CHECK-text is cheap to widen and 0065 §3 already maps them to the
two classes.*

**Q2 — `case_interview_links`: separate table vs an `owner_type`.** Draft D3 keeps external links
in a small `case_interview_links` table (files-only core). Alternative: model links as a `link`
`owner_type`/kind on the core. *Rec: keep it separate — the core is `storage_path NOT NULL`
files-only; a link has no blob, no bucket, no tier, no PHI door. Named for the record.*

**Q3 — label↔tier coupling: hard CHECK vs RPC-only.** Enforce "any `phi_*` label ⇒ phi tier" as a
table CHECK (`attachments_phi_label_tier_ck`, §A.1) **and** in `create_attachment`/`reclassify`, or
only in the RPCs? And should `document_group_id`/`supersedes_id`/`confidentiality_label` be in the
immutability **frozen set** while the versioning engine is deferred? *Rec: add the CHECK (defence in
depth); keep the three seam columns OUT of the frozen set (inert, no writer this phase; the future
versioning engine will bracket its own writes).*

**Q4 — audit scope: phi-only vs all-tier + denied.** Core contract audits only allowed **phi**
opens (§C.2). ADR-0063 §5 also wants standard-tier opens + **denied** attempts recorded with an
`access_decision` metadata field. Include the denied/all-tier extension at E0, or defer? *Rec: ship
phi-open-audited now (matches the phase-14e gate); add denied/all-tier as additive metadata in a
fast-follow — it changes no shape.*

**Q5 — action_item read/write authority.** (a) Read: dispatch to the shipped
`can_read_action_item` (scope-aware: committee/case_restricted/assignees_only)? *Rec: yes.* (b)
Write: may an **assignee** attach evidence, or is it staff_admin/org-admin only? *Rec: allow the
assignee (`assigned_to` or an active `action_item_assignments` row) — attaching evidence to your own
task is the point; the plan's §3.7 "recommended: also the assignee".*

**Q6 — fold-in `kind` fidelity + defaults (names N3).** Plan C-θ calls meeting/interview files
"(mime-only)", but both source tables carry `kind` CHECKs. Confirm the fold-in **preserves** each
source's `doc_type`/`kind` verbatim (case: `ata|digitalizacao|registro|other`; meeting: 6 values;
interview: 4 values) and that the per-owner_type **default** for new uploads is `other` (case) /
`outro` (meeting/interview/action_item). *Rec: preserve verbatim; defaults as in §A.1.*

**Q7 — do `attachment_references` / `attachment_subjects` get their own RLS+grant, or DEFINER-read
only?** §A.2/A.3 give them parent-inherited SELECT policies + `grant select` (K9). Alternative:
no policy/grant, read only through a DEFINER helper. Also: add a same-org guard on
`attachment_subjects.participant_id` (participant's org = attachment's commission's org)? *Rec:
parent-inherited RLS + grant (they are thin, display-only, and the parent predicate already bounds
them); **no** hard same-org guard at E0 (non-authorizing; populated later under each surface's own
authority) — revisit if a cross-org display leak is ever demonstrated. No write grant this phase
either way (ADR-0063 open item b: created now, populated by later surfaces).*

**Q8 — HC096 for the immutability guard (vs the draft's `check_violation`), and HC099 for
kind-invalid.** *Rec: use HC096 (precise, catchable, matches F1's guard-gets-an-HC precedent);
HC099 optional — `check_violation` would also do for kind-invalid.*

**Q9 — legal-hold vs LGPD case-disposal.** The D10 line (§E) currently **skips** `legal_hold=true`
attachments (`and legal_hold = false`), so a case PHI-disposal leaves a held attachment's metadata
intact — a governance fork (LGPD erasure duty vs a legal-hold retention duty). Skip-and-report,
skip-silently, or redact-anyway (legal_hold blocks only object destruction, not metadata
redaction)? *Rec: skip held rows in the bulk case line (needs the legal record) but surface a
count/warning; single-attachment `dispose_attachment_phi` continues to hard-reject a held row
(HC098). Clinical/legal governance should ratify.*

**Q10 — flag: seed-OFF-then-gate-enable-via-seed vs an `_enable` migration.** Plan §3-F2 item 9 =
"seeded OFF"; phase-14e D12 = "flip ON at gate". *Rec: seed OFF in migration 6; the gate enables via
`seed.sql` for E2E (F1 precedent); no separate prod-`_enable` migration in F2 — the prod flip ships
with the feature, deferred like F1.*

---

## Appendix — verified F1/baseline build surface (symbols F2 depends on)

- `app.commission_of_case` / `_meeting` / `_interview` / `_action_item` — all exist (baseline +
  `20260706000000`).
- `app.can_read_case(case_id, uid)` (F1-safe DEFINER), `app.can_read_action_item(id, uid)`
  (scope-aware, `20260707000000`), `app.can_write_interview(id, uid)` (baseline L1536).
- `app.is_member_of` / `is_commission_admin_of` / `is_staff_admin_of` / `is_org_admin_of_commission`
  / `is_admin` — all exist.
- `app.audit_write(action, entity_type, entity_id, commission, summary, metadata)`;
  `public.log_audit_access(...)` + `app._audit_access_authorized(action, entity_id, commission)` —
  F1 body is the one to extend (adds `professional_profile.read`; F2 adds `attachment.read`).
- `app.assert_interviews_enabled()` (baseline L630) — clone template for `assert_attachments_enabled`.
- `participants(id)`, `case_participant_roles(id)` — F1 (`20260716000000`) — targets for
  `attachment_subjects`.
- Fold-in sources (baseline): `case_documents` (`doc_type ata|digitalizacao|registro|other`, bucket
  `case-documents`), `meeting_attachments` (`kind` 6-value, bucket `meeting-attachments`),
  `case_interview_attachments` (`kind` 4-value, `storage_path` XOR `external_url`, bucket
  `interview-attachments`).
- FK delete-actions to repoint: `rca_evidence.cited_document_id` = **RESTRICT**;
  `referral_shared_item.source_document_id` = **SET NULL**.
- `dispose_case_phi` — F1 final body with the explicit **F2 SEAM** between arms (g) and (h)
  (`20260716000200` L104–106).
- HC high-water = **HC095** (F1); F2 allocates **HC096+**.

---

## J. Lead rulings (2026-07-10) — the build implements these

Contract **reviewed & APPROVED by lead**; conformance to §1 C-α…C-θ + ADR 0065 confirmed. Rulings on
the §I open questions (the F2 analog of F1's Q1–Q6 rulings), plus two lead adjustments:

| Q | Ruling | Note |
|---|--------|------|
| **Q1** | **Keep all 7** `confidentiality_label` values (incl. `credentialing_sensitive`). | ADR 0065 §3 already maps them to the two Rule-12 classes. |
| **Q2** | **Keep `case_interview_links` a separate table** (no blob/bucket/tier/PHI-door). | Matches phase-14e D3. |
| **Q3** | **Add the hard `attachments_phi_label_tier_ck` CHECK** (defence-in-depth for the PHI-segregation invariant); **keep `document_group_id`/`supersedes_id`/`confidentiality_label` OUT of the immutability frozen set** (inert or RPC-bracketed). | |
| **Q4** | **Audit phi-opens only now; defer denied/all-tier** (`access_decision`) as additive metadata. | Matches the phase-14e gate + Rule 11. |
| **Q5a** | **Read dispatches to `can_read_action_item`** (scope-aware). | |
| **Q5b** | **Assignee MAY write** an action-item attachment (`assigned_to` OR an active `action_item_assignments` row), in addition to staff_admin/org-admin. | Plan §3.7 rec. **pgTAP truth-table MUST assert assignee-write + foreigner-deny.** |
| **Q6** | **Preserve each source's `kind`/`doc_type` verbatim** on fold-in; per-owner_type default (`other`/`outro`) governs new uploads only. | Corrects plan C-θ's "(mime-only)" — both source tables carry real `kind` CHECKs; preserving = the "don't flatten" mandate (N3). |
| **Q7** | **Parent-inherited RLS + K9 grant** on `attachment_references`/`attachment_subjects`; **no same-org guard at E0** (forward-note it); **no write grant** this phase. | |
| **Q8** | **HC096 for the immutability guard**; **DROP HC099** — route kind-invalid to `check_violation` (consistent with §H's MIME/size handling). New codes = **HC096/HC097/HC098 only**. | Lead adjustment. |
| **Q9** | **Skip `legal_hold=true` rows in the bulk case-disposal + report a retained count**; single-attachment `dispose_attachment_phi` hard-rejects a held row (HC098). | `legal_hold` has **no writer this phase** (reserved-inert) ⇒ **not a pilot blocker**. Needs clinical/legal governance ratification before legal-hold is ever activated. |
| **Q10** | **Seed `attachments` OFF**; E2E enables via `seed.sql`; **prod flip deferred** (F1 precedent). No separate `_enable` migration in F2. | |

**Lead adjustment — migration review level:** `20260717000200_attachments_rpcs.sql` is **upgraded to
FULL plan review** (not "one-line + ack"): it carries `open_attachment` (the audited PHI-read door),
`reclassify_attachment` (declassify authz), and `dispose_attachment_phi` — security-critical. So the
**🔴 FULL** set is migrations **1/2/3/4/5**; only migration 6 (flag seed) is one-line + ack.

**Accepted (flag for QA):** (a) an infected attachment's *metadata* row stays SELECT-able — only the
blob *open* is blocked (`scan_status <> 'infected'` gate lives in the read paths, not the RLS
predicate) — intended, so users see "quarantined"; (b) `title`/`description` are PHI-bearing but
member-readable + unaudited — the *blob* is the audited PHI (preserves today's `case_documents` /
narrative posture, §A.1 rationale).
