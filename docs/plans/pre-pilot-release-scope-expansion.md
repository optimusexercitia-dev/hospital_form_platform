# Pre-Pilot Release Scope Expansion — one sequenced build plan for twelve initiatives

**Status:** PLANNED (sequencing accepted; specs partly to author; not implemented). **Date:** 2026-07-12 ·
**Owner:** platform lead → `backend` (+ `frontend` per track). **Implements:** ADR
[0071](../decisions/0071-pre-pilot-release-scope-expansion.md).
**Posture:** pre-pilot, **reset-OK** — F0–F3 + F-cleanup are live on remote (pilot reset 2026-07-12); every
item here lands **additively, forward-only, dark behind a flag** (where one exists), folded into the *next*
pilot reset. No back-compat migrations.
**Binding rules:** Rule 1 (RLS is the boundary), Rule 2 (canonical schema — extend, never contradict), Rule 3
(one evaluator, mirrored SQL↔TS), Rule 5/6 (published + storage immutability), Rule 8 (regen types), Rule 10
(pt-BR UI / English code), Rule 11 (audit), Rule 12 (PHI — three Class-1 modules + the Class-2 professional class).
**Conventions inherited from F0:** ADR [0065](../decisions/0065-pre-pilot-foundations-conventions.md) (three
polymorphism dialects · one Rule-12 sensitivity taxonomy · catalog-vs-enum · freeze principle ·
reference→participants bridge · **supersession model §8**) + ARCHITECTURE.md Appendices A/B.

ADR 0071 is a **re-sequencing** decision: it pulls twelve already-specified initiatives into the pre-pilot
release. This plan does **not** re-design them — it **sequences** them into one collision-free build order,
resolves the places where two tracks touch the same schema surface (§2), lists the specs still to author
(§3.4), and gives each track its own DB detail + Phase Gate (§4). One codebase, one schema, one rulebook.

**The twelve initiatives → track handles, home, and gate unit:**

| # (0071) | Initiative | Track | Source spec | Prior status | Gate units |
|---|---|---|---|---|---|
| 1 | Notifications & Escalation (Phase 20) | **N** | [accreditation-track §20](../phases/accreditation-track.md) | post-pilot | 1 phase |
| 2 | Committee Charters & Meeting Cadence (Phase 21) | **CH** | [accreditation-track §21](../phases/accreditation-track.md) | post-pilot | 1 phase |
| 3 | Referrals v2 — R1 Dialogue Core | **RV2·R1** | ADR [0037](../decisions/0037-inter-committee-case-referrals.md) A1 · [plan](./referrals-v2-dialogue-governance.md) | pilot-critical | R0 gate + R1 |
| 4 | Referrals v2 — R2–R5 Governance | **RV2·R2–R5** | same | deferred / fast-follow | 4 increments |
| 5 | Interviews v2 — Sessions + Reporting/Confidentiality | **IV2** | ADR [0070](../decisions/0070-interview-data-model-v2-sessions.md) · [plan](./interviews-v2-sessions.md) | pre-pilot | 1 phase (I0–I5) |
| 6 | Ethics E1 — Access spine | **ETH·E1** | ADR [0064](../decisions/0064-case-subject-generalization-participants.md) → **new ADR** | post-pilot (m2 gate) | 1 phase |
| 7 | Ethics E2 — Procedure | **ETH·E2** | ADR 0064 → **new ADR** | post-pilot | 1 phase |
| 8 | Ethics E3 — Terminology/UX + accreditation link | **ETH·E3** | ADR 0064 (no new ADR) | post-pilot | 1 phase (E3a+E3b) |
| 9 | Action-items hub satellites | **AI·sat** | ADR [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md) | deferred | folded into 1 phase |
| 10 | Action-items case cross-link UI + `visibility_scope` toggle | **AI·ui** | ADR 0050 (no new ADR) | deferred FE | folded into 1 phase |
| 11 | §6.1 single-`memberships` collapse | **MEM** | [audit §6.1](../reviews/external-db-audit-2026-07.md) → **new plan** | deferred | 1 phase |
| 12 | Supersession correction-model engine + UX | **SUP** | ADR [0060](../decisions/0060-flexible-forms-foundation.md) Gap 38 → **new ADR** | post-pilot | 1 phase |

**Net: 14 Phase-Gated units** across 8 tracks + 1 design gate. Only Phases **18–19** stay post-pilot.

---

## 0. Scope

**In scope (this program, all pre-pilot / reset-OK):** the twelve initiatives above, sequenced under one
design gate (S0) into five dependency stages (S1–S5, §1).

**Foundations these build on (already shipped + live on remote):**
- **F1 participants** (ADR 0064 E0) — `participants` typed-identity registry, `case_participants`,
  `case_participant_roles`, `case_types` + `case_type_terminology`, `professional_profiles` (Class-2),
  `patient_identifiers` (N-per-case PHI re-key). **Flags `case_participants` + `case_types` seeded OFF** — the
  **m2 hard gate** that **ETH·E1 releases**.
- **F2 attachments** — `attachments` owner-dispatch core + `confidentiality_label` taxonomy +
  `owner_type='action_item'` evidence path. **The one shared confidentiality taxonomy** (ADR 0065 §3).
- **Action-items hub** (ADR 0050) — `action_items` + `visibility_scope` (`committee`/`case_restricted`/
  `assignees_only`) + `can_read_action_item` RLS + configurable statuses/urgency + assignments +
  status-history. **AI·ui's backend already exists**; **AI·sat adds spoke tables.**
- **Membership write-lockdown** (WS-1) — `organization_members`/`pqs_members` DML revoked, DEFINER
  `grant`/`revoke` doors, `_deny_self_grant`, blanket audit, anti-lockout. **MEM is the storage-shape finish**,
  not a security-model rewrite (WS-1 was built forward-compatible).
- **Referrals core** (Phase 22, flag `case_referrals` OFF), **Interviews core** (Phase 11, flag `interviews`),
  **Meetings** (`held_at` occurrence time, `commission_meeting_settings` quorum, `meeting_action_items`),
  **CAPA / indicators / controlled-docs** (the due/overdue signal sources **N** consumes), **audit_log**
  (hash-chained), **supersession model** (ADR 0065 §8 ratified `responses.supersedes_id` + latest-in-chain).

