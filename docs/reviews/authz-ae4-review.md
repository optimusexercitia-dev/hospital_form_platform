# QA review — Phase AE4: the authz catalog, and `staff_admin` substituted (ADR 0155 D7)

- **Branch:** `authz-ae4-catalog` · **Reviewed:** 2026-09-01 · **Reviewer:** independent
  session (three read-only reviewer agents + live-catalog probes), at `6da8a772`.
- **Contract:** [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § AE4
  (authority ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
  D7, ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) § 2); increment
  record [`docs/progress/authz-ae4.md`](../progress/authz-ae4.md).
- ⛔ **This is a MID-PHASE review, not the Gate AE4 review.** It was run after AE4.6's
  cutover and before AE4.7, and its § "Recommended order" is what AE4.7a/b/c executed.
  The Gate AE4 review is a separate, later artifact.
- ⚠ **PROMOTED VERBATIM out of this branch's handoff on 2026-09-01.** It was
  written into that handoff, where an audit narrative may not live: a handoff is ephemeral
  resume-state bounded by its branch, and the moment anything cites it, it can never be
  swept. Text below is unchanged from the handoff — the disposition of each finding is in
  the increment record, not here.

---

## QA review — 2026-09-01, independent session at `6da8a772`

Unforgiving pass over the phase as built. Every § State VERIFIED row re-measured
against the live catalog on a fresh reset; three read-only reviewers fanned out over
migrations, suites, and harness; every contested claim settled by a live probe.
**Everything below is VERIFIED by this session** unless marked otherwise.

### Re-measurement — the handoff largely reproduces

- All catalog VERIFIED rows reproduce (functions, ACLs, FK, generated column, role
  states, permission distribution, CHECKs, wrapper delegation) — with ONE stale row:
  **`authz` has 5 tables, not 4** (`permission_implication_closure` is the fifth;
  42 rows, all reflexive). ⚠ A VERIFIED row whose witness, re-run, answers
  differently — § Trust demonstrated on its own table.
- `npm run test:db`: RED on exactly 315 (test 14 = REVERT-TWIN) and 319 (test 5 =
  A5); 252 files / 8434 tests otherwise green. "Orphaned, not wrong" CONFIRMED at
  assertion grain; the BELIEVED 401 = 112/112, 402/404-green rows hold.
- `lint` (12 gates), `typecheck`, vitest 2021/2021 all green; ARM=census/hat/floor +
  `FROMFINDINGS=1 ARM=wrapper` all HOLD with directly-read exit 0; both deriver
  witnesses reproduce (4 names / exit 0; exit 1 FINDING on `20260816000500`).
- The direct-call census CONFIRMED live: 0 functions in app/public contain both
  `has_role` and `staff_admin` (comment-stripped); `can_manage_professional`
  delegates to `is_staff_admin_of_for`. (The "13 sites" carry the *literal*, not
  calls — only 1 ever called `has_role` directly.)
- The cutover did NOT change NULL-hat behaviour: `has_role` itself uses
  `is not distinct from app.active_role()` (BUG-ACT-NULLHAT-1) and the wrappers
  mirror it. `is_active`/`active_role` are STABLE; `memberships_principal_idx` exists.

### 🔴 e2e:prod — the UNKNOWN is measured: NOT green as-run

Full run, fresh reset: **1198 passed · 1 failed · 19 infra-unproven · 3 flaky ·
37 did-not-run** (batches b2, b9). The 1 real failure
(`meeting-audio-minutes.spec.ts:565`, the apply-ata toast; `apply_minutes_review`
routes through the rewritten wrapper) **passes solo on a fresh reset** (10/10) —
batch-state or host pressure, NOT a reproducible cutover regression. ⛔ Gate AE4
still owes a green declaration: re-run b2 + b9 per the gate's own instruction;
never transcribe this run as green.

### Findings — ranked

**F1 🔴 403's two fail-proofs (§6.1/§6.3) are VACUOUS — measured, not inferred.**
The fixture-membership cleanup (403:270-273) sits ABOVE §6, and `disagreements()`
re-evaluates all 657 cells — so the deleted `sib_holder`/`xorg_holder` principals
already disagree on their expected-granted cells before any deliberate mutation.
Probe: a temporary `cmp_ok(pg_temp.disagreements(), '=', 0)` inserted before §6's
first mutation → **failed with 48**. Both `> 0` fail-proofs therefore pass with
their mutations deleted; the suite has not been shown able to fail, and § Next task
item 4's plank ("403 §6.3 already demonstrates this works") is **undemonstrated**.
Fix: move the membership delete below §6 beside the deactivation cleanup (the
in-file comment at 334-339 already fixed this exact shape for the OTHER cleanup),
re-prove both fire, and add
`is((select count(*) from r403), (select count(*) from authz_differential_cells))`
— today nothing proves the 657 ran.

