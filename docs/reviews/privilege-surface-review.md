# PRIVILEGE-SURFACE (pre-AE5 Batch 7) — QA review

**Verdict: CHANGES REQUESTED**

Reviewed at `42ca7718`, branch `authz-privilege-surface`, against `main` @ `412fa4d7`.
Subject: unit `PRIVILEGE-SURFACE`, four tracks by three agents, closing three follow-ups on
their own `Closes when` clauses. Contract: `docs/features/privilege-surface.md` §
Acceptance criteria + the rulings file R1–R34.

⛔ **Scope of this review.** The local Docker stack was mid-sweep and was NOT touched: no
`db reset`, no `test:db`, no `psql`, no harness. Every finding below is derived from the
committed text, from `git` metadata, and from two **pure-text** node gates I ran myself
(`check-budget-anchor.mjs`, self-test and scan — they read files and write fixtures to
`os.tmpdir()` only). Where a claim can only be settled against the live catalog I say so
and name the measurement that is owed.

⛔ **Read-only on application code.** Nothing in the tree was edited by this review.

---

## Summary

This is strong work, and the security posture is not in question: **no migration, no ACL
change, no policy change, no `src/` change, no `SECURITY DEFINER` object created outside a
rolled-back pgTAP transaction, no service-role surface touched, no PHI surface touched.**
Nothing in this diff can move the RLS boundary. R1's defer and R2's ruling are honoured and
the emptiness that says so is real (verified independently below). **Both new gates are real
gates** — I re-ran gate 15's self-test and scan from scratch, and gate 14 was independently
re-derived fixture by fixture; both can fail, both exit 2 when their checker cannot, and both
carry a discrimination half. The three-head attribution, the AE1 re-derivation and the R25
reachability trace are the best-controlled measurement work this program has produced.

The verdict is `CHANGES REQUESTED` on **four** findings. Three are the program's recurring
class — *prose that claims more, or other, than the measurement beside it*, with no gate able
to contradict it. **B1** is a figure this unit republished into four new artefacts, three of
them undated, while its own live ratchet in the same repository says a different number and
while the unit had a fresh catalog in hand four times. The fourth, **B4**, is a coverage gap
in gate 14 itself: R16's *hard condition* on distinguishable failure texts is defeated by the
one edit the gate most exists to catch, and no fixture asks about it.

None of the findings requires a migration, a schema change or a re-run of the DB gates.
All are text edits plus, for **B1**, one query at the current head, and for **B4**, two
fixtures.

---

## BLOCKING

### B1 — `237 of 467` is a 2026-08-22 snapshot, republished on 2026-09-08 as the live consequence, in four new artefacts (three undated), while `320` §U1's live ratchet says the coincident set is **236**

**Requirement violated:** the acceptance criteria's *"Informational anchor: 237 of 467 `app`
functions are `anon`-executable"* is a figure the unit was required to carry into R2's
deliverable; R7 binds every privilege question in this unit to *"the live catalog is the
sole truth … never read a migration file and believe it"*; and R26 — this unit's own
adopted correction — is precisely that keying such a class on an ACL-shaped predicate
instead of the effective one gives the wrong number.

**Where it is now written:**

| site | dated? |
| --- | --- |
| `supabase/config.toml:17` and `:22` — *"467 functions, of which 237 are `anon`-executable … Add "app" here and all 237 become directly `anon`-callable"* | ✅ yes — *"(measured 2026-08-22 from the live catalog)"* |
| `scripts/check-supabase-config-schemas.mjs:5`, `:11`, `:84`, `:377`, `:384`, `:387` — including the **N1 SECURITY-EVENT message a reader meets at the red** | ⛔ no |
| `docs/lint-gates.md:31` — *"schema `app` holds 467 functions, 237 of them `anon`-executable"* | ⛔ no |
| `docs/decisions/0195-…:32` — *"**237 of 467** `app` functions are `anon`-executable"* | ⛔ no |

**What the tree itself says.** `supabase/tests/320_act_expiry_and_acl_hardening.sql:258-263`:

```
-- Measured 2026-08-17 against the live catalog: **237 of 454** `app` functions
-- were PUBLIC-executable (228 by default ACL — 159 of them SECURITY DEFINER —
-- plus 9 by an explicit PUBLIC grant), and `anon` resolved EXECUTE on all 237.
--
-- ⭐ THE RATCHET MOVED DOWN ONCE, DELIBERATELY: **236** since AE4.7b
-- (20261003007210) revoked the PUBLIC grant on `app.is_staff_admin_of`
```

