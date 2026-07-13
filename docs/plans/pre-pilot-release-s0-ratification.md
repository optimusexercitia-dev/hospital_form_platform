# S0 — Design & Sequencing Gate · Ratification Record

**Status:** IN PROGRESS (opened 2026-07-13). **Owner:** platform lead. **Gate unit:** S0 of the
[Pre-Pilot Release Scope Expansion](./pre-pilot-release-scope-expansion.md) (ADR
[0071](../decisions/0071-pre-pilot-release-scope-expansion.md)).

This is the **settled spine** S1–S5 build against. It does **not** restate the plan — it records the
**deltas verified at S0**, **locks the cross-track contracts** (SQLSTATE / flags / collisions / conventions),
captures the **product-owner decisions**, and indexes the **six specs to author** with their ADR numbers and
owners. Full narrative for every item lives in the plan (§§ cited inline). S0 ends on **lead + human sign-off**
of this record + the 🔴 collisions; no build to test.

---

## A. Groundwork findings (verified 2026-07-13, this branch)

| # | Check | Verified result | Consequence |
|---|---|---|---|
| A1 | SQLSTATE high-water | **`HC099`** (plan §3.1 said HC098 — stale by one) | Reserved track blocks `HC0A0+` are **all still free**; the §3.1 allocation stands unchanged. |
| A2 | Migration timestamp high-water | **`20260719000800`** ✅ | New migrations start **`20260720000000+`** (plan §4). |
| A3 | `pg_cron` installed? | **No** (zero references under `supabase/`) | **Ratified (G):** N's scheduler = **external cron → a server route** (viable under the Coolify/Dockerfile deploy, ADR 0059), not pg_cron. |
| A4 | `responses.supersedes_id` present? | **No** — the only `supersedes_id` in the tree is the F2 attachments/controlled-doc precedent (`20260717000000_attachments_core.sql`) | Phase-15 indicators **cannot** be supersession-tolerant yet (the filter column does not exist) → **SUP must retrofit** the dashboard + Phase-15 derived-indicator rollups (resolves plan §7.7 / collision X-θ). The `supersede_document` / `reopen_narrative` precedent is the RPC pattern to mirror. |
| A5 | Current feature flags | `FeatureFlags` interface holds 19 keys (`src/lib/queries/feature-flags.ts`) | `case_participants` + `case_types` exist in `app.feature_flags` (seeded OFF, F1) but are **absent from the hand-maintained interface** — **ETH·E1 adds them to the interface when it flips them ON** and wires consumers. The four new flags (`notifications`, `charters`, `ethics`, `response_correction`) are all absent, as expected. |

---

## B. SQLSTATE block allocation (ratified — high-water `HC099`)

Every code maps to a pt-BR message in the data layer (Rule 8/10); raw Postgres never reaches the UI. Each new
`public.*` RPC: **`revoke all … from public;` then `grant execute … to authenticated, service_role;`** (t19
guard; DROP+recreate resets grants — re-issue both).

| Track | Block |
|---|---|
| Referrals v2 (RV2) | `HC0A0–HC0A9` |
| Interviews v2 (IV2) | reuse `HC038`/`HC041` + `HC0B0–HC0B9` |
| Notifications (N) | `HC0C0–HC0C9` |
| Charters (CH) | `HC0D0–HC0D9` |
| Ethics E1 | `HC0E0–HC0E9` |
| Ethics E2 | `HC0F0–HC0F9` |
| Memberships §6.1 (MEM) | `HC0G0–HC0G9` |
| Supersession (SUP) | `HC0H0–HC0H9` |
| Action-items satellites (AI·sat) | `HC0I0–HC0I9` (AI·ui needs none) |

## C. Feature-flag plan (ratified)

Convention: insert **OFF** in an early migration; flip **ON** via a separate one-line migration at phase
completion; `seed.sql` may force ON for local/E2E. Add each **new** flag to the hand-maintained
`src/lib/queries/feature-flags.ts` `FeatureFlags` interface when a typed caller first consumes it.

