# Interviews v2 — Sessions + Reporting/Confidentiality — build plan

**Status:** PLANNED (design accepted by the product owner 2026-07-12; not implemented).
**Owner:** platform lead → `backend` (+ `frontend` per named UI, `tester` for E2E).
**Track:** pre-pilot revision of the shipped **Phase-11 Interviews** module (flag `interviews`).
**Posture:** pre-pilot, **reset-OK** — no live interview data yet, so the structural change is a
**hard-cut / forward-only** migration (drop the moved columns; no back-compat), folded into the
final pilot reset (memory `prelaunch-db-reset-ok`).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 2 (canonical schema — extend, never
contradict), Rule 9 (data access via `src/lib/queries`), Rule 10 (pt-BR UI / English
code+keys), Rule 11 (append-only audit), Rule 12 (PHI isolation — **interviews stay staff-only,
non-PHI**).
**Sources:** ADR [0070](../decisions/0070-interview-data-model-v2-sessions.md) (the decision
record) · partner handoff
[interview_data_model_handoff.md](../design/temp/interview_data_model_handoff.md). Three-bucket
disposition below (§1) is the committed evaluation.

---

## 0. Why

Pilot testing surfaced the one thing the shipped model cannot do: **more than one encounter per
interview**. Scheduling is stored on single columns of `case_interviews`, and the lifecycle
(`draft → scheduled → in_progress → completed`) is driven by them — so a reschedule or a
follow-up session forces a *new interview row*, splitting subjects, summary, attachments, and
links across artificial records. A partner team's from-scratch model was evaluated
feature-by-feature; this plan implements the **Now** bucket and records (for builders) the
**Defer (E1)** and **Avoid** buckets. The Phase-11 security core — case-scoped RLS, the
participant-write grant (`can_write_interview`), the single `case_events` registry footprint,
staff-only/no-PHI — is **extended, never contradicted**.

**Scope in:** sessions (N3, comprehensive) + `interview_category` (N1) + `relationship_to_case`
(N2) + a non-enforcing `confidentiality_level`, sequenced I1→I5 behind a design/contract gate
I0. **Scope out:** everything in §5.

---

## 1. Three-bucket disposition (summary — full rationale in ADR 0070 / the handoff)

| Tier | Items |
|---|---|
| **Now** | **`interview_sessions`** 1:N (comprehensive) + hard-cut of the 5 scheduling columns; `awaiting_follow_up` state · `interview_category` (N1) · subject `relationship_to_case` (N2) · non-enforcing `confidentiality_level` |
| **Defer → E1** | participant-registry wiring (`participants`/`professional_profiles`) · access grants + confidentiality **enforcement** · per-session **attendance** · participant-roles M2M · `interview_topics` · versioned/per-audience summaries · `interview_status_history` table · document semantic-role · org/hospital denorm |
| **Avoid** | column-level `*_encrypted` (contradicts our ADR) · recording/consent/transcripts + segments · statements · interview-specific findings (duplicate case RCA/CAPA) · external-access-link portal |

**Already satisfied (no work):** Forms reuse (`form_version_id`) · Documents (shared
`attachments`, `owner_type='interview'`) · audit (`audit_log`) · "findings" (case RCA/CAPA) ·
registered-or-external participants (nullable `user_id` + `external_*`).

---

## 2. Design spine — cross-cutting rules every phase conforms to

1. **Reset-OK hard-cut.** The migration **drops** `scheduled_start`, `scheduled_end`,
   `conducted_at`, `location_text`, `meeting_url`, `modality` from `case_interviews` and
   recreates them on `interview_sessions`. No dual-write, no back-fill of live rows (there are
   none) — only the **seed** is rewritten. All changes fold into the final pilot reset.
2. **Interview = lifecycle coordinator; session = encounter.** The interview owns the status;
   sessions own scheduling + a session status. Full state machine in **§4**. `conclude` /
   `reopen` / `cancel` stay **interview-level** acts; `schedule` / `start` / `complete` /
   `cancel` / `no_show` are **session** commands that update the interview status as a
   side-effect. **One** `case_events` registry row per interview, unchanged — body recomposed
   from session actuals.
