# DEFINER-SEARCH-PATH-NARROW-FIX — progress record

> Hub: [definer-search-path-narrow-fix.md](../features/definer-search-path-narrow-fix.md) ·
> branch `definer-search-path-narrow-fix`, cut from `main @ 6d7dd589` · owed by ADR 0208 D5 + D6 ·
> closes `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`.

## Session log

### 2026-09-11 — unit opened; the ordering ruled; the subject measured from the catalog (lead)

**Why this unit runs before `AE5-ROLE-CATALOG-COMPAT`** (PO ruling on the lead's recommendation,
recorded durably beside ADR 0207's `assume_role` consequence, and mirrored in the pre-AE5 handoff):
the compat unit's step 2 writes a NEW SECURITY DEFINER, which ADR 0208 D4 binds to
`search_path = ''`; nothing enforces that until the 419 ratchet exists. Merging the two units was
refused — different subjects, different close conditions, and the FUP's own ⛔ *"converging one door
is not closing the class"*.

**Measured live 2026-09-11** (`pg_proc`, local stack `supabase_db_azkbbhskturikxpgmafq`):

| function | `prosecdef` | `proconfig` |
| --- | --- | --- |
| `app.can_read_professional_profile(uuid,uuid)` | t | `search_path=app, public, pg_catalog` |
| `public.assume_role(platform_role)` | t | `search_path=app, public, pg_catalog` |
| `app.tenant_orphan_profiles()` | t | `search_path=app, public, pg_catalog` |
| `public.tenant_orphan_profiles()` | t | `search_path=public, app, pg_catalog` |

Non-empty-path `prosecdef` population in `app`/`public`/`authz`: **867** (= 890 − 23 empty-form,
reproducing the FUP's five-value table). Next free pgTAP number **419** confirmed free (418 is the
tail). `413:186-199` pins BOTH `app.current_professional_read_organizations` and
`app.can_read_professional_profile` on the three-schema string by name; only the second moves here.

**Coverage of the four temp-table DEFINERs before this unit** (Explore, file:line in the agent's
report, summarized): `copy_version_children` — pgTAP 271/274/277 + E2E purge helper;
`clone_framework` — pgTAP 280 + E2E phase16 spec; `copy_response_answers` — ONE mutation note in 276,
no direct call; ⭐ `copy_template_version_children` — **zero** pgTAP, zero TS/E2E. That last one is
the gap in D6's "tested first" precondition and needs a fixture.

`.claude/rules/` holds no file naming `search_path` or `SECURITY DEFINER` (12 files grepped) — the
D5 hint does not exist yet.

Doc gates after the two ruling edits: `lint:progress` rc 0 · `lint:registers` rc 0 ·
`lint:adr-index` rc 0 (next free ADR **0210**) · `lint:mojibake` rc 0.

### 2026-09-11 — AC-1…AC-6 built red-first; the four verdicts MEASURED; one unenumerated control found (backend)

**Red-first, witnessed.** `419` was written and run against a deliberately EMPTY artifact stub before
the generator existed: **§ 0c, § 0d, § 1a, § 1b, § 1c, § 1d all RED** (`§ 1a` naming 867 offenders
starting `app._audit_access_authorized(...)`), `§ 0a` and `§ 0b` green — ⚠ **green on their first run,
declared**: they are instrument guards (the domain covers all three schemas; `authz` is `0 of 10`),
not ratchet cells, and green is their correct state today exactly as `414 § 0a` is. The `413` pin was
flipped and observed **RED alone** (`ok=28 notok=1`, `have: search_path=app, public, pg_catalog`)
BEFORE the migration, then green after.

⭐ **A real defect found by the red-first run itself:** `419 § 1e` used
`string_agg(distinct sig order by sig collate "C")`, which Postgres rejects outright — and because
the assertion sat inside a savepoint, the following `rollback to savepoint` **RECOVERED** the error:
the file reported 9 tests against a plan of 10 with every other verdict green. It was visible only by
counting emitted TAP lines. `distinct` removed (signatures are unique: 890 of 890).

⚠ **And the first full-suite run was read wrong before it was read right.** `npm run test:db` printed
`Result: FAIL` / `error running container: exit 1` while the background task reported **exit code 0** —
the `;` chain after the redirect made `tail` the last command, so the code surfaced was `tail`'s. The
verdict was taken from the printed summary, not the status; the re-run writes `TESTDB_RC=` into the
output file instead.

**AC-2 — the convergence, measured not read.** Both bodies re-verified fully qualified from the live
catalog, then ALTERed to the empty form and CALLED inside a ROLLED-BACK transaction:

| | before | after |
| --- | --- | --- |
| `public.tenant_orphan_profiles()` | rows=1 | rows=1, symmetric diff **0** |
| `app.can_read_professional_profile(uuid,uuid)` | 36 pairs, 6 true | 6 true, **0 disagreements** |

⭐ The wrapper's fixture was CONSTRUCTED to reach a non-empty result (one affiliation voided in the
same transaction) — a 0-rows/0-rows comparison would have been satisfied by a function that had
stopped working. The door's 36 pairs carry BOTH polarities (6 true / 30 false). Applied as
`20261003007410`; catalog after: the two converged, `app.tenant_orphan_profiles` and
`app.current_professional_read_organizations` untouched on the three-schema string. Freeze
regenerated **867 → 865**, `removed 2, added 0` — the two converged names, a pure deletion.

