# DEFINER-QUALIFIED-BODY-GATE — progress record

> Hub: [definer-qualified-body-gate.md](../features/definer-qualified-body-gate.md) · branch
> `definer-qualified-body-gate`, cut from `main @ 6fd0bfdb` · owed by ADR 0208 D4 (second clause) ·
> closes `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`.

## Session log

### 2026-09-11 — unit opened; the PO ruled option (a); feasibility measured on the live catalog (lead)

**The ruling.** The follow-up offered (a) a catalog check that an empty-path DEFINER's body names no
unqualified relation, or (b) a review obligation. The PO chose **(a)**, built as pgTAP `421`, after the
spike below; the "install by migration" variant of (a) was offered and not chosen — the extension lives
inside the test transaction only.

**Why no ADR.** D4's verbatim ruling already states the two-clause convention; ADR 0208 D5 orders 419 as
the path gate and names nothing for the body clause. An enforcer for a stated convention is a unit, not
a decision.

**Feasibility spike (rolled-back transactions, container `supabase_db_azkbbhskturikxpgmafq`).**
- Population: 29 empty-path DEFINERs in `app`/`public`/`authz` — plpgsql 18 (app 9 · public 7 · authz 2),
  sql 11 (authz 8 · app 2 · public 1). `plpgsql_check` 2.8 in `pg_available_extensions`, not installed.
- plpgsql arm: a planted DEFINER on `''` with `from profiles` → `error:42P01 relation "profiles" does not
  exist`; its qualified twin → 0 rows; the same plant under `set local search_path = public, app,
  pg_catalog` STILL reds ⇒ plpgsql_check applies `proconfig`, not the session path. Unqualified
  `is_admin()` → `42883`.
- plpgsql arm over the 18 live members (trigger functions given `tgrelid`): 42P01 only on the four
  temp-table bodies, each naming a relation its own body creates (`_copy_answer_map`, `_tpl_phase_map`,
  `_clone_section_map` + `_clone_item_map`, `_clone_standard_map`); 11 of 18 produce zero findings of
  any level; the rest are `warning extra` (never-read variables) and one `55000` cascade from the temp
  miss — outside the gate's sqlstate set. Discrimination: a plant creating temp `_x` and reading
  `profiles` unqualified still reds 42P01.
- sql arm: `create function … set search_path = '' as $$ select count(*) from profiles $$` reds at CREATE
  (`check_function_bodies = on`, the validator applies `proconfig`); the SAME body created on
  `search_path = public` then `alter function … set search_path = ''` does NOT re-validate (no error) —
  the hole, and the exact shape of `tenant_orphan_profiles`'s convergence; `execute pg_get_functiondef(oid)`
  in a savepoint re-runs the validator: `REEMIT RED 42P01` on that plant, `REEMIT OK` on all 11 live.
- Residual: 0 of 29 bodies contain `execute`; the four `create temp` bodies are the 420 subjects.

**Scope fence.** 419 and 420 assertions untouched; no migration; no `.claude/rules/` file added (cap
12/12, sibling FUP `…RULES-CAP-DEFERS-THE-D5-HINT-FILE` is PO-to-rule) — only the existing rule bullet's
wording changes and must stay under the byte cap.

**Delegation.** `backend` builds 421 and re-words the five carriers; tester and QA follow the §6 order.

### 2026-09-11 — pgTAP 421 built; carriers re-worded (backend)

⚠ The session crossed midnight during the full-suite run; the trailing gate runs below carry a 2026-09-12
wall clock. The unit's date stays **2026-09-11** (its opening, its ruling and the hub's `Updated:`).

**Deliverable 1 — `supabase/tests/421_definer_qualified_body.sql`, `plan(16)`, RUN SHAPE `Files=2, Tests=17`.**

- **§ 0 the instrument and the domain.** `§ 0a` asserts `plpgsql_check` is in `pg_available_extensions`
  BEFORE the `create extension … with schema extensions`, so a missing instrument reds with a diagnosis
  rather than an unexplained abort; `§ 0b` then reads `pg_extension` rather than trusting the DDL's quiet
  exit. The create runs inside the file's `begin; … rollback;` — measured: `ext_present 1` inside the
  transaction, and `select count(*) from pg_extension where extname='plpgsql_check'` → **0** after the file
  ends. ⛔ No migration; the catalog is untouched.