The two populations coincided at **237** on 2026-08-17 (`228 + 9 = 237`, and `anon`
resolved EXECUTE on all 237). One explicit PUBLIC grant has since been revoked, taking the
ACL-shaped set to **236** — and this unit re-derived that **236 live on a fresh reset**
(`docs/progress/privilege-surface.md`, tip-gate entry: *"§U1 is still 236 — verified THREE
independent ways … (1) The live catalog, queried directly on the fresh reset by the
runner's own SQL: **236**"*). The denominator is stale too: `320` measured **454** `app`
functions on 2026-08-17, the follow-up **467** on 2026-08-22, and Track A's own A→B set
difference proves at least seven more `app` functions landed in the 38-migration window
since.

**Why this is blocking and not a nit.** The 237 is not decoration — it is the *consequence
clause* of a new security gate. `check-supabase-config-schemas.mjs:384-387` is the text a
person meets when N1 fires, and it asserts a number that was neither measured at this head
nor dated. The unit ran **four** fresh `supabase db reset` cycles and had the catalog in
hand each time. And R26 is the same unit's own lesson that the ACL-shaped predicate and
`has_function_privilege` disagree — so *"237 `anon`-executable"* cannot be inferred from
the ACL-shaped 236 either; it has to be run.

**What closes it.** Run, at head `20261003007350`, the two queries the follow-up body used
(`count(*) where prokind='f'` in `app`; `count(*) filter (where has_function_privilege('anon', p.oid,'EXECUTE'))`),
then either (a) update all four sites to the measured pair, or (b) leave the historical
figure and give every site the dated form `config.toml` already uses. ⛔ Do not update one
site — a figure with four homes and one correction is worse than four stale ones.

### B2 — `docs/lint-gates.md:1` states a false duration: *"the list understated itself by one for five days"*

**Requirement violated:** R13's *"⚠ Nothing gates `docs/lint-gates.md`"* — the file's own
opening sentence says *"verify a claim here against `package.json` and the script's own
header before trusting it"*, and this is a claim in it that no gate can contradict.

The sentence, added this batch:

> *"⭐ the last two added 2026-09-08 — `lint:config-schemas` was landed with the exit-2
> shape and this sentence was not updated with it, so the list understated itself by one
> **for five days**"*

Measured:

```
6fee08ae 2026-09-08 12:17:44 -0300  feat(PRIVILEGE-SURFACE): gate 14 …
5602830d 2026-09-08 13:05:44 -0300  feat(PRIVILEGE-SURFACE): ceiling moved … gate 15 …
```

**48 minutes**, same day, and `5602830d` is the *very next commit* to touch
`docs/lint-gates.md`. R13's actual instruction — package.json edit and the bullet in the
same commit — **was honoured**: `git show 6fee08ae --stat -- docs/lint-gates.md` is
`1 file changed, 2 insertions(+)` and adds the `lint:config-schemas` bullet. Only the
exit-2 *list sentence* lagged, by under an hour.

This is *two-accounts-of-one-event — the alarming one gets repeated*, committed. A reader
of that sentence concludes a gate's self-test status was misdescribed for the better part
of a week; the truth is that it was corrected in the next commit. Correcting the figure is
not downgrading the finding — the finding (the list is hand-maintained and lagged) is real
and worth keeping. Say both.

### B3 — `320` §U6d attributes a `proacl IS NULL` count to a "no direct grant" property — the exact predicate confusion R26 corrected, twelve lines above the assertion that cites R26's lesson

`supabase/tests/320_act_expiry_and_acl_hardening.sql:556`:

> `'budget U6d SILENT-NO-OP HALF, precondition: … which is exactly why 159 members of this population have no direct grant at all'`

The **159** is derived — `docs/progress/privilege-surface.md:157-161`, under the column
header **`proacl IS NULL` in budget**, at all four heads. `proacl IS NULL` implies "no
direct grant"; the converse does not hold, and **this unit is what proved it does not**.
`docs/design/authz-ae1-revoke-partition.md` §9.4 names seven `app` DEFINER functions with a
**non-NULL** `proacl` carrying an explicit PUBLIC entry; any of those that lacks an
`authenticated=X` entry is a member of the 759 with no direct grant and is **not** among
the 159. §U6e, two assertions later, cites exactly this — *"This is AE1's 138-of-233 class"*
— which is the correction that makes §U6d's sentence unsafe.

So the sentence states as measured a property (`no direct grant`) that was never measured
at any head, using a figure measured under a different predicate. Whether 159 is
numerically right is **unknown**, and the gate cannot tell you: `159` is prose inside an
assertion message, not a pinned literal, so nothing reds if it is wrong.

**What closes it.** Either re-word to the predicate that was actually measured (*"159
members of this population have `proacl IS NULL`"*), or measure `no direct
`authenticated`/PUBLIC-independent grant` at the current head and state that number with
its predicate. ⛔ Do not simply delete the sentence — the point it makes is correct and
load-bearing for §U6d's precondition.

### B4 — R16 is a hard condition and gate 14 does not meet it for the single most predictable edit: `"app"` added **and** the sentinel deleted in one commit reds as a formatting problem, and the word `app` never appears

**Requirement violated:** R16, quoted — *"⛔ **Condition: N1 and N2 must not produce the same
message.** … One gate, two clearly distinct failure texts, and the N1 text names the
consequence. **A reader who meets the red must be able to tell in one line which of the two
happened.**"*

`scripts/check-supabase-config-schemas.mjs` runs positives before negatives (`:92-98`), so
**P4 at `:339` is evaluated before N1 at `:342`**. Measured on in-memory fixtures:

| edit | code returned | first line the reader meets |
| --- | --- | --- |
| `"app"` added | `N1_APP_EXPOSED` | `⛔⛔ SECURITY EVENT — … "app" HAS BEEN ADDED TO THE POSTGREST-EXPOSED SCHEMAS.` |
| **`"app"` added AND the sentinel line deleted** | **`P4_NO_SENTINEL`** | *"the load-bearing comment sentinel is missing from the comment block…"* — **never mentions `app`** |
| `"app"` added, written multi-line | `P3_MULTILINE` | a rendering complaint |
| `"app"` added in a second `[api]` table | `P3_DUPLICATE` | a duplication complaint |
| `"app"` added and the `[api]` header removed | `P2_NO_API_TABLE` | a structure complaint |

Nothing passes — every row exits **1** — so this is not an escape. But *"delete the scary
comment while adding the schema"* is exactly the edit the sentinel exists to survive, and it
is the one edit for which the gate's headline stops naming the security event. R16 made the
one-line distinguishability a **condition**, not a nicety.

**And the gate's own coverage cannot see it.** B1 (`:496-502`) and B4 (`:517-526`) are
strictly separate fixtures; there is **no combination fixture**, so no arm of the self-test
has ever asked what happens when both hold. That is
*a-mutation-list-keyed-on-assertions-cannot-see-an-unexercised-cell*, inside the gate this
batch built to answer that class.

**Compounding it — R16's condition is on prose that nothing exercises.** The self-test
compares `got.code` against `f.expect` (`:724`) and **never calls `report()`**. No fixture and
no test anywhere in the tree asserts that the N1 and N2 *strings* differ; the only reference
to the script outside itself is `package.json:25`. R16's hard condition is therefore held by
reading, not by a gate — in a gate whose whole subject is that a sentence is not an enforcer.

**Also on the same point, smaller:** `:83-85` says the N1 message *"names the consequence:
237 …"*. It does — on line **five** of the block (`:384`), not on the headline. Whether that
satisfies R16 depends on whether R16 meant the message or the line; the line does not carry
it. (See **B1** — that number also needs re-measuring.)

**What closes it.** Either escalate: when the parsed list contains `app`, report N1 even if a
positive also fails (or append the N1 headline to the positive's message); or, at minimum,
add the B1+B4 combination fixture with its expected code stated, plus one fixture asserting
the N1 and N2 headlines are distinct strings, so R16's condition is held by the self-test
rather than by this review.

---

## MAJOR

### M1 — ADR 0195's Consequences claims an enforcer its own D1 says does not exist

`docs/decisions/0195-…:144`:

> `- The merge rule has an enforcer for the first time. **P1 closes.**`

P1 is stated at `:44` as *"the merge rule had no enforcer"*. The merge rule has two clauses
(`docs/backend-state.md:508-510`): **no increment may raise the count without a named
justification in its own gate record**, and **the ceiling moves only by PO ruling**. Neither
gate can observe either clause. A single commit that moves the anchor's `ceiling` and
`total`, §U4's three tagged literals and §U5/§U6's untagged ones passes `npm run lint` **and**
`npm run test:db` with no justification and no ruling anywhere in the tree — and D1 says so
in terms:

> *"the artefact left behind is identical either way, and only the recorded ruling
> distinguishes a decision from a breach quietly rebased into a baseline."*

`docs/lint-gates.md:33` and `docs/backend-state.md:660-666` are both careful here (*"what
that buys is 'the next Phase Gate noticed', not 'the next commit noticed'"*). The ADR's
Consequences line is the single place that is not, and it is the line a future reader will
quote. What actually closed is **"a silent rise is now impossible"** — say that, and say
that the merge rule's two clauses remain enforced by the record, not by a gate.

### M2 — *"THESE THREE LITERALS ARE A RULING, NOT A MEASUREMENT THE BUILDER CHOSE"* is true of one literal and false of two — and the `ARM=census` reconciliation leans on it

`supabase/tests/320_…sql:452` asserts it of all three pins; `:406` and ADR 0195 **D2(ii)**
carry the census reconciliation on the same claim:

> `--   (ii)  THE COMMITTED NUMBER IS A DECISION, NOT A DESCRIPTION. 759 is what the`
> `--         PO ruled on 2026-09-08 …`

The PO ruled **"Move the ceiling to 759"** (R24). `app` **326** and `public` **433** were
never ruled on; they are measurements, pinned as a ratchet. For those two literals D2(ii)
is false — they *are* descriptions of a population.

I attacked D2's three-condition defence as the brief asked, and **the defence survives, but
not on the argument as written.** What actually separates §U4 from the census banner is
condition **(i)** alone: `pg_temp.budget()` re-derives the population from the live catalog
every run and the literal is *compared* to it, whereas the census banner's `(407 reachable)`
was *printed* and compared to nothing. The census arm's own remedy
(`supabase/tests/mutation/p0-authz-invariant.sh:531-532`) is stronger still — it made the
figure **derived from the predicate**, so *"the figure and the class can never disagree
again"* — and §U4 does not do that; it commits a literal and gates its copies. That is a
legitimate different choice (it is exactly what §U1 is), but it must be argued on (i) and
(iii), not on (ii).

**The concrete consequence of getting (ii) wrong**, and it is not hypothetical:
`320:376-382` gives the decision owner as

> `⛔ An engineer may not edit §U4's literals; the same engineer may lower §U1's with the removal measured.`

A legitimate `app` 326→325 / `public` 433→434 (total unchanged at 759, merge rule untouched
because nothing rose) reds §U4a and §U4b and leaves the repair with **no named owner** —
the PO's authority is over the ceiling, and the per-schema split has none.

**What closes it.** State the split honestly at `:452` and `:406`: `total`/`ceiling` = 759 is
a PO ruling; `app` 326 and `public` 433 are measurements pinned as a ratchet whose owner is
the same triage owner §U1 names, movable with the mover attributed and measured. Then
re-state D2(ii) so the census reconciliation rests on the conditions that hold.

### M3 — `docs/backend-state.md:551` now states something false about the file it sits in

> `⛔ **\`CEILING: 752\` is UNCHANGED above and is not edited here.** The ceiling moves only by PO ruling; this section supplies the measurement a ruling needs and nothing more.`

The ceiling above is **`CEILING: 759`** (`:505`). Both the section carrying this sentence
and the section that moves the ceiling are dated 2026-09-08, and the mover sits **below**
it, so a reader arriving at `:551` reads a present-tense false statement about the document
in front of them. Nothing gates it — gate 15's `PROSE_RE` is `/\*\*CEILING:/` and does not
match `**\`CEILING: 752\`**`, which is why P3 still finds exactly one prose ceiling.

Per this repo's convention the repair is a **dated note beside it**, not a rewrite: the
sentence was true when the attribution section was written and stopped being true when the
next section landed. One line — *"⚠ 2026-09-08, later the same day: the ceiling DID move, by
PO ruling R24, in the subsection below; this sentence describes the attribution section's
own scope and is left as written."*

### M4 — the hub's `## Current state` — the unit's summary — is wrong at the tip on three counts, two of them numeric

CLAUDE.md §7 makes `docs/features/<code>.md` § Current state the unit's **summary**, and
gate 13 checks its presence and shape, never its truth. All three were recorded by the
independent tip-gate runner (`docs/progress/privilege-surface.md`, *"Four observations
handed to the lead for the Record step"*) and all three are still open at `42ca7718`:

- `docs/features/privilege-surface.md:110-116` — `### In progress` lists **Tracks C and D**;
  both are committed (`a2f9f981`, `5602830d`, `bd50dfc9`). The summary describes a state
  three commits old.
- `:100` — *"31 rulings in the unit's rulings file"*. The rulings file holds **34**
  (`grep -c '^## R[0-9]'` → 34; R32/R33/R34 are the three it does not count).
- `:107-108` — *"gate 14 pins `[api].schemas`, **13** fixtures"*. `6fee08ae`'s own commit
  body says *"10 bad + 4 good"* = **14**, the gate's self-test reports 14, and the checker
  has been touched exactly once — so the figure was **never right**, it did not drift.

A summary that is stale on the tracks and wrong on two counted figures is the artefact the
next session reads first.

---

## MINOR / NOTED

**N1 — two rotted citations the record explicitly handed to the lead, and R32 disposed of
neither.** `docs/progress/privilege-surface.md:7-9` (the record's present-tense Subjects
header) still reads *"`docs/backend-state.md` § Privilege budget (**`CEILING: 752`**, …)"*
and *"**`supabase/config.toml:13`** (the one line that bounds the `app` PUBLIC floor)"*.
Track D's entry names lines 9/98/325 as outside its pathspec and reports them *"for the
lead to route"*; R32 routed only the **five historical review files**. `:98` and `:325` are
dated log entries and are defensible as written. `:7-9` is not — it is the header a reader
meets first, in present tense, on the unit's own record.

**N2 — R33's owed re-open condition does not exist anywhere in the tree, and ADR 0195 D8's
heading claims it does.** D8 reads *"Revoke execution is deferred, **with a re-open
condition** rather than a shrug"* and then supplies only the *grounds for deferring* (the
`42501` write-time re-check, the 138 no-ops, the `ARM=floor` eviction). No condition under
which the item returns is written. R33 makes the closure Record-step work owned by the
lead, so this is not a build defect — but the ADR should not assert a condition it does not
carry. Either draft it in D8, or re-word the heading to *"deferred, with its re-open
condition owed at the closure"*.

**N3 — the `ARM=census` reconciliation is one-directional.**
`supabase/tests/mutation/p0-authz-invariant.sh:526-532` still reads as an unqualified
prohibition, with nothing pointing at ADR 0195 D2 or `320` §U4. This unit set the opposite
precedent in the same batch: `scripts/authz-tier1-threat-review-ae1.sql:63-89` was annotated
precisely so a reader who meets the stale literal is told where its gated home is. Same
shape as *only-the-amending-document-knows-about-the-amendment*. A three-line comment beside
the prohibition, naming §U4 and the three conditions, closes it.

**N4 — §U5/§U6's control literals are ungated copies, and the one closure that will have to
move them names none of them.** `320` carries `759`/`760`/`326`/`327` at `:488 :498 :502
:508 :512 :535 :545 :555 :565 :571` — untagged, so gate 15 mirrors none. The tip runner
measured the consequence: an unrelated `+1` in the population reds **ten** subtests, seven
of them controls carrying no finding, burying the two that do (its own correction to Track
C's M1 row, which reported three). Meanwhile
`docs/followups/follow-ups-open.md:1779` instructs the executing migration to re-pin *"§U4
… **and** `docs/backend-state.md`'s BUDGET-ANCHOR"* and names none of the ten. Not blocking
— it reds, it does not pass — but the closure's instruction is incomplete and will produce
a red the executor was told it had prevented. Either add *"and §U5/§U6's absolute control
literals"* to that clause, or re-express the controls as deltas from `pg_temp.budget()`.

**N5 — ADR 0195 ships `**Status:** Proposed` and is registered into
`docs/decisions/proposed-review.json`.** That takes the index's *"Still proposed / draft /
deferred"* anomaly list from 8 to 9 (`docs/decisions/INDEX.md`), joining a set the index
itself describes as *"the author's claim on the day it was written, and nothing updates it
when the code ships"*. Every prior batch ADR (0190–0194) is `accepted`. Registering it makes
gate 9's drift check green, so **nothing will red if the status is never flipped after PO
approval** — in the batch whose subject is records that go stale silently. Flip it at the
Record step and say so in the ADR, or state in the ADR's status line when it flips.

**N8 — three overclaims in gate 14's own header, each contradicted by code below it.**
(a) `:456-457` — *"the fixture baseline is the real file with the pinned value text and the
sentinel FORCED on, i.e. **clean by construction whatever the file on disk says**"*.
`canonicaliseBaseline` (`:461-471`) repairs only the value text (first match only, no `/g`)
and a **globally absent** sentinel; it cannot produce `OK` from a deleted `schemas` line, a
duplicate, a multi-line array, a missing `[api]`, or a sentinel that exists elsewhere in the
file (I confirmed the last by moving it). `:669-674` exists precisely for that case. *"Whatever
the file on disk says"* is false. (b) `:114-116` — *"Fixtures are MUTATIONS OF THE REAL FILE …
with a byte-difference guard on **every** mutation"*: `B9+` (`:591`) is the hand-written
literal `'\n   \n'`, not a mutation of anything, and `mustDifferFromBaseline: false` at
`:608 :635 :643` exempts three fixtures — one of which, `G3-crlf`, is **byte-identical to the
baseline on this checkout** (the tree is fully CRLF, so its CRLF re-render is a no-op). ⭐ The
script's own comment at `:619-629` predicts exactly this and the `eolPair` guard at `:686-693`
keeps the pair non-vacuous, so the *fixture* is sound — only the header's *"every"* is wrong.
(c) `:113` — *"SELF-TEST, run before every real scan"*: in the `return 1` branch the fixtures
are never built (`:676` unreached) and the scan proceeds with an unexercised instrument. Not a
hole — every state that reaches that branch also reds the real scan, which I checked — but the
JSDoc at `:651-657` is honest and the header is not.

**N9 — `--print` is documented and not implemented.** `scripts/check-supabase-config-schemas.mjs:118`
advertises `[--self-test] [--print]`; the only `argv` reads are `argv.includes('--self-test')`
at `:762` and `:764`, so `--print` is silently ignored. Gate 15 does implement `--print`; the
two headers advertise the same flag set and only one honours it.

**N10 — gate 14 resolves its subject from `process.cwd()`, and its failure text misdescribes
the result.** `:128-129` builds `CONFIG_PATH` from `process.cwd()`; `fileURLToPath` is
imported at `:126` but used only for the `isMain` guard. Run from anywhere but the repo root
it exits **1** with `P1_MISSING` — *"does not exist. The gate has no subject"* — a false red
that sends a reader hunting for a deleted config. Latent under `npm run lint` (always repo
root), and it fails loudly rather than green, so this is a note. It is also what would have
to change for the R16 message-text assertions in **B4** to be written as an importable test.

**N11 — informational, no action requested.** `supabase/config.toml:53`'s
`extra_search_path = ["public", "extensions"]` sits in the same `[api]` table, is not pinned
by gate 14, and gaining `"app"` there passes silently. It is **not** a PostgREST exposure
vector (it does not create RPC endpoints), so it is out of R2's scope and I am not asking for
it — recorded only because it is the adjacent unpinned line a reader of the new comment block
will notice next.

**N12 — register formatting.** `docs/followups/follow-ups-open.md`: the `**Body:**` line of
`FUP-AUTHZ-NO-BEHAVIOURAL-PROOF-APP-SCHEMA-UNREACHABLE-OVER-POSTGREST` is immediately
followed by the `### 🟡 FUP-AUTHZ-42501-MATCHER-…` heading with no blank line. Gate 13
tolerates it; every neighbouring entry has one.

**N13 — noted, not requested.** `FUP-AE1-REVOKE-SET-EXECUTION`'s **title** and its register
heading still read *"137 of them are a silent no-op as written"*. Track D's choice to
correct the operative sentence and leave the title is consistent with R26's *"a dated note
beside the original, never a rewrite"*, and the note itself is complete and correct (both
numbers, both predicates, the 138th named). Recorded only so the closure does not inherit
the title's figure.

---

## Audited and found sound — do not re-do these in the fix loop

- **R5 / R1 / R2, verified independently of the record.**
  `git diff --name-only main...HEAD -- supabase/migrations supabase/seed.sql src` is
  **empty**; the diff is **22 files**, all under `docs/`, `scripts/`, `supabase/config.toml`,
  `supabase/tests/` and `package.json`. No migration, no ACL change, no `src/` change. The
  five out-of-pathspec areas are named beside the zero in the record exactly as R34 requires.
- **The three `Closes when` clauses, read from the bodies.** The ceiling item's derivable
  clause is met in **both** halves: the set-difference attribution with all seven named and
  their creating-and-granting migration (`docs/backend-state.md`, the attribution table),
  and the PO ruling. The two `PO to rule` items each have a recorded ruling with the PO's
  selected option text reproduced verbatim, **plus** the measurement each body demanded
  (§9's full re-derivation at the current head for AE1 — the body forbids reusing its
  figures and they were not reused; the comment block **and** gate 14 for the `app` floor).
  R18's bound (*proves the FILE, never the DEPLOYED config*) is carried in all three of the
  places R18 named — the gate header, `config.toml`, and the follow-up body.
- **R24's legitimacy paragraph does what R24 asked.** `docs/backend-state.md:616-624`
  restates the prohibition it stands on, states that the edit is legitimate *only* because a
  dated ruling exists and was taken **after** the attribution was measured, quotes the
  superseded `CEILING: 752` beside the new value, names each of the seven with its
  increment, and tells a later reader how to tell this edit from the forbidden one. A reader
  can distinguish the two. This was the highest-risk item in the batch and it is handled.
- **§U4 is proven to fire, in both polarities and per schema.** Two committed catalog
  mutations in the build record (M1 `public` +1 → U4b/U4c red, **U4a green**; M2 `app` −1 →
  U4a/U4c red, **U4b green**), and again **independently** by the tip-gate runner
  (`public` 433→434, rc 1, `Failed 10/36`, U4a green, probe dropped and population verified
  restored with 0 residue). §U6b asserts `has_function_privilege` **moved** before §U6c
  asserts the count fell — the AE1 137/138 lesson applied to the control itself — and §U6d–f
  **construct** the silent no-op rather than warning about it. §U6h re-asserts §U1's 236
  after the probes, so the incumbent is shown undisturbed inside the file.
- **Gate 15 re-verified by me, from scratch, not from the record.**
  `node scripts/check-budget-anchor.mjs --self-test` → **rc 0**, *"15 bad pairs each caught
  for its own reason, 5 good pairs each clean"*; each bad fixture is matched against its own
  expected finding code (so a red at the wrong check is a failure, which is what caught the
  build's check-A mutation), and **G3 (ceiling 800 over a total of 759)** is a live
  discrimination half proving `C` is `<=` and does not quietly demand equality. Real scan →
  **rc 0**, printing both mirror line numbers **and its own bound**. `MIRROR_RE` is anchored
  to `<int>,  -- BUDGET-ANCHOR <key>` so the gate reads the **`is()` literal**, never a
  comment restating it — that shape is load-bearing and is correct. Zero and two matches
  each red exactly like a wrong value.
- **R20 / D7 — the zero-delta trap is handled correctly.** B→C is recorded as an empty
  **set difference**, never inferred from `759 == 759`, with the identity-keyed blindness to
  a body rewrite stated and `public.set_item_validations` named as the live instance that
  proves the head really moved. The head is keyed on the **pair** `(max(version), count(*))`
  per R19, and A and B reproduce their historical measurements to the unit before the
  instrument is pointed at new ground.
- **R25 — the three verdicts.** Drawn from the closed set; no verdict forced into a
  neighbouring class; §10.5 states what *would* have made one `UNDECIDED` and that neither
  can be excluded by these instruments. Every negative result carries a live discrimination
  half — C2 (revoking the grant the policy genuinely needs makes the identical read raise) is
  what makes C1's non-raise believable. §10.3's `REQUIRED` states its grain honestly
  (*required by a live gate and by the door's design, not by a production call site today*).
  The `throws_ok(…,'42501')` vacuity found while probing was **filed**
  (`FUP-AUTHZ-42501-MATCHER-CANNOT-TELL-A-GATE-FROM-AN-ACL`) rather than swallowed, with a
  `Closes when` that demands the repair be **proven red**.
- **R17 — the AE1 re-derivation is not a dead instrument.** All six arm predicates were
  re-read and **all six had moved**; the biggest mover (the write-path arm's static 33-entry
  snapshot replaced by a live-derived 107-policy worklist) was not among the two the lead
  had flagged, which is the *sweeping-one-sibling-axis* trap avoided by measurement. The
  reproduce-at-233 result carries a **vacuity control** that was proven able to be non-zero
  (planting `handle_new_user` into `GUARD_KEYS` moved exactly one row, 23→22 / 5→6) and
  CHECK F carries a discrimination pair. §9.5 keeps `UNCHANGED = 161` **unexamined, not
  cleared**.
- **ADR 0195's "amends nothing" claim — verified, and it holds.** ADR 0155 D9 reads
  verbatim *"track reachable-definer count as a security budget"* (`:266`+), which 0195
  exercises rather than changes; ADR 0127's `npm run lint` bound is applied, not relaxed
  (the count went to pgTAP; only the two committed **texts** are compared in the lint chain).
  It amends no ADR, and carrying no `**Supersedes:**` / `**Amends:**` label is correct.
  ⚠ It *does* qualify a standing prohibition that is not an ADR — see **N3**.
- **Gate 14 re-derived independently, fixture by fixture.** 10 bad + 4 good; every bad
  fixture lands on **its own declared code** (so a red at the wrong check fails, which is what
  caught the build's own N1 mutation); `broken > 0 → return 2` at `:742-747` and
  `st === 2 → process.exit(2)` at `:762-763`. I probed every silent-pass vector I could
  construct and **found none**: a multi-line array is refused before the count is taken
  (`:315-321`) so it cannot degrade into "zero found"; a commented-out assignment, a `schemas`
  under `[api.tls]`/`[db]`, and a root dotted `api.schemas` all red as `P3_NONE`; two `[api]`
  tables red as `P3_DUPLICATE`; a non-array value reds as `P3_UNREADABLE`; single-quoted items
  and a re-render red as `N2B`; order change reds as `N2A`; `[[api]]` and `[ api ]` are
  accepted as `api` and `app` inside them is still caught; `[API]`/`["api"]` red as
  `P2_NO_API_TABLE` — i.e. every leniency is in the safe direction. The G3 CRLF/LF pair is
  byte-identical to the baseline in the CRLF direction on this checkout, and the file **says
  so** at `:619-629` with an `eolPair` guard at `:686-693` asserting the two carry different
  endings — the *fixture-defined-as-"the-real-file-but-X"* trap (R29) is met, not stumbled into.
- **R28's lesson is honoured and was verified from outside.** Both checkers build fixtures
  from a **canonicalised** baseline in `os.tmpdir()`, so a planted `"app"` no longer poisons
  every fixture and invert the exit code from 1 (the finding) to 2 (the checker is broken).
  The tip runner confirmed it with `"app"` planted: baseline line reads *"the real file
  CANONICALISED — the bytes on disk are NOT clean"* and the run exits **1**, not 2.
- **Security / RLS.** Nothing in this diff touches the boundary. `prosecdef` was checked
  where it matters: the two DEFINER probes `320` creates live inside `begin … rollback`, are
  dropped before `finish()`, and §U6h proves the incumbent population is unchanged after
  them. Gate 14's bound (proves the FILE, not the deployed PostgREST config) is stated in
  three places and the behavioural gap is filed rather than papered over. No secret, no
  `NEXT_PUBLIC_` change, no service-role reachability change.

---

## Fix list, in order

1. **B1** — re-measure `app` function count and `anon`-executable count at head
   `20261003007350`; update or date all four sites together
   (`supabase/config.toml:17,22` · `scripts/check-supabase-config-schemas.mjs:5,11,84,377,384,387`
   · `docs/lint-gates.md:31` · `docs/decisions/0195-…:32`). The N1 failure message is the
   one that matters most.
2. **B2** — correct *"for five days"* in `docs/lint-gates.md:1` to the measured 48 minutes,
   keeping the finding and adding that R13's same-commit rule **was** honoured for the bullet.
3. **B3** — re-word `320:556` to the predicate that was measured, or measure the one it states.
4. **B4** — escalate N1 over the positives (or append its headline to theirs), add the B1+B4
   combination fixture with its expected code stated, and add one fixture asserting the N1 and
   N2 headlines are distinct strings.
5. **M1** — re-word `docs/decisions/0195-…:144` to what the gates actually buy.
6. **M2** — split the ruled figure from the measured ones at `320:452` and `:406`, and
   restate D2(ii); name an owner for the per-schema split.
7. **M3** — dated note beside `docs/backend-state.md:551`.
8. **M4** — refresh the hub's `## Current state`: tracks, 34 rulings, 14 fixtures.
9. **N1–N5**, **N8–N10** and **N12** as written. **N11** and **N13** are informational only.

⚠ **No pinned literal moves, so no DB gate result should change.** **B3** edits an assertion
*message* only — it cannot move `plan(36)` or any `is()` literal. **B4** changes gate 14's
message ordering and adds fixtures, both outside `supabase/tests/`. `npm run test:db` is still
owed once at the fix-loop tip because `320` was touched, and `npm run lint` is owed because
gates 7, 13, 14 and 15 all read files these edits change — quote which gates each run REACHED
(`&&` short-circuits), and read every rc **bare**.

---

*Reviewer: `qa`. Read-only on application code; this file is the only artefact written.*
