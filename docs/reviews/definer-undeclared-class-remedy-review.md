# DEFINER-UNDECLARED-CLASS-REMEDY — QA review (r1)

Unit hub: [`../features/definer-undeclared-class-remedy.md`](../features/definer-undeclared-class-remedy.md) ·
record: [`../progress/definer-undeclared-class-remedy.md`](../progress/definer-undeclared-class-remedy.md) ·
branch `definer-undeclared-class-remedy` @ `834cb8dc`, base `main @ f55b53ba` ·
reviewed 2026-09-12 · ADR 0208 D4 · PO ruling 2026-09-11.

Scope reviewed: `1a5dc2a1` (the build) plus this unit's three docs commits (`e923917b`,
`e694bf0e`, `834cb8dc`). ⛔ `bb6f3571` and `664a70a5` are another session's pgTAP-diagnostics FUP
closure and are excluded — I confirmed by `git show --stat` that they touch only
`docs/backend-state/conventions.md`, `docs/followups/*` and
`docs/progress/definer-qualified-body-gate.md`, none of which this unit's ACs claim.

**Verdict: APPROVED**

Counts — **BLOCK 0 · MAJOR 0 · MINOR 3 · NOTE 4**. All six ACs are met on witnesses I earned
myself, including a surviving mutant of my own that neither the record nor the ACs anticipated.
The three MINORs are correctable in place and none of them opens a gate hole; one of them
(MINOR-1) is a live false sentence in a block the lead is already scheduled to replace, named
here so that replacement is not blind to it.

---

## 1. What I measured myself (not read off the record)

⚠ **Every database row below was run TWICE and I report the second run.** Partway through the
review the PO's `supabase db reset` deadlocked against a concurrent pgTAP run and left the shared
local stack **half-migrated** (455 `prosecdef` functions instead of 890, 0 rows in
`public.profiles`, 67 migrations at `max(version) = 20260718000000`). I stopped DB work on the
lead's instruction and re-ran every DB item once the reset completed. ⭐ The two passes agree line
for line — the same `# Failed test` numbers, the same `have:` values — so the collision cost time
and not evidence.

`421 § 0c` passing at all requires the catalog to read exactly
`890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared`, which makes a green `§ 0c` its own
witness that the population was whole for the run that produced it.

| # | What | Result (post-reset run) |
|---|---|---|
| 1 | live catalog, probed directly through `docker exec … psql` on `pg_proc`/`pg_namespace` | `890` total `prosecdef` in `app`/`public`/`authz` · `0` with `sp is null` · `29` with `""`. Agrees with the record's measurement. |
| 2 | `supabase test db supabase/tests/00_setup.sql supabase/tests/414_definer_search_path_resolves.sql` | `Files=2, Tests=9`, `Result: PASS`. Matches `414`'s own RUN SHAPE line (`414:45`) and `plan(8)` (`414:50`). |
| 3 | the same with `421_definer_qualified_body.sql` | `Files=2, Tests=20`, `Result: PASS`. Matches `421`'s RUN SHAPE (`421:130`) and `plan(19)` (`421:135`). One expected `WARNING: 421 § 3e SQL CONTROL FIRED` on stderr. |
| 4 | mutation **A** on a scratchpad COPY | reproduced exactly — § 3 |
| 5 | mutation **D** on a scratchpad COPY | reproduced exactly — § 3 |
| 6 | mutation **E** on a scratchpad COPY | reproduced exactly — § 3 |
| 7 | mutation **QA-1**, mine, in neither the record nor the ACs | ⚠ **mutant SURVIVED** — § 6 and MINOR-3 |
| 8 | `node scripts/check-backend-state.mjs` (gate 16) | rc **0**; `WARN — [D] docs/backend-state/authorization-and-audit.md — 163.2 KB is over the 160 KB warn line (cap 200 KB)`; the headroom line reports `authorization-and-audit.md (98, 2 left)` against the 100-line `## Current state` ratchet. No database. |
| 9 | `node scripts/gen-definer-search-path-freeze.mjs --self-test` then `--check` (gate 18) | rc **0** / rc **0**; `--self-test: OK (17 cases; every checker red on its own mutation)`; `--check: in sync (861 frozen non-empty DEFINER paths; baseline 861 -> 861 (removed 0, added 0) [baseline main (664a70a5b8e5)])`. This is the independent proof that the census comment edit landed OUTSIDE the byte-compared `definer_nonempty_domain` block — I did not take that claim from the record. No database. |
| 10 | diff isolation | `git diff f55b53ba..HEAD` on the two test files, filtered to non-comment, non-blank `^[+-]` lines: the ONLY changed predicates or expectations are `plan(7)→plan(8)`, `plan(18)→plan(19)`, the two description strings, `§ 0c`'s formatting source moving to `v421_partition`, and the two new assertions. ⭐ `§ 0b`'s `where sp is null` with its expected `''`, and `§ 0c`'s expected string, are byte-unchanged. |
| 11 | scope isolation | `git show --stat` on each of the six commits on the branch (row above). |
| 12 | door surface | The diff contains **no migration, no `src/`, no policy, no `pg_proc` change**. Every function it creates is a pgTAP plant inside a transaction, dropped or rolled back, and both files' RESTORE assertions re-measure that. LEARN-074 (`prosecdef` belongs beside `pg_policies`) therefore has no subject here, which is why the deriver's exit **3 NOT-APPLICABLE** is a real answer and not an evasion. |
| 13 | `npm run test:db`, mine | ⛔ **VOID, and not a finding.** My run landed inside the half-migrated window: `Files=270, Tests=371, Result: FAIL`, ~250 files aborting on `Bad plan. You planned N tests but ran 0`. I did not re-run it after the reset — see § 9 item 1. |

