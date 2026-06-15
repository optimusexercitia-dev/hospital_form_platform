# Phase 10 — Meetings: QA Review

**Date:** 2026-06-15
**Reviewer:** qa
**Verdict:** APPROVED (2 MINORs — fix before record per standing user preference)

---

## Summary

Phase 10 delivers a full meetings subsystem behind the `meetings` feature flag:
6-state lifecycle, per-commission meeting-number minting, agenda/attendees/cases/action-items/
attachments/signatures children, sign-own-row RLS with explicit DEFINER re-check, quorum
snapshot at conclusion, and the F0–F5 UI surfaces. Ten migrations, ADR 0025, 28 pgTAP
assertions (320/320 full suite), 15 E2E tests (141/141 full suite green).

No blockers. No majors. Two minor behavioral deviations from the approved plan that must be
corrected before the phase is recorded (per the standing user preference confirmed in
MEMORY.md).

---

## Requirements Traceability

| Acceptance criterion | Source | Result |
|---|---|---|
| `agendada→realizada→em_assinatura→assinada→distribuida` + `cancelada` lifecycle via DB state machine | PHASES.md §10 | PASS — `guard_meeting_status` in `20260615090000` enforces all legal edges |
| `assinada` cannot transition to `cancelada` (plan line 64 lifecycle table) | Approved plan | MINOR-1 — UI shows Cancel button on assinada meetings; guard blocks it, but exposes a dead action |
| Per-commission `meeting_number` minting (advisory lock) | PHASES.md §10 | PASS — pgTAP tests 3–4 |
| `create_meeting` requires `staff_admin`; cross-commission blocked | PHASES.md §10 | PASS — pgTAP tests 5 (42501 on non-admin) + 27–28 (cross-commission) |
| Seed-on-commission: 2 default types + 1 settings row | PHASES.md §10 | PASS — pgTAP tests 1–2; `20260615090005` trigger + backfill |
| `mark_meeting_held`: `agendada→realizada` only; HC033 on wrong state | PHASES.md §10 | PASS — `20260615090009`; pgTAP tests 7–8 |
| `conclude_meeting`: requires ≥1 present attendee (HC034); snapshots quorum | PHASES.md §10 | PASS (HC034 enforced); MINOR-2 — snapshot and live UI count include external guests, contradicting the plan's "guests never counted" rule |
| Quorum denominator = all commission members; guests never count | Approved plan §7, ADR 0025 | MINOR-2 — `present_count` snapshot includes guests; `sign_meeting` auto-flip correctly excludes them |
| Child-lock on `em_assinatura`/`assinada` (minutes, agenda) | PHASES.md §10 | PASS — `guard_meeting_child_lock` in `20260615090001`; pgTAP tests 13–14; lock deliberately ignores `in_meeting_rpc` flag (ADR 0025 decision 4) |
| Sign-own-row: HC035 double-sign, HC036 non-present/wrong-user | PHASES.md §10 | PASS — `can_sign_meeting` DEFINER + explicit re-check in `sign_meeting`; `meeting_signatures_insert` WITH CHECK; pgTAP tests 16, 18, 19 |
| DEFINER bypass: `sign_meeting` explicitly re-asserts `can_sign_meeting` | ADR 0025 decision 3 | PASS — `20260615090006` L~1033; the comment at L~959 is misleading (see INFO-1) but the code is correct |
| Auto-flip `em_assinatura→assinada` after last required signature | PHASES.md §10 | PASS — in `sign_meeting` RPC, `user_id IS NOT NULL AND attendance='presente'` filter (guests excluded here correctly); pgTAP test 22 |
| `reopen_meeting` revokes all signatures (rows kept, status='revoked') | PHASES.md §10 | PASS — pgTAP tests 23–24 |
| HC037 non-assignee non-admin cannot advance action item | PHASES.md §10 | PASS — `guard_meeting_action_item` in `20260615090001`; pgTAP tests 25–26 |
| Cross-commission case link blocked (HC032) | PHASES.md §10 | PASS — `guard_meeting_cases` in `20260615090001` |
| Cross-commission RLS isolation | PHASES.md §10 | PASS — pgTAP tests 27–28 |
| Attachments bucket: immutable (no UPDATE/DELETE policies) | Architecture Rule 6 | PASS — `20260615090004` has member SELECT + staff_admin INSERT; no UPDATE/DELETE |
| Minutes rendered as sanitized Markdown | Architecture Rule 7 | PASS — `MeetingMinutesEditor` uses `SectionTextEditor` (sanitized preview) in edit mode; `MarkdownRenderer` in read mode |
| `meetings` flag gates all RPCs (`assert_meetings_enabled`) | PHASES.md §10 | PASS — all RPCs call the assert; `meetingsEnabled()` DEFINER gates the TS layer and UI routes |
| Feature flag: 404 when off on all meetings routes | PHASES.md §10 | PASS — `src/app/c/[slug]/meetings/page.tsx`, `[meetingId]/page.tsx`, `manage/meetings/page.tsx` all gate on `meetingsEnabled()` |
| Foreign commission → 404 on detail page | PHASES.md §10, E2E AC5b | PASS — `meeting.commissionId !== access.commission.id` guard in `[meetingId]/page.tsx` |
| `manage/meetings` staff_admin-only | PHASES.md §10 | PASS — `access.role !== 'staff_admin' && !access.context.isAdmin` → `notFound()` |
| Anon/PUBLIC EXECUTE revoked on all public RPCs | Architecture Rule 1 | PASS — 21-function revoke sweep in `20260615090006`; `090007` and `090009` each include their own revokes |
| All user-facing strings in pt-BR | Architecture Rule 10 | PASS — `src/lib/meetings/messages.ts` maps all HC codes; dialogs and UI text all pt-BR |
| No raw Postgres errors in the UI | Architecture Rule 7 / CLAUDE.md §8 | PASS — `mapMeetingError` covers HC032–HC037, 42501, P0002, 23514 |
| Data access through `src/lib/queries/` | Architecture Rule 9 | PASS — all reads go through `meetings.ts` and `meeting-action-items.ts` |
| Server Components by default; `"use client"` justified | Architecture Rule / CLAUDE.md §8 | PASS — all page and layout files are Server Components; client components are interactive-only |
| Keyboard-only flow | PHASES.md §10 AC, CLAUDE.md §8 | PASS — E2E AC6; form dialog navigable via Tab/Enter |
| HC032–HC037 custom SQLSTATE coverage in pgTAP | PHASES.md §10 | PASS (HC032 is `guard_meeting_cases` cross-commission; no direct pgTAP because HC032 fires on an attendee-insert trigger, not tested by the cross-commission RLS test — same-commission guard is present in the trigger) |
| ADR exists for non-trivial choices | CLAUDE.md §8 | PASS — ADR 0025 (`docs/decisions/0025-meetings.md`) |

