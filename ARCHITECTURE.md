# ARCHITECTURE.md — Hospital Commission Forms Platform

Authoritative architecture rules and the canonical database schema. Referenced
by `CLAUDE.md` (§3) and loaded alongside it. These rules are binding: Backend
may extend the schema but never contradict it. Cross-references elsewhere to
"Architecture Rule N" point at the numbered rules below.

## Architecture Rules

1. **RLS is the security boundary.** Every table has Row Level Security enabled
   with explicit policies. The frontend never relies on UI hiding for access
   control. Service-role keys are used ONLY in server-side route handlers that
   genuinely need to bypass RLS (e.g., user invitations) and never shipped to
   the client. With PHI in scope (Rule 12), RLS is also the **minimum-necessary**
   boundary — PHI is isolated into dedicated tables behind the tightest policies
   and never exposed on list/aggregate paths.
2. **Schema (canonical — Backend may extend, not contradict):**
   - `profiles(id → auth.users, full_name, is_admin, is_active)` — profiles
     are NEVER deleted (responses reference them); deactivate via `is_active`
   - `commissions(id, name, slug, created_by, created_at)`
   - `commission_members(commission_id, user_id, role ∈ {staff, staff_admin})`
   - `forms(id, commission_id, title, description, created_by)`
   - `form_versions(id, form_id, version_number, status ∈ {draft, published, archived}, published_at)`
   - `form_sections(id, form_version_id, position, title, description,`
     `  is_default boolean, visible_when jsonb,`
     `  requires_signoff boolean, signoff_role ∈ {respondent, staff_admin})`
   - `form_items(id, section_id → form_sections, position, item_type,`
     `  -- input items only:`
     `  question_key, label, question_explanation, options jsonb, required,`
     `  -- display items only:`
     `  content jsonb)`
     with `item_type ∈ {multiple_choice, dropdown, checkbox, free_text, section_text, image}`
   - `responses(id, form_version_id, commission_id, created_by,`
     `  status ∈ {in_progress, submitted}, last_section_id,`
     `  started_at, updated_at, submitted_at)`
   - `answers(id, response_id, item_id → form_items, question_key, value jsonb)`
   - `response_section_signoffs(id, response_id, section_id, signed_by → profiles,`
     `  signed_at, note, unique(response_id, section_id))`

   **Sections integrity:**
   - Every form version has ≥1 section; creating a form auto-creates the
     default section (`is_default = true`, title null). Exactly one default
     section per version (partial unique index); the default section cannot be
     deleted while it is the only one.
   - Two-level ordering: sections order by `form_sections.position`; items
     order by `form_items.position` WITHIN their section. Item uniqueness:
     `unique (section_id, position)`.
   - `question_key` uniqueness is per VERSION, not per section — enforce with
     a trigger or a denormalized `form_version_id` on items + partial unique
     index (denormalizing the version id onto `form_items` is the recommended
     approach; keep it consistent with `section_id` via trigger).
   - `visible_when` shape (v1: single condition, no AND/OR trees — note the
     extension point in an ADR):
     `{"question_key": "...", "op": "equals" | "not_equals" | "in", "value": <jsonb>}`.
     The referenced `question_key` MUST belong to an input item in a section
     with a strictly LOWER position (no forward/circular references, no
     conditions on the first section). Validated at publish time; publishing
     fails with a clear error otherwise. Default section: `visible_when` null.
   - `form_items` integrity as before (input vs display column rules; CHECK
     constraints; display items: `required` not true, `content` NOT NULL —
     `{"markdown": ...}` / `{"storage_path", "alt", "caption"}`; trigger
     rejects `answers` targeting display items).
3. **Response lifecycle & resume:**
   - `unique (form_version_id, created_by) where status = 'in_progress'` —
     one resumable draft per user per version. Wizard navigation upserts the
     section's answers and updates `last_section_id` + `updated_at`.
   - `in_progress` responses and their answers are editable ONLY by
     `created_by` (RLS). They are excluded from dashboards and from the
     submissions browser by default (visible to staff_admin behind an
     explicit "em andamento" filter).
   - **Submission goes through one RPC** (`submit_response`), `security
     invoker`, which atomically: evaluates section visibility server-side from
     saved answers, verifies every required input in every VISIBLE section is
     answered, verifies every visible `requires_signoff` section has a
     sign-off row, deletes any stray answers belonging to sections that are
     hidden under final visibility, and flips status → `submitted`. Client-side
     wizard validation is UX only; this RPC is the authority.
   - `submitted` responses, their answers, and their sign-offs are IMMUTABLE
     (trigger-enforced).
   - **Condition evaluation logic exists in exactly one place** per side: one
     SQL function (used by `submit_response` and any server checks) and one
     mirrored TypeScript function in `src/lib/queries/` (used by the wizard for
     live skip/show). A shared test-vector file keeps the two in agreement;
     drift between them is a phase-blocking bug.
