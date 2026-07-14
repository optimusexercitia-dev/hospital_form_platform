# QA Review — AI track: Action-Items Satellites + Cross-Link UI

**Reviewer:** `qa` · **Date:** 2026-07-14 · **Verdict: ✅ APPROVED**
**Severity tally:** 0 BLOCKER · 0 MAJOR · 1 MINOR (optional test-hardening) · 3 INFO

Scope per plan `docs/plans/action-items-satellites.md` §8 + ADR
`0050`. Audited: the two migrations
(`20260720000950_action_item_satellites.sql`,
`20260720000960_list_my_action_items_visibility_scope.sql`), pgTAP
`supabase/tests/227_action_item_satellites.sql`, and the new
`src/components/action-items/*` + `src/lib/action-items/satellite-actions.ts` +
`src/lib/queries/action-item-{reminders,updates,checklists}.ts` + the FE-2
change to `src/components/meetings/action-item-form.tsx`. Read-only on all app
code. `npm run typecheck` and `npm run lint` both clean (0 errors / 0 warnings).

---

## 1. Requirements audit (vs ADR 0050 + plan §2) — PASS

- **Exactly the 3 PO-locked satellites shipped**, no more: `action_item_reminders`
  (§2.2), `action_item_updates` (§2.3), `action_item_checklists` (§2.4). None of
  the 6 explicitly-deferred tables (`_related_records`, `_reviews`, `_follow_ups`,
  `_dependencies`, `_templates`, custom fields) appear in the migration — verified
  by full read.
- **Each satellite matches its narrowed spec**: reminders carry no
  recurrence/fan-out/`last_sent_at` (§2.2); updates are append-only narrative with
  no `progress_percent`/`old_value`/system types (§2.3); checklists are binary
  `is_done` subtasks with no per-subtask assignee/`due_at` (§2.4). The CHECK
  constraints match (`offset` XOR `on_due`; non-blank `body`/`title`).
- **CAPA isolation intact** — `grep -i capa` over the satellite migration returns
  nothing; no satellite references `capa_*`, no CAPA row becomes an `action_items`
  row. Invariant (plan §1, ADR 0050) upheld.
- **8 write RPCs** as scoped (reminders 3 · updates 1 append-only · checklists 4),
  matching the corrected count in BE-3.

## 2. RLS — verbatim reuse confirmed (plan §8 primary charge) — PASS

- All three SELECT policies are **byte-identical in effect**:
  `for select to authenticated using (app.can_read_action_item(action_item_id, auth.uid()))`
  (migration L244–260). No per-satellite disjunct, no new predicate, no new RLS
  shape. This is the X-ε contract in full.
- **No authenticated INSERT/UPDATE/DELETE policy exists** on any satellite — only
  the `_select` policies are created. Direct writes are therefore RLS-default-denied;
  every mutation funnels through a `SECURITY DEFINER` (owner `postgres`) `committee_*`
  RPC. The `grant all … to authenticated` on each table is inert for writes (no
  permissive write policy) and only backs the RLS-restricted SELECT — the same
  pattern the two existing satellites (and the shared-action-items review) already
  established.
- pgTAP `227` locks the 27-cell scope truth-table (3 satellites × 3 scopes ×
  {qualifying, disqualified reader}) — a qualifying reader sees the row, a
  disqualified one sees zero.

## 3. O-1 (fail-closed null-case) — confirmed sound — PASS

- `app.can_read_case(null, uid)` is **genuinely fail-closed**: the body
  (`20260708000000` L61–74) does `select commission_id … where id = p_case_id`;
  a null id yields no row → `v_commission is null` → `return false` **before any
  admin/PQS/grant arm**. So a `case_restricted` item with null
  `coalesce(source_case_id, case_id)` is invisible to everyone.
