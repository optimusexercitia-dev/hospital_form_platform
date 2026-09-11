# QA review — `DEFINER-SEARCH-PATH-NARROW-FIX`

**Verdict: CHANGES REQUESTED**

> ⚠ **This is ROUND 1's verdict, kept as filed. The unit's OPERATIVE verdict is round 2's** —
> `**Verdict: APPROVED**` against fix commit `a6c4c83e`, in § *Round 2* at the foot of this file.
> ⛔ Do not read the line above as the unit's standing verdict.

**Subject:** build commit `68ffb591` on branch `definer-search-path-narrow-fix` (base `main @ 6d7dd589`;
`c044c06f` is the unit-opening docs commit).
**Reviewer:** `qa` · **Date:** 2026-09-11 · **Round:** 1
**Contract:** hub `docs/features/definer-search-path-narrow-fix.md` AC-1…AC-6 · ADR
[0208](../decisions/0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md)
D4–D6 · `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` (re-claused *Closes when* + § *Scope added*).

**Counts:** BLOCK 0 · MAJOR 2 · MINOR 4 · NOTE 6.

⛔ **Read-only posture held.** No application code, migration, spec or query was edited. Nothing was
run against the database except read-only `SELECT`s through `docker exec … psql -At`. No
`db reset`, no `test:db`, no `p0-authz-*`, no door-sweep script, no `e2e:prod`.

---

## Verdict rationale, in one paragraph

The build is, on its own terms, unusually strong: the freeze artifact is genuinely generated from
the catalog, the ratchet is directional by design and its legality arm is asserted *positively*, the
temp-table verdicts are effect-asserted with a discrimination control that reds with a named
SQLSTATE, and the `409 § 6.1` reshape refuses the cheap 3→2 repair and comes out strictly stronger.
I re-derived the frozen set from the live catalog independently and it reproduces the artifact
anchor and both `419` pins **exactly**. What blocks approval is not a hole in what was built — it is
that **two committed sentences claim more coverage than the gates deliver**, and one of them is the
`.claude/rules/` line every future migration author will read (MAJOR-1), while the other inverts a
fact the record itself argues is load-bearing (MAJOR-2). Both are text-only fixes. This is the same
failure family the unit's own register is about: *a designated authority answering a fraction of the
questions put to it*, and *absence of a verdict is not absence of coverage*.

---

## 1. Requirements audit — AC-1 … AC-6

| AC | Verdict | Evidence |
| --- | --- | --- |
| **AC-1** the 419 ratchet | **MET**, with MAJOR-1 on its stated bound | `supabase/tests/419_definer_search_path_freeze.sql:115-119` (offender NAMED) · `:133-145` (shrink legal, asserted positively *and* accounted for) · `:161-179` (planted new DEFINER, empty-form discrimination half) · generated artifact, `--check`/`--self-test` present |
| **AC-2** narrow migration, two members | **MET** | `supabase/migrations/20261003007410_…sql:42,44` — exactly two `ALTER FUNCTION`, no body re-emission; `app.tenant_orphan_profiles` untouched (verified live) |
| **AC-3** four temp-table DEFINERs measured | **MET**, with MINOR-3/MINOR-4 | `supabase/tests/420_definer_temp_table_empty_path.sql` — 13 assertions, effects not "did not throw", one ALTER per savepoint, § 6 planted 42P01 control, § 5/§ 5b restore + `prosecdef` pins |
| **AC-4** `.claude/rules/` hint | **MET in form, MAJOR-1 in content** | `.claude/rules/migrations-forward-only.md` 1997 B / cap 2048, dir at 12/12 (both re-measured); the line's *enforcer* clause is wrong — see MAJOR-1 |
| **AC-5** open half 1 ruled | **NOT MET — deferred to PO** | The disposition is **PROPOSED** in `FUP-…` § *OPEN HALF 1* and in the record, explicitly `PO to rule`. AC-5's verb is *ruled*. This is correctly disclosed, not concealed; ⛔ the hub checkbox may not be ticked before the PO rules (NOTE-4) |
| **AC-6** gates | **PARTIAL at review time** | `npm run lint` rc 0 (18 gates, incl. the new gate 18), `npm run typecheck` rc 0, `npx vitest run` rc 0 / 2091 passed — **all three re-run by me**. `test:db` and the door sweep are in the *could-not-verify* list; the four authz arms + the set-valued arm are **not yet in the record's gate block** (backend is running them now, per the uncommitted hub edit) |

### AC-1, checked against the four cells the task names

- **(a) offender NAMED** — `419:116-117` aggregates `sig` for `live \ frozen`, so a red prints the
  signature, not a count. ✓
- **(b) shrink legal proven POSITIVELY** — `§ 1b` (stays green) *and* `§ 1c` (the departure is
  accounted for, expected value `app.tenant_orphan_profiles()`, with `(NOTHING LEFT THE SET)` as the
  VOID sentinel). Without `§ 1c`, "shrink is legal" would be satisfied by an instrument ignoring the
  frozen side. ✓ The subject chosen is deliberately the function D6 says the migration must **not**
  touch, so the control cannot collide with a real convergence. ✓
- **(c) planted new DEFINER seen** — `§ 1d` plants **two** probes and pins that exactly the
  non-empty one is flagged, which is what bounds the ratchet on *non-emptiness* rather than on "a
  function absent from the artifact" (true of every new function). `§ 1e` then proves the *unflagged*
  probe was examined rather than excluded. ✓ This pair is better than the AC asked for.
- **(d) dead-instrument VOID ≠ PASS** — `(NOTHING FIRED)` / `(NOTHING LEFT THE SET)` sentinels in
  both directions, and the messages say to read them as VOID. ✓
- **frozen side from the committed `\ir`** — `419:69`, `\ir vectors/definer_search_path_freeze.psql`;
  the live side is a lazily-evaluated temp view (`v419_live`). Nothing is re-derived live on the
  frozen side. ✓ (LEARN-084 avoided.)
- **plan(N) vs emitted** — `plan(10)`, 10 assertions counted by hand (`§ 0a,0b,0c,0d,1a,1b,1c,1d,1e,2`);
  `420` is `plan(13)` against 13. Corroborated arithmetically: `main`'s `9025` + 10 + 13 = **9048**,
  the figure the record reports. The `§ 1e` `distinct` defect is gone (`419:174-176`), and no other
  in-savepoint assertion uses an aggregate Postgres rejects. ✓
