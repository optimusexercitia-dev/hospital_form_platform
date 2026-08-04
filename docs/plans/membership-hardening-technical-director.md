# Plan — Membership hardening + Diretor Técnico backend (ADR 0094)

**Status:** Proposed — no work authorized until human approval + phase placement.
**Authority notes:** this plan is NOT authoritative on the substrate — re-verify every
schema/RLS/RPC claim against the **live catalog** at build time (ADR 0078 A28). Before
any workstream starts, the assigned teammates read
[authz-handoff §7](../progress/authz-handoff.md) and this plan's *Standing lessons*
section. The ADR is [0094](../decisions/0094-membership-hardening-and-technical-director.md);
the evidence base is the
[internal analysis](../design/temp/membership-model-internal-analysis.md).

## Program shape

Four workstreams, strictly sequenced (each builds machinery the next consumes):

| WS | Name | Depends on | Suggested placement |
| -- | ---- | ---------- | ------------------- |
| W1 | Package A — membership invariants + writer sweep | — | **Pre-pilot candidate** (small, closes the UI-reachable M2 defect) |
| W2 | `session_context()` snapshot + expiry defusal | W1 | Post-pilot phase 1 |
| W3 | Package B — one real mutation door | W2 | Post-pilot phase 2 |
| W4 | Diretor Técnico backend | W1–W3 | Post-pilot phase 3 |

W4 deliberately last: it consumes W1's replacement semantic + partial-index machinery,
W2's generic grant snapshot (new roles surface with zero session-shape work), and W3's
actor-param kernel (DT door arms are written once, in the kernel, not twice). If the
human pulls W4 earlier, the DT arms must be written in the current doors and migrated
during W3 — double work, but not unsafe.

Placement relative to Phase 16 (ADR 0093) and the pilot deploy is the human's decision;
this plan only encodes the internal order W1 → W2 → W3 → W4.

---

## W1 — Package A: membership invariants + writer sweep

**Goal:** the DB enforces one commission role per principal, cross-scope integrity is
catalog-visible, and no writer can surface an unhandled conflict.

### Decide first (blocks everything else)

- **T1.0 — Replacement semantic.** One decision, inherited everywhere: granting a
  commission role to a principal who already holds the *other* commission role in the
  same commission does **what**? Recommended: `grant_role` performs an atomic
  role-replacement (delete old + insert new in-transaction) so the audit stream shows
  `role_changed` semantics; UI actions inherit it by calling the door (W3) or by
  reproducing it exactly (interim). Record the decision in the migration comment and
  a short ADR addendum if it deviates from this recommendation.

### Tasks (backend)

- **T1.1 — Migration:** partial unique index
  `memberships_one_commission_role_uq (principal_id, commission_id) WHERE commission_id IS NOT NULL`.
  Pre-flight: assert seed + local data hold no violators; guard-wrap if it could ever
  run against a data-bearing remote (backfill-guard-wrap lesson).
- **T1.2 — `grant_role` conflict arm** implementing T1.0 (no unhandled `23505` can
  escape the door; a deliberate error code where refusal is the semantic).
- **T1.3 — Writer sweep** (the enumeration is *every commission-tier writer*, verified
  by grep at build time, currently):
  `addStaff` (`src/lib/members/actions.ts:164`), `assignStaffAdmin`
  (`src/lib/admin/actions.ts:276`), `registerUser` committees
  (`src/lib/users/actions.ts:513`), `assignCommitteeRole` (`users/actions.ts:687`),
  `removeCommittee` (`users/actions.ts:724` — audit-semantic review only),
  `platform/actions.ts:196` (org-tier, unaffected by the index — confirm and say so),
  `supabase/seed.sql`, pgTAP fixtures. Each gets a defined behavior + a pt-BR
  user-readable error where refusal surfaces.
- **T1.4 — Migration:** composite FKs
  `(hospital_id, organization_id) → hospitals(id, organization_id)` and
  `(title_id, commission_id) → commission_member_titles(id, commission_id)` (add the
  referenced unique key first); **retire the two BEFORE trigger guards in the same
  migration** (never both enforcement paths long-term); keep the shape CHECKs.