3. **RLS mirrors the incumbent interview-child pattern.** `interview_sessions` keys on
   `interview_id`; its policies are a **copy of the current `case_interview_subjects`
   policies**, resolved through the session's `interview_id`:
   - **SELECT** = the case-scoped read rule (`can_read_case` via the interview, per migration
     `20260713001200_case_interviews_case_scope_read`) — *mirror the sibling as it exists at
     implementation time* (baseline text is stale on this point).
   - **WRITE** = `app.can_write_interview(interview_id, auth.uid()) OR
     app.is_org_admin_of_commission(app.commission_of_interview(interview_id))`.
   - Add thin helpers `app.commission_of_session(uuid)` and `app.assert_session_writable(uuid)`
     (wrap the interview equivalents via `interview_id`) so policies/RPCs stay readable. No new
     security surface — sessions are exactly as reachable as their interview.
4. **Audit (Rule 11).** New verbs on `log_audit_access` + its `_audit_access_authorized`
   dispatch: `interview.session_scheduled`, `.session_rescheduled` (carries the old→new summary
   line — this *is* the schedule-history), `.session_started`, `.session_completed`,
   `.session_cancelled`, `.session_no_show`, `.confidentiality_changed`. Category-at-create
   rides the existing `interview.created`; PHI-free metadata only. **Every new `public.*` RPC
   does `REVOKE ALL … FROM PUBLIC` before `GRANT authenticated, service_role`** (memory
   `new-public-rpc-revoke-from-public` — the t19 pgTAP guard).
5. **Enum convention (Rule 10 / ADR 0069).** New enums (`session_type`, session `status`,
   `interview_category`, `relationship_to_case`, `confidentiality_level`) use **English keys** +
   pt-BR label maps; the interview `status` union gains **`awaiting_follow_up`**. `modality`
   keeps its existing pt-BR keys (`presencial/remoto/hibrido`) and moves verbatim to the
   session (now **nullable** — a `written_response`/async session leaves it null).
6. **No PHI change (Rule 12).** Interviews remain **staff-only** and non-PHI: `relationship_to_case`
   excludes `patient`/`family_member`; `confidentiality_level` is a **non-enforcing** tag (the
   picker carries pt-BR helper text stating it does not restrict access yet — enforcement is
   E1). No new bucket, no audited PHI door, no `patient_identifiers` linkage.