| Flag | Track | Action |
|---|---|---|
| `case_referrals` (exists, OFF) | RV2 | reuse; **stays OFF** until a late pilot-enable decision (§F note) |
| `interviews` (exists, ON) | IV2 | reuse |
| `case_participants` + `case_types` (in DB, OFF; **not yet in interface**) | **ETH·E1** | **E1 flips both ON** (the m2 gate release) **and adds them to the interface** |
| `attachments` (exists, ON) | ETH·E1 | reuse (doc-level confidentiality extends the attachment reader) |
| `action_items` + `cases_extras` (exist, ON) | AI | reuse |
| `meetings`, `controlled_docs`, `audit_trail`, `quality_indicators` (exist, ON) | N, CH | reuse (consumers) |
| **`notifications`** | N | **create, seed OFF**, flip at gate |
| **`charters`** | CH | **create, seed OFF**, flip at gate |
| **`ethics`** | **ETH·E2 owns it** (§F.4) | **create, seed OFF**, flip at gate |
| **`response_correction`** | SUP | **create, seed OFF**, flip at gate |
| — (none) | MEM | structural, no flag |

## D. Cross-cutting conventions (recorded once — bind every track)

- **R6 anti-recursion** (ADR 0064): every participant-derived RLS term is computed **inside** the DEFINER
  predicate over **base tables** — never via an RLS-gated `case_participants` read. Applies to ETH·E1.
- **t19 grant rule** (see §B).
- **Flag-OFF fallback invariant:** each flagged track preserves **byte-for-byte** pre-track behavior when its
  flag is OFF.
- **One taxonomy** (X-δ) · **one hub** (X-ε) · **one notification engine** (X-ζ) · **one membership door** (X-β).
- **Audit:** new verbs join the `log_audit_access` allow-list + the `_audit_access_authorized` dispatch;
  metadata is PHI-free (records *that* + *who*, never payloads). Mutations emit via `app.audit_write`.
- **graphify-first:** every code-exploration task (lead or teammate) runs `graphify query` before grepping/reading source.

## E. Collision contracts (locked — per-track reviews are conformance checks, not re-litigation)

🔴 = design-reviewed here; 🟢 = one-line contract. Full collision descriptions: plan §2.

- **X-α · `can_read_case`** 🔴 — **MEM lands first** (predicate family → `has_role()`, contracts verbatim);
  **then ETH·E1** adds respondent-exclusion / recusal / explicit-grants-only / confidentiality terms **inside the
  DEFINER over base tables** (R6). **AI·ui needs no change** — its `case_restricted` arm rides whatever
  `can_read_case` resolves to. Flag-OFF fallback preserved at each step. Owner: MEM → ETH·E1; AI·ui conforms.
- **X-β · membership predicate family `is_*_of`** 🔴 — MEM collapses ~30 `app.is_*_of` into one `has_role()`
  family; the ~30 old names stay as **thin wrappers** so the ~145 call-sites compile unchanged. WS-1 RPC
  contracts + audit **carry over verbatim** (storage-shape migration, not a security rewrite). Owner: MEM.
- **X-γ · `case_interviews` confidentiality + participant FK** 🔴 — **IV2 lands inert columns** (English keys;
  `confidentiality_level` **non-enforcing**; `relationship_to_case` **excludes patient/family** — staff-only,
  Rule 12) and adds **no** `participant_id` FK. **ETH·E1 owns** the enforcement migration + the `participant_id`
  wiring + attendance/roles-M2M/topics/summaries. IV2 precedes E1. Do **not** add a speculative `participant_id`
  in IV2. Owner: IV2 (inert) → ETH·E1 (enforce).
- **X-δ · one confidentiality taxonomy** 🔴 — **the F2 label set is the shared vocabulary**:
  `{non_phi_internal, phi_standard, phi_restricted, peer_review_confidential, legal_privileged,
  ethics_investigation, credentialing_sensitive}`. E1's `cases.confidentiality_level` and IV2's
  `case_interviews.confidentiality_level` **align to it**; E1's document-level confidentiality **extends the F2
  `attachments.confidentiality_label` + owner-dispatch reader** — **not** a parallel grant table. Owner: S0
  aligns the value-sets → IV2 / ETH·E1 conform.
