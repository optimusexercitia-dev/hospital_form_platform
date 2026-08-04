# User-permissions design — internal analysis & response to the external membership audit

**Date:** 2026-08-04 · **Status:** analysis only — no schema, app, seed, or test change made.
**Companion to:** [membership-model-audit-handoff.md](./membership-model-audit-handoff.md) (the external audit).
**Method:** every schema/RLS/RPC claim below was re-verified against the **live local catalog**
(`pg_constraint`, `pg_indexes`, `pg_policy`, `pg_class.relacl`, `pg_proc` incl. `prosecdef`,
`pg_trigger`, column ACLs) on 2026-08-04, per the standing "migration text is stale — the catalog
is truth" rule (ADR 0078 A28). App-side claims were verified against the current source
(`src/lib/queries/session.ts`, `src/lib/{members,users,admin,platform,org}/actions.ts`).

---

## 1. Verdict up front

**Agree with the external auditor's core conclusion: retain the single `memberships` table.**
The verification below found the current design is actually *stronger* than the handoff conveys
on the SQL side (§3.1) and *weaker* than it conveys on the application side (§3.3). All four
findings (M1–M4) reproduce against the live catalog; two of them (M2, M3) are sharpened here
with concrete, reachable defect paths the audit stated only abstractly. One of the audit's
recommended fixes (the M2 partial unique index) is **incomplete as written** and would break
`grant_role` and three UI actions if applied alone (§4.1) — that correction is the most
important delta in this report.

Recommended modifications, in priority order (detail in §4):

| # | Change | Origin | Priority |
| - | ------ | ------ | -------- |
| 1 | Package A (invariants) **plus the writer-sweep the audit omits** | audit M2/M4, corrected | High — before release hardening freeze |
| 2 | One session-context RPC (`I1`) as the *vehicle* for expiry/effective-grant parity | audit I1 + M1, elevated | High |
| 3 | Package B (one real mutation door, actor-validating service arm) | audit M3, endorsed | Medium — first post-pilot authz phase |
| 4 | Expiry: close the session parity gap now; full Package C only if/when a feature needs it | audit M1, modified | Medium |
| 5 | Role/scope-addition checklist + a completeness pgTAP grid | new | Medium |
| 6 | Defer `platform_role_grants`; keep `profiles.is_admin` | audit, endorsed | — |
| 7 | Satellites/partitioning only on evidence | audit, endorsed | — |

---

## 2. The current design, as verified

Four coexisting authorization planes, deliberately separate:

1. **Platform tier** — `profiles.is_admin`, surfaced JWT-first (custom access-token hook,
   ADR 0002) with a DB fallback in `app.is_admin()`. Bounded by the "noun rule" (ADR 0078
   A35): tenancy/identity/vocabulary/audit only, no commission content or PHI.
2. **Tenant tier** — `public.memberships`, the subject of the audit. Verified live:
   - 10 columns; 7 roles admitted by `memberships_role_check`; an exhaustive
     `CASE role … ELSE false` scope-shape CHECK (fails closed on any new role);
     `title_id` pinned to commission scope by CHECK **and** a BEFORE trigger; a second
     BEFORE trigger guards hospital↔org coherence.
   - `memberships_grant_uq` on `(principal_id, role, organization_id, hospital_id,
     commission_id)` **NULLS NOT DISTINCT** (PG17) — role is part of the key (→ M2).
   - RLS enabled; exactly one policy (`memberships_select`, SELECT, `authenticated`);
     `relacl` gives `authenticated` **SELECT only** — no write policy, no write grant.
   - Two `SECURITY DEFINER` doors, `public.grant_role` / `public.revoke_role`
     (search-path pinned, EXECUTE for `authenticated` + `service_role`), carrying:
     per-(scope,role) authority arms reusing the incumbent predicates, self-grant denial
     on every grant path, the staff_admin role-pin (no self-escalation), last-org-admin
     anti-lockout on revoke, idempotent `ON CONFLICT … DO NOTHING` grants.
   - **All nine surviving per-role RPCs (`assign_org_admin`, `assign_hospital_admin`,
     `assign_nsp_org_admin`, `assign_nsp_coordinator`, `add_pqs_member` + revoke twins)
     are thin wrappers that delegate to the doors** — verified via `prosrc`: none of them
     writes `memberships` directly. SQL-side, the kernel really is single.
   - Blanket audit trigger → `membership.granted` / `role_changed` / `revoked`;
     UPDATEs that don't change `role` (title, and — latently — `expires_at`) emit nothing.
   - Predicate family: `app.has_role`/`has_role_any` (expiry-aware) under the `is_*_of`
     wrappers, which additionally require `app.is_active(uid)`. 36 functions reference
     `memberships`, 32 of them DEFINER — the deep-seam argument for one table is real.
