# Backend State — meetings, charters and accreditation

> Part of `docs/backend-state/`. **Start at [`README.md`](README.md)** — it routes you to the one
> file you need, and carries the maintenance rules in full.
>
> This is a **map, not the authority.** `ARCHITECTURE.md` is the spec and the **live catalog** is
> the truth (`pg_proc` incl. **`prosecdef`**, `pg_policies`, `pg_constraint`, `pg_trigger`, the
> ACLs). ⚠ **Not the migration files** — some rewrite live function bodies at runtime, so their
> text is stale by design (CLAUDE.md § graphify).
>
> ⛔ **A posted section is frozen.** Corrections are APPENDED, never edited into the statement they
> correct, and a correction leaves a forward marker at the statement it supersedes: a
> `⚠ **Superseded** — …` line directly under that heading, naming where the correction lives.
>
> ⛔ **A new phase EXTENDS its seam file.** It never opens a phase-named file, and the fix for an
> over-cap file is never to raise the cap nor to delete a posted section.

⚠ **The cadence surface (`app.cadence_status_of`, `commission_cadence_overview`) is recorded in [`document-model.md`](document-model.md) § END STATE** — including that it is **STABLE, not IMMUTABLE**, and that `mensal` means 30 days, not a calendar month.

## MIN — Meeting audio → generated ata (2026-08-06; ADR 0099 + Amendment 1; migrations `20260910000100`–`…000400`; flag `audio_minutes` **OFF** — seed forces ON for local/E2E)

Full feature record → `docs/progress/min-audio-minutes.md` · runbook →
`docs/deployment/audio-minutes-runbook.md` · service repo `minute_generator` (contract v2.1).

- **Storage**: bucket `meeting-audio` — private, 500 MB (`524288000`), 15 audio MIME types
  (incl. `audio/x-m4a`); **no `authenticated` storage policies by design** — signed upload
  URL minted server-side with the **service-role** client; path `<meeting_id>/<job_id>/<file>`.
  Local `config.toml` `[storage] file_size_limit` = **512MiB** (global cap, committed).
- **Schema**: enum `public.audio_job_status` (`uploading|processing|done|failed|cancelled|applied`
  — minted as the cross-kind vocabulary, D18 reuses it for future interview jobs); table
  `public.meeting_minutes_jobs` (FK `meetings` **ON DELETE CASCADE**; partial unique
  `..._active_uidx` on `(meeting_id) where status in ('uploading','processing','done')` = the
  one-active-job rule). **RLS enabled NOT forced**; ONE SELECT policy
  `app.is_staff_admin_of(app.commission_of_meeting(meeting_id))`; **column grant excludes
  `transcript` AND `result`** (16 granted columns); no INSERT/UPDATE/DELETE for `authenticated`.
- **Doors — all `public.*`** (`app.*` is unreachable through PostgREST; `app` holds
  predicates/asserts only): `create_minutes_job` · `submit_minutes_job` · `cancel_minutes_job`
  (returns `audio_path` for app-side delete) · `save_minutes_draft` (whole-column overwrite —
  the draft type must round-trip, see `draft-roundtrip.test.ts`) · `apply_minutes_review`
  (D5–D7/D12 transaction; reads `draft->'agenda'`; calls `create_committee_action_item`;
  sets the `app.in_meeting_rpc` GUC around the `minutes_md` write; **returns `audio_path`** —
  the action deletes after apply, QA B1) · `read_minutes_transcript` (audited door — gates on
  `app.can_read_minutes_transcript` **first**, NO admin arm = noun rule, then logs
  `minutes_transcript.read`; both `log_audit_access` registries carry the new arm) ·
  webhook helpers `complete_minutes_job`/`fail_minutes_job` (**service_role-only**, idempotent
  latches; `fail` latches on `uploading` AND `processing`) · `list_stale_meeting_audio`
  (**service_role-only** TABLE-returning sweep source; deletion stays app-side —
  `storage.protect_delete()` refuses SQL DML).
