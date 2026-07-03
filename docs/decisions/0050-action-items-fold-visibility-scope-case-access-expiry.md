# ADR 0050 — Action-Items Fold, `visibility_scope`, and Case-Access Grant Expiry

**Status:** Accepted (human-approved plan, 2026-07-02) · **Date:** 2026-07-02
· **Feature:** three related increments on the shared `action_items` hub and the per-case
ACL, evaluated against a partner team's "Action Items & Strict Permissions" handoff and
adapted to this platform. Extends the shared-hub work (`20260706000000_shared_action_items.sql`)
and the Case-Access model (ADR [0033](./0033-case-access-control.md)); touches the referral
PHI door (ADR [0037](./0037-inter-committee-case-referrals.md)).

## Context

The shared non-PHI `action_items` hub unified the **meeting** and **manual** action-item
sources but left two gaps, surfaced while comparing our model to a partner team's handoff:

1. **Existence leak.** The hub's optional `case_id` cross-link is readable by every commission
   member (flat-membership `SELECT`), so a meeting/manual item that references a restricted case
   reveals that case's existence — and whatever its title says — even though `cases` itself is
   gated by `app.can_read_case`. Sensitive material also leaks through item titles and
   status-history comments (the partner doc's "leaks through comments/titles" trap).
2. **Parallel schema.** `case_action_items` duplicates the hub concept with a weaker feature set
   (no status history, no multi-role assignments, no urgency, **no audit trigger**) behind a
   different read predicate. Every future satellite (evidence, follow-ups, reviews, …) would have
   to ship twice.

Separately, the per-case ACL (`case_access`, ADR 0033) records grants as live state only
(`case_id, user_id, level, granted_by, granted_at`) with no expiry or stated purpose — weak for
LGPD minimum-necessary and ONA/JCI evidence ("who had access to this M&M case, why, and until
when"). The platform is **pre-launch** (no users), so a full local DB reset and destructive
drop of `case_action_items` are acceptable; hard-delete-plus-audit stays (no soft delete).

## Decision

1. **`visibility_scope` on the hub.** `action_items` gains `visibility_scope`
   (`committee` default | `case_restricted` | `assignees_only`), stored and CHECK-constrained.
   A new DEFINER predicate `app.can_read_action_item(item, uid)` drives the hub `SELECT` policy
   **and both satellite** policies (`action_item_assignments`, `action_item_status_history`):
   `committee` → member/org-admin; `case_restricted` → `app.can_read_case(coalesce(source_case_id,
   case_id), uid)`; `assignees_only` → an active assignment or `assigned_to`, plus staff_admin/
   org_admin always. Disjuncts are ordered so the cheap `visibility_scope = '…'` equality guards
   each helper call.

2. **Default-restrict with a coordinator override.** The guard trigger **hard-forces**
   `case_restricted` on `source_type = 'case'` rows (unrepresentable otherwise). For meeting/manual
   rows carrying a `case_id` cross-link, the `committee_*` RPC computes the default
   (`case_restricted` when cross-linked, else `committee`) and an explicit
   `p_visibility_scope = 'committee'` is the override — coordinator-only because the RPCs are
   already staff_admin/org_admin-gated. `assignees_only` is reserved (in the CHECK/policy, no UI
   sets it yet).

3. **Fold `case_action_items` into the hub as `source_type = 'case'`.** New `source_case_id`
   (FK cases, `ON DELETE CASCADE`) + `source_case_phase_id` (FK case_phases, `ON DELETE SET NULL`)
   mirror the meeting linkage; `case_id` stays the cross-link for meeting/manual only. Case rows
   use `status_id` with the global keys `open/in_progress/done/cancelled` (client label maps
   unchanged). The single `committee_*` RPC family branches authority by source — case create/update
   → `app.can_write_case_content` (**preserving ADR 0033 D4**, so write-grantees keep managing case
   items); case advance/complete → assignee **or** content-writer (HC027); delete → staff_admin/
   org_admin all sources. The four old case RPCs, `app.advance_action_item_core`, and the
   `case_action_items` table are dropped. Folded case rows gain status history + audit coverage
   they never had.

4. **Flag topology.** `action_items` is the master gate for the hub table and all `committee_*`
   RPCs; `cases_extras` additionally gates the case-sourced arms (RPC branch, `case_action_items_kpis`,
   the case arm of `list_my_action_items` / `get_member_overview`).

5. **Case-access grant expiry + reason.** `case_access` gains nullable `expires_at` + `reason`.
   The expiry filter `(expires_at is null or expires_at > now())` is applied to the grant arm of
   **all six** current consulters — the three read/write predicates, the `get_member_overview`
   count, **`app.referral_target_analyst`** (which feeds `app.can_read_referral_phi` — an expired
   grant must not retain referral PHI read; Rule 12), and **both arms of `list_my_cases`**. An
   expired grant means expired everywhere. Expired rows stay in the table (panel shows "Expirada";
   re-grant refreshes; revoke deletes). `grant_case_access` takes `p_expires_at` + `p_reason`;
   `list_case_access` returns them; the audit trigger tracks them.

## Alternatives rejected

- **Derive restriction from `source_type`/`case_id` in the policy (no stored column).** Rejected —
  hard-wires "case-linked ⇒ restricted" forever, leaves no room for non-case scopes, and makes the
  policy implicit rather than auditable per row.
- **Hard invariant with no override (case-linked always restricted).** Rejected in favor of the
  coordinator override so an innocuous "present Caso 0003 at the next meeting" item can stay
  committee-visible; loosening later would mean auditing existing overrides.
- **Keep `case_action_items` as a parallel hub-and-spoke replica.** Rejected — the divergence is
  *accidental* (same concept, same desired satellites, only the read predicate differs), so two
  schemas would double every future satellite. CAPA stays separate because its divergence is
  *essential* (PHI, Rule 12).
- **Required `reason` on every grant.** Rejected — friction makes it degrade to noise
  ("acesso"); optional-but-honest is better evidence than required-but-meaningless. Flipping to
  required at the RPC layer later is a one-line change.
- **Soft-delete folded rows.** Rejected — conflicts with the platform's hard-delete-plus-audit
  decision; the hash-chained audit log already preserves that a row existed.

## Consequences

- **RLS-shape change on the hub + two satellites** — reviewed as novel/security-sensitive (full
  QA RLS-matrix review). SQL-level probes cover the scope matrix and the expiry lockout.
- **Flag-semantics shift** — case items are dark if `action_items` is OFF (the table *is* the hub).
  Accepted; both flags are ON everywhere pre-launch.
- **Two migrations, local-first**, don't touch `20260706`; remote `db push` deferred to the human
  (queues with the pending phase-result migration). Types regenerated (Rule 8).
- **Closes the open QA INFO-N3 follow-up** (`listCaseAccess` for the access panel) as a side effect
  of the expiry work.
- **`referral_target_analyst` + `list_my_cases` scope correction** — the plan's initial exploration
  named only four `case_access` consulters; the backend caught two more (one PHI) during
  implementation. The corrected six-consulter set is the complete list (re-grepped).
