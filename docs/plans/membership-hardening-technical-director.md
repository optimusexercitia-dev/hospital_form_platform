# Plan — Membership hardening + Diretor Técnico backend (ADR 0094)

**Status:** BUILT (PO-approved 2026-08-04) — branch
`feat/membership-hardening-technical-director`. **W1 ✅ · W2 ✅ · W3 ✅ · W4 ✅**
(T4.1–T4.13; flag `technical_director` **ON** via `20260905000600`). Remaining before
merge: the full `e2e:prod` declare-green, `p0-authz-invariant.sh` ARM 1, and FUP-MEM-1/2/3.
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

> **Status 2026-08-04: W4 is COMPLETE.** T4.1–T4.3 in `20260905000400` (pgTAP `294`
> 29/29, mutation 8/8, commit `803e837`); T4.4–T4.13 in `20260905000500` +
> `20260905000600` (pgTAP `295` 60/60, mutation **13/13** RED-PROVEN with a 60-green
> control). The flag is **ON**.
>
> ⚠ **The task list below was short in both directions, and ADR 0094 Amendment 5 records
> why.** Five fail-open sites are missing from it — four created by making
> `target_commission_id` nullable (a NULL comparison inside `if`/`check` is PASS, not
> false), one found by the new "exactly one waiting party" CHECK. And T4.6's
> "21 functions" is a column-name sweep: **seven more functions inherit the target arm
> without naming the column**. Read Amendment 5 before treating any enumeration here as
> the enumeration.

### Decisions locked by interview (PO, 2026-08-04) — do not re-litigate

| # | Decision | Consequence / rationale |
| - | -------- | ----------------------- |
| **D1** | **Titular ≡ deputy.** Flat authority — both hold the full target side: receive, manage, converse, reply, resolve, read PHI. | ONE DT arm in `app.can_manage_referral_target`, not two tiers. A *substituto* who cannot decide is decorative, and the referral would stall whenever the titular is away. `received_by`/`decided_by` keep accountability per-person. |
| **D2** | **Full lifecycle, inherited.** receive → accept → start_review → conclude, plus decline, dialogue, attachments. | No forked status machine. `decline` is KEPT: `wrong_committee`/`outside_jurisdiction` are meaningless same-hospital, but **conflict_of_interest and insufficient_information are exactly why a DT must be able to refuse.** |
| **D3** | **`referral_messages.sender_commission_id` becomes NULLABLE; NULL means "the DT of the referral's target hospital".** | No `sender_hospital_id`, no `sender_side` — the individual is already in `sender_user_id`, the side is derivable, the hospital is on the referral. Coherence enforced in the EXISTING `app.guard_referral_message` trigger (a CHECK cannot: it must read `case_referral`). |
| **D4** | **Role-based, live audience.** The referral targets the OFFICE. Replace the DT and the new holder immediately gains the referral and its PHI; the outgoing one immediately loses both. | No person-snapshot, no grace window. Matches the legal position (technical responsibility transfers with the office) and avoids a standing PHI grant to someone no longer responsible. |
| **D5** | **New `target_hospital_name` snapshot column**, rendered `Direção Técnica — <hospital>`. | NOT reusing `target_commission_name` (a column holding a hospital name is a name that lies), and NOT snapshotting the DT's person name (that copies Class-2 professional identity outside `professional_profiles` and goes stale the moment the office changes — contra D4). Rule 9 confines the coalesce to `src/lib/queries/referrals.ts`. |
| **D6** | **No DT disposal arm.** `can_dispose_referral_phi` unchanged. | It already resolves for DT rows: `is_commission_admin_of(source)` + the source-hospital PQS operator, which under the same-hospital rule IS the DT's hospital. ADR 0078/M2 removed the platform_admin bypass for exactly this shape — a party that governs neither the record nor its retention must not destroy it. ⚠ Its third arm (`is_pqs_operator_of(hospital_of_commission(target_commission_id))`) is DEAD for DT rows; **left as-is by decision**, harmless because the source arm covers the same hospital. |
| **D7** | **Keep `target_type`** exactly as ADR 0094 decision 9 specifies (no deviation, no amendment). | Three columns; a CHECK must pin `target_type` in agreement with which id is non-null, or it becomes a third thing that can disagree with the other two. |
| **D8** | **No DT internal notes.** Both note predicates get an explicit *"commission-target-only, DT n/a"* disposition; `referral_internal_notes` untouched. | Internal notes exist so a multi-member committee can deliberate privately before answering; the DT audience is one office that answers directly. Purely additive later if a need appears. |
| **D9** | **Add `waiting_on_hospital_id`.** | `provide_referral_information` writes `waiting_on_committee_id = target_commission_id`, which is NULL for a DT row — and the existing CHECK PERMITS NULL, so "the DT is holding this" silently reads as "nobody is waiting". One nullable column + one GRANT + one CHECK arm buys a state that cannot fail open. |

