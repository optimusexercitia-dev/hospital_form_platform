# ARCHITECTURE.md — Hospital Commission Forms Platform

Authoritative architecture rules and the canonical database schema. Referenced
by `CLAUDE.md` (§3) and loaded alongside it. These rules are binding: Backend
may extend the schema but never contradict it. Cross-references elsewhere to
"Architecture Rule N" point at the numbered rules below.

## Architecture Rules

1. **RLS is the security boundary.** Every table has Row Level Security enabled —
   **165/165, measured 2026-08-17** (DM5·S6). ⚠ This line read *"146/146 as of
   2026-07-27"* until S6 and was **stale by 19 tables**; a count with a date is a
   measurement that expires, so **re-derive it rather than cite it**:
   `select count(*) filter (where c.relrowsecurity)||'/'||count(*) from pg_class c
   join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';`
   The frontend never relies on UI hiding for access
   control. Service-role keys are used ONLY in server-side route handlers that
   genuinely need to bypass RLS (e.g., user invitations) and never shipped to
   the client. With PHI in scope (Rule 12), RLS is also the **minimum-necessary**
   boundary — PHI is isolated into dedicated tables behind the tightest policies
   and never exposed on list/aggregate paths.

   **…but RLS is not the WHOLE boundary, and a policy-shaped audit is structurally
   blind to the rest** (ADR 0078 methodology finding; ADR 0079). Three patterns now
   carry authorization *beside* `pg_policies`, and **`prosecdef` must be audited
   alongside it — a `SECURITY DEFINER` body's gate REPLACES RLS for its callers:**
   - **DEFINER write doors.** A growing set of tables (`memberships`,
     `case_access_grants`, `audit_log`, the K9 answer tables, …) grant `authenticated`
     **SELECT only** and take every write through an audited DEFINER RPC. "No write
     policy" on these means writes are *impossible*, not *unguarded*.
   - **Audited single doors with ZERO policies.** The PHI stores
     (`patient_identifiers`/`patient_participants`, `event_patient`, `referral_patient`)
     have RLS on, **no `authenticated` ACL, and 0 policies** — a policy there would be
     unreachable code. Their predicates look dead to a policy-only sweep and are not.
   - **Capability resolution (ADR 0078).** Case-content authorization is not written
     inline per policy; policies delegate to the DEFINER resolver
     `app._case_caps` → `app.case_capabilities` → `app.has_case_capability` over a
     capability lattice (`view_case_overview · read_case_content · write_case_content ·
     read_standard_phi · read_restricted_phi · manage_case_access`). The binding
     implication rules: **content-read never implies PHI, and PHI never implies
     content-write.** `app.is_active` is the universal outer gate.
     `app.can_read_case_or_admin` is **retired** — do not reintroduce it.
   - **Document BYTES — DEFINER-door-only, no SELECT policy at all** (ADR
     [0114](./docs/decisions/0114-document-model-redesign.md) **D8**, written into the
     canon here at DM5·S6 as that decision required). **RLS remains the boundary for
     document METADATA tables; for BYTES it is not the boundary at all.** The private
     buckets `documents-standard` / `documents-phi` carry **INSERT policies only** —
     accepting only paths reserved by `begin_document_upload` — and **no SELECT policy
     for any tier**. Every protected byte flows through the single audited
     `open_document_version` door, which authorizes *first* and then signs a short-TTL
     URL with the service-role client. ⚠ **A policy-shaped audit reads this as "no read
     policy ⇒ unreadable", which is exactly backwards** — the bytes are readable, and
     the door is the whole boundary. Two supersessions ride on this: referral snapshot
     signing no longer uses the cookie client with "RLS as the boundary" (**reversed** —
     all protected document bytes adopt the PHI pattern), and the F-01 class dies
     structurally rather than by review. Bucket is derived from `sensitivity_tier`,
     **never caller-chosen**; paths are server-generated
     `{organization_id}/{file_object_id}/{generation_uuid}` — no filenames, titles or
     identifiers.

   **Standing invariant (ADR 0079):** `supabase/tests/mutation/p0-authz-invariant.sh` is a
   permanent regression gate, not a one-off audit — a door-audit sweep (BLIND ⊆ allowlist)
   plus a never-called-door floor. It must keep passing. When writing an RLS **write**-policy
   isolation keystone, the probe principal must be a *reader-non-writer*, never a fully
   foreign one, or the keystone silently exercises the SELECT policy instead
   (see `docs/progress/authz-handoff.md` §7).
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
     **Write posture (ADR 0075):** `authenticated` holds **SELECT only** — there is one
     `memberships_select` policy and **no DML grant at all**. Writes go through the
     `grant_role`/`revoke_role` DEFINER doors, or (0075's deliberate split) a service-role
     write from a TS-pre-authorized caller. A new membership writer must pick one of those
     two paths; adding an `authenticated` DML grant is a phase-blocking regression.
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
     short_text, number, date, time} · **display** {section_text, image} ·
     **containers** {group, repeating_group} (LIVE — FF-1, ADR 0087) · **matrix**
     {matrix, risk_matrix} (LIVE — FF-2, ADR 0089) · **F3-reserved inert** {reference}
     (ADR 0060 — admitted by the CHECK, no renderer/answer path until FF-5, and the only
     type still forced `required = false`). `form_items.item_type` stays a **CHECK enum
     widened per feature**, never a data-driven catalog (ADR 0065 §5).

     > ⚠ This line described `matrix`/`risk_matrix` as "F3-reserved inert … forced
     > `required = false`" until 2026-07-27. That has been **false since migration
     > `20260830000000`**, which relaxed the `form_items_input_vs_display` arm. Rule 2
     > makes this file authoritative, so a stale entry here is worse than none — the
     > `commission_members` / `case_patient` scar, one table over. Verify against the
     > catalog, never against this sentence.

     **Matrix items (FF-2, ADR 0089).** Both are ANSWERABLE — they carry a
     `question_key` and feed dashboards — but neither stores its answer in
     `answers.value`, so every presence/completeness check dispatches on `item_type`
     (`app.item_required_satisfied`), never on `value`:
     - `matrix` is a **radio grid** (ruling 1): each row takes exactly ONE column, the
       cell row IS the selection (`answer_matrix_cells.value = 'true'::jsonb`, no payload
       of its own), enforced by `UNIQUE (answer_id, row_id)` **alongside** the original
       `UNIQUE (answer_id, row_id, col_id)` — kept so admitting typed cells later is a
       constraint drop plus a config key, with no answer-table migration.
     - `risk_matrix` is one severity row × one likelihood column producing a single
       `answer_risk_matrix` row whose `risk_score` is **derived server-side** as
       `severity_row.weight * likelihood_col.weight` (ruling 2) — a client-supplied score
       is never read. Bands are an ordered threshold list in `form_items.config.riskBands`,
       derived for display and NOT stored: the score is the durable fact.
     - `required = true` means **row-complete** (ruling 3): every row of the grid has a
       cell, checked in BOTH the flat and the per-instance loop, since a matrix may sit
       inside a repeating group. Item visibility still wins — a hidden matrix requires
       nothing.
     - Writes are **DEFINER-only** (K9): all four matrix tables keep SELECT-only grants
       for `authenticated`; `upsert_matrix_axes` authors the axes and the matrix arms of
       `save_section_answers` write the answers.
   - `form_matrix_rows` / `form_matrix_columns(id, item_id → form_items, form_version_id,`
     `  position, code, label, weight numeric)` — the per-item, per-version axes of a
     `matrix`/`risk_matrix`. `code` is the **IMMUTABLE** cross-version aggregation key
     (ruling 4): relabel/reorder/add/remove are all legal, re-keying is refused by a
     `BEFORE UPDATE` trigger that does **not** consult version status. Dashboards
     aggregate the cell unit `(question_key, row_code, col_code)` through `code`, never
     through the per-version `row_id`/`col_id`. `weight` is nullable (a plain `matrix` has
     no use for it) and REQUIRED on every entry of both axes for a `risk_matrix` —
     enforced by `upsert_matrix_axes` and re-checked at publish by
     `app.validate_matrix_axes`, since it is a cross-row invariant no CHECK can express.
     ⚠ Unrelated to `form_item_options.risk_weight`, which belongs to the options lane
     despite the similar name.
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
     `  started_at, updated_at, submitted_at,`
     `  case_phase_id,               -- NULL for a standalone response; set when the response IS a case phase's fill`
     `  supersedes_id,               -- ADR 0074 correction chain (see the supersession block below)`
     `  target_case_participant_id)` — the last three are LIVE columns this rule omitted
     until 2026-07-27. `case_phase_id is null` is the standalone-response filter used by the
     dashboard choke-point; `target_case_participant_id` is the ETH targeted-respondent lane.
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
   - `response_group_instances(id, response_id → responses, group_item_id → form_items,`
     `  parent_instance_id → response_group_instances, position, created_at)`
     > ⚠ The container column is **`group_item_id`**, not `item_id` — this rule named it
     > `item_id` until 2026-07-27, when an FF-1 catalog probe caught it. Same class as the
     > `commission_members` and `case_patient` scars: verify against the catalog, never this line.
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
   position-uniqueness on `response_group_instances` (F3; ADR 0060 — landed RLS-scoped-read +
   write-inert, each becoming live at its own FF phase; aggregation contract in
   `docs/design/f3-question-key-aggregation.md`). Each phase's Record step names its new tables here.

   **Write-inert status, per table** (the shape stays frozen; only the writers arrive):
   `response_group_instances` **LIVE** (FF-1, ADR 0087) · `form_matrix_rows` /
   `form_matrix_columns` / `answer_matrix_cells` / `answer_risk_matrix` **LIVE** (FF-2,
   ADR 0089 — writers are DEFINER-only, K9 preserved) · `answer_references` **still
   write-inert** (FF-5) · `form_item_validations` **still write-inert** (FF-3).
   > 📌 The two remaining inert tables carry a **binding obligation** their FF phase must
   > discharge, recorded because FF-1's P0-1 was carried to FF-2 the same way and it is
   > the only reason FF-2 caught it: `answer_references_select` and
   > `form_item_validations_select` are **missing** the `can_read_correction_response`
   > and `can_access_targeted_*` arms their sibling answer/definition tables carry. Harmless
   > only while nothing writes them; the writer landing is exactly when that stops being true.

   **Supersession correction — BUILT (ADR 0074, 2026-07-13; extended by ADR 0085).**
   > ⚠ This paragraph read "forward-note — NOT built … the column is deliberately NOT added
   > pre-pilot" until 2026-07-27. It had been false since ADR 0074 shipped. The obligation it
   > described was in fact discharged in the same change, exactly as required.

   A submitted form correction *supersedes* the prior via nullable `responses.supersedes_id`
   (+ partial-unique `responses_one_successor_per_superseded`), written by the
   `public.supersede_response` DEFINER RPC; flag `response_correction` **ON**. The coupled
   aggregation retrofit **was done with it**: `app.submitted_form_responses` — the single
   choke-point the dashboard RPCs and derived-indicator paths fan out from — excludes any row
   with a **submitted** successor, so a merely `in_progress` correction never blanks a metric.
   ⚠ It is a **`SETOF responses` FUNCTION, not a view** — a `pg_class` probe answers *"relation
   does not exist"*, which reads as a confident negative; probe `pg_proc`. And its own predicate
   is **standalone-scoped** (`and r.case_phase_id is null`), which is part of the rule, not an
   implementation detail: a mirror that copies the successor-exclusion without the lane conjunct
   is right on standalone rows and wrong on phase-bound ones. Live instance:
   `FUP-SUPERSESSION-BADGE-LANE-BLIND`.
   `commission_overview`'s inline sub-selects carry the same predicate, and `isDashboardCountable`
   is the TS twin. **Any new aggregation path must reuse that choke-point, not re-derive
   `status = 'submitted'`,** or corrected metrics double-count.
   ADR 0085 (case corrections) then extends the same column to case-phase-bound corrections
   (`case_phases.current_response_id` tip pointer, `case_correction_requests`, append-only
   `case_narrative_revisions`); flag `case_corrections`.

   **Document model — the unified substrate (DM program; ADRs 0114 / 0116–0122).** Added to
   this section at **DM5·S6**; before that the canonical schema **did not mention the document
   model at all**, though the program had shipped it. Columns below are derived from the **live
   catalog** (`pg_attribute`), not from migration text — per CLAUDE.md's binding exception,
   migration files are stale by design for anything schema-shaped.
   - `securable_resources(id, resource_type, organization_id, hospital_id, commission_id,`
     `created_at)` — the **polymorphic home**. Every document hangs off one of these rather
     than off a per-feature FK, which is what lets one substrate serve cases, meetings,
     referrals, NSP evidence and controlled documents without eight parallel tables.
   - `documents(id, home_resource_id → securable_resources, title, description, kind, status,`
     `access_policy_id, created_by, created_at, updated_at, deleted_at, confidentiality_level,`
     `occurred_on)` — the identity row. `deleted_at` is the soft-delete **stamp**: the CHECK
     `documents_soft_delete_stamped` forces it non-null when `status = 'soft_deleted'`, and no
     constraint forbids the reverse corner (`active` with `deleted_at` set). ⚠ **The predicate
     the byte path actually enforces is `status = 'active'` alone** (plus file-grain
     `disposal_state = 'none'`) — measured at S6 QA: neither `app.resolve_document_version_bytes`
     nor either serve door nor any documents-module query reads `deleted_at`. Until that QA this
     sentence called the *pair* "the servable predicate"; the `deleted_at` half was enforced
     nowhere. Whether any writer can construct the `active`+stamped corner is unmeasured — if
     that corner matters, pin it with a CHECK, not this sentence.
   - `document_versions(id, document_id, version_number, created_by, created_at)` — deliberately
     thin. A version is an *identity*, not a payload; the bytes hang off it.
   - `document_version_files(id, document_version_id, file_object_id, rendition_kind,`
     `created_at)` — the binding, and the reason a version can carry a `source` **and** a
     printed rendition without either being privileged. ⚠ **Nothing makes `file_object_id`
     unique** — latency rests on caller discipline, not the schema (FUP-DM5-DVF-FILEOBJ).
   - `file_objects(id, storage_bucket, storage_path, sensitivity_tier, upload_state,`
     `disposal_state, size_bytes, mime_type, sha256, created_by, created_at, uploaded_at,`
     `verified_at, disposed_at, disposed_by, disposal_reason_category, disposal_evidence)` —
     byte metadata. **`storage_bucket` is derived from `sensitivity_tier`, never caller-chosen**
     (Rule 1's fourth pattern). `upload_state` is the D9 fail-closed machine
     (`reserved → uploaded → verifying → scan_pending → clean`, with
     `abandoned/failed` reconcilable and `infected/rejected` terminal — ⚠ there is **NO
     `active` upload state**: the S6 draft ended the chain on one, borrowing a
     `documents.status` value the `upload_state` CHECK has never contained; caught at S6 QA
     against `file_objects_upload_state_check`); with no scanner
     integrated, user uploads rest at the auditable interim state **`unscanned_accepted`**
     (ADR 0114 **O2** is the open PO item to close that). `disposal_state` is the ADR 0121
     lifecycle (`none` → `disposal_pending` → `disposed`). ⚠ **`disposed` asserts "metadata row
     gone", NOT "bytes gone"** — the two are different facts and only one of them is a claim to a
     regulator (FUP-DM5-NO-ANSWER-VS-NOTHING, ⬛ closed 2026-08-19). ⛔ **The distinction did not go
     away when the follow-up closed — it was made LEGIBLE.** ADR 0121 **D4** puts the answer in the
     row: **read `disposal_evidence`, never `disposal_state` alone.** It carries `metadata_absent` +
     `metadata_source` (what the door genuinely checks) and a closed-vocabulary `byte_proof`
     (`local_volume_verified` / `unavailable_on_platform` / `not_attempted`). On Supabase Cloud
     `unavailable_on_platform` is not a placeholder — it is the **permanent** answer, measured: all
     five Cloud surfaces are metadata-bound (`docs/progress/cloud-orphan-probe-2026-08-18.md`).
     ⛔ **AND THE OPERATIONAL HALF, which belongs in the canon because the sharp fact above reads as
     reassuring without it** (added at the DM5 **phase** QA, R4, where the DM5 plan had required it
     since S5.D.4): **NOTHING COMPLETES A DISPOSAL AUTOMATICALLY.** `complete_document_disposal`
     exists, but the scheduled job that would call it **does not** — ADR 0121 **D2**, unbuilt, and
     its obvious design does not work because the Storage API is unreachable from SQL, so a pure-SQL
     `pg_cron` job would automate only the half that was never the gap. The program therefore ships
     with a **known, runbook-mitigated PHI-disposal gap**: a row can sit `disposal_pending`
     indefinitely, and **bytes that should have been destroyed still exist** until a human executes
     `docs/deployment/phi-disposal-runbook.md` — which is owner-assigned but **UNREHEARSED**.
     ⭐ This **inverts** ADR 0099 **D10**'s *"a stale row nobody looks at harms nobody"*: for PHI the
     stale row **is** the harm. `disposal_state` records an **intent**, not a destruction guarantee;
     only the runbook discharges it.
   - `upload_sessions(id, file_object_id, reserved_by, state, expires_at, created_at,`
     `document_version_id)` — the reservation. **Size/MIME/hash are derived server-side at
     finalize; caller-supplied values are hints and are never trusted** (F-04).
   - Feature layers on the same substrate: `controlled_documents` + `controlled_document_versions`
     (DM3 lifecycle), `document_approvals`, `document_legal_holds`, `document_retention`,
     `document_placements`, `printed_documents` (the PDF corridor).

   ⚠ **Every one of these 13 tables carries exactly ONE policy** — verify with
   `select relname, count(*) from pg_class c join pg_policy p on p.polrelid=c.oid …`, and read
   it together with Rule 1's fourth pattern: **one policy is not thin coverage here**, because
   the byte boundary is the DEFINER door, not the policy.
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
     **This generalizes: ANY predicate that exists twice (SQL + TS) is governed by
     a single shared vector fixture read by both suites — it is the only thing that
     reds when they drift.** Second instance: the print-source derivation
     (`app.print_source_registers`/`_watermark` ↔
     `src/lib/pdf/documents/print-source.ts`), ADR 0125 D1/D8 · 0126 D5/D10. pgTAP
     runs inside the database and cannot read JSON, so the SQL side consumes a
     **generated `.psql`** carrying a sha256 of the JSON's bytes
     (`scripts/gen-print-source-vectors.mjs`). ⛔ The extension is load-bearing:
     `pg_prove` globs `*.sql` recursively, so a non-test `.sql` under
     `supabase/tests/` is collected as a suite, finds no plan, and **fails the whole
     `npm run test:db` run**.
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

   **Sanctioned exception — the coordinate-resolving SIGNERS** (added DM5·S6; the
   obligation was raised as DM2 QA r1 INFO-4 and carried across four slices). **A module
   that signs document bytes MAY read `file_objects` / `document_version_files` inline
   with the service-role client.** Rationale, per ADR
   [0118](./docs/decisions/0118-dm2-s2-command-layer-decisions.md) §1: the DB doors
   authorize, validate and audit but return **IDs only** — ⚠ true at DM2's grain, not of
   every door today: since ADR 0120 D7/D12 `open_printed_document` returns storage
   coordinates itself (which is exactly why the route below reads no table), while the
   core-corridor and referral doors still return IDs — so coordinate resolution has to
   happen somewhere server-side; routing it through `src/lib/queries/` would either spread
   resolution across modules or push a service-role client into the shared query layer.
   A direct PostgREST caller of any door therefore gets authorization semantics and
   *nothing signable*.

   **There are exactly TWO such modules — verify by identifier, not by memory:**
   - `src/lib/documents/actions.ts` — the core corridor, behind `open_document_version`.
   - `src/lib/referrals/actions.ts` — the frozen-snapshot corridor, behind
     `open_referral_snapshot_document` (DM4·S1, 120 s TTL). Its own header carries the
     justification.

   ⚠⚠ **This said "ONE module … and a second would break ADR 0114 D8's singularity" when
   first drafted at S6, and the S6 exit sweep falsified it within the hour.** Both halves
   were wrong, and the reason is worth keeping: **D8's singularity is a DB-KERNEL property,
   not a TS-module one.** Measured from the catalog — `open_document_version` **and**
   `open_printed_document` both delegate to `app.resolve_document_version_bytes`; that
   kernel is what "one door signs" names, and ADR 0120 D12 refused to amend *it*.
   `open_referral_snapshot_document` deliberately does **not** call that kernel — it is a
   bespoke door re-gating `can_read_referral_phi` with its own disposed/tombstoned
   refusals. So a second *signer* never contradicted D8; conflating the two layers is what
   produced a false sentence. → Two consequences that bind: a **third** signer needs a
   ruling (this list is exhaustive by intent), and the referral door being outside the
   kernel means **kernel-level byte gates do not automatically cover it** — relevant to
   `FUP-DM5-SUPERSEDE-SERVING-COLLISION`, which is a `resolve_document_version_bytes`
   finding.

   The exception is bounded by the **property** — *resolving coordinates in order to sign* —
   not by a directory, and it does not license inline supabase-js elsewhere in either
   feature. `src/app/api/documents/[id]/route.ts` is **not** an instance: it takes
   coordinates from `open_printed_document`'s return value and reads no table.
   ⛔ **Until S6 this rule admitted no exception at all, so the canon and the QA-accepted
   practice contradicted each other** — a reviewer reading only Rule 9 would have been
   right to red the module. Naming it is the fix; the practice was never the defect.
   Deliberately stated without line numbers: the review that raised it cited
   `:110/:159/:204/:305/:310`, which had already drifted to ~`:130/:199/:253/:374`.
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
    - **Membership, not admin** — the NSP domain gates on the `app.is_pqs_member*`
      predicates, backed by hospital-scoped **`memberships`** rows (roles
      `pqs_member` / `nsp_coordinator`; no `is_admin` fallback). ⚠ **There is no
      `pqs_members` table** — this file once said otherwise (same class as the
      `commission_members` / `case_patient` scars); verify against the catalog,
      never this line. A platform admin is **not** an NSP actor — it must hold a
      PQS membership to read or write any NSP/PHI content (deliberate IT/clinical
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
    - **Third PHI module — case patient identifiers** (Cases module; ADR 0038,
      re-keyed by F1/ADR 0064+0066, gated by ADR 0078). A case may carry an OPTIONAL
      minimum-necessary identifier set. It lives in **`patient_identifiers`** (the
      payload — same columns as its two siblings) anchored on **`patient_participants`**,
      the `participants`-registry subtype (Appendix A dialect 3).
      > ⚠ **There is no `case_patient` table** — `case_patient` is a FEATURE-FLAG KEY
      > and the name of the predicate `app.can_read_case_patient`; **no relation
      > carries it.** This rule described it as a table until 2026-07-27. Same class as
      > the `commission_members` scar above: verify against the catalog, never this line.

      Both tables carry **zero `authenticated` ACL** and RLS-on with **0 policies** — a
      policy there would be unreachable code, so a policy-shaped audit reports the
      predicate as dead when it is not (ADR 0078 A28). The only doors are the audited
      `SECURITY DEFINER` `public.get_case_patient(s)` / `public.get_participant_patient`.
      A per-template opt-in `collects_patient` (draft-only) is snapshotted to
      `cases.patient_enabled`, so cases stay PHI-free by default.

      **Gating (ADR 0078 Gate 1 — this REVERSES the former "deliberate divergence").**
      `app.can_read_case_patient` is now a thin projection of the capability lattice:
      `app.has_case_capability(case, uid, 'read_standard_phi')`. It is **no longer**
      equal to the broad `app.can_read_case`. Content-read and a bare phase/narrative
      assignment **do not imply PHI** — the previous shape, in which any case-worker or
      a read-only grantee opened patient identifiers, was ADR 0078's single most
      consequential finding and was closed on 2026-07-16. PHI now comes only from an
      explicit `case_access_grants` capability column or coordinator delegation.
      ⚠ The table this paragraph used to name, `case_access`, was **dropped**; the live
      store is **`case_access_grants`** (capability-per-column). **Writes** stay
      coordinators-only (staff_admin-of-commission OR admin).
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
        ⚠ **"Audited reads" is a property of the case-scoped DEFINER door
        (`get_case_professional`), not of every read of the class** — and since
        ETH·E4/ADR 0108 D5 that is a *narrower* statement than it looks. D5 added an
        org-manager arm to `app.can_read_professional_profile`, so an org admin /
        staff_admin reads the registry **org-wide, through RLS, invoker-rights, with no
        audit row** — deliberately (ADR 0108 D4: candidate search is never a DEFINER
        door). Live invoker paths: the picker in `src/lib/queries/participants.ts`
        (`searchParticipants`) and the roster live-name read in
        `src/lib/queries/cases.ts`. **PO-ratified 2026-08-11**: this is a directory
        read of org-readable professional metadata and stays unaudited; what must never
        regress is the *door's* audit, pinned by pgTAP `207` K4 ("exactly one
        `professional_profile.read` audit row for the entitled reader"). Widening the
        audited surface would mean reversing D4 — a decision, not a fix.
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
