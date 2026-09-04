# 0178 — AE4.9 D6 as built: the narrow authorizer, where the preserved legacy arm lives, and the differential reduction the re-key invalidated

**Status:** Accepted · 2026-09-02 (lead + backend, implementing ADR 0176 D6 on `authz-ae4-catalog`)
**Implements:** [0176](./0176-authz-permission-layer-made-real.md) D6 — the three differential
representatives re-keyed end-to-end, everything else `pending-rekey`. 0176 ruled *which* and
*whether*; four questions it did not settle had to be answered to build it, and one regression
was discovered by the build and is ruled here.
**Amends:** 0175 D3 — its QUALIFIER only, not its decision. D3's deferral of arm 3's
divergence to AE5 stands; what changes is the scope of the qualifier it recorded. Detail: §3.
**Relates:** [0177](./0177-ae49-resolver-contract-implementation-choices.md) (the layer-2 contract
this consumes) · [0174](./0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md) D2 (the
state gate) · [0175](./0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md) (the differential
whose reduction §4 restores) · [0162](./0162-authz-evolution-plan-audit-corrections.md)
§1 (the rollback artifact, now written) · [0079](./0079-authz-door-blindness-standing-invariant.md)
(§6 arms) · [plan § AE4.9](../plans/authz-evolution.md)

## Context

Migration `20261003007300` and pgTAP `409` re-key `commission.forms.edit`,
`org.professionals.create` and `org.professionals.read`. The F1 conformance defect was
**reproduced first** on this stack, in rolled-back transactions: with the grant deleted, the
resolver read `f` while the production **policy** door read `t` for all three. `409` was
additionally run against the **pre-migration** catalog, where every gate-line assertion was observed
**red** — the keystone is proven able to fail rather than assumed to be.

⛔ **CORRECTION 2026-09-04 (QA re-review N4) — "policy" added, and it is a QUALIFICATION, not a
change of decision.** This sentence read *"the production door"* unqualified. Nothing in §§1–4
changes and no decision is reversed; what changes is a factual claim's scope, so this is recorded
in place rather than as an amending ADR. The bound is in Consequences below.

## Decision

### 1 — `commission.forms.edit` gets a NEW narrow authorizer, not a re-keyed wrapper

`app.can_edit_commission_forms(p_commission_id uuid, p_uid uuid)`, STABLE SECURITY DEFINER,
`search_path = app, public, pg_catalog`, EXECUTE to `authenticated` + `service_role`.

⛔ **`app.is_staff_admin_of` was NOT re-keyed.** Its `ELSE`-class in the 401 §19 partition covers
**38 of the 43** codes, so re-keying it would have cut over 38 permissions in one edit — the exact
opposite of D6, which requires everything outside the three to enter the gate as `pending-rekey`.
Its remaining surface (59 policies after the change, from 63) is untouched, and `409` §5.4 shows it
still answers `true` with `commission.forms.edit` deleted.

The other two representatives are re-keyed **in place**; their identities and signatures are
unchanged, so no dependent policy is invalidated.

### 2 — A preserved legacy arm lives INSIDE the authorizer, not beside it at the policy

The four `*_staff_admin_write` policies read `is_staff_admin_of(...) OR is_tenancy_admin_of(...)`.
Only the first disjunct was re-keyed; the second — how org_admin and hospital_admin reach these
tables — is preserved, **moved inside** the authorizer as `is_tenancy_admin_of_for(...)`, so each
policy now calls exactly one layer-3 function.

Rejected alternative: leave the policy as `can_edit_commission_forms(...) OR is_tenancy_admin_of(...)`.
Reasons, the third decisive:
1. ADR 0176 D2 makes layer 3 the **whole** decision the policy calls; an `OR` at the policy keeps
   the policy composing authorization.
2. AE5 must *remove* that arm when `org_admin` becomes `authoritative` and holds the code — one
   edit inside the authorizer, versus four at the policies, and four is how three get done.
