# DEFINER-UNDECLARED-CLASS-REMEDY — progress record

Hub: [../features/definer-undeclared-class-remedy.md](../features/definer-undeclared-class-remedy.md) ·
closes `FUP-DEFINER-QUALIFIED-BODY-GATE-UNDECLARED-CLASS-NOW-HAS-A-LIVE-ENFORCER` · ADR 0208 D4 ·
branch `definer-undeclared-class-remedy` cut from `main @ f55b53ba`.

## Session log

### 2026-09-12 — unit opened; the ruling located; the closing branch chosen (lead)

**The follow-up's two branches.** *Closes when:* "the ruled disposition of the undeclared-`search_path`
DEFINER class is built as its own assertion (or `414 § 0b` is named as that assertion and `421 § 0c`'s
message points at it)". The Explore pass located the ruling in three carriers, verbatim and identically
worded:

- `docs/followups/follow-ups-archive.md:13585-13588` — *"**Open half 1 — RULED (PO 2026-09-11 …):** a
  `prosecdef` function with **no** `search_path` is a **defect to converge to `''`**, never a member to
  add to any frozen set; a red on `414 § 0b` means exactly that, and neither `414` nor `419` may be
  widened to admit it. No new cell."*
- `docs/backend-state/authorization-and-audit.md:71` — the seam's `## Current state`, same clause.
- `docs/progress/definer-search-path-narrow-fix.md:147-155` (the accepted proposal: *"not a new gate
  but a statement of what happens when the existing one reds … `414 § 0b` already reds the day the
  count moves"*) and `:388-390` (approval scope: *"accepted as proposed"*).

⇒ The ruling names `414 § 0b` as the assertion and orders no new one. The lead therefore takes the
SECOND branch (name `414 § 0b`, point `421 § 0c` at it) and adds what the ruling did not say but the
lessons register demands: a control proving `414 § 0b` can red, and a partition fix in `421 § 0c`.
⛔ Building a third assertion would contradict *"No new cell"*; the PO confirms or overrules at step 4.

**Why two gates disagree today (measured, not read off the FUP).** `414 § 0b` is
`is(string_agg(sig) where sp is null, '')` — a red prints offending signatures and says what is LOST
("NOT covered by §1"), not what to do. `421 § 0c`'s `non-empty` term is `sp <> '""'`, which is TRUE
for `<none>`, so a red reads `891 = 862 non-empty (419) + 29 empty (421) | 1 undeclared` (the QA r1
probe at `docs/reviews/definer-qualified-body-gate-review.md:78-79`) — the newcomer is counted on the
`419` term of the string even though the census (`scripts/definer-search-path-census.sql:37-38`)
coalesces a missing value to `'""'` and keeps it OUT of the frozen set. `421`'s header (`:184-189`)
says it *"would be counted on 419's side"* — false in the catalog, true only of the printed string.
Neither message names the convergence. ⚠ Two undeclared predicates exist — `421`'s `sp = '<none>'`
(no `search_path=%` element) and the looser `proconfig is null`; both read **0** on the live stack
2026-09-12 (`890 total | 861 non-empty | 29 empty | 0 | 0`), but a DEFINER carrying only a
non-`search_path` `proconfig` element would separate them. `414` and `421` share the stricter one.

**Stale carriers found.** `authorization-and-audit.md:1307` (*"PROPOSED … PO to rule"*), `:1308`
(*"pinned by `414`, not ruled"*), `:1324` (*"PO-ruled but unbuilt"*) — all in posted slices, all
contradicted by `:71` of the same file; `scripts/definer-search-path-census.sql:28-29` (*"disposition
is the follow-up's open half 1"*). ADR 0208 itself never rules the class (its D4 rules the VALUE; the
only mention is the census note `:216`), so no ADR is amended.

**Tree state at open.** `git status` showed four modified docs files belonging to another live session
(a closure of `…SUPABASE-TEST-DB-LEAVES-NO-PGTAP-INSTALLED`, uncommitted). ⛔ Not this unit's; staged by
path only, never `git add -A` (playbook § 4).

### 2026-09-12 — AC-1 … AC-5 built: `414 § 0b` owns the remedy, `421 § 0c` points at it, a control in each (backend)

**What landed.** Five files, TEST + DOCS only — no migration, no `src/`, no policy, no ADR.
`414_definer_search_path_resolves.sql` (`plan(7)` → `plan(8)`, RUN SHAPE `Tests=8` → `Tests=9`) ·
`421_definer_qualified_body.sql` (`plan(18)` → `plan(19)`, RUN SHAPE `Tests=19` → `Tests=20`) ·
`scripts/definer-search-path-census.sql` (comment only, outside gate 18's byte-compared block) ·
`docs/backend-state/authorization-and-audit.md` (two markers + one appended slice) ·
`docs/lint-gates.md` (gate 18's *"`414` … kept byte-unchanged"* clause, which THIS unit falsified).

**AC-1 — `414 § 0b` is the named owner.** Predicate (`sp is null`) and expected (`''`) UNCHANGED; only the
message moved. It now names the defect, the remedy (`set search_path = ''` + schema-qualified references,
ADR 0208 D4, PO ruled 2026-09-11), the two ⛔s (never widen `414`/`419`, never add to the frozen set) and why
the member is in NO gate's domain meanwhile. Its section comment carries the ruling quoted, keeps
*"Measured 2026-09-03: 890 of 890"* as a dated figure, and points at `§ 2d` as its control.

**AC-2 — `414 § 2d`, and the twin came free.** The seventh plant (`public.z414_ctl_undeclared()`,
`security definer` with no `set search_path`) is created inside the EXISTING `s414_plant` savepoint, i.e.
after `§ 0b` and `§ 1` have read the live population, and dies with it — `§ 3`'s restore check already
covers it (`proname like 'z414\_ctl\_%'`). ⭐ It is invisible to `§ 2a`/`§ 2b`/`§ 2c` **by the very property
under test**: no `sp`, so no `v414_tokens` row, so no offender row — which is why no eighth probe was
needed for the discrimination half either: `z414_ctl_empty_form` (already planted, `set search_path to ''`)
IS the `''` twin, and `§ 2b` already proves it is in the sweep's domain.

**AC-3 — `421 § 0c` partitions and points.** (i) The four counts moved into a temp view `v421_partition`,
whose `n_nonempty` is now `sp <> '""' and sp <> '<none>'`. Expected string UNCHANGED
(`890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared`; re-measured on the live catalog the same day
under both the fixed and the old term — identical today, because the class is empty). ⛔ The view is not
cosmetic: `§ 3h` reads the SAME columns `§ 0c` formats, so the control is not a hand-written copy of
production text. (ii) The description names `414 § 0b` as the OWNER of an `undeclared` red, states the
remedy in one clause, and keeps the two-middle-figures re-baseline warning verbatim. (iii) The header's
*"would be counted on 419's side"* is replaced by the measured mechanism — the census's
`definer_nonempty_domain` block coalesces a missing value to `'""'`, so the member is `sp_nonempty = false`
and never enters the frozen set, while `421`'s arms read only the empty form; the false clause was true of
the PRINTED STRING and false of the catalog.

**AC-4 — `421 § 3h`, as DELTAS and not a second copy of the baseline.** Two `language sql` plants naming
nothing (`select 1`) — one undeclared, one on `''` — each snapshotted into `t421_partition_snap` and dropped
immediately (`§ 5`'s restore count raised seven → nine in its message). The assertion reads
`empty-form twin: total +1 non-empty +0 empty +1 undeclared +0 | undeclared plant: total +1 non-empty +0
empty +0 undeclared +1`. ⛔ Re-typing `891 = 861 … | 1` would have given the baseline a second home and made
every future convergence a three-place re-baseline.

**Mutation proofs — six runs, each on a COPY in the scratchpad via `supabase test db <abs path>`** (it
accepts a path outside `supabase/tests/`, verified: baseline copy `Files=1, Tests=8 PASS`). ⛔ No mutant
ever touched `supabase/tests/`.

- **A — a planted undeclared DEFINER reds `414 § 0b`**, message naming the remedy:
  `# Failed test 2: "§0b NO SILENT EXITS FROM THE DOMAIN: … is a DEFECT whose ONE remedy is to converge it
  to `set search_path = ''` with SCHEMA-QUALIFIED object references (ADR 0208 D4; PO ruled 2026-09-11) …"` /
  `have: public.zzz_mut_undeclared()` / `want:` (empty). `Failed 1/8`.
- **D — the same plant reds `421 § 0c`**, message naming the owner:
  `# Failed test 3: "§ 0c THE TWO GATES PARTITION THE POPULATION: … and `414 § 0b` is the assertion that
  OWNS that finding: it names the offender and its ONE remedy, converge it to `set search_path = ''` with
  schema-qualified references (ADR 0208 D4; PO ruled 2026-09-11) …"` /
  `have: 891 = 861 non-empty (419) + 29 empty (421) | 1 undeclared` /
  `want: 890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared`. ⭐ That `have` IS AC-3 (i)'s property:
  the non-empty term stayed **861** while total and `undeclared` each moved +1. Both messages name one
  remedy and `421`'s names `414 § 0b`.
- **B — `414 § 2d` reds when its plant is neutered** (given `set search_path to app`):
  `have: (NOTHING FIRED)` / `want: z414_ctl_undeclared`. (`§ 2b` reds alongside it, which independently
  confirms the unmutated plant really carries no path.)
- **C — `414 § 2d` reds on the twin half** (predicate widened to `sp is null or sp = '""'`, i.e. reading the
  EMPTY form as an ABSENT one): `have: z414_ctl_empty_form | z414_ctl_undeclared` /
  `want: z414_ctl_undeclared`.
- **E — `421 § 3h` reds when AC-3 (i) is reverted** (`n_nonempty` back to `sp <> '""'`):
  `have: … undeclared plant: total +1 non-empty +1 empty +0 undeclared +1`. ⭐⭐ **`§ 0c` itself stayed
  GREEN in that run — only test 17 failed.** That is the whole case for the control: the partition line
  cannot see its own miswiring while the class is empty, so the fix would have been unwitnessed.
- **F / G — each plant proven load-bearing in its own direction**: neutering the undeclared plant gives
  `undeclared +0` (and `non-empty +1`), neutering the `''` twin gives `empty +0 non-empty +1`. Both red.

**Gates run here (the lead owns the fresh-reset full gate).** `supabase test db 00_setup + 414` →
`Files=2, Tests=9 … Result: PASS`. `00_setup + 421` → `Files=2, Tests=20 … Result: PASS`. The whole DEFINER
family together (`413 · 414 · 419 · 420 · 421` + setup) → `Files=6, Tests=78 … Result: PASS` (420's
`planned 11 … ran 9` is the documented savepoint-counter noise). `npm run lint` **rc 0, 18 gates**;
`npm run typecheck` rc 0. Gate 18 re-run alone after the census edit: `in sync (861 … baseline 861 -> 861)`
rc 0 — the comment is outside the `>>> BEGIN definer_nonempty_domain <<<` block, as claimed.
⛔ No `supabase db reset` (shared stack); every run was transactional.

**⚠ A finding this unit CREATED, for the lead, not fixable inside it.** The seam file crossed gate 16's
check-D **warn** line: `docs/backend-state/authorization-and-audit.md` went 157.1 KB → **163.2 KB**
(160913 → 167157 bytes) and the gate now prints
`WARN — [D] … 163.2 KB is over the 160 KB warn line (cap 200 KB). Plan the next seam.` It exits **0** (a
warn must not red the build, or it gets raised), so `npm run lint` is rc 0 — but the warn is NEW and mine.
⛔ I did not compress the slice to duck it: cutting a record to fit a cap selects against its qualifiers,
and the remedy check D names is a SEPARATE SEAM, not a shorter slice. Its `## Current state` block is also
at **98 of the 100-line ratchet** (2 left) — relevant to the lead's Record-step replacement. ⛔ I could not
file the follow-up myself: `docs/followups/follow-ups-open.md` was named off-limits in the spawn prompt.

**Dead ends and things deliberately not done.**

- `psql` is not on PATH on this machine; catalog probes ran through
  `docker exec -i supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres`. `pg_extension` carries
  neither `pgtap` nor `plpgsql_check` between runs, so mutants went through `supabase test db` (which
  supplies pgTAP) rather than raw `psql`.
- `to_char(…, 'S9')` overflows to `#` past one digit; `§ 3h` uses `'FMS999'` (verified `+1` / `+0` / `-2`).
- ⛔ **No third assertion was built.** The ruling says *"No new cell"*; `§ 2d` and `§ 3h` are CONTROLS over
  the two existing cells, not new subjects, and both are named as such in their messages.
- `docs/lint-gates.md` gate 18 does NOT carry the *"PO to rule"* / *"open half"* phrasing AC-5 anticipated
  (grepped: no match). What it did carry was a clause my own change falsified — *"that population's
  resolvability is `414`'s property, which is kept byte-unchanged"* — corrected in place with the
  superseded words quoted, since that file has no frozen-slice convention.

**Commit.** `1a5dc2a1` — `test(definer-undeclared-class-remedy): 414 s0b owns the undeclared-class remedy,
421 s0c points at it, a control in each` (6 files, +294 / −24). ⛔ Staged by explicit path; the four files
belonging to the other live session had already been committed by it (`bb6f3571`, `664a70a5`) and the tree
was clean afterwards. ⚠ The spawn prompt named a `Co-Authored-By: Claude Fable 5.1` trailer while this
session's own attribution config names `Claude Opus 5 (1M context)`; the accurate one was used — the lead
can re-state it if the other was intended.

### 2026-09-12 — gate step 1 run by the lead; step 2 ruled N/A; QA spawned (lead)

**Reset.** ⛔ `supabase db reset --local` was DENIED to this session by the permission classifier (twice,
alone and chained). The suite below therefore ran on the catalog as the backend left it — every backend
run was transactional and no E2E ran since the last reset, so no leftover is expected, but **"fresh
reset" is NOT witnessed here**; the PO is asked to run the reset, after which `npm run test:db` is
re-run and this line amended.

**AMENDED the same day — the fresh reset IS witnessed.** The PO ran `supabase db reset --local`; its first
attempt deadlocked (`40P01`, migration process 245 vs a concurrent `supabase test db` from the `qa` teammate — a
shared-stack collision, not a migration defect; the catalog was left half-migrated at `20260718000100`), the QA
teammate was told to stop all DB runs, the second attempt completed (531 rows in
`supabase_migrations.schema_migrations`), and the lead re-ran `npm run test:db` on it:
`Files=270, Tests=9066` · `Result: PASS` · `not ok` lines: 0. The pgTAP row below now stands on a fresh reset.

| arm | invocation | rc | witness |
| --- | --- | --- | --- |
| pgTAP | `npm run test:db` (first on the backend's catalog; re-earned on the FRESH reset — see the amendment above) | 0 | `Files=270, Tests=9066` (was 9064: `414` +1, `421` +1) · `Result: PASS` · `not ok` lines: 0 |
| lint | `npm run lint` | 0 | 18 gates; one WARN, new and this unit's: gate 16 check D `authorization-and-audit.md — 163.2 KB is over the 160 KB warn line (cap 200 KB)` |
| typecheck | `npm run typecheck` | 0 | — |
| door sweep deriver | `bash scripts/door-sweep-cases.sh f55b53ba` | **3 NOT-APPLICABLE** | `SCOPE: 0 file(s) — 0 committed (f55b53ba..HEAD), 0 worktree, 0 untracked \| filter: none \| derivation: NOT REACHED (this run ended before the catalog was probed)` — no migration; neither sweep arm run |
| census | `ARM=census` | 0 | `=== INVARIANT HOLDS ===` |
| hat | `ARM=hat` | 0 | `self-test: 7/7 OK` · `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` |
| floor | `ARM=floor` | 0 | `=== INVARIANT HOLDS ===` |
| wrapper | `FROMFINDINGS=1 ARM=wrapper` | 0 | `ARM 5: invoker-wrapper BLIND ⊆ allowlist` · `BLIND set size: 41` · `=== INVARIANT HOLDS ===` |
| deriver self-test | `SELFTEST=1 bash scripts/door-sweep-cases.sh` under `GNU bash, version 5.2.37(1)-release (x86_64-pc-msys)` | 0 | `SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0` · `--- GROUP deriver: scenarios 20 (pass 20 · fail 0 · skipped 0)` · `--- GROUP merge helper: scenarios 18 (pass 18 · fail 0 · skipped 0)` · `--- GROUP audit startup capture: scenarios 8 (pass 8 · fail 0 · skipped 0)` |

Set-valued arm: not owed — the door sweep did not run (exit 3, no migration).

**Step 2 (tester) ruled N/A by the lead, for the PO to confirm at step 4:** the change is two pgTAP
files, one SQL comment and three docs; there is no runtime surface a Playwright spec could reach — the
same ground on which the PO ruled step 2 N/A for `DEFINER-QUALIFIED-BODY-GATE`.

**Backend deviations, ruled by the lead.** (1) The `Co-Authored-By` trailer on `1a5dc2a1`/`e694bf0e`
names the backend's own model rather than the lead's — correct attribution, left as is. (2) The gate-16
check-D warn (seam 157.1 → 163.2 KB) is this unit's and is filed as a follow-up at the Record step, not
compressed away; the seam's `## Current state` block is at 98/100 lines and the lead's replacement must
stay under the cap. (3) Two commits from ANOTHER session (`bb6f3571`, `664a70a5`, the pgTAP-diagnostics
FUP closure) sit on this branch because the sessions share one checkout; they fast-forward onto `main`
and the lead's `git branch -f main 664a70a5` was DENIED by the classifier, so they ride along at merge.

**QA spawned** on the six ACs (⚠ *"eight"* as first written — an inherited figure from the predecessor
unit, which had eight; the hub defines AC-1…AC-6. QA r1 NOTE-3), with the reset caveat named as a "could
not verify" input.

### 2026-09-12 — QA r1 MINORs corrected (backend)

**MINOR-3 — the one that mattered. `§ 0b`'s clause now has ONE text, and the control reads it.**
`create temp view v414_undeclared as select * from v414_domain where sp is null;` sits beside the other
three `§ 0` views; `§ 0b` and `§ 2d` both read it and neither types the clause. ⛔ The predicate and the
expected `''` are still unchanged — only where the clause LIVES moved. `§ 2d`'s message now says the bound
it earns (*"the view §0b ITSELF asserts on, not a re-typed copy of its clause"*), the `§ 0` header block
carries QA's measurement as the reason the view exists, and the `§ 0b` comment names the change.

**QA's mutant QA-1, re-run on both shapes — its survival is what the fix removes.** Same mutant both
times: `§ 0b`'s clause drifted to `sp = '<none>'` (the realistic paste from `421`, whose view labels the
same class `'<none>'` rather than `NULL`) with a live `public.zzz_mut_undeclared()` in the catalog.

- **BEFORE** (`414` as committed at `1a5dc2a1`, clause typed at both sites): `Files=1, Tests=8, Result:
  PASS` — ⚠ **zero failed tests.** QA-1 reproduced exactly: `§ 0b` blind to a live offender while `§ 2d`
  certified *"§0b CAN BITE"* in the same run.
- **AFTER** (the shared view's clause drifted instead): `# Failed test 7: "§2d §0b CAN BITE …"` /
  `have: (NOTHING FIRED)` / `want: z414_ctl_undeclared` — `Failed test: 7`, `Result: FAIL`. The drift that
  was silent now reds, and it reds in the control rather than only in the gate.

**The two original `414` mutants re-run against the refactored file, because a refactor can invalidate the
controls that read it** (⛔ not recalled from the earlier entry — re-measured):

- **A2** — a live undeclared DEFINER still reds `§ 0b`: `have: public.zzz_mut_undeclared()`, `Failed test:
  2`.
- **C2** — the twin-conflation half, now expressed as a drift of the SHARED view (`sp is null or sp = '""'`):
  `Failed tests: 2, 7`. ⭐ Both cells red together, which is the coupling the view buys — `§ 0b` prints the
  29 empty-form DEFINERs (the *"reds on every DEFINER that converged"* failure mode, made concrete) and
  `§ 2d` prints `z414_ctl_empty_form | z414_ctl_undeclared`.

**MINOR-2 — `421`'s assertion-number comments, and the map VERIFIED rather than counted by eye.**
`-- 17.` → `-- 18.` at `§ 4` and `-- 18.` → `-- 19.` at `§ 5` (`§ 3h`'s own `-- 17.` was already right,
per QA's mutation E). Proven by forcing each to red on a copy: `§ 4`'s residual predicate widened to
`src ~* 'select'` → `# Failed test 18: "§ 4 THE RESIDUAL IS EMPTY …"`; `§ 5`'s empty-path count pinned to
`28` → `# Failed test 19: "§ 5 RESTORE …"`. ⚠ A first attempt mutated `§ 4` through `sed` and the
backslashes were eaten (`'\mexecute\M'` → `'mbeginM'`), so the predicate matched nothing and `§ 4` stayed
GREEN — a mutant that did not apply reporting as "no finding". Caught by diffing the copy before scoring it.

**NOTE-1 — `421:186-194` reworded to what is true.** The old sentence (*"the three terms no longer sum by
construction"*) was backwards. BEFORE the change `n_nonempty` + `n_empty` summed to the total by
construction and an `<none>` member was counted TWICE; AFTER it, the three class terms PARTITION the total
and still sum to it. The gain is attribution, not arithmetic: `n_undeclared` is now the only term a
newcomer of its class moves.

**NOTE-3 — the record's *"eight ACs"*** corrected to six, with the superseded numeral quoted beside it.

**Witnesses.** `00_setup + 414` → `Files=2, Tests=9 … Result: PASS`. `00_setup + 421` → `Files=2, Tests=20
… Result: PASS`. `413 · 414 · 419 · 420 · 421` + setup → `Files=6, Tests=78 … Result: PASS`.
`npm run lint` rc **0**. ⛔ No `supabase db reset`; every run transactional, every mutant a copy in the
scratchpad. ⛔ `docs/backend-state/authorization-and-audit.md` untouched — MINOR-1 is the lead's at the
Record step. No `plan()` moved, so the suite total is unchanged at 9066.
