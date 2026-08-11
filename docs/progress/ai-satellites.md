# AI track — Action-Items Satellites + Cross-Link UI + reminder→N scan arm

**Status:** ✅ **COMPLETE — Recorded 2026-07-14** (`phase(ai): complete`). Last S2 track of the
Pre-Pilot Release Scope Expansion (ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)).
Spec: [action-items-satellites.md](../plans/action-items-satellites.md) · ADR
[0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md) · SQLSTATE
`HC0I0–HC0I9` · flags `action_items` + `cases_extras` (both ON). Branch `pre-pilot-release-s0`.

## What shipped

Additive, feature-flagged increment over the shared `action_items` hub — **three new satellite
tables**, new DEFINER RPCs, RLS **reusing an existing predicate verbatim** (not a new shape), the
cross-link/visibility UI, and the reminder→notifications scan arm.

- **AI·sat** — three satellites on the hub: `action_item_reminders` (nudge rules),
  `action_item_updates` (append-only narrative feed), `action_item_checklists` (ordered subtasks).
  Each has ONE SELECT policy = `app.can_read_action_item(action_item_id, auth.uid())` **verbatim**;
  **no authenticated INSERT/UPDATE/DELETE** — all writes funnel through **8 `committee_*` DEFINER
  RPCs** (reminders create/update/delete · updates create (append-only) · checklists
  create/toggle/update/delete). Audit via `app.trg_audit_*` (structural-only diff, PHI-free).
- **AI·ui** — surfaced the hub's already-shipped `visibility_scope` + `case_id` cross-link:
  shared `ActionItemSatellites` disclosure on both hosts (meeting + case action-item panels),
  meeting-form `case_id` picker (create-only) + visibility select (editable both modes, hard-guarded
  so `case_restricted` is selectable only with an effective case), `VisibilityScopeBadge` in "Meus
  itens de ação", static disclosure on the case-sourced form. `list_my_action_items` widened with
  `visibility_scope` in both UNION arms.
- **BE-6·N — reminder→notifications scan arm** (mig `…000970`): `compute_due_notifications()` gained
  an action-item arm; `public.notifications` `kind`/`entity_type` CHECKs widened += `'action_item'`;
  `advance_committee_action_item` terminal branch now calls `resolve_notifications_for('action_item',
  id)`; `notificationHref`/`NotificationKind`/`NotificationEntityType` widened (+ new
  `NotificationSurface` type). PO directed it wired **in-phase** (not fast-follow).

## Key decisions

- **O-1 (fail-closed) — confirmed + pgTAP-locked.** `can_read_case(null,uid)` is fail-closed (the
  null-commission guard fires before any admin arm); satellites are **stricter than the hub** (no
  blanket `staff_admin` SELECT). No escalation.
- **O-2 (write authority) — stakeholder-gated** (assignee / active assignment / staff_admin /
  org_admin), per S0 §I ratification.
