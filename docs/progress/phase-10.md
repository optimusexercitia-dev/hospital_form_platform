# Phase 10 — Meetings (archived task detail)

✅ Complete 2026-06-15. Full-stack feature behind the `meetings` flag (enabled in-phase).
Design: ADR [0025](../decisions/0025-meetings.md). QA review:
[docs/reviews/phase-10-review.md](../reviews/phase-10-review.md). Built ahead of Phase 9
(Deployment), which remains pending. Approved plan: `~/.claude/plans/…meetings`.

## Summary

Committees can now schedule and register meetings — between members and external (non-committee)
guests — and the data that comes out of them: minutes/atas (sanitized Markdown), agenda items,
attendance + quorum, cases discussed, action plans, and attachments. Participants sign an internal
electronic signature (based on platform auth); the schema is prepared for future third-party
providers (gov.br / ICP-Brasil / DocuSign) via `method`/`provider_ref`/`provider_payload`/
`content_hash`. **No patient data.**

Lifecycle: `agendada → realizada → em_assinatura → assinada → distribuida` (+ `cancelada`).
Content (minutes/agenda/attendees/case-links) locks at `em_assinatura`; `sign_meeting` auto-flips
to `assinada` when the last required signature lands; `reopen_meeting` (staff_admin) reverts to
`realizada` and revokes signatures.

## Contract-first sequencing

`backend` posted the typed query/action stub surface (B0) first; `frontend` built the UI (F0–F5)
against it in parallel while `backend` implemented (B1–B5). The frozen contract held; the only
mid-build additions (`updateMeetingMinutes`, `setMeetingQuorumMet`, `getMeetingAttachmentDownloadUrl`,
the F5 settings writes, `markMeetingHeld`) were lead-approved and additive.

## Tasks

| ID | Owner | Task | Outcome |
| -- | ----- | ---- | ------- |
| B0 | backend | Contract-first stubs (queries/meetings, meeting-action-items; meetings/actions, messages) | ✅ surface ACKed; frozen for frontend |
| B1 | backend | Migrations core: types, settings, `meetings`, minting trigger, lifecycle guard, flag, helpers (`…090000`) | ✅ |
| B2 | backend | Migrations: children + signatures + RLS (`can_sign_meeting`) + storage bucket + seed-on-commission (`…090001`–`…090005`) | ✅ |
| B3 | backend | RPCs: lifecycle, agenda/attendee CRUD, link/unlink, attachments, `sign_meeting` (auto-flip), action items, pending-sigs (`…090006`); F5 settings RPCs (`…090007`) | ✅ |
| B4 | backend | Query/action bodies; regen `database.ts`; seed demo block; ADR 0025; F5 settings actions | ✅ |
| B5 | backend | pgTAP `tests/120_meetings.sql` (29 assertions); enable migration `…090008`; `mark_meeting_held` `…090009` | ✅ pgTAP 321/321 |
| F0 | frontend | `frontend-design` pass; `meetings` route group + "Reuniões" nav + list/filters | ✅ |
| F1 | frontend | Schedule/edit form; detail header + lifecycle action bar (+ Marcar como realizada; Concluir in agendada & realizada) | ✅ |
| F2 | frontend | Minutes markdown editor+preview (locked read-only); agenda editor (add/edit/reorder) | ✅ |
| F3 | frontend | Attendees & quorum (member XOR guest, roles/attendance, seed-from-members, quorum override); cases linker; action-items panel | ✅ |
| F4 | frontend | Attachments uploader/list; signatures panel + "Assinar"; pending-signatures shell badge | ✅ |
| F5 | frontend | `manage/meetings/` settings: meeting-types vocab CRUD + quorum-rule editor | ✅ |
| T1 | tester | `e2e/phase10-meetings.spec.ts` (15 tests) + full-suite regression | ✅ 141/141 |
| Q1 | qa | Review → `docs/reviews/phase-10-review.md` | ✅ APPROVED (2 MINOR, cleared) |

## Bugs caught & fixed during the build (0 escaped to the test gate)

- **`sign_meeting` DEFINER bypassed RLS** — a SECURITY DEFINER fn (superuser-owned) skips RLS, so
  the `meeting_signatures_insert` policy alone wouldn't stop a non-present attendee signing. Fixed
  with an explicit `app.can_sign_meeting()` check inside the RPC (HC036). pgTAP-covered.
- **`guard_meeting_child_lock` honored the in-RPC flag** — would let authoring RPCs edit a locked
  meeting's children. Fixed to key purely on parent status.
- **Unreachable `realizada`** — nothing transitioned into it; added `mark_meeting_held` (agendada→realizada).
- **`present_count` counted guests** (QA MINOR-2) — `conclude_meeting` snapshot + live UI now exclude
  `user_id IS NULL`; matches the `sign_meeting` required-signer set. pgTAP regression added.
- **Cancelar shown on `assinada`** (QA MINOR-1) — gated off (the guard allows only
  `assinada→distribuida|realizada`).

## Gate results

- **Build:** typecheck + lint clean (0/0); `npm run build` green.
- **pgTAP:** 321/321 (19 files; `120_meetings.sql` = 29 assertions, incl. a present-guest-excluded-from-quorum regression).
- **E2E:** `e2e/phase10-meetings.spec.ts` 15 tests; **full suite 141/141** (`npx supabase db reset && npx playwright test --workers=1`).
- **QA:** APPROVED; both MINORs cleared before record.
- Spec defects found+self-corrected by the tester: SPEC-P10-001..013 (all MINOR, locator/column/UI-shape).

## Open notes / risks

- `meetings` flag is **ON** (enable migration `…090008` applied in-phase so the gate tested the live
  feature — same pattern as Phase 7's `cases_multi_phase`).
- `maioria_simples` quorum denominator = all commission members (the plan's flagged assumption; the
  snapshot columns let this change later without a migration).
- Phase 9 (Deployment) remains pending.