- **X-ε · `action_items` hub** 🟢 — AI·sat adds spoke tables + **reuses `can_read_action_item` verbatim**; ETH·E2
  (sanctions/remediation) and CH (carry-forward reads `meeting_action_items`) are **pure consumers** — no hub
  schema change. CAPA stays isolated (bridge = escalation, not a satellite). Sequence AI before E2. Owner: AI·sat.
- **X-ζ · `compute_due_notifications()` scan arms** 🟢 — **N ships the engine + already-shipped sources**; ETH·E2
  (notice deadlines), CH (review-due / "reunião em atraso"), AI·sat (reminders) each **add their own additive,
  idempotent scan arm** when they land. N does not wait on them; they do not fork the engine. Owner: N.
- **X-η · `meetings` module** 🟢 *(revised at authoring — E2·O-7a)* — CH reads `held_at` (cadence, ADR 0062) +
  `commission_meeting_settings` (quorum — **not** restated); ETH·E2 hangs `ethics_hearings` off a `meetings` row
  and **seeds an "Audiência" `commission_meeting_types` catalog row — NO `meeting_type` DDL column** (the catalog
  already exists as `meetings.meeting_type_id`; a column would duplicate it). The collision therefore **shrinks to
  seed-only**: E2 no longer edits meetings DDL, so the CH↔E2 meetings serialization is a light seed-order note, not
  a DDL conflict. Owner: CH (read-only) · E2 (seed + `ethics_hearings` child).
- **X-θ · `responses` immutability + aggregation** 🟢 — the **successor** row carries `supersedes_id`; the
  original submitted row is **never mutated** (immutability guards intact). SUP owns the latest-in-chain
  aggregation retrofit across `dashboard.ts` + Phase-15 derived indicators. **A4 confirms the retrofit IS
  required.** Owner: SUP.

## F. Product-owner decisions (locked 2026-07-13)

1. **AI satellite set (§7.6):** ship **reminders + updates-feed + checklists** pre-pilot; the rest
   (related_records / reviews / follow-ups / dependencies / templates / custom_fields) stay deferred.
2. **MEM `case_access` (§7.4):** **keep `case_access` separate** — collapse only the three role tables
   (`organization_members` / `commission_members` / `pqs_members`) into `memberships`; `case_access` remains the
   per-case involvement ACL (carries `level` / `expires_at` / `reason`).
3. **Ethics E3 / Phase 16 (§7.1):** **split** — ship **E3a** (terminology/UX + dashboards) pre-pilot; **defer
   E3b** (accreditation-standard evidence link) until Phase 16 (Standards Crosswalk) is re-planned + shipped.
4. **`ethics` flag ownership (§7.8):** **ETH·E2 owns `ethics`** (gates the procedure surface). ETH·E1 flips only
   `case_participants` + `case_types`.

**Carried to the E1 ADR for a sign-off recommendation (not asked cold):** the **M2 professional-erasure vs
CFM-1821/2007 20-yr-retention** posture — the E1 ADR must *propose* a resolution for human sign-off at the S0
gate (plan §3.4.1).

**Deferred (not blocking S0):** RV2 pilot-enable (whether to flip `case_referrals` ON for the pilot at all) and
R2–R5 vs fast-follow trim — a late deploy-time call; `case_referrals` stays OFF meanwhile (plan §7.2/§7.5).

## G. Scheduler (ratified)

`pg_cron` is not installed (A3). **N uses an external cron hitting a server-only route** (provider-abstracted
transactional email; **not** GoTrue auth templates). Email tests intercept **Mailpit :54324**; keep local
`[auth.email.smtp] enabled=false` (memory `local-smtp-must-be-off-for-e2e`).

## H. Specs to author at S0 (§3.4) — assignments

Each is a **design document only** (contract-first: typed stubs / table + RLS shapes / SQLSTATE from the §B
block / flag / acceptance) — **no migrations, no app code** at S0. Mirror the structure of
[`docs/phases/case-access-control.md`](../phases/case-access-control.md).

