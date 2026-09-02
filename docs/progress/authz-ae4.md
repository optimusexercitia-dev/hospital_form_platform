# AE4 — the authz catalog, and `staff_admin` substituted end to end (ADR 0155 D7)

Increment detail for Phase **AE4** of [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md).
Live status stays in PROGRESS.md § Now; this file carries the measurements.

- **Branch:** `authz-ae4-catalog` (cut from `main` at `145aa796`, 2026-09-01).
- **Matrix (AE4.3), the regression oracle:**
  [authz-ae43-staff-admin-permission-matrix.md](../design/authz-ae43-staff-admin-permission-matrix.md)
  — PO-approved at 42 rows, amended to 43 by § 12.8.5.
- **Deny-class effect table (AE4.5):** [authz-ae45-deny-class-effects.md](../design/authz-ae45-deny-class-effects.md).
- **Mid-phase QA review:** [authz-ae4-review.md](../reviews/authz-ae4-review.md) — its
  § "Recommended order" is what AE4.7a/b/c below executed, finding by finding.
- **ADRs:** [0172](../decisions/0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md)
  (catalog substrate) · [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md)
  (deriver blindness) · [0174](../decisions/0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md)
  (the `holds_role` chokepoint). ⛔ **AE4.7c has no ADR by PO ruling** — matrix § 12.8 is its home.

⚠ **PROMOTED VERBATIM out of this branch's handoff on 2026-09-01**, where it
had grown to 64 KB against that genus's 24 KB cap — a design document that escaped. A handoff
is ephemeral resume-state bounded by its branch and may not be cited; this record is the
citable half. Text below is unchanged from the handoff.

---

## AE4.7a — evidence repair, 2026-09-01 (lead session, after the QA pass above)

Scope was the QA § "Recommended order" step 1 **exactly**: F1, F5, F4, F6, F8. F2/F3 are the PO
batch; **F7 and the `holds_role` chokepoint are AE4.7b and were not started.**

⛔ **Everything here is VERIFIED** — every claim below was produced by a command run this session
on a fresh `db reset`. Where a QA figure was re-measured and differed, the measurement is stated,
not the QA figure.

### F1 — 403's fail-proofs were vacuous. Repaired, and each PROVEN to fire.

QA was right and the mechanism reproduces: the fixture-membership cleanup sat **above** §6, so
`sib_holder` / `xorg_holder` already disagreed on every expected-granted cell, and both `> 0`
fail-proofs passed on pre-existing disagreements rather than on their own mutations.

- The cleanup now runs **last**, beside the deactivation, with the reason recorded at both ends.
- **`6.0` is the new baseline** — `cmp_ok(disagreements(), '=', 0)` before §6's first mutation.
  That is what turns 6.1 / 6.3 from "some disagreement exists somewhere" into differentials.
- **`6.2b`** is 6.3's own baseline: 6.0 established zero before 6.1's mutation, and 6.2 is
  deliberately targeted at one coordinate, so nothing showed the sweep back at zero before 6.3.
- **`3.0`** asserts `count(r403) == count(authz_differential_cells)` — nothing proved the 657 ran.
- `plan(15)` → `plan(18)`; the RUN SHAPE comment claimed `Tests=12` against `plan(15)` and now
  reads `Files=2, Tests=19`, which is what the runner prints.

**Three probes, each restored afterwards** (the suite is 19/19 green as committed):

| Probe | Mutation deleted / restored | Verdict |
| --- | --- | --- |
| A | §6.1's `delete from authz.role_permissions` removed | **6.1 REDS** (test 15) |
| B | §6.3's resolver neutralisation removed | **6.3 REDS** (test 18), and *only* 6.3 — 1/18 |
| C | the cleanup put back **above** §6, as shipped | **6.0 and 6.2b RED** — and ⛔ **6.1 / 6.3 still PASS**, which is F1 reproduced live |

Probe C is the one worth keeping: it shows the new baselines are precisely the arms that would
have caught the defect, and that the old fail-proofs are silent about it.

### F6 — pgTAP 405 now exists. It was cited twice and had never been written.

`20261003007200` names "pgTAP 405" as its compensating control for the hat gate's **both
polarities** and for the comment-stripped `prosrc` grep. Tests ran 400–404. Post-cutover the
wrappers' **hand-copied** active-role conjunct was asserted nowhere (401 §16 tests the *resolver*,
which the wrappers do not call). `405_ae46_wrapper_cutover_invariants.sql`, 15 assertions:
§2 the self-check wrapper's hat gate both ways, plus scope · §3 the `_for` asymmetry, with a
non-holder differential so 3.3's TRUE is attributable · §4 the prosrc greps **with an instrument
control** (the strip removes what is behind `--` and keeps what is not) and a **positive control**
(both bodies *do* contain `assignment_facts` — an absence measured by an instrument that finds
nothing is not evidence) · §5 `prosecdef` plus the PUBLIC-EXECUTE asymmetry **pinned as a recorded
defect**, with the expected value AE4.7b must invert written into its own message.

⛔ **007200's header now needs no amendment — its two claims became true.** Do not "tidy" them.

**Five mutations, each proven to red the right assertion:**

| Mutation | Reds |
| --- | --- |
| `is_staff_admin_of` delegates to the adapter **alone** (the drop-the-hat-gate bug 007200 warns of) | 2.2, 4.4, 4.5 |
| `_for` applies the filter **uniformly** (the "looks like a tightening" bug) | 3.3 |
| `legacy OR new` survives in `_for` | **4.2 only** — every behavioural assertion stayed green, which is exactly why the structural grep earns its keep |
| `is_staff_admin_of` stops comparing `scope_id` | 2.3 |
| the NULL-hat `is not distinct from` "simplified" to `=` | 4.5 |

⚠ **The `legacy OR new` probe first reported GREEN because it never applied.** `app.has_role` is
`(text, uuid, text, uuid)` — role first — and the probe passed `(uuid, text, …)`, so the
`create or replace` errored and the run looked clean. Re-run with the right signature **plus an
assertion that the edit landed**, it reds 4.2. A mutation that did not apply reports green.

### F4 + F5 — the generator reads its axes, and the expected-value file finally has a gate.

`scripts/gen-authz-differential-cells.py`:

- **ROOT from `__file__`**, not a hardcoded `D:/Development/...` — it no longer dies outside this
  checkout, nor silently regenerates the primary checkout's file from a worktree. Verified by
  running it from another drive root.
- The header said `Generator: ….mjs`. It now says `.py`, which is what it is.
- ⭐ **Axis values are read from the JSON it sha-stamps.** Hard-coding them silently dropped **two**
  declared values, not one: `principalState.offboarded` (QA F4) **and `scope.zero_scope`**, which
  QA did not name.
- **arm7 resurrected.** Its predecessor read `sum(skipped.values()) > 0 and not skipped` —
  tautologically false, so it had never refused anything and *could* not: it was keyed on the skip
  dict, and a value that never enters the loop is not in it. It is now keyed on the **declared
  axes**, in three shapes (a declared value in no cell and no named exclusion · an axis with no
  disposition · an exclusion with no reason), all three exercised by `--self-test`, which is now
  **10 checks plus the discrimination control**, every one caught.
- **Every skip counter counts CELLS at one grain**, and `len(cells) + sum(skipped) == the declared
  grid` is asserted (657 + 1143 == 1800). The first draft of this fix short-circuited excluded axis
  values at their own loop level, so those counters counted loop *prefixes* while the inner rules
  counted cells — a census whose parts cannot sum, and the header total a number of nothing.
- **`--check` chained into gate 12.** `lint:authz-vectors` now guards
  `authz_differential_cells.psql`, **the file with the expected values in it**, which had no
  `--check`, no hash assertion and no gate at all. Gate count unchanged at 12, so the narrow
  CLAUDE.md authorization is respected.

**Controls run on all of it:**

- The 657 emitted rows are **byte-identical** before and after the rewrite — only header comment
  lines moved. That is the control that makes a generator rewrite safe to trust.
- `--check` **fires**: hand-flipping one `expected_granted` reds it, and reds `npm run lint` as a
  whole; restoring greens both.
- ⚠ **That first firing exposed a defect in the fix itself.** The DRIFT message died with a
  `UnicodeEncodeError` under the cp1252 gate pipe. The exit code was still 1, so the gate failed
  correctly — but the operator saw *"the generator is broken"* instead of *"the oracle's expected
  values drifted"*, which points the fix at the wrong file. It surfaced only under test because the
  **success** message is pure ASCII: the positive control could not reach the failing state. Both
  streams are now reconfigured to UTF-8 with `errors='replace'`.