- **§ 0c the partition** — `890 = 861 non-empty (419) + 29 empty (421)` as one named string, 421's OWN
  predicate. ⛔ `419 § 0`'s splice was NOT copied: gate 18 compares that block byte-for-byte with
  `scripts/definer-search-path-census.sql`. `§ 0d` pins `18 plpgsql | 11 sql | app authz public`.
- **§ 1 plpgsql arm** — `left join lateral extensions.plpgsql_check_function_tb(oid, tgrelid, fatal_errors
  => false) on true` (a LEFT join, so a member the checker CLEARS is not dropped and `§ 1a` can count
  **18 examined**). `§ 1b` pins the raw finding set as `RAW>0 | _clone_item_map _clone_section_map
  _clone_standard_map _copy_answer_map _tpl_phase_map` — the discrimination half, without which `§ 1c`'s
  empty result is indistinguishable from a dead query. `§ 1c` = 0 post-exclusion findings. Measured raw:
  **17 rows, 17 excluded**, from the four ADR 0208 D6 bodies only.
- **§ 2 sql arm** — a DO block re-executing `pg_get_functiondef(oid)` per member inside `savepoint
  s421_sql_reemit`, always rolled back. `§ 2a` reads **`11 visited | 0 findings`**; `§ 2b` proves all 11
  definitions are byte-identical to a pre-savepoint snapshot.
- ⭐ **The savepoint problem, and the mechanism chosen.** `rollback to savepoint` discards rows inserted
  into a temp table inside that savepoint, so "capture into a temp table, roll back, assert after" cannot
  work as written. Measured directly: a value `setval`'d to 42 inside a savepoint **survives** its
  rollback, while a row inserted into a temp table in the same savepoint does not. So the two mutating
  arms carry their result out on a **temp sequence** (`setval` is non-transactional), seeded to `0 = the
  block never ran` and written as `value + 1` — which is why `§ 2a` reads `11 visited | 0 findings` and a
  never-run block would read `-1 visited`. Findings are additionally `raise warning`-ed from inside the
  block, so a red names function/sqlstate/message in the run log. Every assertion in the file sits OUTSIDE
  every savepoint (the pgTAP savepoint trap: an assertion that RAISES inside one is recovered by the
  following rollback and silently never runs). The plpgsql arm takes **no** savepoint — `plpgsql_check` is
  read-only — so its findings keep their text.
- **§ 3 five planted controls**, all measured discriminating: unqualified plpgsql DEFINER on `''` →
  `42P01 relation "profiles" does not exist`; its qualified twin → no finding **and** `§ 3b` asserts it was
  EXAMINED (1 row returned); `is_admin()` unqualified → **42883** (the live catalog raises only 42P01, so
  without this plant that half of the finding set is carried by no assertion); the temp-plant →
  `_x=EXCLUDED | profiles=KEPT` in ONE string, both halves, because an exclusion that matched nothing and
  one that matched everything each satisfy either half alone; the sql plant created on `search_path =
  public` then `ALTER`ed to `''` → `"" accepted by ALTER | 1 visited | 1 findings`, i.e. the catalog
  accepted the body unvalidated and only the re-emission catches it. `§ 5` asserts the restore.
- **§ 4 the residual** — `0 of 29` bodies match `\mexecute\M`, stated as a BOUND (dynamic SQL is opaque to
  both arms), not as coverage.
- **Exclusion bound tightened beyond the spec:** the finding's relation name is regex-escaped
  (`regexp_replace(relname, '([^[:alnum:]])', '\\\1', 'g')`) before interpolation, so an identifier
  carrying a metacharacter cannot make the exclusion match MORE than its own relation — the unsafe
  direction.

**Deliverable 2 — the five carriers, each now naming 421 and the `execute` residual:**
`.claude/rules/migrations-forward-only.md` (**2043 bytes** after, cap 2048 — `lint:rules` OK; the wording
was 2049 on the first attempt and one word was cut) · `scripts/gen-definer-search-path-freeze.mjs` header ·
`419`'s header ⛔⛔ block (**comment-only**: `git diff … | grep -v '^[+-]-- '` returns nothing, so the
assertions and the `§ 0` splice are byte-unchanged) · `docs/backend-state/authorization-and-audit.md`
`## Current state` bullet REPLACED + a new dated slice appended at the seam's bottom + its "Where the
detail lives" list extended · `docs/lint-gates.md` gate-18 paragraph. The follow-up name is kept and cited
as **closed by 421**, never deleted.