### Findings that reshape the remaining work (catalog-verified 2026-08-04)

1. **The target-side lifecycle funnels through ONE predicate.** `receive_referral`,
   `accept_referral`, `decline_referral`, `start_referral_review`, `conclude_referral`,
   `link_referral_case` and `add_referral_reply_attachment` all call
   `app.assert_referral_target_acts`, which gates on `app.can_manage_referral_target`
   alone. **T4.6 is therefore NOT 21 body edits** — one arm there carries the whole
   lifecycle, and the 21 collapse to a handful of real edits plus explicit dispositions.
2. ⚠ **THREE RPCs carry a RAW inline target check and will NOT inherit it:**
   `get_referral_detail`, `post_referral_message`, `request_referral_information` each
   test `app.is_staff_admin_of(<ref>.target_commission_id)` directly. This is the
   one-of-N-sites miss this program keeps paying for — sweep by `prosrc`, never by
   reading the lifecycle.
3. **A DT referral can never have a target case.** `cases.commission_id` is `NOT NULL`
   and a DT has no commission, so `target_case_id` is commission-target-only — and
   `app.referral_target_analyst`, which *requires* `target_case_id`, can never fire for
   a DT row. **The DT read path must be a NEW arm, not the analyst arm.**
4. **Referrals have NO notification fan-out** (`send_referral` enqueues nothing). There
   is no DT notification decision; discovery is the inbox, i.e.
   `can_read_referral_metadata`.
5. `case_referral_distinct_commissions` (`source <> target`) is satisfied when
   `target_commission_id` is NULL — no change needed.

### Tasks — roles + appointment (BUILT)

- ✅ **T4.1** roles admitted; hospital-tier arms in `memberships_scope_shape` (its
  `else false` terminator kept); `memberships_one_technical_director_uq`.
- ✅ **T4.2** kernel arms with the physician check
  (`professional_categories.key = 'physician'` **and `is_active`** — the VALUE, never
  the label) and `HC0G4` for a second titular. ⛔ **No `is_admin_for` branch** — the only
  grant arm in the kernel without one; asserted so a "consistency" edit cannot restore it.
- ✅ **T4.3** `public.appoint_technical_director` — atomic audited replacement.
- ⚠ **The arm's guards MASK each other** (flag → hospital → authority → physician →
  titular → self-grant). Any new deny-code assertion must name the guard it means.

### Tasks — referral extension (REMAINING)

- **T4.5 — Migration (schema).**
  - `case_referral`: `target_type text not null default 'commission'`
    (CHECK in `('commission','technical_director')`); `target_hospital_id uuid
    references hospitals(id)`; `target_commission_id` → **nullable**;
    `target_hospital_name text` (D5); `waiting_on_hospital_id uuid references
    hospitals(id)` (D9).
  - CHECKs: exactly-one target, **pinned in agreement with `target_type`** (D7); and
    `waiting_on_hospital_id` admitted only for DT rows, extending
    `case_referral_waiting_on_check`.
  - `referral_messages.sender_commission_id` → **nullable** (D3).
  - ⚠ **COLUMN-LEVEL GRANTS.** `case_referral` is under column-level SELECT grants
    (`authenticated` holds 35 of 40 columns today). **Every new column needs its own
    GRANT or reads `42501`** — a verified standing lesson, and it fails at RUNTIME, not
    at migration time.
- **T4.6 — Target-audience arms.** Enumeration derived at build time from the catalog
  (comment-stripped `prosrc` referencing `target_commission_id` — **21 functions, 0
  policies**, re-verified 2026-08-04), **plus** the raw-inline-check sweep from finding
  2, **plus** a `pg_policies` re-sweep (D11 lesson). Each function gets an explicit DT
  arm or an explicit *"commission-target-only, DT n/a"* disposition — **none may be left
  implicit.** DT audience = effective `technical_director` / `technical_director_deputy`
  membership of `target_hospital_id`, resolved live (D4) via the W2 expiry-filtered
  predicates. Known dispositions:
  - **ARM:** `can_manage_referral_target` (carries the whole lifecycle) ·
    `can_read_referral_metadata` (inbox) · `can_read_referral_phi` (T4.8) ·
    `guard_referral_message` (D3 coherence) · `snap_referral_commission_names` (D5) ·
    `get_referral_detail`, `post_referral_message`, `request_referral_information`
    (finding 2) · `provide_referral_information` (D9) · `create_referral_draft` (T4.7).
  - **n/a:** both internal-note predicates (D8) · `link_referral_case`,
    `link_referral_related_case`, `assign_referral_reviewer` (finding 3 — nothing to
    link or assign) · `can_dispose_referral_phi` (D6, no arm).