7. **SQLSTATE block.** Interviews already own `HC021` (interviewer membership), `HC038`
   (invalid status transition), `HC041` (min-subject-to-conclude). **Reuse** `HC038` for all new
   session/interview transition guards and `HC041`-style for session prerequisites where
   semantics match; claim a **small contiguous block above the live high-water** for genuinely
   new errors — confirm the base at I0 (contiguous, above the current max, **not** colliding
   with referrals-v2's reserved `HC0A0–HC0A9`).
8. **Flag.** All v2 tables/RPCs stay behind the existing **`interviews`** flag
   (`assert_interviews_enabled()` in every write RPC; `interviews_enabled()` read gate).
9. **Contract-first + file ownership.** `backend` posts the typed contract (I3 stubs in
   `src/lib/interviews/{types,actions}` + `queries/interviews.ts`) **before** `frontend` starts
   I4. Two teammates never edit one file in a phase; shared types change only via `backend`.

---

## 3. Phased sequence

> All backend phases: `backend`-owned migrations, forward-only (reset-OK), sequential timestamp
> windows after the current max (`2026072x…`). One Phase Gate for the whole revision (CLAUDE.md
> §6): build → tester → QA → human → record.

### I0 — Design & contract gate  *(design; no migration)*
- **Deliverable:** this plan + ADR 0070 + PROGRESS/PHASES rows (done at planning). Ratify: the
  SQLSTATE base (§2.7), the audit-verb set (§2.4), the final enum value lists (§I1), and the I3
  typed-contract stubs.
- **🔴 review focus:** the **lifecycle state machine (§4)** and the **`interview_sessions` RLS**
  — the two load-bearing pieces; reviewed once here so I1–I4 are conformance, not
  re-litigation.
- **Gate:** lead + human sign-off. **Unblocks:** I1.

### I1 — Schema, RLS, generated types  *(backend; flag `interviews`)*
- **New `public.interview_sessions`:**
  - `id uuid pk`, `interview_id uuid not null references case_interviews(id) on delete cascade`,
    `sequence_number int not null`, `session_type text not null`, `status text not null default
    'scheduled'`, `modality text null`, `scheduled_start timestamptz null`, `scheduled_end
    timestamptz null`, `actual_start timestamptz null`, `actual_end timestamptz null`,
    `location_text text null`, `meeting_url text null`, `cancellation_reason text null`,
    `created_at timestamptz not null default now()`, `created_by uuid references profiles(id)`,
    `updated_at timestamptz not null default now()`.
  - **CHECKs:** `session_type ∈ {initial, follow_up, clarification, written_response,
    supplementary, closing}`; `status ∈ {scheduled, in_progress, completed, cancelled,
    no_show}`; `modality is null OR modality ∈ {presencial, remoto, hibrido}`;
    `scheduled_end is null OR scheduled_start is null OR scheduled_end >= scheduled_start`;
    `actual_end is null OR actual_start is null OR actual_end >= actual_start`;
    `status <> 'completed' OR actual_start is not null`.
  - **Uniqueness / index:** `unique (interview_id, sequence_number)`;
    `interview_sessions_interview_seq_idx (interview_id, sequence_number)`.
  - **RLS:** enable; SELECT + WRITE policies per §2.3. `D10`-style `updated_at` touch trigger.
- **`case_interviews` changes:** **DROP** `scheduled_start`, `scheduled_end`, `conducted_at`,
  `location_text`, `meeting_url`, `modality`. **ADD** `interview_category text not null`
  (no default — RPC-enforced), CHECK `∈ {witness, subject, clinical_team, expert, complainant,
  respondent, administrative, other}`; **ADD** `confidentiality_level text not null default
  'standard'`, CHECK `∈ {standard, restricted, highly_restricted}`. Widen `status` CHECK with
  **`awaiting_follow_up`**.
- **`case_interview_subjects` change:** **ADD** `relationship_to_case text not null` (no default
  — RPC-enforced), CHECK `∈ {attending_physician, consulting_physician, nurse,
  other_professional, witness, complainant, respondent, subject, expert, committee_member,
  other}`. Keep `clinical_role` (free text).
- **Helpers:** `app.commission_of_session`, `app.assert_session_writable` (§2.3).
- **Types:** regenerate `src/lib/types/database.ts`.
- **Owner:** `backend`. **No UI in this phase.**

### I2 — RPC surface  *(backend; DEFINER, REVOKE→GRANT)*
- **Re-mapped interview RPCs:**
  - `create_interview(p_case_id, p_title, p_case_phase_id, p_interview_category,
    p_confidentiality_level default 'standard')` — **drops** all scheduling args; **requires**
    `interview_category`; creates the interview in `draft`.
  - `update_interview(p_interview_id, p_title, p_case_phase_id, p_interview_category,
    p_confidentiality_level)` — **drops** scheduling args; category/confidentiality editable;
    emits `interview.confidentiality_changed` when the level changes.
  - `conclude_interview` — widen the precondition to `status ∈ {in_progress,
    awaiting_follow_up}` (was `in_progress` only); keep the **≥1 subject** guard (HC041); **read
    sessions** (count + earliest/latest `actual_start`) to recompose the `case_events` body;
    `→ completed`. Registry upsert/reopen behaviour unchanged.
  - `reopen_interview` — `completed → in_progress` (unchanged).
  - `cancel_interview` — `→ cancelled`; **cascade**: set every non-terminal session
    (`scheduled`/`in_progress`) to `cancelled` (reason = "entrevista cancelada").
- **New session RPCs** (all: `assert_interviews_enabled` + `assert_session_writable`/
  `assert_interview_writable`, `set_config('app.in_interview_rpc',…)` guard like the incumbents):
  - `schedule_session(p_interview_id, p_session_type default null, p_modality, p_scheduled_start,
    p_scheduled_end, p_location_text, p_meeting_url)` — auto-assign `sequence_number`
    (`max+1`); default `session_type` (`initial` for seq 1, else `follow_up`); insert `status
    'scheduled'`; flip interview `draft → scheduled`. Emit `interview.session_scheduled`.
  - `update_session(p_session_id, …same fields…)` — reschedule/edit in place while the interview
    is non-terminal; when times change, emit `interview.session_rescheduled` **with the
    old→new summary line** (§2.4 — this replaces a schedule-history table).
  - `start_session(p_session_id)` — `scheduled → in_progress`, set `actual_start = now()`; flip
    interview `{scheduled, awaiting_follow_up} → in_progress`. Emit `interview.session_started`.
  - `complete_session(p_session_id, p_actual_end default now())` — `in_progress → completed`;
    flip interview `→ awaiting_follow_up` **iff** another `scheduled` session exists, else leave
    `in_progress`. Emit `interview.session_completed`.
  - `cancel_session(p_session_id, p_reason)` / `no_show_session(p_session_id, p_reason)` —
    terminal session states (+reason). A session with a non-null `actual_start` is
    cancelled/no_show, **never hard-deleted**. Emit `.session_cancelled`/`.session_no_show`.
- **Subject RPCs:** `add_interview_subject(… , p_relationship_to_case)` **required**;
  `update_interview_subject` gains the same arg. (`add/remove/update_interview_interviewer`
  unchanged.)
- **Transition guards:** invalid transitions raise `HC038`; missing prerequisites the §2.7
  block. Written/async: `start_session` sets `actual_start` = receipt time; `complete` allowed
  directly per product note.
- **Owner:** `backend`. **Deliverable also includes the I3 typed contract** (below) posted
  before I4.

### I3 — Data access + server actions  *(backend; the frozen contract)*
- **`src/lib/queries/interviews.ts`:**
  - New unions: `InterviewCategory`, `InterviewConfidentiality`, `RelationshipToCase`,
    `SessionType`, `SessionStatus`; extend `InterviewStatus` with `awaiting_follow_up`.
  - New `InterviewSession` interface + `listInterviewSessions(interviewId)` read (ordered by
    `sequence_number`).
  - `InterviewListItem`/`InterviewDetail`: **remove** `scheduledStart/End`, `conductedAt`,
    `locationText`, `meetingUrl`, `modality`; **add** `interviewCategory`,
    `confidentialityLevel`, and a derived `nextSession` summary (earliest upcoming
    `scheduled` session) for the list subtitle + header. `InterviewSubject` gains
    `relationshipToCase`.
- **`src/lib/interviews/actions.ts`:** server actions for the new/changed RPCs
  (`scheduleSession`, `updateSession`, `startSession`, `completeSession`, `cancelSession`,
  `noShowSession`; updated `createInterview`/`updateInterview`/`addSubject`). The
  create-then-schedule UX = one action calling `create_interview` then `schedule_session`.
- **Labels:** `src/components/interviews/interview-labels.ts` gains pt-BR label maps for
  category, confidentiality, session-type, session-status, relationship (keys English).
- **Owner:** `backend`. **Gate to unblock I4:** stubs merged, `tsc` green.

### I4 — UI  *(frontend; after the I3 contract lands)*
- **New:** `sessions-panel.tsx` (list a interview's sessions with per-session status badges +
  actions), `session-form.tsx` (schedule/reschedule dialog: type, modality, start/end, location,
  meeting_url), session lifecycle controls (start / complete / cancel / no-show).
- **`interview-form-dialog.tsx`:** split — the **create** form collects title, **`interview_category`
  (required)**, case phase, `confidentiality_level` (with the **non-enforcing helper text**);
  scheduling moves into "add first session" (calls the combined action).
- **`interview-lifecycle-actions.tsx`:** re-wire — interview-level controls = conclude / reopen
  / cancel; schedule/start now live on sessions. Render the new **`awaiting_follow_up`** badge.
- **`subject-form.tsx` / `subjects-panel.tsx`:** add the **`relationship_to_case` picker
  (required)**; keep the free-text `clinical_role`; show the relationship label.
- **`interview-header.tsx` / `interviews-panel.tsx` / `interview-badges.tsx`:** show category +
  confidentiality (badge + tooltip) + the **next-session** summary (replacing the old single
  `scheduledStart`); add session-status badges.
- **A11y:** labels/keyboard nav/visible focus on every new control (tester covers one
  keyboard-only path). **Owner:** `frontend`.

### I5 — Seed, tests, gate  *(backend seed/pgTAP; tester E2E)*
- **Seed (`supabase/seed.sql`, ~L1060–1130):** move the fixture's scheduling into an
  `interview_sessions` insert (one completed + one scheduled session → exercises
  `awaiting_follow_up`); add `interview_category` + `confidentiality_level` to the interview
  row; add `relationship_to_case` to each subject insert. Keep the registered-interviewer write
  grant coverage.
- **pgTAP (`supabase/tests/121_interviews.sql`):** table/columns/CHECKs/uniqueness;
  `interview_sessions` RLS NEG/POS (member read, non-member `0`, writer vs non-writer);
  **REVOKE guards** for every new RPC (t19-style); transition NEG/POS (schedule from non-draft,
  start from non-scheduled, complete from non-in_progress, conclude min-subject + widened
  precondition, `awaiting_follow_up` derivation); `interview_category`/`relationship_to_case`
  NOT-NULL; `confidentiality_level` default; **registry stays one row per interview**.
- **E2E (`e2e/phase11-interviews.spec.ts`):** full flow — create (category required +
  confidentiality picker shows the non-enforcing copy) → schedule session → start → complete →
  add follow-up (badge `awaiting_follow_up`) → conclude (registry event) → reschedule a session
  → cancel/no-show → subject relationship required. One keyboard-only path.
- **Docs:** update `docs/backend-state.md` (new table + RPC surface), PROGRESS/PHASES rows,
  rotate at Record.
- **Gate:** full `npm run e2e:prod` green; QA review; human approval; `phase(11-v2): complete`.

---

## 4. Lifecycle state machine (the load-bearing contract)

**Interview status:** `draft → scheduled → in_progress ⇄ awaiting_follow_up → completed`; any
non-terminal → `cancelled`.

| Command | Level | Precondition | Effect on session | Effect on interview |
|---|---|---|---|---|
| `create_interview` | interview | — | — | `→ draft` (category required) |
| `schedule_session` | session | interview ∈ {draft, scheduled, in_progress, awaiting_follow_up} | insert `scheduled` (seq `max+1`) | `draft → scheduled` |
| `update_session` | session | interview non-terminal; session not terminal | edit times/fields | — (audit `session_rescheduled`) |
| `start_session` | session | session `scheduled` | `→ in_progress`, `actual_start=now` | `{scheduled, awaiting_follow_up} → in_progress` |
| `complete_session` | session | session `in_progress` | `→ completed`, `actual_end` | `→ awaiting_follow_up` iff another `scheduled` exists, else stay `in_progress` |
| `cancel_session` / `no_show_session` | session | session not `completed` | `→ cancelled/no_show` (+reason) | — |
| `conclude_interview` | interview | status ∈ {in_progress, awaiting_follow_up} **and** ≥1 subject | — | `→ completed`; write **one** registry event |
| `reopen_interview` | interview | status `completed` | — | `→ in_progress` |
| `cancel_interview` | interview | status non-terminal | cascade non-terminal sessions `→ cancelled` | `→ cancelled` |

Edge rules: cancelling the last non-terminal session does **not** auto-revert the interview to
`draft` (add another session instead). Sessions are editable only while the interview is
non-terminal (reopen to edit). A session with `actual_start` is never hard-deleted.

---

## 5. Deferred (E1) & Avoided — recorded for builders

**Deferred to E1 (post-pilot):** each lands when the `participants`/`professional_profiles`
registry flips on. Wiring interview subjects/interviewers to `participant_id` is E1's
migration — **do not** add a speculative FK now (§ Q10 decision). Access grants +
**confidentiality enforcement**, per-session **attendance** (wants the unified participant
row), participant-roles M2M, `interview_topics`, versioned/per-audience `interview_summaries`,
a first-class `interview_status_history` table (audit_log covers it), document semantic-role,
and org/hospital denorm all follow.

**Avoided entirely:** column-level `*_encrypted` (contradicts ADR 0035/0037/0038 —
platform at-rest encryption); recording/consent/transcripts + segments; statements
(evidentiary quote extraction); interview-specific **findings** (duplicate case RCA/CAPA — an
interview *feeds* the case's analysis, it does not grow its own); the **external-access-link
portal** (largest new auth surface, out of pilot scope).

---

## 6. Risks & open items

- **Blast radius on a green feature.** ~14 components + a 769-line action layer + the RPC set
  are woven around the dropped columns. Mitigation: the I3 contract-first freeze, the §4 state
  machine as the single conformance reference, and a full E2E re-run (not just the phase spec).
- **`confidentiality_level` foot-gun.** A non-enforcing tag must never *read* as access control.
  Mitigation: mandatory pt-BR helper text on the picker + a muted (not alarming) badge; QA
  checks the copy. Enforcement is E1's job.
- **SQLSTATE base** (§2.7) — confirm at I0 against the live high-water; avoid referrals-v2's
  reserved `HC0A0–HC0A9`.
- **`awaiting_follow_up` derivation** is the only "magic" — a side-effect inside
  `complete_session`. Keep it there (not a trigger) so the transition is auditable and testable.
- **Open (product):** the exact pt-BR labels for the new enums (I0 sign-off) and whether the
  pilot enables `disciplinary`/`follow_up`/`family` categories (currently out — §1/N1).