| Spec | ADR | Doc | Owner | Status |
|---|---|---|---|---|
| Ethics **E1** — access spine | **0072** (new) | ADR + `docs/phases/ethics-e1-access-spine.md` | backend | ✅ **authored** (M2 posture + `can_read_case` terms; open decisions → §I) |
| Ethics **E2** — procedure | **0073** (new) | ADR + `docs/phases/ethics-e2-procedure.md` | backend | ✅ **authored** (9 tables; M2 pin/redaction; X-η corrected → §I) |
| Ethics **E3** — terminology/UX (+E3a/E3b split) | none (0064 covers) | `docs/phases/ethics-e3-surfacing.md` | backend | ✅ **authored** (E3a dashboards + terminology; E3b deferred; `case_type_id` gap → §I) |
| **§6.1** memberships collapse (MEM) | none (scoped plan) | `docs/plans/memberships-collapse-s6-1.md` | backend | ✅ **authored** (open decisions → §I) |
| **Supersession** correction engine | **0074** (new) | ADR + `docs/plans/supersession-correction.md` | backend | **authored** (ADR 0074 + plan; awaiting gate sign-off) |
| **AI-satellites** spec | none (0050 partner) | `docs/plans/action-items-satellites.md` | backend | **authored** (3 tables + AI·ui; open decisions → §I) |

Already have specs (no S0 authoring): RV2 ([plan](./referrals-v2-dialogue-governance.md) + ADR 0037 A1), IV2
([plan](./interviews-v2-sessions.md) + ADR 0070), N & CH ([accreditation-track](../phases/accreditation-track.md)),
AI·ui (ADR 0050 F1).

---

## I. Open decisions surfaced during authoring — S0 sign-off ledger

Accumulated as specs land; resolved at the **S0 human sign-off**. Lead disposition noted. **★ = real downstream
cost or a security-verify — call these out at sign-off.** Endorsed defaults need no action unless the PO overrides.

### MEM (§6.1) — authored 2026-07-13
- **O-1 `case_id` on `memberships`** → **DROP** (endorse). No role scopes to a case; `case_access` stays the
  per-case plane; ETH·E1 uses `case_participants` roles, not `memberships`.
- **★ O-2 `commission_members` writes behind the door** → **YES** (endorse). `addStaff`/`removeStaff` move onto
  `grant_role`/`revoke_role`; exported signatures frozen, only the write mechanism moves. The one visible-behavior
  -risk point → tester watches the appointment UIs in full E2E.
- **O-3 `title_id`** → inline nullable + scope-CHECK (endorse).
- **O-4 `organization_id`** denormalized on hospital-tier rows only (endorse; mirrors incumbent).
- **O-5 shim return types** — `add_pqs_member returns pqs_members` (dropped table) → shim returns a compatible
  composite shape (endorse; technical necessity).
- **★ O-6 audit verbs** → **unify** to `membership.granted`/`.role_changed`/`.revoked`, retire the 3 legacy
  families (endorse). Cost = repoint `verify_audit_chain` fixtures + E2E audit assertions (Rule 11 chain intact;
  reset-OK).

### AI (satellites + cross-link) — authored 2026-07-13
- **★ O-1 `can_read_case(null, uid)` fail-closed?** — a `case_restricted` item with **no** `case_id` must be
  invisible, not open. **Security-verify before the AI·ui visibility toggle is built (S2)**; expected fail-closed
  via the ADR-0050 default-restrict guard, but backend must confirm + pgTAP-lock.
- **★ O-2 updates/checklist write authority** — spec gates writes to a **stakeholder** (assignee / active
  assignment / `staff_admin`), not "any committee reader". **PO call.** Lead recommendation: **endorse
  stakeholder-gated** (tighter default); confirm at sign-off.
- **O-3 reminder recipient vs case-read** — suppress a reminder to an assignee who cannot `can_read_case` the
  cross-linked case → deferred to N + AI·sat jointly (the scan arm doesn't exist until N ships).
- **O-4 cosmetic** — static visibility disclosure on the case-sourced form; cuttable, no reopen.

### SUP (supersession) — authored 2026-07-13
- **O-1 successor pre-population** → **pre-populate** the draft with the predecessor's answers (correct-in-place,
  not blank re-key) (endorse).