- **`414` byte-unchanged** — `git diff 6d7dd589 68ffb591 -- supabase/tests/414_definer_search_path_resolves.sql`
  is **empty**. ✓

### AC-2, verified from the LIVE catalog, not migration text

```
app.can_read_professional_profile(p_profile_id uuid, p_uid uuid) | t | search_path=""
app.current_professional_read_organizations()                    | t | search_path=app, public, pg_catalog
app.tenant_orphan_profiles()                                     | t | search_path=app, public, pg_catalog
public.tenant_orphan_profiles()                                  | t | search_path=""
```

- Both converged functions kept `prosecdef = t` (a convergence that silently dropped DEFINER would
  be the worse defect; LEARN-074). ✓
- `app.tenant_orphan_profiles` and the `413` sibling are untouched. ✓
- **Bodies re-read from `pg_get_functiondef`**, not from the migration: the wrapper's whole body is
  `select t.profile_id, t.reason from app.tenant_orphan_profiles() t;`; the door's only unqualified
  call-shaped identifiers across its 135 lines are **`coalesce`** and **`now`**, both `pg_catalog`
  builtins, which resolve under `search_path = ''` because `pg_catalog` is searched implicitly when
  unnamed. Every relation is `public.*`, every helper `app.*` / `authz.*` / `auth.uid()`. The
  record's claim is **confirmed**, and it was confirmed the way it should be. ✓
- Live distribution after the migration: `app, public, pg_catalog` **824** · `public, pg_catalog`
  **39** · `""` **25** · `app, pg_catalog` **2** — total **890**, non-empty **865**, and the inverted
  `public, app, pg_catalog` bucket is **gone**. The ADR's five-value table is reproduced and the
  semantic singleton is discharged exactly as D6 demanded. ✓

### The independent verification that matters most

I re-ran the census block's own predicate against the live catalog and digested it:

```
rows=865 md5=915172dda6da2a51d69d22c3b6cbc276
```

That is byte-for-byte the artifact's anchor **and** the literals `419 § 0c` / `§ 0d` assert. So the
committed freeze matches the live catalog *today*, verified without running `test:db`. `authz`
independently returns **`0 of 10`**, matching `§ 0b`'s pin. ✓

---

## 2. Gate 18 — is it a real ratchet, and can it be laundered?

**Genuinely generated (ADR 0197 pattern).** `--write` reads the catalog through `docker exec psql`
with `ON_ERROR_STOP=1`; the domain lives once in `scripts/definer-search-path-census.sql` between
`>>> BEGIN definer_nonempty_domain <<<` markers, is extracted by text into the generator and spliced
by text into `419`, and `checkMirror` compares the two copies byte-for-byte. A domain that narrowed
in only one place reds; a domain narrowed in both would otherwise be silently clean, which is the
stated reason the block has one home. ✓

**`--check` proves shrink-only against a git baseline, exits 0/1/2.** `resolveBaseline()` tries local
`main` then `origin/main`, takes `merge-base HEAD <ref>`, and returns `null` **only** when neither ref
resolves — in which case the gate exits **2 = UNPROVEN**, printed, never a silent pass. The
clean/unproven/dirty partition is correct and `npm run lint`'s `&&` chain makes a 2 a red. ✓

**Every checker can fail — and I proved the ratchet arm bites on the REAL corpus, not only on
synthetic renders.** `--self-test` reports 17 cases, rc 0. Because the arm is at **GENESIS** on this
branch, I exercised it out-of-band against the committed 865-row artifact as baseline:

| mutation of the real artifact | `checkShrinkOnly` | `checkArtifact` |
| --- | --- | --- |
| +1 row (`zzz.zzz_new_definer(uuid)`) | **1 finding** — `THE FREEZE GREW by 1: …` | 3 findings (rows/sha/md5) |
| −1 row (`app._case_caps(...)`) | 0 findings, note `865 -> 864 (removed 1, added 0); converged: …` | n/a |

So the arm is live and directional on the real population. ✓

**GENESIS is handled honestly.** `checkShrinkOnly` returns a `note` whatever the verdict and the
summary line prints it, so "nothing to compare" is visible rather than reading as clean. ✓ The
baseline-preference order (local `main` first) is argued in the record and is the tighter choice. ✓
— but see MAJOR-2: `docs/lint-gates.md` states it backwards.

**Laundering attempts, each traced:**

| attempt | outcome |
| --- | --- |
| add a non-empty DEFINER, forget to regenerate | `419 § 1a` reds (live \ frozen) ✓ |
| add one and re-run `--write`, uncommitted | gate 18 reds — baseline is the branch point on `main` ✓ |
| add one, re-run `--write`, **commit on a branch** | gate 18 still reds — merge-base is still the branch point ✓ |
| hand-delete a still-non-empty row from the artifact | shrink is legal here, but `419 § 1a` reds; and the anchor (rows/sha/md5) reds unless all three are recomputed ✓ — two arms, as designed |
| swap one non-empty path for a *different* non-empty path | invisible to both — **declared** in the generator header (`:48-51`) as the AC-1 shape; `414` holds resolvability ✓ |
| add one, re-run `--write`, **commit directly on `main`** | **NOT caught** — see MINOR-1 |
| write a new DEFINER on `''` with an **unqualified persistent relation** | **NOT caught by anything** — see MAJOR-1 |

---

## 3. `420` — the four verdicts

- **Effects, not "did not throw".** Every arm compares destination counts against source counts
  (`items`/`sections`, `phases`, `answers`+`selopts`, `standards`+`rewired`), and `§ 0` separately
  proves each source is non-trivial, so "copied 0 of 0" cannot pass. The runners return
  `sqlstate :: message` on exception, so an unexpected failure is reported as text rather than
  collapsing into a bare false. ✓
- **One ALTER per savepoint**, each rolled back, with the function's live `proconfig` carried **inside
  the expectation** — a mutation that did not apply cannot report green (`:198-202`, `:222-224`,
  `:245-249`, `:268-269`). ✓ This is exactly the guard the "mutation did not fully apply" lesson asks
  for.
- **`§ 6` is a paired control**, not a bare negative: `§ 6a` proves the planted DEFINER works on the
  three-schema path (so a control that had simply stopped working cannot satisfy `§ 6b`), `§ 6b`
  requires `42P01` under the identical ALTER, and the message says an `OK` there reads `§§ 1b/2b/3b/4b`
  as **VOID**. ✓
