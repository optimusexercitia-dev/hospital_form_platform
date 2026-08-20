# ADR 0056 — PHI-disposal closure + narrowed erasure claim (DB-side complete, Storage retained)

**Status:** Accepted (planned) · **Date:** 2026-07-05 · **Feature:** Pre-Pilot DB
Hardening — WS-4 (C-6). The last critical. Completes DB-side PHI disposal across all three
entity graphs, adds the missing meeting-minutes path, closes the §6.4 path/decline leak,
and **narrows the erasure claim** to be truthful. Part of the pre-pilot program
([pre-pilot-db-hardening-program.md](../plans/pre-pilot-db-hardening-program.md) §1 WS-4);
triage in [external-db-audit-2026-07-evaluation.md](../reviews/external-db-audit-2026-07-evaluation.md)
§2 (C-6) + §6.4. Architecture Rule 11/12; the binding regime is LGPD + ANVISA/RDC + CFM
1821/2007 (ADR [0035](./0035-lgpd-anvisa-regulatory-posture.md)). **Supersedes the erasure
language** in the disposal-touching ADRs ([0030](./0030-patient-safety-phi-and-pqs-architecture.md),
[0037](./0037-inter-committee-case-referrals.md), [0038](./0038-case-patient.md),
[0052](./0052-nsp-per-hospital.md)) — those said "erased/disposed" without the DB-vs-Storage
distinction this ADR makes precise.

## Context

The three `dispose_*` RPCs were **materially incomplete**, so "patient erased" was not a
truthful claim. Verified per-graph:

- **`dispose_case_phi`** touched only `case_patient` + `case_narratives.body_md` +
  `case_events.body` + the flag. It LEFT INTACT: case-phase **`answers`** (patient-authored),
  `case_interviews.summary_md`, `case_interview_subjects.note`, `cases.label`,
  `case_documents.{title,description}`, `meeting_cases.{summary,decision}`, `case_events.title`.
- **`dispose_event_phi`** already walked event → triage → rca → capa well, but missed
  `rca_evidence.{title,citation_label}` and `rca_why_chains.root_text`.
- **`dispose_referral_phi`** was nearly complete; missed `referral_reply_attachment.title`.
- **`meetings.minutes_md`** (+ `meeting_agenda_items.*`) had **no disposal path at all**.
- **§6.4:** `get_referral_detail` returned `frozen_storage_path` — and, un-flagged,
  `decline_note` (PHI-classified) — to a **metadata-only (non-PHI) reader**.

## Decision

### 1 · Complete DB-side PHI disposal in every graph
- **`dispose_case_phi`** now also: **DELETEs** the case-phase `answers` (full LGPD erasure of
  patient-authored content — redact-in-place would leave the patient's choice pattern, which
  is still personal data; selections cascade via FK). The **institutional outcome
  survives**: `case_phases.result_id` / `result_computed_at` are stored and NOT recomputed on
  an answer delete (the only recompute trigger is `sync_case_phase_on_submit` on `responses`
  UPDATE), so the committee's categorical result is preserved — institutional, not personal.
  Also nulls `case_interviews.summary_md`; redacts `case_interview_subjects.note`,
  `cases.label` (closes the asymmetry — referral already redacts the identically-warned
  `subject`), `case_documents.{title,description}`, `meeting_cases.{summary,decision}`,
  `case_events.title`.
- **`dispose_event_phi`** gap-fill: `rca_evidence.{title,citation_label}`,
  `rca_why_chains.root_text`.
- **`dispose_referral_phi`** gap-fill: `referral_reply_attachment.title`.

### 2 · `dispose_meeting_minutes(meeting, reason)` — new, standalone, per-meeting
A meeting can discuss **many** cases (`meeting_cases UNIQUE(meeting_id, case_id)`), so
redacting a whole meeting's minutes on a single-case dispose would over-redact minutes about
other cases. Therefore meeting-minutes disposal is **decoupled**: `dispose_case_phi` only
redacts the case-scoped `meeting_cases.{summary,decision}`, never the meeting's own
`minutes_md`. The new coordinator-gated (`is_staff_admin_of(commission_of_meeting) OR
is_commission_admin_of`) one-shot RPC nulls `meetings.minutes_md`, redacts
`meeting_agenda_items.{description,discussion_notes,resolution}`, sets a new
`meetings.phi_disposed_{at,by,reason}` flag (HC056 on re-dispose), and emits a
`meeting_minutes.disposed` mutation audit row (via `audit_write`, which does NOT validate a
verb allow-list — so no C-4 dispatch-map entry; it is a mutation audit, not a read action).

