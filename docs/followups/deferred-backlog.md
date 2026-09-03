# Deferred / Parked Backlog — full detail

> Relocated from PROGRESS.md 2026-07-17 (lead, playbook §7 / CLAUDE.md §7 size hygiene). These are OPEN, non-blocking, deferred/optional items. Nothing here is resolved — this is the actionable detail, moved out of every spawn's context.

> ⛔ **UPDATED 2026-09-02 (ADR [0179](../decisions/0179-follow-up-register-consolidation.md)):** PROGRESS.md no longer carries a follow-up index, so the sentence that used to end the line above — *"the live PROGRESS.md 'Follow-ups' section keeps a one-line title + pointer index for each"* — is retired. The open register is **[follow-ups-open.md](follow-ups-open.md)**. An item belongs **here** only when nobody can act on it next session; anything actionable belongs in the register. ⛔ An item must never be entered in both — that is the duplication ADR 0179 removed.

> ⚠ **Added 2026-08-27:** `check-progress-doc.mjs` treats **this file as a live register** for the orphaned-body check, so an item carried here in full needs **no** PROGRESS.md index line. That is the contract's third destination — *open, but nobody can act on it next session* — and it is the pressure valve for a PROGRESS.md at its size cap. ⛔ It is **not** a place to park items somebody *can* act on next session; those belong in the register the PO reads first.

> Every entry below carries a **Revisit when** trigger; the gate (`lint:registers`, ADR 0185 D5) reds on one that is missing. `PO to rule` is the honest value where the text names no trigger.

### 🟡 `FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS` — `actor_id` is NULL on every audit row a service-role door emits (filed 2026-08-27, AE1.3 / ADR 0155 R3; owner backend + PO)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**`FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS` — `actor_id` is NULL on every audit row a service-role door emits (filed 2026-08-27, AE1.3 / ADR 0155 R3; owner backend + PO).** `app.audit_write` derives its actor from `auth.uid()`, which is **NULL on every service-role path**. ⚠ **The actor is NOT lost** — it rides in `metadata.actor_user_id`, following the `public.log_cpf_probe_for` precedent, which documents the same gap in its own body — so this is a **queryability** gap, **not** a Rule 11 attribution loss. AE1.3 adds **8 new instances** (`person.registered`, `person.fields_updated`, `person.deactivated`, `person.reactivated`, `person.suspended`, `credential.created`, `credential.updated`, `credential.deleted`) to a platform-wide set that already includes `membership.granted`, `form.created` and `affiliation.created`. ⛔ **Do NOT fix it only for these doors** (ruled R3): a **partially-populated** `actor_id` is worse for a reader than a uniformly null one, because a query filtering on it **silently misses everything else**. The minimal whole-platform shape is `app.audit_write_as(p_actor, …)` as an internal helper with no EXECUTE grant, classified alongside the other `app` internals in [authz-definer-classification-ae1.md](../design/authz-definer-classification-ae1.md). pgTAP `385` §1.11 asserts the null **positively**, so it cannot later be mistaken for attribution loss. ⭐ Context worth keeping: these doors introduce the **first** audit coverage of person-record mutation at all — `profiles` and `professional_credentials` carried **zero** audit triggers before AE1.3 (measured, against a control showing `memberships` carries one).

### 🟡 Ethics Committee track — E2 (procedure) + E3 (terminology/UX) remain; E0 (case-participants, ADR 0064) and E1 (access spine, ADR 0072) are COMPLETE

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**Ethics Committee track — E2 (procedure) + E3 (terminology/UX) remain; E0 (case-participants, ADR 0064) and E1 (access spine, ADR 0072) are COMPLETE.** Original E0→E3 sequencing narrative archived → [follow-ups-archive.md](./follow-ups-archive.md) (2026-07-15 entry). **E2** (ADR [0073](../decisions/0073-ethics-procedure-model.md)): `ethics_case_details`/`ethics_allegations`/`ethics_findings`/`case_decisions`+`ethics_decision_details` (sanctions, CRM/CFM reporting)/`case_votes`/`ethics_hearings`/`ethics_appeals`; open sub-decisions carried in ADR 0064 §"Open items" (`form_responses.target_case_participant_id`, `case_phases` assignment-role vocabulary, reconciling `case_interview_subjects` with case-level participants). **E3**: label bundles, procedural-timeline categories, dashboards, standards-crosswalk (Phase 16) evidence linkage. Sequencing tracked live under "Current Phase Tasks" S4/S5 above; the three known E1→E2 gaps are tracked separately above (▶ ETH·E1 → ETH·E2 inheritance).