**Out of scope / stays post-pilot (unchanged):** Phase 18 (Self-Assessment / Internal Audit), Phase 19
(Surveyor Access / Evidence Export), the FF-1…FF-5 flexible-forms authoring UX, break-glass access *design*
(only an expiring-grant reminder is buildable — §9.3), CAPA↔hub table convergence (bridge stays *escalation*),
column-level encryption (declined, Rule 12), the P6/P7 audit-evidence track.

**⚠ Cross-cutting dependency on a deferred phase:** **Phase 16 (Standards Crosswalk & Readiness)** was
deferred 2026-07-11 (needs replanning). **ETH·E3's accreditation-link** sub-feature depends on it. Resolution
in §1 (E3 splits) + §9.1.

---

## 1. Sequencing & dependency stages

> Stages are **dependency layers**, not calendar slots. A stage begins when its inputs are gated. Tracks
> *within* a stage are independent and may interleave, subject to the file-ownership serializations in §7.
> Every track keeps its own Phase Gate (CLAUDE.md §6). "Nothing merges ahead of its gate" is unchanged.

```
S0  Design & Sequencing Gate  (author missing ADRs/plans · ratify SQLSTATE/flags/collisions)
      │
S1  Structural substrate  ── N (Notifications) ── MEM (§6.1 collapse) ── SUP (supersession)
      │   (de-risk new infra · settle membership RLS + aggregation BEFORE downstream leans on them)
      │
S2  Pilot cores + E1 prerequisites  ── RV2·R0→R1 ── IV2 (Now) ── AI (sat + ui)
      │   (RV2·R1 pilot-critical · IV2 MUST precede E1 · AI hub ready before E2 consumes it)
      │
S3  Ethics access spine  ── ETH·E1   ← releases the m2 flag gate (case_participants/case_types ON)
      │
S4  Governance layer  ── ETH·E2 ── RV2·R2→R5 ── CH (Charters)
      │
S5  Ethics surfacing  ── ETH·E3a (terminology/dashboards) ── ETH·E3b (accreditation link ← needs Phase 16)
```

### Why this order (the load-bearing rationale)

- **N first (S1).** Notifications is the escalation/reminder **substrate** three shipped modules already
  feed (overdue-CAPA, review-due, measurement-due) but have no reminder path for; ADR 0071 §Sequencing says
  "sequence it early enough to serve" the escalation features. It also **de-risks net-new infra** (pg_cron /
  external cron + a transactional email route + prod SMTP) early — the same prod-auth/email gap ADR
  [0028](../decisions/0028-accreditation-governance-roadmap.md) (and the ADR-0009 prod-auth gap) wants
  validated before the pilot.
  Later tracks (**ETH·E2** ethics-notice deadlines, **CH** charter-review reminders, **AI·sat** reminders)
  register as **additive scan arms** once N's engine exists.
- **MEM early (S1), before any RLS-heavy track.** §6.1 rewrites the ~30-predicate `is_*_of` family that
  **~145 policies** consume. Doing it **before ETH·E1** (which adds respondent/recusal/confidentiality terms
  to `can_read_case`) and **before RV2 governance RLS** avoids re-litigating those policies twice. WS-1's
  forward-compatible doors mean predicate **contracts carry over verbatim** — downstream RLS keeps compiling.
  It must **not run concurrently** with E1/RV2 governance (RLS churn) and is serialized on `session.ts`/
  `members.ts` (§7).
- **SUP early (S1).** The latest-in-chain aggregation filter lands in dashboard + Phase-15 indicator queries;
  doing it before more dashboard consumers accrete keeps the retrofit small. Independent of every other track.
- **RV2·R1 in S2 (pilot-critical).** "R1 alone makes referrals usable." R0 (design gate) ratifies the
  message/notes PHI-gating once; R2–R5 governance layer on R1 and may fast-follow (S4) if the date compresses.
- **IV2 in S2, *before* E1.** Interviews v2's "Now" slice is independent, but its **deferred scope folds into
  E1** (participant-registry wiring, confidentiality *enforcement*, attendance, roles-M2M, topics, per-audience
  summaries). IV2 ships those columns **inert** (non-enforcing `confidentiality_level`, no `participant_id`
  FK) **on purpose** so E1 adds enforcement without a re-migration. IV2 must land first.
- **AI (sat+ui) in S2.** ETH·E2 sanctions/remediation lean on the `action_items` hub; the AI satellites +
  cross-link UI should exist before E2 consumes them. AI·ui is mostly FE over already-shipped backend; the
  **reminders** satellite pairs with N (S1).
- **ETH·E1 in S3 — the pivot.** Needs F1 (done) + IV2 (S2) + MEM (S1 RLS settled) + N (S1, grant/break-glass
  reminders). It **releases the m2 hard gate** — nothing downstream can hold real ethics data until E1's
  respondent-exclusion RLS is live.
- **S4 governance** all depend on S1–S3 primitives: E2 needs E1 + N + AI; RV2·R2–R5 need R1; CH needs N.
- **E3 last (S5), split.** E3a (terminology/UX/dashboards) has no external dep. **E3b (accreditation link)
  needs Phase 16** (deferred) — so E3b is gated on Phase 16 being re-planned + shipped (§9.1).

### Dependency matrix (→ = "must be gated before")

| Track | Hard deps (must precede) | Soft deps (better before) |
|---|---|---|
| **N** | — (consumers already shipped) | — |
| **MEM** | — | before ETH·E1, RV2·R2–R5 (RLS churn) |
| **SUP** | — | before more dashboard consumers |
| **RV2·R1** | RV2·R0 (design gate) | — |
| **RV2·R2–R5** | RV2·R1 | MEM (RLS), N (overdue chips consume nothing until N) |
| **IV2** | IV2·I0 (design gate) | — |
| **AI·sat / AI·ui** | AI hub (shipped) | N (reminders satellite) |
| **ETH·E1** | F1 (done), **IV2**, **MEM** | N (grant/expiry reminders) |
| **ETH·E2** | **ETH·E1**, **N**, **AI** hub | — |
| **ETH·E3a** | ETH·E2 | — |
| **ETH·E3b** | ETH·E2, **Phase 16** | — |
| **CH** | Meetings (done), Ph17 (done) | **N** (review reminders) |

---

## 2. Collision matrix — where two tracks touch one schema surface