**Witnesses.**

| run | verdict |
| --- | --- |
| `supabase db reset --local` | `Finished supabase db reset on branch definer-qualified-body-gate.` |
| `npm run test:db` (that fresh reset) | **`Files=270, Tests=9062`** · `All tests successful.` · `Result: PASS` |
| `supabase test db …/421_definer_qualified_body.sql` | `Files=1, Tests=16` · PASS (no `Looks like you planned…`, no Bad plan) |
| `supabase test db …/00_setup.sql …/421_…sql` | **`Files=2, Tests=17`** — the RUN SHAPE line, measured, not asserted from memory (`419` alone measured `Files=1, Tests=10` / with setup `Files=2, Tests=11`, confirming the convention) |
| `npm run lint` | **rc 0**, 18 gates; `gen-definer-search-path-freeze --self-test: OK (17 cases)` · `in sync (861 frozen …) [baseline main (6fd0bfdb43bb)]` · `check-rules-staleness: OK (12 rule file(s) …)` · `backend-state gate: OK — 16 seam file(s) … authorization-and-audit.md at 156.4 KB` |

**Mutation proof (three mutations, run on the FRESH catalog against mutated COPIES in the scratchpad — the
tracked file was never edited to red).**

| mutation | result |
| --- | --- |
| exclusion matches every `42P01` (the requested one) | **2 red**: `§ 3d` `have: _x=EXCLUDED \| profiles=EXCLUDED` and `§ 3a` `have: (NOTHING FIRED)`. ⭐ `§ 1c` stayed **green** — a blinded exclusion is invisible to the property assertion and visible only to the controls, which is exactly why they are there |
| sql arm's loop selects `lang = 'nosuchlang'` | **1 red**: `§ 2a` `have: 0 visited \| 0 findings` — the vacuity term fires, the findings term alone would have passed |
| plpgsql arm's view selects `lang = 'nosuchlang'` | **6 red**: `§ 1a` `have: 0`, `§ 1b` `have: NULL`, `§ 3a`/`§ 3b`/`§ 3c`/`§ 3d` all `(NOTHING FIRED)`/`0` |
| unmutated, same session | 16 `ok`, `Result: PASS` |

**Dead ends and corrections, so the next reader does not re-walk them.**

- ⛔ **"Capture into a temp table inside the savepoint, roll back, assert after" does not work** — the task
  brief specified it and it is unimplementable: the rollback discards the rows. Measured before designing
  around it (proto: `setval` 42 survives, temp-table row does not). The sequence channel is the fix, and
  the `+1` sentinel is what keeps "never ran" distinguishable from "found nothing".
