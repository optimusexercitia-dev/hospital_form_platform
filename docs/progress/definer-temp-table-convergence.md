# DEFINER-TEMP-TABLE-CONVERGENCE — progress record

> Hub: [definer-temp-table-convergence.md](../features/definer-temp-table-convergence.md) ·
> branch `definer-temp-table-convergence`, cut from `main @ b1e9b924` · owed by ADR 0208 D4 (on touch)
> · closes `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-FOUR-TEMP-TABLE-DEFINERS-MEASURED-FREE-TO-CONVERGE`.

## Session log

### 2026-09-11 — unit opened; the PO ruled CONVERGE; scope mapped (lead)

**The ruling, and its scope written down:** the follow-up's *Closes when* was `PO to rule`. The PO
opened this session with *"Lets solve `The four temp-table DEFINERs measured free to converge,
unruled.`"* — read as the ruling to CONVERGE the four (ADR 0208 D4: *"converge to the empty form on
touch"*), nothing wider. ⛔ It does NOT rule the sibling follow-ups filed by the same unit
(`…QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`, `…RULES-CAP-DEFERS-THE-D5-HINT-FILE`,
`…DOOR-SWEEP-ARM-2-ROW-WAS-ARM-1-RELABELLED`); they stay open. If the PO meant otherwise, the
correction is one line here.

**Why no ADR:** 0208 D4 already orders convergence on touch; D6's precondition (targeted tests first)
was discharged by `420`; D5 requires a new ADR only to admit a SECOND compatibility form, which this
is not. ADR 0209 § *Considered and held* explicitly defers the four's sequencing to the convention's
unit. Highest ADR on any branch: 0209.

**Scope mapped (Explore, conclusions only):** nothing pins the four's `search_path` except `420` and
the freeze artifact — `271/274/276/277/280` are behavioural only, `413` names none of them, the
enforcement manifest and both generated surfaces carry no `search_path` column. The complete moving
set: migration `20261003007420_*` (four ALTERs) · the freeze artifact via `--write` (pure four-row
deletion, 865 → 861) · `419 § 0c`/`§ 0d` literals + header prose · `420` (`§ 5` / `§ 5b` pin the
four UNCONVERGED and will red; the per-section `[cfg]` witnesses stop discriminating once TODAY ==
converged) · the seam (`:57` clause, `:1291`, `:1304`, new slice, `## Current state` replaced) ·
the register entry. ⭐ `420 § 5b` says in its own words: *"a finding for a FUTURE convergence"* —
this is that unit.

**Plan approval:** the migration follows the already-approved `20261003007410` pattern (narrow
`ALTER FUNCTION`, no body); one-line plan + lead ack suffices (lead-playbook §3).

### 2026-09-11 — the four converged by narrow ALTER FUNCTION; freeze 865 → 861; `420` re-cast from pin to guard (backend)

**AC-1 — migration `supabase/migrations/20261003007420_definer_temp_table_convergence.sql`.**
MEASURED on the live catalog BEFORE writing a line of it (`docker exec … psql`, `pg_proc` keyed by
`regprocedure` — ⛔ never read off migration text, ADR 0078), and MEASURED again after
`supabase db reset --local`:

```
                                                 prosecdef   proconfig BEFORE                      proconfig AFTER
app.copy_response_answers(uuid,uuid)                 t       search_path=app, public, pg_catalog   search_path=""
app.copy_template_version_children(uuid,uuid)        t       search_path=app, public, pg_catalog   search_path=""
app.copy_version_children(uuid,uuid)                 t       search_path=app, public, pg_catalog   search_path=""
public.clone_framework(uuid,uuid)                    t       search_path=app, public, pg_catalog   search_path=""
```

Exactly ONE overload per name, measured in the same breath (4 rows for the 4 names). That is the
fact four signature-keyed `alter function` statements rest on, and `420 § 5d` pins it rather than
leaving it an accident. The file's only non-comment content is those four statements (verified by
stripping comments) — **no body is re-emitted**, and `ALTER FUNCTION … SET` writes `proconfig` alone.

