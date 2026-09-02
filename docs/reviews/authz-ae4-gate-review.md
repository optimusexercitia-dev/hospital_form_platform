# QA review — **Gate AE4** (authz-evolution program, ADR 0155 D7 as amended by 0176)

# ⛔ VERDICT: CHANGES REQUESTED

- **Branch:** `authz-ae4-catalog` @ `e897b452` · **Reviewed:** 2026-09-02 · **Reviewer:** `qa`
  (read-only; live-catalog probes + four read-only reviewer agents).
- **Subject:** Phase AE4 in full — AE4.1–AE4.6, AE4.7a/b/c, AE4.8, the AE4 PO batch, and AE4.9
  (do-now 1–5 + D5 + D6).
- **Contract:** [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § AE4 + § Gate AE4 ·
  ADRs [0172](../decisions/0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md)
  [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md)
  [0174](../decisions/0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md)
  [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md)
  [0176](../decisions/0176-authz-permission-layer-made-real.md)
  [0177](../decisions/0177-ae49-resolver-contract-implementation-choices.md)
  [0178](../decisions/0178-ae49-d6-rekey-as-built.md) · increment record
  [`docs/progress/authz-ae4.md`](../progress/authz-ae4.md) · prior artifacts
  [mid-phase QA](./authz-ae4-review.md) (no verdict line — see F-REC-6) and the
  [implementation audit](./authz-evolution-implementation-audit-2026-09-02.md).
- **Catalog identity confirmed before any reading:** `519` migration files = `519` rows in
  `supabase_migrations.schema_migrations`, head `20261003007300`. The catalog *is* this branch.

> ## ⚠ Two things about this review that must not be dropped
>
> **1. THE ORDERING IS PROVISIONAL AND THE PO MUST BLESS IT.** CLAUDE.md §6 orders QA *after*
> the test pass. The lead ran this review **early**, before the final `e2e:prod`, on the reasoning
> that a read-only review is the last plausible source of code-touching changes. That reasoning is
> sound but it is a **deviation from the written gate order**, and the deviation is the PO's to
> ratify, not the lead's or mine. If any change lands in response to this report, `e2e:prod`
> **must** re-run.
>
> **2. THE E2E ARTIFACT I REVIEWED AGAINST.** `e2e:prod` reached `GATE_EXIT=0` in a **single** run
> at the AE4.9 D6 head — 1h43m, 21 batches, per-batch figures summing to **1273/1273**,
> `did-not-run` 0 in every batch, 3 infra re-runs all `server_dead=1`. The earlier **3-run
> composite is rejected and I did not credit it**. I verified that the only two commits since that
> head (`0126cb9a`, `e897b452`) touch **no** `src/`, `supabase/`, or `scripts/` file — measured
> with `git show --stat`; both are `docs/` + `PROGRESS.md` only. The artifact therefore still
> describes the reviewed tree.

---

## Why CHANGES REQUESTED, in one paragraph

**The engineering is of a very high standard and the phase's central claim is substantially true.**
IA-F1 — *the permission layer had zero production callers* — is genuinely answered on the catalog:
there is now an unbroken, mutation-proven path from RLS policy → layer-3 domain authorizer →
`authz.has_permission` → `authz.role_permissions`, and deleting a grant closes real production
doors. Every one of the AE4.4 resolver corrections is present and correct. The record is the most
honestly self-qualified I have audited in this tree, and every figure in it that I could re-measure
reproduced **exactly**.

I am nevertheless refusing the gate on four grounds, one of them found by this review:

1. **F-BLOCK-1 (found here)** — for representative 1, `commission.forms.edit`, the re-key covers
   **4 of the 7 policy sites the PO-approved matrix names for that code**. Two byte-identical
   sibling write policies remain role-keyed, and **nothing reds**: the enforcement manifest's
   set-difference gates run on the *permission* axis, never on the *site* axis. The exact
   conformance defect AE4.9 exists to answer survives inside the representative chosen to
   demonstrate the answer.
2. **F-BLOCK-2** — three items named in the § Gate AE4 acceptance list are **absent by the record's
   own admission**: performance acceptance on the final path (IA-F9), the C2 Tier-1 subset (ADR
   0162 §3 makes it a pre-PO-approval prerequisite; 8 of 171 enforcers measured, 3 BLIND), and the
   rollback runbook's §6 worked example (the file says *"Not yet written … Owed before Gate AE4"*).
3. **F-BLOCK-3** — the document Gate AE4 designates as the regression oracle states its own
   approval scope **three different ways** (33 rows / 42 rows / 43 in the catalog).
4. **F-MAJOR-1** — the manifest's `hardDenyClasses` field is empty on 43/43 rows, 40 of them
   unfalsifiable by construction, the remaining 3 checked by an assertion with no discrimination
   control that is **already blind to a live instance of the class it names**.

None of these is a security exposure. All four are conformance/measurement defects — which is
precisely the class this program exists to eliminate, and precisely the class that reads as green.

---

# 1. DIRTY — findings

Each gives the **claim**, **how I measured it**, the **evidence**, and a **severity**.

---

### ⛔ F-BLOCK-1 · MAJOR (blocking) — `commission.forms.edit` is re-keyed at 4 of the 7 sites its approved matrix names, and the manifest has no site-axis closure check

**Claim.** ADR 0178 and the increment record state that for each of the three representatives
*"deleting the grant now flips the production door."* For `commission.forms.edit` that is true at
four policies and **false at two more**, which the PO-approved matrix names as enforcement sites
for the same code. The manifest declares the code `re-keyed` with `callGraphBoundary: null` — i.e.
it claims a complete site list — and no gate can contradict it.

**How I measured it.** Live catalog only. I enumerated every write-capable policy in `public`
whose predicate reaches the form family (`commission_of_version` / `form_version_id` /
`commission_of_form`), classified each as RE-KEYED vs STILL ROLE-KEYED, then read the matrix's
row 1 to see what the approved oracle declares.

**Evidence.**

```
tablename             | policyname                              | cmd | state
----------------------+-----------------------------------------+-----+-------------------
form_items            | form_items_staff_admin_write            | ALL | RE-KEYED
form_sections         | form_sections_staff_admin_write         | ALL | RE-KEYED
form_versions         | form_versions_staff_admin_write         | ALL | RE-KEYED
forms                 | forms_staff_admin_write                 | ALL | RE-KEYED
form_item_options     | form_item_options_staff_admin_write     | ALL | ⛔ STILL ROLE-KEYED
form_item_validations | form_item_validations_staff_admin_write | ALL | ⛔ STILL ROLE-KEYED
```

Both survivors carry the **exact pre-re-key predicate** the migration replaced everywhere else:

```sql
(app.is_staff_admin_of(app.commission_of_version(form_version_id))
 OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id)))
```

The approved oracle — `docs/design/authz-ae43-staff-admin-permission-matrix.md:291`, matrix row 1 —
names them:

> `| 1 | commission.forms.edit | … | **R** forms/form_versions/form_sections/form_items/`
> `form_item_options/form_item_validations/form_block_library _staff_admin_write (7 ALL) ·`
> `**D** 8 form fns · **E2E** phase4-builder.spec.ts:115-180, :261-389 |`

`supabase/tests/vectors/authz-enforcement-manifest.json` declares **four** `enforcementSites` for
that code, `status: "re-keyed"`, `callGraphBoundary: null`, `pendingRekey: null`.

**Why nothing reds — the structural half, which is the more important finding.** pgTAP `410`'s
set differences are `catalog − snapshot` and `snapshot − catalog` **over permission codes**
(§2.1/§2.2), and §3.5 asserts only that each *declared* site's body contains the *declared* call.
`enforcementSites` is a hand list and **its completeness is checked in neither direction**. The
manifest was built to kill the 401 §19 `CASE … ELSE` default arm on the permission axis; the same
"a site inherits instead of forcing a decision" failure has simply moved one level down, to the
site axis, where no arm looks. (This is the tree's own *"your OWN enumeration is a closure claim
too — the N places I found is a floor, not the set"* lesson, reproduced inside the unit written to
apply it.)

**What is and is not at stake.** ⛔ **This is not an exposure and nothing widened** —
`is_staff_admin_of` is at least as tight as it ever was, so a staff_admin's reach over form item
options and validations is unchanged. What is false is the *conformance* claim: revoking
`staff_admin → commission.forms.edit` does **not** stop that principal editing forms; it stops them
editing `forms`, `form_versions`, `form_sections` and `form_items` while leaving option and
validation rows writable. The Gate AE4 line *"the grant-deletion mutation flips the **production
door** for each of the three representatives"* is therefore **4/7 true** for representative 1.

Two adjacent facts, measured in the same pass and recorded so the fix is scoped correctly:

- `form_block_library` — the seventh name in matrix row 1 — has **no** `_staff_admin_write` policy
  at all. Its only policy is `form_block_library_select` (SELECT, `is_staff_admin_of(commission_id)
  OR is_tenancy_admin_of(commission_id)`). So **the approved matrix row is itself stale by one**:
  it says "7 ALL" where the catalog holds 6 policies with that name and one differently-named
  SELECT policy.
- The row's **"D 8 form fns"** are likewise not re-keyed. Only **3** permission-code literals exist
  in the entire catalog (measured; `backend-state.md` records the same 3), one per re-keyed
  authorizer — so none of the eight DEFINER form functions carries a code.

**Required to close (either is acceptable; the choice is the PO's, because D6's scope was "the
three representatives END TO END"):**

- **(a)** Re-point `form_item_options_staff_admin_write` and `form_item_validations_staff_admin_write`
  onto `app.can_edit_commission_forms` — they are byte-identical to the four already re-pointed, so
  this is a small migration — extend the manifest row's `enforcementSites`, and extend `409` §2's
  mutated half to cover them. Correct matrix row 1 to the measured shape (6 policies + the
  differently-named `form_block_library_select`), and rule on the 8 DEFINER form functions.
- **(b)** Keep the scope and record the truth: the manifest row must **disclose** the un-re-keyed
  sites with owner + expiry (the fields exist and are unused here), the gate record must read
  *"4 of 7 declared sites"* rather than *"the production door"*, and ADR 0178's Consequences must
  carry the same qualifier.
- **In either case:** add a **site-axis completeness arm** — for a `re-keyed` row, every policy or
  function that the approved matrix names for that code must appear in `enforcementSites` or carry
  a reviewed exclusion. Without it, F-BLOCK-1 recurs at every one of the 40 remaining re-keys, and
  AE5 multiplies it by 11.

---

### ⛔ F-BLOCK-2 · MAJOR (blocking; **owned by others, assessed not claimed**) — three named Gate AE4 acceptance items are absent

**Claim.** § Gate AE4's acceptance list names items that do not exist. The record says so itself;
I am not discovering these, I am refusing to write a green over them.

| Item | Gate AE4 language | Measured state |
| --- | --- | --- |
| Performance acceptance on the **final** path | *"performance acceptance via nested plans over the scaled ANALYZEd fixture [PA-F6]"* + *"performance acceptance measured on the **final** path"* | **ABSENT.** Filed as `FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH` (`docs/progress/follow-ups.md:6436`). ADR 0178 Consequences: *"now measurable and still owed"*. |
| **C2 Tier-1 subset** | *"the C2 subset closed (pilot cutline)"*; ADR 0162 §§86-87: *"The tenant-boundary/PHI subset of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (Critical FUP C2) **closes before Gate AE4's PO approval**"* | **NOT CLOSED.** 8 of 171 new enforcers measured; **3 BLIND** (`FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS`). Correctly not folded into this branch — but it gates the PO approval, not the branch cut. |
| Rollback runbook **§6 worked example** | plan § AE4.6: *"One NAMED GAP remains inside them: the worked example for the three AE4.9 D6 representatives (runbook §6), owed before Gate AE4"* | **OPEN.** `docs/deployment/authz-rollback-runbook.md:155` is literally headed *"## 6. ⛔ Not yet written: the AE4.9 D6 worked example"*, and `:166` says *"**Owed before Gate AE4**"*. |

**How I measured it.** Read the gate language in the plan and ADR 0162; grepped the runbook and the
follow-up register; took the C2 figures from PROGRESS.md § Now (which is where they live) rather
than re-deriving them.

**Note on the runbook.** It is being written **right now** by another session (`docs/deployment/`
is one of my named in-flight areas, see §5). Its §6 may already be closed by the time this is read;
if so, re-measure rather than trusting this row. ⚠ And note the shape: after F-BLOCK-1, §6's worked
example must cover **restoring the disjunct at six policies, both halves of each `FOR ALL`** — not
four.

**Severity note.** F-BLOCK-2 is blocking for the *gate*, not for the *branch*. Nothing here asks
the AE4 engineers for a code change.

---

### ⛔ F-BLOCK-3 · MAJOR (blocking; cheap) — the regression oracle states its own approval scope three ways

**Claim.** Gate AE4 requires *"every required decision-table cell has a stable ID, an approved
expected result, and an executed test result."* The document that supplies the approved expected
results contradicts itself about how many of its rows are approved.

**How I measured it.** Read the matrix's header and its § 4 opening in the same pass, then dated
the commit § 4 cites.

**Evidence** — `docs/design/authz-ae43-staff-admin-permission-matrix.md`:

- `:6` (header): *"**status:** ✅ **PO-APPROVED 2026-09-01 — AT 42 ROWS**; the REGRESSION ORACLE
  from cutover. ⚠ **AMENDED 2026-09-01: row 30 splits by operation, +1 row (43)**"*
- `:250` (§ 4, the matrix itself): *"⚠ **The PO approved this matrix at 33 rows (`e3297dad`).
  Rows 34–38 are OUTSIDE that approval** … **Nine rows of delta (34–42), for one PO pass**"*
- Live catalog: **43** permission rows; `staff_admin` holds **42** (missing
  `org.professionals.manage`, which matches row 30's ruled revoke).

`e3297dad` is dated 2026-09-01 and its subject is *"fix(docs): sweep the matrix for the pre-split
magnitude"* — a documentation sweep, not an approval event, so the citation does not settle it
either. Every relevant commit is same-day, so chronology cannot disambiguate.

**Why it matters and is not pedantry.** This is the tree's own *"an approval's SCOPE is a fact that
must be written down"* failure, sitting in the artifact whose entire job is to be the oracle. Either
the 2026-09-01 approval covered all 42 and § 4's warning is **stale** (delete it), or nine rows plus
row 43 are still outside PO approval and the oracle is not yet the oracle. **A reviewer cannot
decide which; only the PO can.**

**Required to close:** one PO sentence, and a one-line edit so the header and § 4 agree, naming the
row count actually approved and whether row 43 is inside it.

---

### 🟠 F-MAJOR-1 · MAJOR — `hardDenyClasses` is empty on 43/43 rows, and the assertion that claims to make that falsifiable is already blind to a live instance

**Claim.** The manifest's §6.2 assertion in pgTAP `410` is captioned *"AN EMPTY MEASURED HARD-DENY
LIST IS FALSIFIABLE."* On the current architecture it is falsifiable in principle and unfalsifiable
in practice, and there is a live depth-2 instance it cannot see.

**How I measured it.** Parsed the manifest JSON directly for field shape and distribution; read
`410` §6.2/§6.3 and the M7 arm of `scripts/gen-authz-matrix-cells.mjs`; then probed the live
catalog for each vocabulary gate name at depth 1 and depth 2 from every declared site.

**Evidence.**

- Distribution: **43/43 rows have `hardDenyClasses: []`**;
  `hardDenyProvenance` = `not-attributable-until-rekey` ×40, `measured-at-declared-sites` ×3.
- Lint arm M7 (`gen-authz-matrix-cells.mjs:568-573`) only validates *membership in the vocabulary*
  by iterating the array. **An empty array iterates zero times — the gate cannot fail on an empty
  list, for any row, ever.** There is no minimum-cardinality arm.
- `410` §6.2 is the only assertion touching an empty list, and it joins `authz_manifest_sites`, so
  the **40** rows with `enforcementSites: []` are excluded from it entirely. **40 of the 43 empties
  are checked by nothing.**
- §6.3 is labelled *"CARDINALITY CONTROL for 6.2"* but proves only that the cross join has rows —
  not that the `position(gate || '(' in body)` predicate can ever evaluate true. **There is no
  discrimination control** — contrast §3.3/§3.4 and §4.1/§4.2 in the same file, which *do* build a
  synthetic subject and require it to be reported.
- ⭐ **And the check is already blind to a live instance.** `principal_inactive` is a declared
  vocabulary class with gate `app.is_active`. §6.2 searches the site bodies and the authorizer body.
  `app.can_edit_commission_forms` calls `or app.is_tenancy_admin_of_for(p_commission_id, p_uid)`,
  whose live body begins `select app.is_active(p_user_id) and exists (…)`. The class **is enforced
  on the `commission.forms.edit` path, one hop below §6.2's search depth**, and the row records
  `[]` with provenance `measured-at-declared-sites`. The same class also arrives on all three
  re-keyed paths through `authz.assignment_facts` at layer 1 — `409` §3.10 exists to prove exactly
  that.
- **No converse assertion exists either.** Because §6.2 gates on `cardinality(...) = 0`, a row that
  *did* declare a class is excluded from the check — nothing anywhere asserts that a **declared**
  class's gate is actually present at its site.

**Required to close:** either (a) narrow the caption and provenance label to what is measured
(*"no hard-deny gate is invoked **directly** at the declared sites or in the authorizer body"* —
depth-1, stated as depth-1), or (b) make the measurement transitive over the composed-call closure
and add a positive control that constructs a body containing a vocabulary gate and requires §6.2 to
name it. Add the converse arm (a declared class must be findable) before AE5, when non-empty rows
first appear. As it stands, **the field has zero discriminating power and reads as coverage.**

---

### 🟠 F-MAJOR-2 · MEDIUM — `ARM=catalog` and `ARM=sites` — the two arms AE4 built to gate itself — hold at AE4.7b, not at the reviewed head

**Claim.** ADR 0174 D5 created `ARM=catalog` (ARM 6) and `ARM=sites` (ARM 7) specifically for this
phase. Their last recorded verdict is at AE4.7b. The AE4.9 D6 gate record says *"all four ARMs
HOLD"* — the CLAUDE.md §6 four (`census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper`).

**How I measured it.** Read the ARM menu in `supabase/tests/mutation/p0-authz-invariant.sh:62-80`
and its dispatch at `:915-919` (both arms exist and are wired); grepped the increment record for
each arm's verdicts.

**Evidence.** `docs/progress/authz-ae4.md:345-346` records, at AE4.7b:
`ARM=catalog HOLDS — 1 non-legacy role, both artifacts` and
`ARM=sites HOLDS — 14 sites, 2 wrapper + 12 allowlisted`.
`docs/progress/authz-ae4.md:846`, at the D6 head, records only *"all four ARMs HOLD"*.
Three migrations have landed since AE4.7b, one of which (`…007300`) **altered the enforcement-site
surface `ARM=sites` measures**. I independently re-derived the site population on the live catalog
and it still reads **14** (12 functions carrying a literal `'staff_admin'` outside the wrappers +
the 2 wrappers; **0** policies carry the literal), so the arm would most likely still hold — but
*likely* is not a verdict, and this is the phase whose standing lesson is that a gate record naming
fewer arms than were built reads as full coverage.

**Required to close:** run `ARM=catalog` and `ARM=sites` at the head (~5 s combined) and name them
in the gate record **by arm, never by script**, per CLAUDE.md §6 step 5.

---

### 🟠 F-MAJOR-3 · MEDIUM — `20261003007180` is a rewrite migration with no `door-sweep-targets:` marker, breaking the convention this phase's own ADR made mandatory

**Claim.** ADR 0173 §2 makes the `-- door-sweep-targets:` declaration **mandatory and enforceable**
for any migration that rewrites function bodies via `pg_get_functiondef`. `20261003007180` does
exactly that and carries no marker. The mid-phase review's F9 already named this; it was not closed.

**How I measured it.** Counted `pg_get_functiondef` and `door-sweep-targets` occurrences in each of
the six rewrite-shaped AE4 migrations.

**Evidence.**

```
20261003007180_d2_notification_expiry_term.sql        : pg_get_functiondef=3  door-sweep-targets=0  ⛔
20261003007190_bug_prof_inactive_001_is_active_gate.sql:                      door-sweep-targets=1
20261003007200_ae46_cutover_staff_admin.sql            :                      door-sweep-targets=1
20261003007250_ae49_d4_resolver_contract.sql           :                      door-sweep-targets=1
20261003007260_ae49_d7_assume_role_session_selectable.sql:                    door-sweep-targets=1
20261003007300_ae49_d6_rekey_three_representatives.sql :                      door-sweep-targets=1
```

`007180` rewrote four bodies, **two of them `prosecdef` + `authenticated`-reachable** (ADR 0173's
own measurement). Every sibling complies; the one migration that motivated the ADR does not.

**Required to close:** add the marker (a comment edit; the migration is already applied, and the
deriver reads migration *text*, so a comment-only follow-up migration is not needed — but confirm
that with the deriver's owner rather than assuming it).

---

### 🟠 F-MAJOR-4 · MEDIUM (suite quality) — three assertions in the new suites do not carry the weight their captions claim

Measured by a read-only reviewer agent over `405`/`407`/`408`/`409`/`410`/`411`, cross-checked
against the live catalog. Reported here because the phase's entire evidentiary case rests on these
suites.

| # | Finding | Severity |
| --- | --- | --- |
| **a** | **`409` §2.5 is a baseline with no mutated twin.** §2 mutates and re-probes `forms` (2.9) and `form_sections` (2.10), but **never re-probes `form_versions`**. §2.5 proves the forms-subquery cid derivation is *open* with the grant present; nothing proves it *closes* when the grant is deleted. `form_items` is honestly disclosed as structural-only in 2.1's message; **`form_versions` is not disclosed as one-sided.** The file's own header states the standard it breaks: *"a one-directional mutation leaves the opposite polarity unproven."* | MEDIUM |
| **b** | **`411` §5.1 cannot fire unless §4.1 has already fired, and its stated justification is factually false.** §4.1 asserts `count(*) = 11` over a join on `allowed_scope_kind`; a typo'd `scope_kind` drops it to 10 and reds §4.1 first. If all 11 rows pass §4.1, each `scope_kind` is by construction a member of `select distinct allowed_scope_kind`. The parenthetical escape ("§4 only checks the codes actually present in both sides") does not exist — a snapshot code absent from `authz.roles` reds §3.1's array equality. **This is the only assertion in the six files provably incapable of failing alone.** | MEDIUM |
| **c** | **`409` §1.1/§1.3 use `LIKE` with unquoted, unanchored needles.** `b.src like '%' || pm.code || '%'` — permission codes contain `_`, which `LIKE` treats as *any single character*, and there is no quote anchoring, so a code appearing inside a longer identifier or a `/* */` block comment counts as an enforcement site. `410`'s `carriers_of` **documents and fixes exactly this hazard ten lines away**, using `position()` with `''''||code||''''`. §1.3 is the source of the headline *"40 of 43 carry no enforcement-site literal"* countdown. No live false positive today; the instrument is materially weaker than its sibling. | MEDIUM |

**Also recorded, LOW:** `410` §3.6 pins the **sum** (18) of the 10 site pairs and 8 authorizer pairs
rather than the split, so a reshuffle between the two lists is invisible; §3.7 skips rows with a
null `domainAuthorizer` that §3.6 still counts. `407` §5.3 is `is(x, x)` under a `STABLE` function
in one statement (the file discloses it as "weak"; it is stronger than weak — it cannot fail).
`408` §1.3 and `410` §2.1 lack the grant/revoke and catalog-cardinality controls their sibling
files establish as the house idiom.

---

### 🟠 F-MAJOR-5 · MEDIUM — the vector generators' `--self-test` discrimination suites are invoked by no gate

**Claim.** `scripts/gen-authz-matrix-cells.mjs` carries ~25 `--self-test` mutation cases — an
unusually good discrimination suite proving the generator can *refuse*. Nothing runs it.

**How I measured it.** Read `package.json`'s `lint:authz-vectors` definition, then grepped the whole
tree (excluding `node_modules` / `graphify-out`) for `--self-test`.

**Evidence.** `"lint:authz-vectors": "node scripts/gen-authz-matrix-cells.mjs --check && python
scripts/gen-authz-differential-cells.py --check"` — `--check` only. No vitest, playwright, shell
script, CI workflow or npm script invokes `--self-test`. **The proof that gate 12 can refuse is
manual-only and will rot silently.**

**Required to close:** chain `--self-test` into gate 12 (same gate, count unchanged — the narrow
CLAUDE.md §8 authorization for gate 12 is respected).

---

### 🟡 F-REC-1..8 · LOW — record accuracy

| # | Finding | Evidence |
| --- | --- | --- |
| **F-REC-1** | `docs/backend-state.md:797` says the AE4 range `20261003007100`–`…007300` is **17** migrations. **Measured: 18.** The stated range and the stated count disagree. (`ls supabase/migrations \| awk -F_ '$1>=20261003007100 && $1<=20261003007300' \| wc -l` → 18; `git diff --name-only main...HEAD -- supabase/migrations \| wc -l` → 18.) The sibling figure `pgTAP 401–411, 11` is correct. | measured |
| **F-REC-2** | ADR **0177** Consequences reads *"absence of a verdict **is** absence of coverage"*; ADR **0178** Consequences reads *"**Absence of a verdict is not absence of coverage**"* — same increment, two days apart, literally opposite sentences using the same words. Both are defensible under different readings (0177 speaks of the instrument, 0178 of the subject) but the tree's standing lesson uses 0178's phrasing, and a future reader will quote whichever they hit first. | measured |
| **F-REC-3** | Matrix § 12.8 change table (`:1221`) says row 43 `org.professionals.create` is *"Granted to **`staff_admin`** and **`org_admin`**"*, and row 30 *"Retained by `org_admin` / `platform_admin`"*. **Catalog: `authz.role_permissions` contains rows for `staff_admin` only (42).** `org_admin` and `platform_admin` hold **zero** catalog grants — correct per AE4.2, but "granted to" in the regression oracle should mean a catalog row, and here it means legacy reach. | measured |
| **F-REC-4** | Matrix row 1 says *"(7 ALL)"*; the catalog holds **6** `_staff_admin_write` policies on those tables, and `form_block_library`'s only policy is a differently-named `form_block_library_select`. (Sub-finding of F-BLOCK-1, listed separately because it is a matrix edit, not a migration.) | measured |
| **F-REC-5** | `src/lib/role/role-catalog.ts:18` still claims *"Pure, no I/O"* while `:3-7` now value-imports `partitionGrants` from `@/lib/queries/session-grants`, and the module is imported by three `"use client"` components. Correct **today** (`session-grants.ts` has no `server-only` marker and its `session.ts` import is `import type`, so `lint:client-server-imports` stays green), but a future `server-only` marker there breaks `next build` in three client components with no gate warning. Add the caveat at the import site. | measured |
| **F-REC-6** | The **mid-phase review carries no verdict line** (`docs/reviews/authz-ae4-review.md`). It is labelled a mid-phase artifact and its dispositions live in the increment record, so this is not a process breach — but a review file with findings and no `APPROVED` / `CHANGES REQUESTED` is indistinguishable from an abandoned one. Recommend appending one retro-actively, or a one-line "not a verdict-bearing artifact" banner. | measured |
| **F-REC-7** | `docs/handoffs/authz-ae4-catalog.md` is live in the tree. Per the handoff skill it is ephemeral resume-state **deleted at the branch's Record step** — flagging so the Record step does not skip it. | measured |
| **F-REC-8** | **Unpinned seam divergence (structurally closed at the source).** The old `landingRouteForRole`'s `hospital_admin` arm required only `g.organization`; the new `partitionGrants` route additionally requires `g.hospital !== null`, so a `hospital_admin` grant with a null hospital ref now yields `/o` instead of the org manage area. Every `hospital_admin` fixture in `landing-route.test.ts:83-95` carries a hospital, so the differential does not cover it. ⭐ I probed the source: `memberships_scope_shape` forces `hospital_id IS NOT NULL` for `hospital_admin`, so the state is **unconstructible through a membership**. The assumption that `session_context()` projects that column into `g.hospital` remains unasserted. One assertion closes it. | measured |

---

### 🟡 F-F9 · the mid-phase review's F9 residue — a ruling on every item

Requested explicitly. Each ruled on the live catalog / tree, not from the record.

| F9 item | Ruling | Evidence |
| --- | --- | --- |
| `is_staff_admin_of` still carries **PUBLIC EXECUTE** | ✅ **DISCHARGED** (ADR 0174 D6) | `has_function_privilege('public','app.is_staff_admin_of(uuid)','EXECUTE')` → **f**. `proacl` = `postgres=X \| authenticated=X \| service_role=X` — explicit, no PUBLIC entry. |
| **403's RUN SHAPE** says `Tests: 12` against `plan(15)` | ✅ **DISCHARGED** | `403:77` now reads `RUN SHAPE: Files=2, Tests=24`, `403:85` `select plan(23)`; `403:81` records the QA catch by name. All six new suites' plan/RUN-SHAPE pairs agree (405 26/27, 407 54/55, 408 17/18, 409 63/64, 410 34/35, 411 7/8). |
| **315:9-12 / 319:15 headers** still describe the pre-cutover wrapper | ✅ **DISCHARGED** | Both headers now describe the post-cutover routing explicitly, incl. *"⚠ THAT WRAPPER IS NO LONGER ROUTED THROUGH has_role … which is exactly what the ARM-SPLIT CONTROL asserts"* (315) and the S1 `⚠ CATALOG-ROUTED since AE4.6` annotation (319). |
| **No format CHECK** on `permissions.code` / `roles.code` | 🟡 **STILL OPEN — ruled LOW, accept with a follow-up line** | `select … from pg_constraint where conrelid in ('authz.permissions','authz.roles') and contype='c'` → **0 rows**. Mitigating: no application role holds DML on `authz.*`, both columns are FK-referenced with `ON UPDATE/DELETE RESTRICT`, and writes are migration-only. A malformed code is therefore an author error caught at review, not a runtime hazard. AE5 widens these vocabularies eleven times, which is when it starts to matter. |
| Wrappers re-declare `search_path = app, public, pg_catalog` where every `authz.*` function uses `''` | 🟡 **STILL OPEN — ruled INFO, accept** | Confirmed live on both wrappers and all three layer-3 authorizers. Cosmetic inconsistency; both forms are safe (the `authz` family is fully qualified under `''`, and the `app` family's explicit list is pinned). Not worth a migration on its own; fold into the next touch. |
| The rewrite migrations dropped the house **`v_hits = 1`** exactly-once guard | 🟢 **SUBSTANTIVELY ADDRESSED; the literal idiom not restored** | `v_hits` appears **0** times in all six. But `20261003007260` carries a *stronger* set: already-applied guard (`~ 'session_selectable'` → refuse), anchor-present, not-a-no-op, post-`execute` presence assertion, and a `prosecdef`-preserved assertion. `20261003007250` is DROP+CREATE (idiom inapplicable). Ruled LOW. |
| `007180`'s missing `door-sweep-targets:` marker | ⛔ **STILL OPEN** — promoted to **F-MAJOR-3** above | measured |
| **Nothing guards the implication closure** | 🟢 **HOLDS TODAY, trivially** | `permission_implication_closure` = **43 rows, all reflexive**; `permission_implications` = **0 rows**. So the closure join in `entailed_grants` is exercised **only reflexively** and the implication machinery has **zero discriminating power** on live data. Not a defect now; record it as UNPROVEN so AE5 does not read the reflexive green as evidence the transitive path works. |
| `has_direct_permission` ignores `p_scope_kind`; misnamed; `denied_reason` is `text`; not-granted mislabelled | ✅ **ALL DISCHARGED** — see § 2 CLEAN | measured |
| `authz.roles.state` inert | ✅ **DISCHARGED** (0174 D2) | `holds_role` and `has_permission` both require `state = 'authoritative'`. |

---

# 2. CLEAN — verified on the live catalog

Everything below I measured myself. I list it because a review that reports only faults
misrepresents the phase.

**The IA-F1 answer is real, and the chain is unbroken.**

- `app.can_edit_commission_forms` / `app.can_create_professional` /
  `app.can_read_professional_profile` are the **only three** objects in the database whose
  comment-stripped `prosrc` contains a permission-code literal — 0 before `…007300`, 3 after.
  Each calls `authz.has_permission` with a static string.
- Production doors confirmed: 4 RLS policies (`forms`, `form_versions`, `form_sections`,
  `form_items`) + 2 RLS policies (`professional_profiles_select`,
  `professional_participants_select`) + 4 RPCs (`create_professional_profile`,
  `ensure_professional_participant`, `set_professional_link_state`, `get_case_professional`).
- **No permissive write sibling** masks the form mutation: the four `*_staff_admin_write` policies
  are the only `ALL` policies on their tables; the `*_select` siblings are SELECT-only. `409`
  correspondingly asserts on UPDATE (the `USING` half) and INSERT (the `WITH CHECK` half), with a
  live control proving the SELECT sibling stays open — a row-count probe would have been green with
  the write policy fully revoked.
- All six re-keyed/legacy `FOR ALL` form policies carry **both halves**, and `md5(USING) =
  md5(WITH CHECK)` on every one — so a rollback that restores one half is detectable.
- `409`'s three keystones are genuine production-door differentials: a real
  `delete from authz.role_permissions`, a mutation-landed assertion, both polarities, a restore, and
  named vacuity controls that do work (the `42501` in representative 2 is proven attributable by
  showing org_admin and platform_admin still succeed **under the same mutation**; the masking
  case-committee arm in representative 3 is proven open by its own discrimination pair).

**Layer discipline — measured, not assumed.**

| Question | Measured |
| --- | --- |
| Policies calling layer 1 or 2 directly | **0** |
| Functions outside `authz` calling layer 2 | **exactly the 3 authorizers** |
| Functions outside `authz` calling `authz.holds_role` | **exactly the 2 wrappers** |
| `legacy OR new` anywhere in the wrapper family | **none** — both wrappers are pure one-liners; `prosrc ~ '(has_role\|memberships)'` = **f** on both |

**The AE4.4 resolver corrections (IA-F3) are all present and correct.**

- Scope-kind validation, fail closed, in both evaluators:
  `when p_scope_kind is distinct from (select pm.resolution_scope_kind::text …) then false` — the
  `is distinct from` denies a NULL kind and an unknown code without a separate branch.
- The candidate/runtime split: `authz.has_permission` requires `role_state = 'authoritative'`;
  `authz.candidate_has_permission` accepts `('test_validation','authoritative')` and **never**
  `legacy` (ADR 0177 D1). The candidate is **not EXECUTE-granted to any application role**.
- Renames landed: `has_permission` / `explain_permission` (no `*_direct_*` object survives).
- `permission_explanation.denied_reason` is typed `authz.denial_reason` (a domain over `text`
  CHECK-pinned to 8 values), not bare `text`.
- Distinct, total-ordered denial reasons — `unknown_permission` · `scope_kind_mismatch` ·
  `principal_inactive_or_unassigned` · `scope_unreachable` · *granted* · `wrong_active_role` ·
  `role_not_authoritative` · `permission_not_granted`. **`scope_unreachable` is computed with no
  permission join at all**, which is the actual fix for the old "deleted grant explains as
  unreachable" defect.
- `LIMIT 1` is now `order by eg.role_code collate "C", eg.granting_permission_code collate "C"` —
  byte order, so the explanation does not move with the database collation.

**IA-F4 discharged.** `public.assume_role` reads `authz.roles.session_selectable` server-side and
**fails closed** (`coalesce(…, false)` → a role with no catalog row is not selectable), before the
membership/`is_admin` check, with a distinct pt-BR message and errcode. `408` proves it with a real
true→false mutation, a mutation-landed assertion, a message-level (not just SQLSTATE) denial, **two**
sibling twins that still select, a restore, and a §0.2 pre-state assertion. Textbook.

**The `authz` schema is sealed.** `nspacl` is NULL (owner-only); `has_schema_privilege` is **false**
for `anon`, `authenticated` **and** `service_role`; `authz` is absent from `config.toml`'s
`schemas = ["public","graphql_public"]`; all **8** `authz` functions are `prosecdef` with
`proacl = postgres=X/postgres` — no PUBLIC, no application role.

**Substrate (ADR 0172) reproduces exactly.** `memberships_role_scope_kind_fkey` is
`FOREIGN KEY (role, scope_kind) REFERENCES authz.roles(code, allowed_scope_kind) **MATCH FULL**
ON UPDATE RESTRICT ON DELETE RESTRICT` (`confmatchtype = 'f'`). `memberships_role_check` and
`memberships_scope_shape` both still stand — the catalog is authority-**elect**, and the record says
so everywhere. Integrity contract complete: both join-table composite PKs,
`permission_implications_no_self_implication`, `roles_code_scope_kind_key`, RESTRICT FKs on all
four edges, and **every** classification column a DOMAIN over `text`, never a native enum.

**An equivalence risk I went looking for and found structurally closed.** `authz.scope_reaches`
derives a commission's organization as `commissions → hospitals → organization_id`, while the legacy
predicate `is_org_commission_staff_admin` used `commissions.organization_id` **directly**. Two
different derivations of the same fact is a classic silent divergence. It cannot diverge here:
`commissions_hospital_org_fkey FOREIGN KEY (hospital_id, organization_id) REFERENCES hospitals(id,
organization_id)` plus the `commission_derive_organization_id_trg` BEFORE trigger make them
identical by construction, and the live count of divergent rows is **0 of 6**.

**Legacy equivalence for the re-key holds today, and I checked the widening direction too.**
`staff_admin` is the **only** `authoritative` role; it holds **42 of 43** codes (missing
`org.professionals.manage`, matching row 30's ruled revoke); `scope_reaches` has no
downward-inheritance arm (`ELSE false`), so a commission-scoped resolution requires a
commission-scoped assignment at exactly that id; `memberships_scope_shape` confines `staff_admin` to
commission scope; and the hat clause inside `entailed_grants` is the same `p_principal is distinct
from auth.uid() or role_code = app.active_role()` asymmetry the wrappers carry. **No principal
gains reach through the permission arm that did not have it through `is_staff_admin_of`.**
NULL-input paths all deny (`assignment_facts(NULL)` returns no rows; the only NULL `scope_id` is
`platform_admin`'s `'none'` kind, which `scope_reaches` sends to `ELSE false` — so there is no
`NULL = NULL` grant).

**Record accuracy — every `backend-state.md` § AE4 figure I could re-measure reproduced exactly:**
roles by state **1 authoritative / 11 legacy**; permissions **43**; `authz` functions **8**, all
`prosecdef`; schema privileges **all false**; permission-code literals **3**; manifest **43 rows,
40 pending-rekey / 3 re-keyed**; `is_staff_admin_of` in policies **59** (was 63); `is_tenancy_admin_of`
in policies **51** (was 55); function bodies **151 bare / 28 `_for`**; policies **59 bare / 2 `_for`**.
Nine independent figures, nine exact reproductions. That is unusual and worth saying.

**The five residual legacy arms are exactly the five recorded**, confirmed by reading the three
authorizer bodies from `pg_get_functiondef`: `is_tenancy_admin_of_for` ·
`can_manage_professional` (×2) · `is_admin` · `can_read_case_committee`. `410` §4.6 pins them **by
name** (not by count), and §3.7 anchors its needle as `name || '('` — which is correct and
load-bearing: a bare substring for `app.is_tenancy_admin_of` prefix-matches
`app.is_tenancy_admin_of_for(` and would have hidden the rename.

**Manifest "no default arm" is enforced by code, not by prose.** Three independent arms: M1 checks a
**data-driven** forbidden-key list (`['*','default','_default','ELSE','else','fallback','otherwise']`);
arms A/B kill a wildcard row via the catalog set differences; and the read path bans `??`, routing
every required key through a `req()` that throws. Verified reachable from `--check` (coverage
failures exit 1 at `:1092`, before the text comparison at `:1151`).

**The expected-values file is gated — the mid-phase review's F5 is closed.**
`gen-authz-differential-cells.py --check` **re-derives every cell** from the axes JSON and compares
the full emitted body (CRLF-normalised), with the axes SHA-256 embedded in the header. A hand-edited
`expected_granted` is caught. This is stronger than a hash mode.

**ADR hygiene is clean.** 0172 `Amends: 0162`; 0173 `Amends: 0079`; 0174 `Amends: 0079` **and**
`Amends: 0106` (two labels); 0175 `Amends: 0155`; 0176 `Amends: 0155` **and** `Amends: 0174`;
0178 `Amends: 0175`. 0177 correctly uses `Implements:` (it settles build questions under 0176; it
changes no earlier decision). `docs/decisions/INDEX.md` back-pointers are generated correctly and
match: 0174 → *amended by 0176*, 0175 → *amended by 0178*, 0155 → *amended by …, 0175, 0176*.
**No missing `Supersedes:` / `Amends:` label found** — the one hygiene defect no gate can detect.

**App-side (AE4.8), audited over the full `src/` diff (5 files + 2 new test files, 691 added lines):**

- **Zero `any`** (`: any`, `as any`, `<any>`, `any[]` all return nothing) — §8 clean.
- **No inline supabase-js** anywhere in the diff; no client construction, no `.from(` — Rule 9 clean.
- **No `"use client"` added**; `src/app/page.tsx` remains a Server Component.
- **No user-facing string added**, so no pt-BR exposure; **no raw Postgres error** reaches the UI —
  the one error-adjacent change *removes* an RPC that produced a raw 42501 path.
- **No service-role key or env reference** in client-reachable code; the only `service_role` token
  in the diff is inside a doc comment recording a measured `has_schema_privilege` result.
- **No new form input or markup**, so no a11y surface in this diff.
- **Rule 8**: `database.ts` regenerated; `memberships.scope_kind` is the correct and complete delta
  (all new functions are in `authz.*` / `app.*`; no new `public.*` RPC).
- **The landing seam genuinely collapsed to one manifest**: `ROLE_ORDER` → `LANDING_BRANCHES` →
  `resolveLanding`, consumed by both `page.tsx:101-106` and `landingRouteForRole`, and the derived
  branch sequence is byte-for-byte the old precedence chain.
- **IA-F7 closed for its named subject**: the non-hermetic `execFileSync` into Docker is **removed**
  from `role-catalog.test.ts` (the only surviving mention is a prose comment explaining the removal),
  replaced by a two-hop binding — hermetic vitest parse of `411`'s snapshot block, plus `411`
  asserting that snapshot against live `authz.roles` after a fresh reset. Each hop reds
  independently, so a one-sided edit cannot go green.
- Two AE4.8 plan bullets were **overruled with measured reasons recorded in-code** rather than
  silently obeyed (the "six label maps" do not exist as six; the session partition **cannot** key
  off scope kind because `organization` maps to two branches and `hospital` to four). Both rulings
  are correct and I verified both against the manifest.

**Hygiene:** `graphify-out/` untouched by the branch. No secret, token, or password pattern in the
diff. No `docs/adr/` directory created.

---

# 3. UNPROVEN — measured as *not measured*, and not to be read as either a pass or a defect

This section exists because "I could not measure this" must not collapse into "clean" or "broken".

| # | Subject | State |
| --- | --- | --- |
| U1 | **Diff-scoped door sweep, WRITE arm** | **UNPROVEN — exit 3, `guard=0/13 policy=0/33`, zero gates selected.** The four `FOR ALL` form policies are outside the harness's *embedded snapshot* (`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Part 3, an apparatus gap). ⛔ **Nothing was measured. This is not a pass** — and the record says so, correctly, everywhere I checked. The READ arm legitimately covers those policies (an `ALL` policy *is* a read policy) and `409` proves the write path behaviourally, but the write arm holds no verdict of its own. |
| U2 | **The four altered form policies' prior COVERED verdicts** | Held by five unrelated suites and earned against the **pre-ALTER** predicate. The record states they were **re-measured, not inherited** (ADR 0079 Amdt 8 ruling 3). I could not re-run the sweep to confirm the re-measurement; I am taking the record's word for it and saying so. ⛔ `ARM=census` structurally cannot catch a stale verdict — the gate is not a newcomer. |
| U3 | **`public.assume_role`'s sweep verdict** | **None, and none is obtainable from `ARM=census`** — it kept its name and changed its body, which that arm cannot see by construction. `scripts/door-sweep-cases.sh` is what surfaced it. Confirmed as recorded. |
| U4 | **Three of the four new AE4.9 `authz` objects carry no sweep verdict, for three different reasons** | `candidate_has_permission` excluded **by name** (`FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME`); `explain_permission` is scalar non-bool (the C2 class); `entailed_grants` is set-returning-and-unreachable (the row-door class). Only `has_permission` is in the predicate domain (COVERED). ⛔ They may not be recorded as one class. |
| U5 | **The implication closure's transitive path** | `permission_implications` = **0 rows**; `permission_implication_closure` = **43 rows, all reflexive**. The closure join in `entailed_grants` has therefore **never been exercised non-reflexively**. Not a defect; do not read the green as evidence the transitive path works. |
| U6 | **`can_read_professional_profile` arms 1 and 3** | **EXERCISED BUT NOT ORACLED**, and arm 3 is **OPEN AND MASKING on the seed**. Confirmed — see the qualifier ledger. |
| U7 | **pgTAP 401 §20's affiliation-blindness proof** | **ONE HOP, not the transitive closure.** Confirmed — the suite says so at `401:1384`. |
| U8 | **The MATCH FULL keystone** | On the real `memberships` the hole is unreachable because `memberships_role_check` / `memberships_scope_shape` reject first, so a keystone there measures a **different control**. Its value is **prospective** — it is what survives the AE5-complete CHECK retirement. Confirmed. |
| U9 | **`hardDenyClasses`** | 40/43 `not-attributable-until-rekey` — **honest bookkeeping, not coverage**; and see F-MAJOR-1 for why the remaining 3 are weaker than they read. |
| U10 | **403's differential coverage** | 864 cells but only **432 distinct driver-observable coordinates**; **108 cells labelled `third_party` have caller == principal**; `operation` / `resourceLifecycle` / `sensitivity` axes unswept. The suite's own header states all of this. **"The differential is green" may not be written without U6 + U10 beside it.** |
| U11 | **403 pointed at the CANDIDATE evaluator** | Costs nothing today (zero roles are in `test_validation`, asserted by §3.2b) — **and is not free forever.** The day §3.2b reds, the suite stops being evidence about the runtime path. Confirmed as recorded. |

---

# 4. Qualifier ledger — every qualifier I was handed, confirmed, corrected, or falsified

The instruction was that silently dropping one is worse than finding nothing. Each is ruled.

| Qualifier as handed to me | Ruling |
| --- | --- |
| `can_read_professional_profile` arms 1 and 3 are **exercised but not oracled**, arm 3 additionally **OPEN on the seed**; *"the differential is green"* may not be written without this | ✅ **CONFIRMED, and the record states it in three places.** The manifest row for `org.professionals.read` carries it as a first-class `legacyEquivalence.qualifier` and goes further than the brief: *"⛔ DO NOT LEAN ON 403 §7.2/§7.3's 'arms 1 and 3 cannot grant in this fixture'. That claim is true of 403's OWN FIXTURE and is NOT true of the seed."* ⚠ And it records that **the re-key made it worse**: the authorizer now has **four** arms, not three (`can_create_professional` was inlined into a permission check plus `can_manage_professional`), so there is one more way for a green to be somebody else's answer. |
| pgTAP **401 §20 is ONE HOP**, not the transitive closure | ✅ **CONFIRMED.** `401:1384`: *"⚠ ONE HOP, NOT THE TRANSITIVE CLOSURE — these eleven BODIES are clean; a helper they call could still read an affiliation … Cite this as one-hop, never as …"* |
| The honest sentence is **not** "3 of 43 on layer 3": 3 sites call layer 3 and **FIVE non-permission grant paths survive INSIDE them** (410 §4.6 pins them by name) | ✅ **CONFIRMED by reading the three bodies from the catalog.** Exactly five: `is_tenancy_admin_of_for` · `can_manage_professional` · `is_admin` · `can_manage_professional` · `can_read_case_committee`. `410` §4.6 pins the string by name, and §3.7 binds those same names to `pg_proc`. |
| **A fourth representative, `org.case_vocabulary.manage`, was re-keyed** beyond the PO minimum of three | ⛔ **FALSIFIED as stated — and the distinction is load-bearing.** It was added as a **fourth DIFFERENTIAL representative in 403**, not re-keyed. ADR 0178 §4 explicitly **rejects** re-keying rows 31/32 (*"Widens the build past the PO-confirmed D6 scope. Unnecessary: this is a test-coverage gap, not an enforcement gap, and closing it requires no re-key at all"*). Catalog agrees: the literal `org.case_vocabulary.manage` appears in **zero** function bodies and **zero** policies; only 3 code literals exist. The manifest lists it `pending-rekey`. ⭐ The reason it exists is worth keeping: the re-key **split `can_create_professional`'s body**, which invalidated 401 §19.2b's shared-body premise, so rows 31/32 **silently lost differential coverage and nothing said so** — the reduction was restored, not relaxed. I verified the body identity myself: `md5(prosrc)` of `can_manage_case_vocabulary` and `can_manage_external_participant` are **identical**, and `can_create_professional`'s differs → **exactly 2 distinct bodies**, so §19.2b's expected value of 2 is *derived*, not edited to match reality. |
| **410 proves nothing about enforcement**; `hardDenyClasses` is 40/43 `not-attributable-until-rekey` | ✅ **CONFIRMED — and it is weaker still.** See F-MAJOR-1: all **43** rows are `[]`, the lint gate cannot fail on an empty list at all, the 3 "measured" rows have no discrimination control, and §6.2 is already blind to a live depth-2 instance. |
| The **MATCH FULL keystone is unreachable** on the real `memberships`; its value is **prospective** | ✅ **CONFIRMED.** `memberships_role_check` and `memberships_scope_shape` (whose `ELSE false` branch also keeps `platform_admin` and `administrativo` out entirely) both still stand and reject first. The FK is nonetheless present and correct (`confmatchtype='f'`, RESTRICT/RESTRICT). |
| **"Catalog cutover" may not describe what AE4.6 built**; the catalog is authority-**ELECT** until AE5-complete | ✅ **CONFIRMED and OBEYED.** I searched the plan, the increment record, `backend-state.md`, PROGRESS.md and all seven ADRs: the phrase appears **only** inside prohibitions of itself. `backend-state.md:799-805` leads with the prohibition. This review does not use it either. |
| The **403 repoint to the candidate evaluator** "costs nothing today and is not free forever" | ✅ **CONFIRMED** — ADR 0177 D5 + `403` §3.2b. Logged as **U11**. |
| **`ARM=census` structurally cannot see `public.assume_role`**; three of the four new AE4.9 objects carry no sweep verdict for three different reasons | ✅ **CONFIRMED** — ADR 0177 Consequences, verified against the arms' actual domain bounds. Logged as **U3** and **U4**. |

---

# 5. ⚠ In-flight tree delta — what I did NOT review, and why

Three other sessions were editing this tree throughout the review. Measured at review time
(`git status --short`), the working tree carried uncommitted modifications to:

```
 M PROGRESS.md
 M docs/design/authz-c2-tier1-sizing.md
 M docs/progress/authz-ae4.md
 M docs/progress/bug-log-archive.md
 M supabase/tests/mutation/p0-authz-writepath-audit.sh
```

Per my brief I treated **four areas as in-flight and reviewed the phase deliverables instead**:
`scripts/door-sweep-cases.sh`, the write-path sweep script and its findings file,
`docs/deployment/authz-rollback-*`, and new files under `docs/design/` and `supabase/tests/perf/`.

**Consequences the gate must absorb:**

- My reading of `docs/progress/authz-ae4.md` and `PROGRESS.md` is **as of `e897b452` plus whatever
  was uncommitted at that instant**. A clean status is an instant, not a lease. Re-measure any
  record figure I quote before citing it downstream.
- **F-BLOCK-2's rollback-runbook row may already be stale** — that file is being written now.
- I did **not** review the write-path sweep script, so **U1 stays UNPROVEN from my side too**: I am
  recording the absence of a verdict, not endorsing one.
- No `supabase/tests/perf/` directory existed at review time; IA-F9 is recorded as absent on that
  basis.

---

# 6. ⛔ Could-not-verify — this is a work item, not a disclaimer

I was constrained to read-only psql on a **shared** local stack with three other agents active, and
explicitly forbidden `supabase db reset`, `npm run test:db`, `npm run e2e:prod`, and any mutation
harness. The following are therefore **taken from the record, not independently reproduced.** Each
needs a witness before PO approval.

| # | Not verified by me | Who should close it, and how |
| --- | --- | --- |
| CV1 | **The pgTAP suite actually passes** at the head (`Files=259, Tests=8685, exit 0`). I read the suites as source and reasoned about their assertions; I did not execute one. | lead, on a **fresh** `supabase db reset` — an E2E-mutated DB yields spurious reds. |
| CV2 | **The grant-deletion differential reproduces.** I verified the chain **structurally** (unbroken policy → authorizer → `has_permission` → `role_permissions`; no permissive write sibling; the correct `409` SQL exists) but did not execute the mutation — deleting a grant is a write to a shared DB. | lead/backend, in a rolled-back transaction on a quiet stack. |
| CV3 | **The four §6 ARMs hold at the head.** Taken from `docs/progress/authz-ae4.md:846`. | lead — and per **F-MAJOR-2**, add `ARM=catalog` and `ARM=sites`. |
| CV4 | **The door sweep's READ-arm result** (7 gates, all COVERED, BLIND 0) and the census MERGE (623→624). | lead. |
| CV5 | **`npm run lint` (12 gates), `typecheck`, vitest 151f/2056.** Not run; I reviewed the gate *definitions* and the `src/` diff against §8 by reading. | lead. |
| CV6 | **The `e2e:prod` GATE GREEN artifact itself.** I verified only that the two commits since it are docs-only. I did not re-run it and could not (subagents cannot run the full gate). | lead — **and it must re-run if anything lands in response to this report.** |
| CV7 | **Whether the two un-re-keyed sibling policies (F-BLOCK-1) have E2E coverage.** Matrix row 1 names `phase4-builder.spec.ts:115-180, :261-389`; I did not read those specs to see whether they exercise option/validation writes. | tester. |
| CV8 | **`--self-test` on both vector generators actually passes** (F-MAJOR-5) — nothing runs it, so nobody knows. | backend. |
| CV9 | **C2 Tier-1's remaining 163 enforcers.** Out of scope for me and owned elsewhere; recorded so it is not lost. | lead + backend, per ADR 0162 §3. |

---

# 7. What would turn this into `APPROVED`

Ranked by cost. Nothing here is large.

1. **F-BLOCK-1** — rule (a) or (b) on `commission.forms.edit`'s three un-re-keyed sites and the
   8 DEFINER form functions; correct matrix row 1 to the measured shape; **add the site-axis
   completeness arm** so this cannot recur across the 40 remaining re-keys.
2. **F-BLOCK-3** — one PO sentence fixing the oracle's approval scope, and one line so the matrix
   header and § 4 agree.
3. **F-MAJOR-2** — run `ARM=catalog` + `ARM=sites` at the head (~5 s) and name them by arm.
4. **F-MAJOR-3** — add `007180`'s `door-sweep-targets:` marker.
5. **F-MAJOR-1** — either narrow §6.2's caption and provenance label to the depth-1 measurement it
   actually is, or make it transitive and give it a positive control.
6. **F-MAJOR-4a/b/c** — the `form_versions` mutated twin, `411` §5.1, `409`'s `LIKE` needles.
7. **F-MAJOR-5** — chain `--self-test` into gate 12.
8. **F-REC-1..8** — the record corrections (each is one line).
9. **F-BLOCK-2** — the three named gate items, owned elsewhere: the rollback §6 worked example
   (extended to six policies after F-BLOCK-1), IA-F9 performance evidence on the **final** path
   (policy → layer 3 → layer 2 → layer 1, **never `holds_role` alone**), and the C2 Tier-1 subset.
10. **Re-run `e2e:prod`** if any of 1–8 touches code, and have the PO ratify the early-review
    ordering either way.

---

## Closing note

The AE4.9 correction is a good piece of work and the tree should be able to see that alongside the
refusal. The permission layer is genuinely load-bearing where it claims to be; every resolver defect
the audit named is fixed and proven on both polarities; the manifest kills the default arm
structurally rather than by convention; and the record volunteers its own weaknesses more reliably
than most reviews find them. **The gap I found is not a lapse in rigour — it is the same closure
error the program keeps rediscovering, one level lower than the last time.** The manifest closed the
permission axis so completely that nobody asked whether the *site* lists inside it were closed too.
That is worth a finding, and it is worth the arm that stops it recurring eleven more times in AE5.

— `qa`, 2026-09-02
