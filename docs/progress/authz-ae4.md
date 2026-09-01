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