**AC-3 red-first, and the method.** The re-cast `420` was written and run **BEFORE** the migration
existed, against the then-current unconverged catalog (method: `create extension pgtap with schema
extensions`, load `00_setup.sql`, pipe `420` through `psql` — `supabase test db` has no single-file
mode and pgTAP is not resident between runs). It emitted `1..11` with **six** `not ok` — §§ 1, 2, 3,
4, 5, 5b — every one of them on the catalog half, with the effect half already agreeing:

```
not ok 2 - § 1 CONVERGED AND STILL COPYING: app.copy_version_children …
#         have: OK | items=6 sections=1  [cfg search_path=app, public, pg_catalog]
#         want: OK | items=6 sections=1  [cfg search_path=""]
not ok 7 - § 5b ALL FOUR ARE STILL SECURITY DEFINER AND NONE IS ON A NON-EMPTY PATH …
#         have: prosecdef:4 nonempty:4
#         want: prosecdef:4 nonempty:0
```

⭐ **The run was not uniformly red, and that is the discrimination half.** § 0 (fixture reach),
§ 5c (the wrappers route), § 5d (one overload each), § 6a and § 6b (the planted control works on
the three-schema path and reds **42P01** under `''`) were GREEN on the same pre-migration run —
so the six reds are bound on the convergence and not on the file failing to run.

**AC-3(b) — the effect numbers did NOT move.** The four `have` strings above are the values `420`
measured on the UNCONVERGED catalog; each is the same string the converged run asserts:

```
§ 1  app.copy_version_children            items=6 sections=1        unchanged
§ 2  app.copy_template_version_children   phases=1                  unchanged
§ 3  app.copy_response_answers            answers=2 selopts=2       unchanged
§ 4  public.clone_framework               standards=2 rewired=1     unchanged
```

**AC-3 disposition on the savepoint ALTER arms: DROPPED, not kept as a no-op control.** Once the
four are on the empty form, `alter function … set search_path` to that same value is a no-op and
its arm is an assertion that CANNOT FAIL; a green arm that cannot fail reads as coverage it does
not have. The per-section savepoints STAY (their second reason — cross-probe contamination,
harness defect 1 — outlives the ALTERs), and `§ 6` stays verbatim and is now the file's only arm
exercising the empty path as a CHANGE. plan(15) → plan(11); `RUN SHAPE` moved to `Files=2, Tests=12`.

**AC-2 — the freeze.** `--write` only. The committed diff is a PURE four-row deletion plus the
anchor line (`1 insertion(+), 5 deletions(-)`: `rows=865 sha256=8ee59a19… md5=915172dd…` →
`rows=861 sha256=7553e105… md5=b87831f8…`, and the four `-` value lines). Gate 18 check F, quoted
verbatim from `--check`:

```
baseline 865 -> 861 (removed 4, added 0)
```

`419 § 0c` 865 → **861** and `§ 0d` `915172dd…` → **b87831f83db14d97b695e4b10f6cb05f** moved in the
same change, as did the header prose, now carrying the LINEAGE rather than a bare figure: **867 →
865 at `20261003007410` → 861 at `20261003007420`**. The generator header's mirror `865` moved the
same way; NOTE-r2-2's rhetorical `867` is left as history, as the predecessor unit's PO ruled.

**AC-4 — the seam.** `docs/backend-state/authorization-and-audit.md`: a new frozen slice appended
(`## The four temp-table DEFINERs are CONVERGED and the frozen population is 861 (2026-09-11 …)`),
a `⚠ **Superseded**` marker placed directly under the predecessor slice's heading naming exactly
the two statements that died (865, and "measured free but unconverged") and saying the rest — the
MECHANISM paragraph included — stands, and the `## Current state` block REPLACED at its DEFINER
bullet and its `Where the detail lives` list. Gate 16 rc 0; the block sits at **97 of the 100-line
ratchet**.

**⛔ Also moved, though the brief's ACs did not name it:** `docs/lint-gates.md:38` carried a LIVE
`865` — the same home QA MINOR-2 corrected for 867 → 865 in the predecessor unit. Left alone it
would have re-created that exact finding one unit later.

**The door sweep, RULED — deriver exit read BARE (`DERIVER_RC_BARE=1`), never through a command
substitution in one breath.**

