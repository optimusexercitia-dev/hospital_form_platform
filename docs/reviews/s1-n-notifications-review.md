# QA Review — S1·N Notifications (Phase 20)

**Reviewer:** `qa` · **Date:** 2026-07-13 · **Gate step 3**
**Scope authority:** ADR [0076](../decisions/0076-notifications-pilot-scope.md) (13 locked decisions) ·
build plan [notifications-s1.md](../plans/notifications-s1.md)
**Changeset:** migrations `20260720000700/000710/000720/000730`; `src/lib/queries/{notifications,feature-flags,capa}.ts`;
`src/lib/notifications/{actions,messages,routing-context}.ts`; `src/lib/routing.ts`; `src/lib/safety/capa-types.ts`;
`src/components/notifications/*`; `src/app/conta/**`; `src/components/ui/switch.tsx`; pgTAP `supabase/tests/226_notifications.sql`.

## Verdict: **APPROVED**

Findings: **0 BLOCKER · 0 MAJOR · 3 MINOR** (none gating). The two highest-stakes surfaces — the DEFINER-only
write door (Rule 1) and PHI-free bodies (Rule 12) — are airtight and correctly exercised by non-vacuous pgTAP.
The build matches all 13 ADR-0076 decisions with no deferred surface (email, escalation, extra scan arms) leaking in.

> Note: this review is static analysis only. Per the lead's mid-task notice, the local DB is being torn down and
> reseeded per-batch by the concurrent `e2e:prod` oracle, so no live psql/pgTAP was run. Findings rest on the SQL
> source, the RLS policies + grants, the TS layer, and the tester-verified clean-reset pgTAP `226` (52/52, 2255/0).

---

## Focus-area verdicts

**1 · Rule 1 — own-row RLS + DEFINER-only write door — PASS.**
`public.notifications` (`…000700` L89-106) enables RLS with SELECT-own (L91-93) and UPDATE-own (L97-100) policies
only; **no INSERT policy and no DELETE policy**. Grants are `select` + `update (read_at)` + service_role-all —
there is **no INSERT grant to authenticated at all**, and the column-level UPDATE grant blocks re-targeting
`entity_type/title/user_id` via update (only `read_at` is writable). The sole insert path is the DEFINER
`app.enqueue_notification`. BUG-SUP-002 forgery is blocked at two layers (missing policy + missing grant) and is
**non-vacuously** proven by pgTAP `226` #12a (direct INSERT as self → 42501) and #12b (impersonating another user
→ 42501). `app.enqueue_notification` is granted to `authenticated`, which I probed as the prime forgery vector: it
is *not* exploitable — the `app` schema is absent from `config.toml` `[api] schemas = ["public","graphql_public"]`
and from `extra_search_path`, so it is unreachable via PostgREST; and the grant is *required*, because
`save_section_answers` is SECURITY INVOKER (`…000710` L209-210) and calls the helper as the caller. Callers can only
reach enqueue through mutations that fully control its arguments, never with an attacker-chosen `p_user_id`.

**2 · Rule 12 — PHI-free bodies by construction — PASS.** Every `app.enqueue_notification` call site was traced:
- CAPA (`…000700` L380-397 scan; `…000710` L78-81 create, L131-134 reassign): `body = capa_action.title`.
- Sign-off (`…000700` L437-449 scan → `body = null`; `…000710` L442-447 event → `body = section.title`).
- Meeting (`…000700` L464-468 scan; `…000710` L581-584, L619-622, L655-658 events): `body = meetings.title`.

All bodies derive solely from config-level fields (action title, section title, meeting title) — never an answer
value, RCA/root-cause/event narrative, or patient column. This matches ADR-0076 decision 12's allowed set.
`list_my_assigned_capa_actions()` (`…000730`) selects only `id/capa_id/title/owner/action_strength/due_date/status/
updated_at` from `capa_action` with **no** `capa_plan`/rca/root_cause/event/patient join; pgTAP #17d greps the
function body against `(root_cause|success_measure|rca|event_patient|patient|capa_plan)` and asserts no match.