### 3 · §6.4 leak
`get_referral_detail` now gates **both** `frozen_storage_path` **and** `decline_note` on
`v_can_phi` (the referral-PHI reader), matching the already-correct `frozen_body_md` gate.

### 4 · Storage retained — the NARROWED claim (the load-bearing decision)
**Rule-6 Storage immutability is kept: disposal does NOT delete bucket objects.** The
now-truthful claim is:

> **Disposal erases all DB-side PHI. Attachment blobs are retained, encrypted at rest,
> under the LGPD/ANVISA/CFM 20-year record-retention regime.**

Disposal is idempotent (one-shot, HC056) and keeps each function's existing authority gate.
The new redactions run under scoped `set local` GUC bypasses (`app.in_case_rpc`,
`app.in_narrative_rpc`, `app.in_interview_rpc`, `app.in_submit_rpc`, `app.in_meeting_rpc`,
`app.in_referral_rpc`) so the frozen/submitted-child guards don't block the erasure; all
reset at function exit.

## Consequences

- **The erasure claim is now truthful on the DB side.** Every PHI-classified column/table in
  each entity's graph is empty or redacted post-dispose (locked by pgTAP `197`).
- **FE follow-ups (logged):** (a) a `dispose_meeting_minutes` action + UI (none exists);
  (b) the disposal-confirmation copy MUST reflect the narrowed claim — **no "tudo apagado"
  over-claim**; it should say DB PHI is erased and attachments are retained encrypted under
  retention; (c) `decline_note` is now null to a non-PHI reader — if the source-commission
  decline-feedback view showed it to a non-PHI reader, the product needs a separate
  **non-PHI "motivo da recusa"** field (a broken decline-feedback E2E, if any, is a known gap,
  not a regression).
- **Deliberately NOT done:** Storage object deletion (Rule 6 / retention) — the claim is
  narrowed instead, per the locked user decision. A future "hard-delete blobs at
  retention-expiry" job is a separate, retention-clock-driven track, not pre-pilot.

## Amendment 1 — the meeting door's redaction set widens to its composition closure

**2026-08-20 · PO-approved · migration `20261002000400` · pgTAP `351` ·
closes `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT` · ADR 0129 amended in the same change.**