**F2 🔴 Record conflict on a PO ruling — and the shipped order violates the stricter
record.** PROGRESS.md § Decisions (2026-09-01) records the `can_manage_professional`
split as its "own gated increment **before AE4.6**". AE4.6 shipped without it, and
this handoff's § Decisions softened the ruling to "before AE4.6's **successor
work**". One record is wrong; PROGRESS.md is status truth. Meanwhile 007150/007160
seed + grant `org.professionals.manage` to `staff_admin`, so the oracle pins as
expected the capability the PO removed (matrix row 30 "approved as *today* only").
Needs PO adjudication before Gate AE4: land the split first, or record an explicit
deferral in BOTH places.

**F3 🔴 The differential's third legacy-equivalence class is never called.** 403's
driver `else`-substitutes `can_manage_professional` for
`can_read_professional_profile` (403:186-191). Live catalog: that door is a 3-arm
disjunction — `is_admin()` · `can_manage_professional` · a case-committee traversal
that grants independently of org scope. Arms 1 and 3 are outside the differential
entirely; §2.3 asserts the *label* column, not the door. Fix: call the real door for
class 3. Where arm 3 legitimately grants beyond `org.professionals.read`, that is a
FINDING for the AE5 matrix — record the divergent cells with their own expected
values, never substitute the subject.

**F4 🔴 An approved axis value is silently dropped — and the arm built to catch it
cannot fire.** `gen-authz-differential-cells.py:22` hardcodes 4 principal states;
the axes file declares 5 — `offboarded`, explicitly RULED an "ORDINARY FILLABLE
COORDINATE" (its `unfillable` rule is RETIRED in the same file). No skip rule, no
counter: invisible to every arm. And **arm7 is dead code** —
`sum(skipped.values()) > 0 and not skipped` is tautologically false, and it is
absent from `--self-test` (7 checks, 8 arms). The generator hardcodes every axis in
Python while sha-stamping a JSON it never reads. Fix: derive the axes FROM the JSON,
resurrect arm7 as "axes declared − axes enumerated = ∅", and route the offboarded
cells' expected values through their own PO approval (the matrix is approved at 42
rows; this is new approval surface, not a silent extension).