3. **Domain-participation planes** — `case_access_grants`, `case_participants` (+
   `case_participant_roles`, `case_assignment_roles`), the NSP roster. Correctly *not*
   memberships.
4. **Delegated capabilities** — `commission_administrativos` +
   `commission_administrativo_capabilities` (ADR 0061), flag-aware, layered on top of a
   `staff` membership. This is the platform's template for fine-grained permissions.

**Session layer:** `getSessionContext()` performs a profile read + four parallel
`memberships` reads (commission rows, `org_admin`, `hospital_admin`, `nsp_org_admin`),
none filtered by `expires_at`; account status (`is_active`/suspension) is enforced in TS
by `requireUser()`. TS authorization helpers (`authorizeStaffOps`, `authorizeForUser`,
`isCommissionAdmin`) derive authority from this bundle and then, on several paths, act
through the **service-role** client where RLS is not a backstop.

---

## 3. Assessment of the external audit, finding by finding

### 3.1 The one-vs-four question — agree, with a stronger argument than the audit gives

Endorsed. Beyond the audit's table of trade-offs, the wrapper-RPC verification above is
the decisive evidence: the platform *already ran* the four-surface experiment (three
membership tables pre-MEM, ~30 drifting predicates), collapsed it, and the collapsed
kernel demonstrably funnels every SQL-side mutation through one audited door pair.
Splitting storage again would re-create the drift surface that ADR 0075 closed. The
flexibility argument for four tables is fully answered by satellites (Package D) and the
separate-plane pattern already in use (`case_access_grants`, administrativo).

### 3.2 M1 (expiry not an end-to-end contract) — confirmed; scope it tighter

Reproduced exactly: `grant_role` has no expiry parameter; all 32 rows have
`expires_at IS NULL`; the audit trigger ignores an expiry-only UPDATE; the session bundle
does not filter expiry. Two sharpenings:

- **The parity gap is one-directional and the DB is the strict side.** DB predicates
  check expiry *and* `is_active`; the session layer checks `is_active` (via
  `requireUser`) but not expiry. So the only exploitable combination is exactly the one
  the audit names: a future expiry-setting feature + a **service-role-backed action
  authorized from the session bundle**. Nothing today can create that state — the risk is
  purely a landmine for a future phase.
- **An expiry UPDATE would also be an *unaudited* membership change** (the trigger's
  role-only UPDATE arm), violating Rule 11 the day the feature lands. The audit lists
  this under M1 recommendation 4; it deserves equal billing with the parity gap.

Modification to the recommendation: see §4.3 — do not build Package C speculatively, and
do not drop the column either; close the session-side gap now (it is ~one predicate in
one RPC once I1 lands) so the landmine is defused regardless of when expiry ships.

### 3.3 M2 (commission role cardinality) — confirmed, and it is UI-reachable today

The audit says "some service-role paths can insert the second role." Concretely:

- [members/actions.ts:164](../../src/lib/members/actions.ts#L164) — `addStaff` upserts
  `role='staff'` with `ignoreDuplicates: true` against `memberships_grant_uq`. Run it on
  a user who is already `staff_admin` of the same commission and the key does **not**
  conflict (different `role`) → the insert succeeds → the user now holds **both rows**.
  The code comment says this "never silently demotes them" — true, but it silently
  *duplicates* them instead. This is reachable from the members-management UI by an
  org_admin today.
- [users/actions.ts:687](../../src/lib/users/actions.ts#L687) — `assignCommitteeRole`
  delete-then-inserts, i.e. *assumes* the one-role invariant that no constraint enforces.
- Once dual rows exist, `getSessionContext()` returns two `Membership` entries for the
  commission and `getCommissionAccessByOrg` resolves the caller's role with `.find()` —
  first row wins, which is DB return order: the **effective role becomes
  nondeterministic**.
- `grant_role` itself has the same hole: `ON CONFLICT … DO NOTHING` on the grant key
  happily inserts `staff_admin` beside `staff` (currently only reachable for
  commission-tier grants via seeds/tests, since no product TS path calls `grant_role`
  with commission scope — see 3.4).

The audit's proposed partial unique index is right, but **insufficient as written** —
see §4.1 for the writer sweep it must ship with.

### 3.4 M3 (service-role bypasses of the single door) — confirmed; the split is starker than reported

The precise topology, verified by grep + `prosrc`:

| Mutation family | Sites | Goes through the kernel? |
| --- | --- | --- |
| Org/hospital-tier grant+revoke (UI) | `org/actions.ts`, `pqs/actions.ts` → wrapper RPCs | **Yes** (wrappers delegate to the doors) |
| Commission-tier revoke (UI) | `removeStaff` ([members/actions.ts:205](../../src/lib/members/actions.ts#L205)), `removeStaffAdmin` ([admin/actions.ts:319](../../src/lib/admin/actions.ts#L319)) | **Yes** (`revoke_role` over the cookie client) |
| Commission-tier grants (UI) | `addStaff` (members:164), `assignStaffAdmin` ([admin/actions.ts:276](../../src/lib/admin/actions.ts#L276)), `registerUser` committees ([users/actions.ts:513](../../src/lib/users/actions.ts#L513)) | **No — raw service-role upsert** |
| Committee replacement / removal (directory UI) | `assignCommitteeRole` (users:687 delete+insert), `removeCommittee` ([users/actions.ts:724](../../src/lib/users/actions.ts#L724) delete) | **No — raw service-role DML** |
| First-org_admin provisioning | [platform/actions.ts:196](../../src/lib/platform/actions.ts#L196) | **No — raw service-role upsert** (sanctioned by ADR 0075 §2.5) |

The sharpest way to say it: **`grant_role` has zero TypeScript callers.** Its only live
callers are the SQL wrapper RPCs. Every commission-tier grant the product performs is a
raw service-role write, meaning the door's self-grant denial, role-pin, shape mapping,
and any future arm (expiry, cardinality handling, anti-lockout) protect the org/hospital
tier but **not** the tier where most grants actually happen. TS-side gates
(`authorizeStaffOps` etc.) currently reproduce the door's policy faithfully — but as
duplicated authority with no structural link, which is exactly the drift class ADR 0079
("a new door must inherit every sibling arm") documents. Endorse Package B; sequencing
notes in §4.2.

One nuance worth preserving: ADR 0075 *chose* this split deliberately (the admin client
has no `auth.uid()`, so the doors as designed cannot serve it). M3 is therefore not a
regression to fix ad hoc but a designed trade-off to *retire* via the actor-param door —
which ADR 0075's consequences section explicitly anticipated and deferred.

### 3.5 M4 (trigger-only integrity → composite FKs) — confirmed, low, endorsed

Both BEFORE triggers verified live (`guard_membership_hospital_org_trg`,
`guard_membership_title_commission_trg`). Composite FKs are strictly better for the
catalog-auditability this project keeps paying for (see the D11 lesson: after the enum
re-key, only catalog-visible surfaces got re-swept). Keep the shape CHECKs, keep the
triggers until the FKs land in the same migration, add the `granted_by` index. Note
`commission_member_titles` needs the `(id, commission_id)` unique key first.

### 3.6 I1 (one session snapshot) — endorse, and elevate it

Agreed, but it is under-graded as a "latency improvement." One
`app.session_context()`-style DEFINER RPC is the **structural fix for M1's whole class**:
effective-grant semantics (expiry + `is_active` + suspension) defined once, in SQL,
consumed by both RLS-side predicates and the TS session — instead of mirrored in two
languages (this platform's condition-evaluator already carries that mirrored-semantics
burden by necessity; don't add a second instance where it isn't necessary). It also
collapses the 4-read fan-out. Recommend building it *before* Package B/C so those
packages have one seam to target. It must be tested as the product-called surface
(pgTAP over the RPC as `authenticated`, not just base-table policy tests).

### 3.7 Corrections to the handoff document itself

Small, but this project's history says name-drift in docs costs probes later:

1. The target-architecture diagram names **`case_access`** — the live table is
   **`case_access_grants`**.
2. It names **`surveyor_grants`** — **no such relation exists** in the live catalog; it
   is a future (Phase 18/19 mock-tracer era) concept and should be marked as such.
3. "Thirty-six live functions … 32 SECURITY DEFINER" — re-verified exact. ✔
4. The handoff does not mention that the per-role assignment RPCs delegate to the doors;
   absent that fact, a reader could believe SQL-side authority is also duplicated. It
   is not — the duplication is confined to the TS service-role paths.

---

## 4. Recommended modifications (what I would actually change)

### 4.1 Package A — adopt, **with the writer sweep the audit omits** (High)

The audit's `memberships_one_commission_role_uq` partial unique index is correct as the
invariant, but the handoff treats it as a drop-in. It is not — the enumeration boundary
must be *every writer of commission-tier rows*, not the index DDL:

- **`grant_role`** — its `ON CONFLICT (grant_uq columns) DO NOTHING` does not cover the
  new index's conflict; granting `staff` to an existing `staff_admin` would raise an
  unhandled `23505` out of the door. The door must gain an explicit arm: either
  role-replacement-as-one-transaction (delete + insert + one `role_changed` audit
  semantic) or a caught `unique_violation` mapped to a deliberate error code. Decide the
  semantic *first*; it becomes the single behavior every path inherits.
- **`addStaff`** (members:164) and **`assignStaffAdmin`** (admin:276) — their upserts
  target `grant_uq`; under the new index the dual-role attempt flips from "silently
  duplicates" to "generic pt-BR error". The intended UX (block with a clear message vs.
  replace) must be implemented, not inherited by accident.
- **`registerUser`** committees upsert (users:513) — same key, same review.
- **`assignCommitteeRole`** (users:687) — already delete-then-insert; becomes *correct*
  under the index but should move to the same replacement semantic (currently its two
  audit rows say revoked+granted where a replacement should say `role_changed`).
- **`seed.sql` + pgTAP fixtures** — assert none violates the index before it ships
  (a data-dependent migration; wrap per the backfill-guard-wrap lesson if it ever runs
  against a data-bearing remote).

Ship in the same package: composite FKs (M4), `granted_by` index, and catalog-driven
pgTAP: constraint/ACL census, direct-DML denial for `authenticated`, the dual-role
denial **with a revert-the-fix mutation check** (a green "no dual role" test that cannot
go red is vacuous — the no-regression-twin lesson).

### 4.2 One session-context RPC first, then Package B (High → Medium)

Order matters: build `app.session_context()` (I1, §3.6) first; it defines "effective
grant" once. Then Package B retires the raw service-role DML:

- Cookie-authenticated actions (`addStaff`, `assignStaffAdmin`) move onto `grant_role`
  over the cookie client — they *have* an `auth.uid()`; the service client remains only
  for GoTrue provisioning around them.
- Genuinely actor-less paths (`registerUser`'s committee seeding, first-org_admin
  provisioning) get the actor-param door ADR 0075 anticipated: a **service-only**
  (`EXECUTE` revoked from `authenticated`) `grant_role_for(p_actor, …)` that re-runs the
  same authority arms against `p_actor` in SQL and audits atomically. Implement it as a
  refactor of the existing door body to an internal `(actor, …)` function with the
  current doors as `auth.uid()` wrappers — one kernel, zero drift between the two entry
  points.
- End state = audit's: no raw `memberships` INSERT/UPDATE/DELETE in application code.
  Verify with a lint/grep gate (`from('memberships').(insert|upsert|update|delete)`)
  so the invariant survives future features, plus the ADR 0079 door-audit sweep.

This is a real authz phase: phase gate, authz-handoff §7 first, mutation-tested
keystones (grant/revoke authority, self-grant, role-pin, anti-lockout — including that
anti-lockout now also binds the service path, which it currently does not).

### 4.3 Expiry (M1) — defuse now, build later (Medium)

Disagree with both of the audit's poles (full Package C now, or drop the column).
Expiry is a *plausible* near-feature for this domain (interim committee appointments,
external surveyors), so the column and the already-expiry-aware predicates are worth
keeping. The cheap, complete defusal:

1. The `session_context()` RPC filters expiry from day one (§4.2) — session and DB can
   then never disagree, whether or not expiry ever ships.
2. A pgTAP invariant pins the current truth: *no supported door sets `expires_at`* (red
   the day someone adds one without Package C).
3. Extend `trg_audit_memberships` now to emit on `expires_at` changes (three lines; Rule
   11 should not wait for the feature).

Full Package C (grant-with-expiry, change-expiry commands, renewal semantics, the full
actor matrix) only when a product feature commits to it — as one atomic package, exactly
as the audit insists.

### 4.4 Future-expansion posture (the flexibility question)

- **New role in an existing scope** — the design already extends linearly and fails
  closed at every layer (`role_check`, `CASE … ELSE false` shape, `else raise` door
  dispatch). The gap is that the checklist lives in nobody's head durably. Add to
  `docs/backend-state.md` a **role-addition checklist**: role CHECK → shape CASE → both
  door arms (+ wrapper RPC if UI-appointed) → RLS predicates that enumerate roles →
  `session.ts` shape → generated types → seed persona → pgTAP grid row. Back it with a
  completeness pgTAP: a test that iterates the CHECK's role vocabulary and asserts a
  grant/revoke/deny row exists for each (a new role reds the grid until covered) — the
  executable-claim discipline, so the checklist cannot silently go stale.
- **New scope tier** (e.g., a department under hospital, or a network above org) — the
  `(scope_type, role)` dispatch extends with one column + one shape arm + one index +
  door arms. Resist the generic `scope_id`-without-FK shortcut (audit's non-goal —
  endorse; it would break composite-FK integrity and catalog auditability).
- **Fine-grained permissions** — extend the **administrativo capability plane** (finite,
  flag-aware, layered on membership), never the role enum, for anything task-shaped.
  Roles stay the coarse, code-coupled vocabulary; capabilities absorb the churn. This is
  the audit's "delegated capabilities stay separate" point, stated as the positive
  design rule.
- **Platform roles** — endorse deferring `platform_role_grants` until a second real
  vendor role exists, and endorse the audit's warning that the JWT-first `is_admin`
  residual (~1h demoted-admin window, ADR 0009) must not be inherited by richer global
  roles by accident. Record that as a tripwire note in the ADR that eventually
  introduces them.
- **Satellites (Package D) and partitioning** — endorse as written: on evidence only.

### 4.5 Acceptance criteria

Adopt the audit's ten, with two additions:

11. `grant_role` and every UI grant path have a **defined, tested behavior** for the
    grant-onto-other-role collision (no unhandled `23505` reaches a user).
12. A repo gate (grep/lint) proves application code contains no raw `memberships` DML —
    the Package B end state stays true after future phases, without relying on review.

---

## 5. What this changes for the release

Nothing here blocks the pilot deploy by itself: `authenticated` cannot write the table,
the doors are sound, every mutation is audited, and the dual-role defect requires an
authorized admin's action to trigger. The one item worth doing **pre-release** is
Package A with the §4.1 writer sweep — it is small, closes the only UI-reachable
integrity defect (M2 via `addStaff`), and hardens the substrate the post-pilot packages
build on. Packages B/C/I1 are correctly post-pilot phases under the standard gate.