- **T4.7 — Submission door.** `create_referral_draft` / send path accepts the DT target
  and enforces the **same-hospital rule**: `target_hospital_id = (select hospital_id
  from commissions where id = source_commission_id)`; `commissions.hospital_id` is
  NOT NULL so it always resolves. Snapshot/reply/dialogue machinery reused as-is.
- **T4.8 — PHI arm.** DT audience admitted to `app.can_read_referral_phi` for
  DT-targeted referrals; every read stays on the existing audited path. **No change to
  `patient_identifiers` / `can_read_case_patient`.** No disposal arm (D6).
- **T4.4 — Server actions** (`src/lib/org/actions.ts` pattern): appoint/revoke titular +
  deputy over the cookie client → the RPCs. No UI wiring.
- **T4.9 — Enable migration.** The flag ships **ON** (PO). This is the LAST step.
- **T4.10 — Seed.** A physician DT persona (`dt.a@test.local`, titular of a Rede A
  hospital) + a deputy; header roster updated. **Additive only** — `seed.sql` is a
  contract with ~900 tests.

### Tests

- **T4.11 — pgTAP.** DT referral audience (titular ✓, deputy ✓ — D1; other hospital's DT
  ✗; source committee unchanged; unrelated staff ✗); **the full inherited lifecycle
  driven end-to-end by a DEPUTY** (proves D1 is real, not merely an arm); PHI read
  allowed **and audited**, denied cross-hospital; **the office handover** — replace the
  titular mid-referral and assert the incoming holder gains and the outgoing loses, both
  content and PHI (D4); `waiting_on_hospital_id` written by
  `provide_referral_information`, with the DT-holding state distinguishable from "nobody
  waiting" (D9); internal notes invisible to the DT (D8); disposal refused to the DT and
  still permitted to the source commission-admin (D6); flag-off ⇒ all of it dark.
- **T4.12 — Mutation tests.** Neutralize each new arm → red: the DT audience arm, the
  same-hospital rule, the DT PHI arm, `guard_referral_message`'s coherence check, and
  the `target_type`/exactly-one CHECK. **Include a column-GRANT case** (drop the GRANT
  on a new column → the read must fail), because that defect surfaces only at runtime.
- **T4.13 — E2E.** No new specs (no frontend). The existing referral + members suites
  must stay green through `e2e:prod` — the regression proof that the target-type
  extension did not disturb the commission path.

### Acceptance / gate

- A hospital_admin or org_admin appoints exactly one physician titular + N deputies;
  replacement is atomic and audited; a non-physician is refused; **a platform_admin is
  refused**. *(Met by T4.1–T4.3.)*
- A committee coordinator submits a case-referral to their own hospital's DT; **either
  the titular or a deputy** can read the snapshot (incl. patient, audited), converse and
  reply; nobody else gains anything; replacing the DT transfers access with the office;
  flag off ⇒ feature invisible.
- Standard phase gate: fresh-reset pgTAP, unit, `e2e:prod`, QA review, human approval.

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

**Open items for the human — ALL CLOSED (PO, 2026-08-04):**
1. ~~Program placement vs Phase 16 / pilot~~ → **W1 → W4 straight through**, one branch.
2. ~~T1.0 replacement semantic~~ → **atomic replace**. ⚠ Implemented as an in-place
   UPDATE, not the delete+insert this plan's parenthetical suggested: only the UPDATE arm
   of `trg_audit_memberships` emits `role_changed`, so delete+insert would have defeated
   the goal the plan stated. ADR 0094 Amendment 2.
3. ~~Whether `platform_admin` may appoint a DT~~ → **NO.** Tenant governance act; the DT
   arm is the only grant arm in the kernel with no `is_admin_for` branch, and that is
   asserted and mutation-proven.
4. ~~The `technical_director` flag's enable timing~~ → **ships ON**, via the T4.9 enable
   migration, which is the LAST step of W4. Until then the flag is DARK and the grant
   arms refuse.

**Nine further decisions (D1–D9) were taken by interview on 2026-08-04 and are recorded
in the W4 section.** They are settled — do not re-litigate them at build time; verify
their *substrate* claims against the live catalog instead, which is what this plan's
authority note has always meant.

**Still owed on the branch, independent of W4:**
- The **full `e2e:prod` suite** has not been run (only two targeted runs: 160/0 and
  171/0). Declare-green is owed before merge.
- **`p0-authz-invariant.sh` ARM 1** (the ~90-min policy sweep) has not been run on this
  branch. ⚠ If you interrupt it, restore `docs/reviews/authz-door-audit-findings.md` —
  a killed run truncates it. ARM 2 has an open question filed as **FUP-MEM-1**.
- **`assignOrgAdmin`** was migrated to `grant_role_for` with no E2E spec covering it
  (**FUP-MEM-2**).