---

## 2. AC-by-AC

### AC-1 — `414 § 0b` names the remedy · **MET**

`414:131` now carries, in one clause: *"A function listed here is a DEFECT whose ONE remedy is to
converge it to `set search_path = ''` with SCHEMA-QUALIFIED object references (ADR 0208 D4; PO
ruled 2026-09-11) — ⛔ NEVER by widening 414 or 419 to admit it and NEVER by adding it to the
frozen set."*  It then states why the member is in NO gate's domain meanwhile. The section comment
(`414:112-126`) carries the ruling quoted, keeps *"Measured 2026-09-03: 890 of 890 carry one"* as
a dated measurement rather than a live claim, and points at `§ 2d` as its control. Predicate and
expected value byte-unchanged — measured in row 10, not taken on trust.

### AC-2 — `414 § 0b` is proven able to red · **MET** (bound in MINOR-3)

The seventh plant (`414:181-182`, `public.z414_ctl_undeclared()`, `security definer`, no
`set search_path`) is created inside the pre-existing `s414_plant` savepoint (`414:165`), i.e.
after `§ 0b` (`414:128`) and `§ 1` (`414:138`) have read the live population, and dies at
`rollback to savepoint s414_plant` (`414:229`). `§ 3`'s restore predicate
(`proname like 'z414\_ctl\_%'`) already covers it, so no restore term was owed. `plan(8)` and the
RUN SHAPE line moved together (row 2). ⭐ The claim that the plant cannot perturb `§ 2a`/`§ 2b`/
`§ 2c` *by the property under test* holds: with no `sp` it produces no `v414_tokens` row at all,
and mutation A independently shows a live undeclared DEFINER reds exactly ONE of the eight cells.
The discrimination half reuses `z414_ctl_empty_form`, which `§ 2b` separately proves is inside
the sweep's domain — so no eighth probe was needed and none was added.

### AC-3 — `421 § 0c` partitions and points · **MET**