- **Audit kinds** (dotted, per the `audit_log_action_shape` CHECK): `minutes_job.created/`
  `.submitted/.completed/.failed/.cancelled/.applied` + `minutes_transcript.read`.
- **App layer**: `src/lib/audio-jobs/` (kind-agnostic v2.1 contract client, HMAC
  `sha256("<ts>.<rawBody>")` ±5 min; `server-only` on **client/metadata only** (they read env) —
  `hmac.ts` deliberately omits it so the E2E helper imports the real `signCallbackBody`,
  MIN review r2 R3; re-add it the moment the module reads env or embeds a secret);
  `src/lib/minutes-jobs/` (actions/queries/reconcile/**sweep**/context/normalize/sanitize/
  messages HC0S0–HC0S6); webhook `src/app/api/webhooks/audio-jobs/route.ts` — raw-body HMAC,
  401 only for bad signature, 200 for permanent conditions; **`src/proxy.ts` matcher excludes
  `api/webhooks`**. The **O3 sweep** (`sweepStaleAudio`) deletes EVERY `meeting-audio` object
  >24 h (deliberately blunter than "no live job"), runs from the webhook + reconcile, throttled;
  ≤24 h is **lazy-enforced** — ADR 0099 Amendment 1 records the residual; D18 interview audio
  (case-PHI) reopens the cron question.
- **Notifications**: emitted **DB-side** inside the webhook RPCs (`enqueue_notification` is
  unreachable from `src/`); vocabulary `meeting`/`meeting`/`pending` (the `notifications`
  CHECKs reject invented names). Env: `MINUTES_SERVICE_URL/_API_KEY`,
  `MINUTES_CALLBACK_HMAC_SECRET`, `MINUTES_CALLBACK_BASE_URL` (override; request-origin default).
- **Tests**: pgTAP `305_audio_minutes.sql` (106) · unit incl. `draft-roundtrip` (key set derived
  from `Record<keyof MinutesDraft, true>` — a new field breaks the build until covered) ·
  E2E `meeting-audio-minutes.spec.ts` 10 scenarios incl. 1b (`audio_release:false` → object
  survives until apply, gone + `audio_deleted_at` after). ⚠ A flag-OFF spec must toggle the
  flag itself (seed forces ON).

## CH — Committee Charters & Cadence (S4, 2026-07-20; ADR 0080; migrations `20260818000000`–`…000200`; flag `charters` seed-ON / prod-OFF) → `main`

Per-commission charter = `meeting_frequency` + optional link to the commission's regimento (a `doc_type='regimento'`
Phase-17 controlled doc — content/dates live on the doc, not inline). Full record → `progress/ch-charters-cadence.md`.
**No PHI (Rule 12).**

**Table (RLS-on):**
- `commission_charters` — `commission_id` PK (1:1 → `commissions`, CASCADE); `meeting_frequency` NOT NULL CHECK ∈
  {semanal,quinzenal,mensal,bimestral,trimestral}; nullable `controlled_document_id` (→ `controlled_documents`, SET
  NULL); `created_by`, `created_at`, `updated_at` (trigger `app.touch_updated_at`). **One SELECT policy
  `app.is_member_of(commission_id)`; NO INSERT/UPDATE/DELETE policy** (sole write door = the DEFINER RPC);
  `authenticated` = SELECT-only grant. `sem_regimento` = no row.

**Predicates:** reuses `app.is_member_of` (SELECT + read RPCs), `app.is_staff_admin_of` (write authority — NOT the
broader `is_tenancy_admin_of`), `app.can_read_action_item` (carry-forward confidentiality filter). No new predicate.

**RPCs (all DEFINER, t19 = REVOKE PUBLIC + GRANT authenticated/service_role; flag-gate first via
`app.assert_charters_enabled` → `HC000`):**
- `upsert_commission_charter(p_commission, p_meeting_frequency, p_controlled_document_id default null)` — **authority
  `is_staff_admin_of` FIRST (`HC0K0`)** → regimento-link validity `HC0K1` (same-commission + `doc_type='regimento'`) →
  upsert → audit `charter.upserted` (config metadata, PHI-free). Returns camelCase row.