**3 · New DEFINER RPC `list_my_assigned_capa_actions()` — PASS.** Self-scoped on `assignee_user_id = auth.uid()`
with an `auth.uid() is not null` guard (`…000730` L42-43); a caller cannot read another user's actions (pgTAP #17b:
st_x2's action never appears for st_x; #17c: a non-assignee gets zero rows). t19 grants correct: `revoke all from
public` then grant to `authenticated, service_role` (L52-53; pgTAP #18a anon-denied, #18b authenticated-allowed).
The four public N RPCs carry the same t19 posture (`…000700` L290-291, L310-311, L336-337, L479-480), verified by
pgTAP #16a-e.

**4 · `compute_due_notifications` — PASS.** service_role-only grant, **not** authenticated (`…000700` L479-480;
pgTAP #16d anon-denied, #16e authenticated-denied — the deliberate ADR-0076-dec-8 deviation, "no manual run-now").
Idempotent through `app.enqueue_notification`'s `ON CONFLICT (user_id, dedup_key) DO NOTHING` (pgTAP #4: second run
over a saturated set adds zero rows). The due set is exactly `assignee not null AND status in (pending,in_progress)
AND due_date not null` (pgTAP #3d out-of-window, #3e unassigned, #3f closed all excluded). Reminder suppression is
enforced inside enqueue for `is_reminder = true` only (L207-212); assignments (`is_reminder = false`) skip the check
and always deliver (pgTAP #6a/#6b).

**5 · Auto-resolve correctness — PASS.** `app.resolve_notifications_for` updates only `is_reminder = true AND
resolved_at is null` rows (`…000700` L247-252), so assignments are never resolved (pgTAP #5b, #9b, #10e). Wired from
`advance_capa_action_core` on completed/cancelled (`…000710` L193-195), `sign_section` once no staff_admin pending
section remains (L524-535), and `conclude_meeting` (L779). `listNotifications` and `getUnreadCount` both filter
`resolved_at IS NULL` (`queries/notifications.ts` L106, L133), so a completed-task reminder drops from center and
badge immediately.

**6 · Flag-OFF byte-for-byte — PASS.** `NotificationBell` is a Server Component returning `null` when the flag is
off with no wrapping element (`notification-bell.tsx` L20-21), so the six mount sites (org `manage`/`nsp`/`nsp-org`/
`documentos-pendentes` layouts, commission layout, `conta` layout) render zero layout impact. `/conta/notificacoes`
and `/conta/itens-de-acao` both call `notFound()` when off (page L15-18 / L47-49). `enqueue`, `resolve`, and the scan
all short-circuit on `app.feature_enabled('notifications')` (`…000700` L201, L243, L365). The `/conta` shell is
auth-gated via `requireUser()` (`conta/layout.tsx` L26-29) and the `ContaNav` is hidden when off (L51-55).

**7 · BUG-N-001 resolution — PASS (sound closure).** The `capa/assigned` deep-link retargets to the static
`/conta/itens-de-acao` (`routing.ts` L122-124; `queries/notifications.ts` L178-180), reachable by any assignee
regardless of PQS standing. The advance path is sound: `public.advance_capa_action` (baseline L6984-6992) only asserts
`patient_safety_enabled` then delegates to `app.advance_capa_action_core`, whose gate is
`v_assignee = auth.uid() OR can_write_capa(...)` (`…000710` L172-177) — the assignee branch has **no** PQS gate, and a
non-assignee/non-writer is rejected with HC050. So a non-PQS assignee can advance their own action, and the path
cannot be abused by a non-assignee. `MyCapaActionControls` is only rendered for self-scoped rows, and even a direct
`advanceCapaAction` POST from a non-assignee is blocked at the RPC. No new hole.

**8 · Rule 11 — audit — PASS.** N sits outside the audit trail by design (ADR-0076 dec 13): the source domain events
(CAPA assignment, meeting convocation, sign-off) are already audited in their own mutations; the notification is a
derived side-channel over own-data with no `app.audit_write`. Nothing that *should* emit an audit row is silently
skipped — no auditable domain mutation was moved into the notification path.

**9 · Rule 10 — pt-BR / no raw PG — PASS.** `mapNotificationsError` (`messages.ts`) maps HC0C0→invalid-surface,
HC0C1→not-found, `P0002`→not-found, `23514`→unavailable, and every unknown code → the generic pt-BR fallback, so raw
Postgres/SQLSTATE text never reaches the UI. The HC0C0/HC0C1 branches surface `error.message`, but those messages are
curated pt-BR raised by the RPCs themselves (`'superfície de notificação inválida'` / `'notificação não encontrada'`),
not raw driver text. All user-facing strings across the FE surfaces are pt-BR.

**10 · Requirements vs ADR-0076 — PASS.** All 13 decisions honored: (1) both trigger families; (2) in-app only, no
email code anywhere; (3) actionable-to-me only, no FYI feed; (4) CAPA+signoff+meeting only; (5) reminder-only, no
escalation; (6) per-kind reminder toggle with non-suppressible assignments; (7) milestone + weekly still_open + 3-day
lead + meeting-tomorrow, `(user, dedup_key)` idempotency; (8) DEFINER scan, service_role-only, no run-now; (9)
auto-resolve reminders, assignments persist; (10) server-render on navigation, no Realtime/poll; (11) per-item +
mark-all read, click-through deep-link, unread badge; (12) config-level pt-BR snapshots; (13) outside the audit trail.
No deferred surface leaked in; nothing in scope is missing. Additionally I confirmed the sign-off coverage is
**complete, not narrowed**: `signoff_role` is CHECK-constrained to exactly `{respondent, staff_admin}` (baseline
L18298); respondent is the response creator (in-wizard, correctly excluded) and staff_admin is covered by both the
event hook and the scan.

---

## MINOR findings (non-gating — recommend fast-follow, not blocking the gate)

**MINOR-1 — Broad cache invalidation on every N write.** `src/lib/notifications/actions.ts` L26-28 calls
`revalidatePath('/', 'layout')` on every mark-read / mark-all-read / preference toggle, busting the entire root
layout cache. The code comment already flags this as intentional-for-now ("narrow it once the shell path is known").
Correctness is fine; it is a performance/over-invalidation cost only. Recommend narrowing to the actual shell path
post-pilot.

**MINOR-2 — Sign-off "pending" scan silently depends on the event-driven `requested` history.**
`compute_due_notifications` anchors the sign-off `pending`/`still_open` milestones on `min(created_at)` of the prior
`requested` notification (`…000700` L424-430). If the flag was OFF when a response became submit-ready (so no
`requested` row was ever written), the pending reminder can never fire for that response even after the flag flips ON.
This is documented as a deliberate S1 simplification in the function header (L346-349) and is acceptable for the pilot,
but is worth a line in the fast-follow backlog when a real "became-pending" timestamp is introduced.

**MINOR-3 — `notification_preferences` direct-DML writability is intentional but worth a one-line ADR breadcrumb.**
Unlike `notifications`, the preferences table carries plain own-row INSERT/UPDATE grants (`…000700` L130-139), so a
client can upsert its own preference row without going through `set_notification_preferences`. This is correct — a
forged own-row preference has zero security impact (it only silences the caller's own reminders) and the migration
header + table comment both explain it (pgTAP #13a rejects impersonation, #13b allows own-row). No action needed;
noting for completeness so a future reviewer does not read it as an inconsistency with the notifications door.

---

## Hygiene

- ADR 0076 present and authoritative; build plan tracks it. Migration headers are thorough and cite the exact
  decisions + the BUG-SUP-002 rationale. `…000710` regenerated each spliced body from the live catalog
  (`pg_get_functiondef`), not stale baseline text — the correct discipline per the "current schema truth =
  generated types" memory.
- Read/write split (`queries/notifications.ts` reads, `notifications/actions.ts` writes) follows the
  `signoffs.ts` / `safety` precedent (Rule 9). No inline supabase-js outside `src/lib/`.
- Feature-flag key `notifications` added to the hand-maintained `FeatureFlags` interface (`feature-flags.ts` L41)
  with a `notificationsEnabled()` wrapper (L111-113).
- TypeScript: no unjustified `any`; the `RawNotificationRow`/`Rrow` internal shapes are typed and mapped at the
  query boundary. Client islands import server-only query modules **type-only** (documented at each site), avoiding
  the server-in-client-bundle trap.
- Accessibility: preferences form uses `label htmlFor` + `aria-describedby` + `aria-busy`, and keeps focus during
  the round-trip (the BUG-N-003 fix — no fieldset `disabled`); the bell exposes a live unread count in its
  `aria-label`. pt-BR throughout.

**Recommendation:** APPROVED for the gate. The 3 MINORs are fast-follow hygiene, none security- or
correctness-gating.