### 🟡 P7 — `audit_log` range-partitioning DEFERRED (lead decision 2026-07-05, pre-pilot hardening WS-5)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** If audit volume ever demands partitioning, the correct axis is `chain_key` LIST/HASH partitioning (NOT time) — a designed track with the chain-integrity model…

**P7 — `audit_log` range-partitioning DEFERRED (lead decision 2026-07-05, pre-pilot hardening WS-5).** Declarative range-partition-by-time is **structurally incompatible** with the audit chain: Postgres forces the partition key into every unique index, so the 4 partial-unique per-chain `seq` indexes would become `(chain_key, seq, occurred_at)` — permitting the same `seq` in different months and destroying the global-per-chain monotonic-seq invariant `verify_audit_chain` + the hash chain rely on. A wrong partition on the tamper-evidence table is worse than none. **If audit volume ever demands partitioning, the correct axis is `chain_key` LIST/HASH partitioning (NOT time)** — a designed track with the chain-integrity model reworked, not a cheap pre-launch win. Pairs with P6 (checkpointed `verify_audit_chain`) + the §6.5 evidence work (pre-Phase-19). Owned by lead (scheduling) + backend.

### 🟡 D3 — jsonb/array → junction-table normalization DEFERRED to its own scoped plan (user decision 2026-07-05, pre-pilot hardening WS-3b)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** Do it as a WS-1-style scoped plan pre-pilot while data is disposable (reset-OK).

**D3 — jsonb/array → junction-table normalization DEFERRED to its own scoped plan (user decision 2026-07-05, pre-pilot hardening WS-3b).** Move FK-bearing data out of `case_phases`/`process_template_phases.allowed_result_ids` (46 refs), `result_ruleset` result-ids (62), and `blocks integer[]` (120) into junction tables. **No reachable defect** — the shipped `reorder_template_phase` remaps `blocks` atomically; D3 prevents *future* dangling-`phase_results.id` UUIDs. Heaviest item (~14 functions across the case-phase result/recommendation engine; the `result_ruleset` structured jsonb is the awkward part — junction vs. jsonb+validation-trigger is the open design decision). Do it as a WS-1-style scoped plan **pre-pilot while data is disposable** (reset-OK). **Dispositioned 2026-07-10 → [Pre-Pilot Foundations Program](../plans/pre-pilot-foundations-program.md) F-cleanup** (the sibling structural tracks are resolved there: D12 closed, D5/§6.2 & D6/§6.3 superseded/cancelled, P6 stays deferred). Owned by lead (scheduling) + backend.

### 🟡 D7 — thread `p_hospital_id` for hospital-scoped NSP vocab. RE-SCOPED 2026-07-07: NOT backend-only — needs FE + a product decision (deferred)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**D7 — thread `p_hospital_id` for hospital-scoped NSP vocab. RE-SCOPED 2026-07-07: NOT backend-only — needs FE + a product decision (deferred).** Investigation (Batch B) found the vocab-CRUD call sites in `src/lib/safety/triage-actions.ts` (`create/update/reorder/archive` × EventType/SentinelCriterion) omit `p_hospital_id` → hit the GLOBAL arm (`can_curate_pqs_vocab(NULL)` = `is_admin` only) → non-admin hospital operator gets 42501. But it can't be threaded server-side: "current NSP hospital" is resolved from the **`?hospital=` URL param** (`nsp-hospital-scope.ts`), which a `'use server'` action can't read, and there's no cookie/server persistence; for a **multi-hospital** operator the hospital is a genuine UI choice. Also the vocab **UI is currently GLOBAL** (`nsp/configuracoes` documents vocab as shared, no hospital prop, global list reads) — so scoping it needs (a) a product decision on global-vs-per-hospital vocab semantics + list behavior (global ∪ hospital, per-row editability) and (b) wiring `hospitalId` through page→managers→dialog→actions (frontend). Owned by frontend + backend + product when scheduled.