**F5 🟠 The oracle's expected-value file has NO drift gate, and its generator runs
on exactly one machine.** `lint:authz-vectors` guards `authz_matrix_cells.psql`
(the `.mjs` generator — verified solid: `--check` in sync, 5/5 self-test negative
controls + discrimination control). Its sibling `authz_differential_cells.psql` —
the file with the EXPECTED VALUES in it — has no `--check`, no gate, no hash
assertion; a hand-flipped `expected_granted` is undetectable by anything. The `.py`
generator hardcodes `ROOT = 'D:/Development/...'` (dies in CI and worktrees, or
silently regenerates the primary checkout's file) and stamps its own header
"Generator: ….mjs" — the wrong name. Fix: `--check` mode folded into gate 12 (same
gate, count unchanged — the narrow CLAUDE.md authorization is respected), ROOT from
`__file__`, header corrected.

**F6 🟠 pgTAP 405 does not exist — and 007200 cites it twice as its compensating
control** ("Both polarities are asserted in pgTAP 405"; "405 greps the
COMMENT-STRIPPED prosrc of both wrappers"). Tests run 400–404. The wrappers' own hat
conjunct is asserted NOWHERE post-cutover (401 §16 tests the resolver, not the
wrappers). Write 405 as described or amend the header — a named control that does
not exist is prose rot at its most dangerous.

**F7 🟠 The `authz` schema is outside EVERY arm's domain, and the harness's own
expiry has passed.** All five arms bound `nspname in ('app','public')`; the AE4
harness diff is **+35 comment lines, zero executable change**, and the comment block
itself says the exemption stops being correct at AE4.6 — which landed in the same
branch. "All arms HOLD" is true of a domain excluding the five DEFINER functions now
on the live staff_admin enforcement path. ⛔ Until AE4.7 lands, that qualifier
belongs in § Gates beside the C2 one. Fix = the specced AE4.7 step 2: widen harness
AND deriver to `('app','public','authz')`, then re-derive domains and the census
baseline (`PRED_DOMAIN`'s bool bound stays routed to C2 — do not widen it here).

**F8 🟠 This handoff's BELIEVED arithmetic is wrong in detail.** The cell set is
1080 → 657 with **423** skipped by FOUR rules (the psql header says so); "873 → 657
after 216" silently pre-applies the three anonymous rules. Effective measurement is
~168 distinct driver inputs — the deny-class collapse the sibling generator
implements and this one does not; 657 is the inflated figure the axes file itself
warns against. Also: `anonymous` maps to an authenticated JWT (no cell ever runs
unauthenticated — the 9 `deny-class:unauthenticated` cells prove nothing about
anonymity), and **108 cells labelled third-party have caller == principal**
(`unprivileged`'s caller is `f.nobody`, which IS its principal).

**F9 Design debts AE5 will multiply by 11** (detail in the reviewer transcripts):
- ⭐ **The hat conjunct is hand-copied in 4 phrasings across both wrappers,
  `has_direct_permission`, and `explain_direct_permission`.** This duplication is
  also WHY 315/319 are orphaned: the cutover removed the `has_role` chokepoint
  without naming a successor. One helper —
  `authz.holds_role(p_principal, p_role, p_scope_kind, p_scope_id)` carrying facts +
  expiry + `is_active` + the self-check hat — makes every wrapper a one-liner, gives
  mutation twins ONE chokepoint forever, and turns each AE5 cutover into a 2-line
  body swap.
- **`authz.roles.state` is inert** — nothing reads it; flipping it changes nothing.
  Make `holds_role` require `state = 'authoritative'`: a premature AE5 delegation
  then fails closed and loudly, and the flip becomes the atomic cutover the design
  claims it is.
- **Nothing guards the closure**: writes to `permission_implications` without
  `rebuild_implication_closure` fail CLOSED silently. A statement-level trigger on
  the catalog tables (migration-only writes — the anti-trigger argument was about
  `memberships`' hot path) or a 401 assertion `closure ⊇ reflexive(permissions)`.
- **`has_direct_permission`** ignores its `p_scope_kind` parameter (return false on
  mismatch or drop it), is named "direct" while joining the implication closure
  (rename to `authz.has_permission` NOW, while callers = 0), and `explain_`'s
  `denied_reason` is `text` beside the `authz.denial_reason` domain created two
  screens up — with the commonest denial (not granted at all) mislabelled
  `scope_unreachable`.
- **The rewrite migrations dropped the house `v_hits = 1` exactly-once guard**
  (`20261003001900:1053` has it; 007180/007190/007200 assert only `position() > 0`
  while `replace()` is global — and `role = 'staff_admin'` is a proper substring of
  `signoff_role = 'staff_admin'`, a collision live in `save_section_answers` until
  M15 removed it). Restore the idiom; add 007200's missing already-applied guard;
  add 007180's missing `door-sweep-targets:` marker (its siblings carry it).
- **Perf (provisional — MEASURE before AE5):** `assignment_facts` is a non-inlinable
  DEFINER SRF evaluated per row inside ~63 policies' predicate, scanning `profiles`
  for the platform_admin arm on every role-specific call. `holds_role` as a single
  indexed EXISTS dissolves the question.
- Minor: wrappers re-declare `search_path = app, public, pg_catalog` where every
  `authz.*` function uses `''` (two qualifications away); `is_staff_admin_of` still
  carries PUBLIC EXECUTE (live-confirmed); no format CHECK on
  `permissions.code`/`roles.code`; 403's RUN SHAPE comment says Tests: 12 against
  `plan(15)`; 315:9-12 / 319:15 headers still describe the pre-cutover wrapper.

**What holds up under attack** (credit where measured): the two-assertion oracle
shape (§4 legacy==catalog AND §5 catalog==approved) is right and EARNED its keep —
§4.1 was red on a real defect before 007190; **401 is strong** (no vacuous keystone
found; §18's grant/revoke vacuity control and §8's scratch-table MATCH FULL
differential are the correct shapes; §1 counts RLS tables BY PROPERTY, which is
exactly why the 5th table inherited the assertion automatically); 357's edit is
correct and complete; the deriver amendment's exit-code semantics are sane and both
witnesses reproduce; Rule 13 holds structurally (no authz object can reach an
affiliation table); the "authority-elect" language is respected everywhere.

### The difficulties, analysed

**1. The orphaned twins (315/319).** The root cause is not the twins — the cutover
moved enforcement off the single chokepoint onto inline conjuncts with no named
successor. ⛔ § Next task step 1 as written (mutate the wrapper's conjunct text) is
WEAKER than it looks, three ways: (a) `has_role` loses its only revert-twins while
still live for 11 roles + ~151 self-check sites — ADR 0106 Stage 3's gate sentence
("goes RED when the condition is removed from **has_role**") would be satisfied by
nothing; (b) the caller-only asymmetry is unobservable at `is_staff_admin_of` (no
`p_user_id`); (c) 319's A5 also proved WHAT `_case_caps`' S1 arm routes through —
provenance nothing would assert after a naive re-point. Do instead:
1. Build `authz.holds_role` (F9) and re-point BOTH wrappers through it — the new
   chokepoint, one mutation site.
2. Keep the `has_role` mutations alive for the legacy population: re-point **315's
   PROBE** to a policy still routing through `has_role` for a legacy role, and
   change **319 A5's OBSERVABLE** (under the staff_admin hat the mutation leaks
   S2's bit: 111 → 175) — same subject, same fixture.
3. ADD wrapper twins on `holds_role`'s hat conjunct, both polarities — the 405 that
   was cited but never written (F6).
4. Prove every twin fires loudly before trusting it — F1 is this branch's own
   demonstration of why.

**2. "All arms HOLD" vs the unswept authz schema (F7).** A DOMAIN change, not a
re-derivation chore: widen the bound + the deriver regex, re-run census (the new
functions surfacing as unswept newcomers is the arm WORKING), sweep them into the
findings baseline, and only then re-claim the arms in a gate record.

**3. The three FUPs.**
- PUBLIC EXECUTE on `is_staff_admin_of`: revoke in AE4.7 — anon resolves
  `auth.uid()` → null → false today, so the exposure is least-privilege + domain
  noise, not a live hole. Snapshot each function's OWN ACL before/after (§ Dead ends
  already learned the sibling-comparison trap).
- `can_manage_professional` self-check arm: fold into F3's class-3 work (same door
  family) — make the `is_admin()` arm principal-keyed or assert caller == p_uid in
  the arm; the 13-caller reachability question then dissolves.
- `novato.pendente`: stays a PO question. Note the deny-class ruling (row 5: pending
  denies at AUTH) means a persona that authenticates cannot exercise that layer BY
  DESIGN — the fix is a seed change, and `seed.sql` is a ~900-test contract: its own
  gated change, never opportunistic.

**4. e2e:prod** — settled above: no reproducible cutover regression; b2/b9 owe
re-runs before any green declaration.

**5. The 25 unrecoverable rewrite migrations** — already correctly converged on the
C2 population (PROGRESS § Now cross-reference). Nothing new owed inside AE4; do not
authorise a historical-snapshot audit from this phase.

### Recommended order for the remainder of the phase

1. **AE4.7a — evidence repair, before any new construction:** F1 (cleanup below §6 +
   cell-count assertion, re-prove §6.1/§6.3 fire), F5 (`--check` + ROOT + header),
   F4 (generator reads the axes JSON; arm7 resurrected; offboarded cells → PO), F6
   (write 405 or amend 007200), F8's corrections recorded.
2. **AE4.7b — the chokepoint:** `authz.holds_role` + wrapper re-point + the 4-step
   twin plan above + F7's domain widening + domain/census re-derivation + the
   already-specced catalog-completeness and wrapper-coverage arms. Fold the
   PUBLIC-EXECUTE revoke in here.
3. **PO batch, one sitting:** F2 (the split-before-cutover conflict — the blocking
   one), F4's offboarded expected values, F3's arm-3 divergence disposition, the two
   remaining FUPs.
4. **AE4.8** unchanged, then Gate AE4 = §6 + e2e:prod re-run to an actual green +
   QA review + PO approval.

⛔ Steps 1–2 are prerequisites for trusting the oracle the gate record will cite;
run them before AE4.8 starts leaning on "the differential is green".

*(QA 2026-09-01, independent session: three read-only reviewer agents + live-catalog
probes; the temporary 403 probe was reverted and the working tree left clean apart
from this section; PROGRESS.md deliberately untouched — the lead owns it, and this
section is the QA artifact it should cite.)*