⛔ **AC-2's scope was INCOMPLETE as briefed, and the suite found it.** The plan and the handoff named
`413` as "the pin that moves". It is not the only control reading that constant:
`409_ae49_d6_rekey_differential.sql § 6.1` counted **3** `app` authorizers carrying
`search_path=app, public, pg_catalog`, and `app.can_read_professional_profile` is one of them — so the
convergence took it to 2 and reded the suite. ⛔ **The obvious fix (3 → 2) was REFUSED**: it keeps the
assertion green by dropping the third door out of the measurement entirely, saying nothing about the
one that moved and noticing nothing if it later lost `prosecdef`. Re-shaped into a NAMED PER-FUNCTION
VALUE LIST carrying `prosecdef` IN the value — which is the idiom **§ 5.5 eleven lines above it
already argues for** (*"a NAMED LIST, not a count … a swap that a count could not see"*). Lesson
applied after the fact: *a change that flattens a curve invalidates every control READING it —
enumerate the controls, never recall them.* The enumeration was then run: `grep` over all of
`supabase/tests` plus `scripts/`, `src/`, `e2e/` and `docs/backend-state/`; `409` was the only
affected reader (the `like '%search_path%'` forms still match the empty string, and the other
value-pins name other doors).

**AC-3 — the four temp-table DEFINERs, per-function verdicts (pgTAP `420`).**

| function | today | under the empty path | verdict |
| --- | --- | --- | --- |
| `app.copy_version_children(uuid,uuid)` | OK, items=6 sections=1 | OK, items=6 sections=1 | **free** |
| `app.copy_template_version_children(uuid,uuid)` | OK, phases=2 | OK, phases=2 | **free** |
| `app.copy_response_answers(uuid,uuid)` | OK, answers=4 selopts=5 | OK, answers=4 selopts=5 | **free** |
| `public.clone_framework(uuid,uuid)` | OK, standards=2 rewired=1 | OK, standards=2 rewired=1 | **free** |

⭐ **The prediction going in was the opposite, and the MECHANISM is the finding.** Each body creates a
temp table and then references it UNQUALIFIED. Postgres searches `pg_temp` **implicitly and FIRST**
for relation names whenever it is not listed explicitly, so the empty path does not remove the
temp schema from relation resolution — it removes `app` and `public`. That is the SAME mechanism ADR
0208 D5 quotes as the reason to prefer the empty form (a temp object can precede the declared schemas
and shadow an unqualified relation): here it is what makes these four survive; in a body naming a
PERSISTENT relation unqualified it is the hijack. ⛔ So "free" is a statement about these four bodies,
never a general one.