### 🟡 WS-3c FE follow-up — manual-CAPA UI should pass `p_hospital_id` for MULTI-hospital operators (backend, non-breaking). BLOCKED — confirmed 2026-07-07 (Batch B)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** BLOCKED — confirmed 2026-07-07 (Batch B). No multi-hospital manual-CAPA UI exists to drive it: `open_capa_plan('manual', …)` auto-derives the hospital for the…

**WS-3c FE follow-up — manual-CAPA UI should pass `p_hospital_id` for MULTI-hospital operators (backend, non-breaking). BLOCKED — confirmed 2026-07-07 (Batch B).** No multi-hospital manual-CAPA UI exists to drive it: `open_capa_plan('manual', …)` auto-derives the hospital for the common single-hospital operator (works today); the multi-hospital branch raises **HC083** and has no caller. Stays deferred until a multi-hospital manual-CAPA UI is built — then thread the chosen hospital into `openCapaPlan` (`src/lib/safety/capa-actions.ts`). Owned by backend (+ frontend).

### 🟡 WS-4 C-6 FE follow-ups — PHI-disposal UI + copy (backend + frontend; before the pilot exposes disposal UI)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** before the pilot exposes disposal UI). The backend is complete; three product-facing pieces remain (QA INFO-3, ADR 0056): (a) `dispose_meeting_minutes` action…

**WS-4 C-6 FE follow-ups — PHI-disposal UI + copy (backend + frontend; before the pilot exposes disposal UI).** The backend is complete; three product-facing pieces remain (QA INFO-3, ADR 0056): (a) **`dispose_meeting_minutes` action + UI** — the standalone meeting-minutes disposal RPC exists but has no server-action/UI; (b) **disposal copy must reflect the NARROWED claim** — user-facing text must NOT say "tudo apagado"/fully-erased (storage blobs are retained encrypted under the 20-yr LGPD/ANVISA/CFM retention regime; DB-side PHI is erased) — copy should state DB-side PHI removed + attachments retained under retention; (c) **non-PHI "motivo da recusa" field** — after §6.4, `decline_note` is nulled to non-PHI referral readers, so a separate non-PHI decline-reason surface is needed for the metadata view. Owned by frontend (+ backend for the action). See [pre-pilot-hardening-wave1.md](../progress/pre-pilot-hardening-wave1.md).

### 🟡 Action-items hub — REMAINING satellites, adopt-on-demand (partner-handoff Phases 2–4; ADR [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md)). PULLED PRE-PILOT 2026-07-12 (ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)); ⚠ NARROWED 2026-07-28 — this entry claimed the whole menu was open, but the S2·AI track shipped three of them on 2026-07-14 (`phase(ai)`, [ai-satellites](../progress/ai-satellites.md)): ~~activity feed (`action_item_updates`)~~ ✅, ~~checklist items~~ ✅, ~~reminder/escalation rules~~ ✅ (`action_item_reminders` + the reminder→notifications scan arm)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** Adopt selectively when real committee workflows demand them — the hub-and-spoke schema already accommodates each as an additive satellite (no core-table…

**Action-items hub — REMAINING satellites, adopt-on-demand (partner-handoff Phases 2–4; ADR [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md)). PULLED PRE-PILOT 2026-07-12 (ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)); ⚠ NARROWED 2026-07-28 — this entry claimed the whole menu was open, but the S2·AI track shipped three of them on 2026-07-14 (`phase(ai)`, [ai-satellites](../progress/ai-satellites.md)): ~~activity feed (`action_item_updates`)~~ ✅, ~~checklist items~~ ✅, ~~reminder/escalation rules~~ ✅ (`action_item_reminders` + the reminder→notifications scan arm).** Still open: evidence, scheduled follow-ups, formal reviews, dependencies, per-committee custom fields, per-commission status/urgency **management UI** (the tables are configurable already; only global defaults are seeded + only the 4 global keys are surfaced), and effectiveness checks. Adopt selectively when real committee workflows demand them — the hub-and-spoke schema already accommodates each as an additive satellite (no core-table change), and status gating flags (`requires_comment`/`requires_evidence`/`requires_review`) become meaningful once evidence/review land. Owned by lead (scheduling) + backend/frontend when picked up.