Each row is a shared surface, the resolution, and the owning track. **This is the core of the plan** (mirrors
the Foundations Program §1). 🔴 = design-review-before-code; 🟢 = one-line plan + ack.

### X-α · `can_read_case` predicate — ETH·E1 × AI·ui × MEM  🔴
- **Collision:** three tracks touch the case-read predicate. **MEM** rewrites the membership predicate family
  it is built on; **ETH·E1** adds respondent-exclusion / recusal / explicit-grants-only / confidentiality
  terms; **AI·ui** already *consumes* it (`case_restricted` → `can_read_case(coalesce(source_case_id, case_id))`).
- **Resolution — strict order + R6 discipline:** **MEM lands first** (predicate family → `has_role()`,
  contracts verbatim). **Then ETH·E1** adds its terms **inside the DEFINER `can_read_case` over base tables**
  (ADR 0064 **R6** anti-recursion — never an RLS-gated `case_participants` read). AI·ui needs **no change** —
  its `case_restricted` arm rides whatever `can_read_case` resolves to. Flag-OFF fallback preserved at each step.
- **Owner:** MEM (predicate base) → ETH·E1 (terms). AI·ui conforms.

### X-β · Membership predicate family `is_*_of` — MEM × (every RLS-bearing track)  🔴
- **Collision:** MEM collapses ~30 `app.is_*_of` predicates into one `has_role()` family; **~145 policies**
  and every track's new RLS consume them.
- **Resolution:** WS-1 was built forward-compatible — the **RPC contracts + audit carry over verbatim**, so
  MEM is a **storage-shape** migration, not a security-model one. Sequence MEM in S1 before E1/RV2-governance;
  serialize `src/lib/queries/session.ts` + `members.ts` against any concurrent teammate (§7). Downstream tracks
  reference the **new** `has_role()`/`is_*_of` shims (MEM keeps the old names as thin wrappers to avoid a
  ~145-site churn in the same window).
- **Owner:** MEM. Open decision: fold `case_access` or keep it (§9.4).

### X-γ · `case_interviews` confidentiality + participant FK — IV2 × ETH·E1  🔴
- **Collision:** IV2's "Now" slice ships `case_interviews.confidentiality_level` **non-enforcing** and adds
  **no** `participant_id` FK; ETH·E1 makes confidentiality **enforcing** and adds the `participant_id` wiring
  (+ attendance, roles-M2M, topics, per-audience summaries — the "Defer→E1" bucket).
- **Resolution:** IV2 lands the inert columns with **English keys** and `relationship_to_case` **excluding
  patient/family** (staff-only, Rule 12) *precisely so* E1 adds enforcement + registry wiring **without a
  re-migration**. E1 owns the enforcement migration + the FK. **Do not** add a speculative `participant_id` in
  IV2 (ADR 0070 §Q10). IV2 precedes E1.
- **Owner:** IV2 (inert columns) → ETH·E1 (enforcement + FK + satellites).

### X-δ · One confidentiality taxonomy — F2 `confidentiality_label` × ETH·E1 `cases.confidentiality_level` × IV2  🔴
- **Collision:** F2 already shipped `attachments.confidentiality_label ∈ {non_phi_internal, phi_standard,
  phi_restricted, peer_review_confidential, legal_privileged, ethics_investigation, credentialing_sensitive}`.
  E1 adds a case-level confidentiality column; IV2 adds an interview-level one. Three divergent value-sets =
  exactly the duplication ADR 0065 §3 forbids.
- **Resolution:** **one taxonomy** (ADR 0065 §3). E1's `cases.confidentiality_level` and IV2's
  `case_interviews.confidentiality_level` **align to the F2 label set** (the shared vocabulary); E1's
  document-level confidentiality **extends the F2 `attachments` `confidentiality_label` + owner-dispatch
  reader** rather than a parallel grant table. Ratified in S0; applied at each track's Record step.
- **Owner:** S0 (align the value-sets) → IV2 / ETH·E1 conform.

### X-ε · `action_items` hub — AI·sat × ETH·E2 × CH  🟢
- **Collision:** AI·sat adds spoke tables; ETH·E2 sanctions/remediation create action items; CH's
  carry-forward **reads** `meeting_action_items` (hub `source_type='meeting'`).
- **Resolution:** AI·sat lands the spoke tables + reuses `can_read_action_item` verbatim; **E2 and CH are
  pure consumers** (no hub schema change). CAPA stays isolated (bridge = escalation, not a satellite table).
  Sequence AI before E2.
- **Owner:** AI·sat (tables) → ETH·E2 / CH consume.

### X-ζ · `compute_due_notifications()` scan arms — N × ETH·E2 × CH × AI·sat  🟢
- **Collision:** N's batch scans a fixed source list; E2 (ethics-notice deadlines), CH (charter review-due,
  "reunião em atraso" cadence) and AI·sat (reminders) each want to be a source.
- **Resolution:** N ships the **engine + the already-shipped sources** (CAPA/docs/indicators/signoffs/
  meetings). Each later track **adds its own scan arm** to `compute_due_notifications` when it lands (additive,
  idempotent). N does not wait on them; they do not fork the engine.
- **Owner:** N (engine) → E2 / CH / AI·sat add arms.

### X-η · `meetings` module — CH × ETH·E2  🟢
- **Collision:** CH computes cadence off `meetings.held_at` (ADR 0062) + reads `commission_meeting_settings`
  (quorum — **not** restated); ETH·E2's `ethics_hearings` adds a `meeting_type` to meetings.
- **Resolution:** different columns (CH reads `held_at`; E2 adds `meeting_type`) — no schema conflict. Both
  edit the meetings surface, so **serialize file edits** (§7). CH does **not** re-model quorum.
- **Owner:** CH (read-only on meetings) · ETH·E2 (adds `meeting_type`).

### X-θ · `responses` immutability + aggregation — SUP × Phase-15 indicators × dashboards  🟢
- **Collision:** SUP adds `responses.supersedes_id` + a latest-in-chain filter to **every submitted-answer
  rollup** (`dashboard.ts`, Phase-15 derived indicators).
- **Resolution:** the successor row carries the link; the **original submitted row is never mutated** (guards
  stay intact — cleaner than a `guard_submitted_response` carve-out). SUP owns the aggregation retrofit. **S0
  verifies** whether Phase-15 shipped supersession-tolerant (the column's absence implies **not** — the filter
  cannot exist yet), so SUP likely retrofits the indicator queries.