- **A first draft of `§ 3d` put the `from` clause inside `coalesce(...)`'s argument list** — `select
  coalesce(string_agg(…) from t), 'default')` — which is a syntax error that, inside a savepoint, would
  have been recovered and the test silently skipped. It is outside every savepoint here, so it aborted
  loudly at authoring time.
- **`§ 0c` failed on its first run** (`have: 890 = 861 non-empty (419) + 29 empty (421)` vs a `want` that
  omitted the parentheticals). Fixed by moving the expected literal to the richer form, not by stripping
  the expression.
- ⚠ **`supabase test db` does NOT leave `pgtap` installed** — the single-file psql loops used for the
  mutation runs need `create extension pgtap` first. It was created and **dropped** afterwards
  (`select count(*) … where extname='pgtap'` → **0**), so the local stack is back to what the reset left.
- ⚠ **`plpgsql_check` findings repeat per statement**, so a raw COUNT (17 today) is a fragile pin; `§ 1b`
  pins the distinct RELATION NAMES plus `RAW>0` instead, which discriminates without rotting on an
  unrelated body edit.

**Not run here (the lead's gate step 1 owns them):** the authz arms (`census`, `hat`, `floor`,
`FROMFINDINGS=1 wrapper`) and the diff-scoped door sweep. ⚠ The diff is one new pgTAP file + five
comment/doc texts and **no migration**, so no door changes — but that is a claim for the sweep's
`SCOPE:` line to RULE, not for this entry to assert.

**Addendum, same session (wall clock 2026-09-12).**

- **`§ 0c` tightened after the first commit.** As first written its two middle figures summed to the
  total BY CONSTRUCTION (`sp <> '""'` and `sp = '""'` are complements), so the assertion proved
  arithmetic and a pinned pair, not the escape it names. It now carries a fourth term — **`0
  undeclared`** (`sp = '<none>'`) — which is the non-tautological one: a DEFINER declaring no
  `search_path` at all satisfies `<> '""'`, would be counted on 419's side, and is in neither gate's
  real domain (`414 § 0b`'s class, disposition still open). Its message also now states that the two
  middle figures MOVE on a legitimate convergence and that the fix is a re-baseline here AND in
  `419 § 0c/§ 0d` in the same change — ⛔ never a reason not to converge, which is the inversion
  `419`'s own header warns about. Re-verified: `Files=2, Tests=17` PASS, `npm run lint` rc 0.
- ⚠ **The hub's `Updated:` was bumped 2026-09-11 → 2026-09-12 against the task brief**, because gate 13
  reds on it: `[HUBS] … Updated 2026-09-11 is older than the newest code commit on this branch
  (2026-09-12) — the block is stale`. The session crossed midnight during the 212-second suite run.
  `authorization-and-audit.md`'s `## Current state` stamp was bumped for the same reason (the block was
  replaced today); the dated SLICE headings and this record's entry heading stay **2026-09-11**, the
  unit's date. ⛔ A gate's demand outranks a brief's instruction — the deviation is recorded rather than
  papered over.
- **The full-suite witness was RE-EARNED on the final code**, because the `Files=270, Tests=9062` run
  above predated the `§ 0c` tightening and a witness from earlier bytes is not a witness for these.
  Second fresh `supabase db reset --local` then `npm run test:db`: **`Files=270, Tests=9062`** ·
  `All tests successful.` · `Result: PASS`, 202 wallclock secs. The count is unchanged because the
  tightening altered one assertion's expression, not the plan.

### 2026-09-12 — gate step 1 closed by the lead; AC-1 deviation ruled; three follow-ups filed (lead)

**Door sweep, both arms — RULED NOT-APPLICABLE.** `bash scripts/door-sweep-cases.sh 6fd0bfdb` → exit
**3** `RESULT: NOT-APPLICABLE (3) — no migration file in the diff.`, quoting
`SCOPE: 0 file(s) — 0 committed (6fd0bfdb..HEAD), 0 worktree, 0 untracked | filter: none | derivation: NOT REACHED (this run ended before the catalog was probed)`.
The hub's `Next` predicted exit 1 (NO DOORS); the measured verdict is exit 3, which is the stronger
claim for this diff — four commits, one new pgTAP file, five comment/doc carriers, **zero migrations** —
and it is checkable: `git diff --stat 6fd0bfdb..HEAD -- supabase/migrations` is empty. Exit 3 was
never pasted into a `CASES=` substitution; the rc was read bare. No predicate/policy sweep ran, and
none is owed: the sweep has no domain here.

**The four authz arms, each rc read bare from `p0-authz-invariant.sh`:**

| arm | knob | rc | line quoted |
| --- | --- | --- | --- |
| census | `ARM=census` | 0 | `OK: no unswept newcomer WITHIN THIS ARM'S DOMAIN` (domain: prosecdef bool · prosecdef set-returning+reachable · public INVOKER plpgsql · all RLS policies) |
| hat | `ARM=hat` | 0 | `self-test: 7/7 OK` · `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` |
| floor | `ARM=floor` | 0 | `OK: every never-called door is on the floor allowlist.` · `OK: every floor-allowlist entry resolves to a live door.` |
| wrapper | `FROMFINDINGS=1 ARM=wrapper` | 0 | `ARM 5: invoker-wrapper BLIND ⊆ allowlist` · `BLIND set size: 41` · `OK: every BLIND wrapper is on the allowlist.` |

