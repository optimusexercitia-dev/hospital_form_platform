# QA Review — Action-Items Fold + `visibility_scope` + Case-Access Expiry

**Feature:** ADR [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md) —
fold `case_action_items` into the shared `action_items` hub as `source_type='case'`, add the
per-row `visibility_scope` scope-aware RLS, and add `case_access` grant expiry + reason.
**Migrations:** `20260707000000_fold_case_action_items.sql`, `20260708000000_case_access_expiry.sql`.
**Reviewer:** `qa` · **Date:** 2026-07-02 · **Method:** SQL-read of both migrations + the repointed
app layer, then **live probes against the local Docker DB** (both migrations applied; RLS matrix
executed under `set role authenticated` + JWT claims for real personas). Probe rows cleaned up
afterward (audit rows are append-only/hash-chained and intentionally left).

## Verdict: **APPROVED**

0 BLOCKER · 0 MAJOR · 0 MINOR · 4 INFO. The RLS surface — the substance of this review — is
correct and was verified live, not merely by reading SQL. The existence leak the feature set out
to close is closed; the six-consulter expiry lockout is complete; ADR-0033-D4 write-grantee
authority is preserved and correctly bounded; audit copies no free-text/PHI; the drop is complete.

---

## What was verified live (evidence)

### 1. Scope-aware RLS matrix — PASS (the headline result)
Built three hub rows on a **clean** CCIH case (`d0…c2`: 0 referrals, phase-assignee = staff1, no
narrative/grant confounds) — a `source_type='case'` row (guard-forced `case_restricted`), a
`committee` manual row, and an `assignees_only` manual row (assigned to staff4) — each with a
`status_history` row (carrying a `SECRET-*` comment) and, for the case row, an `assignments` row.
Probed SELECT visibility on the hub **and both satellites** under RLS for five personas:

| Persona | case_restricted | committee | assignees_only | case satellites (hist / assign) | assignee satellite |
|---|---|---|---|---|---|
| chefe (staff_admin) | ✅ | ✅ | ✅ | ✅ / ✅ | ✅ |
| staff1 (phase-assignee) | ✅ | ✅ | ⛔ | ✅ / ✅ | ⛔ |
| **staff3 (plain member)** | **⛔** | ✅ | ⛔ | **⛔ / ⛔** | ⛔ |
| staff2 (case_access grantee) | ✅ | ✅ | ⛔ | ✅ / ✅ | ⛔ |
| staff4 (assignee-only) | ⛔ | ✅ | ✅ | ⛔ / ⛔ | ✅ |

Every cell matches the Q5 contract. The **plain member sees only the `committee` item** and is
blind to the case-restricted row *and both its satellites* — no leak through
`status_history.comment` or through `assignments`. **Existence leak closed.** `assignees_only` is
visible only to its assignee + staff_admin (not the phase-assignee, grantee, or plain member).
*(An earlier apparent leak was a tainted fixture — the first case I picked had a stray narrative
assignment + was referral-touched, both of which legitimately grant `can_read_case`. Re-run on a
clean case gave the matrix above.)*

### 2. Guard invariant (Q3/Q4) — PASS
- Inserting a `source_type='case'` row with `visibility_scope='committee'` → guard **force-set
  `case_restricted`** (verified: `forced_scope=case_restricted`).
- `UPDATE … set visibility_scope='committee'` on a case row → **re-forced to `case_restricted`**
  (a case item can never be made committee-visible, on INSERT or UPDATE).
- The single 3-source link CHECK (`action_items_case_link_check`, having folded in the old
  meeting-link CHECK) is **complete**: all four malformed inserts rejected — case w/o
  `source_case_id`, meeting carrying a `source_case_id`, manual carrying a meeting col, and case
  carrying a stray `case_id` cross-link. The malformed case/meeting rows are caught by the guard's
  FK-existence check first, the manual-with-meeting and case-with-crosslink by the CHECK directly.

### 3. Case-source RPC authority — ADR-0033-D4 **holds** (PASS)
- A **write-grantee who is only a `staff` member (not staff_admin)** successfully created a case
  action item via `create_committee_action_item` — D4 preserved (write-grantees keep managing case
  items).
- A **read-only grantee** was denied (`você não pode criar itens de ação neste caso`, 42501) —
  `can_write_case_content` correctly requires `level='write'`.
- **advance/complete (HC027):** the **assignee** (not a content-writer) advanced their own case
  item; an **outsider** (not assignee, no active grant) was denied with the HC027 pt-BR message.
- All touched RPCs (`create/update/advance/complete/delete_committee_action_item`,
  `grant_case_access`, `list_case_access`, `can_read_action_item`, `guard_action_item`) are
  **SECURITY DEFINER, owner postgres, `search_path=app, public, pg_catalog`** (verified from the
  catalog). **t19 anon-exec guard:** EXECUTE ACL is `{authenticated, postgres, service_role}` on
  every RPC — **no PUBLIC, no anon**; a live `set role anon` execute attempt was denied.

