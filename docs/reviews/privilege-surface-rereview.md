# PRIVILEGE-SURFACE (pre-AE5 Batch 7) — QA RE-REVIEW, fix-loop iteration 1

**Verdict: CHANGES REQUESTED**

Re-reviewed at `834e55d8`, branch `authz-privilege-surface`. Prior report:
`docs/reviews/privilege-surface-review.md` (CHANGES REQUESTED at `e23cb2ee`/`42ca7718`).
Scope: the four fix-loop commits `4e3f0844 · c84dd823 · 1956e7bd · 834e55d8`, and any NEW
defect they introduced. ⛔ The prior report's *"Audited and found sound"* section was **not**
re-audited, per the brief.

⛔ **Read-only on application code.** This file is the only artefact written. Measurements
I ran myself, all read-only and all rc read **bare**:

- `node scripts/check-supabase-config-schemas.mjs --self-test` → **rc 0**, 11 bad / 4 good.
- `node scripts/check-budget-anchor.mjs --self-test` → **rc 0**; real scan → **rc 0**.
- `npm run lint` → **rc 0**, and I read the chain line from the output: all **15** gates
  reached, `lint:budget-anchor` last. (Independently confirms the brief's claim.)
- A private probe importing `inspect()`/`report()` into `os.tmpdir()`, exercising five
  combination cells the self-test does not (results in **B1** below). Nothing was written
  to the tree.
- `grep`/`git grep` sweeps for the `237`/`467`/`526`/`236` figures across tracked files.
- ⛔ I did **not** run `test:db` or touch the Docker stack. `plan(36)` is unchanged
  (`320:25`) and gate 15's scan resolves `app=326 public=433 total=759` against the home,
  so the backend's recorded `Files=262, Tests=8900, PASS` is consistent with what I can see.

---

## Summary

**Three of the four original blockers are properly closed, and two of them are closed better
than I asked for.** B2's duration is corrected with the superseded text quoted and the
finding kept; B3 now states the predicate that was measured; B4's escalation is real,
`report()` is exported, `M1+` carries a dead-instrument guard *and* a positive control on
its own comparator, and `B11+` carries a `shape` guard so it cannot silently degrade into a
copy of B1 or B4. R35's delta rewrite is correct: the baseline is snapshotted **before** the
first probe and materialised as a table precisely so it cannot move with the probes, §U4's
pins stay absolute, and I checked the obvious vacuity — a dead `pg_temp.budget()` would
still red U5d/U5e/U6a/U6d/U6f, so the section cannot go quiet as a whole. M1, M3, M4/R36,
N2's re-open condition, N5, N9, N10 and N12 are all discharged, and **N9 was discharged by
falsifying my own comparison** (I wrote that gate 15 honours `--print`; measured, neither
gate ever read it) — that is the right posture and it is recorded as such.

The verdict is `CHANGES REQUESTED` on **two** findings, both of which are the fix loop's own
work rather than residue:

- **B1** is a **new defect the fix introduced**: gate 14's escalation does not cover the
  multi-line array, no fixture asks, and the fix's own new comment asserts in terms that it
  does. That is the B4 shape re-instantiated with a false claim on top of it, in the gate
  whose subject is that a sentence is not an enforcer.
- **B2** is the **fifth home** of `237 of 467` — the follow-up body this unit is about to
  **close on**. Four sites were corrected together and the source was not swept, which is
  the failure mode the original B1 named in its own closing instruction.

Neither touches the security boundary. `git diff --name-only main...HEAD -- supabase/migrations
supabase/seed.sql src` is still empty; no migration, no ACL change, no policy change, no
`prosecdef` object outside a rolled-back pgTAP transaction, no `NEXT_PUBLIC_`/service-role
change. Both findings are text plus, for B1, one code branch and one fixture.

---

## BLOCKING

### B1 — the escalation covers four of the five combination cells the previous report tabulated; the **multi-line** row is still a rendering complaint, and the new comment at `scripts/check-supabase-config-schemas.mjs:372-376` claims it is not

**Requirement violated:** R16, quoted — *"⛔ **Condition: N1 and N2 must not produce the same
message.** … the N1 text names the consequence. **A reader who meets the red must be able to
tell in one line which of the two happened.**"* — as extended by the prior report's B4 to the
positives, which is the extension this fix accepted and built. And, independently, the new
comment is a claim about the code beside it that the code does not support.

**The claim.** `scripts/check-supabase-config-schemas.mjs:372-376`:

```
    // ⛔ Deliberately BEFORE the `[api]` filter and before the parse: the question this
    // answers is "did this edit name `app`?", which is a fact about the EDIT, not about
    // which table the key landed under. An unparseable value still gets a text probe,
    // because a multi-line or malformed array must not be a way to smuggle the word past
    // the headline.
```

**The measurement.** I ran `inspect()` on five combination fixtures built from the real file:

| edit | code returned | headline names `app`? |
| --- | --- | --- |
| `"app"` added AND the sentinel deleted | `N1_APP_EXPOSED_WITH_DEFECT` | ✅ yes |
| `"app"` added AND the `[api]` header removed | `N1_APP_EXPOSED_WITH_DEFECT` | ✅ yes |
| `"app"` added in a DUPLICATE `[api]` table | `N1_APP_EXPOSED_WITH_DEFECT` | ✅ yes |
| the `[api].schemas` line deleted, `app` named under `[db.x]` | `N1_APP_EXPOSED_WITH_DEFECT` | ✅ yes |
| **the list rewritten MULTI-LINE with `"app"` on a later line** | **`P3_MULTILINE`** | ⛔ **no** — *"`schemas` is written as a MULTI-LINE array (`[`). ⛔ THIS GATE CANNOT READ IT…"* |

**Why the probe cannot see it.** `:378-382` takes `anyValueText = kv[1].trim()` — everything
after `schemas =` **on that one line**. For a multi-line array that text is `[`.
`parseArrayLiteral('[')` fails, and the fallback `/["']app["']/.test('[')` is false, so
`appSighting` is never set. The word `app` is on a *subsequent* line, and no subsequent line
matches `/^schemas\s*=/`, so the loop never looks at it. The "malformed" half of the comment's
claim **is** honoured (`schemas = "app"` escalates correctly, I checked); the "multi-line" half
is not, and it is named first.

Worse, the coverage is **value-dependent**: `schemas = ["app",` + newline escalates (the word
is in `kv[1]`), while `schemas = [` + newline + `"app",` does not. Whether the security
headline appears depends on which line the editor happened to break at.

**And no arm asks.** `B7` (`:691-697`) is multi-line **without** `app`; `B11+` (`:750-756`) is
single-line **with** `app` plus a deleted sentinel. There is no multi-line + `app` fixture —
the same unexercised cell the prior B4 found, in the same file, one fix later.

⚠ It is not an escape: every row above exits **1**. This is blocking for the same reason B4
was — R16's distinguishability is a **hard condition**, this is the second-most-predictable
way to add a schema (reformat the list while extending it), and a fix that leaves one row of
the previous report's own five-row table while its comment claims the row is covered is
*a-partial-fix-reads-as-a-complete-one* with an assertion nailed over it.

**What closes it.** Either (a) make the sighting see a multi-line array — scan forward from
the opening `[` to its `]` for a quoted `app` and set `appSighting` from it — or (b) narrow
the comment at `:372-376` to what the code does (*"a malformed single-line value still gets a
text probe; a genuine multi-line array is refused before the probe can read it, so the
headline for `app`-added-multi-line is `P3_MULTILINE`"*). ⛔ Either way, add the multi-line +
`app` fixture with its expected code pinned, and prove it red first — B11+ was, and that is
the standard this fix set for itself.

### B2 — `237 of 467` has a **fifth** home, and it is the follow-up this unit CLOSES on: `docs/followups/FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md:32` and `:50`

**Requirement violated:** the prior report's B1 closing instruction, quoted — *"⛔ Do not
update one site — a figure with four homes and one correction is worse than four stale
ones"* — and R33, which makes this follow-up's closure carry its own `Closes when` clause
**from the body**.

The fix loop measured well (both predicates as separate queries, a control that the ACL-shaped
and effective predicates provably disagree, zero residue after rollback — all recorded) and
updated `supabase/config.toml`, `scripts/check-supabase-config-schemas.mjs`,
`docs/lint-gates.md:31` and `docs/decisions/0195-…:32`. It did not sweep for a fifth site.
The body of the follow-up **being closed**:

- `:17-18` — the measurement table: `467` / `237`. ✅ **Correctly dated** (*"Measured
  2026-08-22 from the live catalog"*) and ⛔ **must not be rewritten** — it is the historical
  record, and R26's convention protects it.
- `:32` — *"If that one line ever gains `"app"`, **237 functions become directly callable by
  `anon` in the same edit**"*. This is not a 2026-08-22 measurement; it is the **live
  consequence clause**, in the present-conditional, and it is the sentence the four corrected
  sites are copies of. It now disagrees with all four of them.
- `:50` — item 3, the **operational instruction**: *"`supabase/config.toml`'s `[api].schemas`
  key should carry a comment saying that **237** `app` functions are anon-executable"*. Track D
  annotated it *"(2026-09-08 note, Track D: **done** …)"* — but the comment that was actually
  written says **236**. So the instruction, its "done" annotation and the delivered artefact
  now state two different numbers. This repo's convention names an operational instruction as
  the one thing that **is** edited, with the superseded text quoted.

This unit already did the right thing for the sibling case: R26's 137/138 correction is a
dated note beside the original figure in `FUP-AE1-REVOKE-SET-EXECUTION`'s body. The same
shape is owed here and was not applied. Because R33 makes the closure quote this body, the
superseded figure walks into the closure.

**What closes it.** One dated note under `:17-18`'s table naming the 2026-09-08 re-measurement,
its two predicates and its head, plus the pointer to the four sites that carry it; and edit
`:32` and `:50` to `236` with the superseded `237` quoted beside them (`:50` is an
operational instruction — the exception the convention names). ⛔ Do **not** touch the dated
table itself.

---

## MAJOR

### M1 — the census-arm note added for N3 restates the **superseded** three-condition framing, and cites as its authority the ADR that dropped it in the same fix loop

Three artefacts now give three answers to *"what does the §U4 reconciliation rest on?"*:

| artefact | what it says |
| --- | --- |
| `docs/decisions/0195-…:83` | *"The `ARM=census` prohibition is **satisfied on conditions (i) and (iii)**"*, with a correction note at `:88-97` saying *"(ii) is false of two of the three pinned literals … it must be argued on (i) and (iii), and claiming (ii) papered over the difference."* |
| `supabase/tests/320_…sql:409` | *"This gate survives that prohibition only if **THREE** things hold, and all three are asserted"*, with (ii) narrowed to 759 alone and *"(i) ALONE IS ENOUGH"* for the other two. |
| `supabase/tests/mutation/p0-authz-invariant.sh:538` (**new this fix loop**) | *"ADR 0195 D2 argues why … The reconciliation is stated in §U4's own header and **rests on three conditions**: (i) … (ii) the ceiling 759 is a PO RULING … (iii) …"* |

The census note was written in `1956e7bd`, **after** `4e3f0844` had already corrected the ADR
to two conditions. A reader who meets the census prohibition, follows the note's own pointer
to ADR 0195 D2 as instructed, and finds *"satisfied on conditions (i) and (iii)"* has been
handed a contradiction by the artefact whose entire purpose is that *only the amending
document knows about the amendment*.

**Second half of the same finding, and it is concrete.** That note also restates **759**,
**326** and **433** in a file gate 15 does not read (`check-budget-anchor.mjs` reads
`docs/backend-state.md` and `320` only — its scan output names exactly those two). ADR 0195
D2(iii) is *"the decision has **one home** and **every copy is gated**"*. The fix for N3
created three ungated copies of the committed literals inside the argument that (iii) holds.
ADR 0195's own new **D2a** (`:99-106`) does the same with 759/326/433.

**What closes it.** Re-word `p0-authz-invariant.sh:538` to the ADR's two conditions (or say
explicitly *"§U4's header states three; ADR 0195 D2 rests the reconciliation on (i) and (iii)
and explains why (ii) does not carry the per-schema pins"*), and either drop the three
literals from that note in favour of a pointer to the home, or mark them explicitly as an
**ungated restatement, correct as of 2026-09-08**, so a reader knows nothing reds if they rot.

### M2 — the fix-loop tip `834e55d8` has **no session-log entry** and **no gate run recorded anywhere**; the hub's *"Gate at the tip"* paragraph describes a superseded tip

**Requirement violated:** CLAUDE.md §7 — *"its **log** is its record's `## Session log`
(`docs/progress/<code>.md`; one dated entry per session, appended: witnesses, **gate runs**,
dead ends)"* and *"**Never report status verbally without writing it there first.**"* — plus
R37's own instruction, quoted: *"the fix-loop commit does NOT land until the re-review's gate
run is the last thing to touch the tip."*

`docs/progress/privilege-surface.md` has exactly one fix-loop heading: *"## 2026-09-08 — QA
fix loop, iteration 1 of ≤5 (`backend`)"*. Its gate block is authoritative for **`1956e7bd`**.
After it, `834e55d8` changed ADR 0195 (`+24`), the record's Subjects header and committed the
review file — and the lead's entire half of the loop (**M1, M2's ADR half, M4/R36, B1's fourth
site, N2, N5**) exists only in a commit message. The independent `lint` re-run at the tip that
the brief describes is written down nowhere. I re-ran it myself (rc 0, 15/15) so the *fact* is
not in doubt — but a fact only I hold is exactly what R37 was written about, in the unit whose
subject is records that go stale silently.

Two smaller instances of the same shape, both in the hub's `## Current state` — the unit's
**summary**, the artefact the next session reads first:

- `docs/features/privilege-surface.md:115-118` — *"**Gate at the tip** (independent runner,
  not a builder): every command rc **0**, `lint` reaching all 15 gates, `test:db` PASS…"*.
  That tip was `bd50dfc9`/`42ca7718`. Four commits — including edits to `320`, both gate
  scripts and `config.toml` — have landed since, and the paragraph names no sha.
- `:120-125` — `### In progress` reads as an **assignment list** (*"`backend` holds B1–B4,
  M2's `320` half and R35; the **lead** holds M1, M2's ADR half and this file"*) at a tip where
  both halves are committed. M4 was blocked last round for a summary that described a state
  three commits old; this is the same sentence pattern one iteration later.

**What closes it.** Append the lead's dated session-log entry (its items, and the `lint`
rc/gates-reached at `834e55d8` read bare), and re-word the hub's two paragraphs to the state
at the tip — the fix loop landed, awaiting re-review — naming the tip.

---

## MINOR / NOTED

**N1 — `scripts/check-supabase-config-schemas.mjs:113-114` states something false about the
file it sits in.** *"`M1+` … it is **the only place in this file that calls `report()`**"*.
`report()` is called at `:531` (its own escalation branch, recursively) and at `:986` (the
real scan — which is the whole point of the function). The claim intended is *"the only place
in the **self-test**"*, and that one is true and load-bearing. `docs/progress/privilege-surface.md`
repeats the wrong form (*"It is the **only** thing in the file that calls `report()`"*). One
word.

**N2 — the escalated headline can state a falsehood about PostgREST, and the qualifier is
already captured and unused.** Measured: with the `[api].schemas` line deleted and
`schemas = ["app"]` present under `[db.x]`, `inspect()` returns `N1_APP_EXPOSED_WITH_DEFECT`
and the headline reads *"`"app"` HAS BEEN ADDED TO THE POSTGREST-EXPOSED SCHEMAS"* — which is
not what happened. The escalation errs in the safe direction (it only ever fires alongside a
genuine red, and over-alarming beats under-alarming here), so this is a note, not a request.
But `appSighting` already records `table` (`:384`) and `report()` never reads it; one clause
(*"in the `[db.x]` table"* / *"outside `[api]`"*) makes the headline true in both cases.

**N3 — the per-schema pins' owner is named by a pointer whose target grants only one
direction.** `320:381` now says the split's *"owner is the triage owner, same as §U1's"*, and
`:376-382`'s own sentence about that owner is *"the same engineer **may lower** §U1's with the
removal measured."* The worked example the fix uses to justify the split
(`app` 326→325 **and `public` 433→434**) needs a **raise**. §U4's later paragraph does say
*"movable with the mover attributed and measured"*, so the intent is clear and gate 15's
parts-sum + `total <= ceiling` checks bound the arithmetic — but the sentence a reader is
pointed at says *lower*. Add *"in either direction, total-preserving — deliberately wider than
§U1's own 'may lower'"*.

**N4 — a citation written in the commit that made it stale.** The record's N9 paragraph cites
*"`check-budget-anchor.mjs:550,552`"* for the `argv` reads; at HEAD they are `:555-558`. The
same commit's header insertion moved them. *A cited LINE NUMBER rots when its artifact is
overwritten* — the fix's own subject, five paragraphs earlier.

**N5 — nothing owns or derives the new `236 / 526` pair, and its staleness direction is the
unsafe one.** Both figures are now dated and predicate-named in all four sites, which is what
B1 asked for, so this is not a request. Recorded because: if `app` grows and the new functions
carry the default `proacl`, the true `anon`-executable count rises **above** 236 and the N1
SECURITY message *understates* its own consequence. ⭐ It is bounded more than it looks — `320`
§U1 pins the ACL-shaped 236 exactly and reds on any growth in the dominant term — but that
bound is nowhere stated beside the pair, and `FUP-ACL-APP-POPULATION` is the only live owner
of anything adjacent. One clause in the header naming §U1 as what would notice, or a line in
that follow-up, closes it for free.

**N6 — the hub's `reviews:` frontmatter is `[]`** while `docs/reviews/privilege-surface-review.md`
is now a committed artefact cited in the hub's own prose (`:122`). Record-step work by the
role split, noted here only so it is not lost: gate 13's `complete` cross-check is row-grade on
that field, so it will be needed before the hub can go `complete`.

**N7 — informational, no action.** `docs/followups/FUP-ACL-APP-POPULATION.md:1,8,13,15` and
`docs/backend-state.md:1863,5407` still carry the ACL-shaped `237 of 454` from 2026-08-17.
That is a **different predicate on a different population** from B2's figure, it is dated at
its source, §U1's live pin already moved to 236 with the removal named, and the item is not
one of this unit's three closures. Recorded only so a fix-loop sweep does not confuse the two
`237`s and "correct" the wrong one.

---

## Verified sound in this fix loop — do not re-do these

- **B2 (duration) — correct and complete.** `docs/lint-gates.md:1` now reads *"for 48 minutes"*
  with `⚠ CORRECTED 2026-09-08`, the superseded *"for five days"* quoted, both commit
  timestamps given, the finding explicitly kept (*"this list is hand-maintained, nothing gates
  it, and it did lag"*), and R13's same-commit rule recorded as **honoured** for the bullet.
  Both accounts are said, which is what was asked.
- **B3 (the `159` predicate) — correct, and it did not move a literal.** `320`'s U6d message
  now says *"159 members of this population have `proacl IS NULL`"*, with a 12-line dated note
  above the assertion explaining why the old wording was unsafe and citing §9.4's seven
  non-NULL PUBLIC members. The trailing clause (*"reached with no entry naming `authenticated`
  at all"*) is an entailment of `proacl IS NULL`, not a new unmeasured claim. `plan(36)` is
  unchanged at `320:25`; the `is()` literal on that line moved 760→1 as part of **R35**, not B3.
- **B4's escalation — real, and it does not trade the structural finding away.** I confirmed on
  four of five combination cells (table in **B1**) that the headline leads with the SECURITY
  event and the structural code rides underneath, named in `detail.under` and rendered in full
  by the recursive `report()` call at `:531`. `report()` is exported. `M1+` (`:861-908`) asserts
  headline distinctness **after** a dead-instrument guard (each headline ≥ 40 chars, because two
  `undefined`s are also "distinct") and **after** a positive control proving the comparator can
  return SAME — both of which I read and both of which are the right controls. `B11+` carries a
  `shape` guard rejecting the degenerate cases where only one half of the mutation applied. Both
  new fixtures are recorded as **proven red first** (rc 2, with the observed message quoted),
  and a **third mutation that did not apply is recorded as not counting** rather than banked.
- **R35 — the delta rewrite is sound, and the vacuity attack fails.** The baseline is
  materialised by `create table pg_temp.budget_baseline as select …` **before §U5 creates its
  first probe** and after §U4's absolute pins — so no plant can be inside it — and the comment
  states the reason a table was used rather than a function (*"A function re-querying the
  catalog would move WITH every probe below and make every delta trivially 0"*), which is the
  right hazard. §U4's three pins stay absolute. I checked the obvious way a delta suite goes
  quiet: a dead `pg_temp.budget()` would satisfy every `delta 0` assertion but still red U5d,
  U5e, U6a, U6d and U6f, which expect ±1 — the section cannot go vacuous as a whole, and §U4's
  absolutes anchor the instrument independently. U6h's move from `== 236` to `delta 0` loses no
  coverage: §U1's own absolute assertion above is still the only pin on that number, and U6h now
  asks the strictly different non-disturbance question its message claims. The re-measurement is
  recorded (`Failed 2/36`, subtests 20–21 = U4b/U4c), and `414`'s co-failure is correctly
  attributed to the plant's own `search_path`-less probe rather than to the change.
- **M1 (ADR Consequences) — closed correctly and better than asked.** `:183-192` now leads with
  *"A silent rise is now impossible"*, states in terms that **the merge rule itself still has no
  enforcer**, names both of its clauses, gives the concrete single-commit scenario that passes
  both gates, and ends *"the merge rule remains enforced by the record, not by a gate … the
  gates buy that the number cannot move **unnoticed**; they do not and cannot check that it
  moved **legitimately**."* The superseded sentence is quoted.
- **M2's substance — I attacked the (i)+(iii) defence again and it holds.** The separation that
  does the work really is *compared* versus *printed*: the census banner's `(407 reachable)`
  could drift 20 beside four green arms because nothing consumed it; `320` §U4's literal is an
  argument to `is()` against a figure `pg_temp.budget()` re-derives every run, so a drift cannot
  survive one run. (iii) then bounds the copies. The ADR is also honest about what it did **not**
  do — that the census arm's own remedy (deriving the figure from the predicate) is *stronger* —
  rather than glossing it. The split of ruled-vs-measured is now stated at `320:406`, `:452`,
  `:381` and ADR `D2a`, coherently. My residual objections are M1's cross-artefact wording and
  N3's one-directional pointer, not the argument.
- **M3** — the dated note at `docs/backend-state.md:554-563` is exactly the convention: the
  sentence is left as written, the note says the ceiling **did** move by R24 in the subsection
  below, explains that the sentence described its own section's scope (which is what made the
  later ruling legitimate), and states that gate 15's `PROSE_RE` cannot see it. Gate 15 re-run
  by me: still exactly one prose ceiling at `:505`.
- **M4 / R36 — closed the way R36 ruled, not the way I asked.** The counts were **removed**, not
  corrected, with the derivation named (`grep -c '^## R' batch7-rulings.md`) and the fixture
  count deferred to the self-test's own output. That is the stronger repair and it is the
  standing one from Batch 6.
- **N2 (R33's re-open condition) — it is a condition, not a restatement.** ADR 0195 D8's block
  gives four disjuncts, each with a named, observable trigger: §U4 redding **upward**; any unit
  opened to execute any revoke on this surface (naming the single-item follow-up as the smallest
  instance); AE5's opening ADR being drafted in Batch 9; any of the three measured hazards being
  discharged or refuted. It also states what does **not** re-open it (time passing, register
  tidiness) and requires re-derivation at the then-current head whatever fires — which is the
  Batch 0 precedent's shape. Falsifiable. Discharged.
- **N5 (ADR status) — discharged, and the mechanism is stated.** The `**Status:**` line now
  carries its own flip trigger *and* says plainly that registering in `proposed-review.json` is
  what makes gate 9 green, so nothing reds if the flip never happens. I verified the extended
  line still parses: `docs/decisions/INDEX.md:23,221` list 0195 as proposed, and gate 9 is green
  in my `npm run lint` run.
- **N9 — discharged by falsifying my own claim, which is the correct outcome.** I reported that
  gate 15 implements `--print` and gate 14 does not. Measured: `check-budget-anchor.mjs`'s only
  `argv` reads are `--self-test` (`:555-558`). Neither implemented it; both usage lines are
  corrected in one commit and the flag is removed rather than invented. Recorded as a correction
  to the review, not silently absorbed.
- **N1 / N3 / N4 / N8 / N10 / N12 — all discharged as written.** The record's Subjects header is
  repointed with the superseded text quoted and keyed to `[api].schemas` rather than a line
  number; the census note exists (its wording is **M1** above, not its absence); the
  `FUP-AUTHZ-IS-AFFILIATED-…` closure clause now names the §U5/§U6 surface and ties it to R35's
  repair, with the ⛔ re-widening condition attached; gate 14's three header overclaims are
  corrected in place and the `canonicaliseBaseline` note now enumerates what the repair
  **cannot** produce; `CONFIG_PATH` resolves from `import.meta.url`; the blank line is restored.
- **Security / RLS — unchanged and unmoved.** No migration, no ACL change, no policy change, no
  `src/` change, no `prosecdef` object outside `320`'s rolled-back transaction, no secret,
  no `NEXT_PUBLIC_` change, no service-role reachability change. Gate 14's bound (**proves the
  FILE, never the DEPLOYED PostgREST config**) survives every edit in this loop and is still
  stated in all three of R18's places. The escalation change is strictly additive: `P1` is
  exempt, every previously-failing code still fails, and the `OK` path is untouched — the four
  good fixtures still pass and the real scan is rc 0.

---

## Fix list, in order

1. **B1** — cover the multi-line + `app` cell (scan the array body for the sighting), or narrow
   `scripts/check-supabase-config-schemas.mjs:372-376` to what the probe does; either way add
   the fixture with its expected code pinned and prove it red first.
2. **B2** — dated note under `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md:17-18`'s table;
   `:32` and `:50` edited to `236` with `237` quoted beside them. ⛔ The table itself is not
   rewritten.
3. **M1** — reconcile `p0-authz-invariant.sh:538` with ADR 0195 D2's two conditions, and mark
   its 759/326/433 as an ungated restatement.
4. **M2** — the lead's session-log entry, with the `lint` rc and gates-reached at `834e55d8`
   read bare; the hub's `Gate at the tip` and `### In progress` re-worded to the tip.
5. **N1–N5** as written. **N6** is Record-step work; **N7** is informational only.

⚠ **No pinned literal moves and no gate script logic changes in items 2–5**, so `npm run
test:db` is owed again only if **B1** is fixed in code (it edits gate 14, which
`test:db` does not run — but `npm run lint` gates 14 and 15 both read files these edits touch).
Quote which gates each run **REACHED** (`&&` short-circuits) and read every rc **bare**. Per
**R37**, the re-review's gate run must be the last thing to touch the tip.

---

*Reviewer: `qa`, re-review of fix-loop iteration 1 of ≤5. Read-only on application code; this
file is the only artefact written.*
