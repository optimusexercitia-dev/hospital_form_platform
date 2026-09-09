# Backend State — notifications and action items

> Part of `docs/backend-state/`. **Start at [`README.md`](README.md)** — it routes you to the one
> file you need, and carries the maintenance rules in full.
>
> This is a **map, not the authority.** `ARCHITECTURE.md` is the spec and the **live catalog** is
> the truth (`pg_proc` incl. **`prosecdef`**, `pg_policies`, `pg_constraint`, `pg_trigger`, the
> ACLs). ⚠ **Not the migration files** — some rewrite live function bodies at runtime, so their
> text is stale by design (CLAUDE.md § graphify).
>
> ⛔ **A posted section is frozen.** Corrections are APPENDED, never edited into the statement they
> correct, and a correction leaves a forward marker at the statement it supersedes: a
> `⚠ **Superseded** — …` line directly under that heading, naming where the correction lives.
>
> ⛔ **A new phase EXTENDS its seam file.** It never opens a phase-named file, and the fix for an
> over-cap file is never to raise the cap nor to delete a posted section.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below. Replace this block in
place; never append to it, and never move a line of history into it (ADR 0198). Figures live in the
generated registries; the live catalog is the authority (ADR 0078).

### Surface

- **`public.notifications`** — one actionable reminder per user. `kind` ∈ `capa` · `signoff` ·
  `meeting` · `action_item`; `is_reminder` splits a non-suppressible, never-auto-resolved assignment
  from a suppressible, auto-resolvable reminder; `unique(user_id, dedup_key)` is the idempotency key.
  `title`/`body` are pt-BR snapshots of config-level fields only — PHI-free by construction (Rule 12).
- **`public.notification_preferences`** — per `(user_id, surface)` reminder toggle. An ABSENT row means
  enabled, and it suppresses the reminder stream only.
- **`public.action_items`** — the shared, non-PHI hub — plus three satellites: `action_item_reminders`
  (reminder RULES), `action_item_updates` (append-only narrative), `action_item_checklists` (ordered
  binary subtasks).
- **Doors** — `app.enqueue_notification` · `app.resolve_notifications_for` ·
  `compute_due_notifications()` (four scan arms: CAPA, sign-off, meeting, action item) ·
  `list_my_assigned_capa_actions()` · eight `committee_*` satellite mutators. Signatures, `prosecdef`
  and EXECUTE grants: [`generated-rpc-surface.md`](generated-rpc-surface.md) and
  [`generated-helper-surface.md`](generated-helper-surface.md).

### Invariants

- **No authenticated INSERT and no DELETE on `notifications`.** The sole write door is the DEFINER
  `app.enqueue_notification`, so forging a notification is impossible by construction rather than
  merely unauthorised. RLS on both tables is own-row (`user_id = auth.uid()`); the one authenticated
  UPDATE is a column grant on `read_at` alone.
- **The notify gate is the READ predicate, verbatim.** The action-item arm enqueues only when
  `app.can_read_action_item(item, recipient)` holds, so an assignee who cannot read a
  `case_restricted` case is never notified with its title. A new scan arm inherits that obligation.
- **Notifications sit OUTSIDE the Rule-11 audit trail by design** (ADR 0076 D13) — own data, and the
  source events are already audited.
- **`NotificationSurface` is not `NotificationKind`.** Four kinds; three suppressible preference
  surfaces. `action_item` is a kind with no surface. Widening one does not widen the other.
- **Milestones are reused, never added.** The action-item arm reuses `due_soon`/`overdue`; the
  milestone CHECK was not widened. The `kind` and `entity_type` CHECKs were.

### Rollout

- Flags `notifications`, `action_items`, `cases_extras`. ⛔ Resolve each flag's VALUE and its readers
  from [`generated-feature-flags.md`](generated-feature-flags.md), never from a sentence here.
- No `pg_cron` job schedules `compute_due_notifications()`; scheduling is a deploy step, not a
  migration.