- The **hub/satellite asymmetry is intentional and safe**: the hub carries a
  blanket `action_items_staff_admin_write` (cmd=ALL) policy whose USING grants
  commission-admins SELECT on any hub row regardless of scope; the **satellites
  have no such policy**, so a null-case satellite row is invisible *even to
  staff_admin* — the satellite closes the leak more tightly than the hub. pgTAP
  `227` §(3) locks this precisely: the null-case reminder is 0 rows for a plain
  member **and** 0 rows for `sa_x` (staff_admin who can see the hub row).

## 4. O-2 (write authority) — RPC bodies match the ratified default — PASS

- **Reminders**: `is_staff_admin_of_for` OR `is_commission_admin_of_for` → `HC0I0`
  on all three RPCs (create/toggle/delete). Matches "reminders are
  staff_admin/org_admin-only".
- **Updates + checklists**: gated by `app.can_write_action_item_stake` =
  `can_read_action_item` AND (`assigned_to = uid` OR active assignment OR
  staff_admin OR commission_admin) → `HC0I1` / `HC0I2`. Matches "stakeholder-gated".
- pgTAP `227` §(4) proves the negative codes for a stakeless committee reader
  (HC0I0/HC0I1/HC0I2) **and** the positive `lives_ok` for the entitled caller.

## 5. `list_my_action_items` widening — additive — PASS

- `20260720000960` adds exactly one key (`visibility_scope`) to **both** UNION arms'
  `jsonb_build_object`; every other key, its order, the self-scoping filters, the
  flag gates, and the `order by` are unchanged from the `20260707000000` body. A
  caller ignoring the new key is unaffected. `create or replace`, forward-only, does
  not touch the `20260706`/`20260707` files. REVOKE→GRANT re-issued (t19).

## 6. Conventions — PASS

- **t19**: all 8 satellite RPCs + `can_write_action_item_stake` do
  `revoke all … from public` then `grant execute/all … to authenticated,
  service_role`. pgTAP `227` §(1) proves anon cannot EXECUTE and authenticated can,
  for all 8.
- **Audit (Rule 11)**: one `app.trg_audit_*` per satellite via `app.audit_write`
  with `p_commission := app.commission_of_action_item(...)`; the diff `v_cols`
  allowlist is **structural-only** — `body` (updates) and `title` (checklists) are
  excluded. pgTAP `227` §(7) proves a distinctively-bodied update does not appear in
  audit metadata. None of the satellite actions are in the `log_audit_access`
  PHI-read allow-list (grant-hardening) — correct, they are `audit_write`-only,
  non-PHI.
- **Rule 9**: reads flow through `src/lib/queries/action-item-*.ts`; the FE
  `satellite-loader.ts` server action only composes those typed `list*` functions
  (no inline supabase-js). Mutations route through `satellite-actions.ts` calling
  the DEFINER RPCs — the established platform pattern.
- **Rule 10**: user-facing strings pt-BR (`satellite-labels.ts`, form, RPC
  messages); `satellite-actions.ts` maps every SQLSTATE (HC000/HC0I0-2/23514) to a
  pt-BR message — no raw Postgres error reaches the UI.
- **Rule 7 (XSS)**: no `dangerouslySetInnerHTML` in `src/components/action-items/`;
  the free-text update `body` renders as plain text in a `<p whitespace-pre-wrap>`.
- **FE-2 foot-gun guard**: `action-item-form.tsx` hard-guards the
  `case_restricted` + no-case combination (`canRestrictToCase`, `safeScope`,
  disabled option, forced→committee on case-clear) — belt to the DB's fail-closed
  suspenders (Open decision §9.1 resolved safe both ways). Strict TS, no unjustified
  `any`.

---

## Findings

### MINOR-1 (optional, test-hardening) — direct-DML-denied not pgTAP-locked
The "no authenticated write policy ⇒ direct INSERT/UPDATE/DELETE is RLS-denied"
invariant is true **by construction** (only `_select` policies exist) and is the
core of the DEFINER-only write posture, but pgTAP `227` does not assert it directly:
it proves RPC authority codes and the SELECT truth-table, while the one direct
`INSERT` it runs (O-1 seed, L295) executes in the RLS-bypassing table-owner context.
The memberships-collapse review (`224`) and F1's MAJOR-1 lesson both treated the
raw-DML-denied cell as worth an explicit lock. Cheap to close: one
`set local role authenticated` + `throws_ok(... '42501')` per satellite. **Not a
security gap** (default-deny holds regardless of the grant), purely a coverage nit —
noted per the standing "fix cheap MINORs before Record" preference; lead's discretion.