Run against the catalog the backend's second fresh reset left (the pgTAP suite rolls every file back).
⚠ These arms measure the catalog, and this diff changes no catalog object — a green here is the
expected no-op, quoted because the gate requires the arms to be RUN, not because it could have moved.

**AC-1 deviation RULED: accepted.** 421 does not splice `419 § 0`'s domain block; it writes its own
predicate and asserts the partition (`§ 0c`: 890 = 861 + 29 + 0 undeclared). Reason: gate 18 compares
419's block byte-for-byte with the generator's, so a splice would have made 421 a third copy of text the
generator owns and gate 18 does not watch — a hand-written copy of production text (LEARN-024 shape).
The partition assertion is what the splice was FOR. The AC text in the hub now says so.

**Step-1 dead end, for the next reader.** The hub predicted the deriver's exit 1 (FINDING — NO DOORS)
from the two predecessor units; both of those carried a migration. A diff with no migration is exit 3,
a different claim with a different remedy (none), and the prediction was wrong at the grain of "which
exit", not "does a sweep run".

**Follow-ups filed** (register, one entry each): 421's split figures are hand literals with no
generator behind them; the undeclared-`search_path` class now has a live enforcer waiting on an
unbuilt ruling; `supabase test db` leaves no `pgtap` installed, so a bare psql loop emits no TAP.

**Step 2 (tester) — put to the PO.** The diff has no runtime surface: no migration, no `src/`, no
policy. The comparable predecessor ran `npm run e2e:prod` because it shipped a migration that altered
four runtime functions. Whether the mandatory full-suite run is owed here is the PO's call; it is
asked, not skipped.

### 2026-09-12 — step 2 RULED N/A by the PO; QA review spawned (lead)

**The ruling (PO, 2026-09-12), offered three ways and chosen as the first:** *rule step 2 not applicable
and go to QA*. Grounds put to the PO and accepted: the diff (`6fd0bfdb..HEAD`) carries no migration, no
`src/` change and no policy — one new pgTAP file plus five comment/doc carriers — so `npm run e2e:prod`
would exercise nothing this diff touches, and a green from it would be a gate whose fixture cannot reach
the failing state. The predecessor `DEFINER-TEMP-TABLE-CONVERGENCE` ran it because its migration
altered four runtime functions. Rejected alternatives: run `e2e:prod` anyway; tester probes `421` as a
black box. ⛔ This is a ruling about THIS diff's surface, not a precedent that pgTAP-only units skip step
2 — the next one re-derives the claim from its own `git diff --stat`.

**Step 3 spawned:** `qa` (read-only on code) writes `docs/reviews/definer-qualified-body-gate-review.md`.

### 2026-09-12 — QA r1 MINORs corrected in place (backend)

All three MINORs from `docs/reviews/definer-qualified-body-gate-review.md` corrected; no other
behaviour in `421` changed. ⚠ The review's instrument warning was obeyed literally: every regex
figure below was earned from a byte-exact SQL file `docker cp`'d into
`supabase_db_azkbbhskturikxpgmafq` (`MSYS_NO_PATHCONV=1`, or Git Bash rewrites the container path),
never through a shell heredoc — and the probe's expression was compared to the tracked file's
**mechanically** (indentation and the `m.`/`r.`/`t.` alias stripped, then string equality), not by
eye: `SCRUB: IDENTICAL`, `EXCLUSION: IDENTICAL`. A probe that has drifted from its subject measures
the probe.

**MINOR-1 — the exclusion gains a right-hand bound and is restricted to executable text.** The
match now runs over a new `v421_plpgsql_raw.exec_src` column — `prosrc` with `/* */` block comments,
then `--` line comments, then single-quoted string literals each replaced by a SPACE — and the
interpolated relation name is bounded `\mcreate…\s+<escaped name>\M`. Measured on the FINAL
expression against the r1 one, same file, same ten cases:

