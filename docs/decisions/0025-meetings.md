# ADR 0025 — Meetings (scheduling, minutes/ata registry, internal e-signatures)

**Status:** Accepted (2026-06-15) · **Phase:** 10 · **Relates:** [0017](0017-multi-phase-cases.md)
(minting trigger + state-machine guard + `in_*_rpc` flag), [0016](0016-signoff-definer-read-path.md)
(sign-own-row DEFINER predicate), [0024](0024-case-model-adjustments.md) (conclude-validate-snapshot
pattern, vocabulary CRUD).

> The plan referenced "ADR 0021"; that number was already taken
> (`0021-phase-due-dates.md`), so the meetings ADR is **0025** (next free).

## Context

Hospital committees hold **meetings** and today have no way to schedule them or register
what comes out of them — minutes (ata), agenda, attendance/quorum, cases discussed, action
plans, attachments — nor to record that the participants approved the minutes. Meetings are
the third pillar alongside forms and cases. **No patient data:** a meeting is a system-minted
per-commission `meeting_number`, a title, schedule, and free-text minutes.

## Decision

A `meetings` header drives a **6-state lifecycle** `agendada → realizada → em_assinatura →
assinada → distribuida` (plus `cancelada`), enforced by `app.guard_meeting_status` (the
`guard_case_status` pattern, gated by the `app.in_meeting_rpc` session flag the RPCs set).
Children: `meeting_agenda_items` (ordered), `meeting_attendees` (platform user XOR external
guest), `meeting_cases` (junction, same-commission guard → HC032), `meeting_signatures`,
`meeting_attachments` (private bucket, immutable objects, soft-delete rows), and
`meeting_action_items` (mirror `case_action_items`, denormalized `commission_id`). Per
commission: `commission_meeting_types` (vocabulary, seeded Ordinária/Extraordinária) and a
single `commission_meeting_settings` (the configurable quorum rule).

Key choices and their rationale:

1. **Conclude is the single "held → signature" action.** The lifecycle is
   `agendada → realizada → em_assinatura`, but there is no separate "mark held" UI/contract.
   `conclude_meeting` therefore accepts **`agendada` OR `realizada`** and, from `agendada`,
   steps through `realizada` under the flag before the conclusion flip — keeping the frozen
   `concludeMeeting(meetingId)` contract intact. It validates ≥1 present attendee (HC034),
   **snapshots** the quorum rule + counts onto the meeting (so editing settings/attendance
   later never rewrites history), and writes a `case_events` (`kind='meeting'`) row per
   linked case.

2. **Auto-flip to `assinada` lives in the sign RPC, not a row trigger.** When the last
   required signature (every PRESENT PLATFORM attendee) lands, `sign_meeting` count-and-flips
   `em_assinatura → assinada` under the flag. A row trigger would re-introduce the cases
   auto-status pitfalls (re-entrancy, ordering).

3. **The sign path is DEFINER and re-asserts eligibility EXPLICITLY.** `sign_meeting` is
   `SECURITY DEFINER` so it can read the locked minutes to hash and count signatures across
   the meeting. Because a DEFINER function owned by a superuser **bypasses RLS**, the
   `meeting_signatures_insert` sign-own-row policy is NOT re-evaluated on its INSERT — so the
   RPC calls `app.can_sign_meeting(attendee, auth.uid())` EXPLICITLY (present platform
   attendee, own row, `em_assinatura`, member of the commission) and raises HC036 itself. The
   policy remains the authority for any direct (invoker) insert path; the explicit check is
   the authority for the definer path. (This was a real bug caught in smoke testing — the
   first cut relied on the policy being re-checked, which it is not.) Double-sign collides
   with the active partial-unique `(meeting_id, attendee_id) where status='signed'` → HC035.

4. **The child-content lock ignores `app.in_meeting_rpc`.** Unlike `guard_meeting_status`
   (which the lifecycle RPCs legitimately bypass to flip the meeting's own status),
   `app.guard_meeting_child_lock` keys PURELY on the parent meeting's status, so the
   authoring-child RPCs (which set the flag for their own writes) can STILL never edit a
   locked meeting's agenda/attendees/case-links. Conclude reads children only; reopen writes
   signatures + the meeting row, never the locked child tables — so neither is affected.
   `meeting_action_items` and `meeting_signatures` are deliberately NOT child-locked (action
   plans outlive the signing; signatures are written WHILE locked).

5. **Reopen revokes, never deletes.** `reopen_meeting` (DEFINER, no UPDATE policy on
   signatures) flips active signatures to `status='revoked'` (rows kept for the audit trail)
   and returns the meeting to `realizada`, unlocking content for amendment.

6. **Signature schema is provider-ready.** `method` / `content_hash` (sha256 hex of the
   locked minutes, via `extensions.digest(...)` — pgcrypto is in the `extensions` schema, off
   the pinned search_path) / `provider_ref` / `provider_payload` / `ip_address` / `user_agent`
   so a future gov.br / ICP-Brasil / DocuSign integration needs no disruptive migration. v1
   only writes `method='internal_eauth'`.

7. **Seed-on-commission is a fresh standalone trigger.** No commission AFTER INSERT trigger
   existed (the case-status one was dropped in `20260614093000`), so
   `app.seed_default_meeting_types` + `app.seed_meetings_on_commission_insert` seed the two
   types + settings row for every new commission (idempotent), and a backfill block seeds the
   commissions that already existed.

8. **Feature flag.** `meetings` ships OFF; every RPC gates `app.assert_meetings_enabled()`,
   the direct-table writes gate `public.meetings_enabled()` (mirror of
   `public.cases_extras_enabled`). A one-line migration flips it ON at phase completion.

9. **SQLSTATEs:** HC032 commission mismatch · HC033 wrong meeting state · HC034 no present
   attendee · HC035 already signed · HC036 not entitled to sign · HC037 not entitled to
   update action item. HC021 (assignee not a member) reused.

## Consequences

- The TS data-access surface (`src/lib/queries/meetings.ts`, `meeting-action-items.ts`,
  `src/lib/meetings/{actions,messages}.ts`) is contract-first and frozen for the frontend.
  The SQLSTATE→pt-BR map is centralized in `messages.ts` (a deliberate divergence from the
  cases feature's inline map — flagged for reviewers).
- Quorum's `maioria_simples` denominator is **all commission members** (guests never count);
  the snapshot columns let this change later without a migration.
- No recurrence engine, no generic notifications subsystem (pending signatures is a derived
  read RPC `my_pending_meeting_signatures`), and no actual third-party signature integration
  (the schema is *prepared* for it). All out of scope for Phase 10.