### 🟡 Break-glass access (logged, reasoned, time-boxed emergency access to restricted cases / PHI)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** Target Phase 20 (Notifications & Escalation).

**Break-glass access (logged, reasoned, time-boxed emergency access to restricted cases / PHI).** Target Phase 20 (Notifications & Escalation). A dedicated `break_glass_access_events` record + a temporary-grant path that requires a reason, is always audited, notifies privacy/security, and appears in audit reports — NOT platform-admin-sees-everything. Partner handoff §19 as the reference model; composes with `case_access` expiry (ADR 0050) and the audited-single-door PHI posture (Rule 12). Owned by lead (scheduling) + backend.

### 🟡 User Registration — Phase-9 email-template deploy dependency (feature COMPLETE; deploy-time task)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**User Registration — Phase-9 email-template deploy dependency (feature COMPLETE; deploy-time task).** The pt-BR invite + recovery templates (`supabase/templates/{invite,recovery}.html`) must be pasted into Supabase **Dashboard → Auth → Email Templates** for Cloud (self-hosted `config.toml` templates don't auto-apply), preserving the `{{ .TokenHash }}` + `?type=invite|recovery` link shape — alongside the already-flagged custom SMTP. Until then invite/recovery links work locally but NOT in prod. Owned by backend at deploy. See [user-registration.md](../progress/user-registration.md).

### 🟡 Broader org-member-role-management UI (multi-tenancy gap; surfaced building NSP-per-org B3)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**Broader org-member-role-management UI (multi-tenancy gap; surfaced building NSP-per-org B3).** NSP-per-org added a *focused* `/o/[org]/manage/equipe-nsp` that toggles only the `nsp_coordinator` role, but there is **no general org-member management UI** — an `org_admin` cannot add/remove other `org_admin`s or manage org membership through the app (only the seed + direct DB). Build a proper `/o/[org]/manage/membros` surface (+ `organization_members` role CRUD actions). Owned by frontend + backend.

### 🟡 NSP appoint-picker: annotate/exclude current org_admins (minor UX, NSP-per-org B3)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**NSP appoint-picker: annotate/exclude current org_admins (minor UX, NSP-per-org B3).** The appoint picker lists all org users incl. `org_admin`s; selecting one returns the "já é administrador" refusal (the DB guard is the safety). Cleaner: disable/annotate current org_admins in the picker. Owned by frontend.

### 🟡 `appointNspCoordinator` TOCTOU hardening (optional, NSP-per-org B3)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**`appointNspCoordinator` TOCTOU hardening (optional, NSP-per-org B3).** The SELECT-role-then-upsert has a negligible race (admin-only, deliberate, low-frequency); a DB-level guard (trigger / partial constraint forbidding a coordinator-upsert over an `org_admin` row) would close it fully — over-engineering for now. Owned by backend.

### 🟡 Multi-tenancy — org_admin TS-gate gap in the invoker `authorize*` helpers (QA INFO / lead #15, non-blocking)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**Multi-tenancy — org_admin TS-gate gap in the invoker `authorize*` helpers (QA INFO / lead #15, non-blocking).** ~8 invoker-context `authorize*` server-action helpers gate on `is_staff_admin_of` / `isAdmin` but do **not** yet grant the org_admin → coordinator branch that `getCommissionAccessByOrg` grants on the read path. RLS is the security backstop (these are invoker-context, not service-role, so the worst case is an org_admin being *denied* a write they should be allowed, not an escalation), but the gates should be aligned with the read path for consistency. Enumerate + add the `is_org_admin_of_commission` term.