```
label                                                     | excused_final | excused_r1_old
A1 EXACT      creates _x  | finding _x                    | t             | t   (legitimate excuse kept)
A2 PREFIX     creates _xy | finding _x                    | f             | t   <-- over-match closed
A3 PREFIX     creates abc | finding ab                    | f             | t   <-- over-match closed
A4 SUFFIX     creates y_x | finding _x                    | f             | f
B1 LINECMT    -- create temp table foo | finding foo      | f             | t   <-- over-match closed
B2 STRINGLIT  v := 'create temp table foo' | finding foo  | f             | t   <-- over-match closed
B3 BLOCKCMT   /* create temp table foo */ | finding foo   | f             | t   <-- over-match closed
C1 METACHAR   creates zzz | finding .*                    | f             | f   (the escape still works)
D1 IFNOTEXIST creates if not exists _x | finding _x       | t             | t   (legitimate excuse kept)
D2 TEMPORARY  creates temporary _x | finding _x           | t             | t   (legitimate excuse kept)
```

⚠ The five `t → f` rows are the corrections; the five unchanged rows are the discrimination half —
without them a chain that simply never matched would read the same. The three shapes the FINAL
expression still cannot see (a dollar-quoted string, a nested `/* /* */ */`, an unbalanced
apostrophe) all err toward KEEPING a finding, and the header now says so as a bound rather than
leaving the old *"it excuses nothing else"* standing as a claim the regex did not deliver.

**The two new controls were proven able to red, one property each — the green first run is not the
evidence.** `421` passed on its first run after the fix, which for a new assertion is a finding and
not a result, so each was driven by a single-token mutation of the tracked file into a scratchpad
copy (the tracked file never edited; `git status --porcelain` clean between runs):

| Mutant | One-token change | Red | Verbatim |
|---|---|---|---|
| M1 | `r.exec_src` → `r.src` (keeps `\m`/`\M`) | **§ 3g only**, 1/18 | `have: _cmt=EXCLUDED \| _lit=EXCLUDED` · `want: _cmt=KEPT \| _lit=KEPT` |
| M2 | drop `\|\| '\M'` (keeps `exec_src`) | **§ 3f only**, 1/18 | `have: _x=EXCLUDED \| _xy=EXCLUDED` · `want: _x=KEPT \| _xy=EXCLUDED` |

Each mutant reds exactly ONE assertion, and not the other — so `§ 3f` is keyed to the anchor and
`§ 3g` to the scrub, rather than the pair jointly covering "something about the exclusion".

⛔ **A fixture trap the first draft of both plants walked into.** Parse analysis stops at the FIRST
unresolved name in a statement, so `return (select … from _cmt) + (select … from _lit);` would have
reported `_cmt` only and the `_lit` half of `§ 3g` would have been unreachable — a control whose
fixture cannot reach the state it claims to measure. Both plants now give every unqualified
reference its own statement, and the file says why.

**MINOR-2 — the certifying control no longer uses a looser matcher than the thing it certifies.**
`f.message like '%"' || r.relname || '"%'` → `position('"' || r.relname || '"' in f.message) > 0`,
in `§ 3d` and in both new assertions. The QA probe, re-run on the final expression:

```
like_matches_wrong_row | position_matches_wrong_row | position_matches_right_row
 t                     | f                          | t
```

i.e. `'relation "ax" does not exist' LIKE '%"_x"%'` is still **true** (a leading `_` is a LIKE
wildcard, and every relation name this file handles starts with one) while `position()` is false on
that row and true on the real one.

**MINOR-3 — both carriers now state both bounds.** `scripts/gen-definer-search-path-freeze.mjs`'s
header and `419`'s header each gain the temp-table exclusion beside the `execute` bound, naming
`421 § 3d`/`§ 3f`/`§ 3g` as its holders. ⛔ `.claude/rules/migrations-forward-only.md` deliberately
untouched (2043/2048 bytes, as the review ruled).

**`419` is comment-only, verified mechanically.** `git diff -- supabase/tests/419_…sql | grep -E
'^[+-]' | grep -v '^[+-][+-]' | grep -v '^[+-]-- '` → **0 lines**, so the assertions and the `§ 0`
splice gate 18 reads byte-for-byte are unchanged. ⚠ The task brief's shorter form of that command
(`git diff … | grep -v '^[+-]-- '`) cannot return nothing for any non-empty diff — it still prints
`diff --git`, `+++`, `@@` and every context line — so the review's three-stage form is the one that
carries the claim; both were run and are quoted here rather than the shorter one being reported as
having passed.

**Witnesses (this round, all re-earned on the final bytes).**