- **`§ 5` + `§ 5b`** prove restoration *and* that all four remain `prosecdef` on a non-empty path, so
  "free" is explicitly a finding for a future convergence and not one this unit performed. ✓
- **The `clone_framework` caller fix is legitimate and does not weaken the test.** The door denied
  `42501` *before* reaching its temp table; fixing the expectation would have left the temp-table code
  untested (*an earlier guard firing leaves the LATER one untested*). Seating a real `staff_admin`
  through `test_helpers.claims_for(uuid, boolean, text)` is the correct direction of fix — and I
  confirmed from the live catalog that `claims_for` actually **seats** the claims
  (`set_config('request.jwt.claims', …, true)` with `sub` + `active_role`), so a bare `sub` genuinely
  would not have been enough. `§ 4a`'s message even names a `42501` as the VOID signal. ✓ The
  GLOBAL-framework fixture change is likewise forced by `clone_framework`'s own cross-commission
  guard, not chosen to make the test pass. ✓

---

## 4. `413` / `409` — the pin flip and the reshape

- **`413`** flips only `app.can_read_professional_profile` to `search_path=""`; the sibling
  `app.current_professional_read_organizations` stays on the three-schema string, and the added dated
  comment (`413:193-201`) says the new value is *what the migration is required to emit*, not what the
  catalog now holds — which is precisely the trap the original comment two lines above warns about. ✓
- **`409 § 6.1` is strictly stronger than what it replaced.** Old: a count of 3 over a `WHERE` that
  *filtered* on `prosecdef` and on membership of the three-schema string. New: a named
  `proname:prosecdef:proconfig` list per function, ordered, compared as one literal string. It reds on
  a dropped function (missing element), a duplicate/overload (extra element), a lost `prosecdef`
  (visible `false` instead of a silent departure from the set), a changed value, **and** a swap — the
  last three of which the count could not see. Refusing the 3→2 repair was correct, and the refusal is
  recorded with its reason in the file. ✓

### My own enumeration of readers of the constant — the record's claim holds

I re-ran the sweep the record describes, independently, over `supabase/tests`, `scripts/`, `src/`,
`e2e/` and `docs/backend-state/`, and then chased every candidate rather than counting hits:

- **Literal-value readers** of `search_path=app, public, pg_catalog`: `292:55`, `323:139`, `326:179`,
  `328:915`, `329:55`, `329:454`, `330:503`, `341:224`, `394:674/690`, `396:160`, `398:147-154`,
  `399:147-150`, `400:126`, `413:189`, `417:332`, `420:283`. **None of their door sets contains either
  converged function** — I read each predicate: `323` is the two printed-document doors, `326` the 23
  referral doors, `328/329` the document-model doors, the rest name other functions explicitly. The
  `like '%…%'`/`~` forms would **not** have matched `search_path=""`, so had either converged function
  been inside one of those sets it would have reded — it is not a case of a weak matcher passing
  vacuously.
- **Other catalog readers touching the two names**: `395:603` reads ACLs (`has_function_privilege`),
  `396:894/900` read `obj_description`, `311:247` and `413:254` read `prosrc`, `401:1384` reads
  `proargnames`, `393:313` reads the untouched `app` function. None reads `proconfig` for a converged
  function.
- ⇒ **`409 § 6.1` was the only affected reader.** The record's enumeration is **complete**, and the
  lesson it cites afterwards (*a change that flattens a curve invalidates every control READING it —
  enumerate, never recall*) was applied correctly, if late.

---

## 5. `.claude/rules/` and the backend-state seam

- `.claude/rules/` holds **12** files against `MAX_RULES = 12`, and
  `migrations-forward-only.md` is **1997** bytes against `MAX_RULE_BYTES = 2048` — both re-measured by
  me from `scripts/check-rules-staleness.mjs:58-59` and `wc -c`. The record's figures are exact. Gate 8
  green inside `npm run lint` rc 0. ✓ Refusing both "retire a rule" and "raise the cap" as separate
  subjects, and registering the deferral as a follow-up rather than remembering it, is the right call. ✓
- **Seam** `docs/backend-state/authorization-and-audit.md`: the slice **§ The non-empty DEFINER
  `search_path` population is FROZEN** is appended at the tail, the `## Current state` block is
  **replaced** (not appended to), the *Where the detail lives* index gains the new section and corrects
  the now-false "*ruled there, built nowhere yet*", and the stale "*and the 867 paths*" clause is
  removed. `npm run lint:backend-state` rc 0 inside the chain; the gate reports the block at **96/100**
  lines. ✓ The compression-to-fit was done by pointing at the frozen slice rather than by cutting a
  bound — the two-arm partition, "gate 18 never opens a database", and both PO-to-rule items all
  survive in the block, which is the right way to answer that ratchet.

---

# Findings

## MAJOR-1 — D4 is a **two-clause** convention; only one clause is gated, and three committed sentences say otherwise

**Where:** `.claude/rules/migrations-forward-only.md:38-39` · `scripts/gen-definer-search-path-freeze.mjs:34-51`
(*WHAT THIS GATE DOES NOT PROVE*) · `supabase/tests/419_definer_search_path_freeze.sql:6-25` ·
`docs/backend-state/authorization-and-audit.md` (the new bullet in § Invariants).

**Requirement violated:** ADR 0208 D4, verbatim — *"`SET search_path = ''` **with schema-qualified
object references** is the sole forward convention"*; and CLAUDE.md § 8 / ADR 0127's bar that a rule
is a hint whose **enforcer must be named accurately**.

The rule line reads:

> **SECURITY DEFINER (ADR 0208 D4): new or touched ⇒ `set search_path = ''` + schema-qualified
> body; enforcer = pgTAP 419 + gate 18, not this line.**

`419` and gate 18 enforce the **path** clause. **Nothing in the tree enforces, or even observes, the
schema-qualified-body clause.** A new DEFINER written `set search_path = ''` with an unqualified
persistent relation reference is:

- invisible to `419 § 1a` — it is empty-path, so it never enters the live non-empty set;
- invisible to gate 18 — it never enters the artifact;
- invisible to `414` — there are no schemas named to resolve.