- **T1.5 — Migration:** index on `memberships(granted_by)`.
- **T1.6 — pgTAP:** constraint/index/ACL census; `authenticated` direct-DML denial;
  dual-role denial; replacement semantic; composite-FK violation cases.

### Acceptance / gate

- Every T1.6 keystone passes a **revert-the-fix mutation check**: drop the index /
  disable the arm in a throwaway transaction → the test MUST go red (ADR 0079; the
  no-regression-twin lesson).
- One principal cannot hold `staff` + `staff_admin` in one commission — proven at the
  base table AND through every product writer in T1.3.
- Full pgTAP on fresh `supabase db reset`; lint/typecheck/unit; E2E: members-management
  + directory + registration specs (chromium loop), full `e2e:prod` to declare green.
- `npm run gen:types` after migrations (Rule 8, with pgtap dropped — gen-types lesson).

---

## W2 — One session authority snapshot + expiry defusal

**Goal:** effective-grant semantics defined once, in SQL; the M1 landmine defused
whether or not expiry ever ships.

### Tasks (backend)

- **T2.1 — `app.session_context()`** (DEFINER, search-path pinned, EXECUTE for
  `authenticated` only; PHI-free): returns the caller's profile status fields + ALL
  effective membership grants (expiry-filtered, `is_active`-consistent) with the
  org/hospital/commission references the shell needs. Shape: one row per grant +
  a profile envelope — generic over roles so W4's new roles surface with no RPC change.
- **T2.2 — `getSessionContext()` consumes it** (one RPC replaces the profile read +
  4 membership reads; exported TS shape unchanged — this is an internal re-plumb, not
  an interface change). React `cache()` wrapper stays.
- **T2.3 — Expiry defusal:** (a) `trg_audit_memberships` gains an
  `expires_at`-change arm (emit `membership.expiry_changed`, PHI-free metadata);
  (b) pgTAP invariant: no door/RPC in the catalog writes `expires_at` (red the day one
  appears without the full expiry package); (c) session snapshot proves it filters an
  artificially-expired row.
- **T2.4 — Docs:** `docs/backend-state.md` records the RPC as the single session
  authority; the role-addition checklist (ADR 0094 decision 6) lands here, backed by
  **T2.5 — completeness pgTAP grid**: iterate the live `memberships_role_check`
  vocabulary and assert each role has a grant path, a revoke path, a deny case, and a
  session-surface row in the grid fixtures — a new role reds the grid until covered.

### Acceptance / gate

- Session context and DB predicates agree on effective grants for: active, expired
  (fixture-injected), suspended, deactivated actors — tested at the **product-called
  RPC surface** as `authenticated`, not inferred from base-table policies.
- No behavior change for current users (all grants are permanent today) — the full
  E2E suite is the proof.

---

## W3 — Package B: one real mutation door

**Goal:** application code performs no raw `memberships` DML; every mutation validates
the live actor in PostgreSQL.

### Tasks (backend)