### 🟡 Pre-existing full-serial-suite contamination (NOT a form-builder regression)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**Pre-existing full-serial-suite contamination (NOT a form-builder regression).** A single full serial run is RED on `main` itself (~17–19 failures; branch ≤ baseline, 0 net new — proven by failing-title diff). Cross-spec seed-mutation in lexical run order (phase10–14/22 before phase2–8). Separate spec-isolation effort (phase13-saga class); the team's green path is chunked runs with a fresh reset per chunk. Tracked, does not gate any single feature.

### 🟡 Harden `e2e/form-builder-enhancements.spec.ts` to a throwaway commission (QA INFO-4, nice-to-have)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**Harden `e2e/form-builder-enhancements.spec.ts` to a throwaway commission (QA INFO-4, nice-to-have).** It builds fixtures in the seeded CCIH commission (`COMM_A`/`/c/ccih`) rather than a probe commission/users (cf. P13-005/006 lessons). Acceptable now (branch added 0 net contamination); harden (use `makeProbeCommission`/`makeProbeUser`) if it joins the full gate matrix.

### 🟡 `case_patient` disposal UI — "Descartar dados do paciente" (frontend, not blocking; mirrors the NSP WS C item below)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**`case_patient` disposal UI — "Descartar dados do paciente" (frontend, not blocking; mirrors the NSP WS C item below).** `dispose_case_phi` + the `disposeCasePhi(caseId, reason)` action are live; the UI is a coordinator/admin-gated button on the case detail opening a confirm dialog with a reason-category `<select>` bound to `PhiDisposeReason`/`CASE_PHI_DISPOSE_REASON_LABELS` (NO free-text — constrained category), reflecting `has_patient=false` + the `phi_disposed_*` stamp post-action. One-shot (HC056).

### 🟡 WS A FE — PQS-membership management UI (frontend, not blocking)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**WS A FE — PQS-membership management UI (frontend, not blocking).** `pqs_members` is admin-managed via `add/remove/list_pqs_members` RPCs + a seeded admin (functional/testable now). A roster-management screen under `/admin` (enroll/remove PQS staff, list members) is a frontend task; in prod the first admin enrolls staff via `add_pqs_member`. Mirror the `assignStaffAdmin` admin-action pattern (`requireAdmin` + admin client) for the server actions.

### 🟡 WS A FE — `/admin/nsp` gating + patient-panel affordance (frontend/tester, surfaced by WS A trace 2026-06-20)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**WS A FE — `/admin/nsp` gating + patient-panel affordance (frontend/tester, surfaced by WS A trace 2026-06-20).** (a) `/admin/nsp/[eventId]/page.tsx` gates ONLY on `context.isAdmin`. Post-WS-A a **non-PQS admin** degrades to `notFound()` (clean pt-BR 404 — `getSafetyEvent`'s `patient_safety_event` SELECT is now `can_read_event`, which denies a non-PQS/non-custodian admin → null → 404), NOT a crash/broken-empty page. Ideal: gate the NSP routes on `is_pqs_member` (e.g. via `patient_safety_enabled()` + a PQS check / a new `public.is_pqs_member()` read) for a tailored "não autorizado" instead of a generic 404. (b) The patient panel renders on `event.hasPatient` ALONE; entitlement is enforced at the data layer (the `get_event_patient` RPC returns null for an unentitled caller → `<PatientPanelEmpty>`), so **no PHI leaks**, but the affordance ideally gates on `hasPatient` AND entitlement to avoid showing an empty panel to an entitled-event-but-unentitled-PHI viewer. **No reporter-facing route renders the panel** (verified: `/c/[slug]/eventos` is governance-only, PHI-free; the panel is admin-route-exclusive) — so a reporter, incl. after custody handoff, never reaches it. Flagged per coordinator; NOT fixed in WS A.

### 🟡 WS E / M2 — per-vocabulary reorder/archive RPC consolidation DEFERRED (backend, 2026-06-20)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** Revisit only if the vocab set grows materially.