4. **Sign-offs:** a sign-off row records who/when per (response, section).
   `signoff_role` governs who may sign: `respondent` (the response's
   `created_by` confirms the section) or `staff_admin` (any staff_admin of the
   commission counter-signs). RLS enforces the signer rule; signing is only
   possible while the response is `in_progress` and the section is visible.
5. **Immutability of published versions** is enforced in the database
   (trigger or RLS policy) on `form_versions`, their `form_sections`, AND
   their `form_items`, not only in the UI. Version cloning copies sections
   (with conditions and sign-off settings) and items, remapping ids;
   `visible_when` references `question_key` (not item id) precisely so
   conditions survive cloning unchanged.
6. **Storage immutability**: form images live in a Supabase Storage bucket
   (`form-assets/{commission_id}/...`) with policies mirroring commission
   access (members read, staff_admin upload). Uploaded objects are NEVER
   overwritten — every upload gets a new path (content hash or timestamp in
   the filename). Version cloning copies the `storage_path` reference only.
   This is what keeps published versions truly immutable; violating it is a
   phase-blocking bug. Orphaned files are tolerated (no GC in v1).
7. **Explanatory text is Markdown, never raw HTML** (`section_text` content
   and any rich `question_explanation` rendering), rendered through a
   sanitizing renderer. Staff_admin-authored HTML reaching other users'
   browsers is a stored-XSS vector and must not happen.
8. **Generated types**: after every migration, Backend runs
   `supabase gen types typescript --local > src/lib/types/database.ts`.
   Frontend imports types only from `src/lib/types/`.
9. **Data access goes through `src/lib/queries/`.** Frontend components never
   write raw supabase-js queries inline; they call typed functions. This keeps
   the Frontend/Backend ownership boundary clean. Two recurring bug classes to
   centralize in single helpers: "answerable questions of a version" (filter
   `item_type` to input types) and "dashboard-countable responses" (filter
   `status = 'submitted'`).
10. All user-facing text in **Brazilian Portuguese (pt-BR)**; code, comments,
    commits, and docs in English. Keep strings centralized enough that i18n
    could be added later without a rewrite.
11. **Auditability** (established in Phase 13; see ADR 0028). Once the
    `audit_trail` feature lands, the platform keeps an **append-only,
    tamper-evident** `audit_log`: every state-changing operation (RPC or
    direct-table write) emits exactly one audit row attributing the actor, the
    action (`<entity>.<verb>`), the entity reference, and a diff over a curated
    **allow-list of non-sensitive columns**; reads of *another* member's data
    (foreign-submission view, CSV/evidence export, surveyor portal) **and every
    read of PHI** (Rule 12 — the isolated `event_patient` identifiers via the
    single-door RPC, and the clinical free-text detail-opens) emit an explicit
    `.read`/`.viewed`/`.export` row. The log is **never updated or deleted** (a
    BEFORE UPDATE/DELETE guard raises even for the service role) and is
    hash-chained per commission so tampering is detectable. **Never copy answer
    payloads, free-text/Markdown bodies, or PHI into the log** — it records *that*
    something changed or was read and *who*, never the clinical/free-text content
    itself, so the log stays low-sensitivity even though the app now holds PHI.
    Writes go through one `SECURITY DEFINER` writer; reads are RLS-scoped (admin:
    all; staff_admin: own commission; staff/anon: none). New cross-cutting features
    add their high-value tables to the instrumented set as they land.

