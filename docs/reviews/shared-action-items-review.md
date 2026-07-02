# QA Review — Option A: Shared (non-PHI) `action_items` table

**Reviewer:** `qa` (qa-reviewer)
**Date:** 2026-07-02
**Change under review:** Unification of the two non-PHI, membership-gated
action-item sources (meetings + manual) onto one shared `public.action_items`
hub. Migration `supabase/migrations/20260706000000_shared_action_items.sql` +
data layer + UI + tests.
**Binding spec:** `/Users/mike/.claude/plans/create-a-plan-for-tranquil-thimble.md`

## Verdict: **APPROVED**

The change meets the approved plan and the binding architecture rules. RLS is the
enforced boundary on all five new tables, the DEFINER-RPC write path is correctly
sealed off from direct `authenticated` writes, no PHI is introduced, CAPA and
Cases stay isolated/untouched, audit coverage is added (a Rule 11 win), and the
data-access + UI layers respect the ownership and pt-BR conventions. All findings
below are non-blocking (NIT/OBSERVATION); none warrants a change request.

I verified the security-critical properties **directly against the live local DB**
(container `supabase_db_azkbbhskturikxpgmafq`), not just by reading the SQL —
see "Live verification" per item.

---

## Dimension 1 — RLS coverage & correctness (SECURITY) — PASS

- **RLS enabled on all 5 tables.** Live: `pg_class.relrowsecurity = t` for
  `action_items`, `action_item_statuses`, `action_item_urgency_levels`,
  `action_item_assignments`, `action_item_status_history`. No `public` table in
  the DB has RLS disabled.
- **Hub SELECT** (`action_items_select`) = `is_member_of(commission_id) OR
  is_org_admin_of_commission(commission_id)` — flat membership (Option A),
  byte-for-byte identical to the dropped `meeting_action_items_select`
  (baseline:21742).