```
SCOPE: 1 file(s) — 0 committed (b1e9b924..HEAD), 0 worktree, 1 untracked | filter: none | derivation: catalog
```

`=== RESULT: FINDING (1) — NO DOORS AT ALL: the catalog resolved 0 in this diff. ===` The deriver
owes ONE of two discharges. ⛔ **Option (b) as written would be FALSE here** — "these migrations
contain no prosecdef gate" is untrue: the migration touches four `prosecdef=t` functions. So
**option (a) was taken**: the four were named in `CASES=` by hand and swept in ONE invocation,
whose two arms are the two rows below (`FROMFINDINGS=1` is the WRAPPER arm's knob and was NOT
passed here — see `FUP-…-DOOR-SWEEP-ARM-2-ROW-WAS-ARM-1-RELABELLED`). That invocation exits
**3 = UNPROVEN**, which is NOT a pass, and the REASON is measured rather than read:

```
app.copy_response_answers(uuid,uuid)            -> returns void
app.copy_template_version_children(uuid,uuid)   -> returns void
app.copy_version_children(uuid,uuid)            -> returns void
public.clone_framework(uuid,uuid)               -> returns accreditation_frameworks
```

`PRED_DOMAIN` (lifted whole from `p0-authz-door-audit.sh`) requires `t.typname='bool'`, so all four
are outside the predicate arm's domain **by construction**, not by a filter's silence; and the
migration creates and alters no RLS policy, so the policy arm's `0 of 226` is a true empty
selection. **RULING: this migration changes no authorization logic.** `ALTER FUNCTION … SET` writes
`proconfig` alone, no body is re-emitted, and therefore no gate predicate, no policy `USING` /
`WITH CHECK`, and no door arm moved. There is nothing for either arm to sweep, and that is a
measured property of this diff.

⚠ **NOT a verdict — a NOTICED-shaped observation for the lead.** The deriver resolved tier 1 = **0**
while the diff touches four `prosecdef=t` functions, because its name extractor does not see
`alter function`. This is the SECOND consecutive `alter function`-only migration on which it
resolved 0 doors (`20261003007410` did the same). No open follow-up names it. ⛔ Not filed here —
the register is outside this role's scope; reported to the lead instead.

⚠ **CORRECTION 2026-09-11 (QA r1 MAJOR-1) — the paragraph immediately above names the WRONG
MECHANISM, and is left standing under ADR 0105 rather than rewritten.** *"its name extractor does
not see `alter function`"* is false. VERIFIED at `scripts/door-sweep-cases.sh:743` (branch 4d,
added to close `FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION`): the deriver **does** have an
`alter function` branch. Its regex is
`alter function ((app|public|authz)\.)?"?[a-z0-9_]+"?[[:space:]]*\([^)]*\)[^;]{0,200}security[[:space:]]+definer`
— the `security definer` clause is **mandatory in the match, and deliberately so**: the file's own
comment records the measurement that `20260620000000_baseline.sql` carries **449**
`ALTER FUNCTION … OWNER TO "postgres";` lines, which a naive `alter function` grep would put whole
into the candidate set. So the branch exists and is correctly bounded; the residual gap is narrower
than I wrote — `alter function … set <attribute>` on a function that is **already** `SECURITY
DEFINER`, whose statement text therefore never contains the clause the match requires. ⛔ My
sentence would have sent a reader to re-add a branch that is already there. The verdicts above are
unaffected: tier 1 = 0 is still the observed value and the ruling still rests on the catalog-measured
return types, not on this mechanism. The follow-up is the LEAD's to file, with the mechanism as
corrected here — ⛔ not re-filed from this entry.