### 4. Six-consulter expiry (Rule 12 critical) — PASS
The filter `(ca.expires_at is null or ca.expires_at > now())` is present in the **live** body of
all six consulters (confirmed by inspecting each `pg_get_functiondef`, not just the migration
text): `app.can_read_case`, `app.can_read_case_patient`, `app.can_write_case_content`,
`app.referral_target_analyst` (feeds `can_read_referral_phi` — the PHI arm), `get_member_overview`
(case-count grant arm), and `public.list_my_cases` (**both** arms — the `my_role` chip and the list
membership; two occurrences). Behavioral checks:
- Expiring a **read** grant → `app.can_read_case` flips to `false` (the case_restricted item goes
  invisible for that grantee).
- Expiring a **write** grant → `create_committee_action_item` on the case is denied
  (`can_write_case_content` honors expiry). "Expired means expired everywhere."

### 5. Audit (Rule 11) — PASS
- Folded case rows **now emit `action_item.*` audit rows** — verified an `action_item.created` for
  a `source_type='case'` row (coverage the old `case_action_items` table never had).
- The diff allow-list is exactly
  `{source_type, status_id, urgency_id, due_date, assigned_to, case_id, source_case_id,
  source_case_phase_id, visibility_scope}` — **no `title`, no `description`**; no free-text/PHI
  copied into the log.
- `trg_audit_case_access` tracks `{level, expires_at, reason}` — observed all three in live diffs.

### 6. Drop completeness — PASS
`public.case_action_items` = **DROPPED**; `create/update/advance/complete_action_item` and
`app.advance_action_item_core` = **NONE** in the catalog. No application-code references remain
(the only source hits are comments describing the fold and the type-generation artifact); the
migration-file grep hits are the fold migration itself and the earlier migrations that defined the
now-dropped symbols.

### 7. Frontend (`case-access-panel.tsx`) — PASS
- **Rule 9:** no inline supabase-js — grant/revoke go through `@/lib/case-access/actions`, and the
  grant rows come from `listCaseAccessGrants` (backed by `list_case_access`). **Rule 10:** all
  user-facing strings pt-BR.
- **a11y:** the grant dialog uses `Dialog`/`DialogTitle`/`DialogDescription`; level is a
  `fieldset`/`legend` radiogroup with visually-hidden native inputs (selection conveyed by border +
  fill + text, not colour alone); the expiry select and date picker are labelled with
  `aria-describedby` wired to the inline error; the **expired badge is icon (`CalendarClock`) +
  "Expirada" text** — not colour-alone.
- The dialog passes expiry as an end-of-day ISO string (or `null` for "sem prazo") and the trimmed
  reason (or `null`) to `grantCaseAccess`, which validates a future expiry client-side (clean field
  error) before the RPC re-checks. Prefills correctly when editing an existing grant (upsert).
- strict-TS: `npm run typecheck` clean; `npm run lint` 0 errors (89 pre-existing e2e unused-var
  warnings, none in any touched file).

### 8. Backend's two beyond-spec decisions — both VALID (PASS)
- **(a)** Folding the old meeting-link CHECK into one 3-source `action_items_case_link_check` is
  correct and complete — proven by the malformed-insert rejections in §2.
- **(b)** Redefining `get_member_overview` in **migration 2** (not migration 1) for the expiry
  filter is ordering-correct: `20260708` is the newest applied migration, and the **live** body
  carries the `ca.expires_at` filter — so the expiry-aware definition is the one that won. Migration
  1's own definition (correctly) does not reference `case_access.expires_at`, since that column
  does not exist until migration 2.

### Build / tests
`npm run typecheck` clean · `npm run lint` 0 errors · `npm run test` **193/193** pass. (Full E2E
gate is the lead's to run against the prod build.)

---

## INFO (non-blocking; no change required)

- **INFO-1 — Hub SELECT policy inlines the disjuncts; satellites call the helper.** Intentional
  and documented (row columns are in scope for the hub policy but not the satellites); both paths
  yield identical authority, verified by the matrix. The cheap `visibility_scope = '…'` equality
  guards each helper call, per `security-rls-performance`.
- **INFO-2 — Per-row parent lookup in `can_read_action_item` on the satellites.** Platform norm
  (mirrors `commission_of_action_item`); both FK columns (`source_case_id`, `source_case_phase_id`)
  are indexed. Acceptable at expected satellite volumes.
- **INFO-3 — `list_case_access` returns expired rows unfiltered (by design).** It is the config
  read that powers the panel's "Expirada" badge, not an authority predicate, so it must return
  expired grants. All *authority* predicates filter them out (§4). Consistent with ADR 0050 §5.
- **INFO-4 — BUG-AIF-001 (mutation dialogs don't close on the standalone prod build).** Confirmed
  pre-existing and out of scope per the task brief — stale `revalidatePath('/c/[slug]/…')`
  constants authored pre-multi-tenancy, failing identically for untouched docs/tags flows; a
  dedicated fix task is already spun off. Noted here for completeness only, not a blocker for this
  feature.

## Cleared for human approval.