- **O-2 successor abandon** → the existing `discard_response` (no new RPC) (endorse).
- **O-3 "coordinator" authority** → `is_staff_admin_of OR is_commission_admin_of` (no `coordinator` role enum;
  matches the `supersede_document` gate) (endorse).
- **Accepted brief-corrections (conformance):** `submit_response` needs **no change** (successor pre-linked on the
  draft); the `response.superseded` audit goes through **`app.audit_write`** (mutation path), **not** the
  `log_audit_access` read allow-list (precedent `response.discarded`); **no new RLS policy** (the successor is an
  ordinary owned `in_progress` response). Aggregation retrofit = a **single choke-point** (`app.submitted_form_responses()`
  + the `commission_overview` inline counter + the TS twin `isDashboardCountable`) — much smaller than §7.7 feared.

### ETH·E1 (access spine) — authored 2026-07-13 · **M2 posture = the regulatory sign-off keystone**
- **★ M2 professional-identity posture (recommendation for sign-off):** adopt ADR-0035 **"minimise, do not
  destroy"** for Class-2 — **no** `dispose_professional_profile` at E1; a profile that is a respondent in any
  **decided** case (E2) is **retention-pinned** (CFM-1821/2007 20-yr floor overrides LGPD Art. 18 erasure);
  **correction always available**; the erasure *shape* when eligible = **redaction** (null identity, preserve
  row + audit), designed in **E2** with the decision model that triggers the pin — **not** built at E1. Rule 12
  gains a Class-2 erasure bullet at Record. *Defer any active pre-decision erasure path unless the PO wants it.*
- **O1 — clearance shape** → add a nullable `case_access.max_confidentiality` column (endorse; orthogonal to
  read/write) vs widening `case_access.level` grades.
- **O2 — doc-ceiling labels** → `legal_privileged` + `credentialing_sensitive` require clearance;
  `ethics_investigation` stays at case-read (endorse; confirm).
- **O3 — IV2 confidentiality remap (X-δ load-bearing)** → IV2 3-value → F2 7-value:
  `standard→non_phi_internal`, `restricted→peer_review_confidential`, `highly_restricted→ethics_investigation`
  (endorse; confirm the semantics at sign-off).
- **`can_read_case` term set (locked):** respondent-exclusion + recusal (hard DENY, short-circuit **before**
  every positive arm incl. QPS/staff-admin) · explicit-grants-only enforced at the **reach surfaces**
  (`list_my_cases` + board `visibility_policy`) since there is no blanket member arm in the ON-path (so
  `commission_default` stays byte-for-byte) · confidentiality ceiling **extends the F2 `can_read_attachment`** (no
  parallel grant table). Same deny terms added to `can_read_case_patient` + `can_write_case_content`. Highest-risk
  build task = the `can_read_case` edit (BE-4).

### ETH·E2 (procedure) — authored 2026-07-13
- **9 new tables** (all `case_id`-children, `can_read_case`-gated SELECT + DEFINER write — **no new RLS shape**):
  `ethics_case_details` · `ethics_allegations`+`ethics_findings` · `ethics_notifications` · `case_decisions`+
  `ethics_decision_details` · `case_votes` · `ethics_hearings` · `ethics_appeals`. **Stayed form/narrative** (fail
  the ADR-0064 graduation test): respondent defense (→ `responses`), evidence (→ `attachments`), deliberation (→
  `case_events`). Additive: `responses.target_case_participant_id`, `professional_profiles` pin/redaction cols, 2
  catalogs + nullable `case_phases.assignment_role_id`.
- **M2 pin/redaction (implements E1 §7 — the sign-off keystone, built here):** `AFTER UPDATE` pin trigger on
  `case_decisions`→`issued` sets `professional_profiles.retention_pinned_at` on respondents (R6 base-table,
  audited); `redact_professional_profile()` (`HC0F7` if pinned/respondent-in-issued-case) nulls identity but
  **preserves row + `case_participants` linkage + audit** — never deletes. Finalizes Rule 12 Class-2 erasure.