⛔ **`offboarded` is a NAMED, COUNTED exclusion, not a filled cell — deliberately.** Neither
approved source covers it (the matrix is approved **at 42 rows**, and its only "offboard" mention
is prose about a different subject; the deny-class table's 9 rows have none), so emitting those
cells means **inventing** expected values — the PA-F8 trap the two-source rule exists to stop. The
exclusion's reason says so, and deleting it without an approved value is how a defect gets approved
into the oracle. **→ PO batch.**

### F8 — the arithmetic, re-measured rather than transcribed

QA's corrections mostly hold; one figure differs, and one is now superseded.

| Claim | Measured |
| --- | --- |
| "873 → 657 after 216 exclusions" (this handoff's own BELIEVED row) | **WRONG** — it pre-applied three anonymous rules. It was 1080 → 657 / 423 by four rules; it is **now 1800 → 657 / 1143 by six**, and the census is asserted to sum. |
| "~168 distinct driver inputs" | **438**, on the stated definition (persona, context, scope, **resolution-scope-kind**, state, self_check): 219 per rep × 3 reps = 657, and the two ORG-scoped reps are driver-identical, so 219 cells re-run a coordinate an earlier rep already measured. QA's 168 uses a different, unstated collapse. **The honest sentence is "657 cells over 438 distinct coordinates", never "657 measurements".** |
| "`anonymous` maps to an authenticated JWT" | **CONFIRMED.** The driver maps both `unprivileged` and `anonymous` to `f.nobody`. The 9 `deny-class:unauthenticated` cells prove exactly what `matrix-row:not-a-holder` proves, and nothing about anonymity. ⭐ **The approved deny-class table already says so** — row 8's own note records that an anonymous caller cannot reach the resolver at all (no application role holds USAGE on `authz`). The table was right; the generator emitted cells for the row anyway, and the **label** is what reads as coverage. |
| "108 third-party cells have caller == principal" | **CONFIRMED, exactly 108, all `unprivileged`** — whose principal *is* `f.nobody`, the driver's third-party caller, so for that persona the substitution recreates the defect it was written to avoid. The asymmetry's real evidence is the **26** `wrong_active_context:third-party` cells, not the 108. |

All four are recorded **in 403's header**, beside the two limitations it already carries — that
block is where a gate record will look, and a correction living only in a handoff is already lost.

### Gates at the end of AE4.7a — fresh `supabase db reset --local`

| Arm / suite | Result | Exit |
| --- | --- | --- |
| `npm run test:db` | **253 files / 8452 tests** — ⛔ RED on the same two orphaned twins (315 t14, 319 t5), **no new red**. The +1 file / +18 tests is exactly 405 (15) + 403 (3), which accounts for the delta | — |
| `npm run lint` (12 gates) | green — gate 12 now covers **both** vector files | 0 |
| `npm run typecheck` | green | 0 |
| `npm run test` (vitest) | 149 files / 2021 tests | 0 |
| `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper` | all **HOLD**, exit codes read **directly**, not through a pipe | 0 |
| diff-scoped door sweep | **NOT-APPLICABLE (exit 3)** — **0 migrations touched**, which is the checkable claim, not a pass | 3 |

⚠ **Two qualifiers belong beside any "all arms green" claim, and both are load-bearing:** QA's F7
— all five arms bound `nspname in ('app','public')`, so the **`authz` schema is outside every arm's
domain**, including the five DEFINER functions now on the live `staff_admin` enforcement path — and
C2's reachable command doors, likewise outside. **Neither is fixed here; F7 is AE4.7b step 2.**

**Did NOT run:** `e2e:prod`. AE4.7a touched no application code (a Python generator, two pgTAP
suites, one `package.json` script), so it cannot have moved it. ⛔ The gate still owes exactly what
the QA section says it owes: a b2 + b9 re-run to an actual green. Never transcribe the QA run as
green.

### What AE4.7a did NOT do

- **F2** — ✅ **RULED 2026-09-01, and the ruling changed shape on measurement.** Recorded in
  PROGRESS.md § Decisions (5 rows) and matrix § 12.8.
  - **Timing:** the gate split runs **after AE4.7b, as AE4.7c**, inside AE4 — AE4.7b re-points this
    same family onto `holds_role`, so splitting first rewrites overlapping bodies twice.
  - **The record conflict is closed:** the original ruling said *before AE4.6*, AE4.6 shipped
    without it, so that instruction is **spent, not pending**. Both records now say so.
  - ⭐⭐ **RULED (3rd pass): SPLIT ROW 30 BY OPERATION.** The PO stated the product fact — a
    `staff_admin` only ever **ADDS** a professional, never modifies or deletes one. So:
    | door | code | staff_admin |
    | --- | --- | --- |
    | `create_professional_profile` · `ensure_professional_participant` · `set_professional_link_state` | **NEW row 43** `org.professionals.create` | ✅ keeps |
    | `update_professional_profile` · `redact_professional_profile` | row 30 `org.professionals.manage` | ⛔ **loses** |
  - ⭐ **This beats the case-reach narrowing I proposed one step earlier, on every axis.** Case reach
    is a **per-RESOURCE** condition, which a role→permission→**scope** catalog cannot express — it
    would have lived in the door with `authz` still answering TRUE, needing a permanent "the catalog
    is not the whole story" caveat. *Add vs modify* is a **CAPABILITY**, which is what a catalog is
    for. No DEFINER traversal (so no fail-open from a forgotten `removed_at is null`), no
    `p_case_id` signature change.
  - ⭐ **The two doors he loses have ZERO product callers** — `updateProfessionalProfile`
    (`src/lib/participants/actions.ts:460`) and `redactProfessionalProfile`
    (`src/lib/ethics/actions.ts:637`) are exported and never called by any component, page or route.
    ⛔ A reason the change is cheap; **never** a reason to skip the tests.
  - ⚠ **`set_professional_link_state` is KEPT but BOUNDED to `link_state = 'unknown'`** for the
    `staff_admin` arm. It belongs on the ADD side (it completes an add — "Resolver vínculo" only
    renders while the row is `unknown`), but the **door accepts transitions the UI never offers**:
    it would move an established `linked` profile to `no_account`. Classic *no UI ≠ not reachable*,
    closed at the door rather than trusted to the component that hides the button.
  - ✅ **43rd matrix row APPROVED by the PO** — the first amendment to the 42-row approval, under
    that approval's own "a 43rd row needs its own approval" rule.
  - ⛔ **ORDER IS LOAD-BEARING:** § 12.3 FAMILY split → operation split → grant change. Dropping the
    `staff_admin` arm while `can_manage_professional` still gates rows 31/32 strips
    external-participant minting and the case vocabularies, which `staff_admin` **KEEPS**.
  - ⚠ **403's differential needs a NEW REPRESENTATIVE.** Its `can_manage_professional` class is
    represented by `org.professionals.manage`; once `staff_admin` loses that code every cell of the
    class becomes a denial and it goes **single-polarity** — a coverage loss no arm currently names,
    because arm2/arm5 are satisfied globally by other reps. Re-point to `org.professionals.create`
    and regenerate; both halves land in the same migration or 403 §4.1 reds on its own transition.
  - ⚠ **Reds BY DESIGN, each pinning the behaviour being removed:** `228:615`, `257:119-185`
    (⛔ its `HC0J7` drifts to `42501` and **collides with its own negative twin at `:140`**),
    `229:161-229` (⛔ `:187`'s over-grant twin may go **vacuous** — watch for that, not the red),
    `321:193` (split it: the ascent stays true for ADD, flips for MODIFY). Plus the fail-OPEN arm
    nothing covers: `staff_admin` adds (passes) / modifies (denied); sets link state from `unknown`
    (passes) / from `linked` (denied).
  - ⚠ **And the split is NOT the no-op I first called it.** `320:112` pins **exactly 12** RPCs on
    this gate with an explicit *"do not just bump the number"* instruction, so the split reds it
    **by design**. Answer-preserving, not test-neutral — re-derive that census, never bump.
- **F3** — the third legacy-equivalence class calls `can_manage_professional`, not the real
  `can_read_professional_profile` door. PO batch: its arm-3 divergence is new matrix surface.
- **F7** and the whole `authz.holds_role` chokepoint — **AE4.7b**, unchanged from the QA plan.
- The two open FUPs (PUBLIC EXECUTE; the self-check arm). 405 §5.2 **pins** the PUBLIC grant with
  the post-revoke expectation written into its message, so AE4.7b's revoke reds it loudly.

### Next — the QA § "Recommended order", minus its step 1

2. **AE4.7b** — `authz.holds_role`, both wrappers re-pointed through it, the 4-step twin plan,
   F7's domain widening, domain / census re-derivation, the catalog-completeness and
   wrapper-coverage arms, and the PUBLIC-EXECUTE revoke (405 §5.2 must flip to `array[false, false]`).
3. **AE4.7c — the `can_manage_professional` split** (✅ fully ruled; matrix § 12.8.5 is the spec).
   ⛔ **Three steps, in order, and the order is the safety property:** § 12.3 FAMILY split (rows
   31/32/33 off the gate) → OPERATION split (new `app.can_create_professional`, new row 43
   `org.professionals.create`, `set_professional_link_state` bounded to `link_state='unknown'`)
   → the grant change (`staff_admin` loses row 30). Then re-point 403's rep and regenerate.
4. **PO batch, one sitting** — F4's `offboarded` expected values, F3's arm-3 disposition, the 9
   mislabelled `unauthenticated` cells, and the two remaining FUPs. (✅ **F2 is CLOSED** — ruled
   2026-09-01; no ADR, matrix § 12.8 is its home by PO ruling.)
5. **AE4.8**, then Gate AE4 = §6 + `e2e:prod` re-run to an actual green + QA review + PO approval.

## AE4.7b — the chokepoint, 2026-09-01 (lead session, after AE4.7a)

Scope was the QA § "Recommended order" step 2 **exactly**, plus the F9 bullet that step 2's own
plan rests on (`authz.roles.state`). ⛔ **Everything here is VERIFIED** — every figure was produced
by a command run this session, exit codes read DIRECTLY rather than through a pipe.

**ADR [0174](../decisions/0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md)** is the
decision record (amends 0106 and 0079). Three commits: `58c42d7c` (the chokepoint), `51b9f168`
(F7 + the hat arm), `2e838333` (the two new arms).

### The headline: `test:db` is GREEN, and the twins were repaired rather than deleted

| | before | after |
| --- | --- | --- |
| `npm run test:db` | 253f / **8452**, RED on 315 t14 + 319 t5 | 253f / **8467**, **PASS** |

The +15 accounts exactly: 405 15→26 (+11), 315 22→25 (+3), 319 17→18 (+1). Nothing else moved.

### 1. `authz.holds_role` — one site for the hat

Both wrappers are now one-liners over it. The §6A self / third-party asymmetry is derived
INTERNALLY from `p_principal is distinct from auth.uid()`, so it is written once and each wrapper's
polarity falls out — 405 §§2.2/3.2/3.3 were written against the hand-copied bodies and **pass
unchanged**, which is the evidence the collapse was behaviour-preserving.

⭐ **`authz.roles.state` stops being inert.** `holds_role` requires `authoritative`.
⛔ **Consequence, and it is not a bug:** `holds_role` denies all ELEVEN legacy roles even with a
live, correctly-scoped membership and the matching hat. `app.has_role` still serves those and is
untouched. 405 §6 asserts both polarities **and** flips `org_admin`'s state inside the transaction
to prove the denial tracks the column and nothing else.

### 2. The twins — and the one that was VACUOUS on the first attempt

- **315** — the revert-twin's probe moved to `public.form_block_library`, derived from `pg_policy`
  rather than chosen: exactly ONE policy of any command, two arms, one CATALOG-routed and one still
  `has_role`-routed, over the SAME row for the SAME caller. Plus an **ARM-SPLIT CONTROL** asserting
  the catalog arm stays SHUT under the same mutation — which is both the attribution for the twin
  and the measurement explaining why the original was orphaned.
- **319 A5** — ⛔ **THE INSTRUCTIVE FAILURE, recorded in the file itself.** The obvious repair
  (staff_admin hat, expecting `111 → 175` as S2's bit 64 appears) **measured 111**: S1's mask 111
  ALREADY CONTAINS bit 64, so S2's whole contribution is masked by an arm that is legitimately
  open, and the twin observes nothing while looking exactly like a twin. Caught by a red. A5 now
  wears a hat `sa_x` does not hold — `0 → 64` exactly — which carries the leak AND the arm-split
  control in one equality. **A4b** is its pre-mutation zero.
- **405 §7** — the wrappers' own twins, which did not exist: neutralize the hat conjunct (§2.2's
  case flips to wrongly TRUE), neutralize the `state` conjunct (a legacy role is wrongly admitted).
  Each asserts the edit LANDED before observing anything; each restores byte-identically, and 7.4
  restores against the FIRST snapshot, not its own predecessor's.

### 3. F7 — the `authz` schema had never been in any arm's domain

Widened harness + deriver to `('app','public','authz')`. ARM 3 then flagged three gates as UNKNOWN
— **the arm working**. Verdicts: `has_direct_permission` **COVERED** · `holds_role` **ERROR**
(the documented load-bearing-predicate class, inherited by construction — it IS both wrappers) ·
`scope_reaches` **backlog (b)** with 403 §6.3 named as its mutation-proven keystone AND that
keystone's bound stated (two callers, §6.3 mutates one).

⛔ **Three of the six authz functions remain OUT of every arm and are named per door** in the
harness comment: `assignment_facts` (set-returning, no `authenticated` EXECUTE),
`explain_direct_permission` + `rebuild_implication_closure` (prosecdef scalar non-bool = C2).
State that beside any "the authz schema is swept" claim.

⭐ **The hat arm was measuring a subject that had moved.** Its own domain also bounded on
`('app','public')`, so `authz.assignment_facts` — the only body in the tree reading
`public.memberships` for a principal with no hat of its own — was invisible, and its anchor list
still asserted only `app.has_role(_any)`, which the staff_admin family no longer evaluates.
`authz.holds_role` is now the **third anchor**, **ST7** proves that anchor check flips, and
`assignment_facts` is allowlisted with a per-caller compensating control and three WRONG-THE-DAY
conditions.

### 4. The two new arms, each proven able to FAIL

- **`ARM=catalog`** — flipping `org_admin` to `authoritative` reds it with both missing artifacts
  named (exit 1); restored. ⚠ Its first draft globbed `*differential*.sql` and matched
  `392_ae23a_widening_differential.sql` — right role, wrong file, reported OK. Now bounded by the
  oracle's own artifact (`authz_differential_cells`).
- **`ARM=sites`** — a planted `app.zz_arm7_bypass_probe` carrying `role = 'staff_admin'` is flagged
  by name (exit 1); dropped. 14 sites today = 2 wrappers + 12 allowlisted, matching 007200's hand
  census exactly. ⚠ Its own first run is why its vacuity control is a **PAIR**: psql does not
  interpolate `-v` variables inside `-c`, both lookups died with a syntax error, and the arm
  printed `OK: staff_admin — 0 site(s)` beside `vacuity control: OK`. A dead instrument satisfies
  a set-difference check and a negative control at the same time.

### 5. FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE — closed, with a finding inside the closure

Revoked, asserted on both sides by EFFECTIVE PRIVILEGE, with a pre-condition, an **over-revoke
twin** and a sibling-unmoved check. ⚠ pgTAP **320**'s ratchet header listed this grant among "the
explicit nine … a decision, not drift", because they run inside policies `anon` may evaluate.
Measured before the revoke: of the **64** policies calling it, **ZERO** are granted to `anon` or
PUBLIC, and `anon` holds SELECT on **ZERO** `public` tables. Drift wearing a decision's label,
inside a list whose purpose is to tell the two apart. Ratchet re-pinned 237→236 (control 238→237).
⚠ **The other eight were NOT re-derived** — this says nothing about them.

### Gates at the end of AE4.7b — fresh `supabase db reset --local`

| Arm / suite | Result | Exit |
| --- | --- | --- |
| `npm run test:db` | **253 files / 8467 tests — PASS** | — |
| `npm run lint` (12 gates) | green | 0 |
| `npm run typecheck` | green | 0 |
| `npm run test` (vitest) | 149 files / 2021 tests | 0 |
| `ARM=census` | HOLDS — 574 live / 610 with a verdict | 0 |
| `ARM=hat` | HOLDS — self-test **7/7**, 4 reasoned-allowlisted findings | 0 |
| `ARM=floor` | HOLDS — 72 never-called doors, all allowlisted | 0 |
| `FROMFINDINGS=1 ARM=wrapper` | HOLDS — BLIND set 41 | 0 |
| **`ARM=catalog`** (new) | HOLDS — 1 non-legacy role, both artifacts | 0 |
| **`ARM=sites`** (new) | HOLDS — 14 sites, 2 wrapper + 12 allowlisted | 0 |
| diff-scoped sweep (read arm, 3 cases) | **DIRTY — 0 BLIND, 3 ERROR**; baseline cksum-verified unchanged | 1 |
| census-backfill sweep (2 cases) | **UNPROVEN (PARTIAL)** — 1 COVERED, `scope_reaches` matched no gate | 3 |
| write arm | **0 cases** — the deriver's own output, a claim to check | — |

⛔ **The two non-zero sweep exits are NOT waved through.** The 3 ERRORs are the documented
load-bearing-predicate class (run-shape drops because the neutralized run produces genuine failures
across 20+ suites and two files abort on a Bad plan) — recorded in the findings md with what the
run actually produced, and 405 §7 is the deterministic substitute. The UNPROVEN is `scope_reaches`
being outside the predicate arm's NAME/identity filter — routed to the backlog with a
mutation-proven keystone, never read as a pass.

**Did NOT run:** `e2e:prod`. AE4.7b touched no application code (one migration, four pgTAP suites,
four harness scripts, three allowlists/backlogs). ⛔ The gate still owes exactly what the QA section
says it owes: a b2 + b9 re-run to an actual green. Never transcribe a prior run as green.

### What AE4.7b did NOT do

- **AE4.7c** — the `can_manage_professional` split. Fully ruled, next in order (§ Next task).
- **The PO batch** — F4's `offboarded` expected values, F3's arm-3 disposition, the 9 mislabelled
  `unauthenticated` cells, and the two remaining FUPs (the self-check arm; `novato.pendente`).
- **`PRED_DOMAIN`'s bound** — stays routed to C2, per QA's explicit instruction. `scope_reaches`
  is the specimen that shows what that bound costs.
- **The other eight PUBLIC-EXECUTE grants** in 320's list — not re-derived.
- **`docs/backend-state.md`** — no `authz` section yet; it is a Record-step artifact and AE4 merges
  once, at Gate AE4.

## AE4.7c — the `can_manage_professional` split, 2026-09-01 (lead session, after AE4.7b)

Scope was matrix § 12.8.5 **exactly**, in the order that ruling makes load-bearing. ⛔ **No ADR
— by PO ruling, matrix § 12.8 is this decision's home**; § 12.8.1's state table is updated in
place with a closure column. Two commits: `317d48dd` (the split), `cf28cbc6` (the sweep).

⛔ **Everything here is VERIFIED** — produced by a command run this session, exit codes read
directly.

### What shipped

| | |
| --- | --- |
| `20261003007220` **step 1, FAMILY** | `app.can_manage_external_participant` (row 31) · `app.can_manage_case_vocabulary` (row 32) · `app.is_org_commission_staff_admin` — **the ascent, isolated to ONE site**. Seven doors re-pointed. |
| `20261003007230` **step 2, OPERATION + GRANT** | `app.can_create_professional` (row 43) · `can_manage_professional` narrowed to org authority · three ADD doors re-pointed · `set_professional_link_state` **bounded to `link_state='unknown'`** · catalog: row 43 inserted + granted, row 30 **revoked** from `staff_admin` |
| catalog after | **43 permissions, 42 grants** — `staff_admin` holds 42 of 43, and 401 § 14.7b names which one it does not |
| `test:db` | 253f/8467 → **254f/8498, PASS** |

⭐ **Why the ascent got its own function.** Three gates needed the same clause. Hand-copying it
three times is the shape AE4.7b spent an increment collapsing. It is also what makes 401
§ 19.2b's claim — *three of the six legacy classes share ONE body, so one differential
representative answers for all three* — **checkable from `prosrc`** rather than a coincidence.

### ⛔ Three things the ruling did not predict, each found by a red

1. **`app.can_read_professional_profile`'s arm 1 had to move.** Row 33 `org.professionals.read`
   is a code `staff_admin` **KEEPS**, and that arm is its only enforcement site. Leaving it on
   `can_manage_professional` would have denied every `staff_admin` the org-wide read the matrix
   grants — catalog TRUE, legacy FALSE, and 403 § 4.1 red on a divergence the split never
   intended. It follows the POPULATION now, not the gate name. ⚠ The 403 driver's row-33
   SUBSTITUTION had to move with it, or the red would have been a substitution artifact (QA
   finding **F3** is still open and deliberately untouched).
2. **229's over-grant twin went VACUOUS and 257's `HC0J7` collided with its own `42501`
   control** — both exactly as § 12.8.5 predicted. ⛔ Neither was re-coded: re-coding 229's
   expectation to `42501` would have left B7's freeze trigger asserted by **nothing** while the
   line kept its name. Both were **SPLIT** — authority and freeze now have separate assertions
   with separate callers (a `platform_admin` passes the AE4.7c bound and is still refused by the
   freeze). 257's Block C/E callers moved for the same reason.
3. **The write-path harness holds a HAND-WRITTEN COPY of each guard's gate text**, and the split
   falsified two of them: the first write-arm run came back **DIRTY, 2 ERROR `neutralize
   failed`**. ⚠ ERROR is not BLIND and is not a pass — nothing was measured. Fixed, and a note
   now travels with those strings saying any migration rewriting one of these blocks owes an
   edit there in the same commit.

### pgTAP 406 — the direction nothing else measures

Every other suite AE4.7c touched measures access being **REMOVED**. 406 measures the other
direction: each denial sits beside an admission by a principal who should pass, and § 5 deletes
the `unknown` bound and watches the staff_admin refused at 4.2 walk through.
⚠ Its own § 2 cost a red worth keeping: `is_org_admin_of` reads **`auth.uid()`, not `p_uid`**, so
asserting org-authority by passing `oa` as the parameter measured nothing. That is
FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM demonstrated — and AE4.7c **sharpened** it: with the
ascent gone, `can_manage_professional`'s `p_uid` is a null guard and nothing else.

### Gates at the end of AE4.7c — fresh-reset tree

| Arm / suite | Result | Exit |
| --- | --- | --- |
| `npm run test:db` | **254 files / 8498 tests — PASS** | — |
| `npm run lint` (12 gates) · `typecheck` · `test` (2021) | green | 0 |
| `ARM=census` (578 live / 618 with a verdict) · `hat` · `floor` · `wrapper` · `catalog` · `sites` (14) | all HOLD | 0 |
| diff-scoped sweep — **READ** arm, 16 requested | **6/6 predicates COVERED**, 0 BLIND, 0 ERROR | 3 |
| diff-scoped sweep — **WRITE** arm, 11 requested | **4/4 guards COVERED** (after fixing 2 ERROR) | 3 |

⭐ **`app.can_manage_professional` went `ERROR` → `COVERED`.** It was `run-shape!=baseline` for
the whole of AE4.7b. Not a harness improvement — the gate got smaller: 12 doors across three
capabilities became 3. The documented "the most central predicates are exactly the ones this
harness cannot verdict" class is **escapable, and the escape is scope, not tooling.**

⛔ **Both sweeps exit 3 UNPROVEN (PARTIAL), and that is recorded rather than rounded off.** The
six vocabulary RPCs matched no gate on either arm — `uuid`/`void` returns, the
`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (**C2**) class. AE4.7c did not create that gap (before the split
they sat behind `can_manage_professional`, equally unswept) and deliberately did not close it;
their GATE is COVERED and pgTAP 290 exercises all six denials. Named in
`authz-writepath-audit-findings.md`. ⚠ Measured: they are **not** on C2's Tier-1 worklist either.

**Did NOT run:** `e2e:prod`. AE4.7c touched one TypeScript **doc comment** and nothing else in
`src/`. ⛔ The gate still owes a b2 + b9 re-run to an actual green.

### What AE4.7c did NOT do

- **The PO batch** — F4's `offboarded` expected values, F3's arm-3 disposition, the 9 mislabelled
  `unauthenticated` cells, and the two remaining FUPs.
- **`org_admin`'s catalog grant of row 43.** The matrix says row 43 is granted to `staff_admin`
  **and `org_admin`**; the catalog records only the SUBSTITUTED role's grants until AE5, and 401
  § 14.8 asserts exactly that. `org_admin` holds row 30 in the product today with no catalog
  grant either — granting it row 43 alone would make the catalog say org_admin may create but not
  manage, false in both directions. The enforcement predicate does include org authority.
- **The six vocabulary RPCs' standing write-arm entry** (above).
- **`docs/backend-state.md`** — still no `authz` section; a Record-step artifact.
- ⚠ **PROGRESS.md is now 98 KB against an 82 KB target — 4.4 KB from the HARD CAP.** Rotation is
  PO-deferred to the Record step, and AE4.8 will not fit. ⛔ Compressing under cap pressure cuts
  qualifiers first, which is how a bound becomes a bare claim; rotate before the next increment.

## AE4 PO batch — 2026-09-01 (lead session, after AE4.7c)

Four items reached the PO in one sitting. Decision record: ADR
[0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md). ⛔ This section records
what the build **measured**; the ADR records what was **ruled**, and the two differ in one place
that matters (D1).

### D1 — `offboarded`: ruled by cells, rebuilt as a structural proof

⛔ **THE FIRST RULING WAS "EMIT THE 91 CELLS", AND IT WAS WITHDRAWN BEFORE ANY CODE, ON A
MEASUREMENT.** The cells would have been born vacuous: `403` contains **zero** occurrences of
`affiliation` and creates no affiliation row for any fixture principal, and its driver has no
`offboarded` branch. So four of five personas are *already* permanently offboarded — their
offboarded cell would be byte-identical to their active cell — and `subject_holder`
(`chefe.ccih`, 1 live org affiliation) would have run **active under an offboarded label**. That
is the same defect D2 deletes nine cells for, and D1 would have created 91 more of it.

Built instead: **pgTAP 401 § 20**, three assertions.

| # | What it asserts | Why it is there |
| --- | --- | --- |
| 20.1 | 0 of **11** path functions reference an affiliation relation — the 6 `authz.*` **and** the 5 legacy predicates the oracle calls | Both halves of the differential are affiliation-blind, so offboarding cannot move either answer, for **all** inputs |
| 20.2 | the same predicate over `app`/`public` finds **>=20** (52 at authorship) | ⛔ DISCRIMINATION — a typo'd regex returns zero everywhere and 20.1 reads as a proof while being a dead instrument |
| 20.3 | the probe ranged over exactly **11** functions | ⛔ 20.1 is NAME-keyed; a rename shrinks the in-list silently and 20.1 passes having checked less |

⚠ **Two bounds that must survive to the gate record.** (1) **ONE HOP** — those eleven *bodies*
are clean; a helper they *call* is outside § 20's domain, and closing that needs a gate-aware
closure walk. (2) The stem is **`affiliat`**, not `affiliation`: the narrower form cannot match
`is_affiliated_with_hospital_for`, and the first measurement behind the ADR used it and
**undercounted 52 as 47**. The conclusion held under the stronger predicate; the count did not.

### D2 — the nine `unauthenticated` cells, deleted

`657 -> 648` cells, exactly nine, and `deny-class:unauthenticated` is gone from the emitted source
list. The persona is excluded **by name** so arm7 sees it, and `expected()` now **raises** if the
persona ever reaches it — a removal of the exclusion fails at generation time instead of quietly
resurrecting a vacuous class under a plausible label.

⭐ **The header's arithmetic was RE-DERIVED, not scaled.** It read `657 / 438 / 219`; the new
figures are **648 / 432 / 216**, computed from the regenerated file. Distinct-coordinate count
does not move with cell count in any fixed ratio, so hand-scaling would have produced three
confident wrong numbers. The `108 third_party cells with caller == principal` and the `26
wrong_active_context:third-party` figures were re-measured and are **unchanged**.

### D3 — 403 calls the door its class is named for

The `else` branch substituted `can_create_professional` for `can_read_professional_profile`, so
arms 1 and 3 of a three-arm disjunction were outside the differential entirely. It now calls the
real door. This needed a **subject**, which is why the substitution existed: the door takes a
*profile* id and derives the org **from the profile**, so a single profile would have collapsed
the scope axis to one column while the cell ids still claimed three. Fixture: **one profile per
org**, mapped by the same scope rule the driver uses for `v_scope_id`.

⭐ **§§4–5 stayed green with the real door in place** — so the substitution *was* faithful, and
that equivalence is now measured every run instead of assumed.

⛔ **What it does NOT buy, asserted in § 7 rather than promised in prose:** arms 1 and 3 are now
*evaluated* but cannot *grant* here — 7.2 (no fixture principal is a platform admin) and 7.3 (no
`professional_participants` row for either subject profile). So a widening that makes them grant
is caught; a widening **inside** arm 3's traversal is not. **Exercised != oracled** — PO-deferred
to the AE5 matrix, and the gate record may not write "the differential is green" without it.

⛔ **SCOPE CORRECTION, measured 2026-09-02 on the SEED during the AE4.9 D6 re-key — the sentence
above is true of 403's OWN fixture and was being read as true of the database.** 7.3's premise
("no `professional_participants` row for either subject profile") holds only inside 403. On a
fresh `db reset` the single seeded `professional_profiles` row (`fb…e1`) **does** carry a
`professional_participants` row, and `app.can_read_case_committee(ca…e1, chefe.ccih)` measures
**`t`** — so arm 3 **grants on the seed**, and any later mutation aimed at
`can_read_professional_profile`'s *org* arm reads green-after-mutation for an unrelated reason
(an open masking arm). The qualifier owed to the gate record is therefore **"arms 1 and 3 are
exercised but not oracled, and arm 3 is additionally OPEN on the seed fixture"** — not "cannot
grant". ⚠ A real filter cited for a conclusion it does not bound: 403's fixture premise is
genuine, and quoting it at database grain is what made it read as a proof. Any suite mutating
that door must construct a **participation-free** profile (pgTAP 409 does).

### D4 — the two follow-ups

**(a) The ruling named the wrong function.** D4(a) said "document `p_uid` in
`can_manage_professional`" — measured, that comment **already says it** (AE4.7c wrote it). The
undocumented one is its caller `can_create_professional`, which AE4.7c's own comment says
inherited the third-party call site. Measured grain:

    can_create_professional(p_org, p_uid)
      = can_manage_professional(p_org, p_uid)       -- arms read the CALLER; p_uid = null guard
     or is_org_commission_staff_admin(p_org, p_uid) -- honours p_uid

⭐ **Mixed-grain**: one arm answers about the target, the other about the caller. Reachable
consequence, now recorded on the function itself: `can_read_professional_profile` forwards a
third-party `p_uid` here, and when the **caller** is an `org_admin` of that org this returns true
whoever `p_uid` is. Harmless today — every caller in the tree passes `auth.uid()` — and a trap for
the first that does not. Migration `20261003007240`, **comment-only**.

**(b) Production auth was measured, and it moved.** Detail in ADR 0175 D4; the headline is that
only **one** Supabase project exists, which retires a false premise in
`follow-ups-archive.md:68` (*"remote TEST project … still TODO for real production"* — that
separate project does not exist). ⚠ The setting itself was **never read** — the MCP exposes no
auth-config endpoint — so the disposition is **downgrade, not close**.

### Gates at the end of the PO batch — fresh `supabase db reset --local`

| Gate | Result | Exit |
| --- | --- | --- |
| `npm run test:db` | **254 files / 8504 tests — PASS** (8498 + 3 in 401 § 20 + 3 in 403 § 7) | 0 |
| `npm run lint` (12 gates; gate 12 `--check` over both vector files, 648 in sync) | green | 0 |
| `npm run typecheck` | green | 0 |
| `ARM=census` · `ARM=hat` · `ARM=floor` · `FROMFINDINGS=1 ARM=wrapper` | HOLD | 0 · 0 · 0 · 0 |

⛔ **THE DERIVER EXITED 1 AND IT IS RULED, NOT WAIVED.** `scripts/door-sweep-cases.sh` reports
FINDING(1) — the diff touched `supabase/migrations` and zero cases were derived. Discharged by its
option (b), **as a claim someone can check**: migration `20261003007240` contains exactly two
statements — a `do $$` existence guard that only ever `raise`s, and one `COMMENT ON FUNCTION`. No
policy, no function/trigger/table DDL, no GRANT/REVOKE. Verified against the catalog rather than
the file: `prosecdef` = t, `proconfig` unchanged, `authenticated` EXECUTE = false, and `prosrc`
**byte-identical** to its pre-migration body.

**Did NOT run:** `npm run e2e:prod`. No `src/` file was touched by this batch (the only
application-side change is a SQL comment), so it cannot have moved — ⚠ but it was **already not
green as-run** and owes a b2 + b9 re-run, which AE4.8 inherits.

### What the PO batch did NOT do

- **Arm 3's divergence is not ruled** — deferred to AE5 by D3, with § 7.3 as its tripwire.
- **`FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM` is documented, not closed.** The mixed grain
  still exists; only the trap is now signposted.
- **`FUP-SEED-PENDING-PERSONA` is downgraded, not closed** — `seed.sql` untouched, and the auth
  setting itself is still unread.
- **The one-hop bound on § 20** is not closed; the transitive closure was not walked.
- **The 403 fixture still cannot express `offboarded`** — four of five personas hold no
  affiliation, so their cells labelled `active` are inaccurate. Harmless while nothing on the path
  reads affiliations (§ 20 is exactly that proof), but it is a fixture that cannot express a
  distinction it names. Filed, not fixed inside AE4.

## AE4.8 — the app-side seam collapse, 2026-09-02 (lead session, after the PO batch)

Rotated out of PROGRESS.md § Now 2026-09-02 (the § Now bullet had grown to the point where
the tracker was 359 bytes from its hard cap). ⚠ **One claim was CORRECTED in the move, not
copied** — see "G4" below.

### What shipped

- **`role-catalog.ts` holds ONE ordered manifest** — `ROLE_ORDER` + `ROLE_SCOPE_KIND` +
  `ROLE_MANIFEST`. `page.tsx`'s eight `if` blocks and `landingRouteForRole`'s eight `switch`
  arms collapse into ONE walk over `LANDING_BRANCHES` applying the same `resolveLanding`.
- **Bound to the catalog by `role-catalog.test.ts`** — ⚠ keyed on **`session_selectable`, NOT
  row count**: `authz.roles` has 12 rows against 11 roles, because `administrativo` is the
  delegated capability, not a role (ADR 0061). A row-count binding would have been green and
  wrong.
- ⚠ **The partition keys off BRANCH, not scope.** `org_admin` and `nsp_org_admin` share a scope
  and land in different lists — a scope-keyed partition looks equivalent and is not.

### Two plan predictions that did not survive measurement

- **"Six label maps collapse into `ROLE_LABELS` re-exports" — the six do not exist.** Measured:
  **7** maps over **5** different role types, and the 2 platform-role ones carry deliberately
  different pt-BR wording. PO ruled **bind the KEY SETS, keep the wording**.
- **G4 "typed query" — ruled NOT IMPLEMENTABLE in flight, and that ruling is now SUPERSEDED.**
  The in-flight argument was that `authz` is outside `config.toml`'s exposed schemas and no
  client role holds USAGE (anon / authenticated / **service_role** all false), so a typed query
  would need a NEW public door into the schema AE4 sealed; the binding was moved to gate time.
  ⛔ **ADR [0176](../decisions/0176-authz-permission-layer-made-real.md) D7 reversed this the
  same week:** the ruling had read G4's "typed query" as a *client-side* query.
  `public.assume_role` is `SECURITY DEFINER` and reads `authz.roles.session_selectable`
  server-side **with no new grant**, so G4 is enforceable after all; pgTAP proves a true→false
  mutation blocks selection while other roles still select. The vitest key-set comparison stays,
  demoted to a presentation-drift guard. ⭐ **Recorded here with both halves deliberately:** the
  sealed-schema measurement was TRUE and the conclusion drawn from it was FALSE, which is the
  shape that survives review.

### Gates at the end of AE4.8

vitest **151 files / 2058 tests**, `lint` 12/12, `tsc` 0 — exits read directly.
⛔ **`e2e:prod` RED** — that is the phase's live blocker and its record is PROGRESS.md § Bug Log,
not this section.

### What AE4.8 did NOT do

- ⭐ **`landingRouteForRole` had ZERO tests and was refactored uncovered.** 31 cases are now
  pinned, every expectation derived from the PRE-refactor code — but they were written *after*
  the refactor, so they pin the new behaviour against a reading of the old, not against a
  recorded baseline.
- **`ae48-landing-by-scope-kind.spec.ts` is a NEW spec written by the lead**, claimed proven on
  both polarities. ⛔ It owed tester sign-off at the time of writing (CLAUDE.md §4/§6).
- **Nothing merged, nothing pushed** — the whole phase merges once, at Gate AE4.

---

### E2E narrative rotated verbatim from PROGRESS.md § Now, 2026-09-02

> Rotated because the single-run `e2e:prod` green (`GATE_EXIT=0`, 1273/1273) SUPERSEDED it.
> Kept verbatim rather than summarized: the qualifiers are the point, and a compression to
> fit a byte cap is exactly what selects against them.

✅ **RE-MEASURED 2026-09-02 AFTER THE AE4.9 SQL — every one of the 122 spec files now holds a PASSING verdict, and the 62 infra-unproven are RESOLVED: batch 7 (the FF family) measured `70 passed · 0 failed · accounted 70/70 · pw_exit 0`.** ⛔ **BUT THE §6 STEP-2 ARTIFACT IS NOT EARNED — that green is a COMPOSITE OF THREE RUNS, and the gate has never exited 0 over the whole suite at this tree.** §6 says the full suite runs **once** to declare green; a union of three partial runs is a different artifact and may not be written as *"e2e:prod green"*. Composition, so a successor can audit it rather than trust it: run A batches 1–17 = the first **100** specs, `0 failed` in every batch (aborted at b19 by the lead, deliberately); run C = the remaining **22** specs at `BATCH_TESTS=22`, 200 passed with **zero assertion failures**; run D = the 3 specs run C left unproven, `GATE_EXIT=0`, **27/27**. ⭐ **NO TEST HAS FAILED AN ASSERTION ANYWHERE AT THIS TREE.** Every red was connection-level: a standalone server that binds :3000 and answers 404 in 13 ms while logging `✓ Ready in 0ms` (a boot that never completed) · a `db reset` dying mid-migration on `effect/sql/SqlError: Connection error` · a `page.goto` returning `net::ERR_ABORTED` inside the auth helper. ⚠ **PO INPUT (2026-09-02): the machine was running a second workload** — a second Supabase stack (`supabase_*_escalume`) was up throughout — which explains the connection-level class better than any harness theory. ⛔ **A "degrades over the run" reading was RETRACTED**: `FUP-E2E-SERVER-DEAD-1`'s own history has deaths at batches 5·6·9·12·16·17, i.e. scattered, so lateness is a property of one run, not of the harness. ⛔ **And batch 7 was never special** — the prior record's *"auto-re-run got WORSE, 56→62"* invited that reading; the deaths land wherever the machine is loaded. ▶ **Owed for the gate record: ONE full `e2e:prod` to exit 0 in a SINGLE run on a quiet machine.**

### AE4.8 detail rotated verbatim from PROGRESS.md § Now, 2026-09-02

> What § Now carried about AE4.8 after the narrative moved here: what this section holds,
> the one claim the move corrected, the AE4.8 gate figures, and the superseded run-2 note.

— the increment record it had owed since the build, written in the same edit that freed this file's last headroom. It carries the manifest collapse, the `session_selectable`-not-row-count binding, the BRANCH-not-scope partition, both plan predictions that failed on measurement, and what AE4.8 did NOT do. ⛔ **One claim was CORRECTED in the move:** § Now had carried *"G4 IS NOT IMPLEMENTABLE AS WRITTEN"* — **superseded by ADR 0176 D7** (the ruling read G4's "typed query" as client-side; `public.assume_role` is DEFINER and reads `session_selectable` server-side with no new grant). vitest **151f/2058**, lint 12/12, tsc 0. ⚠ **The AE4.8-era `e2e:prod` run-2 figures are SUPERSEDED and are NOT restated here** — its *"1 failed"* was a serial-abort artifact and its 62 infra-unproven are resolved; the current E2E position is stated ONCE, below.

## AE4.9 "do now" 1+2 — the resolver's contract corrected, and `assume_role` enforcing `session_selectable`, 2026-09-02 (backend)

Subjects: `20261003007250_ae49_d4_resolver_contract.sql` (ADR 0176 **D4** / [IA-F3]) and
`20261003007260_ae49_d7_assume_role_session_selectable.sql` (ADR 0176 **D7** / [IA-F4]).
Implementation rulings: ADR
[0177](../decisions/0177-ae49-resolver-contract-implementation-choices.md). ⛔ Two migrations, not
one: disjoint objects, different `door-sweep-targets`, independently revertible.

### The zero-caller premise, measured BEFORE and AFTER

`pg_proc.prosrc ~ 'has_direct_permission|explain_direct_permission'` (comment-stripped) returned
**zero rows** before the change; afterwards `has_permission`, `candidate_has_permission` and
`explain_permission` each have **zero callers** anywhere — no SQL body, no policy, no `src/`, no
`e2e/`. The migration ASSERTS the premise at apply time rather than trusting this paragraph. ⛔ That
is a REACHABILITY fact and it expires at the first re-keyed site (0176 D6).

### Every defect reproduced FIRST, on the live catalog at head `20261003007240`

Rolled-back transaction, principal `chefe.ccih@test.local` (staff_admin @ CCIH):

| probe | before | after |
|---|---|---|
| kind `commission` (correct), commission id | `t` | `t` |
| kind `hospital` (wrong-but-plausible), same id | **`t`** | `f` |
| kind `banana` (nonsense), same id | **`t`** | `f` |
| kind `NULL` | **`t`** | `f` |
| `org.professionals.read` at kind `commission` | **`t`** | `f` |
| resolver with `staff_admin` set to `legacy` | **`t`** (while `holds_role` said `f`) | `f` |
| grant DELETED, own commission → explanation | **`scope_unreachable`** | `permission_not_granted` |
| FOREIGN-ORG commission → explanation | `scope_unreachable` | `scope_unreachable` |

⭐ The last two rows are the collapse: two completely different situations, one string. Both
"before" columns are re-asserted **inside** pgTAP `407` (§§2 and 4 carry hand-frozen copies of the
DROPPED AE4.4b bodies), so the corrections stay anchored on a measured defect after the pre-change
catalog is gone. ⚠ Legitimate only because those bodies were dropped and can never drift.

### What shipped

Four functions replace two: `authz.has_permission` (runtime, `authoritative` only, fails closed),
`authz.candidate_has_permission` (the pre-cutover oracle — also sees `test_validation`, never
`legacy`, ⛔ never EXECUTE-granted), `authz.explain_permission` (diagnostic only) and
`authz.entailed_grants` (the ONE copy of the entailment join, gates returned as COLUMNS).
`p_scope_kind` is validated against `resolution_scope_kind` and fails closed on NULL;
`permission_explanation.denied_reason` now carries the `authz.denial_reason` domain, extended by
three outcomes (`scope_kind_mismatch`, `role_not_authoritative`, `permission_not_granted`); the
granting path is reported under a stated precedence (lowest `role_code`, then lowest
`granting_permission_code`, `C` collation). `public.assume_role` reads `session_selectable`
server-side inside its own DEFINER body — ⛔ **no application role gained USAGE on `authz`** (`408`
§1.3 asserts it).

### Evidence — both polarities, and every suite shown able to RED

- `407_ae49_resolver_contract.sql` (54 tests) and `408_ae49_assume_role_session_selectable.sql`
  (17 tests), both PASS.
- ⭐ **VACUITY PROOF, measured not argued.** With the corrections reverted in place on a live stack
  (old bodies restored, gate stripped), `407` fails **13 of 54** (2.3, 2.5, 2.6, 2.8, 2.10, 2.11,
  3.3, 3.5, 3.7, 4.3, 4.4, 5.2, 6.1) and `408` fails **3 of 17** (1.1, 3.1, 4.2) — each exactly the
  assertions the change owns. `408`'s discrimination halves (§3.2/§3.3) correctly stay GREEN in both
  worlds, which is what they are for.
- `408` §§3–4: `true → false` on one role's `session_selectable` blocks THAT role while **two**
  siblings still select; restore proven; and deleting `platform_admin`'s catalog row proves the
  fail-closed branch (reachable only there — `memberships_role_scope_kind_fkey` MATCH FULL /
  ON DELETE RESTRICT makes it unconstructible for membership-derived roles; `408` §0.3 asserts that
  FK rather than arguing it).
- `407` §6: neutralising `authz.scope_reaches` out of the SHARED `entailed_grants` body moves all
  three consumers at once — and §6.3 shows the explanation's reachability computation does **not**
  move, because it is independent of the permission join. That is 0176 D4's requirement, proven by
  differential rather than by reading the body.

### Gate figures — exits read DIRECTLY from output, never from a pipeline tail

`test:db` **256f/8579 PASS** (254f/8504 → +2 files, +75 tests: 407 = 54, 408 = 17, 401 +3, 403 +1) ·
`lint` **12/12** · `tsc` **0** · `gen:types` **empty diff** (`authz` is not an exposed schema and
`assume_role`'s signature is unchanged).

**ARMs**, on a FRESH reset before each suite-running arm: `ARM=census` **exit 1 → then 0** ·
`ARM=hat` **0** · `ARM=floor` **0** · `FROMFINDINGS=1 ARM=wrapper` **0**.
⭐ **`ARM=census` did exactly its job**: it flagged `authz.has_permission` and
`authz.candidate_has_permission` as UNKNOWN — a brand-new gate is in no BLIND set and clears
`ARM=policy` vacuously (ADR 0079 Amdt 3). It returns to 0 only after the diff-scoped sweep's verdict
was **merged as a row** into the findings md and the un-sweepable objects were classified with
reasons.

**Diff-scoped door sweep**, cases derived by `scripts/door-sweep-cases.sh` (exit **0 DERIVED**, 7
cases), **BOTH arms run**:
- READ arm exit **3 UNPROVEN (PARTIAL)** — `ARM-DOMAIN predicate=1/124 policy=0/226
  out-of-domain-bool=37`, `SWEPT 1 · COVERED 1 · BLIND 0 · ERROR 0`. `authz.has_permission` is
  **COVERED**.
- WRITE arm exit **3 UNPROVEN — NOTHING WAS MEASURED** (`guard=0/13 policy=0/33`): this increment
  creates no write policy and no `assert_*` raise-guard. ⛔ Recorded as UNPROVEN, never as a pass.
- ⚠ The committed baselines were verified **unchanged** (the harness's own cksum check) — subset
  verdicts were merged as rows, never by copying a subset file.

⛔ **Four objects, four DIFFERENT domain-exclusion reasons** — they may not be recorded as one class
(absence of a verdict is absence of coverage): `has_permission` in domain and COVERED ·
`candidate_has_permission` boolean but excluded **by NAME**
(`FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME`) · `explain_permission` scalar non-bool (C2) ·
`entailed_grants` set-returning + unreachable (the `assignment_facts` shape). `public.assume_role`
is the fifth and is **not a newcomer** — it kept its NAME and changed its BODY, which `ARM=census`
cannot see; the deriver is what surfaced it.

### One thing the build DISCOVERED (ADR 0177 D6)

pgTAP `401` §16.10 — the many-to-many hat translation — went **RED on its first run** after the
migration. Its second granting role is `staff`, which is `legacy`, so the state gate denied it. The
gate is correct and the fixture was wrong; `401` §16.9b now pins the fact as its own assertion.
⛔ **A role's `authz.role_permissions` rows are INERT until its state flips: seeding a role's grants
is NOT cutting it over.** No production answer moves today (`staff_admin` is the only role with
grants and is already `authoritative`), and an AE5 increment that forgets the flip will look exactly
like one whose grants were never seeded.

### Records corrected in the same edit (stale-by-rename, no gate can see these)

`supabase/tests/mutation/act-hat-blind-allowlist.txt` (the `assignment_facts` caller census — ⛔ the
COUNT did not move, the NAMES did) · `authz-unswept-backlog.txt` (the AE4.7b block's two dropped
names, plus four new classified entries) · `p0-authz-invariant.sh`'s "SIX authz functions" comment
(now eight, re-derived) · `docs/reviews/authz-door-audit-findings.md` (row + prose note, ⛔ with no
pipe table — `verdicts_from_findings()` counts every `| `-prefixed line in that file as a verdict).

### What AE4.9 items 1+2 did NOT do

- **No enforcement site was re-keyed** — 0176 D6's three representatives are the next step, and
  there the grant-deletion mutation must flip a **production door**, not the resolver.
- **No enforcement manifest** (0176 D5), **no `platform_role` retirement** (0176 D8), **no
  performance evidence** (0176 Consequences — that comes after the seam, on the final path).
- **`403`'s repoint to the candidate evaluator costs nothing TODAY and is not free forever** —
  §3.2b asserts the bound (zero roles in `test_validation`) and states that the day it reds, `403`
  stops being evidence about the runtime path. That is correct, and it must be recorded rather than
  repointed away.
- ~~**`docs/backend-state.md`'s `authz` section is still owed** (audit F10)~~ — ✅ **WRITTEN 2026-09-02**
  (`docs/backend-state.md` § AE4), after D6 so it describes the surface that actually shipped.

> ⭐ **SCOPE MARKER, added 2026-09-02 — the three bullets above are SCOPED TO ITEMS 1+2 and two of them
> are now false AS GENERAL CLAIMS.** They were true of this increment when written. The very next section
> (§ AE4.9 D6 + D5) re-keyed all three representatives and shipped D5's manifest. ⛔ Read them as *"items
> 1+2 did not do this"*, never as *"this is not done"* — a dated did-NOT-do list is the easiest thing in
> a record to mistake for current state, because it reads as careful. Still true from that list: no
> `platform_role` retirement (0176 D8), and **no performance evidence** (IA-F9, now
> `FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH`).
- **Nothing merged, nothing pushed.** The whole phase merges once, at Gate AE4.

## AE4.9 D6 + D5 — the re-key, the enforcement manifest, and the §6 artifact earned, 2026-09-02 (lead + 4 agents)

**Built** — migration `20261003007300`; pgTAP **409** (re-key differential, 63) · **410** (manifest,
34) · **411** (role-manifest DB gate, 7); `supabase/tests/vectors/authz-enforcement-manifest.json`
(43 rows, **no default arm**); 401 §19 re-sourced; 403 gained a **fourth** representative; ADR
[0178](../decisions/0178-ae49-d6-rekey-as-built.md); `docs/backend-state.md` § AE4; the rollback
runbook + out-of-chain template (closes IA-F10).

**The gate line (0176 D6) is met.** For each of `commission.forms.edit` /
`org.professionals.create` / `org.professionals.read`, deleting the grant now flips the
**production door**. F1 was reproduced first (`resolver f` / `door t` on all three), and 409 was run
against the **pre-migration** catalog with every gate-line assertion observed **red** — the keystone
is proven able to fail, not assumed to be.

⛔ **The honest sentence, which is NOT "3 of 43 are on layer 3":** *3 sites call layer 3 on the
`staff_admin` path, and **5 non-permission grant paths survive inside** them* —
`is_tenancy_admin_of_for` · `can_manage_professional` (×2) · `is_admin` · `can_read_case_committee`.
410 §4.6 pins those five **by name** (a count lets one arm be swapped for another); adding an arm
reds it, and *retiring* one also reds it, because a retirement is AE5 progress to be recorded.

### What the build BROKE and how it was closed — the increment's most important finding

The re-key split `can_create_professional`'s body, which **invalidated 401 §19.2b's shared-body
premise** — the justification for AE4.5's *three representatives answer for six classes*. Rows 31
(`org.participants.external.manage`) and 32 (`org.case_vocabulary.manage`) **silently lost
differential coverage** and nothing else in the suite said so. ⛔ Ruled: **restore the reduction**
with a fourth representative (`org.case_vocabulary.manage`), NOT re-key rows 31/32 (widens past the
PO-confirmed D6 scope) and NOT raise 19.2b's expected value (greens the test and **deletes its
subject** — the subject is the *argument*, not the number). §19.2c is new because a distinct-body
count of 2 over three functions is satisfied by **any** pairing; it pins *which* two still agree.
⭐ Building it exposed a **catch-all `else`** in 403's driver routing unknown legacy classes to the
professional-profile door — the fourth rep would have called the wrong door and reported a clean
differential. Every class is now named; an unknown class raises.

### Gates — exit codes read DIRECTLY from files, never through a pipe

`test:db` **259f/8685** exit 0 (was 256/8579) · `lint` 12/12 · `typecheck` 0 · vitest **151f/2056**
(−2, accounted: 3 assertions moved to 411) · **all four ARMs HOLD**.
⭐ **`ARM=census` red FIRST and was RIGHT** — `app.can_edit_commission_forms` was **UNKNOWN** (no
sweep had ever asked; a newcomer is in no BLIND set and passes `ARM=policy` **vacuously**). Closed by
*measuring* it, not by widening a filter: read-arm sweep → **COVERED**, verdict **MERGED** into the
findings baseline (623→624), census re-run **exit 0**.
⭐ **Door sweep read arm CLEAN** — 7 gates, all COVERED, **BLIND 0**, `ARM-DOMAIN predicate=3/125
policy=4/226`. The four form policies carried **stale COVERED verdicts** earned against the
**pre-ALTER** predicate; they were **re-measured, not inherited** (ADR 0079 Amdt 8 ruling 3).
⛔ **`ARM=census` structurally CANNOT catch a stale verdict** — the gate is not a newcomer.
⛔ **WRITE ARM = UNPROVEN (exit 3), `guard=0/13 policy=0/33` — NOTHING WAS MEASURED, and this is
NOT a pass.** The four `FOR ALL` policies are outside its **embedded snapshot**
(`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Part 3, an apparatus gap). The read arm legitimately covers
them (an `ALL` policy IS a read policy) and 409 proves the write path behaviourally — but that arm
holds no verdict of its own.

### ⭐ §6 step 2 EARNED — `e2e:prod` GATE GREEN in a SINGLE run

`GATE_EXIT=0` read from `/tmp/e2e-prod-gate/gate-exit`. 14:30:05→16:13:24 (1h43m), 21 batches,
**1260 passed · 0 failed · 2 flaky · 0 did-not-run**. ⛔ **This supersedes the 3-run COMPOSITE**,
which was never the §6 artifact.
⚠ The summary line reads *"accounted for 1262 of 1273"* and that is **not** an 11-test hole: the
per-batch figures sum to **1273/1273**, `did-not-run` is 0 in every batch, and the script's
"denominator contains a guess" warning never fired. 1262 excludes skips. ⛔ The same shape once
printed *"860 of 865"* while **66 tests had never executed** — verify by summing, never by reading.
**3 INFRA re-runs** (batches 9/19/20), each `server_dead=1` + 10/43/70 conn_errors, each re-run on a
fresh server+DB to `0 failed` with full accounting (67/67 · 54/54 · 70/70). ⚠ The competing
`*_escalume` stack was up **by PO choice**, which is the recorded cause of that class.

### ⛔ What this did NOT do

- **No performance evidence (IA-F9).** Now measurable for the first time — the final path exists.
  ⛔ Measure policy → layer 3 → layer 2 → layer 1, **never `holds_role` alone**.
- **40 of 43 permissions remain `pending-rekey`.** The catalog is authority-**ELECT** (0162 §2);
  *"catalog cutover"* still may not describe AE4.6.
- **410 proves nothing about enforcement** — that a policy exists and contains a call are facts
  about SQL. `hardDenyClasses` is 40/43 `not-attributable-until-rekey`: honest, not coverage.

## AE4 dead ends — the MECHANISMS, promoted verbatim from the handoff 2026-09-02

> ⭐ Promoted because the handoff is deleted at the Record step and this is the one thing neither the
> code nor git history can record: what was tried and **the mechanism it failed by**. ⛔ Moved VERBATIM
> (the `## Dead ends` heading below is the original); only this note is new. Some entries are historical
> — they describe the state at the time they were written, not current state.

## Dead ends

⛔ **A BISECT POISONS EVERY LATER CATALOG READ, AND THAT COST A FALSE BUG DIAGNOSIS.**
`e2e-prod-gate.sh` runs `supabase db reset --local` from the **checked-out tree**. After bisecting
at `0807cfda` (pre-AE4.7c) the local DB was left at the **pre-AE4.7c schema**; every catalog query
afterwards described a database without AE4.7c in it. On that basis `BUG-AE47C-LINKAGE-001` was
diagnosed as *"the `link_state='unknown'` bound was never built"*, a PO ruling was obtained to
build it, and the migration written to do so **no-opped against its own idempotence guard** —
the bound was already there (`20261003007230` emits it). The migration was deleted, not committed;
the bug entry's mechanism is retracted in place. **The bisect's own result still stands** (both
sides ran through the gate, so each was schema-coherent). ⛔ After ANY checkout, reset before
reading the catalog.

- **Re-coding an expectation whose error code drifted.** AE4.7c put a `42501` authority refusal
  in front of older guards, so `HC0J7`/`HC0F2` assertions began failing with the new code.
  ⛔ Re-coding greens the test and leaves the guard it was written for asserted by NOTHING. Change
  the **caller** to one who passes the new guard and reaches the old one; the assertion splits in
  two. ⚠ AE4.7c applied this to pgTAP 229/257 and **missed the only E2E twin** — fixed at
  `a1ac073c`. A sweep that stops at one layer reads as complete.
- **Trusting a background task's "exit code 0".** It is the exit of the **compound** command; a
  trailing `echo`/`tail` erases the real one. Both `e2e:prod` runs were reported 0 and were 1.
- **Assuming a batch failure is an assertion failure.** Two "failures" in run 1 were
  `ERR_CONNECTION_REFUSED` — the server died mid-batch — while the gate printed `0 infra`. Its
  classifier does not catch every case. Isolate before diagnosing.
- **Assuming a retry failure is the same defect.** `ethics-e2-procedure:486` failed only as
  `(retry #1)`: attempt 1 had run FLOW-1, which decides admissibility, so the retry found the
  button enabled. One root cause (FLOW-8) produced three reported symptoms.
- **Delegating the wrappers to the permission resolver.** A sentinel permission couples a role
  check to one arbitrary grant; *"holds any staff_admin-granted permission"* returns **true for a
  plain staff member** the moment AE5 grants `staff` an overlapping permission. Resolution:
  `authz.assignment_facts`, then the `authz.holds_role` chokepoint. ⛔ **2026-09-02: the argument
  stands, the conclusion was HALF.** `holds_role` is the assignment-projection layer, not the D7
  cutover — routing a ROLE question through a permission resolver is wrong, so D7 is satisfied by
  **re-keying the enforcement sites** to ask permission questions (plan § AE4.9), not by
  re-pointing wrappers. The ruling lived only in `20261003007200`'s comment; ADR 0174 says
  `Relates:` 0155; and the mid-phase review measured "callers = 0" on the resolver and filed it
  as a rename nit. A designated authority with zero callers is a conformance finding.
- **Reading G4's "typed query" as a client-side query.** The "not implementable" ruling measured
  that no client role holds USAGE on `authz` — true, and beside the point: `public.assume_role`
  is `SECURITY DEFINER` and reads the sealed table server-side with no new grant. The gate-time
  key-set comparison that replaced it measures **drift**, not enforcement; `session_selectable`
  has zero readers, and flipping it changes nothing. Superseded (plan § AE4.8 / § AE4.9 "do now").
- **A text-based door-sweep deriver.** It matches `create function` in migration text; the house
  `pg_get_functiondef`+`replace`+`execute` pattern contains none. 33 migrations invisible;
  amending reaches **8 of 33**, the other 25 unrecoverable without a historical snapshot.
- **Giving `ARM=sites` a negative control only.** `psql` does not interpolate `-v` inside `-c`;
  both lookups died, every set difference was empty, and the arm printed `OK — 0 site(s)` beside
  `vacuity control: OK`. ⛔ A dead instrument satisfies an "X − Y is empty" check AND its
  synthetic-input control at once. A control needs a DISCRIMINATION half.
- **Expecting a UNION observable to show a mutation.** Re-pointing 319's A5 twin expecting
  `111 → 175` measured **111**: S1's mask already contained S2's bit. Read where NO arm is
  legitimately open.

---

## Rotated from PROGRESS.md § Now 2026-09-02 — ten concluded spans of the ADR 0155 bullet

⚠ **Rotated at a size rotation, not a Record step.** PROGRESS.md had crossed the 100 KB hard cap at
`e897b452` and stood 114 bytes under it after `3f213d48`; four Gate-AE4 agents were about to write
into § Now with no room. The § Now ADR 0155 bullet was 8555 bytes — the file's single largest item.

**Each span below is verbatim** — relocated by index from the live bullet, not retyped — and each had
had its resolution event where it stood. Spans 1 and 3 are closures and a corrected commit-state
claim; 2 and 5 are pointers to narrative already rotated into this file; 4, 7 and 10 are superseded
gate figures (§ Test Run Summary retains the most recent run, and the D6 run supersedes both earlier
ones); 6 is the implementation audit and its disposition, which § QA Verdicts and two § Decisions rows
both carry; 8 and 9 are build narrative this file already holds in § AE4.9, with 9's lesson now
**pinned in the suite** at 401 §16.9b rather than in prose.

⛔ **What deliberately did NOT move, because Gate AE4 has not consumed it:** the PO's
HOLD-EVERYTHING-ON-THE-BRANCH ruling · the two qualifiers owed to the gate record (§20 is ONE HOP;
`can_read_professional_profile`'s arms 1/3 are EXERCISED BUT NOT ORACLED) · the MATCH FULL
unreachable-keystone finding · *C2 is NOT a prerequisite* and *G2 does not carry* · the `ARM=census`
red being real and returning to 0 only on named reasons plus mutation-proven keystones · the three
new objects with no sweep verdict and `public.assume_role` as a structurally invisible fifth · the
door-sweep WRITE arm UNPROVEN (exit 3, 0 gates selected) · IA-F9 performance evidence not existing ·
and the *"the honest sentence is NOT 3 of 43 on layer 3"* correction.

1. ✅ One real regression FOUND AND FIXED (`a1ac073c`). ✅ **`BUG-AE47C-LINKAGE-001` CLOSED 2026-09-02** — both casualties fixed, tester-verified 13/13 exit 0 on a fresh reset (archive + full narrative: § Bug Log).

2. ⭐ **The AE4.8/AE4.9-era E2E narrative ROTATED 2026-09-02 → [authz-ae4.md § AE4.8](authz-ae4.md)** — the 3-run COMPOSITE and why it was never the §6 artifact, the connection-level failure taxonomy, the PO's second-workload input, and two retracted readings. It is **SUPERSEDED** by the single-run green below.

3. ✅ **Both fixes are COMMITTED** (`a1ac073c` + `2deb7ce0`) — ⛔ this line read *"remain uncommitted"* until 2026-09-02, after they had landed; measured on a clean `git status`, not read off this file.

4. ✅ **PO BATCH RULED AND BUILT 2026-09-01** — ADR [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md); every figure + what it did NOT do → [authz-ae4.md § AE4 PO batch](authz-ae4.md). `test:db` **254f/8504 GREEN** (8498 +3 in 401 §20 +3 in 403 §7), lint 12/12, tsc 0, **4 ARMs HOLD**, exits read DIRECTLY.

5. ⭐ **D1's re-ruling narrative ROTATED 2026-09-02** → [authz-ae4.md § D1](authz-ae4.md), which carries it in more detail than this bullet did (the 91-cell ruling withdrawn on a measurement, the structural proof that replaced it, and its discrimination + name-key controls).

6. ⛔ **IMPLEMENTATION AUDIT 2026-09-02 — CHANGES REQUESTED, F1 REPRODUCED ON THE CATALOG: the permission half has ZERO production callers** (both wrappers → `holds_role`, no permission read; deleting a grant flips the resolver, not the wrapper — a conformance defect, not an exposure). **PO RULED OPTION A — make permissions real → ADR [0176](../decisions/0176-authz-permission-layer-made-real.md)** (`Amends:` 0155 D7 + 0174); the "do now" set, the manifest and the AE5 bundle → plan § AE4.9 + [authz-ae4.md](authz-ae4.md). ✅ **Gate AE4 minimum re-key scope CONFIRMED 2026-09-02 (PO): the three representatives** (0176 D6).

7. `test:db` **256f/8579 PASS**, lint 12/12, tsc 0, **4 ARMs HOLD**, exits read DIRECTLY.

8. ⭐ **Every defect was REPRODUCED FIRST, then re-measured by the lead on the live catalog:** scope kind `hospital` **and** `banana` for a commission id both granted → now deny; `test_validation` → runtime `f` / candidate `t` (the **only** state where they differ, which is what makes the split a split and not a rename); a deleted grant explained `scope_unreachable` → now `permission_not_granted`.

9. ⚠ **401 §16.10 went RED on first run and the GATE was right, the FIXTURE wrong** — its second granting role is `staff`, still `legacy`; §16.9b now pins that **a role's `role_permissions` rows are INERT until its state flips**, so an AE5 increment that forgets the flip looks identical to one that never seeded.

10. `test:db` **259f/8685**, lint 12/12, tsc 0, vitest 151f/2056, **4 ARMs HOLD**, exits read DIRECTLY.
