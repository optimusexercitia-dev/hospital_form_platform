# DEFINER-TEMP-TABLE-CONVERGENCE — QA review (r1)

> Unit hub: [definer-temp-table-convergence.md](../features/definer-temp-table-convergence.md) ·
> record: [definer-temp-table-convergence.md](../progress/definer-temp-table-convergence.md) ·
> branch `definer-temp-table-convergence`, base `main @ b1e9b924`, reviewed range
> `b1e9b924..HEAD` (`2c76a757` · `df1976bf` · `cf5856d7`), 10 files / +519 / −122.
> Reviewer: `qa`, 2026-09-11. Read-only on code, tests, migrations, scripts and every doc but this one.

**Verdict: APPROVED**

Counts — **BLOCK 0 · MAJOR 1 · MINOR 3 · NOTE 3**. The one MAJOR is a wrong MECHANISM in the
record's door-sweep observation; it changes no code, no gate and no artifact, and it is one line to
correct. AC-1 through AC-4 are met and I re-measured the load-bearing ones on the live catalog
rather than reading the record. AC-5's last clause (`e2e:prod`) is open and owned by the lead —
this approval is conditioned on it reporting green; nothing else is outstanding.

⛔ **The local stack was held by the `e2e:prod` gate for the whole review.** Everything below is
either a read-only catalog SELECT, a no-DB script, or `lint` / `typecheck` / `test`. What I could
not run is enumerated in § 7 and is a work item for the lead, not a pass.

---

## 1. What I measured myself (not read off the record)

