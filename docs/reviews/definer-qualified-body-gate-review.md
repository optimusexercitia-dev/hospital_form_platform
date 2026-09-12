# DEFINER-QUALIFIED-BODY-GATE — QA review (r1)

> Unit hub: [definer-qualified-body-gate.md](../features/definer-qualified-body-gate.md) ·
> record: [definer-qualified-body-gate.md](../progress/definer-qualified-body-gate.md) ·
> branch `definer-qualified-body-gate`, base `main @ 6fd0bfdb`, reviewed range
> `6fd0bfdb..HEAD` (`803b2a70` · `8fa27d3c` · `1e0067ad` · `cb69621a` · `dfda3b79` · `2e45416e`),
> 10 files / +900 / −17. Reviewer: `qa`, 2026-09-12. Read-only on code, tests, scripts and every
> doc but this one; nothing outside this file was written and nothing was committed.

**Verdict: APPROVED**

Counts — **BLOCK 0 · MAJOR 0 · MINOR 3 · NOTE 4**. All eight ACs are met. I re-measured the
load-bearing claims against the live catalog and against mutated COPIES in my scratchpad rather
than reading them off the record; the tracked file was never edited. The three MINORs are all in
the same place — the exclusion's stated bound is slightly tighter than the regex delivers — and
none of them is live on today's population.

⛔ **The instrument that makes this gate work is also the thing that made my first three probes
lie.** Backslash-heavy SQL typed through a shell heredoc arrived at the server mangled
(`regexp_replace(nm,'([^[:alnum:]])','\\\1','g')` evaluated to `\1x` instead of `\_x`), and I read
that as a dead exclusion in the tracked file before catching it. Every regex result below was
re-earned from a byte-exact file `docker cp`'d into the container. The escape in `421:203` is
**correct**: `_copy_answer_map → \_copy\_answer\_map`, `a.b → a\.b`.

---

## 1. What I measured myself (not read off the record)