3. **Consistency.** The other two authorizers already retain their legacy arms internally
   (`can_create_professional` keeps `can_manage_professional`; `can_read_professional_profile`
   keeps its null guard, `is_admin()`, and the case-committee traversal). Splitting the shapes
   would leave AE5 copying whichever it read first.

⛔ **The cost, accepted with a compensating control.** A legacy authority inside a DEFINER body is
invisible to anyone auditing `pg_policies` for surviving non-permission grants, and deleting it
later is a one-line edit no policy-level assertion would see. Two mitigations are **required, not
optional**: pgTAP `410` §3.7 asserts the authorizer's own composition, and the enforcement
manifest row must disclose that its declared authorizer still grants via a non-permission path.
⚠ A row that reads "fully permission-keyed" here would make the D6 countdown lie.

⚠ Sub-finding worth its own line: the composition probe's needle must anchor as `name || '('`. A
bare substring for `app.is_tenancy_admin_of` matches `app.is_tenancy_admin_of_for(` as a **prefix**,
which would report the old name as still present and hide the rename.

### 3 — Three measurement shapes, each of which would otherwise have produced a vacuous proof

- **The form-edit door must be measured on a WRITE.** The four policies are `FOR ALL` PERMISSIVE
  and each table also carries a permissive `*_select` policy on `app.is_member_of`; a staff_admin
  is a member, so a SELECT-based assertion stays green **with the write policy fully revoked**.
  `409` asserts on UPDATE (the `USING` half) and INSERT (the `WITH CHECK` half), and §2.11 proves
  the sibling is open so the write assertions are attributable.
- **`org.professionals.read`'s only seeded subject sits behind an OPEN masking arm.** The seeded
  `professional_profiles` row carries a `professional_participants` row, so arm 3 grants it
  independently of the org arm and a mutation aimed at the org arm would read green after mutation
  for an unrelated reason. `409` constructs a participation-free subject. ⛔ This also **corrects
  the scope** of a qualifier already owed to the gate record: 403 §7.2/§7.3's "arms 1 and 3 cannot
  grant" is true of **403's own fixture**, not of the seed.
- **`app.can_create_professional` is not EXECUTE-granted to `authenticated`.** The production door
  for `org.professionals.create` is the RPC `public.create_professional_profile`, which raises
  `42501`, and which first calls `app.assert_case_participants_enabled()`. `409` enables that flag
  before the authority assertion so an **earlier** guard firing cannot be mistaken for the later
  one. A manifest naming the authorizer as its own site would satisfy every set-difference check
  while pointing at an object no client can reach.

### 4 — The re-key invalidated the AE4.5 differential reduction; the reduction is RESTORED, not relaxed

401 §19.2b asserted that `can_create_professional`, `can_manage_external_participant` and
`can_manage_case_vocabulary` share **one** identical body — and that shared body was the
justification for the AE4.5 sweep using **three** differential representatives to answer for six
classes. The re-key split `can_create_professional`'s body (distinct bodies now 2, was 1), so
`org.professionals.create` **no longer speaks for** `org.participants.external.manage` (row 31) or
`org.case_vocabulary.manage` (row 32). Those two silently lost differential coverage, and nothing
else in the suite said so.

**Ruled: add ONE further differential representative.** Rows 31 and 32 still share a body with each
other, so one covers both. 19.2b's expected value becomes **2 as a consequence of a restored
reduction** — two body-classes, therefore two representatives — and must be written so a future
reader can see the number is *derived*: if a later change splits those two, it reds again.

Rejected:
- **Re-key rows 31/32 as well.** Widens the build past the PO-confirmed D6 scope. Unnecessary: this
  is a test-coverage gap, not an enforcement gap, and closing it requires no re-key at all.
- **Change 19.2b's expected value from 1 to 2.** ⛔ This greens the test and **deletes its subject**.
  The subject is not the number; it is the *argument* that three representatives legitimately answer
  for six classes. An expected value that tracks reality by being edited is not an assertion.
- **Claim a D5 `exception` with owner and expiry.** Honest bookkeeping, but it carries two
  permissions through the gate uncovered when a bounded fix exists now. Reserve the exception field
  for gaps that cannot be closed.

## Consequences

- **`N of 43` is 3.** Gate-record language stays 0176's: *"`staff_admin` runs on layer 1; 3 of 43
  permissions re-keyed, 40 `pending-rekey`."* ⛔ *"Catalog cutover"* remains prohibited, and the
  catalog remains authority-**elect** until AE5-complete (0162 §2).
- **Permission-code literals in `app` + `public` went 0 → 3**, one per site. That census is now a
  falsifiable statement of the seam's existence, pinned by `409` §1.1–§1.3.
- **The manifest countdown is load-bearing, proven live**: `410`'s status tripwire fired on the real
  re-key ("reality moved ahead of the record") and went green only on a deliberate row flip.
- **Performance evidence is now measurable and still owed** (IA-F9). This migration is what first
  makes the final path exist; it must be measured through policy → layer 3 → layer 2 → layer 1,
  never on `holds_role` alone.
- **Rollback** is covered by [authz-rollback-runbook.md](../deployment/authz-rollback-runbook.md)
  §2b + its out-of-chain template. ⛔ Restore the **disjunct**, not the whole policy body, and both
  halves of a `FOR ALL` policy.
- ⛔ **The diff-scoped door sweep has NOT verdicted this change.** Its read arm aborted (baseline
  not green) and its **write arm selected 0 gates** — the four `FOR ALL` policies are absent from
  that harness's embedded snapshot (`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Part 3, an apparatus
  gap). The four altered policies additionally carry **stale COVERED verdicts** held by five other
  suites, which must be **re-measured, not inherited**. Absence of a verdict is not absence of
  coverage; this is recorded as UNPROVEN and may not be written as a pass.