- **Hub WRITE** (`action_items_staff_admin_write`, `cmd = ALL`) has **both**
  `USING` and `WITH CHECK` = `is_staff_admin_of(commission_id) OR
  is_org_admin_of_commission(commission_id)`. The `WITH CHECK` blocks
  cross-commission reassignment (a member cannot move a row into a commission they
  don't administer). Matches the dropped policy exactly.
- **Satellites** (`assignments`, `status_history`) are SELECT-only, scoped via
  `app.commission_of_action_item(action_item_id)` membership; **no write policy**.
- **Lookups** (`statuses`, `urgency_levels`) are SELECT `true` to authenticated;
  **no write policy** — readable-but-not-authenticated-writable, as specified.
- **Default-deny confirmed empirically.** Although the migration issues
  `grant all on table … to authenticated` (table-privilege) on the satellites and
  lookups, RLS with no permissive write policy denies the write. Live test as
  role `authenticated`:
  - direct `INSERT` into `action_item_assignments` → `new row violates
    row-level security policy`
  - direct `INSERT` into `action_item_status_history` → same
  - direct `INSERT` into `action_item_statuses` → same
  So the only write path is the DEFINER RPCs (owner `postgres`, non-force RLS).
- **Cross-org / non-member wall.** pgTAP `171_cross_org_isolation.sql` asserts the
  platform admin sees 0 rows in `action_items`, `action_item_assignments`, and
  `action_item_status_history`; `182_action_items.sql` asserts a comm_y member and
  the membership-less admin read 0 comm_x items, and a plain member cannot
  direct-INSERT the hub (`42501`).
- **PHI:** the hub carries only governance metadata (title/description are
  committee to-do text, not clinical PHI) — no `event_patient`/`case_patient`
  shape, no MRN/name columns. CAPA (`capa_action*`) and Cases
  (`case_action_items`) are deliberately not touched (Rule 12 isolation intact;
  confirmed by grep — the migration references neither).

## Dimension 2 — RPC grants & authority (SECURITY, t19) — PASS

- All 8 affected `public.*` functions are `SECURITY DEFINER`, `owner = postgres`,
  `search_path = app, public, pg_catalog` (pinned). Live-verified via `pg_proc`.
- **No anon/PUBLIC EXECUTE** on any new RPC (live `routine_privileges` query
  returned empty for `anon`/`PUBLIC`). Each does `REVOKE ALL FROM PUBLIC` →
  `GRANT EXECUTE TO authenticated, service_role`. pgTAP `182` asserts anon cannot
  and authenticated can execute all six.
- **Authority checks are internal + `auth.uid()`-based:**
  - `create` / `delete` — `is_staff_admin_of OR is_org_admin_of_commission`
    (create additionally validates `assigned_to` is a member → `HC021`).
  - `advance` / `complete` — assignee (`assigned_to = auth.uid()`) OR
    staff_admin/org_admin, else `HC037`; the target status is validated
    global-or-this-commission (no cross-commission status injection).
  - `update` — staff_admin/org_admin.
  - All gate `feature_enabled('action_items')` first (`HC000` when off).
- pgTAP proves each gate: non-assignee non-admin advance → `HC037`; non-staff
  delete (even the assignee) → `42501`; non-member assignee create → `HC021`.

## Dimension 3 — Audit (Rule 11) — PASS

- `trg_audit_action_items` (INSERT/UPDATE/DELETE) emits
  `action_item.{created,updated,deleted}`; `trg_audit_action_item_status_history`
  emits `action_item.status_changed`. Both call `app.audit_write`, which is
  internally gated on `feature_enabled('audit_trail')` and hash-chains per
  commission.
- **No PHI/free-text copied into the log.** The `audit_diff` allow-list is
  `{source_type, status_id, urgency_id, due_date, assigned_to, case_id}` —
  structural columns only. `title` and `description` are deliberately excluded, so
  no committee free-text lands in the audit row. Correct per Rule 11.
- This **adds** audit coverage the old `meeting_action_items` never had — a net
  Rule 11 improvement. pgTAP `182` asserts one `.created`, three
  `.status_changed`, one `.deleted`, all commission-stamped to the item's own
  commission.

## Dimension 4 — Data-access discipline (Rule 9) — PASS

- All mutations route through the `committee_*` RPCs
  (`src/lib/meetings/actions.ts`).
- Reads route through `src/lib/queries/` (`meeting-action-items.ts`,
  `action-items.ts`, `overview.ts`, and the repointed count in `meetings.ts`).
- **UI components carry no inline supabase-js.** `action-items-table.tsx` and
  `action-item-badges.tsx` are pure presentational; the badge component is
  Server-Component-safe.
- `resolveActionItemStatusId` in `actions.ts` does an inline supabase-js `select`
  against `action_items`/`action_item_statuses` — this is **within** the
  `src/lib/` data-access layer (Rule 9 forbids inline supabase-js in *frontend
  components*, which this is not), so it is compliant. See NIT-1.

## Dimension 5 — Requirements audit vs the plan — PASS

- **5-table right-sized core** (hub + 2 lookups + 2 satellites); deferred
  satellites (updates feed, evidence, reviews, …) correctly omitted.
- **Configurable status/urgency with normalized `category`** + seeded global
  defaults (`commission_id NULL`); dual-unique (global vs per-commission) indexes
  present.
- **Status keys exactly `open/in_progress/done/cancelled`** with pt-BR labels
  (`Aberto/Em andamento/Concluído/Cancelado`) — the client label/style maps in
  `action-item-badges.tsx` map these unchanged.
- **Sources = `meeting` + `manual`**, enforced by CHECK; a `manual` row may not
  carry a meeting id and a `meeting` row must (live-verified: the
  `action_items_meeting_link_check` rejects a manual row with a `source_meeting_id`).
- **`assigned_to` + mirrored `owner` assignment + one-active-owner partial
  unique** all present; pgTAP proves the 2nd active owner is rejected (`23505`)
  and a new owner is allowed after the prior is completed.
- **Repointed readers** (`list_my_action_items`, `get_member_overview`)
  live-verified to read `public.action_items` with **zero** `meeting_action_items`
  references; the case arm and status-KEY return shape are preserved so the client
  is unaffected.
- **Old surface fully dropped** (live): the `meeting_action_items` table and all
  of `create/update/advance/complete_meeting_action_item`,
  `advance_meeting_action_item_core`, `guard_meeting_action_item` are gone.
- **UI**: "Meus itens de ação" nav gated on `cases_extras OR meetings OR
  action_items` (layout + sidebar consistent); the table adds the `manual`
  ("Avulso") source with an honest no-link badge.
- **pt-BR / English keys** (Rule 10): all user-facing strings pt-BR; keys/columns/
  comments English. Error text is pt-BR; raw Postgres errors are mapped through
  `mapMeetingError` and never surface raw.

## Dimension 6 — Best-practice guardrails — PASS

- **Every FK indexed** (live: no FK on the 5 tables lacks a leading-column index).
- **Partial indexes** present: one-active-owner
  (`action_item_assignments_one_active_owner_uidx where role='owner' and
  completed_at is null`) and active/overdue
  (`action_items_active_due_idx (commission_id, due_date) where completed_at is
  null`).
- Policy predicates call the `security definer` STABLE membership helpers
  directly (`is_member_of(commission_id)`) — the established house pattern; the
  helpers themselves use bare `auth.uid()` inside a definer body (consistent with
  the rest of the codebase). See OBSERVATION-1.
- No soft-delete (`deleted_at`) — hard-delete-with-audit by design, matching the
  old `meeting_action_items`.
- No views in the core, so no `security_invoker` concern.
- `npm run typecheck` passes clean (no `any` leaks; the one cast in
  `action-items.ts`, `data as unknown as MyActionItemJson[]`, is justified — a
  jsonb RPC return).

---

## Non-blocking findings

- **NIT-1 (Rule 9, informational).** `resolveActionItemStatusId`
  (`src/lib/meetings/actions.ts:986`) resolves a status key→id with two inline
  supabase-js selects rather than a dedicated `src/lib/queries/` helper or a
  key-accepting RPC. It is inside the data-access layer so it does not violate
  Rule 9, and it is correct (prefers the per-commission override, else global).
  If a future phase adds per-commission status vocabularies with UI, consider
  folding this into an `advance_committee_action_item_by_key` RPC so the app never
  round-trips the lookup. No action required now.

- **OBSERVATION-1 (consistency, not a defect).** The plan's guardrail list
  mentions `(select auth.uid())`-wrapped policy predicates. The delivered policies
  instead delegate to the `app.is_*` helper functions (which reference bare
  `auth.uid()` in a `security definer` body). This is the **established pattern**
  across the entire codebase (e.g. the dropped `meeting_action_items` policies,
  every `is_member_of`-based policy) and Postgres caches the STABLE function
  result per statement, so the initplan-optimization intent is satisfied. Keeping
  the house pattern is the right call; flagged only so the plan wording isn't
  read as unmet.

- **OBSERVATION-2 (test-harness note, no action).** The two feature-owned pgTAP
  files (`182`, `181`) could not be re-run standalone in my ad-hoc `psql` session
  (`function plan(integer) does not exist` / missing bootstrap fixture) — a
  search-path/runner artifact, not a test failure. The tester reports the full
  pgTAP suite green (1331) via the project runner, and I independently reproduced
  every security-critical property directly against the live DB, so the acceptance
  evidence is sound.

## Context accepted without re-litigation (per the task brief)
The 18 full-suite E2E failures were pre-root-caused by the lead to causes
unrelated to this change (full-suite state accumulation, a pre-existing missing
`narrativas` route, and local GoTrue auth rate-limiting from repeated resets). The
feature's own tests (pgTAP 1331, `member-action-items-overview` 16/16,
`phase10-meetings` 15/15, typecheck/lint) are green. I did not re-run the full E2E
suite.