- **T3.1 — Kernel refactor:** door bodies move to internal
  `app.grant_role_impl(p_actor, …)` / `app.revoke_role_impl(p_actor, …)`; public
  `grant_role`/`revoke_role` become `auth.uid()` wrappers (byte-equivalent behavior —
  pgTAP proves the arms' verdicts unchanged for every (scope, role, actor) grid cell).
- **T3.2 — Service door:** `public.grant_role_for(p_actor, …)` /
  `revoke_role_for(p_actor, …)` — EXECUTE **only** `service_role` (+ owner); revoked
  from `authenticated` AND `anon`/PUBLIC (assert the ACL in pgTAP); re-validates
  `p_actor` against live DB authority inside the kernel; audits atomically.
- **T3.3 — Caller migration** (inventory re-derived at build time; currently):
  - cookie-authenticated → plain door: `addStaff`, `assignStaffAdmin`;
  - actor-less service paths → `*_for` door: `registerUser` committees, first-org_admin
    provisioning (`platform/actions.ts:196`), `assignCommitteeRole`, `removeCommittee`;
  - already-door callers unchanged: `removeStaff`, `removeStaffAdmin`, `org/actions.ts`,
    `pqs/actions.ts` wrappers.
- **T3.4 — Repo gate:** a lint/grep check (CI + `npm run lint` family) failing on
  `from('memberships')` + insert/upsert/update/delete in `src/` — the end state
  survives future phases without relying on review.
- **T3.5 — pgTAP + mutation tests:** grant/revoke authority grid over both entry
  points; self-grant denial; role-pin; anti-lockout **now also binding the service
  path** (it currently does not — this is a behavior improvement, call it out in the
  phase notes); ADR 0079 door-audit sweep (`p0-authz-invariant.sh`) stays green.

### Acceptance / gate

- ADR 0075's documented split is retired; its ADR gets a superseded-by-0094 note.
- Every keystone mutation-tested (neutralize the arm → red).
- Full gate (pgTAP fresh reset, unit, `e2e:prod`) + QA review.

---

## W4 — Diretor Técnico backend

**Goal:** the DT roles exist with their legal invariants; a committee can submit a case
for the DT's analysis over the referral plane, PHI included and audited; no frontend.

### Tasks (backend)

**Roles + appointment**

- **T4.1 — Migration:** admit `technical_director` + `technical_director_deputy` to
  `memberships_role_check`; two hospital-tier arms in the scope-shape CASE
  (org + hospital set, commission NULL); partial unique index
  `(hospital_id) WHERE role = 'technical_director'` (one titular per hospital).
- **T4.2 — Kernel arms** (in the W3 kernel): grant/revoke for both roles; authority =
  `app.is_org_admin_of(org_of_hospital(h))` OR `app.is_hospital_admin_of(h)`;
  **physician check** — target's `profiles.professional_category_id` resolves to
  `professional_categories.key = 'physician'` and `is_active`, else a dedicated error
  code (pt-BR message at the action layer); titular grant refused when one exists
  (dedicated code); self-grant denial inherited.
- **T4.3 — `appoint_technical_director(p_hospital, p_user)`** wrapper RPC: atomic
  audited replacement (revoke incumbent titular + grant appointee, one transaction,
  two audit events); same authority as T4.2. Deputy management uses the plain door.
- **T4.4 — Server actions** (`src/lib/org/actions.ts` pattern): appoint/revoke
  titular + deputy over the cookie client → RPCs. No UI wiring.

**Referral extension (the submission channel)**

- **T4.5 — Migration:** `case_referral.target_type` (`'commission'` default |
  `'technical_director'`) + `target_hospital_id uuid REFERENCES hospitals(id)`;
  `target_commission_id` → nullable; CHECK: exactly one of
  (commission target ↔ `target_commission_id`) / (DT target ↔ `target_hospital_id`)
  per `target_type`. Column-level grants for the new columns (case_referral is under
  **column-level SELECT grants** — every new column needs its own GRANT or reads
  `42501`; verified standing lesson).
- **T4.6 — Target-audience arms.** Enumeration derived from the catalog at build time:
  every function whose `prosrc` references `target_commission_id` (21 at analysis
  time: `can_read_referral`, `can_read_referral_metadata`, `can_read_referral_phi`,
  `can_manage_referral_target`, `can_write_referral_response`,
  `referral_target_analyst`, `assert_referral_target_acts`, `hospital_of_referral`,
  the guards, the lifecycle RPCs, `snap_referral_commission_names`, …) plus a
  `pg_policies` sweep (0 direct references at analysis time — re-verify, D11 lesson).
  Each gets an explicit DT arm or an explicit "commission-target-only, DT n/a"
  disposition — **no function may be left implicit**. DT audience = effective
  `technical_director` / `technical_director_deputy` membership of
  `target_hospital_id` (via the W2 effective-grant predicates).
- **T4.7 — Submission door:** `create_referral_draft` / send path accepts the DT
  target; validates `target_hospital_id = (select hospital_id from commissions where
  id = source_commission_id)` (same-hospital rule; `commissions.hospital_id` is
  NOT NULL); snapshot/reply/dialogue machinery reused as-is; `received_by`/`decided_by`
  record the acting individual (titular or deputy).
- **T4.8 — PHI arm:** `app.can_read_referral_phi` (+ target-side disposal predicates
  `can_dispose_referral_phi`) admit the DT audience for DT-targeted referrals; every
  read remains audited by the existing referral-PHI audit path; `dispose_referral_phi`
  flow unchanged. **No change to `patient_identifiers` / `can_read_case_patient`.**
- **T4.9 — Feature flag** `technical_director`: role grant doors, referral DT target,
  and audience arms all flag-gated (dark flag confers nothing — mirror the
  administrativo kill-switch pattern). Ship WITH an explicit enable-or-not migration
  decision (the no-enable-migration = dark-after-push lesson).
- **T4.10 — Seed:** add a physician persona (`dt.a@test.local`, titular of a Rede A
  hospital) + a deputy; header roster updated. Respect the seed-as-contract lesson —
  additive only, no changes to existing personas' grants.

**Tests**

- **T4.11 — pgTAP:** role-shape + cardinality (second titular red); physician
  enforcement (nurse persona red, with the *value* — the category row — not the label,
  resolved in the fixture); appointment authority grid (org_admin ✓, hospital_admin ✓,
  sibling-hospital admin ✗, staff_admin ✗, platform_admin per the noun rule — decide
  and test explicitly); replacement atomicity + audit pair; DT referral audience
  (titular ✓, deputy ✓, other hospital's DT ✗, source committee unchanged, unrelated
  staff ✗); PHI read allowed + audited for DT, denied cross-hospital; disposal;
  flag-off ⇒ all of the above dark; the W2 completeness grid extended with both roles
  (it reds by construction until this lands — that is the checklist working).
- **T4.12 — Mutation tests:** neutralize each new arm (physician check, titular
  uniqueness, same-hospital rule, DT PHI arm) → the suite must go red.
- **T4.13 — E2E:** no new specs (no frontend); the existing referral + members suites
  must stay green through `e2e:prod` — the regression proof that the target-type
  extension didn't disturb the commission path.

### Acceptance / gate

- A hospital_admin can appoint exactly one physician titular + N deputies; replacement
  is atomic and audited; a non-physician is refused at the door.
- A committee coordinator can submit a case-referral to their hospital's DT; the DT
  (titular or deputy) can read the snapshot (incl. patient, audited), converse, and
  reply; nobody else gains anything; flag off ⇒ feature invisible.
- Standard phase gate: fresh-reset pgTAP, unit, `e2e:prod`, QA review, human approval.

---

## Cross-cutting

**Standing lessons binding on every workstream** (from memory + authz-handoff §7):
derive every enumeration from the authority that defines the property (catalog scans,
not filenames or this plan); `prosecdef` belongs beside `pg_policies` in every audit;
mutate-before-trusting every keystone (a green test that cannot go red proves nothing);
after any predicate change re-sweep `pg_policies` for stranded references; migration
file text is stale by design — the catalog is truth; local migration windows above the
highest registered version when parallel sessions share the stack.

**File ownership:** backend owns migrations, `supabase/tests`, `src/lib/{queries,
supabase,types}`, and the touched `actions.ts` files; tester owns `e2e/`; qa reviews.
W1's T1.3 touches `members/users/admin/platform` actions — no frontend work shares
those files in the same phase.

**Rotation:** on approval, PROGRESS.md gains the program table (lead-owned); each
workstream closes with a `phase(N): complete` commit and a `docs/backend-state.md`
update (memberships §, referrals §, new roles §).

**Open items for the human (blocking approval):**
1. Program placement vs Phase 16 / pilot (recommendation: W1 pre-pilot, W2–W4 after).
2. T1.0 replacement semantic sign-off (recommended: atomic replace, `role_changed`
   audit semantics).
3. Whether `platform_admin` may appoint a DT (the noun rule makes this a tenancy-arm
   judgment call — recommendation: **no**, appointment is a tenant governance act).
4. The `technical_director` flag's enable timing.