---

## Per-Area Findings

### 1. RLS & Security

**PASS** on all critical invariants:

- All 7 tables with explicit RLS (`meetings`, `commission_meeting_types`, `commission_meeting_settings`, `meeting_agenda_items`, `meeting_attendees`, `meeting_cases`, `meeting_action_items`, `meeting_signatures`, `meeting_attachments`) — member-read / staff_admin-all pattern.
- `can_sign_meeting` DEFINER (`20260615090003`) checks `user_id = p_signer`, `attendance = 'presente'`, `m.status = 'em_assinatura'`, and commission membership. The `sign_meeting` RPC explicitly re-calls `can_sign_meeting` even though it is also a DEFINER function (ADR 0025 decision 3 — superuser ownership bypasses RLS; the explicit call is the real guard).
- `meeting_signatures_insert` WITH CHECK pins `signer_id = auth.uid()` and calls `can_sign_meeting`; no UPDATE/DELETE policy on signatures (revoke is a status UPDATE inside the DEFINER `reopen_meeting`).
- `meeting-attachments` private bucket: member SELECT scoped to `commission_id` as first path segment; staff_admin INSERT only; no UPDATE/DELETE (Architecture Rule 6 satisfied).
- `app.in_meeting_rpc` session flag gates all lifecycle writes via `guard_meeting_status`. `guard_meeting_child_lock` deliberately does NOT honor this flag (ADR 0025 decision 4) — correct.
- Service-role key not referenced in any client-side code.
- Anon/PUBLIC EXECUTE revoke sweep covers 21 functions (`20260615090006`), plus `090007` (settings RPCs) and `090009` (`mark_meeting_held`).
- `commission_of_meeting` DEFINER pins `search_path`. All DEFINER functions audited pin `search_path = public, extensions, app, pg_catalog`.

