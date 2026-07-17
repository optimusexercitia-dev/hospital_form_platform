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
   - `commissions(id, name, slug, created_by, created_at, hospital_id, organization_id,`
     `  updated_at)` — a commission belongs to one hospital, a hospital to one org (ADR 0041)
   - `memberships(id, principal_id → profiles, organization_id, hospital_id, commission_id,`
     `  role, title_id, granted_by, granted_at, expires_at)` — the **single multi-scope
     membership table** (ADR 0041): org, hospital **and** commission standing all live here.
     `role` is **`text` + CHECK, not an enum**: {`org_admin`, `nsp_org_admin`,
     `hospital_admin`, `nsp_coordinator`, `pqs_member`, `staff_admin`, `staff`}. A second
     CHECK enforces **scope exclusivity** per role — org roles carry `organization_id` only;
     hospital roles carry `organization_id` + `hospital_id`; `staff`/`staff_admin` carry
     `commission_id` **only** (`organization_id` and `hospital_id` MUST be NULL). `title_id`
     requires `commission_id`.
     > ⚠ There is **no `commission_members` table and no `user_id` column** — this rule named
     > both until 2026-07-17, when a lead probe raised `relation "public.commission_members"
     > does not exist` mid-audit. Same class as the `case_patient` scar (CLAUDE.md §1) and as
     > ADR 0078 §7.2. The catalog is the only truth here; never trust this line.
   - `forms(id, commission_id, title, description, created_by)`
   - `form_versions(id, form_id, version_number, status ∈ {draft, published, archived}, published_at,`
     `  approved_by, approved_at, effective_date, review_due_date,  -- Phase 17 publish metadata`
     `  behavior_config jsonb)`  — `behavior_config` is F3 (ADR 0060) reserved: a per-version
     staging bag (object | null), no writer yet; `clone_form_version` carries it verbatim.
   - `form_sections(id, form_version_id, position, title, description,`
     `  is_default boolean, visible_when jsonb,`
     `  requires_signoff boolean, signoff_role ∈ {respondent, staff_admin})`
   - `form_items(id, section_id → form_sections, form_version_id, position, item_type,`
     `  -- input items only:`
     `  question_key, label, question_explanation, required,`
     `  default_value jsonb,          -- answer-model-v2 (ADR 0046): optional prefill`
     `  parent_item_id → form_items,  -- answer-model-v2 scaffolding, always NULL (no repeating-group UX)`
     `  -- display items only:`
     `  content jsonb)`
     with `item_type ∈` **input** {multiple_choice, dropdown, checkbox, free_text,
     short_text, number, date, time} · **display** {section_text, image} · **F3-reserved
     inert** {group, repeating_group, matrix, risk_matrix, reference} (ADR 0060 — admitted by
     the CHECK, but with no renderer/answer path until each type's FF phase: `group`/
     `repeating_group` are containers, `matrix`/`risk_matrix`/`reference` are answerable yet
     forced `required = false` until their completeness wiring lands). `form_items.item_type`
     stays a **CHECK enum widened per feature**, never a data-driven catalog (ADR 0065 §5).
   - `form_item_options(id, item_id → form_items, form_version_id, position, code,`
     `  label, color_token, score numeric, analytics_code, flagged, is_other,`
     `  is_exclusive, risk_weight)` — the choice options,
     normalized out of the former `form_items.options jsonb` (form-model-normalization).
     `code` is a STABLE hidden slug (`slug(label)_suffix`) minted once and preserved
     across label renames + version clones; `unique(item_id, code)`. `analytics_code`
     is the free-text dashboard tag; `score` is nullable. `flagged` (aggregate-count result
     criteria) + `is_other` (the reserved free-text "Outro" row) shipped with
     form-builder-enhancements / others-open; `is_exclusive` (select-clears-others) +
     `risk_weight` are F3-reserved (ADR 0060, no builder UX yet). Answers reference the option
     ROW (see `answer_selected_options`), and `visible_when` / `default_value` reference
     the `code`.
   - `responses(id, form_version_id, commission_id, created_by,`
     `  status ∈ {in_progress, submitted}, last_section_id,`
     `  started_at, updated_at, submitted_at)`
   - `answers(id, response_id, item_id → form_items, question_key,`
     `  value jsonb,                       -- the CANONICAL evaluator input (Rule 3); scalars only`
     `  value_number, value_date, value_time,  -- answer-model-v2: typed shadow cols, trigger-derived, NEVER read by the evaluator`
     `  answered_at, confidentiality_level,    -- answer-model-v2; confidentiality_level RESERVED + unenforced (ADR 0045)`
     `  group_instance_id → response_group_instances)` — answer-model-v2 (ADR 0045)
     makes the answer row **uniform**: every answered input — including choice items —
     gets a parent `answers` row (choice selections then hang off it via
     `answer_selected_options.answer_id`). `value` stays scalars-only and is the sole
     input the condition evaluator reads; `app.sync_answer_typed_values` (BEFORE INS/UPD,
     exception-guarded — a bad cast leaves the typed col NULL and NEVER fails a save)
     derives the typed shadow columns. Uniqueness: two partial-unique indexes —
     top-level `(response_id, item_id) where group_instance_id is null` and per-instance
     `(response_id, item_id, group_instance_id) where group_instance_id is not null`.
   - `answer_selected_options(answer_id → answers, option_id → form_item_options,`
     `  PK(answer_id, option_id))` — choice selections, a hard FK to the option row
     (form-model-normalization), **re-keyed to `answer_id`** by answer-model-v2 (was
     `response_id`+`item_id`). RLS + the submitted-immutability guard resolve the
     response via `answer_id → answers`.
   - `response_group_instances(id, response_id → responses, item_id → form_items, position, ...)`
     — answer-model-v2 (ADR 0045) **inert scaffolding** for a future repeating-group /
     new-answer-block feature; the answer key is instance-ready but NO repeating-group UX
     ships in this package. RLS mirrors the inline `answers` predicate; submitted responses
     freeze it.
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
   - `visible_when` shape: either a single condition
     `{"question_key": "...", "op": ..., "value": <jsonb>}` OR a flat AND/OR group
     `{"match": "all" | "any", "conditions": [ <single>, ... ]}` (form-builder-enhancements;
     no nesting). **Authorable** ops: `equals`/`not_equals`/`in` (choice targets) +
     `gt`/`gte`/`lt`/`lte` (ordered number/date/time targets). The evaluator ALSO defines
     `contains`/`not_contains`/`is_empty`/`is_not_empty` (F3, ADR 0060 Rec D) — mirrored
     SQL↔TS and golden-vector-locked, but deliberately NOT offered by the author picker
     (evaluator-level vocabulary; `visible_when` stays visibility-only). The referenced
     `question_key` MUST belong to an input item in a section with a strictly LOWER position
     (no forward/circular references, no conditions on the first section). Validated at publish
     time; publishing fails with a clear error otherwise. Default section: `visible_when` null.
   - `form_items` integrity as before (input vs display column rules; CHECK
     constraints; display items: `required` not true, `content` NOT NULL —
     `{"markdown": ...}` / `{"storage_path", "alt", "caption"}`; trigger
     rejects `answers` targeting display items).

   **Additive foundations tables (Pre-Pilot Foundations Program; ADR 0065).**
   The participants / attachments / case-type / flexible-forms tables land as
   **additive** extensions of this schema — they extend, never contradict, the
   canonical set above: the `participants` typed-identity registry + subtype
   satellites and `case_types` (F1); `attachments` + `attachment_references` /
   `attachment_subjects` (F2); the widened `form_items.item_type` enum + option cols
   (`is_exclusive`/`risk_weight`) + `form_versions.behavior_config` + the frozen inert
   answer-shape set — `form_matrix_rows`/`form_matrix_columns` (definition, version-scoped,
   clone-stable `code`) + `answer_matrix_cells`/`answer_risk_matrix`/`answer_references`
   (answer rows off `answer_id`; `answer_references.participant_id → participants` is the A/C
   bridge, ADR 0065 §7) + the reserved `form_item_validations`, plus repeating-group
   position-uniqueness on `response_group_instances` (F3; ADR 0060 — all RLS-scoped-read +
   write-inert until each type's FF phase; aggregation contract in
   `docs/design/f3-question-key-aggregation.md`). Each phase's Record step names its new tables here.

   **Supersession correction (forward-note — NOT built; ADR 0065 §8 / 0060 Gap 38).** A future
   submitted-form correction will *supersede* the prior via a nullable `responses.supersedes_id`,
   and aggregation will count only the latest in a chain. The column is deliberately NOT added
   pre-pilot (it binds no historical answer — additive-anytime, freeze principle §6). When the
   post-pilot correction engine lands it MUST add the column AND retrofit the dashboard /
   derived-indicator aggregation to exclude superseded rows **in the same change**: Phase-15
   shipped counting ALL submitted rows, so the two are coupled or a corrected metric double-counts.
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
    - **Merged sensitivity taxonomy — added axis, not a replacement** (Pre-Pilot
      Foundations Program; drafted in ADR 0065, applied per-phase). The three
      patient-PHI modules above survive intact as **Class 1 — patient PHI**
      (isolated REVOKE-ed satellite · audited single door · reveal-on-demand ·
      LGPD-erasure disposal). The program adds:
      - **Class 2 — professional identity** (lands in **F1** / ADR 0064): a
        doctor-under-review is LGPD personal data but **not** patient health PHI.
        Case-scoped RLS + **audited reads** (`professional_profile.read`, PHI-free
        metadata) — but **no** isolated single door, **no** reveal-on-demand.
        Lives in `professional_profiles`.
        **Erasure posture (settled in ETH·E1, ADR 0072 §7; PO-signed 2026-07-14):**
        professional-identity erasure is **retention-pinned** when the profile is a
        respondent in a **decided** case (CFM-1821/2007, 20-yr floor);
        **correction is always available** (`update_professional_profile`, audited);
        **minimise-not-destroy redaction — not row deletion — is the erasure shape**,
        designed with the decision model (E2). Accordingly there is **no `dispose_*`
        / erasure path** on `professional_profiles` (E1 ships none by design — this
        mirrors ADR 0035's PHI reconciliation rather than inventing a second,
        conflicting erasure philosophy for the professional class).
      - **Attachments layer** (lands in **F2** / ADR 0063): two orthogonal columns
        on `attachments` — `sensitivity_tier ∈ {phi, standard}` is the *physical*
        PHI segregation (picks the bucket); `confidentiality_label` is the
        *semantic* regime, aligned to the two classes (`phi_*` → Class 1;
        `ethics_investigation` / `credentialing_sensitive` /
        `peer_review_confidential` / `legal_privileged` → Class 2 or
        governance-confidential; `non_phi_internal` → neither).
    - **Operational prerequisites** (Phase 9 deployment gates) — an executed
      Supabase BAA, a HIPAA-eligible project tier, and a breach-response posture.
    Modules that don't need patient identity hold none by design.