| What | Command | Result |
|---|---|---|
| `421` | `supabase test db supabase/tests/00_setup.sql supabase/tests/421_definer_qualified_body.sql` | `All tests successful.` · `Files=2, Tests=19` · `Result: PASS` |
| `419` unbroken by its comment edit | same runner, `419` | `All tests successful.` · `Files=2, Tests=11` · `Result: PASS` |
| plan / RUN SHAPE in step | 17 `select is(` + 1 `select ok(` counted; header line rewritten | `plan(18)`, `RUN SHAPE: Files=2, Tests=19` |
| no assertion inside a savepoint | line map of `savepoint` / `rollback to savepoint` / `select is\|ok` | windows `282–305` and `497–518`; all 18 assertions outside both |
| full chain | `npm run lint` | **rc 0**, 18 gate invocations; gate 18 `--self-test: OK (17 cases)` · `in sync (861 … baseline main (6fd0bfdb43bb))` |
| live state | `npm run lint:progress` | **rc 0** |

⛔ **Not re-run, and not claimed:** the full `npm run test:db` on a fresh `supabase db reset`
(`Files=270, Tests=9062`). The review's closing note says the full suite need not be re-run because
none of the three MINORs touches `plan()` — that premise no longer holds: this round takes `421`
from `plan(16)` to `plan(18)`, so the suite's total test count moves by 2 and the lead should treat
the step-1 full-suite witness as owed again rather than inherited.