### 2. State Machine & Immutability

**PASS.** `guard_meeting_status` (`20260615090000`) legal transitions:
- `agendada` → `realizada | cancelada`
- `realizada` → `em_assinatura | cancelada`
- `em_assinatura` → `assinada | realizada | cancelada`
- `assinada` → `distribuida | realizada`
- `distribuida` and `cancelada` → nothing (terminal)

The plan explicitly shows `assinada` cannot transition to `cancelada`. The guard correctly implements this.

**MINOR-1** (see below): the UI does not reflect this constraint — "Cancelar" is rendered on `assinada` meetings.

Child-lock (`guard_meeting_child_lock`) triggers on INSERT/UPDATE/DELETE on agenda items, attendees, and meeting minutes while `status IN ('em_assinatura', 'assinada', 'distribuida')`. It fires unconditionally (no `in_meeting_rpc` exemption), so authoring RPCs cannot sneak past it even from a DEFINER context — correct per ADR 0025.

### 3. Quorum

**MINOR-2** (see below) on the `present_count` snapshot.

The `eligible_member_count` denominator correctly uses `count(commission_members)` (all members, guests never in the denominator). The `sign_meeting` auto-flip required-count query correctly uses `user_id IS NOT NULL AND attendance='presente'` to exclude guests. Only `conclude_meeting`'s snapshot query and the UI's live present-count display fail to exclude guests.

### 4. Code Quality & Architecture

**PASS** on all architecture rules audited:

- TypeScript `strict` observed. The single `as unknown as PendingSignatureRow[]` cast in `src/lib/queries/meetings.ts` is justified inline (RPC returns untyped JSON rows from `my_pending_meeting_signatures`).
- All reads go through `src/lib/queries/meetings.ts` and `src/lib/queries/meeting-action-items.ts`. No inline `supabase.from()` calls in page or component files.
- Server Components are the default. All page files (`meetings/page.tsx`, `meetings/[meetingId]/page.tsx`, `manage/meetings/page.tsx`, `c/[slug]/layout.tsx`) are Server Components. Client components (`meeting-lifecycle-actions.tsx`, `meeting-form-dialog.tsx`, `attendees-panel.tsx`, etc.) carry `"use client"` and are interactive-only.
- `revalidatePath` patterns follow established convention.

### 5. UX, A11y & pt-BR

**PASS.** Confirm dialogs for all lifecycle transitions surface in pt-BR. `mapMeetingError` covers all custom codes (HC032–HC037), the Postgres standard codes that can surface (42501, P0002, 23514), and falls through to `error.message` for any uncovered DB error. Attestation text in `sign-dialog.tsx` is in pt-BR. All form labels, placeholders, and error messages are in pt-BR. Keyboard-only flow covered in E2E AC6.

No raw Postgres errors can reach the UI through the actions layer.

### 6. Test Coverage

**PASS.** 28 pgTAP assertions in `supabase/tests/120_meetings.sql` cover all DB-level invariants. 15 E2E tests in `e2e/phase10-meetings.spec.ts` cover all acceptance criteria including security (foreign-commission 404, member read-only), keyboard-only flow, and the pending-signature badge. Full suite 141/141 green.

---

## Findings

### MINOR-1: Cancel button visible on `assinada` meetings despite state-machine prohibition

**File:** `src/components/meetings/meeting-lifecycle-actions.tsx` line 77

**Code:**
```typescript
const canCancel = !isTerminalMeetingStatus(status);
```