And this is not a theoretical clause. **`420`'s own header measures the mechanism that makes it
matter**: under `search_path = ''` Postgres still searches `pg_temp` **implicitly and first** for
relation names. So the empty path does **not** by itself close the shadowing threat ADR 0208 D5 cites
as its reason for preferring it — `anon`/`authenticated`/`service_role`/`authenticator` all hold
`TEMP` (4 of 4, per the ADR). The safety of the empty form comes **entirely** from the second clause,
which is the ungated one. `420 § 6b`'s `42P01` is the *absence* of a temp `profiles`, not a proof
that the empty path is hijack-proof.

⛔ This is the project's own named failure family: a designated authority (the rule line names an
enforcer) that answers only part of the question, with **no artifact stating the bound**. The
generator header carefully states two other bounds — *never opens a database* and *the frozen set is
NAMES* — and this third, larger one is absent.

**Not claimed:** a live exposure. Both converged bodies are verified qualified; no application role
holds `CREATE` on `app`/`public`/`authz`.

**To clear (text only, no code):**
1. Correct the rule line so the enforcer clause is true — e.g. *"enforcer for the PATH = pgTAP 419 +
   gate 18; ⛔ the schema-qualified half is **ungated** — a body naming an unqualified relation under
   `''` resolves through `pg_temp`, which every client role can write."*
2. Add the same bound to the generator's *WHAT THIS GATE DOES NOT PROVE* block and to `419`'s header,
   beside the two bounds already there.
3. Add the bound to the backend-state bullet, which currently states the two-clause convention and
   then describes a two-arm enforcement that covers one clause.
4. File a follow-up for the unmeasured half (a catalog check that an empty-path DEFINER's `prosrc`
   names no unqualified relation is *feasible but not trivially decidable*, so the honest close may be
   a PO ruling that it stays a review obligation — either way it belongs in the register, not in
   nobody's head).

---

## MAJOR-2 — `docs/lint-gates.md`'s gate-18 row states the baseline preference **backwards**, in the document that explains the gate

**Where:** `docs/lint-gates.md`, the `lint:definer-freeze` row:

> …because `--check` resolves the artifact's git baseline (**`merge-base HEAD origin/main`, then
> `main`**) and refuses any diff that is not a pure deletion.

**Measured:** `scripts/gen-definer-search-path-freeze.mjs:328` — `for (const cand of ['main',
'origin/main'])`. **Local `main` first, `origin/main` second.**

The record (`docs/progress/definer-search-path-narrow-fix.md`) not only gets it right, it argues the
order is load-bearing: this repo routinely leaves `main` unpushed, so `origin/main`'s merge-base
yields an **older, LARGER** frozen set against which a set that had grown since could still pass as a
subset. ⇒ the documented order is precisely the **looser** one, and a reader reasoning about the
gate's strength from `docs/lint-gates.md` reasons from the weaker baseline. This is the
*paraphrase-inverts-the-sentence* shape, committed, in the one file whose job is to explain why each
gate exists.

**To clear:** correct the row to `merge-base HEAD main`, falling back to `origin/main`, and carry the
one-clause reason (unpushed `main` ⇒ the tighter baseline is the local one).

---

## MINOR-1 — gate 18's shrink arm is vacuous for a growth **committed directly on `main`**, and the prose does not say so

**Where:** `scripts/gen-definer-search-path-freeze.mjs:322-349` and the header's
*"the shrink-only property is checked HERE, against the artifact's own git baseline, **where
re-running the generator cannot help**."*

When `HEAD` is `main`'s tip, `merge-base HEAD main` **is** `HEAD`, so the baseline is the committed
artifact itself: a grown artifact that has been committed on `main` compares equal to itself and the
arm returns clean. The claim is true on a branch (verified: on this branch `merge-base = 6d7dd589 =
main` tip) and true for an *uncommitted* growth on `main`; it is false for a growth committed on
`main`. This repo does commit directly on `main` (the ledger/merge commits in `git log`).

Low likelihood — migrations land on unit branches and the gate runs pre-merge — but the sentence
overclaims, and an overclaimed bound is what this unit is otherwise scrupulous about.