- `meeting_cadence_status(p_commission)` — member `HC0K2` → `{status,lastHeldAt,meetingFrequency}`; over base tables
  `max(held_at)` where `held_at IS NOT NULL AND visibility_policy='commission_default'`; calendar-interval windows,
  **inclusive** `em_dia` boundary; states `em_dia`/`em_atraso`/`sem_reunioes`/`sem_regimento`.
- `suggest_carry_forward(p_commission)` — member `HC0K2` → `{agendaItems,actionItems}`: unresolved agenda from the
  most-recent held `commission_default` meeting + open non-terminal meeting-sourced action items, each through
  `can_read_action_item`. Pure read (FE copies ticked agenda via the existing `create_meeting_agenda_item`).

**Notifications:** `app.compute_due_charter_notifications()` (X-ζ arm in `compute_due_notifications`, gated on
`feature_enabled('charters')`) — each `em_atraso` commission → each `staff_admin` gets `kind='charter'` /
`entity_type='commission'` / `milestone='overdue'` / `is_reminder=true`, weekly dedup
`charter_cadence:{commission}:{IYYY-IW}`, PHI-free body. `notifications` `kind` CHECK += `charter`, `entity_type`
CHECK += `commission`. Opt-out delivery (no seed trap).

**SQLSTATEs:** `HC0K0` authority · `HC0K1` bad regimento link · `HC0K2` non-member · `HC000` flag-off. **Authority
checked FIRST** (ADR-0078 non-vacuity); keystones KS_AUTHORITY/KS_MEMBER/KS_FILTER mutation-proven RED
(`supabase/tests/mutation/ch-be3-mutation-audit.sh`).