- ⛔ **"The production door" means the production POLICY door — the bound, added 2026-09-04 (QA
  re-review N4).** The re-key moves the **RLS policy** predicate onto the permission arm; it does
  not touch the DEFINER surface, and the grant-deletion mutation therefore does not flip it.
  For `commission.forms.edit`, matrix row 1 rules **22 DEFINER functions gate form-family tables on
  `is_staff_admin_of` and none is re-keyed**. ⚠ That 22 is the matrix's ruled figure and is cited,
  not re-derived here — a loose re-count on `prosrc` returns 24, which is a bounding difference, not
  a correction. What IS re-measured on the live catalog 2026-09-04 is the load-bearing half:
  **exactly ONE object in `app` + `public` + `authz` carries a `'commission.forms.edit'` literal,
  and it is `app.can_edit_commission_forms` itself** — so 0 of the DEFINER form functions carry one.
  And of the six re-keyed
  policies, `form_item_validations_staff_admin_write` is an **unreachable backstop** —
  `authenticated` holds SELECT only on that table, so no PostgREST write reaches the policy, and
  the real writer `public.set_item_validations(uuid, jsonb)` (`SECURITY DEFINER`, EXECUTE to
  `authenticated`) still gates on `app.is_staff_admin_of` at **layer 1**
  (`FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1`). ⇒ Grant deletion closes **5 of the 6** policy doors and,
  at the sixth, closes a door nothing opens. ⚠ **A qualification, not a relaxation:** ADR 0176 D6
  scoped the gate to three representatives at layer 3 and matrix row 1 rules the DEFINER sites `D`,
  so nothing here lowers the bar — it stops the sentence claiming a surface the bar never covered.
  Pinned as an assertion by `409` § 2.10c, not left as prose. Same clause added to
  [plan § AE4.9 and § Gate AE4](../plans/authz-evolution.md).
- ⛔ **Does NOT**: make the catalog the authority · re-key any of the other 40 · retire
  `memberships_role_check` or `memberships_scope_shape` · merge or push anything.