⚠ **Four "OK"s are also what an instrument that cannot fail returns**, so `420 § 6` plants a DEFINER
whose body reads `from profiles` unqualified: it works on the three-schema path (§ 6a) and reds with
**42P01** under the identical ALTER (§ 6b). ⛔ An `OK` at § 6b reads the four verdicts as VOID.
Every under-empty-path expectation also carries the function's live `proconfig`, so a mutation that
did not apply cannot report green. `420 § 5` proves all four restored; `§ 5b` pins that all four are
still `prosecdef` on a non-empty path and therefore still members of `419`'s frozen set.

⛔ **THREE HARNESS DEFECTS were found by insisting on effects rather than "it did not throw"**, each
of which would have produced a confident false verdict: (1) the TODAY call contaminated the
under-empty-path call — the second hit a unique violation the first had created, so every probe now
sits in its OWN savepoint; (2) `public.clone_framework` denied **42501 before reaching its temp
table** (no null-actor tolerance, unlike its three siblings) — the CALLER was fixed with a seated
`staff_admin` hat via `test_helpers.claims_for`, never the expectation, because an earlier guard
firing leaves the later code untested; (3) the clone collided with its own source on
`(key, owner_commission_id)` — the fixture source is now a GLOBAL framework, which is also the only
shape `clone_framework`'s own cross-commission guard admits. ⚠ A bare JWT `sub` was NOT enough to seat
the actor: `active_role` must be in the claims, which is why `test_helpers.claims_for(uuid, boolean,
text)` is used and not a hand-built claims object.

⭐ **FOLLOW-UP CANDIDATE (lead to register).** All four being free means a convergence of the four is
now a *cheap* change that nobody has ruled. ⛔ It is explicitly NOT performed here: it would move the
`419` artifact by more than the two AC-2 names, and D6 ordered the testing, not the conversion.
`app.copy_template_version_children` also gained its FIRST direct test of any kind in `420 § 2a` —
it had zero pgTAP and zero TS/E2E coverage before this unit.

**AC-4 — the D5 hint, per the lead's ruling (exit c).** ONE line appended to
`.claude/rules/migrations-forward-only.md`, already `supabase/migrations/**`-scoped and `broad:`-
declared. File **1843 → 1997 bytes** against `MAX_RULE_BYTES = 2048`; gate 8 green, still 12 files.
⛔ **The dedicated file is DEFERRED to a PO ruling on the cap, registered here rather than
remembered:** `.claude/rules/` holds **12 of a `MAX_RULES = 12` cap**, so a 13th file is a hard red on
gate 8; `migrations-forward-only.md` had **205 bytes** of headroom, which is why the hint is one line
and not a section. ⛔ Retiring a rule and raising the cap were both refused as separate subjects.