**WS E / M2 — per-vocabulary reorder/archive RPC consolidation DEFERRED (backend, 2026-06-20).** The reorder/archive RPCs for `case_tags`/`case_outcomes`/`case_narrative_types` (commission-scoped, `assert_*_enabled`+`is_staff_admin_of`) vs `pqs_event_types`/`pqs_sentinel_criteria` (GLOBAL, `assert_patient_safety_enabled`+`is_pqs_member`, two-step negative-offset against a deferrable position unique) diverge by gate/flag/scope/collision-strategy/pt-BR message. A shared `app.reorder_vocab(table,…)` helper would need table-name-interpolated dynamic SQL (injection surface + allow-list) and couldn't encode the per-table divergence — less auditable than the current explicit static RPCs. Revisit only if the vocab set grows materially. No code change.

### 🟡 WS B — authoritative PHI-bearing free-text column list (for ARCHITECTURE.md Rule 11/12 + ADR alignment, lead-owned). FINAL count = 22 columns

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

⚠ **NARROWED by ADR 0131 (2026-08-20) — the Rule 12 half is descoped, the Rule 11 half is NOT.** Erasure no longer extends to these columns (designated PHI fields only; training is the control), so the remaining deliverable — the ARCHITECTURE.md alignment — must record them as *PHI-capable, read-audited, **not** erased*. ⛔ Do not delete this item: removing it because half of it is descoped would silently drop the **read-audit** obligations its own text names (`meeting.viewed`, `interview.viewed`). ⭐ Its `*.title` EXCLUSION is the **title invariant** ADR 0131 now leans on — catalog-verified: 23 `PHI-BEARING free text` comments, zero on a `title`. **WS B — authoritative PHI-bearing free-text column list (for ARCHITECTURE.md Rule 11/12 + ADR alignment, lead-owned). FINAL count = 22 columns** (18 + the 4 borderline, lead ruled CLASSIFY 2026-06-20). Backend applied SQL column COMMENTs (`'PHI-BEARING free text (WS B; Rule 11/12)…'`) to: `patient_safety_event.description_md`, `event_triage.disposition_notes_md`, `rca.{what_md,expected_md,summary_md,impact,scope}`, `rca_factors.text`, `rca_root_causes.text`, `rca_timeline_entries.description`, `capa_plan.lessons_learned_md`, `capa_effectiveness.method_md`, `capa_action_task.description`, `capa_measure_result.note`, `meetings.minutes_md`, `case_interviews.summary_md`, `case_narratives.body_md`, `case_events.body` **(the original 18)** + **`meeting_agenda_items.{description,discussion_notes,resolution}` + `case_interview_subjects.note` (the +4 addendum** — all are multi-line textareas; agenda free-text already read-audited via `meeting.viewed` on `getMeetingDetail`/`listMeetingAgenda`, subject note via `interview.viewed` on `getInterviewDetail`/`listInterviewSubjects`; no new audit emit needed). **EXCLUDED** (governance metadata, PHI-free by the title invariant): all `*.title` + `case_interview_subjects.clinical_role`. Comment-only; `db diff` clean; types unchanged. Lead aligns ARCHITECTURE.md/ADRs from this 22-column list (backend left those docs untouched per instruction).

### 🟡 WS C FE — "Descartar dados do paciente" disposal UI (frontend, not blocking)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**WS C FE — "Descartar dados do paciente" disposal UI (frontend, not blocking).** The `disposeEventPhi(eventId, reason)` server action + the `dispose_event_phi` RPC are live and E2E-testable; the UI is a frontend task: an admin/PQS-gated button on the NSP event detail (`/admin/nsp/[eventId]`) opening a confirm dialog with a **reason-category `<select>`** bound to `PhiDisposeReason` / `PHI_DISPOSE_REASON_LABELS` (NO free-text field — the reason is a constrained category), a destructive-action confirm, and post-action it should reflect `has_patient=false` (panel gone) + show the `phi_disposed_at/by/reason` stamp ("dados descartados em … por … — motivo: …"). Disposal is one-shot (HC056 → "PHI já descartada"). Owned by `frontend`.

### 🟡 WS B/C FE — discourage PHI in `*.title` / structured short fields (frontend, not blocking; surfaced 2026-06-20)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