| Claim | How I checked it | Result |
|---|---|---|
| The domain figures `§ 0c` pins | `pg_proc ⋈ pg_namespace ⋈ pg_language`, live catalog, 421's own `sp` expression | ✅ `total=890`, `""`=29, non-empty=861, `<none>`=**0** |
| The arm split `§ 0d` pins | same query grouped by `lanname` over `sp='""'` | ✅ **18 plpgsql · 11 sql** |
| RUN SHAPE `Files=2, Tests=17` | `supabase test db …/00_setup.sql …/421_…sql` | ✅ `Files=2, Tests=17` · `All tests successful.` · `Result: PASS` (run twice) |
| `plan(16)` is exact | 15 `select is(` + 1 `select ok(` counted in the file; no *Bad plan* in the run | ✅ **16** |
| Every assertion sits OUTSIDE every savepoint | line-numbered grep of `savepoint` / `rollback to savepoint` / `select is\|ok` | ✅ savepoint windows `252–275` and `390–411`; no assertion inside either |
| The exclusion actually fires (not a dead predicate) | diagnostics inserted into a **copy**, run in the container | ✅ `raw_count=17` → `findings_count=0` |
| `§ 1b`'s five relation names | the raw view replayed live | ✅ exactly `_clone_item_map _clone_section_map _clone_standard_map _copy_answer_map _tpl_phase_map`, from 4 functions |
| Both trigger functions get a real `tgrelid` | `pg_trigger ⋈ pg_class` for the empty-path `returns trigger` members | ✅ `app.trg_attendee_roster → meeting_attendees` (18220), `app.trg_meetings_roster → meetings` (18491); **1 trigger row, 1 distinct relation each**, so the `limit 1` is not choosing |
| ⭐ `§ 0c`'s `<none>` term is NON-tautological | **mutation on a copy**: planted `public.zq421_undeclared()` (DEFINER, no `set search_path`) before `v421_domain` | ✅ **1 red** — `have: 891 = 862 non-empty (419) + 29 empty (421) \| 1 undeclared` |
| ⭐ The `-1 visited` sentinel is real | **mutation on a copy**: sql arm's `do $do$…$do$` block deleted whole | ✅ **1 red** — `have: -1 visited \| -1 findings`, exactly what `§ 2a`'s message predicts |
| The sql arm can bite for D4's reason | the unmutated run's log | ✅ `WARNING: 421 § 3e SQL CONTROL FIRED: public.z421_ctl_sql_altered() \| 42P01 \| relation "profiles" does not exist` |
| `check_function_bodies` is on (without it the sql arm is vacuous) | `show check_function_bodies` | ✅ `on` — and `§ 3e` is what would catch it if it were not |
| The extension leaves NOTHING behind | `pg_extension`, `pg_proc`, `pg_class` in `extensions`, after the file | ✅ `pg_extension_plpgsql_check=0`, `proc_named_plpgsql_check=0`, `extensions_schema_objs=0` |
| The population is intact after the file | 421's own `sp` expression, after the run | ✅ `empty_after=29 total_after=890`, `z421_leftovers=0` |
| `419` is comment-only | `git diff 6fd0bfdb..HEAD -- …419….sql \| grep -E '^[+-]' \| grep -v '^[+-][+-]' \| grep -v '^[+-]-- '` | ✅ **0 lines** — assertions and the `§ 0` splice byte-unchanged |
| `419`+setup really is `Files=2, Tests=11` (the RUN SHAPE convention the record cites) | `select plan(` in `419` and `00_setup.sql` | ✅ `plan(10)` + `plan(1)` |
| Rule file under cap | `wc -c .claude/rules/migrations-forward-only.md` | ✅ **2043** / 2048 |
| Gate 18 | inside the chain below | ✅ `--self-test: OK (17 cases)` · `in sync (861 frozen …) [baseline main (6fd0bfdb43bb)]` |
| Full chain | `npm run lint` | ✅ **rc 0**, 18 gate invocations, no FAIL/ERROR line |
| Registers | `npm run lint:registers` | ✅ rc 0 — `30 hubs, 28 records, 233 follow-ups …`; `build-features-index: OK (30 hubs; index in sync)` |
| Live state | `npm run lint:progress` | ✅ rc 0 |
| The diff really has no runtime surface (the PO's step-2 ground) | `git diff --stat 6fd0bfdb..HEAD -- supabase/migrations` and `-- src` | ✅ both **empty** |
| Working tree / stack left as found | `git status --porcelain`; `pg_extension` for `pgtap`+`plpgsql_check`; `z421%`/`zq421%`/`zprobe%` in `pg_proc` | ✅ clean · `ext=none` · `residue=0` |

⚠ I created `pgtap` to drive the two mutation copies through bare `psql` and **dropped it
afterwards** (no migration installs it — the only two matches in `supabase/migrations/` are prose).
Verified `ext=none` and a green unmutated `Files=2, Tests=17` as the last action.

---

## 2. AC-by-AC

### AC-1 — the file, and the ruled no-splice deviation · **MET**

`supabase/tests/421_definer_qualified_body.sql` exists; its domain is the empty-path DEFINER
population, written as 421's own predicate. The lead's ruling (record, 2026-09-12) that this is
**not** a splice of `419 § 0` is correct on its own terms and I re-derived the reason: gate 18
compares `419`'s block byte-for-byte with `scripts/definer-search-path-census.sql`, so a third copy
would be a hand-written copy of production text that no gate watches.

**The partition assertion is what the splice was for, and it works.** `421:153-160` asserts
`890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared` as one string. The first two figures
are complements and prove only arithmetic — the addendum in the record says so, and the `0
undeclared` term is the fix. I did not take that on trust: planting a DEFINER with no
`search_path` at all made `§ 0c` the **only** red, with

```
#         have: 891 = 862 non-empty (419) + 29 empty (421) | 1 undeclared
#         want: 890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared
```

so the class the message names (`414 § 0b`'s `<none>`) is genuinely gated, and it is gated in two
independent terms of the same string.

**RUN SHAPE is right.** `plan(16)` matches the 16 assertions I counted in the file, and
`Files=2, Tests=17` is what the runner printed — twice, including after all my probes.

### AC-2 — the plpgsql arm · **MET**

`421:181-189` calls `extensions.plpgsql_check_function_tb(m.oid, <tgrelid>, fatal_errors => false)`
through a **`left join lateral … on true`**, which is the right join: a member the checker clears
returns zero rows and a cross join would have dropped it, making `§ 1a`'s *"every member was
examined"* unanswerable. `§ 1a` counts `distinct sig` = 18. Nothing is double-counted where it
matters: the raw findings repeat per statement (17 rows for 5 relations), and `§ 1b` deliberately
pins `string_agg(distinct relname)` rather than the count — which is the right call, since the raw
count is the fragile pin.

Both trigger functions get a real relation, and each has exactly one `pg_trigger` row, so the
`limit 1` is not silently choosing between shapes.

The arm can fail for D4's reason on a **persistent** object: `§ 3a`'s plant reds `42P01` on
`public.profiles` and `§ 3c`'s reds `42883` on `is_admin()`. The `42883` plant is load-bearing —
the live catalog raises only `42P01`, so without it that half of every predicate in the file is
carried by no assertion.

### AC-3 — the sql arm · **MET**

`421:254-273` re-executes `pg_get_functiondef(oid)` per member inside `savepoint s421_sql_reemit`,
always rolled back. `§ 2a` reads `11 visited | 0 findings`; `§ 2b` proves all 11 definitions are
byte-identical to the pre-savepoint snapshot (`t421_sql_before` is materialised at `421:245`,
**before** the savepoint, which is what makes that comparison possible).

**The carry-out mechanism is sound and I proved its dead-block reading.** The sequences are created
and `setval`'d to 0 outside the savepoint, and the block writes `value + 1`, so a block that never
runs leaves `currval - 1 = -1`. Deleting the `do` block from a copy produced exactly
`have: -1 visited | -1 findings` — the "measurement did not happen" reading is real, not a
comment. `setval`'s non-transactionality is the correct channel here; the record's dead end (a temp
table cannot carry a result out of a savepoint) is right and worth the space it takes.

`§ 3e` proves the arm bites on the one shape that reaches production — created on `search_path =
public`, moved to `''` by `ALTER`, which never re-validates — and asserts *both* halves in one
string (`"" accepted by ALTER | 1 visited | 1 findings`), so a plant that never reached the empty
form cannot pass as a catch.

### AC-4 — controls, both arms · **MET**

Five plants, each pinned to its arm, each measured discriminating. None can pass vacuously: they
are `create function` (not `or replace`, not `if not exists`), so a failed creation aborts the
file, and `§ 3b` separately asserts that the clean twin was **examined** (one row returned) rather
than merely absent — the `419 § 1e` shape. `§ 5` asserts the restore and I confirmed
`z421_leftovers=0` in the catalog afterwards.

`§ 3d` is the right design: both halves of the exclusion in one string, because an exclusion that
matched nothing and one that matched everything each satisfy one half alone. See MINOR-2 for the
matcher it uses.

### AC-5 — the residual · **MET**

`§ 4` (`421:429-434`) asserts `v421_empty where src ~* '\mexecute\M'` is empty and the header states
WHY (dynamic SQL is opaque to both arms). The regex is right for the job — measured: it catches
`execute 'select 1'`, `EXECUTE FORMAT(…)` and `execute immediate` (all true), and correctly does
**not** fire on `executed` or on an identifier `do_execute()`. It also fires on the word inside a
comment, which is the safe direction and which `§ 4`'s own message already covers (*"must be
reasoned about, never absorbed"*).

I re-measured the population: `matches_execute=0` on both arms. Stated as a bound, not as coverage
— correct.

### AC-6 — the extension · **MET**

`421:112` creates `plpgsql_check` `with schema extensions` inside the file's `begin; … rollback;`.
`§ 0a` asserts availability **before** the create so a missing instrument reds with a diagnosis;
`§ 0b` reads `pg_extension` rather than trusting the DDL's quiet exit — which is the right paranoia,
because `if not exists` is silent in more than one way. No skip anywhere in the file.

Nothing survives: after the run, `pg_extension` holds no `plpgsql_check`, no `plpgsql_check%`
function exists in any schema, and the `extensions` schema holds no matching relation.

### AC-7 — the carriers · **MET** (see MINOR-3)

All five re-worded, and **none still says the body half is UNGATED**:

- `.claude/rules/migrations-forward-only.md:38-40` — *"419/gate 18 gate the PATH, pgTAP `421` the BODY (bound: `execute` opaque)"*. 2043 bytes.
- `scripts/gen-definer-search-path-freeze.mjs` header — names 421, both arms, the `ALTER`-never-revalidates reason, the `execute` bound, and ⭐ the partition that matters most for a *lint* gate: *"421 lives in `npm run test:db`, NOT in this chain … Its absence from a green `npm run lint` is not this gate's coverage."*
- `419`'s header — same content; **comment-only**, verified mechanically (0 non-comment diff lines).
- `docs/backend-state/authorization-and-audit.md` — `## Current state` bullet REPLACED (not appended), stamp bumped to 2026-09-12, a new dated slice at the bottom, and the *"Where the detail lives"* list extended. The slice's closing ⚠ bullet (*"What 421 does NOT claim"*) is the best paragraph in the diff: it says the file buys *"the next Phase Gate noticed"*, not *"the next commit refused"*.
- `docs/lint-gates.md` gate-18 paragraph — names 421, both arms, the population split, the `execute` bound, **and** the temp-table exclusion.

The follow-up name is kept everywhere and cited as `closed by 421`, never deleted.

### AC-8 — the gates · **MET**

`npm run lint` **rc 0** re-run by me, 18 gate invocations, gate 18 in sync at 861 against baseline
`main (6fd0bfdb43bb)`. The `test:db` witness (`Files=270, Tests=9062` PASS, re-earned on the final
bytes after the `§ 0c` tightening) is the lead's and I did not re-run the full suite; I did re-earn
421 itself twice. The door sweep's **exit 3 NOT-APPLICABLE** is correct and independently checkable
— `git diff --stat 6fd0bfdb..HEAD -- supabase/migrations` is empty. The record's honesty about the
hub having predicted exit 1 is the right note to leave.

---

## 3. Findings

### MINOR-1 — the temp-table exclusion has no RIGHT-hand boundary, so it excuses more than "its own relation"

`supabase/tests/421_definer_qualified_body.sql:200-203`:

```sql
   and not (r.sqlstate = '42P01'
            and r.relname is not null
            and r.src ~* ('create\s+temp(orary)?\s+table\s+(if\s+not\s+exists\s+)?'
                          || regexp_replace(r.relname, '([^[:alnum:]])', '\\\1', 'g')));
```

The escape is correct and does what the header claims (`.*` as a relation name does **not** match a
body creating `zzz`). But there is no `\M`/`\y` after the interpolated name and no restriction to
executable text, so the exclusion also fires when the created relation merely **starts with** the
finding's name, and when the `create temp table` text lives only in a comment or a string literal.
Measured on a byte-exact probe against the same expression:

```
A1 EXACT      body creates _x        , finding _x   -> true
A2 PREFIX     body creates _xy       , finding _x   -> true      <-- over-match
A3 PREFIX     body creates abc       , finding ab   -> true      <-- over-match
A4 SUFFIX     body creates y_x       , finding _x   -> false
B1 COMMENT    body: -- create temp table foo, finding foo -> true  <-- over-match
B2 STRINGLIT  body: v := 'create temp table foo'; finding foo -> true  <-- over-match
C1 METACHAR   body creates zzz       , finding .*   -> false     (the escape works)
```

This is the unsafe direction — a real unqualified reference to a persistent relation silently
excused — and it contradicts two committed sentences that assert the opposite:
`421:192-193` *"⛔ It excuses nothing else: not a different function's temp table, not a `create
table`, not a `42883`"*, and the seam slice's *"⛔ It excuses nothing else, and the relation name is
regex-escaped before interpolation so an identifier carrying a metacharacter cannot widen it"*
(`docs/backend-state/authorization-and-audit.md`, the new slice).

**Not live today**, which is why this is MINOR and not MAJOR: the five excused relations
(`_clone_item_map`, `_clone_section_map`, `_clone_standard_map`, `_copy_answer_map`,
`_tpl_phase_map`) have no prefix relation among them, none of the four bodies mentions a
`create temp table` in a comment or literal, and `§ 1b` pins that exact name set so the population
cannot drift here unnoticed.

Remedy (one line + one sentence): append `\M` after the escaped name, and replace *"It excuses
nothing else"* with what the predicate actually says — that it reads the whole `prosrc`, comments
and string literals included, and matches a `create temp table` whose name **begins with** the
finding's name unless bounded.

### MINOR-2 — the control that proves the exclusion's bound uses a LOOSER matcher than the exclusion

`supabase/tests/421_definer_qualified_body.sql:363-364`:

```sql
             case when exists (select 1 from t421_ctl_findings f
                                where f.sig = r.sig and f.message like '%"' || r.relname || '"%')
```

The relname goes into a **LIKE** pattern unescaped, where `_` is a single-character wildcard.
Measured: `'relation "ax" does not exist' like '%"_x"%'` → **true**. Every relation name this file
handles begins with `_`, so every one of them is a wildcard pattern in this matcher.

It cannot flip today's verdict — the only surviving finding message for
`z421_ctl_temp_plus_unqualified()` is `relation "profiles" does not exist`, which does not satisfy
`%"_x"%` — so `§ 3d` reads `_x=EXCLUDED | profiles=KEPT` for the right reason. But `§ 3d` is
precisely the control that certifies the exclusion is bounded, and it is itself less bounded than
the thing it certifies, in a file that goes to the trouble of regex-escaping two lines earlier.
Remedy: `like … escape` with an escaped relname, or `position('"'||r.relname||'"' in f.message) > 0`.

### MINOR-3 — two carriers name the `execute` bound but not the temp-table exclusion

`docs/lint-gates.md` and the seam slice both name the exclusion (*"a `42P01` excused only when the
SAME body creates that relation as a temp table"*). `scripts/gen-definer-search-path-freeze.mjs`'s
re-worded header and `supabase/tests/419_definer_search_path_freeze.sql`'s re-worded header name
only the `execute` residual, so a reader of either comes away with "the body half is gated, bounded
by dynamic SQL" and no idea that a whole class of `42P01` is excused by design. Both have room for
one clause. ⛔ **Not** a finding against `.claude/rules/migrations-forward-only.md` — at 2043/2048
bytes it has five bytes of headroom and the `execute` bound is the right one to spend them on.

---

## 4. Notes (no action required, recorded so they are not re-derived)

- **NOTE-1 — `prosqlbody` is a blind spot in `§ 4`, and it is empty today.** The residual reads
  `prosrc`. A PG14+ SQL-standard-body function (`begin atomic … end`) stores its body in
  `prosqlbody` and leaves `prosrc` effectively empty, so it would satisfy `§ 4` trivially. Measured
  over the 29: `sql_standard_body=0`, `empty_prosrc=0`. The direction is safe anyway (such a body is
  parse-analysed and dependency-tracked at creation, so it cannot carry an unresolved name), but one
  clause in the header would close the question for the next reader.
- **NOTE-2 — the `where m.lang = 'plpgsql'` filter sits at the same query level as the LATERAL.**
  Today's plan applies it before the lateral, which is why `plpgsql_check_function_tb` is never
  handed a `language sql` member. If a plan ever changed that, the file would **abort loudly**, not
  pass silently, so this is a fragility and not a hole.
- **NOTE-3 — the `\mexecute\M` residual fires on the word in a comment** (measured `true` on
  `-- we execute nothing here`). Over-report, safe direction, and `§ 4`'s message already tells the
  reader to reason about a name rather than absorb it.
- **NOTE-4 — for the lead at step 5, not a defect now.** The register entry
  `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED` still reads
  `**Status:** open` while five committed carrier texts already say `closed by 421`. That gap closes
  at the record step; it is called out here so it is not the thing that gets skipped.

---

## 5. Security / gate-integrity audit

- **Nothing reaches the catalog.** The extension, the five plants and both re-emission loops are all
  inside one `begin; … rollback;`. Measured after the run: no `plpgsql_check` in `pg_extension`, no
  `plpgsql_check%` function anywhere, no relation matching `%plpgsql%` in `extensions`, no `z421%`
  function, and the population back at exactly `29 / 890`. ⛔ No migration installs the extension,
  which was offered to the PO and declined — the file says so and the diff agrees (0 migrations).
- **No `CREATE OR REPLACE` survives.** `pg_get_functiondef` emits `CREATE OR REPLACE`, so the
  re-emission replaces in place and the savepoint rollback undoes it; `§ 2b` measures that against a
  snapshot taken before the savepoint rather than asserting it "by construction". Green.
- **No control can pass vacuously.** Every plant is a bare `create function`; a failure aborts the
  file. `§ 3b` asserts the negative control was examined. Three of the file's five red-paths were
  proven by the backend's mutation runs and two more by mine.
- **`419` is untouched where it matters** — 0 non-comment diff lines, so its assertions and the
  `§ 0` splice gate 18 reads byte-for-byte are unchanged, and gate 18 is green at 861.
- **The gate's own reach is stated honestly.** Both the generator header and the seam slice say 421
  is in `npm run test:db` and never in `npm run lint` — which is the exact "absence of a verdict is
  not absence of coverage" trap this program keeps hitting, pre-empted rather than survived.
- No RLS, no policy, no `SECURITY DEFINER` door, no `src/`, no secret and no PHI surface is touched
  by this diff.

---

## 6. Records

- Hub `## Current state`: **37 lines** (cap 60), five sections in the fixed order
  (Objective · Done since start · In progress · Next · Blockers), `**Updated:** 2026-09-12`.
- Record entry headings are non-decreasing: `2026-09-11`, `2026-09-11`, `2026-09-12`, `2026-09-12`.
  The midnight-crossing note and the deliberate `Updated:` bump against the task brief (gate 13
  demanded it) are both recorded rather than papered over — that is the right disposal.
- `npm run lint:registers` rc 0 (`30 hubs … 233 follow-ups`; features index in sync);
  `npm run lint:progress` rc 0. The re-claused FUP keeps its superseded *Closes when* text visible
  and carries a dated **Ruling:** line; the three new entries are well-formed and each names what
  would NOT close it.
- No new ADR, correctly: D4's verbatim ruling (`docs/decisions/0208-…`, the PO's own words) already
  states the two-clause convention, and D5 orders `419` for the path half and names nothing for the
  body half. An enforcer for a stated convention is a unit. No `Supersedes:`/`Amends:` label is owed.

---

## 7. What I could NOT verify (a work item, never a pass)

1. **The full `npm run test:db` suite on a fresh `supabase db reset`** (`Files=270, Tests=9062`). I
   ran `421` standalone twice and the full `npm run lint` chain, but I did not reset the local stack
   or re-run the 202-second suite. The lead's step-1 witness — re-earned on the final bytes after
   the `§ 0c` tightening, which is the right instinct — stands unchallenged by anything I measured.
2. **The door sweep and the four authz arms.** Not re-run. The sweep's exit-3 claim is checkable
   without running it and I checked it (`supabase/migrations` diff is empty); the four arms measure a
   catalog this diff does not change, which the record itself flags as an expected no-op.
3. **Whether `plpgsql_check` behaves identically on the production Postgres image.** `§ 0a` is the
   right guard (red, never skip) but it can only speak for the image it runs on.

None of the three is a gap I would hold the approval on.

---

**Verdict: APPROVED** — MINOR-1, MINOR-2 and MINOR-3 are correctable in place (one regex anchor,
one matcher, two comment clauses) and none of them changes an assertion's verdict on today's
population. If they are fixed, `421` must be re-run for the `Files=2, Tests=17` witness; the full
suite need not be, since none of the three touches `plan()`.
