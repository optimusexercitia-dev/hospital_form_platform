# QA Review — Member "Visão Geral" + "Meus itens de ação"

**Verdict: APPROVED**

**Reviewer:** `qa` · **Date:** 2026-07-02
**Scope:** two additive, current-commission-scoped, read-only UI features:
1. "Meus itens de ação" — new page + MEU TRABALHO nav item; unified self-scoped
   list unioned across `case_action_items` + `meeting_action_items` (NOT CAPA).
2. "Visão Geral" rebuild — commission-root `page.tsx` five member count cards
   (same for staff + staff_admin); coordinator `/dashboard` untouched.

**Files audited (read-only):**
`supabase/migrations/20260704000000_member_overview_action_items.sql`,
`supabase/tests/181_member_overview.sql`,
`src/lib/queries/action-items.ts`, `src/lib/queries/overview.ts`,
`src/app/o/[org]/c/[commission]/meus-itens-de-acao/{page,loading,error}.tsx`,
`src/components/action-items/{action-items-table,action-item-badges,format}.{tsx,ts}`,
`src/app/o/[org]/c/[commission]/page.tsx`,
`src/components/shell/app-sidebar.tsx`,
`src/app/o/[org]/c/[commission]/layout.tsx`.
Cross-referenced against `app.can_read_case`, `public.my_pending_meeting_signatures`,
the `cases`/`*_action_items`/`meetings`/`meeting_attendees`/`meeting_signatures`
table definitions, and the member-reachable `casos/[caseId]` + `meetings/[meetingId]`
routes.

---

## Focus-area findings

### 1. RLS / leak audit of the two RPCs (most important) — PASS

Both RPCs are `SECURITY DEFINER`, `STABLE`, `owner to postgres`, and pin
`search_path` to `'app', 'public', 'pg_catalog'`. Grant posture is correct:
`revoke all ... from public` precedes `grant execute ... to authenticated`
(+ `service_role`) for both — the t19 anon-exec guard is satisfied and asserted
directly by `181_member_overview.sql` (both `has_function_privilege('anon', …)`
= false; `authenticated` = true).

**Self-scoping.** Every arm carries an explicit `= auth.uid()` predicate on the
source table itself, and both RPCs fail closed on `auth.uid() is null`
(`'[]'` / an all-zero object). `list_my_action_items`: `cai.assigned_to = v_uid`
and `mai.assigned_to = v_uid`. `get_member_overview` counts: case attribution via
`cp.assigned_to = v_uid` / `cn.assigned_to = v_uid` / `ca.user_id = v_uid`;
pending items `cai/mai.assigned_to = v_uid`; meetings/signatures
`a.user_id = v_uid`; drafts `r.created_by = v_uid`. No arm can return another
member's rows.

**Label joins expose only PHI-free columns.** The case join surfaces
`c.case_number` (integer per-commission counter) and `c.label`; the meeting join
surfaces `m.meeting_number` + `m.scheduled_start`; creator resolves to
`profiles.full_name`. No `*_md` / free-text / answer payloads / `case_patient` /
PHI columns are selected. Per ARCHITECTURE Rule 12 (line 208) short `label`/title
fields are governance metadata kept PHI-free by input policy; the Cases-module PHI
is isolated in `case_patient` and the free-text bodies (`case_narratives.body_md`,
`case_events.body`) — none of which either RPC touches.

**Sub-entitlement note (examined, not a defect).** `create_action_item` requires
the assignee be a commission member but NOT a `can_read_case` reader of that
specific case; so one can be the assignee of a case action item on a case one
cannot otherwise read. `list_my_action_items` therefore may surface a PHI-free
`case_number`/`label` for such a case. This is correct and minimum-necessary: the
row is the caller's own deliberately-assigned task, the exposed material is
PHI-free governance metadata, and the "Gerado de" link only activates to
`casos/{id}` when `case_access` is ON — where `getCaseDetail` re-enforces
`can_read_case` server-side and 404s a non-reader (verified in
`casos/[caseId]/page.tsx`). No content behind `can_read_case` leaks.

**Audit rows.** Correctly none: these are self-scoped reads of the caller's own
work / own aggregate counts over no PHI table — Rule 11 requires an audit row only
for reads of *another* member's data or of PHI. Consistent with the module docs.

### 2. Count 1 correctness (`casesNotConcluded`) — PASS

Faithful to `app.can_read_case`'s attribution logic and to the human spec:
- phase attribution (`case_phases.assigned_to = v_uid`) OR narrative attribution
  (`case_narratives.assigned_to = v_uid`) count **regardless** of the
  `case_access` flag;
- the explicit grant leg (`case_access.user_id = v_uid`) is gated on
  `v_case_access_flag`;
- the whole count is gated on `cases_extras` (returns 0 otherwise);
- non-terminal only: `status not in ('concluido','cancelado')`, exactly the two
  terminal states of the `cases_status_check` enum
  (`nao_iniciado, pendente, em_revisao, concluido, cancelado`).

This mirrors `can_read_case`'s flag-ON disjuncts (staff_admin / org_admin / grant /
phase / narrative) reduced to the *personal* attribution subset, and its flag-OFF
fallback is not applicable to a "personally attributed" count. `181_member_overview.sql`
asserts the load-bearing case: a phase-assignee with no grant is counted in
`cases_not_concluded` **with `case_access` OFF** (t17), and the pgTAP suite is green
(1277/1277).

### 3. Flag handling — PASS