- **Owner:** SUP.

> **Only X-α/β/γ/δ are 🔴** (RLS + confidentiality correctness). They are resolved *here*, so the per-track
> reviews are conformance checks, not re-litigation.

---

## 3. Design spine — ratified at the S0 gate

S0 produces the missing ADRs/plans and records the cross-track contracts so S1–S5 build against a settled spine.

### 3.1 SQLSTATE block allocation (above the live high-water **HC098**; Referrals holds **HC0A0–HC0A9**)

| Track | Block (proposed; ratify at S0) |
|---|---|
| Referrals v2 (RV2) | **HC0A0–HC0A9** (already reserved by its plan) |
| Interviews v2 (IV2) | reuse `HC038`/`HC041` + **HC0B0–HC0B9** |
| Notifications (N) | **HC0C0–HC0C9** |
| Charters (CH) | **HC0D0–HC0D9** |
| Ethics E1 | **HC0E0–HC0E9** |
| Ethics E2 | **HC0F0–HC0F9** |
| Memberships §6.1 (MEM) | **HC0G0–HC0G9** |
| Supersession (SUP) | **HC0H0–HC0H9** |
| Action-items satellites (AI·sat) | **HC0I0–HC0I9** (AI·ui needs none) |

Every custom code maps to a pt-BR message in the data layer (Rule 8/10); raw Postgres never reaches the UI.

### 3.2 Feature-flag plan (mechanism: hand-maintained `FeatureFlags` interface + `get_feature_flags()` RPC)

| Flag | Track | Action |
|---|---|---|
| `case_referrals` (exists, OFF) | RV2 | reuse; keep OFF until pilot enable |
| `interviews` (exists, ON) | IV2 | reuse |
| `case_participants` + `case_types` (exist, OFF) | **ETH·E1** | **E1 flips both ON** (the m2 gate release) |
| `attachments` (exists) | ETH·E1 | reuse (doc-level confidentiality extends attachment reader) |
| `action_items` + `cases_extras` (exist, ON) | AI | reuse |
| `meetings`, `controlled_docs`, `audit_trail`, `quality_indicators` (exist, ON) | N, CH | reuse (consumers) |
| **`notifications`** | N | **create, seed OFF**, flip at gate |
| **`charters`** | CH | **create, seed OFF**, flip at gate |
| **`ethics`** | ETH·E2 (gates the procedure surface; E1 may introduce) | **create, seed OFF**, flip at gate |
| **`response_correction`** | SUP | **create, seed OFF**, flip at gate |
| — (none) | MEM | structural, no flag |

Convention: insert OFF in an early migration, flip ON via a **separate one-line migration at phase
completion**; `seed.sql` may force ON for local/E2E. Add each new flag to the hand-maintained
`src/lib/queries/feature-flags.ts` interface.

### 3.3 Cross-cutting conventions (recorded once)
- **R6 anti-recursion** (ADR 0064) — every participant-derived RLS term computed **inside** the DEFINER
  predicate over base tables. Applies to ETH·E1.
- **t19 grant rule** — every new `public.*` RPC: `revoke all … from public;` **then** `grant execute … to
  authenticated, service_role;` (DROP+recreate resets grants — re-issue both).
- **Flag-OFF fallback invariant** — each flagged track preserves byte-for-byte pre-track behavior when its
  flag is OFF.
- **One taxonomy** (X-δ), **one hub** (X-ε), **one notification engine** (X-ζ), **one membership door** (X-β).
- **Audit** — new verbs join `log_audit_access` allow-list + the `_audit_access_authorized` dispatch;
  metadata is PHI-free (records *that* + *who*, never payloads). Mutations emit via `app.audit_write`.

### 3.4 Specs still to author at S0 (ADR 0071 §Consequences)
1. **Ethics E1 ADR** (next free ≥ 0072) + E1 build plan (contract-first, like
   [case-access-control.md](../phases/case-access-control.md)). Must settle the M2 professional-erasure vs
   CFM-20yr-retention posture.
2. **Ethics E2 ADR** + E2 build plan (the procedure table set; CRM/CFM modeled explicitly).
3. **Ethics E3** — no new ADR (covered by 0064); a build plan + the E3a/E3b split decision.
4. **§6.1 scoped plan** (WS-1-style) — mandates **column-per-scope + shape CHECK** (dialect-1), the
   predicate-family collapse, and the `case_access` fold/keep decision.
5. **Supersession correction ADR** (small; ADR 0060 Gap 38 → shape (b) already ratified in ADR 0065 §8) —
   finalizes the `supersedes_id`/`supersede_response`/aggregation contract + UX.
6. **Action-items satellites spec** (ADR 0050 partner Ph 2–4) — *which* deferred satellites ship pre-pilot
   (recommended minimal set: **reminders + updates-feed + checklists**; §4).
7. **Already have specs** (no S0 authoring): RV2 (plan + ADR 0037 A1), IV2 (plan + ADR 0070), N & CH
   (accreditation-track.md), AI·ui (ADR 0050 F1).

---

## 4. Per-track build detail

> All migrations `backend`-owned, forward-only, timestamp windows starting **`20260720000000`+** (latest
> shipped = `20260719000800`). Contract-first: `backend` posts typed stubs before `frontend` starts. Each
> track = one Phase Gate (CLAUDE.md §6) unless noted. Full schema citations live in each track's source spec.

### S0 — Design & Sequencing Gate  *(design; no migration)*
- **Deliverables:** the six specs in §3.4; the SQLSTATE + flag + collision ratifications (§3.1–3.3); the
  Phase-16-before-E3b + `case_access` fold decisions; PROGRESS/PHASES/ADR-0071 pointers to this plan.
- **Gate:** lead + human sign-off on the spine + the 🔴 collisions (X-α/β/γ/δ). No build to test.
- **Unblocks:** all of S1.

---