- ⛔ **Deployment status is not stated in this layer** (ADR 0198 D5). Whether a migration reached the
  remote is a claim about an external system that rots silently — measure it with the recipes in
  [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).

### Open edges

- Email and escalation channels are deferred (ADR 0076); the engine and schema are kind-agnostic, so
  both are additive.
- The `action_item` preference surface is deferred — those reminders are opt-in-by-config and
  currently non-suppressible.

### Where the detail lives

- The frozen slices below, in order: **§ N — Notifications** · **§ AI — Action-Items Satellites**.
- ADR [0076](../decisions/0076-notifications-pilot-scope.md) (notifications, pilot scope) ·
  ADR [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md) (action items).

## N — Notifications (S1·N, 2026-07-13; ADR 0076; migrations `20260720000700`–`…000730`; flag `notifications` ON)

In-app notification centre for the pilot's ONE vertical — **CAPA action · section sign-off · meeting**,
**actionable-to-me only**, event-driven **and** time-driven (scheduled scan), **reminder-only, in-app
only** (email/escalation deferred — ADR 0076). The engine + schema are **kind-agnostic** so later scan
arms (docs/indicator/RCA/case/referral) and channels are additive. N sits **OUTSIDE the Rule-11 audit
trail by design** (ADR 0076 decision 13 — own-data; source events already audited; the rows
self-evidence the reminder history). **Local validation:** full `supabase test db` **2255/0** (new
`226_notifications.sql` 52); lint 0 / typecheck 0 / Vitest 369 (incl. `routing.test.ts` `notificationHref`).
**Remote deploy DEFERRED to the pilot reset.**

- **2 tables.** `public.notifications` (`user_id`→profiles, nullable `commission_id` — **CAPA rows carry
  NULL**, `kind`∈capa/signoff/meeting, `milestone`∈assigned/requested/convoked/due_soon/overdue/pending/
  still_open/upcoming, `is_reminder` [false=event assignment, non-suppressible + never auto-resolved;
  true=reminder, suppressible + auto-resolvable], `entity_type`∈capa_action/response_section_signoff/
  meeting + `entity_id`, `title`/`body` **pt-BR SNAPSHOTS from config-level fields ONLY — PHI-free by
  construction, Rule 12**, `dedup_key`, `read_at`, `resolved_at`; **`unique(user_id, dedup_key)`** =
  idempotency) + `public.notification_preferences` (per-`(user_id, surface)` reminder toggle, default ON —
  absence of a row = enabled; suppresses ONLY the reminder stream). **RLS:** both own-row
  (`user_id = auth.uid()`). `notifications` gets SELECT + UPDATE(**`read_at` only**, column-GRANT) but
  **NO authenticated INSERT policy and NO DELETE** — the SOLE write door is the DEFINER
  `app.enqueue_notification` (the BUG-SUP-002 posture: no authenticated write path ⇒ forging is
  impossible by construction). `notification_preferences` is plain own-row SELECT/INSERT/UPDATE (a forged
  own-row preference has no security impact).
- **Engine.** Event-driven enqueue is spliced into 9 existing host mutations (below); the time-driven
  `compute_due_notifications()` DEFINER scan covers CAPA (due_soon ≤3d / overdue / weekly still_open),
  sign-off (pending ≥3d since first `requested` / weekly still_open), meeting (upcoming = tomorrow).
  Idempotent via `ON CONFLICT (user_id, dedup_key) DO NOTHING`; reminder enqueue skipped where the
  recipient disabled that surface (assignments never suppressed). Auto-resolve
  (`app.resolve_notifications_for`) stamps `resolved_at` on unresolved **reminders** of an entity on task
  completion (assignments persist as history). No `pg_cron` job in this migration — scheduled at the
  pilot-reset deploy.