A source whose flag is off is omitted from the union with no error: each union arm
guards on `app.feature_enabled('cases_extras')` / `('meetings')` inline, so an
off source contributes zero rows (asserted by t11: `meetings` OFF → only the case
item remains). In `get_member_overview` every flag-dependent block is wrapped in
`if v_*_flag then …` over pre-initialized `0`/`null` accumulators, so a disabled
feature yields `0`/`null` and never raises. Layout composes the nav flag correctly
(`actionItemsOn = casesExtrasOn || meetingsOn`) and the sidebar gates the item on
it (`requiresActionItems`).

### 4. Frontend correctness — PASS

- **Rule 9.** Components contain no inline supabase-js; all data flows through
  `listMyActionItems` / `getMemberOverview`, which are the only callers of the two
  RPCs. Both RPCs are present in the regenerated `src/lib/types/database.ts`
  (Rule 8).
- **Case link target.** The action-items "Gerado de" case link targets
  `casos/{caseId}` (member-reachable), degrading to plain text when
  `caseDetailLinkable` is false (`case_access` OFF, where that route 404s) — not
  the coordinator `manage/cases` route. The overview cases card likewise targets
  `meus-casos` (flag ON) / `minhas-fases` (flag OFF), mirroring the sidebar pair;
  all card targets (`meus-itens-de-acao`, `meetings`, `respostas`, `minhas-fases`,
  `meus-casos`) exist as routes.
- **Status vs source vocabulary.** `ActionItemStatusBadge` maps the action-item
  lifecycle (`open/in_progress/done/cancelled`), matching the
  `*_action_items_status_check` CHECK — NOT the case-status enum.
  `ActionItemSourceBadge` is a distinct neutral outline type discriminator
  (Caso/Reunião), visually separated from the colored status pill.
- **Filter/sort.** Default filter = active (open+in_progress) with a
  done/cancelled toggle; source-type filter; sort overdue-first then due-date asc
  (nulls last) then createdAt desc — computed client-side in `compareItems`,
  independent of the RPC's stable default order. Date-only `due_date` is parsed as
  a LOCAL date (`parseLocalDate`), avoiding the UTC-midnight off-by-one in Brazil's
  negative offset. `isOverdue` correctly restricts "overdue" to active items only.
- No double-counting risk in count 3 (meetings): `meeting_attendees` has a unique
  `(meeting_id, user_id)` index. Count 5 (`pendingSignatures`) is a faithful,
  commission-scoped re-expression of `my_pending_meeting_signatures`
  (attendance=`presente`, meeting=`em_assinatura`, no `signed` signature).

### 5. Standards (pt-BR, a11y, errors, TS strict) — PASS

- **pt-BR** throughout all user-facing copy (headings, filter legends/labels,
  empty states, error boundary, badge labels, hints).
- **Accessibility.** Real table semantics (`<table>` with `scope="col"` headers +
  `sr-only` `<caption>`); the source filter is a labeled `role="radiogroup"` of
  keyboard-operable `role="radio"` buttons inside a `<fieldset>`/`<legend>`; the
  resolved toggle is a real labeled `<input type="checkbox">`; visible
  `focus-visible` rings on every interactive element; overdue conveyed by icon +
  text + an `sr-only "(em atraso)"` (not color alone); `StatCount` honors
  `prefers-reduced-motion` and always falls back to the true value.
- **Errors.** The `error.tsx` boundary shows a friendly pt-BR message + retry and
  logs the raw error to the console only; query modules fail closed (`[]` / `ZERO`)
  and never surface a raw Postgres error.
- **TypeScript strict.** No `any` (grep hits are the English word in comments). The
  two `as unknown as <RowShape>` casts narrow the RPC `Returns: Json` to the
  documented snake_case row interfaces — the established pattern for jsonb-returning
  RPCs, appropriately localized to the query layer, not `any`.

---

## Hygiene

- `PROGRESS.md` / ADR hygiene is the lead's to finalize at the Record step; no
  blocking issue observed in the reviewed surface. The features are additive and
  reuse the established feature-flag, routing, and query-layer conventions, so no
  new ADR is strictly required.
- No secrets, no service-role usage in client-reachable code.

## Non-blocking observations (MINOR / informational — no change required)

- **MINOR (informational).** `get_member_overview` recomputes the pending
  action-items union that `list_my_action_items` also builds. This is intentional
  (one round-trip for the overview vs. the full list for the page) and correct;
  noting only that the two count/list definitions must stay in lockstep if the
  union sources ever change. Both are pinned by `181_member_overview.sql`.
- **MINOR (informational).** The overview's `casesNotConcluded` deliberately omits
  the broad `staff_admin`/`org_admin` read legs of `can_read_case` (it is a
  *personal* attribution count, per the human spec and the doc-comment). This is
  the intended divergence, not a defect — flagged so a future reader does not
  "fix" it toward full `can_read_case` parity.

## Test status (context, not run by QA)

Feature E2E `e2e/member-action-items-overview.spec.ts` 16/16 green in isolation;
backend pgTAP 1277/1277. The full-suite AC-12 (exact counts) flake is cross-test
contamination (passes in isolation; tester hardening) and the 4 `user-registration`
failures stem from a pre-existing, unrelated `supabase/config.toml` SMTP change —
neither is attributable to this feature and neither blocks this review.

---

**Conclusion:** All deliverables are met; the two `SECURITY DEFINER` RPCs are
strictly self-scoped, PHI-free, and correctly gated; Count 1 is faithful to
`app.can_read_case`; flag handling omits/zeroes rather than raises; the frontend
respects Rule 9, targets member-reachable routes, and meets the pt-BR + a11y +
strict-TS bar. **APPROVED.**