**AC-5 — open half 1, PROPOSED, PO to rule.** *A DEFINER carrying no `search_path` at all
(`414 § 0b`'s 890/890) is a strictly worse member of the same class than a non-empty one, and it is
invisible to both instruments: `414 § 1` cannot tokenize a NULL and `419`'s frozen set is keyed on
non-empty paths. The proposed disposition is therefore not a new gate but a statement of what happens
when the existing one reds: an undeclared DEFINER is a **defect to converge to the empty form**, never
a member to admit into any frozen set, and neither `414` nor `419` may be widened to accept it.
`414 § 0b` already reds the day the count moves; `419` adds nothing there by design, because a frozen
set that admitted NULL paths would make its own subset arm ambiguous about which half moved.* ⛔ No
code. The follow-up register line is the lead's to write.

**AC-6.** `npm run gen:types` → **no diff**, as predicted: `ALTER FUNCTION … SET search_path` changes
neither signature nor return type. Backend-state slice appended to
`docs/backend-state/authorization-and-audit.md` (§ The non-empty DEFINER `search_path` population is
FROZEN) and its `## Current state` REPLACED — ⚠ the first replacement ran the block to **113 lines**
against a ratchet of 100; compressed to fit by pointing at the frozen slice, ⛔ not by raising the
ratchet and ⛔ not by cutting a bound (the two-arm partition, "gate 18 never opens a database",
"measured free and NOT converged" and both PO-to-rule items all survive in the block).

**Gate 18 is new** (`npm run lint:definer-freeze`, appended to the chain — positions are append-only,
so no by-number reference moves) with its row in `docs/lint-gates.md`. Its `--check` opens no
database, by gate 15/17's doctrine; the shrink-only arm resolves the artifact's git baseline and
currently reports **GENESIS — `[baseline main (6d7dd589ae24)]`** (the artifact does not exist at the
branch point yet), which is printed, not silent — the checker itself is proven able to fail by a
17-case `--self-test` including `shrink-grew` and a baseline that parsed to zero rows. ⛔ Exit 2 =
UNPROVEN is a red in the chain, never a pass. ⚠ The baseline preference is **local `main` first,
`origin/main` second**, and that order is deliberate: this repo routinely leaves `main` unpushed
(the phase-ledger commits say so), so `origin/main`'s merge-base is many commits behind and yields an
older, LARGER frozen set — against which a set that had grown since could still pass as a subset.
`origin/main` remains the fallback for a fresh clone with no local branch.

### 2026-09-11 — gate block (backend)

⛔ **AN EARLIER arm1/arm2 PAIR WAS OBSERVED, THEN FOUND UNTRACEABLE, AND IS DISCARDED.** A watcher
armed on the two arms' output files fired with `ARM1_RC=0 / SWEPT: 1 COVERED: 1 BLIND: 0 ERROR: 0`
and an identical pair for arm 2. ⚠ **Those four numbers are not the rows below and were not used.**
When the files were re-read minutes later to quote them, `arm2.txt` **did not exist** and `arm1.txt`
ended mid-run at `--- preflight: capturing GREEN baseline ---` with no `ARM._RC=` line and no
verdict, while `/tmp/authz-audit/_mut.sql` carried a timestamp one minute later than that read and
`pg_stat_activity` showed the harness still holding an ACTIVE backend — i.e. the run those numbers
claimed to summarise had **not finished**. The session scratchpad is shared between the lead and this
teammate, which explains foreign files in it but ⛔ **not** a verdict for a run still in flight; the
lead confirmed it ran neither arm and touched no database. ⛔ **The mechanism was NOT resolved**, and
that is stated rather than guessed at. The completed run later produced the same verdicts, which is
agreement and ⛔ **not** retroactive provenance for the discarded pair.

⭐ **The rule applied: a verdict is quoted from an artifact you can still read, or it is not quoted.**
Both runs were re-read to completion and COPIED, at the moment they landed, into a repo-local
directory excluded through `.git/info/exclude` (⛔ never committed, and never `.gitignore`, which
would itself be a tracked change) — artifacts renamed BEFORE anything could re-run over them. Every
row below is read from that copy.

```
ARM=census                                          rc 0   INVARIANT HOLDS — live authz gates 581 / gates carrying a verdict 608
ARM=hat                                             rc 0   INVARIANT HOLDS — 4 finding(s), all reasoned-allowlisted
ARM=floor                                           rc 0   INVARIANT HOLDS — 63 never-called doors, every one on the floor allowlist
FROMFINDINGS=1 ARM=wrapper                          rc 0   INVARIANT HOLDS — BLIND set 41, every BLIND wrapper on the allowlist
authz-setvalued-targeted-cases.sh                   rc 0
git diff --stat -- docs/reviews/authz-door-audit-findings.md   EMPTY (after all four arms)
SELFTEST=1 bash scripts/door-sweep-cases.sh         rc 0   PASS 46 · FAIL 0 · SKIPPED 0
bash --version                                      GNU bash, version 5.2.37(1)-release (x86_64-pc-msys)
bash scripts/door-sweep-cases.sh 6d7dd589           rc 1   FINDING (1) — 0 doors resolved; RULED below, case list set by hand
door sweep · PREDICATE arm  (CASES=…)               rc 0   SWEPT 1 · COVERED 1 · BLIND 0 · NOTICED 0 · ERROR 0 — RESULT: CLEAN
door sweep · POLICY arm     (same invocation)       rc 0   0 selected of 226 — this migration creates and alters no policy
  ⛔ second invocation, FROMFINDINGS=1 CASES=…       rc 0   NOT a second arm — byte-identical to the first; see the finding below
  preflight, both runs                                     baseline OK: Result: PASS, Files=269, Tests=9048  [⛔ NOT updated: this is what the sweep CAPTURED then]
  ARM-DOMAIN                                               predicate=1/127 policy=0/226 out-of-domain-bool=35
  resets                                                   resets=0 (RESET_EVERY=20 — SUPPRESSED on a SUBSET run)
  committed findings md                                    VERIFIED unchanged (cksum) — the subset run wrote only to scratch
npm run lint (18 gates, incl. the new lint:definer-freeze)  rc 0
npm run typecheck                                   rc 0
npm run test (vitest)                               rc 0   2091 passed
npm run test:db (on a fresh supabase db reset --local)      rc 0   Files=269, Tests=9050, Result: PASS  [re-run after the QA r1 fix pass; TESTDB_RC=0 read from the file]
node scripts/gen-definer-search-path-freeze.mjs --check     rc 0   in sync (865 frozen non-empty DEFINER paths)
npm run gen:types                                   rc 0   no diff
```

The deriver's three self-test GROUP lines: `deriver: scenarios 20 (pass 20 · fail 0 · skipped 0)` ·
`merge helper: scenarios 18 (pass 18 · fail 0 · skipped 0)` ·
`audit startup capture: scenarios 8 (pass 8 · fail 0 · skipped 0)`.

The freeze artifact's count, from the gate's own line rather than a hand count:
`gen-definer-search-path-freeze: in sync (865 frozen non-empty DEFINER paths; GENESIS — the artifact
does not exist at the baseline; nothing to ratchet against yet. [baseline main (6d7dd589ae24)])`.
Its anchor reads `rows=865 sha256=8ee59a19… md5=915172dd…`, and the file holds 865 data rows.

**The derivation's exit 1, RULED (PO ruling, quoted verbatim):**

> exit 1 = the migration touches two EXISTING prosecdef doors' security attributes and the
> derivation found no new gate; option (b)'s wording ('no prosecdef gate') does not describe this
> migration, so the case list is set by hand: `app.can_read_professional_profile` (predicate arm,
> 1/127 resolved). `public.tenant_orphan_profiles` is outside the predicate arm's catalog domain — a
> report helper, not an authorization predicate — which is a catalog-resolved fact, not a filter's
> silence.

`SCOPE:` line, quoted verbatim:

```
SCOPE: 1 file(s) — 0 committed (6d7dd589..HEAD), 0 worktree, 1 untracked | filter: none | derivation: catalog
```

⛔ **FINDING — "BOTH ARMS" WAS ONE ARM RUN TWICE, AND THE LABEL IS WHAT CONCEALED IT.** The two
invocations `CASES=…` and `FROMFINDINGS=1 CASES=…` produced outputs differing in **exactly one
line** — `ARM1_RC=0` against `ARM2_RC=0` — with identical `SELECTION-SOURCE`, identical
`ARM-DOMAIN`, identical verdicts. Measured cause: **`p0-authz-door-audit.sh` never reads
`FROMFINDINGS`** — `grep -cE '\$\{?FROMFINDINGS' ` over it returns **0**; the variable is consumed by
`p0-authz-invariant.sh` (`:107`, `:323`, `:800`), a different script, and the door audit only
mentions it in prose warning that *"a FROMFINDINGS arm does NOT cover this run"*. So the env var is
inert there and the second invocation re-ran the first.

⭐ **The door sweep's two arms are the PREDICATE arm and the POLICY arm, and ONE invocation runs
both** — which is why the run prints `ARM-DOMAIN predicate=1/127 policy=0/226`. The rows above are
labelled that way. ⚠ The policy arm selecting **0 of 226** is a correct verdict for this migration
(it creates and alters no policy), ⛔ not a skipped arm — and it is NOT evidence about the write
half, which belongs to `p0-authz-writepath-audit.sh`.

⚠ **This is not local to this unit.** `docs/progress/arm3-hat-term-fix.md:136-137` and `:423-424`
carry the same two rows with identical verdicts, which is the signature this finding predicts; that
record's "both arms" was, on this evidence, also one arm twice. ⛔ Not repaired here — a prior unit's
gate record is not this unit's to edit — and handed to the lead as a follow-up candidate.

⚠ **The four authz arms are `p0-authz-invariant.sh`'s, and `FROMFINDINGS` is ITS knob** — which is
the distinction the door-sweep finding above turns on: the same variable that is inert for
`p0-authz-door-audit.sh` is read at `p0-authz-invariant.sh:107`, `:323`, `:800`. ⛔ The wrapper row
above is therefore a REAL fourth arm; the discarded door-sweep "arm 2" was not.

⚠ **All four figures reproduce the prior unit's exactly** (581/608 · 4 · 63 · 41), which is the
expected result: none of them depends on anything this unit changed. ⭐ One comparison was made
rather than assumed — `420` now directly calls four DEFINERs, one of which
(`app.copy_template_version_children`) had NO coverage of any kind before, so the never-called floor
could legitimately have DROPPED. It did not, and the reason is that the floor counts
*authenticated-reachable* `prosecdef` doors: three of the four are `app` helpers outside that set and
`public.clone_framework` was already exercised by `280`. ⛔ The prediction was wrong and is recorded
as wrong rather than quietly dropped.

⚠ **The floor arm is NOT primed by this session's earlier runs**, a hazard worth discharging
explicitly given how many suites ran before it: `run_arm_floor` issues `pg_stat_reset()` and sets
`track_functions='all'` BEFORE its own full-suite pass, so its 63 is measured from zeroed counters,
not from residue.

### 2026-09-11 — QA round 1 addressed: 2 MAJOR, 4 MINOR, 1 NOTE (backend)

Review: [`definer-search-path-narrow-fix-review.md`](../reviews/definer-search-path-narrow-fix-review.md).
⭐ **Every finding is accepted as correct.** Two of them contradict sentences this unit committed, and
both contradictions were real.

**MAJOR-1 — D4 is a TWO-clause convention and only one clause is gated; four committed homes said
otherwise.** D4 is `set search_path = ''` **with schema-qualified object references**. Neither `419`
nor gate 18 reads a function BODY, so the qualified half is **UNGATED** — and the bound is not
cosmetic: under `''` `pg_temp` is still searched FIRST for relation names, and `anon`,
`authenticated`, `service_role` and `authenticator` all hold database TEMP (4 of 4, ADR 0208 D5's
census), so an unqualified relation inside an empty-path DEFINER stays shadowable by a temp object.
⛔ The empty path NARROWS that exposure; it does not close it. ⚠ **This unit had already MEASURED the
mechanism** — it is exactly why `420`'s four verdicts came back "free", and `420 § 6` reds a planted
unqualified-persistent DEFINER with 42P01 — and then wrote "enforcer = 419 + gate 18" anyway, which
claims the whole of D4. Corrected in all four homes (`.claude/rules/migrations-forward-only.md`, the
generator's *WHAT THIS GATE DOES NOT PROVE* block, `419`'s header beside its two existing bounds, and
the seam bullet), citing `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`.
The rule file went **1997 → 2040 bytes** against the 2048 cap: the line was SHORTENED to fit, ⛔ never
the truth, and gate 8 is green.

**MAJOR-2 — `docs/lint-gates.md` stated the baseline preference BACKWARDS**, in the document whose
job is explaining the gate: it read *"`merge-base HEAD origin/main`, then `main`"* while the code
reads `['main', 'origin/main']`. ⚠ The cause is traceable: the row was written BEFORE the order was
flipped in the code, and the flip was recorded in this record but not carried back to the doc — the
one-way half of a two-home change. Corrected, with the reason (this repo leaves `main` unpushed, so
`origin/main`'s merge-base is the looser baseline).

**MINOR-1 — the shrink arm is a BRANCH-POINT ratchet, and the header overclaimed.** The baseline is
`merge-base HEAD <ref>`, so for a growth committed **directly on `main`** the merge-base IS HEAD and
the artifact compares equal to itself: the arm is VACUOUS for that case. It holds on a unit branch
(the normal path, where the pre-merge gate runs) and for an uncommitted growth on `main`. ⭐ `419` is
the arm that catches the committed-on-`main` case, because it compares against the LIVE CATALOG and
does not consult git. Stated in the generator header and the gate-18 row.

**MINOR-2 — `867` was committed in two ungated homes by the same commit that made it `865`.** ⚠ The
subject follow-up carries a dated correction saying *"a live count in ungated prose is precisely what
rotted here, twice"*, and this unit reproduced it a third time. Both restated in `419:8`'s form:
865, with 867 as dated history naming the migration.

**MINOR-3 / MINOR-4 / NOTE-3 — three durability fixes in `420`, plan 13 → 15.**
- `§ 5c` (new) pins that each WRAPPER still routes its subject, read from `pg_get_functiondef`. §§ 1
  and 2 reach their subjects only through `clone_form_version` / `clone_template_version`; the
  `[cfg …]` witness proved the ALTER applied but not that the altered function was still **on the
  call path**, so an inlining would have left both arms green while measuring nothing.
- `§ 5d` (new) pins exactly one overload per name, and `pg_temp.cfg420` is re-keyed on the full
  signature via `::regprocedure` instead of a bare `proname`. ⛔ A scalar SQL function over a
  multi-row query silently returns the FIRST row, so an overload could have made the `[cfg …]`
  witness — the very thing proving each ALTER applied — read a DIFFERENT function and still report
  green.
- `420` gained the plan-mismatch note it lacked, and **both** files now carry the caveat NOTE-3 asked
  for: pgTAP's unwound internal counter is noise, but pg_prove's own **"Bad plan"** IS a failure and
  is the detector for the `§ 1e` defect shape (an assertion inside a savepoint that raised, with the
  rollback recovering the error). ⛔ Without that half, this note would teach a future reader to
  dismiss a genuine red.

Targeted re-run after the edits: `419` **10/10**, `420` **15/15**, 0 failures, and each file's plan
line matches the `ok` lines it emitted — the Bad-plan detector NOTE-3 names is itself green.

**Re-gate after the fix pass, every figure read from a file:** `npm run lint` **rc 0** ·
`lint:backend-state` **OK** · `--self-test` **rc 0** · `--check` **rc 0** ·
`supabase db reset --local` **RESET_RC=0** · `npm run test:db` **TESTDB_RC=0**, `Files=269,
Tests=9050, Result: PASS`. ⚠ **9048 → 9050 is the two assertions `§ 5c` and `§ 5d` add**, and the
gate block's test:db row carries the new figure. ⛔ The `preflight, both runs` row in that block
still reads 9048 and is deliberately NOT updated: it quotes what the door sweep's own preflight
CAPTURED at the time it ran, and rewriting a captured witness to match a later run would falsify it.
Two different numbers, two different moments, both labelled.

**2026-09-11 — QA r2 MINOR-r2-1 (pre-merge, comment-only).** `419`'s plan-mismatch note gave
`planned 10 tests but ran 7` as an EXPECTED example. ⛔ Measured over the full 269-file suite: `419`
emits **no** such diagnostic in any run, so the `7` was invented and the sentence pre-authorised
dismissing a signal this file never prints — the inversion the r1 fix's own *"do not generalise that
dismissal"* half exists to prevent. Replaced with the measured statement (`419` emits none; `420`
emits `planned 15 tests but ran 13` and is still reported `ok`); the ⛔ "Bad plan" half is kept
verbatim. Comment-only: `git diff` shows **7 insertions / 4 deletions, every changed line a `--`
comment**, 0 non-comment lines — no test re-run, and ⛔ the DB was not touched (`e2e:prod` holds the stack).

### 2026-09-11 — `e2e:prod` GREEN at `3cb82f1b`; QA r2 APPROVED; the unit is gated, awaiting human approval (lead)

**`npm run e2e:prod`** (lead, primary tree, stack released by `backend` after its fix-pass reset;
output in the git-excluded `.dsp-gate-evidence/e2e-prod.txt`, exit code captured into the file as
`E2E_RC=`): **`E2E_RC=0`** — `GATE SUMMARY: 1263 passed · 0 failed · 0 infra · 2 flaky · 0 did-not-run
· 21 batches`. Started at `a6c4c83e`; `3cb82f1b` landed mid-run and is comment-only in one pgTAP
file (`git diff -U0` non-comment changed lines = 0), so the bound is stated: no `src/`, policy, grant
or expected value moved between the run's start and the tip. ⚠ QA's vitest saw two catalog-reading
guards fail with "container not running" while this gate cycled the stack; re-read green — environmental.

**QA:** round 1 CHANGES REQUESTED (0 BLOCK · 2 MAJOR · 4 MINOR · 6 NOTE) → fixed at `a6c4c83e` →
round 2 **APPROVED** (0 · 0 · 1 MINOR carried · 4 NOTE); the carried MINOR-r2-1 applied at `3cb82f1b`.
NOTE-r2-2 (a third historical `867` in the generator's prose about the hand-list it replaces) is left
as history, named here rather than silently.

**Presented to the PO for step 4 (human approval):** the build, the gate rows above, the QA verdict,
and FOUR open rulings — AC-5's proposed disposition (FUP body, "PO to rule"); the door-sweep
deriver's exit 1 ruled by the lead (option (a), predicate arm by hand) — to ratify; the three
follow-ups this unit filed that name the PO as owner (four temp-table DEFINERs free to converge; the
D5 rule file deferred on the 12-file cap; D4's qualified-body clause ungated). The CLAUDE.md review
queue is non-empty (88 lines, per-clone) — Record-step item 7.

### 2026-09-11 — PO approval; Record step (lead)

**Approval and its SCOPE, written down:** the PO replied *"Approved"* to the step-4 presentation that
named four rulings. Read as: the unit approved; the door-sweep deriver exit-1 ruling (option (a),
predicate arm by hand) **ratified**; the AC-5 disposition **accepted as proposed** (an undeclared
`search_path` is a defect to converge, never a frozen-set member — landed in the FUP body's ✅ section,
the archive note and the seam's `## Current state`, not only here); ⛔ the two follow-ups that name
the PO as owner (four-DEFINER convergence; the D5 rule file on the 12-file cap) are **NOT** ruled by
that word and stay open. If the PO meant otherwise, the correction is one line in each.

**Record step, what moved where:** ledger row appended (Commit cell filled at the merge record) ·
`FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` entry moved VERBATIM open → archive with the closure
note; its body file given a ✅ section then FOLDED into the archive and deleted (gate 13 requires the body inline; two historical backtick citations of the old path stay as written, named in the ✅ section) · hub → `complete`, ACs
ticked (AC-5 ticked on the ruling), `## Current state` removed · seam `## Current state` sentence for
AC-5 replaced by `backend` at `d683a79a` (gate 16 refuses a date inside the block, so the PO date is
here and in the FUP, not there; 9 seam blocks sit within 8 lines of the 100-line ratchet) · no ADR
produced (ADR 0207 carries the appended ordering note) · review queue non-empty (88 lines) —
surfaced to the PO, not run. NOTE-r2-2 (a historical `867` in generator prose) left as history.