### INFO-1 — authority helper is the post-ADR-0051 canonical name (not a drift)
The plan text says "staff_admin/org_admin" / `is_org_admin_of_commission_for`, but
the RPCs and `can_write_action_item_stake` use `is_commission_admin_of_for`. This is
**correct and consistent**: ADR 0051 (`20260709000200`) mechanically swapped
`is_org_admin_of_commission[_for]` → `is_commission_admin_of[_for]` (= org_admin of
org **OR** hospital_admin of hospital) across every commission-scoped site,
including the live `can_read_action_item` itself. The satellites therefore align
byte-for-byte with the hub's own post-swap predicate. Net effect: hospital_admin is
included in the admin arm — a platform-wide convention, not an AI-track widening. No
change requested; flagged only so it is not later mistaken for RLS drift.

### INFO-2 — updates audit trigger defensively handles UPDATE/DELETE
`app.trg_audit_action_item_updates` guards all three TG_OPs though the updates feed
is append-only (no update/delete RPC). Harmless defensive coding; consistent with
the sibling triggers.

### INFO-3 — reminder→N scan arm correctly deferred
BE-6·N (`compute_due_notifications` union arm, plan §3) is inert/out of this gate by
design — the arm does not exist until it lands as a fast-follow. Reminder rows are
fully CRUD-able with zero delivery until then, exactly as X-ζ promises. Not in scope
for this review.

---

## E2E status (as relayed)
Tester reported the new `e2e/action-items-satellites.spec.ts` **9/9 green** (§7.1–7.8
+ §7.11 a11y, run twice on a fresh reset, 0 bugs) and pgTAP `227` **64/64** on a
fresh reset (full suite 2389/2389). The lead's full `e2e:prod` gate was running in
parallel at review time — this verdict covers requirements/code/security/RLS; the
final prod-gate green is the lead's to confirm before Record.

## Verdict
**✅ APPROVED.** Every plan §8 charge is met: the SELECT policies are verbatim
`can_read_action_item` reuse with no drift and no authenticated write policy; O-1 is
fail-closed and pgTAP-locked (stricter on satellites than the hub); O-2 write
authority matches the ratified stakeholder-gated default; the `list_my_action_items`
widening is purely additive; CAPA stays fully isolated; conventions (t19, audit
structural-only, Rules 7/9/10, strict TS) are clean. No blocking or major findings.
MINOR-1 is an optional test-hardening cell the lead may close before Record.

---
---

# BE-6·N delta review — reminder→N scan arm (2026-07-14)

**Scope:** a focused DELTA audit of BE-6·N ONLY — the action-item reminder →
`compute_due_notifications` scan arm folded into the already-APPROVED AI phase. The
satellites + cross-link UI (reviewed above) are NOT re-reviewed. Files audited:
migration `20260720000970_action_item_reminder_scan_arm.sql`; the engine it extends
(`…000700_notifications_core.sql`); pgTAP `226_notifications.sql` (assertions 19a–19r);
`src/lib/queries/notifications.ts`, `src/lib/routing.ts`; the source-of-truth predicate
`app.can_read_action_item` (`…000707_fold_case_action_items.sql`) and the pre-970
`advance_committee_action_item` body it was rebuilt from; the `000709000200` symbol
sweep. Read-only throughout; I did not re-run pgTAP (tester declared the full **2412**
suite green, incl. `226` **69/69** and `187`) — this verdict is a static+cross-reference
audit of the delta's invariants.