| Claim | How I checked it | Result |
|---|---|---|
| The four are `prosecdef=t` on `search_path=""` | `pg_proc` by `regprocedure`, live catalog | ✅ all four |
| Exactly ONE overload per name — the fact four signature-keyed `alter function`s rest on | `pg_proc ⋈ pg_namespace` by `proname`, the four names | ✅ **4 rows for 4 names** |
| The migration is four ALTERs and nothing else | comments stripped, non-blank lines listed | ✅ **4 statements, 0 bodies** |
| Freeze artifact holds 861 rows | value lines counted | ✅ **861** |
| Artifact md5 == its own anchor == `419 § 0d` | recomputed the digest from the artifact's own rows, `LC_ALL=C` | ✅ `b87831f83db14d97b695e4b10f6cb05f` |
| ⭐ **Artifact == the LIVE CATALOG** (this is `419`'s core claim, and I got it without `test:db`) | the census's own `definer_nonempty_domain` predicate, run read-only | ✅ **861 rows, md5 `b87831f8…` — byte-equal to the anchor and to both `419` pins** |
| `§ 5b`'s predicate really is `419`'s predicate | compared to `scripts/definer-search-path-census.sql:32-43` | ✅ same expression, same `coalesce(…, '""') <> '""'` shape |
| `§ 5c`'s routing claim | `pg_get_functiondef` on both wrappers, live | ✅ both `-> routes` |
| Gate 18 | `node scripts/gen-definer-search-path-freeze.mjs --check` | ✅ rc 0, `baseline 865 -> 861 (removed 4, added 0)`, names the four |
| Gate 16 | `npm run lint:backend-state` | ✅ rc 0, block **97/100** |
| Full chain | `npm run lint` | ✅ rc 0, 18 gates, self-test 17 cases |
| Types / units | `npm run typecheck`, `npm run test` | ✅ rc 0 · **154 files, 2091 tests** |
| The door-audit findings file was not rewritten | `git diff --stat b1e9b924..HEAD -- docs/reviews/authz-door-audit-findings.md` | ✅ empty |

Migration ordering is correct (`…007410` → `…007420`, both after `…007400`).

---

## 2. AC-by-AC

### AC-1 — the narrow migration, four members · **MET**

`supabase/migrations/20261003007420_definer_temp_table_convergence.sql:57,59,61,63` are the file's
only four non-comment statements. Each names one signature; each signature resolves to exactly one
`pg_proc` row; no body is re-emitted; nothing else is touched. The header states the
`prosecdef`/`proconfig` it measured BEFORE writing and it agrees with what I measure AFTER. The
scope fence naming the two deliberately-unconverged siblings (`app.tenant_orphan_profiles` as
`419 § 1b/1c`'s shrink control, `app.current_professional_read_organizations` as `413`'s pin) is
correct and both are still non-empty in the live catalog.

The D6 precondition and the D4 obligation both check out against the ADR's *verbatim* text, not a
paraphrase of it: `docs/decisions/0208-…:178-181` carries the PO's own words — *"they may not grow
and converge to the empty form on touch"* — and `…:266-267` carries *"targeted testing before any
catalog-wide ALTER FUNCTION hardening sweep"*. D6 also says *"prefer ALTER FUNCTION … SET
search_path = '' over re-emitting the body"* (`…:247-250`), which is exactly what was built.

### AC-2 — the freeze shrinks by exactly four · **MET**

`supabase/tests/vectors/definer_search_path_freeze.psql` diff is `1 insertion(+), 5 deletions(-)`:
the anchor line plus four value lines (at `:144-146` and `:510` of the pre-change file). No row moved, none was added. `419
§ 0c` `865 → 861` (`supabase/tests/419_definer_search_path_freeze.sql:121`) and `§ 0d`
`915172dd… → b87831f8…` (`:127`) moved in the same change. The generator header's mirror figure
moved too (`scripts/gen-definer-search-path-freeze.mjs:15-18`), now as a dated LINEAGE rather than
a bare number.

**The `865` sweep, classified.** Word-boundary `865` across `docs/`, `scripts/`, `supabase/`,
`.claude/` and the four root trackers, every hit resolved:

- **Live, and correctly moved**: `docs/lint-gates.md:38` (now **861** with the 867→865→861
  lineage — this is the exact home QA MINOR-2 corrected one unit ago; leaving it would have
  re-created that finding), `scripts/gen-definer-search-path-freeze.mjs:17`,
  `supabase/tests/419_…:10`, and the seam's `## Current state` bullet.
- **Frozen history, correctly covered**: `docs/backend-state/authorization-and-audit.md:1294` and
  `:1307` sit inside the PREDECESSOR slice and are governed by the appended
  `⚠ **Superseded**` marker at `:1290`, which names *exactly the two statements that died* —
  "861 not 865" and "CONVERGED, not measured free but unconverged". Both surviving occurrences are
  instances of those two statements; nothing in that slice is stale and unmarked.
- **History by construction, no action**: `docs/progress/definer-search-path-narrow-fix.md`,
  `docs/reviews/definer-search-path-narrow-fix-review.md`, `docs/progress/phase-ledger.md:154`,
  `docs/followups/follow-ups-archive.md:13302,13575`.
- **Unrelated `865`s**: BUG-GATE-001's `"860 of 865"` coverage line, perf-run timings, the
  e2e login count, `ADR 0203:317`'s cited line number.

⛔ `docs/followups/follow-ups-open.md` carries **no** `865` and no stale "unconverged" claim.

### AC-3 — `420` re-cast from pin to guard · **MET**

`plan(11)` and eleven `select is(…)` calls: § 0, §§ 1–4, § 5, § 5b, § 5c, § 5d, § 6a, § 6b. Counted
one by one — the plan is consistent.

- **Catalog half, per function**: §§ 1–4 each carry `[cfg search_path=""]` inside the SAME named
  string as their effect assertion (`420:252,266,280,291`), and § 5 (`:304-308`) re-reads all four
  together so a convergence that reached three cannot hide behind a rewritten §. A revert reds
  both halves, which is the point of binding them.
- **Effect half, non-vacuous**: § 0 (`:226-241`) compares each source count against
  `greatest(count,1)`, so a zero source reds with a diagnosis; "copied 0 of 0" cannot read as a
  pass. §§ 1–3 then assert `destination == source`, and § 4 asserts the literals its in-file
  fixture creates.
- **`§ 5b` cannot be satisfied by the masked change**: `prosecdef` and `nonempty` travel in one
  string, and the `nonempty` subquery itself filters on `p.prosecdef` — a function that stopped
  being `SECURITY DEFINER` drives BOTH figures down and reds. Correctly reasoned in the file's own
  comment and correct in the SQL.
- **`§ 6` is intact and can still fail** (`:376-404`): the planted DEFINER works on the
  three-schema path (§ 6a) and reds **42P01** under the same ALTER (§ 6b), both halves present,
  both inside `savepoint s420_ctl`. It is now the file's only arm exercising the empty path as a
  CHANGE, and dropping the four no-op ALTER arms is the right call — an `alter function … set
  search_path = ''` on a function already on `''` is an assertion that cannot fail (memory:
  *a close condition can name the case that CANNOT fail*).
- **Nothing still asserts the old three-schema path.** The five surviving occurrences of
  `app, public, pg_catalog` in `420` are: three prose lines (`:32,86,300`), one failure-diagnosis
  hint inside § 1's label (`:252`), and `§ 6`'s control's own deliberate setup (`:379`). No
  assertion expects it.
- **Savepoint vacuity**: assertions inside savepoints are the known hazard. The file states the
  right detector — pgTAP's `planned N / ran M` diagnostic is noise, pg_prove's **"Bad plan"** is
  the finding — and every raise-capable construct outside a savepoint (§§ 5, 5b, 5c, 5d use
  `::regprocedure`, which RAISES rather than returning NULL) aborts loudly into a plan mismatch.
  ✅ No arm can go green by not running.
- **Red-first witness**: specific and, importantly, **not uniformly red** — six `not ok`
  (§§ 1,2,3,4,5,5b) against five green (§ 0, § 5c, § 5d, § 6a, § 6b) on the SAME pre-migration run,
  with two TAP lines quoted verbatim (record `:63-70`). That green half is the discrimination
  control that stops "it all went red" from meaning "the file failed to run". This is the standard
  the lessons register asks for and it was met.

See NOTE-1 on the literal effect figures.

### AC-4 — the seam · **MET**

`docs/backend-state/authorization-and-audit.md`: `## Current state` bullet **replaced** in place
(`:57`, ⛔ NOT converged → converged, 865 → 861) and the `Where the detail lives` list extended
(`:97-101`) with the new slice plus a lowercase `(⚠ superseded in part)` marker on the predecessor
— lowercase deliberately, since gate 16 check H forbids a `⚠ **Superseded**` marker inside the
projection. A new frozen slice is appended at the bottom (`:1309-1324`), and the only edit to the
earlier frozen text is the appended `⚠ **Superseded**` line at `:1290`, whose target section
exists. `npm run lint:backend-state` rc 0; block at 97 of the 100-line ratchet.

### AC-5 — gates · **MET as far as I can reach; one clause open**

Every row in the record's gate table (`:159-183`) names a command and an rc. The four I could
re-run myself (`lint`, `typecheck`, `test`, gate 18 `--check`) reproduce the record's figures
exactly. `e2e:prod` is explicitly not run by `backend` and is the lead's — that clause is open.

**The door-sweep ruling is correct.** `scripts/door-sweep-cases.sh b1e9b924` exits **1 — NO DOORS
AT ALL**, and the deriver owes one of two discharges. Option (b) ("these migrations contain no
prosecdef gate") would indeed be FALSE here — the migration touches four `prosecdef=t` functions —
so option (a), hand-naming the four in `CASES=`, is the only honest discharge, and it exits
**3 = UNPROVEN**, correctly not read as a pass. The reason is measured, not asserted: I read
`PRED_DOMAIN` at `supabase/tests/mutation/p0-authz-door-audit.sh:1069-1078` and it requires
`t.typname='bool'` (or the single named exception `assert_not_case_excluded`); the four return
`void`, `void`, `void` and `accreditation_frameworks`, so they are outside the predicate arm's
domain **by construction** — a structural exclusion, not a filter's silence. The policy arm's
`0 of 226` is a true empty selection: the migration creates, alters and drops no policy.

---

## 3. Security / RLS

### The one clause no gate reads — and this time it was read

`FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED` says D4's
schema-qualified-body half is ungated: neither `419`, nor gate 18, nor anything in this migration
reads a function BODY. Under `search_path = ''` `pg_temp` is still searched FIRST for relations
and all four client roles hold database `TEMP` (ADR 0208 D5), so an unqualified PERSISTENT relation
inside an empty-path DEFINER stays shadowable. **I am the gate for these four.**

**Method** — `pg_get_functiondef` on the LIVE catalog (never the migration text, ADR 0078),
comments stripped, then every `from|join|into|update|delete from <bare identifier>` extracted
mechanically rather than by eye. The complete unqualified set across all four bodies:

```
_clone_item_map  _clone_section_map  _clone_standard_map  _copy_answer_map  _tpl_phase_map   ← temp tables
ins  src                                                                                     ← CTE aliases
v_new  v_source_owner  v_target_status                                                       ← plpgsql INTO targets
```

✅ **Zero unqualified persistent relation references.** Every persistent table is `public.*`, every
helper call is `app.*` or `auth.*`, and `clone_framework`'s `v_new public.accreditation_frameworks`
is qualified. D4's second clause **holds for all four**, measured.

### Second-order resolution — what a body-only read would have missed

A `SET search_path` on a function applies to everything nested inside its call, so the empty path
also governs (a) the helpers the four call and (b) every trigger that fires on the rows they write.

- **Callees**: `app.commission_of_version`, `app.commission_of_template_version`,
  `app.is_staff_admin_of`, `app.is_tenancy_admin_of`,
  `app.recompute_template_phase_offered_results`, `app.assert_accreditation_enabled` — **all six
  carry their own explicit `SET search_path = app, public, pg_catalog`**, so none inherits `''`.
  The only callee with NO `proconfig` is `auth.uid()`, whose live `prosrc` is `coalesce` /
  `nullif` / `current_setting` / `::jsonb` / `->>` / `::uuid` — all `pg_catalog`, which is searched
  implicitly for functions, operators and types regardless of `search_path`. ✅ Safe.
- **Triggers**: **40 triggers / 31 distinct trigger functions** fire on the 19 tables the four
  write, and **zero** of them has a NULL `proconfig`. ⭐ Vacuity control: the same detector finds
  **7** NULL-`proconfig` trigger functions elsewhere in this database, so it is a live instrument
  reporting an empty selection, not a dead one.

### Nothing else in the authorization surface moved

`ALTER FUNCTION … SET` writes `proconfig` alone. No policy, no grant, no `prosecdef`, no body.
The enforcement manifest carries no `search_path` claim about any of the four (its single
`search_path` note is about `app.can_edit_commission_forms`); `413` names none of them; the
generated surfaces carry no such column. RLS is untouched; no service-role key is involved; no
client code is in the diff.

---

## 4. MAJOR

### MAJOR-1 — the record's door-sweep observation names the WRONG mechanism, and that mechanism is what a follow-up would inherit

`docs/progress/definer-temp-table-convergence.md:150-154` reports the deriver resolving 0 doors
*"because its name extractor does not see `alter function`"*, and flags it as the second
consecutive `alter function`-only migration to do so.

**The deriver does see `alter function`.** `scripts/door-sweep-cases.sh:743` is an explicit
`alter function` extraction clause — and `:728` records that this branch was ADDED precisely to
close `FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION`. What it requires is `security definer` in
the matched text:

```
grep -ohiE "alter function ((app|public|authz)\.)?\"?[a-z0-9_]+\"?[[:space:]]*\([^)]*\)[^;]{0,200}security[[:space:]]+definer" "$D/flat"
```

That clause is deliberate and load-bearing: `:731-736` measures that
`20260620000000_baseline.sql` carries **449** `ALTER FUNCTION … OWNER TO "postgres";` lines, all of
which a bare `alter function` grep would sweep into CASES.

**So the real residual gap is narrower and different**: `alter function … set <attribute>` on a
function that is ALREADY `prosecdef` — the exact shape of `20261003007410` and `20261003007420` —
carries no `security definer` token, matches nothing, and derives 0.

**Failure scenario.** The lead files the follow-up with the record's wording. A future engineer
reads "the name extractor does not see `alter function`", opens `door-sweep-cases.sh`, finds the
branch at `:743` already there and already credited with closing an identically-named follow-up,
and closes the new one as a duplicate — while the `set search_path` shape stays underived. Meanwhile
that shape is genuinely authorization-relevant: changing a DEFINER's `search_path` changes name
resolution inside a gate's body, which is the `pg_temp` hijack ADR 0208 D5 exists for. This is the
register's own failure mode — *a follow-up's NAMED MECHANISM decides the sweep*.

**Answer to the brief's question**: **yes**, a real gap worth a follow-up; the extraction line is
`scripts/door-sweep-cases.sh:743`; and the mechanism to write down is *"the clause requires
`security definer` in the matched statement, so an attribute-only `ALTER FUNCTION` on an
already-DEFINER function derives nothing"* — ⛔ never *"does not see `alter function`"*.

**To clear:** one corrected sentence in the record before the Record step, so the register entry
inherits the true mechanism.

---

## 5. MINOR

### MINOR-1 — the hub's `## Current state` still describes a unit that has not started

`docs/features/definer-temp-table-convergence.md:56-63` reads *Done since start: Branch cut…* /
*In progress: `backend` building AC-1…AC-4*. The hub was touched only in the opening commit
`2c76a757`; `df1976bf` and `cf5856d7` never returned to it. AC-1…AC-4 are built and AC-5's gates
are run.

**Failure scenario.** The hub's `## Current state` is the unit's SUMMARY (CLAUDE.md §7, ADR 0186
D3) and is what a fresh session or a reviewer reads first — I read it as the spec for this review
and it contradicts the record on the facing page. Left as is, "never report status without writing
it there first" has been satisfied in the record and violated in the summary.

**To clear:** the lead's `gated` step normally replaces this block; flagging it so it is not
skipped, since nothing gates its truth.

### MINOR-2 — `420`'s `sa` / `comm` pairing rests on a non-total ordering

`supabase/tests/420_definer_temp_table_empty_path.sql:134-139` selects the staff_admin principal
and its commission in **two separate scalar subqueries**, each `order by m.principal_id limit 1`.
`principal_id` alone is not a total order over `memberships`.

**Failure scenario.** If the lowest-id `staff_admin` principal ever holds commission memberships in
two commissions, the two subqueries may resolve to different rows; `§ 4` then seats a hat for a
commission `clone_framework` is not being asked to clone into, `app.is_staff_admin_of(p_commission)`
denies with **42501**, and `§ 4` reds — an intermittent red on a gate, from a fixture, with nothing
wrong in the subject. Measured today: that principal holds exactly **1** commission, so the pairing
holds by accident rather than by construction. It fails LOUDLY (§ 4's own label names the 42501
case and calls the section VOID), so this is a flake risk, not a vacuity.

**To clear:** one subquery returning both columns, or `order by m.principal_id, m.commission_id`
in both.

### MINOR-3 — "0208 D5 requires a new ADR only to admit a second compatibility form" is a paraphrase the ADR does not carry

Repeated in four places: `supabase/migrations/20261003007420_definer_temp_table_convergence.sql:10-11`,
`docs/features/definer-temp-table-convergence.md:24`,
`docs/progress/definer-temp-table-convergence.md:20-22`, and
`docs/backend-state/authorization-and-audit.md:1314` (a FROZEN slice, where it will now be quoted
forward).

What D5 actually says, at `docs/decisions/0208-…:239-241`, is: *"If a second compatibility form is
ever admitted, it is property-based"* — it states the SHAPE such a form would have to take and says
nothing about an ADR being required, or about when one is not.

**Failure scenario.** The claim is load-bearing (it is the stated reason this unit ships with no
ADR) and it now sits inside frozen seam text, where the repo's convention is to quote rather than
re-derive. A later unit citing "0208 D5" for an ADR-necessity rule will not find one there — the
same shape as the lesson *a paraphrase can INVERT the sentence it summarizes*, which produced a
false committed ADR claim once already.

⚠ **The conclusion is right; only its citation is wrong.** The airtight ground for "no new ADR" is
D4's verbatim PO ruling at `0208:178-181` — *"they may not grow and converge to the empty form on
touch"* — which ORDERS this convergence outright.

**To clear:** restate on D4 alone (the migration header and the record are editable; the seam line
needs an appended correction, not an in-place edit).

---

## 6. NOTE

- **NOTE-1 — the AC's literal effect figures are not pinned in `420`, and that is the better
  design.** AC-3 asks for `items=6 sections=1` · `phases=1` · `answers=2 selopts=2` ·
  `standards=2 rewired=1`. `420` pins literals only in § 4 (`:290`), whose fixture it creates
  itself; §§ 1–3 assert `destination == source` derived from the fixture at run time. Evidence
  that this matters: running `420`'s own fixture selection read-only against the current
  (E2E-mutated) database yields `items=6 sections=1 phases=2 answers=4 selopts=5` — `items`/`sections`
  hold because that version is immutable seed data, the rest do not. Hard-coded literals would
  have made the guard state-dependent and re-baselined on the first E2E leftover. I read AC-3 as
  met in the relational sense, which is the stronger property; the record's `unchanged` table is a
  witness about two runs on identical fixture state, not a claim about the file's assertions.
- **NOTE-2 — AC-4's "stamp re-dated" is satisfied only vacuously.** The seam's `**Updated:**`
  stamp (`authorization-and-audit.md:11`) reads `2026-09-11` and does not appear in the diff,
  because the predecessor unit stamped the same day. The stamp is accurate; it simply cannot
  distinguish a second same-day revision. No action.
- **NOTE-3 — `420 §§ 1–2` never exercise their subjects' authorization arm under the new path, and
  no test says so.** Both `app.copy_version_children` and `app.copy_template_version_children`
  read `v_actor := (select auth.uid())` and SKIP the `app.is_staff_admin_of` /
  `app.is_tenancy_admin_of` check entirely when it is NULL — which is the state §§ 1 and 2 run in
  (only § 4 seats a hat). So the arm that matters most for authorization is short-circuited in
  exactly the two sections that claim to prove those functions survive `search_path = ''`. I
  closed the gap out-of-band by measuring (§ 3 above): all six callees carry their own explicit
  `SET search_path`, so none inherits `''`. ⚠ Nothing asserts that. If a helper ever loses its
  `SET` clause, `420` would stay green. A candidate follow-up, not a finding against this unit.

---

## 7. Could not verify — a work item, not a pass

The local stack was held by `e2e:prod` for the duration. I could not run `supabase db reset`,
`npm run test:db`, `supabase test db`, Playwright, or any `e2e:*` target.

1. **`supabase db reset --local` + `npm run test:db` on a fresh reset.** The record's
   `531 migrations applied + seeded`, `Files=269, Tests=9046, PASS`, `419 ok`, `420 ok`, and the
   `# Looks like you planned 11 tests but ran 9` diagnostic are all **unverified by me**.
   ⚠ Partially mitigated: I obtained `419`'s core verdict independently — the live catalog's
   frozen-domain name set is byte-equal to the artifact (861 rows, md5 `b87831f8…`) — so the one
   assertion most likely to fail is corroborated without the suite.
2. **`420`'s red-first run** against the pre-migration catalog (six `not ok`, five green). The
   unconverged catalog no longer exists on this stack and the run used a hand-assembled
   single-file harness. The witness is specific and internally consistent; it is not re-derivable
   by me.
3. **`npm run gen:types` produces no diff.** Needs a DB. Circumstantially strong: nothing under
   `src/lib/types/` is in the diff, and `ALTER FUNCTION … SET` changes no signature, argument or
   return type, so a types diff is not mechanically possible.
4. **`npm run e2e:prod`** — running now, owned by the lead. This is AC-5's last open clause and
   the condition on this approval.
5. **The four authz arms** (`census`, `hat`, `floor`, `FROMFINDINGS=1 wrapper`), the deriver
   self-test (46 cases), `authz-setvalued-targeted-cases.sh`, and both sweep invocations. I
   verified only that `docs/reviews/authz-door-audit-findings.md` is byte-unchanged across the
   range and that `PRED_DOMAIN`'s `t.typname='bool'` makes the record's exit-3 reasoning correct
   (§ 2, AC-5).

---

## 8. Obligations remaining at the Record step

- `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-FOUR-TEMP-TABLE-DEFINERS-MEASURED-FREE-TO-CONVERGE` is still
  🟡 open at `docs/followups/follow-ups-open.md:1943` — this unit closes it.
- The hub's frontmatter `reviews: []` needs this report linked; `status` needs to leave
  `in_progress`; the AC checkboxes are all still `[ ]`.
- The door-sweep deriver gap wants a follow-up — filed with the mechanism from **MAJOR-1**, not
  the one in the record.
- NOTE-3's unasserted dependency (callees keeping their own `SET search_path`) is a candidate
  follow-up.

---

## Round 2 — re-review of the r1 fix pass (2026-09-11)

Range `cf5856d7..HEAD` — `ea81b227` · `619bdcf9` · `53529324` · `9de19df7`; 6 files, +114 / −7.

**Verdict: APPROVED**

All four r1 findings are cleared. Counts — **BLOCK 0 · MAJOR 0 · MINOR 0 · NOTE 1** (carried
NOTE-3 from r1, unchanged and not a finding against this unit).

### The migration is comment-only since r1 — confirmed, and on the WIDER range

```
git diff 53529324~1..53529324 -U0 -- supabase/migrations | grep -v '^[-+]--' | grep -E '^[-+][^-+]'   → empty
git diff cf5856d7..HEAD        -U0 -- supabase/migrations | grep -v '^[-+]--' | grep -E '^[-+][^-+]'   → empty
```

⭐ I ran it over **every** r2 commit, not only `53529324`, so "comment-only" is a property of the
whole fix pass rather than of the one commit named. The four `alter function` statements at
`:57,59,61,63` are byte-identical to what I approved in r1; only the header block at `:10-14`
moved. The live catalog is unchanged: all four still `prosecdef=t` / `search_path=""`.

### MAJOR-1 — **CLEARED**

`docs/progress/definer-temp-table-convergence.md` carries an appended correction (never an in-place
edit) that quotes the `:743` regex, names the branch, and records the **449** `OWNER TO` baseline
measurement as the reason the `security definer` clause is mandatory. It states outright that
*"its name extractor does not see `alter function`"* is false. It also corrects a home my review
did not name — the migration header at `20261003007420:10` — which is the right instinct.

`FUP-DEFINER-TEMP-TABLE-CONVERGENCE-DERIVER-BLIND-TO-SET-ATTRIBUTE`
(`docs/followups/follow-ups-open.md:1975-1981`) inherits the corrected mechanism verbatim, and
⛔ **does not misstate `:743`** — I re-read the line after the fix pass; it is unchanged and the
entry describes it accurately ("DOES extract `alter function` but requires `security definer` in
the matched text"). The cited closed predecessor `FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION`
is genuinely in `follow-ups-archive.md` (5 hits), so the "already closed, don't re-do it" pointer
is true and not a dangling citation.

**Closes-when is precise and falsifiable**, which is the bar: it names the artifact and line, says
the CATALOG (not the text) must decide `prosecdef` at derivation time, requires the 449-line
`OWNER TO` baseline to still derive 0 — i.e. the fix must not re-open the flood the predecessor
FUP closed — and demands a self-test case yielding **2 + 4** names for `20261003007410` +
`20261003007420`. ⭐ It also pre-refuses the three wrong closures (widen the regex to every
`alter function`; treat the option-(a) rulings as the fix; treat "none returns `bool`" as making
it moot). That last one matters: the next `set <attribute>` migration may touch a predicate.

### MINOR-2 — **CLEARED in the query, not in the fixture**

`420:146,149` now `order by m.principal_id, m.commission_id limit 1` in **both** subqueries.
⭐ I measured that this is now a TOTAL order rather than a wider accident: over
`role = 'staff_admin' and commission_id is not null`, the maximum row count per
`(principal_id, commission_id)` is **1** on the live catalog, so both subqueries provably resolve
the same single row whatever the seed does to the principal's commission count. The r1 failure
scenario is closed as a property of the query. The added comment names the mechanism and the
42501 mis-read it prevents.

⛔ **Could not verify (carried to the lead, not a pass):** `420` has not been re-run. The stack is
still held by `e2e:prod`, so no `supabase db reset --local`, no `npm run test:db`, no single-file
pgTAP run. `plan(11)` is unchanged and the diff is `+12 / −2` confined to the `fx420` fixture
block (10 comment lines + the 2 rewritten `order by` clauses), so the change cannot move the test
count — but **"`420` still passes" is unproven by me** and must be re-established by `test:db` on a
fresh reset before the Record step.

### MINOR-3 — **CLEARED in all four homes**

- `docs/backend-state/authorization-and-audit.md:1311` — an appended `⚠ **Superseded**` line
  directly under the new slice's own heading (⛔ not an in-place edit of frozen text), quoting
  D5's actual sentence and D4's verbatim ruling. `lint:backend-state` rc 0.
- `supabase/migrations/20261003007420_…:10-14` — comment-only, and it says plainly that "D5 says
  no such thing". Accurate against `0208:239-241`.
- `docs/features/definer-temp-table-convergence.md:24` — ground REPLACED (a hub is a projection,
  so replacement is correct here) by D4's verbatim clause.
- `docs/progress/definer-temp-table-convergence.md` — the lead's opening entry corrected by an
  appended marker.

### MINOR-1 — **CLEARED**

The hub's `## Current state` (`:56-68`) now reflects reality: AC-1…AC-4 built with their commits,
AC-5 step-1 gates listed, r1's verdict and counts recorded, `e2e:prod` named as in-flight, and the
Record step's obligations in `Next`. The r1 stale lines are gone.

### Gates re-run at r2 tip (no DB)

`lint:registers` rc 0 · `lint:backend-state` rc 0 · `lint:progress` rc 0 · `lint:definer-freeze`
rc 0 (`861`, `baseline 865 -> 861 (removed 4, added 0)`). The freeze artifact, `419`'s two pins
and the migration's four statements are untouched by the fix pass.

### Still open at r2

1. **`npm run test:db` on a fresh reset has not run since `53529324`** — the MINOR-2 edit to `420`
   is unverified (above). This is the one thing that must precede the Record step.
2. **`npm run e2e:prod`** — the condition on both r1's and this approval.
3. **NOTE-3 (carried)** — `420 §§ 1–2` run with `auth.uid()` NULL, so the subjects'
   `is_staff_admin_of` / `is_tenancy_admin_of` arm is short-circuited; I closed that by measuring
   that all six callees carry their own `SET search_path`, but nothing asserts it. Candidate
   follow-up, unchanged from r1.
