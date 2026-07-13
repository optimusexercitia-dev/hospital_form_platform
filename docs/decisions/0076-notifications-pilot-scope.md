# 0076 — Notifications (S1·N): pilot scope — prove one vertical deep

**Date:** 2026-07-13 · **Status:** accepted (requirements interview with the PO; binds the N build
plan). **Owner:** platform lead → `backend` (contract-first) → `frontend`.
**Track:** N (Phase 20 · Notifications & Escalation) of the
[Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md) (ADR
[0071](./0071-pre-pilot-release-scope-expansion.md)); build plan:
[notifications-s1.md](../plans/notifications-s1.md).
**Binding rules:** Rule 1 (RLS is the boundary — own-row), Rule 8 (regen types), Rule 9 (data access
via `src/lib/queries/`), Rule 10 (pt-BR UI / English code), Rule 11 (audit), **Rule 12 (PHI-free
notification bodies — by construction)**.

## Context

The written N scope (accreditation-track §20; pre-pilot plan §N) is broad: an in-app center **plus
transactional email**, scheduled reminders **plus escalation** (unactioned-after-N-days →
`staff_admin`), and a `compute_due_notifications` batch scanning **five** already-shipped sources
(sign-offs, meeting signatures, CAPA, controlled-doc review, indicator frequency). That is the right
*eventual* shape, but it is too much surface to land well in a supervised pilot, and most of it
(email deliverability, escalation policy, five scan arms) multiplies risk without proving the
substrate any better than one coherent vertical would.

N is sequenced **first in S1** specifically to be the escalation/reminder **substrate** later tracks
lean on (X-ζ: "N ships the engine + sources; later tracks add scan arms — additive, idempotent"). So
the pilot goal for N is to prove that substrate *end-to-end* — synchronous enqueue, a scheduled
due-scan, an in-app center with a badge, per-kind controls, and Rule-12-safe bodies — not to cover
every surface shallowly.

This ADR records the PO-ratified **narrowing** of the written scope for the S1 build. It does not
contradict the ratified spine (X-ζ additive engine, `HC0C·` block, `notifications` flag create-OFF);
it scopes N's *first* increment and lists the fast-follows the generic engine admits without a rebuild.

## Decision

**S1·N ships one vertical deep: in-app notifications for CAPA + Sign-off + Meeting, actionable-to-me
only.** The engine and schema are **kind-agnostic**, so every deferred item below is an additive arm,
not a rewrite.

| # | Decision | Choice |
|---|---|---|
| 1 | Trigger families | **Both** event-driven (synchronous enqueue) **and** time-driven (scheduled scan) |
| 2 | Channels | **In-app center only.** Email **deferred** (fast-follow post domain setup); enqueue keeps email a drop-in consumer |
| 3 | Scope principle | **Actionable-to-me only** — every notification maps to a task on the recipient; no FYI/awareness feed (dashboards cover that) |
| 4 | Surfaces (the vertical) | **CAPA action · section sign-off · meeting.** RCA `prazo`, controlled-doc review, indicator period, case phase, referral all **deferred** to fast-follow scan arms |
| 5 | Escalation | **Reminder-only.** Escalation-to-`staff_admin`/hierarchy **deferred** until the policy is designed properly |
| 6 | Preferences | **Per-kind reminder toggle** (`surface` ∈ capa/signoff/meeting; default on) — silences the *reminder* stream only. **Assignments always deliver, non-suppressible** (accountability) |
| 7 | Cadence | Milestone pings **+ weekly still-open nudge**; 3-day lead; meeting = "tomorrow". Idempotent via a `(user, kind, entity, milestone)` dedup key |
| 8 | Scheduler | Build `compute_due_notifications()` as a DEFINER RPC **now** (pgTAP-proven: right set + idempotent on re-run); wire the schedule at the pilot-reset deploy, **`pg_cron` default** (external-cron-hitting-a-route is the fallback). No manual "run now" |
| 9 | Lifecycle | **Auto-resolve reminders on task completion** — `resolve_notifications_for(entity,id)` from the existing CAPA-close / sign-off-sign / meeting-conclude mutations. Assignments persist as history |
| 10 | Badge freshness | **Server-render on navigation.** No Realtime (none exists in the app), no client poll |
| 11 | Read model | **Per-item read + mark-all-read** (own-row RPCs); each notification **click-through deep-links** to its task; badge = unread count |
| 12 | Rule 12 | Bodies are **snapshotted pt-BR from config-level fields only** (action title, form+section name, meeting title/date) → PHI-free by construction; deep-link access rides the target route's own RLS |
| 13 | Audit | N sits **outside the Rule-11 audit trail** — own-data; source events already audited; the `notifications` rows self-evidence the reminder history. Ordinary own-row table (not append-only) |

## Consequences

- **Deferred, all additive (no rebuild):** email channel · escalation · the docs/indicator/RCA/case/
  referral scan arms · per-channel & per-commission preferences · Realtime/poll · manual trigger ·
  render-at-read · audit integration · append-only tamper-evidence. Each is a small follow-up because
  the engine (kind-agnostic dedup + scan) and schema (`entity_type`/`entity_id`, snapshot body) are
  generic. This realises X-ζ: later tracks (ETH·E2, CH, AI·sat) add their own scan arms.
- **`notifications` carries `commission_id`** (per the written plan) for tenant scoping and future
  per-commission prefs, even though S1 RLS is own-row (`user_id = auth.uid()`) and S1 prefs are
  per-(user, surface) global.
- **SQLSTATE `HC0C·`** reserved for N (pt-BR-mapped in the data layer; raw Postgres never reaches UI).
- **Flag `notifications`** created seed-OFF, flipped ON at the N gate; `seed.sql` forces ON for
  local/E2E. Flag-OFF preserves byte-for-byte pre-N behavior (shell renders no bell).
- **The written §20 / pre-pilot-plan §N acceptance criteria are superseded for S1** by the narrower AC
  in [notifications-s1.md](../plans/notifications-s1.md) (no email/escalation assertions in S1; those
  return with their fast-follows).

## Follow-up (recorded at the N gate, 2026-07-13)

- **Decision 3 ("actionable-to-me") forced a small additive surface.** Build-time testing found a
  CAPA action can be assigned to *any* profile (`add_capa_action` checks only that the profile exists —
  no PQS/membership gate), yet the only CAPA view is PQS-gated — so a **non-PQS assignee** had no page
  to open (a pre-existing domain gap the notification made visible). To honor decision 3, the PO
  ratified a new **global personal surface `/conta/itens-de-acao`** (non-gated, `requireUser`-gated
  shell) that lists the caller's assigned CAPA actions via a new self-scoped `SECURITY DEFINER`
  `list_my_assigned_capa_actions()` (config-level, PHI-free — Rule 12); the `capa` notification
  deep-links there (a **static** route, which also removed the per-recipient RLS href lookup that had
  dead-`'#'`-linked). "Meus itens de ação" was *not* used — it is commission-scoped and CAPA is
  commission-less. The assignee acts via the existing `advance_capa_action` (its assignee branch has no
  PQS gate). Additive and engine-consistent; no rebuild.
- **3 QA MINORs carried as fast-follow** (non-gating): (1) `revalidatePath('/', 'layout')`
  over-invalidates the root layout on every N write; (2) the sign-off `pending` scan depends on a prior
  `requested` event, so a response submitted while the flag was OFF never gets pending reminders
  (documented S1 simplification); (3) `notification_preferences` permits own-row direct DML by design
  (own-row, zero security impact).