**Follow-ups (QA INFO, non-blocking):** audit metadata breadth (`{meeting_frequency,has_regimento}` config context) ·
no pt-BR `HC000` map in `mapCharterError` (flag-off not user-reachable) · read-layer error/no-row → null · pilot
`charters` enablement + origin push + deploy. Note: controlled-doc `code` is **per-commission** (Farmácia's regimento
is legitimately `DOC-0001`, same as CCIH's — cross-commission rollups must not assume code uniqueness).

## P16 — Standards Crosswalk & Readiness/Gap Engine v2 (2026-08-04; ADR 0093 + Amendments 1-3; migrations `20260903000800`-`...001600` + gate-flip `20260904000100`; flag `accreditation` **ON** via `...000100`)

Accreditation-framework vocabulary (ONA/JCI/custom) + per-standard evidence linking + assessment +
commission-level readiness/gap report + hospital-level worst-status consolidation (D7). PHI-free by
construction (Rule 12 N/A) - evidence LINKS reference an existing artifact by kind+id; they never copy
artifact content, so a `case`/`ethics_procedure` link inherits ITS OWN confidentiality via the D8 mask,
never a duplicate of it. Full record -> `docs/decisions/0093-*.md` +
`docs/plans/phase-16-standards-crosswalk-program.md`.

**Tables (RLS-on, SELECT-only for `authenticated`; every write is a DEFINER RPC - no table has an
INSERT/UPDATE/DELETE policy or grant):**
- `accreditation_frameworks` - `key`, `name`, `version`, `description`, `owner_commission_id` (nullable ->
  **NULL = global pack**, FK `commissions` CASCADE), `cloned_from_framework_id` (self-FK, SET NULL -
  provenance only, D2), `status` CHECK in {`ativo`,`arquivado`}. SELECT policy:
  `owner_commission_id IS NULL OR app.is_member_of(owner_commission_id)` - **global packs are readable by
  every authenticated user** (deliberate: the vocabulary must be visible for a commission to clone it); a
  commission-owned custom framework is member-gated like any tenant content. **No `is_admin()` in this
  policy** - platform_admin sees global packs same as anyone, and nothing more.
- `accreditation_standards` - `framework_id` (FK CASCADE), `parent_id` (**composite self-FK**
  `(parent_id, framework_id) -> (id, framework_id)` CASCADE - the `(id, framework_id)` UNIQUE exists solely
  to host this, keeping a standard's parent inside its OWN framework by construction, not by trigger),
  `code`/`title`/`description_md`, `position`, `level` (nullable smallint, CHECK 1-3, D3's 3-level ONA
  model - NULL for a non-leveled framework like JCI). SELECT policy mirrors the parent framework's.
- `evidence_links` - `commission_id` (FK CASCADE - the LINKING commission, not necessarily the artifact's
  owner for `case`/`ethics_procedure` per D8), `standard_id` (FK CASCADE), `artifact_kind` (10-way CHECK,
  the D4 `ArtifactKind` enumeration), `artifact_id`, `note`, `linked_by`. UNIQUE
  `(commission_id, standard_id, artifact_kind, artifact_id)` - `link_evidence` pre-checks this and raises
  `HC0QB` rather than surfacing the raw `23505`. SELECT policy `app.is_member_of(commission_id)`.
- `standard_assessments` - `commission_id`/`standard_id` (FK CASCADE), `status` CHECK in
  {`conforme`,`parcial`,`nao_conforme`,`nao_aplicavel`}, `note_md`, `assessed_by`. UNIQUE
  `(commission_id, standard_id)` - one assessment per commission per standard, upserted by
  `set_standard_assessment`. SELECT policy `app.is_member_of(commission_id)`.
- `standard_ownerships` - `hospital_id` (FK CASCADE), `standard_id` (FK CASCADE),
  `responsible_commission_id` (FK CASCADE), `assigned_by`. UNIQUE `(hospital_id, standard_id)` - the D7
  override table (a row = "this commission, not worst-status-wins, answers for this standard at hospital
  tier"; clearing the override is a DELETE). Trigger `guard_standard_ownership_hospital` is the schema
  backstop (`23514`) proving `responsible_commission_id` belongs to `hospital_id` via
  `app.hospital_of_commission` - `set_standard_ownership` pre-checks the SAME property and raises `HC0QC`
  first (belt-and-suspenders, the same pattern as every other guarded-DEFINER write in this codebase).
  SELECT policy `app.is_hospital_member_of(hospital_id) OR app.is_hospital_admin_of(hospital_id)`.
- All 5 tables carry a Rule-11 audit AFTER-trigger (`trg_audit_*`); `accreditation_frameworks` and
  `accreditation_standards` additionally carry `app.touch_updated_at`.

**Dispatch predicates (`app` schema, `STABLE SECURITY DEFINER`, one arm per `ArtifactKind` - 10-way, D4) -
the freshness matrix itself is NOT restated here, ADR 0093 Amendments 2-3 are the authority:**
- `app.artifact_belongs_to_commission(p_kind, p_artifact, p_commission)` - is this artifact reachable FROM
  this commission (the D4 "every sibling arm" enumeration). Fail-**closed**: every arm resolves through
  `coalesce(..., false)`; an unrecognized `p_kind` raises rather than falling through.
- `app.evidence_status_of(p_kind, p_artifact)` - the per-kind freshness verdict (`valida`/`vencida`/
  `atencao`/...). Redefined twice post-birth by targeted migrations, NOT edited in place: `...001000`
  (`capa_plan` `open`->`atencao`, ADR 0093 A3.1) and `...001100` (`action_item` `open`/`blocked`->`atencao`,
  A3.3) - read the LIVE `pg_proc` body; the two migrations only carry the diffs.
- `app.evidence_label_of(p_kind, p_artifact)` - the third dispatch helper (Migration E), the D8 masking
  point: returns the real label for an unrestricted artifact, `null` (masked by the caller to "Evidencia
  restrita") for a `case`/`ethics_procedure` the reader's ACL doesn't cover.

**RPCs (all DEFINER, `revoke execute ... from public` + `grant ... to authenticated` at creation; ALL 15
call `app.assert_accreditation_enabled()` FIRST -> `HC0Q9` - unlike `matrix_fields`/`entity_refs`/
`power_authoring`, this module has no pre-existing ungated read path to preserve, so READS are gated too,
not just writes):**
- *Migration C - framework CRUD, global-pack vs. custom-framework split (D6):* `create_framework` /
  `update_framework` / `set_framework_status` / `upsert_standard` / `delete_standard` - the **global-pack
  arm uses `app.is_admin()`** (the ONE sanctioned D6 exception: platform_admin curates the shared
  vocabulary) when `owner_commission_id IS NULL`; the **custom-framework arm uses
  `app.is_staff_admin_of(owner_commission_id)`**, never `is_admin()`. Editing a global pack outside the
  `is_admin()` arm raises `HC0QD`; editing an `arquivado` framework raises `HC0QE`. `clone_framework` is
  the odd one out in this group - it does **NOT** use `is_admin()` at all (only
  `is_staff_admin_of(p_commission)`, the DESTINATION commission), because cloning always creates a new
  commission-owned draft and never touches the source. Two-pass parent remap (insert all standards, then
  remap `parent_id` through an old->new id map keyed on `code`), precedent = `app.copy_version_children`.
- *Migration D - evidence + assessment:* `link_evidence` (guard order: flag -> standard reachable ->
  `artifact_belongs_to_commission` `HC0QA` -> per-kind readability [`can_read_case`/`can_read_capa`/...] ->
  duplicate `HC0QB` -> insert) / `unlink_evidence` / `set_standard_assessment` (upsert,
  `note_md = coalesce(excluded.note_md, standard_assessments.note_md)` - a later assessment call with
  `p_note_md` unset does NOT blank a prior note, BUG-P16-001 symptom fix) / `set_standard_ownership`
  (`is_hospital_admin_of` ONLY, `HC0QC` pre-check) / `evidence_candidates` (search, the SAME per-kind
  readability filter as `link_evidence` so the picker never OFFERS what the linker would reject) /
  `get_standard_assessment` (BUG-P16-001 root-cause fix - the read-path companion to
  `set_standard_assessment`, `is_member_of`-gated).
- *Migration E - the three READ doors, the highest-risk item in the phase; structurally mirror
  `hospital_document_register` MINUS its BUG-AUTHZ-002 defect:* `readiness_report(p_commission,
  p_framework)` and `readiness_evidence(p_commission, p_standard)` - gated **`is_member_of` ONLY**;
  `hospital_readiness(p_hospital, p_framework)` - gated **`is_hospital_admin_of(p_hospital) OR
  is_org_admin_of(org_of_hospital)` ONLY** (D7 worst-status-wins consolidation, `nao_aplicavel` treated as
  abstention not a vote, `standard_ownerships` override short-circuits the vote entirely). **This is the
  correct model per the D6 noun rule; `hospital_document_register` and `hospital_indicator_rollup` were the
  KNOWN-BAD precedent (BUG-AUTHZ-002) an `is_admin()` arm here would repeat — **both were brought into
  line 2026-08-05 by `20260908000100`, so the precedent is now historical rather than live**. None of these three, nor
  `evidence_candidates`/`get_standard_assessment` above, carries an `is_admin()` arm anywhere in their body
  - confirmed against live `prosrc`, not asserted from memory.** All three doors + the two Migration-D read
  functions above now sit inside the **ADR 0079 standing door audit**
  (`supabase/tests/mutation/p0-authz-invariant.sh`) alongside every other DEFINER door in the platform -
  the audit is unconditional on age, no separate opt-in needed. The platform_admin-zero-rows assertion
  against all three (pgTAP 283/284 SECTION A) is, in this phase's own test-file comment, **the single most
  important assertion in Phase 16**.

**SQLSTATEs:** `HC0Q9` flag-off * `HC0QA` artifact not reachable/linkable * `HC0QB` duplicate link *
`HC0QC` invalid target (framework/standard/hospital/level) * `HC0QD` global-pack read-only outside the
`is_admin()` arm * `HC0QE` framework `arquivado`. Full per-code detail lives in the SQLSTATE table below -
this is the summary line, not a second source of truth for it.

**pgTAP** (274 assertions total): `278` schema - 84 * `279` dispatch predicates - 69 (incl. QA-MINOR's
boundary coverage for all 5 indicator frequencies, not just `mensal`) * `280` framework CRUD - 40 * `281`
evidence/assessment - 37 * `283` `readiness_report`/`readiness_evidence` - 20 * `284` `hospital_readiness`
- 24. Every keystone mutation-proven; the read-door reintroduction-of-`is_admin()` mutation and the
ARM=floor door-audit run are the two most load-bearing proofs in the set.

**Migration G (`20260904000100_enable_accreditation.sql`)** is the gate-flip - Phase 16 shipped OFF
through every Wave 1/2 migration and turns ON only here, PO-approved, mirroring
`enable_power_authoring`'s shape. `seed.sql` forces it ON for local/E2E, belt-and-suspenders with every
other already-flipped flag. Flipping it broke four PRE-EXISTING pgTAP assertions that had assumed "seeded
OFF" as an ambient default (278/280/281/284's section-0 setup) - 278's was a TRANSIENT fact about
Migration A's own insert (now correctly asserts the shipped `enabled=true` - see the SQLSTATE
high-water-row note below); 280/281/284's were a REAL ongoing "doors must still deny while OFF" invariant,
fixed by having each section explicitly FORCE the flag OFF in-transaction rather than assert a now-false
ambient claim. `283` carries no such section - a pre-existing gap, not introduced by the flip, left as-is.

## Extracted from the pre-split stamp chain

Recovered when the frozen currency-stamp chain left this directory
(→ [`../progress/backend-state-stamp-history-archive.md`](../progress/backend-state-stamp-history-archive.md),
ADR 0199). Re-measured **2026-09-09** against the local catalog at migration `20261003007350`.

- **`app.can_reach_meeting(p_meeting_id, p_uid)` is the single meeting-read gate, and it REQUIRES
  commission membership.** Live body:
  `app.is_member_of_for(app.commission_of_meeting(p_meeting_id), p_uid) AND (meetings.visibility_policy =
  'commission_default' OR EXISTS(meeting_attendees a WHERE a.meeting_id = … AND a.user_id = p_uid))`.
  ⚠ **There is no org-admin arm and no tenancy-admin arm** — one was removed at AUTHZ Gate 2 (C7 P0). A
  tenancy admin who is not a member of the commission does not reach its meetings. The seams referenced
  this predicate only from [`printing.md`](printing.md)'s suppression table, which uses it without
  defining it. Stamp 2026-07-17.
- **`public.meeting_closed_sessions`** (reserved sessions, Stage C) exists as a table; its two child
  tables were already in the no-policy register here, but the parent was not named. Reads flow through
  `can_reach_meeting`. Stamp 2026-07-17.
- **`app._project_meeting_agenda_item`** is the composed-ata tiering projector — it masks
  `title` / `description` / `discussion_notes` per capability tier. Present in `pg_proc`. Nothing else in
  the seams names it, though [`privacy-and-dsr.md`](privacy-and-dsr.md) lists the same three columns as
  erasure targets. Stamp 2026-07-17.
- **⛔ The `conclude_meeting` / `HC034` false negative is NOT a SQL bug — do not "fix" the guard.** The
  guard (≥1 attendee present AND `user_id IS NOT NULL`, guests excluded, ADR 0025) is correct as written.
  The failure a user reports is upstream: a committee **member** reaching the database as a *guest* row
  with `user_id` null, so quorum sees zero members. Fix the caller that created the guest row. This
  qualifier lived only in the chain; the posted guard description states the rule without the warning,
  which is precisely the shape that invites someone to loosen a correct predicate. Stamp 2026-06-30.