**To clear:** either state the bound in the header (*"the arm is a branch-point ratchet; a growth
already committed on the baseline ref is absorbed"*), or resolve the baseline as the **previous
commit that touched the artifact** (`git log -2 --format=%H -- <path>`) when `HEAD` is the baseline ref.

---

## MINOR-2 — **867** is committed in two homes, and the same commit made it **865**

**Where:** `scripts/gen-definer-search-path-freeze.mjs:15-16` (*"The **867** existing non-empty paths
are frozen compatibility debt"*) · `docs/lint-gates.md`, gate-18 row (*"the **867** existing non-empty
paths (measured 2026-09-11 over `app`/`public`/`authz`)"*).

Measured live: **865**. Both figures were correct before `20261003007410`, which ships **in the same
commit** — so they were stale on arrival. `419:8` gets this right (*"the 865 remaining … (867 before
migration `20261003007410` converged two of them)"*) and is the model to copy.

⚠ This is the exact defect the subject follow-up carries a dated correction about — *"a live count in
ungated prose is precisely what rotted here, twice"* — and neither of these two homes is gated.

**To clear:** restate both on the property, or use `419:8`'s form (865, with 867 as dated history).

---

## MINOR-3 — `420 §§ 1/2` reach their subjects only through wrappers, and nothing pins that the wrapper still routes the subject

**Where:** `supabase/tests/420_definer_temp_table_empty_path.sql:117` (`public.clone_form_version`),
`:126` (`public.clone_template_version`).

`§ 1b` / `§ 2b` ALTER `app.copy_version_children` / `app.copy_template_version_children` and then call
a **wrapper**. The `[cfg …]` in the expectation proves the ALTER *applied*; nothing proves the altered
function was **on the call path**. If a future change inlined the copy into the wrapper, both arms
would stay green while measuring nothing — a silent VOID of the kind this file otherwise guards
against everywhere. (`§ 3` and `§ 4` call their subjects directly and are unaffected.)

I verified the routing holds **today** from `pg_proc.prosrc`: `clone_form_version` references
`copy_version_children`, `clone_template_version` references `copy_template_version_children`. So this
is a durability finding, not a live vacuity.

**To clear:** one assertion pinning that each wrapper's live body names its subject (the same
`prosrc`-reference idiom `311 § 5.2` and `413 § 5b` already use), or call the two subjects directly.

---

## MINOR-4 — `pg_temp.cfg420(schema, name)` is overload-blind, and its correctness today is a catalog accident

**Where:** `supabase/tests/420_definer_temp_table_empty_path.sql:108-110`.

```sql
create or replace function pg_temp.cfg420(p_schema text, p_name text) returns text language sql stable as $$
  select coalesce(array_to_string(p.proconfig, ','), '<none>') from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace where n.nspname = p_schema and p.proname = p_name $$;
```

Keyed on `proname` with **no argument types**. A SQL function returning a scalar over a multi-row
query silently returns the **first** row, so with an overload present the `[cfg …]` witness — the very
thing that proves each ALTER applied — could read a *different* function's `proconfig` and report
green. `§ 5`'s restore assertion has the same exposure.

Measured: no overloads exist for the four names today (1 each), so every reading in the file is
correct. But the guard's soundness rests on a catalog fact nothing asserts, in a file whose whole
argument is *measure, don't assume*.

**To clear:** key `cfg420` on `regprocedure`/`pg_get_function_identity_arguments`, or add a cardinality
cell (`count(*) = 4` over the four `(nspname, proname)` pairs) beside `§ 5b`.

---

## NOTE-1 — the ratchet's domain is three schemas; two repo-authored DEFINERs sit outside it

Measured live, `prosecdef` functions **outside** `app`/`public`/`authz`: `vault` 2 (`search_path=""`),
`net` 2, `supabase_functions` 1 (vendor), and **`test_helpers` 2** —
`test_helpers.claims_for` and `test_helpers.attach_stub_file`, both repo-authored, both
`SET search_path TO 'public', 'pg_catalog'` (non-empty). They are outside `414` and outside `419` by
construction. `419 § 0a` pins the domain as a named set and reds if a schema **leaves** it, but cannot
see a **fourth** schema gaining DEFINERs.

Both the ADR and the follow-up scope the population to the three schemas, so this is within spec —
but "the class" is not fully closed, and `test_helpers` is where a fixture DEFINER would plausibly be
written next. Worth one sentence in the census file's *WHAT THE DOMAIN DELIBERATELY EXCLUDES* block
(which today names only the `sp is null` exclusion).

## NOTE-2 — gate 18's ratchet arm has never run against a real baseline **in-tree**

It reports `GENESIS` on this branch and will only become live after the merge. That is honest and
printed. I exercised it out-of-band against the real 865-row artifact (table in § 2 above) and it
bites correctly in both directions — but the *first in-tree* exercise is owed at the next unit's gate.
Recommend the lead records that as an expectation rather than letting the first green post-merge run
read as "the arm was always live".

## NOTE-3 — `419`'s plan-mismatch note is right but could teach the wrong dismissal; `420` has the same shape and no note

`419:34-37` declares `# Looks like you planned 10 tests but ran 7` EXPECTED, explaining that pgTAP's
internal counter unwinds with each `rollback to savepoint` while the TAP stream pg_prove parses is
already emitted. The arithmetic supports it (`9025 + 10 + 13 = 9048`, so pg_prove counted all 10).
⚠ But the **real** detector for the `§ 1e` defect shape — a test silently dropped by a savepoint
recovering an error — is pg_prove's own *"Bad plan"* on `1..10` against 9 emitted `ok` lines, and that
**is** a failure. Add half a sentence saying so, or a future reader dismisses a genuine bad-plan red on
the authority of this note. `420` carries four savepoints with assertions inside and no note at all.

## NOTE-4 — AC-5 is **PROPOSED**, not ruled

The hub's AC-5 says *"ruled"*; the disposition is explicitly `PO to rule` in both the record and the
follow-up. Correctly disclosed. ⛔ The hub checkbox must not be ticked at the Record step unless the PO
rules at approval; if the PO defers, AC-5 should be restated or carried as an open item rather than
closed by the unit.

## NOTE-5 — the door-sweep rows are, by construction, unverifiable from the repo

The record states the arm artifacts were copied into a directory excluded through
`.git/info/exclude` and never committed. That is the right call against the *cited-line-number-rots*
lesson, and the ⛔ paragraph about the **discarded arm pair** (a watcher reporting verdicts for a run
still in flight, mechanism **unresolved**, stated rather than guessed) is exactly the disclosure this
review wants to see. ⇒ every figure in those rows is on my *could-not-verify* list by design, not by
omission. The one mechanical claim in that block I **could** check, I did: `p0-authz-door-audit.sh`
contains **0** expansions of `FROMFINDINGS` (`grep -cE '\$\{?FROMFINDINGS'` → 0), while
`p0-authz-invariant.sh` reads it at `:107`, `:323`, `:800`. **The finding is correct**: the second
invocation was the first arm repeated, and the predicate/policy relabelling is the accurate one. The
hand-off of the same signature in `docs/progress/arm3-hat-term-fix.md` is properly a lead item, not
this unit's to repair.

## NOTE-6 — the gate block is incomplete at review time, and the working tree has drifted from the review subject

The record's gate block carries no row for the four authz arms (`census` / `hat` / `floor` /
`FROMFINDINGS=1 ARM=wrapper`) or the set-valued arm. The uncommitted hub edit says `backend` is
running them now. AC-6 as written asks only for the door sweep, so this is not an AC miss — but this
migration changes the security attributes of a `prosecdef` authorization door, so those rows belong in
the block before the PO sees it. ⚠ Also: `docs/features/definer-search-path-narrow-fix.md` and
`docs/followups/follow-ups-open.md` carry **uncommitted** edits beyond `68ffb591`; this review is of
the commit, and those two files were read as of the commit except where noted here.

---

# Could not verify — this is a work item, not a pass