12. **PHI / HIPAA handling** (established in Phase 14; hardened in the 2026-06
    PHI-readiness remediation; extended to a second PHI-bearing module in Phase 22
    and a third — case patient identifiers — in the Cases module — see ADR 0030,
    0035, 0036, 0037, 0038). PHI is permitted on
    HIPAA-compliant infrastructure (Supabase, under a BAA); the binding regime is
    **LGPD + ANVISA/RDC + CFM** (ADR 0035). It is governed by:
    - **Minimum necessary** — PHI is collected only where the domain requires it
      (the patient-safety / NSP module: `event_patient`, RCA/CAPA context) and
      **isolated** into dedicated tables (`event_patient` is a 0..1 satellite of
      `patient_safety_event`), never inlined onto governance rows and never
      selected on queue/list/aggregate paths.
    - **Membership, not admin** — the NSP domain gates on `app.is_pqs_member`,
      backed by a real `public.pqs_members` table (no `is_admin` fallback). A
      platform admin is **not** an NSP actor — it must be enrolled in
      `pqs_members` to read or write any NSP/PHI content (deliberate IT/clinical
      duty separation). Disposal is the sole admin-or-PQS exception (below).
    - **Access control** — RLS is the authority (Rule 1). The governance event is
      readable access-follows-custody (current custodian + reporting committee for
      provenance + PQS). The **isolated identifiers** (`event_patient`) are scoped
      *tighter* than the event — current-custodian **staff_admins** + PQS only
      (`app.can_read_event_patient`) — and carry **no direct read grant**:
      `authenticated` has zero DML on `event_patient`; the only door is the
      `SECURITY DEFINER` `public.get_event_patient` RPC.
    - **Access auditing** — the single-door identifier read emits an
      **unbypassable** `event_patient.read` row from inside the RPC (Rule 11).
      Clinical free-text detail-opens (event / triage / RCA / CAPA / meeting /
      interview) emit an app-layer `*.viewed` row; per ADR 0036 these keep their
      RLS-scoped reads, so that audit is best-effort and bypassable by a direct
      PostgREST caller — an accepted, documented residual (the identifiers are
      not). HIPAA/LGPD *require* PHI-access logging, inverting Phase 13's original
      "don't log reads" default for these tables.
    - **Free-text is PHI** — the clinical free-text/Markdown columns (event
      `description_md`, triage notes, the RCA narrative + factor/root-cause/
      timeline text, CAPA lessons/method/task text, meeting minutes + agenda
      discussion/resolution, interview summaries + subject notes, case narratives
      + events) are **PHI-bearing** (labeled by SQL column COMMENTs) and must be
      treated as PHI by evidence/surveyor export (Phase 19) — never shipped as
      "PHI-free". Short `*.title`/label fields are governance metadata and are
      **kept** PHI-free by input policy.
    - **Encryption** — at-rest encryption on the Supabase platform (under the
      BAA). Column-/application-level encryption (pgcrypto) was **considered and
      declined**: it does not address the platform threat model (a compromised
      app role decrypts on read), co-locates keys with the data, and breaks
      search/sort on the MRN/name identifiers the NSP must query. Minimum-
      necessary RLS + the audited single-door identifier read are the
      confidentiality controls instead (see ADR 0035).
    - **Retention & disposal** — `public.dispose_event_phi` deletes/redacts an
      event's PHI (identifiers + clinical free-text) while preserving the
      governance skeleton (codes, status, custody ledger, structured non-PHI) and
      the audit chain; it stamps `phi_disposed_at/by/reason` (a constrained
      category, never free text), sets `has_patient = false`, and emits
      `event_patient.disposed`. This is the LGPD Art. 18 erasure mechanism
      reconciled with CFM 20-year retention of the governance record (ADR
      0035/0036).
    - **Second PHI module — inter-committee referrals** (Phase 22; ADR 0037). The
      `case_referrals` module is the second place PHI lives, under the *identical*
      posture: an isolated `referral_patient` (0..1 on `case_referral`, modeled on
      `event_patient`, all DML REVOKED from `authenticated`, read only via the audited
      `get_referral_patient` door); the PHI-bearing free text
      (`case_referral.description_md`/`decline_note`, `referral_shared_item.frozen_body_md`,
      `referral_reply.result_md`) gated to `app.can_read_referral_phi` (column REVOKE +
      DEFINER-door serving) so list/hub/dashboard projections stay PHI-free; audited
      `referral_patient.read` + `referral.viewed`; no column encryption (ADR 0035). This
      reverses the former "PHI only in the NSP module" stance — PHI now lives in the NSP,
      referral, **and case** modules, all under the same isolation + single-door + audit
      posture.
    - **Third PHI module — case patient identifiers** (Cases module; ADR 0038). A
      case may carry an OPTIONAL minimum-necessary identifier set on an isolated
      `case_patient` (0..1 on `cases`, modeled exactly on `event_patient`/
      `referral_patient`, all DML REVOKED from `authenticated`, read only via the
      audited `public.get_case_patient` door emitting `case_patient.read`). A
      per-template opt-in `collects_patient` (draft-only) is snapshotted to
      `cases.patient_enabled`, so cases stay PHI-free by default. **Deliberate
      divergence:** the read predicate `app.can_read_case_patient` equals the BROAD
      `app.can_read_case` (any case-worker — coordinator OR phase/narrative assignee
      OR `case_access` grantee), looser than the staff_admin+PQS
      `can_read_event_patient` / `can_read_referral_phi`, because case assignees need
      the MRN to do the work; **writes stay coordinators-only** (staff_admin-of-
      commission OR admin). Every read still funnels through the one audited door.
      `dispose_case_phi` provides LGPD Art. 18 erasure (identifiers + the case
      free-text PHI `case_narratives.body_md` / `case_events.body`), mirroring
      `dispose_event_phi`. Reverses the Cases module's former "strictly PHI-free"
      stance (ADR 0033 Q13).
    - **Operational prerequisites** (Phase 9 deployment gates) — an executed
      Supabase BAA, a HIPAA-eligible project tier, and a breach-response posture.
    Modules that don't need patient identity hold none by design.