⭐ **PROMOTED by ADR 0131 (2026-08-20) — no longer "not blocking".** 0131 makes **training** the compensating control for PHI in free text, and this helper text is the **only software support for that control** — it defends the very title invariant WS B's exclusion rests on. Cheapest change that makes the decision hold in practice. **WS B/C FE — discourage PHI in `*.title` / structured short fields (frontend, not blocking; surfaced 2026-06-20).** The minimum-necessary invariant assumes titles stay PHI-free (they ride on queue/list paths). Add helper text / a soft validation note ("Não inclua dados do paciente.") to the title inputs on event/RCA/CAPA/meeting/interview/case forms (mirrors the existing case-action-item dialog note). Soft guidance only — no hard block. Owned by `frontend`.

### 🟡 E2E regression suite is NOT reliably green against a PROD build (test-harness debt, surfaced 2026-06-18; NOT a Phase-14 defect)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**E2E regression suite is NOT reliably green against a PROD build (test-harness debt, surfaced 2026-06-18; NOT a Phase-14 defect).** The freeze-proof gate now requires `next build`+`next start` (the heavy NSP pages crawl + balloon the `next dev` server to 4.3 GB — see user MEMORY `e2e-gate-prod-build`). But the pre-≤13 specs were authored against `next dev` and flake against the prod build: (a) Radix dialog close-animations (`data-[state=closed]:animate-out`) race tight `toBeHidden`/`toHaveCount` timeouts because — unlike the Phase-14 specs — the older specs DON'T set `reducedMotion: 'reduce'`; (b) the suite shares one mutable DB with no per-test reset, so Playwright `retries` (and parallel workers) CASCADE write-pollution: retries=2 produced MORE hard failures (25) than retries=0 (14). **Phase-14 specs are clean (65/65).** Evidence (2026-06-18, prod build, LOCAL Docker): full suite workers=1/retries=0 → 246 pass / 14 fail; non-14 specs workers=4/retries=2 → 162/13 flaky/20 fail; non-14 specs workers=1/retries=2 → 167/3 flaky/25 fail. Every failure is a pre-14 spec. **Fixes (test-infra; `tester` + `backend` for config):** add `use: { reducedMotion: 'reduce' }` to `playwright.config.ts` (one line, stabilizes animation timing globally); point `webServer.command` at a prod build for the gate; give the older mutation specs DB isolation (unique per-test fixtures or reset-per-file). Until then, the older specs' "green" depends on the `next dev` model.

### 🟡 E2E `case-narratives` AC-1b spec-isolation (tester-owned; surfaced 2026-06-19 during the case-access refinement triage)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**E2E `case-narratives` AC-1b spec-isolation (tester-owned; surfaced 2026-06-19 during the case-access refinement triage).** AC-1b renames the "Resumo Clínico" narrative TYPE to "…(Renomeado) {timestamp}" and never restores it, so on the shared DB a re-run/later-ordered AC-1 (which asserts the original label) fails. NOT a code regression — pre-existing test debt, an instance of the no-per-test-DB-isolation problem in the item above. Fix: AC-1b restores the original label in a teardown/`finally` (or uses a throwaway type). Until then `case-narratives` AC-1 is order/state-dependent.

### 🟡 Phase 14a deferred (QA re-verify INFO)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** do it on the next `src/lib/safety/actions.ts` touch (e.g. Phase 14b).

**Phase 14a deferred (QA re-verify INFO):** sweep the success string out of `ActionState.error` for the 4 remaining safety actions (`transferEventCustody` / `updateEvent` / `setEventPatient` / `cancelEvent`) into the new `message` field — harmless today (all consumers gate on `!result.ok`), do it on the next `src/lib/safety/actions.ts` touch (e.g. Phase 14b). Backend-owned. The 2 flagged in QA N1/I2 (`notifySafetyEvent`/`acknowledgeEvent`) are already done.

