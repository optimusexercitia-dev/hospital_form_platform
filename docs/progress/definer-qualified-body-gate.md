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