### N — Phase 20 · Notifications & Escalation  *(flag `notifications`; SQLSTATE HC0C·)*
**Scope:** in-app notification center (bell + unread badge + per-user preferences) · **transactional email
route** (server-only, provider-abstracted — **not** GoTrue auth templates, which can't carry arbitrary bodies)
· scheduled **reminders + escalation** (unactioned-after-N-days → `staff_admin`).
**DB (all new; migration window `20260720…`):**
- `public.notifications` (`user_id`, `kind`, `commission_id`, `entity_type`/`entity_id`, `title`, `body`
  **pt-BR, PHI-free — Rule 12**, `read_at`, `created_at`) — **own-row RLS** (`user_id = auth.uid()`).
- `public.notification_preferences` (`user_id`, `commission_id`, per-channel/per-kind opt-in) — own-row RLS.
- RPCs (own-row): `mark_notification_read`, `mark_all_read`, `set_notification_preferences`.
- **`compute_due_notifications()`** DEFINER batch — scans the **already-shipped** sources (`list_signoff_queue`,
  `my_pending_meeting_signatures`, CAPA `overdue_actions` + `capa_action.due_date`, `documents_due_for_review`,
  indicator `frequency`-vs-latest-measurement) → enqueues notifications + email payloads; **idempotent** (no
  dup per due event); escalation arm (threshold → staff_admin). Later tracks add scan arms (X-ζ).
- **Scheduler:** pg_cron **or** an external cron hitting a server route (Coolify/Dockerfile makes the external
  scheduler viable). **pg_cron is not installed today** — S0/N decides. Email tests go through Mailpit (:54324);
  keep local `[auth.email.smtp] enabled=false` (memory `local-smtp-must-be-off-for-e2e`).
**Acceptance (E2E Mailpit-intercepted + pgTAP):** overdue-CAPA → in-app **and** email · mark-read clears badge
· a disabled kind produces **neither** channel · escalation fires after threshold · a user sees **only their
own** · the batch is **idempotent** · one keyboard pass · pgTAP: own-row RLS + `compute_due_notifications`
selects exactly the due set + idempotency + escalation threshold.
**Note (§9.3):** the ADR-0071 "break-glass access" consumer does not exist yet — substitute a
`case_access.expires_at` **expiring-grant** reminder.

### MEM — §6.1 · single `memberships` collapse  *(structural, no flag; SQLSTATE HC0G·)*
**Scope:** finish WS-1 by collapsing the role stack into one audited table + one door + one predicate family.
**DB (reset-OK drop-and-recreate; `20260720…`):**
- `public.memberships` (`id`, `principal_id`, **column-per-scope** `organization_id`/`hospital_id`/
  `commission_id`/`case_id?` + a discriminated **shape CHECK** [dialect-1, **not** a bare polymorphic
  `scope_id`], `role`, `granted_by`, `granted_at`, `expires_at`) replacing the **role rows** of
  `organization_members` + `commission_members` + `pqs_members` (`case_access` fold/keep = §9.4).
- One `grant_role()` / `revoke_role()` DEFINER door (authority + `_deny_self_grant` + audit, every path);
  one `has_role(scope_type, scope_id, role)` predicate family; the ~30 `app.is_*_of` predicates become thin
  **wrappers** over `has_role()` (keeps the ~145 call-sites compiling; X-β).
- Read/write path: `src/lib/queries/session.ts` (`getCommissionAccessByOrg`, `getNspAccessByOrg`,
  `CommissionRole`), `members.ts`, `members/actions.ts`, role-badge/member-list components.
**Acceptance (pgTAP + full E2E):** WS-1 invariants carry over **verbatim** (no direct write policy; self-grant
raises; every grant audited; anti-lockout on last org_admin) · one door / one predicate family · a direct
membership-table POST 401/403s · all appointment UIs still work · **full pgTAP + full E2E green** (risk is a
missed predicate regression — caught by negatives). **Serialize** against any track touching `session.ts`/
`members.ts` (§7).

### SUP — Supersession correction engine + UX  *(flag `response_correction`; SQLSTATE HC0H·)*
**Scope:** a controlled correction path for **standalone** submitted responses (`case_phase_id IS NULL`) —
today refill creates duplicate submitted rows that **both count** in dashboards/indicators.
**DB (`20260720…`):**
- `responses.supersedes_id uuid null references responses(id)` (self-FK) + partial-unique **one live successor
  per superseded row** + CHECK the successor shares `form_version_id`/`commission_id` (coherent aggregation).
- `supersede_response(p_response_id, p_reason)` DEFINER RPC — **standalone-only**, staff_admin/coordinator,
  audit-logged reason; creates a **new `in_progress` successor pre-linked** via `supersedes_id` (original row
  **untouched** — immutability guards intact); wizard edits + resubmits → latest-in-chain. Pattern:
  `reopen_narrative` + `supersede_document`.
- **Aggregation retrofit (load-bearing):** every submitted-answer rollup (`src/lib/queries/dashboard.ts` +
  Phase-15 derived indicators) filters to **latest-in-chain** (exclude any response pointed-to by a submitted
  successor). S0 verifies whether Phase-15 shipped tolerant (likely **not** — column absent).
- Audit verb `response.superseded` (state transition, **no** answer-level diffs — Gap 39 stays dropped).
**UX:** "corrigir envio" affordance on a standalone submitted response (staff_admin/coordinator; mandatory
reason) → pre-linked editable copy; badges superseded "substituído" / successor "atual". Ref
`supersede-document-button.tsx`.
**Acceptance (pgTAP + E2E + Vitest):** supersede a standalone submission → superseded row excluded from
counts, successor counted (aggregation parity) · case-wrapped response has **no** supersede affordance (case
phases cover it) · non-coordinator denied · original stays immutable · audit emits one `response.superseded`
with reason · flag-OFF = pre-SUP behavior.

---

### RV2 — Referrals v2  *(flag `case_referrals`; SQLSTATE HC0A·)* — R0 gate → R1 (S2), R2–R5 (S4)
Full detail: [referrals-v2-dialogue-governance.md](./referrals-v2-dialogue-governance.md). Extends (never
contradicts) the Phase-22 core (snapshot boundary · PHI single-door · QPS plane · hash-chained audit).
- **R0** *(design gate, no migration)* — ratify the SQLSTATE base, audit-verb set, and R1 typed stubs; the
  message/notes **PHI-gating** is the single 🔴 reviewed once here.
- **R1 · Dialogue Core (S2, pilot-critical)** — `referral_messages` (`sequence_number` UNIQUE, `message_type`,
  `body` **PHI-REVOKED**, R5-reserved redaction cols) + `case_referral += waiting_on_committee_id`,
  `last_message_at`, status `awaiting_information`. RPCs `post_referral_message` (HC0A0),
  `request_referral_information` (HC0A1), `provide_referral_information`; `get_referral_detail` extended (body
  nulled for metadata readers). RLS: messages SELECT = `can_read_referral_phi`, INSERT via RPC only. Audit
  `referral.message_created`; `dispose_referral_phi` purges bodies. **Acceptance:** seq concurrency → distinct;
  metadata reader → NULL body, PHI reader → body + one `referral.viewed`; `request`/`provide` set `waiting_on`
  + status; `close_case` blocks while `awaiting_information`; foreign-referral message rejected.
- **R2 · Triage/SLA (S4, PHI-free)** — `case_referral += priority`, `requested_action_id →
  referral_requested_actions` + label snapshot, `response_due_at`, `decline_reason_code`. Overdue = computed.
- **R3 · Resolution cycles (S4, 🔴 lifecycle)** — `referral_resolutions` (partial-unique one active) +
  status `answered`/`resolved` + `parent_referral_id`; **amends ADR 0037 D4/D5** (conclude→`answered`→
  `resolve_referral`→`resolved`; `close_case` release set → `NOT IN (completed,resolved,rejected,withdrawn)`).
  RPCs `resolve_referral` (HC0A5), `reopen_referral`, `create_referral_draft += parent`.
- **R4 · Responsibility/multi-link (S4)** — `referral_assignments` + `referral_case_links`; **invariant:
  assignment/link grant NO extra read** (pgTAP-locked).
- **R5 · Private notes/disclosure/hardening (S4, softest — trim to notes-only if window compresses)** —
  `referral_internal_notes` (**keystone RLS: readable only by the owning committee's participants for that
  referral, NEVER cross**) + context versions + read receipts + redaction (fills R1's reserved cols) +
  idempotency. QPS does **not** read internal notes by default (§9.5).

### IV2 — Interviews v2 · Sessions + Reporting/Confidentiality  *(flag `interviews`; one Phase Gate; SQLSTATE HC0B·)*
Full detail: [interviews-v2-sessions.md](./interviews-v2-sessions.md). **Hard-cut / forward-only** (drops
columns; reset-OK). Steps I0 (design) → I1 schema → I2 RPCs → I3 data-access (frozen contract) → I4 UI → I5
seed/pgTAP/E2E.
- **New `interview_sessions`** (1:N under `case_interviews`; `sequence_number` UNIQUE, `session_type`,
  `status`, `modality?`, `scheduled_*`/`actual_*`, `location_text`, `meeting_url`, `cancellation_reason`).
- **`case_interviews`:** DROP the 5 scheduling cols + `conducted_at`/`modality` (hard-cut); ADD
  `interview_category` (required), `confidentiality_level` (**non-enforcing** — X-γ), status `awaiting_follow_up`.
- **`case_interview_subjects.relationship_to_case`** (required; **excludes patient/family** — staff-only, Rule 12).
- RPCs: re-mapped `create/update/conclude/cancel_interview` (drop scheduling args, require category) + session
  RPCs (`schedule/update/start/complete/cancel/no_show_session`) + subject relationship. Registry stays **one**
  `case_events kind='interview'` row per interview. Audit `interview.session_*` + `.confidentiality_changed`.
- **Acceptance:** create→schedule→start→complete→add-follow-up (`awaiting_follow_up`)→conclude (registry
  event)→reschedule→cancel/no-show; subject relationship required; one keyboard path; registry stays one row.
- **Feeds E1:** ships confidentiality/relationship columns inert so **E1 adds enforcement + `participant_id`
  wiring + attendance/roles-M2M/topics/summaries** with no re-migration (X-γ).

### AI — Action-items satellites (item 9) + cross-link UI + `visibility_scope` toggle (item 10)  *(flags `action_items` + `cases_extras`; SQLSTATE HC0I·)*
One phase, two slices on the same components (do together — X-ε, §7).
- **AI·ui (mostly FE; backend already shipped):** surface the existing `visibility_scope`
  (`committee`/`case_restricted`/`assignees_only`) + `case_id` cross-link + the coordinator `p_visibility_scope`
  override in `case-action-item-form.tsx`, `action-items-table.tsx`, `meetings/action-item-form.tsx`; project
  `visibility_scope` in `queries/action-items.ts` + `case-action-items.ts` (thin read-plumbing). **No new RLS**
  — `can_read_action_item` + the default-restrict guard already exist.
- **AI·sat (spoke tables; recommended minimal set):** **reminders** (pairs with N — a due-source scan arm),
  **updates-feed** (`action_item_updates`), **checklists** (`action_item_checklists`). Each = new table (FK
  `action_item_id` CASCADE) + RLS reusing `can_read_action_item` + DEFINER `committee_*` RPCs + `action_item.*`
  audit verbs. CAPA stays isolated (not a satellite).
- **Acceptance:** a `case_restricted` item is hidden (title + history) from a non-case-reader; coordinator
  toggles committee↔restricted; a reminder satellite item surfaces via N; updates-feed/checklist CRUD gated to
  members; pgTAP RLS truth-table for each satellite + the visibility scopes.

---

### ETH·E1 — Ethics · Access spine  *(flips `case_participants`+`case_types` ON; SQLSTATE HC0E·)* **(new ADR ≥0072)**
**Scope:** make the generalized-subject layer **safe to hold real complaint data**, then release the m2 gate.
**DB:**
- `cases.confidentiality_level` (aligned to the F2 label taxonomy — X-δ); wire
  `case_types.default_visibility_policy` (exists) → the case's resolved visibility (snapshot at create).
- **`can_read_case` new terms (R6-safe, in the DEFINER over base tables):** (1) **respondent-exclusion**
  (deny if `uid = professional_profiles.user_id` linked via `professional_participants → case_participants`
  under a `respondent_doctor` role); (2) **recusal-exclusion** (`case_recusals`); (3) **explicit-grants-only**
  gate (drops the implicit "any commission member" read for ethics-typed cases); (4) **confidentiality ceiling**.
- New tables: `case_conflict_declarations` (COI), `case_recusals` (RLS-enforced); document-level confidentiality
  **extends the F2 `attachments` reader** (not a parallel grant table — X-δ).
- **Participant write authority** (the F1 carry-over): DEFINER RPCs `add_case_participant` /
  `remove_case_participant` / `set_primary_subject` / `set_case_participant_role` (matches the meetings/
  interviews/case-access DEFINER pattern; `case_participants` keeps SELECT-only RLS).
- **Interviews-v2 fold-in (X-γ):** `participant_id` FK on `case_interviews`/`_subjects`/`_interviewers`;
  make `confidentiality_level` **enforcing**; per-session **attendance** table; **participant-roles M2M**;
  `interview_topics`; versioned/per-audience `interview_summaries`.
- RPCs `declare_conflict` / `record_recusal` / `lift_recusal`; professional-profile writers. Decide the **M2
  professional-erasure vs CFM-20yr-retention** posture in the ADR.
- **E1 flips `case_participants` + `case_types` ON** — only after the checklist below is green.
**m2-flip checklist (gate keystones):** respondent-exclusion live · recusal + COI enforced in RLS ·
explicit-grants-only wired from `case_types` · confidentiality column + enforcement · real participant write
authority · pgTAP isolation negatives (respondent/recused user denied) · **then** flags → ON.
**Acceptance (pgTAP + E2E):** a respondent doctor who is a platform user, added `respondent_doctor` on their
own case → `notFound()` + absent from "Meus Casos" (though a commission member) · `explicit_grants_only`
member sees nothing absent a grant; granted member sees it · recused member loses read via RLS · a
`legal_privileged` document invisible to an ordinary reader, visible to a legal-grant holder · coordinator
writes a participant / a case *reader* cannot · interview subject resolves the same `participant_id` across
sessions, and `confidentiality_level` now **restricts** · flag-OFF byte-for-byte pre-E1 · audit: participant-
add / recusal / confidentiality-change each emit one row.

### ETH·E2 — Ethics · Procedure  *(flag `ethics`; SQLSTATE HC0F·)* **(new ADR)**
**Scope:** the disciplinary lifecycle. Some sub-objects may debut as narrative/form phases and **graduate to
tables** where deadlines/querying/defensibility demand (ADR 0064 guidance).
**DB (candidate table set):** `ethics_case_details` (1:1) · `ethics_allegations` (N) + `ethics_findings`
(1/allegation) · **`ethics_notifications`** (formal notices **with deadlines** → **N scan arm**, X-ζ) ·
`case_decisions` + `ethics_decision_details` (**model CRM/CFM explicitly**, not a generic board) · **`case_votes`**
(needs **E1 recusal** — a recused member cannot vote) · `ethics_hearings` (adds `meeting_type` to Meetings —
X-η) · `ethics_appeals`. Plus `form_responses.target_case_participant_id` (a "Respondent Statement" form
attaches to a participant) + case-phase assignment-role vocabulary. Ethics→CRM/CFM/legal hand-off **reuses ADR
0037 referrals** where it fits.
**Deps:** ETH·E1 (recusal + confidentiality + participant write) · N (notice deadlines) · AI hub (sanctions/
remediation action items). **Acceptance:** admissibility → notice (deadline reminder via N) → allegations/
findings → hearing (on a meeting) → vote (recused member excluded) → decision (sanction incl. CRM/CFM referral)
→ appeal; all confidentiality-gated (E1); every mutation audited; foreign-commission no read.

### ETH·E3 — Terminology/UX + accreditation link  *(no new ADR; SQLSTATE none/minimal)* — split E3a/E3b
**E3a (S5, no external dep):** wire the shipped `case_type_terminology` into the case UI (Ethics renders
*Denúncia / Médico denunciado / Cronologia processual*; M&M renders *Caso / Paciente / Linha do tempo*); seed
the Ethics `case_type` + terminology + role bundle; widen `case_events` kinds with procedural categories +
per-event visibility; ethics **dashboards** (counts, cycle-time, sanction outcomes). Thin DB (a `case_events`
kind widen + seed); mostly FE.
**E3b (S5, ⚠ needs Phase 16):** the **accreditation link** — an evidence link from an ethics **decision/CAPA**
row to a **Phase-16 accreditation standard** (rides the Phase-16 evidence substrate, driving the readiness/gap
report). **Gated on Phase 16 being re-planned + shipped** (§9.1). **Acceptance:** Ethics UI shows the
type-specific terminology; ethics dashboard renders; (E3b) an ethics decision links as evidence against a
standard and appears in the readiness report.

### CH — Phase 21 · Committee Charters & Meeting Cadence  *(flag `charters`; SQLSTATE HC0D·)*
**Scope:** charter (regimento) per commission + cadence-adherence + agenda carry-forward + charter-as-
controlled-document (JCI GLD).
**DB (all new; `20260720…`):**
- `public.commission_charters` (**`commission_id` PK, 1:1**; `purpose_md`/`scope_md`/`authority_md`/
  `membership_md` sanitized Markdown; `meeting_frequency ∈ {semanal,quinzenal,mensal,bimestral,trimestral}`;
  `effective_date`; `review_due_date`; nullable `controlled_document_id` → the `regimento` doc). RLS
  member-READ / staff_admin-WRITE (like `commission_meeting_settings`). **Quorum stays in
  `commission_meeting_settings` — the charter does not restate it** (X-η).
- `upsert_commission_charter` (staff_admin); **`meeting_cadence_status(commission)`** DEFINER — compliant / em
  atraso vs the **last `held` meeting's `held_at`** (ADR 0062, X-η) + `meeting_frequency`; `suggest_carry_forward
  (commission)` — open `meeting_action_items` + deferred `meeting_agenda_items` for the next `create_meeting`.
- Cadence is **computed, not stored**.
**Deps:** Meetings/Ph17/Ph13/action-items (all shipped) · **N** (charter review-due + "reunião em atraso" as
scan arms — soft; §9.1). **Acceptance:** monthly charter → **compliant** vs a recent meeting, **em atraso** when
stale (seeded dates) · new meeting auto-suggests carry-forward · charter renders as a controlled doc with a
review-due date · charter edits audited · foreign-commission no read · one keyboard pass.

---

## 5. Migration ownership & serialization (CLAUDE.md §4 — no two teammates touch one file per phase)

- **Independent surfaces (safe to interleave across stages):** N (`notifications*` tables + email route + cron),
  CH (`commission_charters` + meeting-cadence RPCs — read-only on `meetings`), SUP (`responses.supersedes_id` +
  aggregation), RV2 (`referral_*`), IV2 (`interview_*`).
- **Serialized surfaces (must not run concurrently):**
  - **MEM** rewrites `src/lib/queries/session.ts` + `members.ts` + the membership predicate family — **serialize
    against ETH·E1, RV2·R2–R5, CH** (all read those predicates). MEM lands and regens types **before** they start.
  - **ETH·E1 → ETH·E2 → ETH·E3** are strictly sequential (each consumes the prior's tables).
  - **AI·sat + AI·ui** share `action-items-table.tsx` / `case-action-item-form.tsx` — **one phase, one owner
    window**.
  - **ETH·E2 + CH** both edit the meetings surface (E2 adds `meeting_type`; CH reads `held_at`) — serialize the
    meetings-module file edits.
- **Remote deploy** is **user-authorized per track** (`supabase db push` / `db reset --linked` under reset-OK;
  background agents auto-denied). Local first (`supabase migration up`), regen types after every migration.

## 6. Testing & gates

- **Each track = one Phase Gate** (CLAUDE.md §6): build (lint 0/0 · tsc · Vitest) → tester full-suite green →
  qa review (`docs/reviews/…`) → human approval → Record (PROGRESS + backend-state + graphify `update .`).
- **pgTAP is the lock** for every RLS/RPC/integrity invariant; run on a **fresh reset** (memory
  `pgtap-needs-fresh-reset-vs-e2e-leftovers`); every new `public.*` RPC needs `REVOKE ALL FROM PUBLIC` before
  GRANT (t19 guard).
- **E2E** declared green via **`npm run e2e:prod`** (prod-standalone, batched, server-restart-per-batch); the
  **lead** runs the full suite as a background command (`--workers=1` + fresh `supabase db reset`; subagents
  stall on the watchdog — memory `e2e-gate-run-mechanics`). Email tests intercept **Mailpit :54324** (keep
  local SMTP OFF).
- **Keystone tests by track:** N (own-row RLS + idempotent compute + escalation) · MEM (WS-1 invariants
  verbatim + one-door + predicate-collapse negatives) · SUP (aggregation parity: superseded excluded) · RV2·R1
  (seq concurrency + body PHI-lockdown) · RV2·R3 (lifecycle + close-gate) · IV2 (session lifecycle + one
  registry row) · ETH·E1 (respondent/recusal/grants isolation negatives — the m2-flip gate) · CH (cadence
  across frequencies + carry-forward selection).

## 7. Risks & open decisions for the product owner

1. **⚠ Phase 16 blocks ETH·E3b.** The accreditation-link needs the deferred Standards-Crosswalk phase.
   **Options:** (a) re-plan + ship Phase 16 before S5; (b) ship **E3a** (terminology/dashboards) pre-pilot and
   defer **E3b** (accreditation link) until Phase 16 lands. **Recommend (b)** — it keeps the ethics UX pilot-
   ready without gating the whole track on a phase that itself needs replanning.
2. **RV2 pilot-enable decision.** Whether to flip `case_referrals` ON for the pilot at all. If not, RV2 defers
   to fast-follow (R1 is the pilot-critical piece; R2–R5 already scoped to slip). Same question for R3's
   terminal-lifecycle change vs keeping `completed`-for-all.
3. **⚠ Break-glass is a phantom Ph20 consumer.** ADR 0071 names "break-glass access" among N's consumers, but
   break-glass is **deferred/not built**. **Substitute** a `case_access.expires_at` expiring-grant reminder;
   a true break-glass alert waits on break-glass being designed (post-pilot).
4. **MEM `case_access` fold-or-keep.** Audit §6.1 lists `case_access` to fold, but it carries `level`/
   `expires_at`/`reason` (a richer ACL than a role). **Recommend keep** `case_access` as the per-case
   involvement plane and collapse only the three role tables — decided in the §6.1 scoped plan.
5. **RV2·R5 trim + QPS scope.** R5 is the softest tier (trim to notes-only if the window compresses); whether
   QPS oversight reads `referral_internal_notes` (default **no** — a deliberative scratchpad ≠ official record).
6. **AI satellite set.** Which deferred spokes ship pre-pilot (recommended minimal: **reminders + updates-feed
   + checklists**; the rest — related_records/reviews/follow-ups/dependencies/templates/custom_fields — stay
   deferred "until a feature needs them").
7. **SUP aggregation retrofit.** If Phase-15 did **not** ship supersession-tolerant (the missing column implies
   not), SUP must retrofit the indicator/dashboard rollups — a wider change than the RPC alone. S0 verifies.
8. **`ethics` flag ownership** — E1 or E2. **Recommend E2 owns `ethics`** (E1 releases the participant/case-
   type m2 gate; the *procedure* surface is E2's). E1 flips `case_participants` + `case_types` only.
9. **Effort (rough, reset-OK — all front-loaded to the gate, not production):** S0 ≈ 1–2 spec-days · N ≈ 4–6
   BE + 2–3 FE (new infra) · MEM ≈ 3–4 BE (wide but mechanical) · SUP ≈ 2–3 BE + 1–2 FE · RV2 ≈ 3–4 build-weeks
   (R1 ≈ 1wk) · IV2 ≈ 1–1.5 wk · AI ≈ 2–3 days (mostly FE) · ETH·E1 ≈ 5–7 BE (the heaviest — RLS + fold-in +
   m2 gate) · ETH·E2 ≈ 5–7 BE + 3 FE · ETH·E3 ≈ 3–4 (mostly FE) · CH ≈ 2–3 BE + 2 FE.

**Bottom line:** twelve initiatives, one design gate (S0) + five dependency stages. Two collision cores are
🔴 (the `can_read_case`/membership RLS chain X-α/β and the confidentiality-taxonomy/interviews-fold X-γ/δ),
resolved here so per-track reviews are conformance checks. The two hard ordering constraints are **MEM before
the RLS-heavy ethics/referrals-governance work** and **IV2 before ETH·E1**. Everything lands pre-pilot on a
disposable DB, dark behind flags where a flag exists; the pilot follows this whole block + the Coolify app
deploy + origin push (Phase 9 still gates the pilot).