(i) `421:191-195` factors the four counts into `v421_partition`, with
`n_nonempty = sp <> '""' and sp <> '<none>'`; the expected string (`421:215`) is byte-unchanged.
Mutation D is the direct witness: `have: 891 = 861 non-empty (419) + 29 empty (421) | 1
undeclared` — the non-empty term **stayed at 861** while the total and `undeclared` each moved
+1, against the `862` the predecessor unit's QA round measured. (ii) `421:216` names `414 § 0b` as
the OWNER of an `undeclared` red and repeats the same one remedy, so the two gates now agree.
(iii) `421:199-205` replaces *"would be counted on 419's side"* with the measured mechanism (the
census's `coalesce` to `'""'`) and states in-line that the deleted clause was true of the printed
string and false of the catalog.

### AC-4 — `421`'s partition control · **MET**

`421 § 3h` (`421:578-630`) snapshots `v421_partition` three times into `t421_partition_snap` and
asserts DELTAS, not a second copy of the baseline string — which is the remedy for the
"one number, two homes" family, and it means a future convergence re-baselines `§ 0c` alone.
Mutation E is the witness (§ 3). I verified the structural claim by reading rather than accepting
it: `§ 3h` reads the SAME view `§ 0c` formats, so it holds no hand-written copy of the production
expression (LEARN-024). I also traced the plant lifecycle: all six `§ 3` plpgsql plants are
dropped at `421:523-528` and the `sql` plant at `421:575`, so `§ 3h`'s `base` row is taken on a
clean catalog; both of its own plants are dropped immediately after their own snapshot
(`421:604`, `421:609`), before `§ 4`'s residual and `§ 5`'s restore. `§ 5`'s message moved seven
→ nine, and its `sig like 'public.z421\_%'` predicate already covers both new names.

### AC-5 — the carriers · **MET, with MINOR-1**

- `docs/backend-state/authorization-and-audit.md` — two dated `⚠ **Superseded**` markers
  (`:1293`, `:1316`) inserted ABOVE the posted slices, each naming the stale sentences verbatim
  (`:1308` *"PROPOSED … PO to rule"*, `:1310` *"pinned by `414`, not ruled"*, `:1328`
  *"PO-ruled but unbuilt"*), plus one appended dated slice (`:1408-1452`). I confirmed from the
  diff that the whole region is **additions only** — no posted slice was rewritten in place,
  which is exactly what AC-5 requires. I also checked the two remaining `PO to rule` hits in the
  same file (`:1321`, `:1340`): both are historically TRUE statements about a *different*
  follow-up's closing condition, so neither needs a marker.
- `scripts/definer-search-path-census.sql:25-35` — the *"disposition is the follow-up's open
  half 1"* clause is replaced by the ruling, and the exclusion's reasoning is kept and
  strengthened. Gate 18 rc 0 (row 9) is my independent proof that this sits outside the
  byte-compared block.
- `docs/lint-gates.md:37` — gate 18's *"kept byte-unchanged"* clause, which THIS unit falsified,
  corrected in place with the superseded words quoted. That file carries no frozen-slice
  convention, so in-place is the right form. MINOR-1 is the one other carrier of that same
  falsified claim, and it was missed.

### AC-6 — the gates · **MET for everything I could reach; two inputs unverifiable (§ 9)**

`414` and `421` PASS individually on the reset catalog with exactly the figures their RUN SHAPE
lines predict (rows 2-3). Gate 16 rc 0 with one new WARN, gate 18 rc 0 on both arms (rows 8-9).
The door-sweep deriver's exit **3 NOT-APPLICABLE** is correct on its own terms: the diff contains
no migration and no catalog change at all (row 12), so neither sweep arm has a door to walk. ⛔
What I could NOT re-earn myself: the full-suite figure and the fresh-reset precondition — § 9.

---

## 3. The record's mutation proofs, re-earned on my own copies

Each ran as `supabase test db supabase/tests/00_setup.sql <scratchpad copy>`; no mutant ever
touched `supabase/tests/`. Plant names were deliberately chosen OUTSIDE the `z414_ctl_` / `z421_`
prefixes the restore predicates key on, so each mutant reds exactly one assertion — which is also
how I know the plant perturbs no neighbouring cell.

**A — a planted undeclared DEFINER reds `414 § 0b`, and only it.** `Failed 1/8`, `Failed test: 2`:

```
# Failed test 2: "§0b NO SILENT EXITS FROM THE DOMAIN: every prosecdef function in app/public/
authz declares a search_path at all. ⛔ A function listed here is a DEFECT whose ONE remedy is to
converge it to `set search_path = ''` with SCHEMA-QUALIFIED object references (ADR 0208 D4; PO
ruled 2026-09-11) — ⛔ NEVER by widening 414 or 419 to admit it and NEVER by adding it to the
frozen set. …"
#         have: public.zzz_qa_mut_undeclared()
#         want:
```

**D — the same plant reds `421 § 0c`, whose message names `414 § 0b` as the owner.** `Failed
1/19`, `Failed test: 3`:

```
#         have: 891 = 861 non-empty (419) + 29 empty (421) | 1 undeclared
#         want: 890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared
```

⭐ `861`, not `862`. That one digit is AC-3 (i) discharged, and it is the property no assertion
could have shown while the class was empty.

**E — reverting AC-3 (i) (`n_nonempty` back to `sp <> '""'`) reds `§ 3h` while `§ 0c` stays
GREEN.** `Failed 1/19`, `Failed test: 17` — test 3 passed in that same run:

```
#         have: … | undeclared plant: total +1 non-empty +1 empty +0 undeclared +1
#         want: … | undeclared plant: total +1 non-empty +0 empty +0 undeclared +1
```

This is the whole case for `§ 3h` and it holds exactly as the record states: the partition line
cannot see its own miswiring while the class is empty, so without `§ 3h` the AC-3 (i) fix would
have been unwitnessed in both directions.

---

## 4. Findings

### MINOR-1 — the sweep for readers of *"`414` is byte-unchanged"* was keyed on the WORDING, and the variant wording survives as a live false sentence

`docs/backend-state/authorization-and-audit.md:71`, inside the **replaceable** `## Current state`
projection (not a frozen slice), reads:

> ⭐ **0208 D4–D6 are BUILT** (`DEFINER-SEARCH-PATH-NARROW-FIX`, migration `20261003007410`);
> `414` unchanged, still NOT the security property.

`414` is **no longer unchanged** as of `1a5dc2a1`: `plan(7)→plan(8)`, `§ 0b`'s description
rewritten, `§ 2d` added. The unit found and corrected the *identical* falsified claim in
`docs/lint-gates.md:37`, and its record's *Dead ends* paragraph says so — but the search that
found it was keyed on the string **"byte-unchanged"**, while this carrier says plain
**"unchanged"**. Same class as the lessons register's *"`ynamey` cannot match the `name_for`
variant"* and *a detector whose corpus defines its own pattern*: the enumeration was bounded by a
syntax rather than by the property.

Two aggravating facts, which is why I record it rather than wave it through:

1. `docs/backend-state/authorization-and-audit.md:1396` is an explicit **enumeration of the
   readers** of the sibling *"byte-unchanged"* claim about `419`. The project already knows this
   kind of claim has several homes, and the enumeration idiom is in the very same file.
2. Gate 16 check **I** (the `**Updated:**` stamp may not be older than the newest date in any
   heading below it) is the only mechanism that would force the projection to be revisited, and
   it is **already satisfied**: the stamp reads `2026-09-12` because the PREVIOUS unit landed the
   same day, while this unit appended a `2026-09-12` heading below it. So nothing will red, and
   the Record-step replacement the hub schedules could be written without ever learning that this
   clause is false.

**Remedy (lead, at the Record step):** the `## Current state` replacement must drop or correct
*"`414` unchanged"*. The accurate form is the one `docs/lint-gates.md:37` was corrected to —
*`414`'s PREDICATES are unchanged; its `§ 0b` MESSAGE now owns the undeclared class's remedy and
`§ 2d` proves that assertion can red*. ⚠ The block sits at **98 of the 100-line ratchet** (gate
16's headroom line), so this is a replace-in-kind, not an addition.

### MINOR-2 — `421`'s numbered assertion comments are off by one from `§ 3h` onward, and `-- 17.` now appears twice

`421` numbers its commented assertions with the TAP test index, and I verified that convention at
two independent points with my own runs: `§ 0c`'s comment is `-- 3.` and mutation D reported
`Failed test 3`; `§ 3h`'s comment is `-- 17.` (`421:611`) and mutation E reported `Failed test
17`. Inserting `§ 3h` at 17 pushed `§ 4` and `§ 5` up by one and neither comment moved:

- `421:634` — `-- 17. ⛔ THIS IS NOT A SAFETY ASSERTION …` — `§ 4` is now test **18**.
- `421:647` — `-- 18.` — `§ 5` is now test **19**.

So someone diagnosing `# Failed test 18` searches for `-- 18.`, lands on `§ 5 RESTORE`, and reads
a restore failure while the actual red is in `§ 4 THE RESIDUAL` — which is a bound-narrowing
finding, not a leak. This is the same family as the stale-`RUN SHAPE` trap both files' headers
warn about in ⛔ terms: a hand-kept number that is read as a map. The record's own mutation
evidence could not expose it, because `Failed test 17` happened to be correct for `§ 3h` and no
mutant ever reddened `§ 4` or `§ 5`.

**Remedy:** renumber `421:634` to `-- 18.` and `421:647` to `-- 19.`. Comment-only, touches no
`plan()`, changes no TAP figure.

### MINOR-3 — `414 § 2d` re-types `§ 0b`'s own `WHERE` clause instead of sharing it, so a drift in `§ 0b`'s clause leaves `§ 2d` green — MEASURED, mutant survived

`421 § 3h` solved precisely this problem by factoring the counts into `v421_partition`, and said
so in its own words (`421:186-188`): *"the control exercises the SAME expression the gate prints
rather than a hand-written copy of it — a harness holding its own copy of production text is a
control that certifies itself."*  `414 § 2d` does the opposite. `414:129` (`§ 0b`) reads
`from v414_domain where sp is null`; `414:223` (`§ 2d`) reads
`from v414_domain where sp is null and proname like 'z414\_ctl\_%'`. Two separate texts of one
predicate — LEARN-024's shape, in the sibling file, in the same commit that avoided it next door.

**I measured it rather than arguing it (mutation QA-1, § 6): the mutant SURVIVED the whole
file.** With `§ 0b`'s own clause changed to `where sp = '<none>'` — a realistic copy-paste from
`421`, whose view labels the same class `'<none>'` rather than `NULL` — and a real undeclared
DEFINER live in the catalog, `414` returned `Files=2, Tests=9, Result: PASS`. `§ 2d` passed and
printed `z414_ctl_undeclared`, certifying that *"`§ 0b` CAN BITE"* in the same run in which
`§ 0b` could not see a live offender.

⚠ **Why MINOR and not MAJOR.** AC-2 as written scopes the control to *"`v414_domain`'s `sp is
null` predicate"*, and against that wording the unit delivered exactly what was asked; the gap is
a BOUND on what `§ 2d` certifies, not an unmet requirement. `§ 2d` is also strictly better than
the silence it replaced: it does catch the two failure modes the class actually had — a `sp`
column wired wrong, and a predicate conflating EMPTY with ABSENT. Nothing is live today, because
`§ 0b`'s clause is correct. But `§ 2d`'s message over-claims the bound: *"`(NOTHING FIRED)` means
`§ 0b`'s clean 890/890 proved nothing"* invites the converse — that `§ 2d` firing means the clean
890/890 DID prove something — and that does not follow while the two clauses are separate texts.

**Remedy, one line:** add `create temp view v414_undeclared as select * from v414_domain where sp
is null;` beside the other `§ 0` views and have BOTH `§ 0b` and `§ 2d` read it — the
`v421_partition` pattern applied to the sibling file. Failing that, one sentence in `§ 2d`'s
message stating the bound honestly.

---

## 5. Notes (no action required; recorded so they are not re-derived)

- **NOTE-1 — *"the three terms no longer sum by construction"* (`421:196-198`) is imprecise, in
  the over-claiming direction.** `v421_domain.sp` is `coalesce(…, '<none>')`, so it takes exactly
  three shapes, and AFTER the change `n_nonempty + n_empty + n_undeclared = n_total` holds
  identically — more completely than before, not less. What the exclusion actually buys is that a
  newcomer lands on **its own** term instead of the term naming `419`; the tautology that is lost
  is only the one between the **two middle figures and the total**. The sentence is defensible on
  that narrower reading, and `§ 0c`'s live description does not repeat the loose claim, so this
  is a wording note and not a finding.
- **NOTE-2 — for the PO at step 4, so the confirmation is informed.** The ruling says *"No new
  cell"* and this unit added two literal new `is()` cells (`plan(7)→plan(8)`,
  `plan(18)→plan(19)`). I agree with the unit's reading: `§ 2d` and `§ 3h` take the **instrument**
  as their subject rather than the class, both say so in their own messages, and the lessons
  register would have made their absence a finding in its own right. But the PO ruled words, and
  the arithmetic of `plan()` is the first thing a later reader sees.
- **NOTE-3 — the record's closing line says QA was spawned *"on the eight ACs"*
  (`docs/progress/definer-undeclared-class-remedy.md:197`) while the hub defines **six**.** An
  inherited figure from the predecessor unit, which had eight. Harmless, and no gate can see it.
- **NOTE-4 — the gate-16 check-D WARN is new, is this unit's, and must not be compressed away.**
  `docs/backend-state/authorization-and-audit.md` went 157.1 KB → **163.2 KB**; check D now warns
  at exit 0, so `npm run lint` stays rc 0. I reproduced the warn myself (row 8). ⭐ The backend's
  refusal to shrink the slice to duck it is the correct call — the remedy check D names is a NEW
  SEAM, and cutting a record to fit a cap selects against its qualifiers. The follow-up the lead
  owes at the Record step should name the SEAM SPLIT as the remedy, never a size target.

---

## 6. Mutation QA-1 — the measurement behind MINOR-3

A copy of `414` with two edits and nothing else: (a) a real undeclared DEFINER planted before
`§ 0b` runs, and (b) `§ 0b`'s OWN predicate changed from `where sp is null` to
`where sp = '<none>'`. `§ 2d` left byte-identical; I asserted in the mutation script that `§ 2d`'s
clause was still present before running.

```
Files=2, Tests=9,  Result: PASS
```

**All eight assertions green — `§ 2d` included — with a live undeclared DEFINER in the catalog and
`§ 0b` blind to it.** The control pair is what makes this a real result rather than a null one:

| run | `§ 0b` clause | plant | outcome |
|---|---|---|---|
| **A** | production (`sp is null`) | live undeclared DEFINER | `§ 0b` **RED** (`Failed test 2`) — so the plant is detectable and the instrument is alive |
| **QA-1** | drifted (`sp = '<none>'`) | the same plant | **all green**, `§ 2d` passing — so the survival is attributable to the clause alone |

⛔ This is not a live defect: `§ 0b`'s clause is correct in `HEAD`, and the mutation is a
hypothetical future edit. It is a statement of what `§ 2d` does and does not certify, and the
remedy costs one `create temp view`.

For contrast, the symmetric mutation in `421` (re-inlining `§ 0c` so it stops reading
`v421_partition`) would leave `§ 3h` green for the same structural reason — but there the
coupling is a shared VIEW rather than a copied clause, so only a deliberate un-factoring could
break it. That is why `421` earns NOTE-1's neighbourhood and `414` earns a MINOR.

---

## 7. Security / gate-integrity audit

- **No security boundary is touched.** The diff has no migration, no `src/`, no policy, no RLS,
  no ACL and no `pg_proc` change (rows 10 and 12). Every function created is a pgTAP plant inside
  a transaction, dropped or rolled back, and both files' RESTORE assertions re-measure that.
  Architecture Rules 1, 2, 8, 9 and 12 have no subject here; Rule 10 (pt-BR) does not reach test
  files, which are correctly in English.
- **No existing assertion was weakened.** Row 10 is the evidence: `§ 0b`'s predicate and its
  expected `''`, and `§ 0c`'s expected string, are byte-unchanged. Nothing was made easier to
  pass, and no `plan()` shrank.
- **The `§ 0c` change makes the partition line stricter in the only direction that matters.**
  Before, an undeclared newcomer was counted onto the `419` term — a printed line misattributing
  the finding to a gate whose frozen set the census provably keeps it out of. After, it lands on
  its own term. Mutation D is the direct witness (`861`, not `862`).
- **No door was created, so LEARN-074 has no subject and the deriver's exit 3 is a real
  NOT-APPLICABLE, never a BLIND.** ⛔ I checked this from the diff rather than from the deriver's
  own `SCOPE:` line, because that line self-reports `derivation: NOT REACHED (this run ended
  before the catalog was probed)` — it is asserting "no files in scope", which is a claim about
  the diff, and row 12 is the independent confirmation of it.
- **Both new cells carry their own non-vacuity term inside the same assertion as the property** —
  `§ 2d`'s `(NOTHING FIRED)` sentinel and `§ 3h`'s `(NOTHING MEASURED)` sentinel, each explained
  in its message as VOID rather than a pass. That is the house pattern, correctly applied;
  MINOR-3 is a bound on `§ 2d`'s SUBJECT, not a missing sentinel.
- **Gate 18's byte-compared block survived a change to the file it compares** — verified by
  running the gate myself (row 9), not by eyeballing where the census diff landed.

---

## 8. Records

- **Hub** — six ACs, boxes unchecked (correct; the lead ticks at the Record step). `## Current
  state` is the five fixed sections, dated 2026-09-12, and its Blockers name both the unwitnessed
  fresh reset and the foreign commits. `reviews: []`; the lead links this file at the Record step.
- **Record** — the PO ruling is quoted at `:16-19` and I checked it against the source, the
  *"Open half 1 — RULED (PO 2026-09-11 …)"* paragraph in `docs/followups/follow-ups-archive.md`
  (the line numbers in the spawn prompt have shifted by the other session's commits, so I located
  it by content). **The ruling is carried without inversion or narrowing.** The only addition
  either gate message makes is *"with schema-qualified object references"*, which is not in the
  ruling sentence but is ADR 0208 D4's own second clause and reaches a converged function through
  D4's *"new or touched"* scope — an addition that is sourced, not invented. Both messages carry
  both ⛔s (never widen `414`/`419`, never add to the frozen set), and neither offers a remedy the
  ruling excludes.
- **The follow-up** `FUP-DEFINER-QUALIFIED-BODY-GATE-UNDECLARED-CLASS-NOW-HAS-A-LIVE-ENFORCER`
  (`docs/followups/follow-ups-open.md:1967-1973`) — its *Closes when* second branch reads
  *"`414 § 0b` is named as that assertion and `421 § 0c`'s message points at it, so that a red on
  `0 undeclared` names one remedy instead of two gates disagreeing about whose finding it is."*
  Mutations A and D together are the literal discharge of that sentence: one plant, two reds, one
  remedy named in both, and `421`'s red naming `414 § 0b`. Archiving it at the Record step is
  correct, and its heading's *"ruled, unbuilt"* label goes with it.
- **No ADR is owed, and none needed a `**Supersedes:**` / `**Amends:**` label.** ADR 0208 D4 rules
  the VALUE and the PO ruled the CLASS; nothing here takes a new decision. 0208 is not
  contradicted — its only touch on the undeclared class is the census note.
- **`docs/lint-gates.md`** correctly quotes its own superseded words instead of silently replacing
  them, which is the right form for a file with no frozen-slice convention.

---

## 9. What I could NOT verify (a work item, never a pass)

1. **The full-suite figure `Files=270, Tests=9066 PASS` — NOT re-earned by me, in either
   direction.** My own `npm run test:db` landed in the half-migrated window and is VOID (row 13);
   I did not re-run it afterwards, so the post-reset `9066 PASS` the lead reports stands on the
   lead's run alone. It is at least arithmetically consistent with my two single-file runs
   (`414` +1 and `421` +1 over the predecessor's 9064), but consistency is not a run. ⛔ The
   ledger must carry the figure from the run on the COMPLETED reset, not the pre-deadlock one.
2. **The fresh-reset precondition of AC-6 — I did not witness the reset itself.** The record's
   caveat (the lead's first 9066 was earned on a non-fresh catalog) is now superseded by a
   completed PO reset, which I did not run and cannot attest; what I can attest is that the
   catalog I re-ran everything against reads `890 / 0 undeclared / 29 empty` (row 1), which is the
   population every assertion in scope depends on.
3. **Whether the deadlock perturbed anything outside the DEFINER family.** `git worktree list`
   shows only the primary tree, so the half-migrated state was a partial apply of THIS directory's
   migrations rather than a foreign directory's — but I re-ran only `414`, `421` and my four
   mutants, not the other 268 files.
4. **`npm run lint` end to end.** I ran gates 16 and 18 individually (both rc 0, both
   database-free); I did not run the chain, so the lead's `rc 0, 18 gates` stands un-re-earned.
5. **The gate-16 check-D follow-up does not exist yet** (NOTE-4). It is owed at the Record step;
   `docs/followups/follow-ups-open.md` was off-limits to the backend and to me.
6. **Step 2 (tester) N/A.** I agree with the lead's reasoning — two pgTAP files, one SQL comment
   and three docs expose no runtime surface a Playwright spec could reach — but the ruling is the
   PO's to confirm at step 4, and I record it as unconfirmed rather than as met.
7. **Whether `§ 2d`/`§ 3h` satisfy the ruling's *"No new cell"*** (NOTE-2) is a question of the
   PO's intent, not a measurement, and I did not decide it.

---

**Verdict: APPROVED** — all six ACs met on witnesses I earned myself; the PO ruling carried
without inversion or narrowing; both new controls proven able to red on mutations I re-ran rather
than read, including `§ 3h`'s ⭐⭐ property that `§ 0c` stays GREEN under the miswiring `§ 3h`
catches. MINOR-1 (a live false *"`414` unchanged"* in the seam's replaceable projection, which no
gate will force), MINOR-2 (two off-by-one assertion-number comments in `421`) and MINOR-3
(`§ 2d` re-types `§ 0b`'s clause instead of sharing it — a mutant of mine survived the whole
file) are all correctable in place, and none of them opens a hole or weakens an existing
assertion. ⛔ The approval is **conditional on § 9 item 1**: the ledger and the record must carry
the full-suite figures from the run on the COMPLETED reset.

---

## Round 2 (2026-09-12)

Scope: my three r1 MINORs and NOTE-1/NOTE-3, over `fe3aa643` (3 files: `414`, `421`, the record;
`docs/backend-state/` deliberately untouched). Lead's witnesses on it: `npm run test:db`
`Files=270, Tests=9066, Result: PASS`, `not ok` 0; `npm run lint` rc 0.

**Verdict (r2): APPROVED**

Counts this round — **BLOCK 0 · MAJOR 0 · MINOR 0 new · NOTE 0 new**. MINOR-2, MINOR-3, NOTE-1 and
NOTE-3 are **CLOSED**, each on a witness I re-earned rather than read off the record. MINOR-1 stays
**OPEN BY DESIGN**, deferred to the lead's Record step.

### Baselines, re-run first

`00_setup + 414` → `Files=2, Tests=9, Result: PASS`. `00_setup + 421` → `Files=2, Tests=20,
Result: PASS`. Unchanged figures: the fix moved no `plan()`.

### Closure per finding

| Finding | Verdict | Witness I earned |
|---|---|---|
| **MINOR-3** — `§ 2d` re-typed `§ 0b`'s clause; my r1 mutant survived the whole file | ✅ **CLOSED** | `414:89-90` is now the single text `create temp view v414_undeclared as select * from v414_domain where sp is null;`, and `grep -n "sp is null" 414` returns exactly **one executable line** (90) plus two comment lines (63, 239). Its only two readers are `414:145` (`§ 0b`) and `414:245` (`§ 2d`). ⭐ **My r1 mutant is now KILLED.** Re-running it with the drift moved to the SHARED view (`sp = '<none>'`) plus a live undeclared DEFINER: `Failed test 7`, `have: (NOTHING FIRED)` / `want: z414_ctl_undeclared`, `Result: FAIL` — where in r1 the identical situation returned `Tests=9, Result: PASS`. |
| **MINOR-2** — `-- N.` comments off by one from `§ 3h` on; `-- 17.` appeared twice | ✅ **CLOSED** | `421:640` → `-- 18.`, `421:653` → `-- 19.`. **Map verified by forcing reds rather than by counting**: a copy with `§ 4`'s expected replaced by `'FORCED-RED-QA'` and `§ 5`'s first conjunct replaced by `false` reports `# Failed test 18` on `§ 4 THE RESIDUAL` and `# Failed test 19` on `§ 5 RESTORE`, `Failed tests: 18-19`. |
| **NOTE-1** — *"the three terms no longer sum by construction"* was backwards | ✅ **CLOSED** | `421:189-197` now states both polarities and names the direction: BEFORE, `n_nonempty + n_empty` summed to the total and an `<none>` member was counted TWICE; AFTER, the three class terms PARTITION the total and all three still sum to it, the gain being attributability rather than arithmetic. I checked that against the view: `sp` is `coalesce(…, '<none>')`, so it takes exactly three shapes and the new sentence is true in both halves. The superseded wording is quoted beside it. |
| **NOTE-3** — record said *"the eight ACs"* | ✅ **CLOSED** | `docs/progress/definer-undeclared-class-remedy.md:204-205` now reads *"on the six ACs"* with the superseded numeral and its provenance quoted. |
| **MINOR-1** — seam `:71` still says *"`414` unchanged"* | ⏳ **OPEN, deferred by design** | `sed -n '71p' docs/backend-state/authorization-and-audit.md` still returns `` `414` unchanged ``, and `fe3aa643` correctly does not touch that file. ⛔ **Not closed, and not waived.** It is the lead's at the Record step, and § 4's aggravating fact 2 still applies: gate 16 check I is already satisfied by the 2026-09-12 stamp, so nothing will red if the replacement is written without it. The accurate clause to carry across is `docs/lint-gates.md:37`'s. |

### Non-vacuity of the closures themselves

⛔ A red under mutation is only evidence if the instrument was alive without it, so each closure
has its unmutated control:

| run | state | outcome |
|---|---|---|
| baseline `414` | production | `Tests=9 PASS` — no false fire |
| **A** (re-run) | plant only, view intact | `§ 0b` **RED** (`Failed test 2`, `have: public.zzz_qa_mut_undeclared()`) — the offender is still detectable at `§ 0b` |
| **QA-1** (re-run, drift now on the shared view) | plant + drifted view | `§ 2d` **RED** (`Failed test 7`) — the control now speaks for `§ 0b`'s predicate |
| baseline `421` | production | `Tests=20 PASS` |
| **numbering probe** | `§ 4` and `§ 5` each forced | `Failed tests: 18-19` — the two comments that moved are the two numbers that fired |

⭐ One nuance worth writing down, because it is the point of the fix and not an accident: in QA-1
`§ 0b` itself stays GREEN — with the view broken it sees nothing and its expected value is `''`.
The mutant is killed by `§ 2d` ALONE, through its `(NOTHING FIRED)` VOID sentinel. That is exactly
the division of labour MINOR-3 asked for: `§ 0b` asserts the property, `§ 2d` asserts that `§ 0b`'s
predicate is alive, and after the fix the second claim is about the first's own text rather than
about a copy that happens to agree with it.

### What I could NOT verify this round

1. **The full-suite `Files=270, Tests=9066 PASS` on `fe3aa643`** — still the lead's run, not mine.
   The fix touches no `plan()` (my two baselines re-confirm `Tests=9` and `Tests=20`), so the
   figure is unchanged from the run § 9 item 1 already discusses; that is consistency, not a run.
2. **`npm run lint` end to end on `fe3aa643`** — not re-run. The diff is two pgTAP files and one
   record, none of which any lint gate reads, and gate 16's subject (`docs/backend-state/`) is
   untouched by this commit.
3. **MINOR-1's eventual correction** — by construction it lands after this review.
4. Everything still open from r1 § 9 items 5-7 (the check-D follow-up, step 2's N/A ruling, and
   whether `§ 2d`/`§ 3h` satisfy *"No new cell"*) is unchanged and remains the PO's or the lead's.

**Verdict (r2): APPROVED** — the two MINORs that touched test code are closed on re-earned
witnesses, and MINOR-3's closure is the strong kind: the exact mutant that survived the whole file
in r1 now reds. MINOR-1 is open and owed at the Record step; ⛔ it must not be read as closed by
this approval.