1. **`npm run test:db` = `Files=269, Tests=9048, Result: PASS` on a fresh `supabase db reset`.** The
   local stack is `backend`'s and I was instructed not to touch it. *Partially corroborated:*
   `supabase/tests/*.sql` is **269** files (counted), and `9025` (main's tip, per the arm3 record) + 10
   (`419`) + 13 (`420`) = **9048** exactly, which is a real constraint on both new plans.
2. **The red-first witnesses** — `419 § 0c/0d/1a/1b/1c/1d/1e` RED against an empty artifact stub;
   `§ 0a/0b` green on their first run and declared as instrument guards; the `413` pin observed RED
   alone (`ok=28 notok=1`) before the migration and green after. All require running the suite.
3. **Every door-sweep row**: `SELFTEST=1 … 46 · 0 · 0`, `bash --version 5.2.37`,
   `door-sweep-cases.sh 6d7dd589` rc 1, `SWEPT 1 · COVERED 1 · BLIND 0 · NOTICED 0 · ERROR 0`,
   `0 selected of 226`, `ARM-DOMAIN predicate=1/127 policy=0/226 out-of-domain-bool=35`, `resets=0`,
   the committed-findings cksum, the three deriver GROUP lines, and the quoted `SCOPE:` line —
   forbidden to run, and the artifacts are deliberately not in git. The PO ruling on the derivation's
   exit 1 is quoted verbatim and is the PO's to confirm, not mine.
4. **`420`'s four per-function verdicts** and **`419`'s TAP behaviour under `rollback to savepoint`** —
   both need `test:db`. The *files* are reviewed above; the *runs* are not.
5. **`npm run gen:types` → no diff.** Not run (needs the DB and writes a tracked file). Consistent with
   the tree: `git status` shows no `src/lib/types/database.ts` drift, and `ALTER FUNCTION … SET
   search_path` changes neither signature nor return type, so the claim is structurally sound.
6. **The discarded arm pair's mechanism.** The record says it was not resolved; I could not resolve it
   either, and I agree with the disposition (quote from an artifact you can still read, or do not
   quote).
7. **The four authz arms / set-valued arm** — in flight at `backend` as this review was written.

---

# What I re-ran myself (rc, verbatim)

```
npm run lint            rc 0   18 gates; lint:definer-freeze -> "in sync (865 frozen non-empty DEFINER paths;
                               GENESIS … [baseline main (6d7dd589ae24)])"
npm run typecheck       rc 0
npx vitest run          rc 0   Test Files 154 passed · Tests 2091 passed
node scripts/gen-definer-search-path-freeze.mjs --self-test   rc 0   "OK (17 cases; every checker red on its own mutation)"
node scripts/gen-definer-search-path-freeze.mjs --check       rc 0
live catalog (read-only SELECT)  rows=865 md5=915172dda6da2a51d69d22c3b6cbc276   == artifact anchor == 419 § 0c/§ 0d
live catalog (read-only SELECT)  authz 0 of 10   == 419 § 0b
live catalog (read-only SELECT)  824 / 39 / 25 / 2 = 890; the public,app,pg_catalog bucket is GONE
real-corpus mutation of the freeze artifact   +1 row -> 1 finding · -1 row -> clean (the ratchet bites)
git diff 6d7dd589 68ffb591 -- supabase/tests/414_…sql    EMPTY (414 byte-unchanged)
grep -cE '\$\{?FROMFINDINGS' supabase/tests/mutation/p0-authz-door-audit.sh    0
```

---

# Summary

The engineering is right and, in several places, better than its own acceptance criteria — the
two-probe control in `419 § 1d/1e`, the paired `§ 6a/6b` discrimination in `420`, the refusal of the
3→2 repair in `409`, the refusal to converge the four measured-free DEFINERs, and the decision to
record rather than remember the rules-cap deferral. The two MAJORs are both **sentences**, not
mechanisms: one names an enforcer for a clause it does not enforce, the other inverts the gate's own
baseline order. Fix those four homes plus the four MINORs and this is an approval.

**Next round:** re-check MAJOR-1's four homes, MAJOR-2's row, the two `867`s, the `420` wrapper and
`cfg420` cells — and quote the completed gate block (the four authz arms + `test:db` on a fresh reset)
so the could-not-verify list shrinks rather than carrying forward.

---

# Round 2 — re-check against fix commit `a6c4c83e`

**Verdict: APPROVED**

**Subject:** `a6c4c83e` (arms docs commit `0a9201a8` between; base for this round `68ffb591`).
**Date:** 2026-09-11 · **Constraints:** unchanged — no `db reset`, no `test:db`, no authz/door
scripts; the lead is running `npm run e2e:prod` on the stack. New this round: I was cleared to read
`.dsp-gate-evidence/` (git-excluded), which retires most of r1's could-not-verify list.

**Round-2 counts:** BLOCK 0 · MAJOR 0 · MINOR 1 (carried, one-line, pre-merge) · NOTE 4.
**Round-1 disposition:** 2 MAJOR **fixed** · 4 MINOR **fixed** · 6 NOTE — 3 fixed, 3 answered.

---

## r1 findings, re-checked one by one

| r1 | status | where I checked it |
| --- | --- | --- |
| **MAJOR-1** D4's qualified-body clause ungated, enforcer misattributed | **FIXED in all four homes, and better than asked** | `.claude/rules/migrations-forward-only.md:38-39` now reads *"419 + gate 18 gate the PATH ONLY; the qualified half is UNGATED — `pg_temp` still resolves first under `''`"* · `gen-definer-search-path-freeze.mjs:57-65` (a third bound beside the two that existed) · `419:31-37` · the seam bullet. All four name the mechanism (`pg_temp` first, TEMP 4 of 4) rather than just the gap, and all four cite the new follow-up |
| **MAJOR-2** `lint-gates.md` baseline order backwards | **FIXED** | The row now reads *"local `main` FIRST, `origin/main` second … `origin/main`'s merge-base is often many commits behind and yields an older, LARGER frozen set"* — matching `resolveBaseline`'s `['main','origin/main']` and carrying the reason, not just the order |
| **MINOR-1** branch-point ratchet / "re-running cannot help" overclaim | **FIXED** | `gen-definer-search-path-freeze.mjs:34-41` and the gate-18 row both now state the vacuous case (a growth committed directly on `main`) **and** name `419` as the arm that still catches it. That second half is the right answer — it converts a bound into a partition |
| **MINOR-2** two stale `867`s | **FIXED** (a third, rhetorical one survives — NOTE-r2-2) | `gen-…:15-17` and `docs/lint-gates.md:38` both restated in `419:8`'s form (865, with 867 as dated history naming the migration) |
| **MINOR-3** `420 §§ 1/2` route through wrappers unpinned | **FIXED** — `420 § 5c` (new) | Reads each wrapper's LIVE `pg_get_functiondef` and requires `routes`. ⭐ I measured its strength rather than assuming: each wrapper names its subject **exactly once**, and that occurrence **survives `--` comment stripping** (`total=1 stripped=1` for both), so the match is on the call, not on a comment |
| **MINOR-4** `cfg420` overload-blind | **FIXED, both halves** | `cfg420` re-keyed on `p_sig::regprocedure` (resolves one oid or **raises**), all **6** call sites converted (0 two-argument calls remain), plus `420 § 5d` (new) pinning exactly one overload per name, so the still-name-keyed `§ 5` / `§ 5b` rest on an asserted fact |
| **NOTE-3** plan-mismatch note could teach the wrong dismissal; `420` had none | **FIXED, and now empirically grounded** | Both files carry the caveat: *"a mismatch in pgTAP's diagnostic is noise; a mismatch in the PLAN is the finding"*, naming pg_prove's **"Bad plan"** as the live detector for the `§ 1e` defect shape. See MINOR-r2-1 for the one figure that is still wrong |
| **NOTE-4** AC-5 must not be ticked | **HELD** | The hub has **zero** `- [x]` checkboxes; AC-5 is still `- [ ]` at `:45`, and the *Done since start* line still says *PROPOSED … PO to rule* |
| **NOTE-6** gate block incomplete | **CLOSED** | The four authz arms + the set-valued arm are now rows in the gate block, each traced below |
| **NOTE-1 / NOTE-2 / NOTE-5** | answered / unchanged by design | NOTE-1 (out-of-domain schemas) and NOTE-2 (GENESIS) are bounds, not defects; NOTE-5's mechanism claim I re-verified *empirically* this round (below) |

`plan(15)` in `420` matches **15** `select is(...)` assertions, counted; the `RUN SHAPE` line moved to
`Tests=16` in the same edit. `419` is unchanged at `plan(10)` / `Tests=11`. ✓

---

## Evidence traced to `.dsp-gate-evidence/` — which rows, and which remain untraceable

⚠ **Stated plainly: reading these files confirms the record quotes them FAITHFULLY. It is not an
independent re-run** — they were produced by `backend`, and I was barred from re-running any of them.
Two different claims, and only the first is now discharged.

**Traced to a file:**

| gate-block row | file | what it says |
| --- | --- | --- |
| `ARM=census … 581 / 608` | `arm-census.txt:8-9` + tail | `live authz gates (catalog): 581` · `gates carrying a verdict: 608` · `=== INVARIANT HOLDS ===` · `RC_census=0` |
| `ARM=hat … 4 finding(s)` | `arm-hat.txt` | the four named (`authz.assignment_facts`, `public.assume_role`, `public.session_context`, `memberships_select`), all reasoned-allowlisted · `RC_hat=0` |
| `ARM=floor … 63` | `arm-floor.txt` | `authenticated-reachable prosecdef doors with 0 calls: 63`, every one allowlisted, **and** every allowlist entry resolves to a live door (the two-directional form) · `RC_floor=0` |
| `FROMFINDINGS=1 ARM=wrapper … BLIND 41` | `arm-wrapper.txt` | `mode: FROMFINDINGS (comparing COMMITTED findings md, no sweep)` · `BLIND set size: 41` · `RC_wrapper=0` |
| `authz-setvalued-targeted-cases.sh rc 0` | `setvalued.txt` | `ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2` · three COVERED by name · `RESULT: CLEAN` · `RC_setvalued=0` |
| `test:db … Files=269, Tests=9050, PASS` | `testdb-qa.txt` | `Files=269, Tests=9050` · `Result: PASS` · `TESTDB_RC=0` · **0** `^not ok` lines in 4.1 MB · `419_…sql … ok` and `420_…sql … ok` both present |
| `supabase db reset --local` | `reset-qa.txt` | `RESET_RC=0` |
| `npm run lint` rc 0 | `lint-qa.txt` | `LINT_RC=0`, gate 18's summary line present |
| targeted re-run `419` 10/10, `420` 15/15 | `fix-419-420.txt` | `ok 1`…`ok 10` for 419; `1..15` then `ok 1`…`ok 15` for 420; **0** `not ok` |
| ⛔ the discarded-pair / "one arm twice" finding | `arm1.mine.txt` vs `arm2.mine.txt` | **`diff` is exactly one changed line** — `ARM1_RC=0` → `ARM2_RC=0`. In r1 I could only prove this from the script (`grep -cE '\$\{?FROMFINDINGS'` = 0); it is now proven from the outputs themselves |

**Still untraceable, and why:** the door-sweep rows themselves — `SELFTEST … 46 · 0 · 0`,
`door-sweep-cases.sh 6d7dd589` rc 1, `SWEPT 1 · COVERED 1 · BLIND 0 · NOTICED 0 · ERROR 0`,
`0 selected of 226`, `ARM-DOMAIN predicate=1/127 policy=0/226 out-of-domain-bool=35`, `resets=0`, the
committed-findings cksum, the three deriver `GROUP` lines, `bash --version`, and the quoted `SCOPE:`
line. `arm1.mine.txt` / `arm2.mine.txt` are those runs' outputs and I read them for the identity check
above, but I was barred from re-running the sweep, so the *verdicts* remain quoted-not-reproduced.
Likewise `npm run gen:types` → no diff (needs the stack and writes a tracked file; the clean
`git status` is consistent with it). The **discarded arm pair's mechanism** is still unresolved —
`discard.md` records the observation, not a cause, which is the honest state.

---

## The `9048` / `9050` labelling — correct, and the distinction is the right one

The gate block now carries **two different numbers at two different moments, each labelled**:

- `preflight, both runs … Files=269, Tests=9048  [⛔ NOT updated: this is what the sweep CAPTURED then]`
- `npm run test:db … Files=269, Tests=9050  [re-run after the QA r1 fix pass; TESTDB_RC=0 read from the file]`

`9048 → 9050` is exactly `§ 5c` + `§ 5d`, and the arithmetic closes end to end: `9025` (main's tip)
`+ 10` (`419`) `+ 13` (`420` at r1) `= 9048`; `+ 2` (r2) `= 9050`. ⭐ **Refusing to rewrite the
captured preflight witness to match the later run is correct** — a captured witness rewritten to agree
with a newer measurement is a falsified artifact, and this is the second time this unit has taken that
branch (the first was renaming the sweep artifacts before anything could re-run over them). Both
numbers are traced to files above.

---

# Round-2 findings

## MINOR-r2-1 (carried, one line, pre-merge) — `419`'s plan-mismatch example is a figure its own runs do not produce

**Where:** `supabase/tests/419_definer_search_path_freeze.sql:34-37` —

> ⚠ `# Looks like you planned 10 tests but ran 7` is EXPECTED and is not a failure…

**Measured, over the whole 269-file suite** (`testdb-qa.txt`, and the targeted run in
`fix-419-420.txt`):

```
grep -oE "planned [0-9]+ tests but ran [0-9]+" testdb-qa.txt | sort | uniq -c
      1 planned 15 tests but ran 13          <- 420, and the file is still reported "ok"
grep -c "planned 10 tests" testdb-qa.txt fix-419-420.txt   ->  0   0
```

⇒ **`419` emits no plan-mismatch diagnostic at all**, in either run. The `7` is an invented figure, and
the sentence pre-authorises dismissal of a diagnostic for the one of the two files that never prints
one. If `419` ever *does* print `planned 10 … but ran N`, its own header says to ignore it — which is
precisely the inversion the r2 fix added the *"do not generalise that dismissal"* half to prevent.
(`420`'s note is correct and now has a measured example.)

**Not a blocker:** it is a comment; the live detector (pg_prove's "Bad plan") is intact, and `420`'s
behaviour in the final suite — diagnostic printed, file reported `ok` — is the empirical proof that
r1's NOTE-3 mechanism claim was right.

**To clear (no re-review needed):** replace the invented example with the measured one, e.g.
*"⚠ A `# Looks like you planned N tests but ran M` line from pgTAP's own `finish()` is noise, not a
failure: its internal counter unwinds on `rollback to savepoint` while the TAP stream pg_prove parses
is already emitted. Measured 2026-09-11 over the full suite: this file emits none; `420` emits
`planned 15 tests but ran 13` and is still reported `ok`."* Keep the existing ⛔ "Bad plan" half
verbatim.

## NOTE-r2-1 — the new follow-up's shape is right; its wording is the PO's to confirm

`FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED` exists at
`docs/followups/follow-ups-open.md:1976` with no separate body file; `lint:registers` rc 0 accepts that
shape. Its `Closes when` is `PO to rule`, which is right — a body-qualification check is *feasible but
not trivially decidable*, so whether it becomes a gate or a standing review obligation is a PO call,
exactly as the entry says.

## NOTE-r2-2 — a third `867` survives four lines below its own correction

`scripts/gen-definer-search-path-freeze.mjs:19` still reads *"the list this tree would have to
hand-type is **867** signatures long"*, immediately under the corrected `:15-17`. Harmless (the
sentence is rhetorical), but it now disagrees with its own paragraph — sweep it with MINOR-r2-1 if the
file is touched again. ⚠ The `867` at `docs/backend-state/authorization-and-audit.md:1257` is **not** a
finding: it sits inside the frozen ADR-0207/0208 slice, is correct as of that slice, and history is
append-only under ADR 0196 D5.

## NOTE-r2-3 — `420 § 5c`'s matcher does not strip comments, and today that costs nothing

`§ 5c` matches on raw `pg_get_functiondef`, so a wrapper that inlined the copy but kept a comment
naming the subject would still read `routes`. Measured rather than speculated: each wrapper names its
subject **exactly once**, and the occurrence survives `regexp_replace(…, '--[^\n]*', '', 'g')`
(`total=1 stripped=1`, both). So the guard is exact today. If it is ever hardened, `311 § 5.2`'s
comment-stripping idiom is the precedent already in this tree.

## NOTE-r2-4 — the generator's two-container guard is not hypothetical on this machine

While reviewing, `docker ps` showed **two** healthy `supabase_db_*` containers (this project's and
`supabase_db_escalume` from a sibling repo). `dbContainer()` resolves the exact one from
`supabase/config.toml`'s `project_id` and otherwise **refuses to freeze an ambiguous stack** — a guard
I would have called defensive in r1 and can now report as load-bearing in practice.

---

## What I re-ran myself on `a6c4c83e`

```
npm run lint                                                rc 0   18 gates; gate 18 summary present
npm run typecheck                                           rc 0
gen-definer-search-path-freeze.mjs --self-test              rc 0   17 cases
gen-definer-search-path-freeze.mjs --check                  rc 0   in sync (865); GENESIS [baseline main (6d7dd589ae24)]
.claude/rules/ population + bytes                                  12 files; migrations-forward-only.md 2040 B / cap 2048 (record says 1997 -> 2040 ✓)
hub AC checkboxes                                                  0 ticked; AC-5 still `- [ ]`
420 assertions counted vs plan(15)                                 15 / 15; residual two-argument cfg420 call sites: 0
live catalog (read-only SELECT)                                    wrapper -> subject match total=1 stripped=1 (both wrappers)
npx vitest run                                              rc 1 -> TRANSIENT, re-read once (below)
```

⚠ **The one transient, declared.** `npx vitest run` first returned **rc 1**: `2 failed | 152 passed`,
`Tests 2056 passed`. Both failures are the catalog-reading guards
`src/components/shell/nav-scope-exclusivity.test.ts` and `src/lib/queries/session-grants.test.ts`, each
failing with *"container … is not running"* / *"No such container"* — the lead's `e2e:prod` was cycling
the stack mid-run, and these two guards **deliberately fail loudly rather than skip** when the catalog
is unreachable. Re-read once per instruction: `docker ps` then showed the container `Up 22 seconds`,
and re-running exactly those two files gave **2 passed / 35 tests passed** — precisely the
`2091 − 2056 = 35` gap. ⇒ **the suite is green and the red was environmental, not a regression**, and I
am recording it rather than quietly re-running the whole suite until it agreed with me.

---

## Round-2 summary

Both MAJORs are fixed in every home I named, and in three of them the fix says more than I asked for —
it names the *mechanism* (`pg_temp` searched first under `''`, with TEMP held 4 of 4) instead of merely
recording a gap, and it converts MINOR-1's bound into a partition by naming `419` as the arm that
covers the case gate 18 cannot. The two new `420` cells are real assertions with real failure modes,
not restatements, and both passed in the final suite. The `9048` / `9050` pair is labelled correctly,
and refusing to rewrite the captured witness is the right instinct. Reading `.dsp-gate-evidence/`
retired ten of r1's eleven could-not-verify rows; what is left is the door sweep itself, which I was
barred from re-running, and the discarded pair's mechanism, which nobody has resolved and which the
record says so.

**Approved.** MINOR-r2-1 is a one-line correction with the replacement text supplied; land it before
the Record step — no further review round needed. ⛔ AC-5 remains **PO to rule** and must not be ticked
by the unit; the PO also owes rulings on the four open follow-ups and on the door-sweep derivation's
exit 1.