## 1. Security — the Open-#3 notify gate (highest priority): **PASS**
The arm's notify gate is `continue when not app.can_read_action_item(r.item_id,
r.recipient)` (migration L244). This is **not a re-implementation** — it is a call to
the very same DEFINER function that backs the `action_items` hub SELECT visibility and
both satellite SELECT policies (`…000707` L333/L338). Drift is therefore structurally
impossible: the notify gate and the row's read visibility are literally one predicate.
I confirmed the helper's `case_restricted` arm is `can_read_case(coalesce(
source_case_id, case_id), p_uid)` (`…000707` L264-265) — byte-equivalent to the inlined
hub policy (L310-312), differing only in the uid-parameterized `_for` variant names. So
a `case_restricted` item's title can reach a recipient **only** if that recipient passes
`can_read_case`; an `assigned_to`/owner who cannot read the case is filtered out before
`enqueue_notification` is ever called. Both directions are pgTAP-locked with a **real
`case_restricted` case** and `case_access` **ON** (the strict gate): 19k (recipient
`st_x`, plain member, cannot read the case ⇒ **0 rows**) and 19l (recipient `sa_x`,
staff_admin, can read the case ⇒ **1 row**). The two assertions share one case and differ
only in the recipient's case-read authority, so together they prove the gate
discriminates on `can_read_case` and is not a blanket allow/deny. No leak.

## 2. Recipient resolution: **PASS**
Single recipient = `coalesce(a.assigned_to, (active owner assignment, role='owner' AND
completed_at IS NULL, LIMIT 1))` (L215-223). `continue when r.recipient is null`
(L242) guarantees no null-user row for an unassigned/ownerless item. pgTAP 19f proves
owner-fallback fires; 19g proves an unassigned + no-owner item emits nothing.

## 3. PHI-free (Rule 12): **PASS**
The arm's FROM/JOIN set is `action_item_reminders`, `action_items`,
`action_item_statuses`, `action_item_assignments` — **no case/answer/event/patient
join**. `title` = a static pt-BR heading (`Item de ação vence em breve` / `atrasado`),
`body` = the item's own `a.title` (config-level, the hub is a non-PHI surface). pgTAP
19j pins `body = 'AI antes (ok)'` (the item title) and `kind = action_item`. No PHI
reaches the notification row.

## 4. Additive domain widening: **PASS**
Both CHECK recreations (drop + re-add) only **add** a value — `kind` gains
`'action_item'` alongside the existing capa/signoff/meeting (L64-68); `entity_type`
gains `'action_item'` alongside the existing three (L70-76). No value removed, no row
rejected. `milestone` CHECK is **untouched** — the arm reuses the already-allowed
`due_soon`/`overdue` (before/on → due_soon, after → overdue). Confirmed additive.

## 5. Grant integrity / no new public RPC: **PASS**
`compute_due_notifications` is changed via **`create or replace`** (never drop+create),
then re-issues `revoke all … from public` + `grant … to service_role` (L263-264) —
belt-and-suspenders; it stays **service_role-only** (no authenticated grant). No new
`public.*` RPC is introduced by this migration ⇒ **no t19 concern**. `advance_` is
likewise `create or replace` with its full revoke/grant re-issued (L369-371). Consistent
with the "new public RPC needs REVOKE FROM PUBLIC" rule (n/a here — no new RPC).

## 6. `advance_committee_action_item` DEFINER-rebuild integrity: **PASS**
I diffed the 970 rebuilt body against the pre-970 live definition (fold `…000707`
L610-689, as regenerated by the `000709000200` symbol sweep). The bodies are
**identical** except for exactly two deltas, both expected:
  (a) the else-branch authority reads `app.is_commission_admin_of(v_commission_id)`
      (970 L336) where the on-disk fold text read `is_org_admin_of_commission` — this is
      precisely the `000709000200` sweep's `replace(is_org_admin_of_commission →
      is_commission_admin_of)`, i.e. the 970 body faithfully reproduces the **live**
      (post-sweep) symbol, and would have **reverted** the sweep had it re-copied the
      stale fold text. Correctly avoided.
  (b) the added `if v_is_terminal then perform app.resolve_notifications_for(
      'action_item', p_id); end if;` (L360-362), placed after the status-history insert,
      before `return`.
All source-aware authority is intact and unchanged: the `case` branch still runs
`assert_extras_enabled` + `assigned_to`/`can_write_case_content` (HC027); the
meeting/manual branch still runs `assigned_to`/`is_staff_admin_of`/`is_commission_admin_of`
(HC037). No authority weakening or drift. pgTAP `187` (the commission-admin symbol-sweep
guard) is in the green 2412 suite.

## 7. resolve-on-complete correctness: **PASS**
`complete_committee_action_item` resolves the `done` status and **delegates** to
`advance_committee_action_item(p_id, v_done_id, null)` (`…000707` L726), so the single
resolve site inside `advance_` (gated on `v_is_terminal`) covers **both** the complete
path (→ `done`) and the cancel path (→ any terminal status). pgTAP 19o proves a
completed item's open reminder is stamped `resolved_at`. Because the arm always enqueues
with `is_reminder = true`, `resolve_notifications_for` (which touches `is_reminder =
true` rows) clears it — so the reminder drops out of `listNotifications`/`getUnreadCount`
(both filter `resolved_at IS NULL`). Consistent end-to-end.

## 8. Audit posture: **PASS (consistent, not an omission)**
N sits outside the Rule-11 audit trail by design (ADR 0076 decision 13 — own-data,
source events already audited). The arm adds no `audit_write`, which is correct. Note the
domain mutation is still audited on its own terms: `advance_` continues to write an
`action_item_status_history` row (audit-triggered) for the transition; only the
notification side-channel is audit-exempt.

## 9. Rules 8/9/10: **PASS**
`kind`/`entity_type` are `text` columns (CHECK-constrained, not PG enums), so the widening
produces a **nil diff** in generated `database.ts`; the widened unions in
`notifications.ts` (`NotificationKind`/`NotificationEntityType` += `action_item`, new
`NotificationSurface = capa|signoff|meeting`) are hand-maintained domain types layered on
top — correct per Rule 8. Reads flow through `src/lib/queries/notifications.ts` (Rule 9).
User-facing headings are pt-BR (Rule 10). The `NotificationSurface`/`NotificationKind`
split correctly keeps `action_item` out of the preference UI, and because
`notification_preferences.surface` CHECK admits only capa/signoff/meeting, the
`enqueue_notification` suppression sub-query can never match an `action_item` row — so
action-item reminders always deliver (the intended "no pref surface = always deliver"
behavior), no dead-suppression path.

## Findings
- **0 Blocker · 0 Major · 0 minor · 3 Info.**
- **INFO-N1** — the cancel→terminal resolve path is covered by construction (same
  `v_is_terminal` branch as complete) but is not independently pgTAP-asserted; 19o
  exercises only the complete path. Safe; an optional coverage add.
- **INFO-N2** — the owner-fallback subquery is `LIMIT 1` with no `ORDER BY`, so among
  multiple active owners it picks an arbitrary one. Harmless: `assigned_to` takes
  precedence, any active owner is a legitimate `can_read`-passing recipient, and the
  single-recipient contract is the locked plan §3 X-ζ shape.
- **INFO-N3** — 19k/19l prove Open #3 with two distinct recipients on one shared case
  (rather than one user against two items). This is a valid both-directions proof; a
  same-user two-item variant would be marginally more airtight but adds nothing material.

## Delta verdict
**✅ APPROVED (BE-6·N delta).** The Open-#3 notify gate is a verbatim reuse of the read
predicate with structurally-impossible drift, pgTAP-locked both directions on a real
`case_restricted` case; recipient resolution is null-safe; the enqueued title/body are
PHI-free; the CHECK widening is additive with no milestone change; grants are intact with
no new public RPC; the `advance_` rebuild reproduces the live post-sweep authority with
only the terminal resolve call added; resolve-on-complete is correctly single-choke-point
and covers complete + cancel; audit posture matches ADR 0076 decision 13. No blocking,
major, or minor findings — the whole AI phase (satellites + cross-link + BE-6·N) is clear
for Record.