- **O-3 (reminder recipient) — LEAD-RESOLVED at BE-6·N:** the scan arm enqueues **only if the
  resolved recipient passes `app.can_read_action_item(item, recipient)`** — verbatim read-predicate
  reused as the notify gate, closing the `case_restricted`-title leak (an `assigned_to` who can't
  `can_read_case` can't see the item, so must not be notified with its title). Zero drift; QA
  confirmed the gate is a literal call to the same DEFINER function, not a re-implementation.
- **O-4 (static disclosure) — INCLUDE** (lead call).
- **BE-6·N scope calls:** milestones reuse `due_soon`/`overdue` (no milestone CHECK change);
  `action_item` **preference-surface toggle DEFERRED** (reminders are opt-in-by-config; non-suppressible
  in S1) → new narrower `NotificationSurface` = the 3 suppressible surfaces.
- **Case cross-link is create-time only** — the hub UPDATE RPC has no `p_case_id`; lead declined to
  expand a `committee_*` signature (plan no-touch rule). Visibility stays editable on edit; the link
  shows read-only.

## Gate results — all green

| Step | Result |
| ---- | ------ |
| Build | tsc 0 · lint 0/0 · `next build` ✓ (prod-standalone rebuilt in the declaring E2E run) |
| Unit | Vitest **369/369** |
| pgTAP | `227` **70/70** (satellites) · `226` **69/69** (+17 BE-6·N arm assertions 19a–19r) · full suite **2412 PASS** |
| Tester E2E | `action-items-satellites` chromium **9/9**, **prod-standalone 9/9 ×2**; `notifications` prod-iso **8/8** |
| Full `e2e:prod` | **655p/29f/9flaky/10 batches — triaged GREEN, 0 AI/BE-6·N regressions.** All 29 reds = documented flaky baseline, clustered whole-spec-per-batch (environmental); the notifications 7/7 in batch-4 was an `openFreshCapaPlan` setup-helper HTTP failure (stack degradation; N-7 which skips the helper passed) — proven environmental by the isolated **8/8 GREEN** re-run. AI-owned `action-items-satellites` passed in the full run. |
| QA | **✅ APPROVED** (satellites: 0B/0M/1m-closed/3i) + **BE-6·N delta ✅ APPROVED** (0B/0M/0m/3i — security gate = literal `can_read_action_item` call, no drift; `advance_` rebuild diffed clean vs live def). [review](../reviews/phase-AI-review.md) |
| Human | ✅ Approved 2026-07-14; directed BE-6·N wired in-phase + BUG-AIF-001/FUP-AI-1 → pre-pilot. |

## Migrations / files

- Migs `20260720000950` (satellites), `…000960` (`list_my_action_items` widening), `…000970` (BE-6·N scan arm).
- pgTAP `supabase/tests/227_action_item_satellites.sql`, `…/226_notifications.sql`.
- Backend lib: `src/lib/queries/action-item-{reminders,updates,checklists}.ts`,
  `src/lib/action-items/satellite-actions.ts`, `src/lib/meetings/actions.ts`,
  `src/lib/queries/notifications.ts`, `src/lib/routing.ts`, `src/lib/notifications/actions.ts`.
- Frontend: `src/components/action-items/*` (satellites, reminder/updates/checklist sections,
  loader, labels, badge, confirm-delete, `use-satellite-action`), the meeting + case action-item
  panels/forms + hosting pages, `src/components/notifications/notification-preferences-form.tsx`.
- E2E `e2e/action-items-satellites.spec.ts`.

## Build catch (BE-6·N, recorded for posterity)

First `advance_committee_action_item` rebuild copied the stale `000706/707` migration text, which
**reverted** the `000709000200` commission-admin symbol-sweep (reintroduced the dropped
`is_org_admin_of_commission`) → broke `advance_` at runtime + pgTAP 113/120/182/187. Fixed by
rebuilding the body from the **live** `pg_get_functiondef` (source-aware authority + swept
`is_commission_admin_of`) plus only the resolve line. Lesson reinforced:
[[definer-rpc-gate-needs-table-level-enforcement]] — never re-emit a DEFINER body from stale
migration text; regenerate from the live definition.

## Pre-pilot follow-ups (PO-directed, NOT this phase)

- **FUP-AI-1 / BUG-AIF-001 → ⬛ CLOSED 2026-08-10 (PO), never built — the root cause was upstream and
  is fixed.** *(Original scope, PO call 2026-07-14: satellite panels surface the platform-wide
  `router.refresh()`-in-`startTransition` deferred-flush stall as a whole-section control freeze
  until reload — data always persists. `useSatelliteAction` mirrors the incumbent
  `useCaseAction`/`useMeetingAction` verbatim: platform-wide, not AI-introduced. Scheduled as its own
  pre-pilot workstream.)*

  **Why it closed without a refactor — three independent pieces, in increasing breadth:**
  1. **The defect was never ours.** BUG-AIF-001 was a Next.js App-Router bug — a route's
     `loading.tsx` Suspense boundary plus a server action's deferred `router.refresh()`, so a
     discarded action advanced the router action queue against stale state and the refresh never
     flushed (`vercel/next.js` #86151/#86055, fix PR #95391). Fixed upstream; `package.json` is on
     **`next: 16.3.0` stable**, `npm ls next` clean.
  2. **Full `e2e:prod` gate on 16.3.0 stable (2026-08-08): ZERO assertion failures**, 991 passed,
     coverage complete across 17 batches — far broader than any single hook's surface.
  3. **The canonical deterministic repro, re-run 2026-08-10** on a prod-standalone build with a fresh
     `db reset` (`SPECS=e2e/meetings-reserved-sessions.spec.ts`, the spec that produced the original
     hangs): **GATE GREEN, 8/8, 17.9s**; the mutation-driving tests ran **2.0s / 1.8s / 1.2s** against
     **21–31 s hangs** when the bug was live.

  ⚠ **What is NOT claimed:** the code pattern still exists in **all 13** `use-*-action*` hooks
  (derive with `find src -name "use-*-action*"` — the property is "defers `router.refresh()` inside a
  transition"; the old 3-hook list was an enumeration bounded by whoever filed it). Nothing was
  refactored. The close rests on the failure mode being gone from the toolchain, **not** on each hook
  being individually exercised — so a future Next regression in this area reopens it platform-wide.
  ⚠ **First move on any recurrence: `npm ls next`.** This bug's only "regression" was
  `node_modules/next` silently falling back to 16.2.9 while `package.json` declared the fixed
  version — the code was right and the install was wrong, and it cost a full diagnostic session.
- **§9.5 (post-pilot, logged):** project `visibility_scope` onto the read-side `MeetingActionItem`
  type so the meeting edit form shows the true stored scope vs the RPC-computed default (display
  nicety; FE-2 is safe by construction — edit submits scope only on explicit change).