## Appendix A — Polymorphism dialects (three sanctioned; closes hardening D12; ADR 0065)

Cross-references use **exactly three** dialects. A fourth requires a new ADR. Naming the incumbent
(dialect 1) is deliberate — it keeps the already-unified `action_items.source_*` from reading as an
unsanctioned new pattern.

1. **Named-FK + shape CHECK** *(incumbent).* A `kind`/`source_type` discriminator + explicit
   **named nullable FKs** + a kind-scoped shape CHECK. **Use for** intra-domain source/provenance
   links with a closed, small target set where FK integrity + join targets are wanted. Instances:
   `rca_evidence`, `referral_shared_item`, `case_events`, `capa_plan`, `action_items.source_*`.
2. **Owner-dispatch polymorphism** — `(owner_type text, owner_id uuid)`, **no FK**; authorization
   dispatched by a `SECURITY DEFINER` `app.can_*` CASE dispatcher; **never a join target**;
   explicit two-step reads. **Use only** for a row owned by one of several **heterogeneous** parent
   domains with no shared registry. Sole sanctioned instance: the attachments authorizing owner
   (`case|meeting|interview|action_item|form_upload`; `form_upload` permanently inert).
3. **Typed-identity registry** — a `participants`-style anchor with `UNIQUE(id, type)` + subtype
   tables pinned by **composite FK + CHECK**. **Use for** a reusable identity many rows point at
   (people, orgs, entities as case subjects). The composite-FK+CHECK pin is the class-separation
   invariant (a `professional` can never acquire a `patient_identifiers` row).

**Bridging rule:** `attachment_subjects` uses dialect 3 (`participant_id → participants`), NOT a
fourth no-FK polymorphism — one subject vocabulary. Consequence: participants (F1) precede
attachments (F2).

## Appendix B — Catalog-vs-enum + freeze conventions (ADR 0065)

- **Catalog table vs CHECK enum.** *Tenant-extensible* vocabularies (an org/commission may extend
  at runtime) live in **catalog tables**: `case_types`, `case_participant_roles`,
  `action_item_statuses` / `_urgency_levels`. *Code-coupled* type systems where each member needs
  renderer/evaluator/immutability support (adding one is a code change) stay **CHECK enums**,
  widened per feature: `form_items.item_type`. (This is why the hardening D6/§6.3 metadata-driven
  `form_item_types` refactor is cancelled — ADR 0060.)
- **Freeze principle.** *Freeze answer-DATA shapes* now (their structure binds historical answers
  and is expensive to add post-data — e.g. F3's inert answer tables), but *definitions, engines,
  and enum-widens are additive anytime* and are **not** pre-landed (calculations, i18n, the
  correction/`reopen` engine). Defines what the reset-OK window is spent on.