> **The sentences this contradicts.** §2 describes the door as one that "nulls
> `meetings.minutes_md`, redacts `meeting_agenda_items.{description, discussion_notes,
> resolution}`" — an accurate description of a set that was too small. More seriously it
> falsifies the flat claim in Consequences, "**Every** PHI-classified column/table in each
> entity's graph is empty or redacted post-dispose (locked by pgTAP `197`)", and §4's
> central claim, "**Disposal erases all DB-side PHI**". Both were untrue for the meeting
> lane from the day this ADR shipped. Suite `197` locked the columns the door touched;
> nothing ever asked about the columns it did not.
>
> **§2 is amended.** `dispose_meeting_minutes` now additionally redacts
> `meeting_agenda_items.title`, `meeting_attendees.{note, external_name, external_org}`,
> `meeting_closed_sessions.label`,
> `meeting_closed_session_items.{substance, decision, withdrawals}`, and nulls
> `meeting_minutes_jobs.{transcript, draft, result}` (stamping `purged_at`) — ten columns
> over the four it had. §4's narrowed erasure claim is unchanged in wording and is what
> the widening finally makes true. `DSR_RESIDUE_NOTICE`'s four lines are untouched, which
> was the point of widening the door rather than naming the columns as retained.
>
> ⭐ **A verbatim meeting transcript survived Art. 18 erasure — that is the finding; the
> fix was the easy part.** `apply_minutes_review`, `cancel_minutes_job` and
> `fail_minutes_job` all null `transcript`/`draft`/`result` and stamp `purged_at`, so the
> transcript is transient *by design* and an escalation that skipped this check would have
> been wrong. But only three of `audio_job_status`' six values purge. A job resting in
> **`done`** — transcribed, draft ready, awaiting human review, the ordinary resting
> state — kept the full record of everything said in the room indefinitely, as did
> `uploading` and `processing`. Nulled **unconditionally** rather than per-status: a
> predicate over the transition graph goes stale the next time a state is added, and
> "resting in `done`" is precisely the state nobody constructed. There is no UNIQUE on
> `meeting_minutes_jobs.meeting_id`, so every write is set-based across all of a meeting's
> jobs; none may become a `limit 1`.
>
> ### The three method notes, recorded because they generalise past this door
>
> ⭐ **(a) An empty census is not a finding — it can be an artefact of when you measured.**
> The first pass here was taken while a `supabase db reset` was rebuilding the database
> underneath it. `meeting_minutes_jobs` resolved in one query and "does not exist" seconds
> later, and the trigger census came back **EMPTY when there are 17 triggers**. An empty
> guard census reads exactly like "no guards here, safe to widen". Everything was
> re-derived as a single REPEATABLE READ snapshot bracketed by the migration count. *A
> measurement needs a stable subject, and a shared stack does not guarantee one.*
>
> ⚠ **(b) Free text is not a type.** The column census was first bounded by
> `text/varchar/citext` and so missed `meeting_minutes_jobs.{draft, result}` — **jsonb**
> columns carrying the generated minutes text. A type list is a syntax; the property is
> "a human's words end up here".
>
> ⭐ **(c) The raw FK closure is the wrong boundary — `NOT NULL + ON DELETE CASCADE` is
> the right separator.** Following every FK into `meetings` yields **25 tables** and drags
> in `capa_plan`, `action_items`, `rca_evidence`, `ethics_hearings` and `case_votes`,
> which merely *cite* a meeting and carry their own lifecycles and disposal owners. A
> child whose FK is `NOT NULL + CASCADE` cannot exist without its meeting: that is
> composition, and it is a catalog fact rather than a judgement. The closure is 9 tables.
> `action_items.source_meeting_id` is CASCADE but **nullable** — provenance, not
> composition, and correctly out.
>
> All three are the same family: *a boundary that looked principled and wasn't*. The
> filing's four-column list was itself an instance — it came from one census run for
> another purpose, and the property yields ten. The three it missed were structural rather
> than careless: `meeting_closed_session_items` keys on `closed_session_id`, so a census
> that stops at the meeting's direct children never sees it at all.
>
> ### What is deliberately RETAINED, and the obligation that creates
>
> PO ruled `meetings.title` **stays** — it is the meeting's identity in every list, and
> the residue notice promises the governance skeleton survives. But the rule this whole
> widening rests on is that a PHI-capable column may not be left both unredacted **and**
> unnamed. So the retained set is now **disclosed** by a new per-lane constant,
> `DSR_MEETING_RESIDUE_RETAINED` (`src/lib/dsr/messages.ts`), rendered beside — never
> merged into — the shared `DSR_RESIDUE_NOTICE`, which the referral and case lanes also
> render and for which a meeting-specific line would be false.
>
> Judged **PHI-capable and therefore disclosed**: `meetings.title`;
> `meeting_signatures.note`; `meeting_cases.{summary, decision}`; and the retained **audio
> recording** behind `meeting_minutes_jobs.audio_path`.
> Judged **not PHI-capable and therefore not disclosed**, per column rather than by
> assumption: `meetings.{status, modality, quorum_rule_type, visibility_policy,
> securable_type, phi_disposed_reason}` and `meeting_attendees.{role, attendance}` (all
> coded/enumerated, not free text); `meetings.{location_text, meeting_url}` (venue and
> conferencing metadata — free text, but not patient-referencing by design);
> `meeting_signatures.{method, status, content_hash, provider_ref, user_agent,
> provider_payload}` (signature-integrity evidence and signer *professional* identity —
> redacting it would weaken the legal validity of the signature the disposal is recorded
> under); `meeting_minutes_jobs.{service_job_id, error_code, error_message}` (service
> diagnostics). `meeting_closed_session_item_readers` has no text columns.
>
> ⚠ **CORRECTION, made before this amendment was acted on.** An earlier draft of this
> paragraph asserted that a retained title on a locked meeting has **NO product remedy**.
> That was **false**, and it was false for a nameable reason: it read `update_meeting`'s
> gate (`status ∈ {scheduled, held}`), observed that disposal targets locked meetings, and
> concluded that nothing reaches the gate — **without asking whether another door moves the
> meeting INTO the permitted state**. `reopen_meeting` does exactly that: it sets
> `meetings.status = 'held'`, which is inside `update_meeting`'s allowed set. *A gate tells
> you what it refuses; only the transition graph tells you what is reachable.* This is the
> same error as the transcript finding one level up — there, three purge doors made a column
> look permanent that was not; here, one reopen door made a column look permanent that is
> not.
>
> **The remedy is the revoke corridor the attested tier already documents**
> (`DSR_ATTEST_PROCEDURE_COMMON`): **reopen → edit → re-sign**. It is deliberate and
> expensive rather than free — `reopen_meeting` revokes every signature
> (`meeting_signatures.status = 'revoked'`) and bumps `meetings.revision`, and that epoch
> bump **invalidates registered prints** (ADR 0126 D9). It is the platform's one backwards
> door on `meetings.status`.
>
> ⚠ **The corridor is narrower than the disposal door in two measured ways**, which is why
> the original claim was not wrong everywhere — it was wrong *stated absolutely*:
>
> 1. **Two of the four locked states have no path at all.** `reopen_meeting` accepts only
>    `in_signature` and `signed`, while the child lock covers `in_signature`, `signed`,
>    `distributed` and `cancelled`. `app.guard_meeting_status`' transition list contains **no
>    arm whose `old.status` is `distributed` or `cancelled`**, and every writer — RPCs
>    included — must satisfy that list. For a distributed or cancelled meeting the title
>    genuinely cannot be changed by any door.
> 2. **The operator who may dispose may not be the one who may reopen.**
>    `dispose_meeting_minutes` gates on `is_staff_admin_of` **OR** `is_tenancy_admin_of`;
>    `reopen_meeting` gates on `is_staff_admin_of` alone.
>
> `DSR_MEETING_RESIDUE_RETAINED` therefore still states the retention as a fact and does not
> promise a fix, because for two of the four states there is none and for the other two the
> operator reading it may not hold the role. Whether the copy should additionally point a
> `staff_admin` at the corridor is a product call, referred rather than taken here.
>
> ⚠ **`meeting_cases.{summary, decision}` stay out, re-confirmed against §2 rather than
> assumed.** One meeting discusses many cases, so a meeting-wide redaction would
> over-redact other cases' text; they remain `dispose_case_phi`'s, per case. **The
> asymmetry this leaves is stated rather than left to be discovered:** those columns *are*
> part of "a ata inteira desta reunião", so the meeting door's copy remains marginally
> wider than its reach even after this change. Pinned by `351` t25 so that widening it
> later is a decision someone makes rather than a side effect.
>
> ### The correctness trap, and a keystone that was vacuous when first written
>
> ⭐ `meeting_attendees_identity_xor` requires an *internal* attendee
> (`user_id is not null`) to keep `external_name` **NULL**. A blanket
> `set external_name = v_redacted` therefore violates the CHECK and aborts the **entire**
> disposal — a legal obligation failing closed on every meeting that had an internal
> attendee, which is all of them. The door's `case when … is not null` branches are
> load-bearing for correctness, not merely for data hygiene. The constraint is invisible
> in a column list; it was read from `pg_constraint`.
>
> ⚠ **The keystone protecting it was vacuous, and only the mutation run said so.** It
> first asserted "no row has both `user_id` and `external_name`". Under the
> unconditional-redaction mutation the CHECK raises, everything rolls back, the fixture is
> unchanged — and an unchanged internal attendee still has a NULL `external_name`: the pin
> stayed **GREEN while the door was completely broken**. It was asserting a property the
> constraint guarantees structurally, which no mutation can falsify. It is now a
> differential: the row must have been *touched* (its `note` redacted, proving it was in
> the UPDATE's scope) *while* `external_name` stayed NULL.
>
> ### Verification
>
> pgTAP `351`, **33** assertions (its declared `plan()`) on a **locked** meeting with every child table populated —
> the fixture discipline ADR 0129 established, because a `scheduled` or `held` fixture
> fires neither child-lock guard and would pass while the door is broken for every real
> disposal. Every redaction pin is paired with a **sibling-meeting survival control**, so
> none is satisfiable by `delete from <table>` or by an unfiltered `update … where true`.
> All 17 mutation probes were confirmed RED before restore, with an anchor-uniqueness
> guard and a live-body hash checked in both directions.
>
> **Not changed:** the door's signature, authority gate, reason allow-list, HC056 one-shot
> semantics, audit row, and **ACL**. `CREATE OR REPLACE FUNCTION` does not reset an ACL;
> the live grants were diffed from `pg_proc.proacl` before and after and no GRANT
> statement appears in the migration.
>
> **Still bounded by their original lists:** `dispose_case_phi`, `dispose_event_phi` and
> `dispose_referral_phi` have **not** had this property applied to them
> (`FUP-DOOR-ERASURE-FREETEXT-CENSUS`; `capa_action.title` is already a known survivor on
> the event lane). This amendment makes the meeting lane truthful, not the other three.