⚠ **One review sentence became TRUE rather than needing an edit.** MINOR-1 cited the seam slice in
`docs/backend-state/authorization-and-audit.md` (*"⛔ It excuses nothing else, and the relation name
is regex-escaped…"*) as contradicted by the regex. With the anchor and the scrub in place that
sentence is now accurate, so the file is left unedited — recorded so the next reader does not read
its absence from this diff as an oversight.

### 2026-09-12 — full-suite witness re-earned after the MINOR corrections; QA r2 spawned (lead)

**Why owed:** the corrections moved `421` from `plan(16)` to `plan(18)`, so the `Files=270, Tests=9062`
witness is for other bytes. Fresh `supabase db reset --local` (`Finished supabase db reset on branch
definer-qualified-body-gate.`) then `npm run test:db` → **`All tests successful.` · `Files=270,
Tests=9064, 126 wallclock secs` · `Result: PASS`**, rc 0 read bare. The +2 is exactly the two new
assertions in `421` (`§ 3f` right-hand bound, `§ 3g` comment/string scrub).

**QA r2 spawned** to verify the three corrections against the r1 findings, read-only.

### 2026-09-12 — QA r2 MINOR-4 + NOTE-5 corrected in place, comment-only (backend)

**MINOR-4 — the header's gap list ruled the DOLLAR-QUOTE gap's direction backwards.** `421:88-92`
claimed *"ALL THREE OF ITS GAPS ERR TOWARD KEEPING A FINDING (over-report, the safe direction)"*.
QA measured that false for one of them (probe `G1`/`G2`, both `EXCLUDED`): prose inside `$q$…$q$`
or `$$…$$` survives the scrub, so a `create temp table foo` written there EXCUSES a real finding on
`foo` — MINOR-1's own defect one quoting syntax over, the UNSAFE direction. The header now splits
the list: nested `/* /* */ */` (`G3`), a `/*` inside a single-quoted literal (`G4`, a FOURTH gap the
old list omitted) and an unbalanced apostrophe swallow MORE and err safe; `E'…'` (`G5`) is no gap at
all; the dollar-quote gap errs UNSAFE and is **bounded, not fixed** — (a) `0 of the 29` bodies carry
a dollar-quote tag, (b) `§ 1b` pins the RAW pre-exclusion relname set, so an arrival reds there. The
header also states why **no stripper is added** (QA recommends against it): an arbitrary `$tag$` is
a LEXER, not a fourth `regexp_replace`, and a wrong one blinds in the SAME unsafe direction while
adding a gap no control names.

**The bound was re-measured, not read off the review.** Over 421's own domain predicate on the live
catalog (`app`/`public`/`authz` `prosecdef`, `sp = '""'`): `empty_total 29 | with_dollar_quote 0 |
with_block_comment 0 | with_line_comment 18` (`src ~ '\$[A-Za-z_]*\$'`). Read-only `psql`, nothing
created, stack left as found.

**Three sibling over-claims inside `421` carried the same wrong direction and were qualified too** —
`:200` (*"its three gaps and why every one of them errs toward KEEPING a finding"*), `:221` (the
exclusion's *"a comment or a string literal"*) and `:376-377` (the text plant's *"prose in a body
excuses nothing"*, which is exactly what dollar-quoted prose disproves). A corrected header beside
three uncorrected paraphrases of the old claim would have left the false sentence readable in the
same file.

**MINOR-3's two carriers narrowed.** `scripts/gen-definer-search-path-freeze.mjs` and `419`'s header
both said *"a comment or a string literal"* — and a dollar-quoted literal IS a string literal in
SQL. Both now read *"a comment or a SINGLE-QUOTED string literal (dollar-quoted text is NOT
scrubbed — 421's header states that bound)"*.

**NOTE-5 — the seam credits the bound to the escape alone.**
`docs/backend-state/authorization-and-audit.md` (dated slice, the `42P01`-exclusion bullet) now names
all three mechanisms — the regex escape, the `\m`…`\M` anchor and the executable-text scrub — plus
the dollar-quote gap and its two bounds. ⛔ The `## Current state` block was NOT touched: it stays at
**98 lines** (gate 16 headroom line: `authorization-and-audit.md (98, 2 left)`).

**Comment-only, verified mechanically.**

| Claim | Command | Result |
|---|---|---|
| `421` changed in comment lines only | `git diff HEAD -- supabase/tests/421_definer_qualified_body.sql \| grep -E '^[+-]' \| grep -v '^[+-][+-]' \| grep -v '^[+-]\s*--'` | **0** (`git diff --stat` → `54 ++++-------`, `40 insertions(+), 14 deletions(-)`) |
| `419` assertion-unchanged since the phase base | `git diff 6fd0bfdb..HEAD -- supabase/tests/419_definer_search_path_freeze.sql \| grep -E '^[+-]' \| grep -v '^[+-][+-]' \| grep -v '^[+-]-- '` | **0** (same command against the working tree, `git diff 6fd0bfdb -- …`, also **0**) |
| no assertion, `plan()`, view or expression moved | the two greps above over the whole diff | 4 files, **+53 / −19**, every one a comment line |

**Witnesses (this round).**

| What | Command | Result |
|---|---|---|
| `421` still green | `supabase test db supabase/tests/00_setup.sql supabase/tests/421_definer_qualified_body.sql` | `All tests successful.` · **`Files=2, Tests=19`** · `Result: PASS` |
| seam shape | `npm run lint:backend-state` | `backend-state gate: OK — 16 seam file(s) + README.md, all routed, preamble identical, 1103 KB total, largest authorization-and-audit.md at 157.1 KB (warn 160 KB / cap 200 KB).` |
| full chain | `npm run lint` | **rc 0** (read bare, not through a pipe), 18 gate invocations; final line `gen-definer-search-path-freeze: in sync (861 frozen non-empty DEFINER paths; baseline 861 -> 861 (removed 0, added 0) [baseline main (6fd0bfdb43bb)])` |

⛔ **Not re-run, and not claimed:** the full `npm run test:db` on a fresh `supabase db reset`. This
round changes no `plan()` and no assertion text — the `Files=270, Tests=9064` witness above is for
bytes that differ only in comments — but it is the lead's call whether the gate record wants it
re-earned on the final bytes.

### 2026-09-12 — step 4 human approval; step 5 record (lead)

**Step 4.** Presented built / tests / QA verdict / open risks (the `execute` and dollar-quote bounds, the
hand-literal figures, the undeclared class's live enforcer, `plpgsql_check` unverified on the production
image). PO: *"Approved"* (option "Approved" — record step including the fast-forward of `main`).

**Step 5.** `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED` moved verbatim to
the archive with a RESOLVED block naming the four closing commits and the two stated bounds; ledger row
appended (Commit cell filled after the phase commit); hub → `complete`, its `## Current state` cut; no
handoff existed for this branch (`docs/handoffs/` holds only the pre-AE5 successors handoff, not this
unit's). Gate runs at this step are in the phase commit message and the ledger row.