**AC-5 — gates, in order, on a FRESH `supabase db reset --local`.** Arm scripts live under
`supabase/tests/mutation/`, not `scripts/` (the brief's paths were shorthand).

```
supabase db reset --local                                    rc 0   531 migrations applied + seeded
npm run test:db (on that fresh reset)                        rc 0   Files=269, Tests=9046, Result: PASS
  419_definer_search_path_freeze.sql                                ok   (emits no planned/ran diagnostic)
  420_definer_temp_table_empty_path.sql                             ok   (# Looks like you planned 11 tests but ran 9)
  [9050 -> 9046: 420 went 15 -> 11 tests; the delta is exactly the four dropped ALTER arms]
npm run gen:types                                            rc 0   git diff --stat src/lib/types/ EMPTY (measured, not assumed)
npm run lint (full chain)                                    rc 0   gate 18 self-test 17 cases; gate 16 block 97/100
npm run typecheck                                            rc 0
npm run test (vitest)                                        rc 0   154 files, 2091 passed
ARM=census        p0-authz-invariant.sh                      rc 0   INVARIANT HOLDS — live authz gates 581 / carrying a verdict 608
ARM=hat           p0-authz-invariant.sh                      rc 0   INVARIANT HOLDS — 4 finding(s), all reasoned-allowlisted
ARM=floor         p0-authz-invariant.sh                      rc 0   INVARIANT HOLDS — 63 never-called doors, every one allowlisted
FROMFINDINGS=1 ARM=wrapper  p0-authz-invariant.sh            rc 0   INVARIANT HOLDS — BLIND set 41, every BLIND wrapper allowlisted
git diff --stat -- docs/reviews/authz-door-audit-findings.md        EMPTY (after all four arms AND both sweeps)
authz-setvalued-targeted-cases.sh                            rc 0   RESULT: CLEAN — 3 resolver(s) measured, all COVERED
SELFTEST=1 bash scripts/door-sweep-cases.sh                  rc 0   SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0
bash scripts/door-sweep-cases.sh b1e9b924                    rc 1   FINDING (1) — NO DOORS AT ALL, 0 resolved; RULED above
door sweep · PREDICATE arm (CASES=<the four>)                rc 3   0 selected of 127 in domain
door sweep · POLICY arm    (same invocation)                 rc 3   0 selected of 226 in domain
  ARM-DOMAIN                                                        predicate=0/127 policy=0/226
  RESULT                                                            UNPROVEN — NOTHING WAS MEASURED. ⛔ Not a pass. RULED above
gen-definer-search-path-freeze.mjs --check                   rc 0   in sync (861); check F `baseline 865 -> 861 (removed 4, added 0)`
npm run lint:backend-state                                   rc 0   block 97 lines; largest seam 147.8 KB (warn 160 / cap 200)
```

⛔ `e2e:prod` NOT run — the lead runs that.

**Dead ends and things that surprised me.**

1. ⭐ **A predicted diagnostic figure is a claim, and mine was wrong.** I wrote `planned 11 tests
   but ran 5` into `420`'s header by counting savepoints; the MEASURED value over the full 269-file
   suite is `planned 11 tests but ran 9`. Corrected to the measurement, with the mistake named in
   the file itself — it is the identical shape as QA r2 MINOR-r2-1 in the predecessor unit, where a
   wrong expected diagnostic pre-authorised dismissing one the file never prints.
2. ⚠ **`419`'s header carried a figure about ANOTHER file** — `420` emits `planned 15 tests but
   ran 13` — which the re-cast made false, and **nothing reds** when it does. Moved in the same
   change, with the staleness mechanism written beside it.
3. A single-file pgTAP run needs `create extension pgtap with schema extensions` **and** a load of
   `00_setup.sql` first. Without the second, `420 § 4` errors `schema "test_helpers" does not
   exist` — which reads exactly like a § 4 defect rather than a missing harness.
4. Both sweep runs and all four arms left `docs/reviews/authz-door-audit-findings.md` byte-unchanged
   (subset runs write to scratch only); verified after, not assumed.

### 2026-09-11 — QA r1 fix pass (backend)

QA r1 APPROVED (0 BLOCK / 1 MAJOR / 3 MINOR / 3 NOTE),
[definer-temp-table-convergence-review.md](../reviews/definer-temp-table-convergence-review.md). Three
items actioned. ⛔ **NO DB ACCESS during this pass** — `e2e:prod` held the local stack, so nothing
below is re-verified against a catalog yet; the fresh `supabase db reset --local` + `npm run test:db`
that AC-5 owes is still OUTSTANDING and its totals are not in this entry.

**MAJOR-1 — my door-sweep observation named the wrong mechanism.** VERIFIED myself at
`scripts/door-sweep-cases.sh:743` before writing a word, per the review: branch **4d** exists and was
added to close `FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION`, so *"its name extractor does not see
`alter function`"* is false. The match requires `security definer` in the matched text, deliberately
— the branch's own comment carries the measurement that `20260620000000_baseline.sql` holds **449**
`ALTER FUNCTION … OWNER TO "postgres";` lines a naive grep would swallow whole. The residual gap is
narrower than I wrote: `alter function … set <attribute>` on a function that is **already** DEFINER,
whose statement text therefore never contains the required clause. ⭐ **The wrong sentence was NOT
rewritten** (ADR 0105, append-only): a dated `⚠ CORRECTION` marker sits directly beneath it, carrying
the regex, the 449 measurement and the corrected gap. ⛔ The follow-up is the LEAD's to file with that
mechanism — not re-filed from here. The door-sweep VERDICTS are unaffected: tier 1 = 0 is still the
observed value, and the ruling still rests on the catalog-measured return types.

**MINOR-2 — `420`'s fixture pairing was not a total order.** `supabase/tests/420_…:~134`. Both the
`sa` and `comm` subqueries ordered on `m.principal_id` alone, which is not a total order over
`memberships`: a principal holding `staff_admin` in TWO commissions leaves the second subquery's row
arbitrary among that principal's rows, so `(sa, comm)` stops being provably ONE row. It holds on
today's seed only because the selected principal has exactly one commission — ⛔ a property of the
FIXTURE, not of the query, which is precisely the shape that reds later as a 42501 from
`clone_framework`'s cross-commission guard and gets read as a § 4 defect in the function. **The
change, exactly:** both subqueries now read `order by m.principal_id, m.commission_id limit 1`, so
each picks the SAME first row and § 4 always seats a hat over the commission it clones INTO. A
comment above them records the non-cosmetic reason. ⚠ **This is a non-comment change to a pgTAP file
and is UNVERIFIED** until the stack is released and `test:db` re-runs.

**MINOR-3 — a paraphrase ADR 0208 D5 does not carry.** I had written *"0208 D5 requires [a new ADR]
only to admit a SECOND compatibility form"*. Read at the source (`0208:239-241`): D5's sentence
constrains the SHAPE such a form would take — *"If a second compatibility form is ever admitted, it
is property-based … ⛔ never the current dominant string"* — and says nothing about when an ADR is
required. The airtight ground is **D4's verbatim ruling**, which already ORDERS this convergence and
so leaves no decision to take: *"…they may not grow and converge to the empty form on touch."*
Corrected in **two** homes:
- `docs/backend-state/authorization-and-audit.md` — the frozen slice's clause is corrected by an
  APPENDED `⚠ **Superseded**` line under its own heading, never in place; `npm run lint:backend-state`
  rc 0, block still 97/100. ⛔ The `## Current state` block does NOT repeat the paraphrase (its
  DEFINER bullet names no ADR clause), so it needed no refresh on this ground.
- `supabase/migrations/20261003007420_…sql:10` — ⚠ **a home the review did not name, corrected
  anyway and flagged to the lead.** Leaving a sentence QA has just ruled false in a second home is
  the "a partial fix reads as a complete one" shape. It is **comment-only**, changes no statement,
  and is covered by the reset + `test:db` still owed. ⛔ Permitted because this migration was applied
  in THIS unit on an unmerged branch, never in a prior phase (CLAUDE.md §8).

⛔ **Two homes deliberately left alone**, both named to the lead rather than edited: the lead's own
opening entry at `:20` of this record (the lead appends its own marker) and the HUB at
`docs/features/definer-temp-table-convergence.md:24`, which the lead owns.

```
npm run lint (full chain, no database)                       rc 0
npm run lint:backend-state                                   rc 0   block 97/100; largest seam 148.9 KB
npm run lint:progress                                        rc 0
npm run lint:registers                                       rc 0
supabase db reset --local + npm run test:db                  ⛔ OUTSTANDING — stack held by e2e:prod
```