- **`/conta/itens-de-acao` reader (BUG-N-001).** A CAPA action can be assigned to a non-PQS user with no
  access to the PQS-gated CAPA workspace → the capa/assigned deep-link would dead-`#`. `notificationHref`
  for `capa_action` now targets the **static** global personal page `/conta/itens-de-acao` (no per-recipient
  lookup can fail); the new self-scoped DEFINER `list_my_assigned_capa_actions()` feeds it (config-level,
  PHI-free). The assignee advances via the existing `advance_capa_action`/`complete_capa_action` (assignee
  branch of `app.advance_capa_action_core`, no PQS gate). `frontend` owns the page under the existing
  `conta/layout.tsx` (`requireUser()` + the bell); `backend` built only the reader + href retarget.
- **Action-item scan arm (BE-6·N, 2026-07-14 — see the AI section).** `compute_due_notifications()` gained a
  4th arm delivering the AI track's `action_item_reminders` as `kind='action_item'` reminders (`kind`/
  `entity_type` CHECKs widened += `'action_item'`; milestones **reuse** `due_soon`/`overdue`, no milestone
  CHECK change; recipient + `app.can_read_action_item` notify gate + `is_terminal` exclusion +
  resolve-on-complete via `advance_committee_action_item`'s terminal branch). **`NotificationSurface`** (the 3
  suppressible preference surfaces) is now split from the 4-member `NotificationKind` — `action_item` is a
  kind but **NOT** a preference surface (deferred, opt-in-by-config).

## AI — Action-Items Satellites + reminder→N scan arm (2026-07-14; ADR 0050; migrations `20260720000950`–`…000970`; flags `action_items`/`cases_extras` ON)