- **`case_votes` recusal:** enum `{approve,reject,abstain}` (**no `recused`** value — recusal is an access fact):
  E1 `can_read_case` hard-denies the ballot **and** `cast_case_vote` re-checks at the door (`HC0F5`);
  `eligible_voters()` = members − recused − respondent.
- **★ O-7 (X-η correction, load-bearing):** meetings **already** has a `commission_meeting_types` catalog
  (`meetings.meeting_type_id`) → E2 adds **NO `meeting_type` column**; **O-7a: seed an "Audiência" catalog row**,
  shrinking X-η to seed-only. **§E X-η updated.**
- **★ O-3 vote-quorum** before `issue_decision` (reuse `commission_meeting_settings` quorum → `HC0F8`) →
  **enforce** (endorse; defensibility).
- **★ O-4 CRM/CFM hand-off** → internal legal = on-platform referral (ADR-0037); CRM/CFM = off-platform notice +
  decision-letter attachment (endorse; pilot config).
- **★ O-5 assignment-role** → nullable `case_phases.assignment_role_id` FK (endorse) vs a side table.
- **O-1 naming** drop the `_case_` infix · **O-2 catalog-vs-enum** for allegation/sanction/decision types → catalog
  (both endorse; ADR-0065 catalog principle).

### ETH·E3 (surfacing) — authored 2026-07-13
- **★ O-1 (real foundation gap the gate caught):** **`cases.case_type_id` does not exist** — F1 created
  `case_types` + `case_type_terminology` but never linked a case to its type; neither E1 nor E2 adds it. E3's
  terminology + E2's ethics-scoping + E1's visibility snapshot all need the persistent linkage. **Lead resolution:
  E1 owns it** — E1's build adds **`cases.case_type_id` (nullable FK → `case_types`, snapshot at create)** alongside
  `cases.visibility_policy` (one source of truth at the access spine); E2 + E3 (BE-2) consume it. *(Overrides E3's
  proposed option (a); amends E1 build scope — the S3 builder incorporates this.)*
- **E3a dashboard** = `getEthicsDashboard()` in a new `ethics-dashboard.ts` — an **RLS-scoped `authenticated`
  query, NO service-role** (aggregates AFTER `can_read_case` filters → a respondent/recused/non-granted viewer
  counts zero). Highest-risk task: a naive service-role `count(*)` would defeat the m2 spine at the reporting layer.
- **`case_events` widen** (additive, **narrowing-only**): +8 procedural kinds + a `visibility ∈ {case_readers,
  coordinator_only}` column (default `case_readers` = byte-for-byte). Also closes a pre-existing `CaseEventKind`
  TS/DB drift (`interview`/`safety_event`).
- **Ethics seed:** `case_type` `ethics_complaint` (`primary_subject_kind=professional`,
  `default_visibility_policy=explicit_grants_only`) + terminology + a 7-role bundle.
- **O-3** E2 RPCs auto-write `case_events`? → **manual-only** for pre-pilot (endorse; auto-derivation deferred).
  **O-2** dashboard route placement + **O-4** 8 pt-BR event labels → frontend calls at build.

---

## J. Sign-off status

- **2026-07-13 — PO partial ratification:** **M2 professional-identity posture = "minimise, do not destroy"**
  (accept E1's recommendation, §I ETH·E1 — no deletion; retention-pin on decided cases; redaction as the eligible
  erasure shape) · **AI satellite write-authority = stakeholders-only** (§I AI O-2 — assignee / active-assignment
  / `staff_admin`). Both **locked**.
- **Remaining §I dispositions** = lead-endorsed defaults, ratified **as a block** at full sign-off (incl. the ★
  items: MEM O-2 writes-behind-door · MEM O-6 unified `membership.*` audit · E2 O-3 vote-quorum · E2 O-7a X-η
  seed-only · E1-owns-`cases.case_type_id`).
- **S0 full sign-off + S1 kickoff:** **pending PO review** of the six spec docs + this record. **S1 (N · MEM ·
  SUP) does not begin until the PO gives the go.** "Nothing merges ahead of its gate" unchanged.