`isTerminalMeetingStatus` returns `true` for `distribuida` and `cancelada`. For `assinada`, it returns `false`, so `canCancel` is `true` and the "Cancelar" button is rendered.

**Requirement violated:** The approved plan lifecycle table (line 64) shows `assinada→distribuida|realizada` with no `cancelada` edge. `guard_meeting_status` in `20260615090000` implements this correctly. The UI should not present an action that the state machine will always reject.

**Impact:** Clicking "Cancelar" on an `assinada` meeting opens the confirm dialog. On confirm, `cancelMeeting` calls the `cancel_meeting` RPC, which calls `guard_meeting_status`, which raises a check violation. `mapMeetingError` maps `23514` to `error.message` — the guard's internal error text ("transição de estado de reunião inválida: assinada -> cancelada") appears inline, which is a Postgres-internal string visible to the user.

**Fix:** Change line 77 to:
```typescript
const canCancel = !isTerminalMeetingStatus(status) && status !== 'assinada';
```

---

### MINOR-2: Quorum `present_count` snapshot and live UI count include external guests

**Files:**
1. `supabase/migrations/20260615090006_meetings_rpcs.sql` — `conclude_meeting` function, quorum query (~line 308):
   ```sql
   select count(*) into v_present
   from public.meeting_attendees
   where meeting_id = p_meeting_id
     and attendance = 'presente'
   ```
2. `src/components/meetings/attendees-panel.tsx` lines 217–219:
   ```typescript
   const presentCount = attendees.filter(
     (a) => a.attendance === "presente"
   ).length;
   ```

**Requirement violated:** Approved plan §7: "guests are never counted" for quorum. ADR 0025: "Quorum's maioria_simples denominator is all commission members (guests never count)." Both the denominator and the numerator are specified as members-only. The `sign_meeting` auto-flip correctly implements this: it uses `user_id IS NOT NULL AND attendance = 'presente'`. The `conclude_meeting` snapshot and the live UI count do not.

**Impact:** An external guest (`user_id IS NULL`) marked `presente` inflates the `present_count` column at conclusion. This can produce `quorum_met = true` when fewer actual members are present than the threshold requires, or display a misleading quorum indicator in the attendees panel while the meeting is in progress.

**Fix 1 (DB — migration or `CREATE OR REPLACE` of `conclude_meeting`):** Change the quorum query to:
```sql
select count(*) into v_present
from public.meeting_attendees
where meeting_id = p_meeting_id
  and user_id is not null
  and attendance = 'presente'
```

**Fix 2 (UI):** Change `attendees-panel.tsx` lines 217–219 to:
```typescript
const presentCount = attendees.filter(
  (a) => a.attendance === "presente" && a.userId !== null
).length;
```

---

### INFO-1: Migration comment contradicts ADR on DEFINER bypass (no action required)

**File:** `supabase/migrations/20260615090006_meetings_rpcs.sql` ~line 959

The comment reads: "The actual signature INSERT goes THROUGH the sign-own-row RLS policy." ADR 0025 decision 3 correctly states the opposite: DEFINER functions owned by a superuser bypass RLS, and the explicit `can_sign_meeting` call is the real guard. The implementation is correct; the comment is misleading. Low priority — update the comment alongside the MINOR-2 fix to avoid future confusion.

---

### INFO-2: `cancel_meeting` RPC comment misleading (no action required)

The function comment says "any non-terminal state → cancelada" but `assinada` is non-terminal and is not cancellable per the guard. No security or functional impact; the guard enforces correctly. Fix the comment when addressing MINOR-1.

---

## Verdict

**APPROVED** — with the following pre-record fixes required (per standing user preference):

| Finding | Fix owner | Priority |
|---|---|---|
| MINOR-1: Cancel button on `assinada` meetings | frontend | Required before record |
| MINOR-2: Quorum present_count includes guests | backend (SQL) + frontend (UI) | Required before record |

Both MINORs are localized, low-risk changes. No blockers. No majors. All RLS invariants, immutability rules, DEFINER bypass guards, and Architecture Rules are satisfied. The pgTAP and E2E coverage is thorough. The phase may be recorded once the two MINORs are resolved and re-verified.