Three satellite spokes on the shared (non-PHI) `public.action_items` hub, rounding it into a usable
activity/checklist/reminder surface, plus the reminder→Notifications delivery wiring (BE-6·N). **Local
validation:** full `supabase test db` **2412/0** (`227_action_item_satellites.sql` 70 · `226_notifications.sql`
69, +17 AI-arm assertions incl. the Open-#3 `case_restricted` leak test both directions); `database.ts` regen
= nil diff; lint 0. **One FE-owned tsc handoff** (a `NotificationKind`→`NotificationSurface` swap in
`notification-preferences-form.tsx`) routed to `frontend`. **Remote deploy DEFERRED to the pilot reset.**

**[2026-08-18 · `20260818000300`, local-only]** Column `action_items.case_id` — the OPTIONAL
meeting/manual → case cross-link (**association**; `ON DELETE SET NULL`) — renamed → **`linked_case_id`**
to end the confusing collision with `source_case_id` (the case-source **provenance** pointer;
`ON DELETE CASCADE`; untouched). Surgical, column-only: FK `action_items_case_fkey` →
`action_items_linked_case_fkey` + its index renamed (SET NULL preserved); CHECK `action_items_case_link_check`
and the hub `*_select` / `*_staff_admin_write` RLS policies **auto-follow** (parsed node trees). **6 functions
re-emitted from LIVE defs** (not stale migration text — ADR 0078 / [[re-emit-definer-body-from-live-def]]):
`app.can_read_action_item` · `app.case_of_action_item` · `app.trg_audit_action_items` (tracked-col string
literal `'case_id'`→`'linked_case_id'`) · `app.guard_action_item` (`new.case_id`; was NOT in the derived
blast-radius — names the col only via `new.`, found by enumerating triggers) · `public.create_committee_action_item`
· `public.delete_committee_action_item`. **Unchanged** (verified not the column): all `p_case_id` RPC params ·
the `list_my_action_items` JSONB output key `'case_id'` (frontend read contract) · `get_member_overview`'s
other-table `case_id`s · the FE DTO field `caseId` — **no frontend churn**. Remote still has `case_id` —
deferred to the pilot reset.

- **3 satellite tables** on `action_items(id)` (mig `…000950`). `action_item_reminders` (reminder RULES —
  `reminder_type`∈before_due/on_due/after_due, `offset_days` [NULL for on_due, >0 else — CHECK], `is_active`)
  · `action_item_updates` (append-only NARRATIVE feed — `update_type`∈note/progress/blocker/deadline_change,
  free-text `body`; no update/delete path) · `action_item_checklists` (ordered binary SUBTASKS —
  `title`/`is_done`/`sort_order`/`completed_*`). **RLS:** each ONE SELECT policy reusing
  `app.can_read_action_item(action_item_id, auth.uid())` **verbatim** (no new predicate, no per-satellite
  disjunct — a satellite row of a `case_restricted` item is invisible to a non-case-reader exactly like the
  item itself); **NO authenticated INSERT/UPDATE/DELETE** (DEFINER-RPC-only writes). **Audit:** one
  `app.trg_audit_action_item_{reminders,updates,checklists}` AFTER trigger each, structural-cols-only diff
  (free-text body/title excluded), `p_commission := app.commission_of_action_item`.
- **8 `committee_*` mutator RPCs** (DEFINER; each opens on `feature_enabled('action_items')`→HC000; t19
  revoke-from-public + grant authenticated/service_role). Reminders — `create`/`update` (toggle is_active)/
  `delete` = 3, authority **staff_admin/commission_admin of the item's commission (HC0I0)**. Updates —
  `create` = 1 (append-only). Checklists — `create`/`toggle`/`update`/`delete` = 4. Updates + checklists
  authority = **reader-with-a-stake** (`app.can_write_action_item_stake` = `can_read_action_item` AND
  [assigned_to / active assignment / staff_admin / commission_admin]; HC0I1 / HC0I2).
- **`list_my_action_items`** widened with `visibility_scope` in **both** UNION arms (case + shared), additive
  (mig `…000960`) — the "Meus itens de ação" list surfaces each item's scope badge.
- **BE-6·N reminder→N scan arm** (mig `…000970`; see the N section). `compute_due_notifications()` gains an
  action-item arm, gated on `feature_enabled('action_items')`: recipient = `coalesce(assigned_to, active owner
  assignment)` (unassigned ⇒ nothing); **enqueues only if `app.can_read_action_item(item, recipient)`** (Open
  #3 — the verbatim read predicate reused as the notify gate, closing the `case_restricted`-title leak: an
  `assigned_to` who cannot read the case is not notified with its title); terminal items excluded via
  `action_item_statuses.is_terminal`; date match before_due ⇒ `due_date = today+offset_days` / on_due ⇒ `today`
  / after_due ⇒ `today-offset_days`; milestones **reuse** `due_soon` (before_due/on_due) & `overdue`
  (after_due) — **NO milestone CHECK change**; `title` = pt-BR heading, `body` = the item's own title
  (**PHI-free by construction — non-PHI hub, no case/answer/patient join**); dedup
  `action_item:{id}:{milestone}:{date}`. `public.notifications` `kind` + `entity_type` CHECKs widened +=
  `'action_item'`. **Resolve-on-complete:** `advance_committee_action_item`'s terminal branch now calls
  `app.resolve_notifications_for('action_item', id)` — the single choke point (both
  `complete_committee_action_item` and a cancel advance delegate here). **TS:**
  `NotificationKind`/`NotificationEntityType` += `action_item`; new **`NotificationSurface`** = the 3
  suppressible preference surfaces (capa/signoff/meeting) — the `action_item` preference-surface is
  **DEFERRED** (reminders are opt-in-by-config, non-suppressible in S1); `notificationHref('action_item')` →
  static `/conta/itens-de-acao` (like `capa_action` — an assignee may lack workspace access). **Build note:**
  the `advance_` terminal-resolve splice was made against the LIVE `pg_get_functiondef` body (source-aware
  case/meeting authority + the swept `is_tenancy_admin_of`), NOT the stale `000706/707` migration text — a
  mechanical re-copy reverts the `000709000200` commission-admin symbol-sweep and reintroduces the dropped
  `is_org_admin_of_commission` (breaks the `187` guard).