### 🟡 Interviews — "Minhas entrevistas" discovery surface for plain-`staff` interviewers (Phase 11, deferred per lead)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**Interviews — "Minhas entrevistas" discovery surface for plain-`staff` interviewers (Phase 11, deferred per lead).** v1 has NO dedicated list for a plain-`staff` registered interviewer to find interviews they may write — they reach the detail by DIRECT LINK only (the case-detail "Entrevistas" panel is coordinator-gated). The interview detail page renders correctly for them (membership guard + `viewerCanWrite` controls), and the detail header back-link points non-coordinators at the commission home (`/c/[slug]`), never the coordinator case page. A future "Minhas entrevistas" surface (mirroring "Minhas fases") would close the discovery gap. Owned by `frontend` when scheduled.

### 🟡 Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys** (Phase 2 QA re-review, ADR 0009). Otherwise `getClaims()` silently falls back to a per-request `getUser()` GoTrue round trip, re-introducing the P2-002 post-login race in production (behavioral regression, not a security hole — tampered tokens still fail closed). Add a testable verification step.

## ↩ Rotated from PROGRESS.md 2026-08-19 — the live follow-up index's deferred tail

> Open, but not actionable in the next session, so they never fired the `is it resolved?`
> rotation predicate and sat in the live index instead. Moved VERBATIM apart from the link
> repoint. Each is still OPEN — this is a change of address, not a closure.

> ⚠ **CUT DOWN 2026-09-02 at the register consolidation (ADR
> [0179](../decisions/0179-follow-up-register-consolidation.md)).** 27 of the 33 bullets here were
> the *index half* of an item whose *body* lived in `follow-ups.md`. Now that an item is ONE entry,
> keeping the bullet would be the double-registration the consolidation exists to remove — so each
> was cut here and its entry in [follow-ups-open.md](follow-ups-open.md) carries a **`**Parked**`**
> marker instead, preserving the not-actionable-next-session signal at the item itself.
> ⛔ **Nothing was closed and nothing was dropped**: 27 bullets cut, 27 entries marked, verified
> both directions. The **6** below are the remainder — items with no register entry, which is why
> they stay.

### 🟡 FUP-VACUOUS-COVERAGE-1 — `phi-remediation` REM-8/REM-9 are honest `test.skip()`s that never run, so they are outside the vacuity property and `lint:vacuous` can never catch them. ✅ Body written 2026-08-17 (it had no

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**FUP-VACUOUS-COVERAGE-1** — **`phi-remediation` REM-8/REM-9 are honest `test.skip()`s that never run, so they are outside the vacuity property and `lint:vacuous` can never catch them. ✅ Body written 2026-08-17 (it had no** — tester/backend

### 🟡 FUP-PDF-4 — `/verificar` rate limiter: ⛔ the filed premise was wrong (per-credential limiting already shipped); the real gap is the exhaustible global arm + per-process state

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**FUP-PDF-4** — `/verificar` rate limiter: ⛔ the filed premise was wrong (per-credential limiting already shipped); the real gap is the exhaustible **global** arm + per-process state — backend

### 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set from `pg_proc`, not by remembering it

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**FUP-AFF-3** — pin door ACLs by DERIVING the door set from `pg_proc`, not by remembering it — backend

### 🟡 FUP-FF5-2 — §O pins the door's behaviour, not the closure of the `participants` writer set (assert count AND name; `\y` not `\b`)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**FUP-FF5-2** — §O pins the door's behaviour, not the closure of the `participants` writer set (assert count AND name; `\y` not `\b`) — backend

### 🟡 AUTHZ Gate-2 MINOR-1 — reserved-session door returns the respondent's own `case_id` (fold at pilot close)

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**AUTHZ Gate-2 MINOR-1** — reserved-session door returns the respondent's own `case_id` (fold at pilot close) — backend

### 🟡 ETH E1→E2 inheritance — GAP-E1-1/2/3 + MINOR-A/B + participant-roles M2M, PO-routed to E2

**Parked:** 2026-08-19 (rotated from PROGRESS.md; original filing date unknown unless the text states one) · **Revisit when:** PO to rule

**ETH E1→E2 inheritance** — GAP-E1-1/2/3 + MINOR-A/B + participant-roles M2M, PO-routed to E2 — backend/frontend
