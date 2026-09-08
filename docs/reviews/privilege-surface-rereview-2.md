# PRIVILEGE-SURFACE (pre-AE5 Batch 7) — QA RE-REVIEW 2, final

**Verdict: APPROVED**

Re-reviewed at `52959b8a`, branch `authz-privilege-surface`, tree clean
(`git status --porcelain` = 0 bytes, read bare). Prior reports:
`docs/reviews/privilege-surface-review.md` (CHANGES REQUESTED, 4 blocking) and
`docs/reviews/privilege-surface-rereview.md` (CHANGES REQUESTED, 2 blocking + 2 major).
Scope: the three fix-loop iterations `834e55d8..52959b8a`, and any NEW defect they introduced.
⛔ Neither prior report's *"Audited and found sound"* / *"Verified sound in this fix loop"* list
was re-audited, per the brief.

⛔ **Read-only on application code. ⛔ The DB stack was not touched** — no `db reset`, no
`test:db`, no `psql`, no harness. Every catalog fact below is taken from the gate record, never
re-measured. This file is the only artefact written.

**Measurements I ran myself, all read-only, every rc read bare:**

- `npm run lint` → **rc 0**, and the chain reached all **15** gates, `lint:budget-anchor` last
  (its OK banner is present in the run's own output, so nothing short-circuited).
- `node scripts/check-supabase-config-schemas.mjs --self-test` → **rc 0**, *16 bad fixtures each
  caught for its own reason, 4 good fixtures each clean*.
- `node scripts/check-budget-anchor.mjs --self-test` → **rc 0**, *15 bad pairs … 5 good pairs*;
  real scan → **rc 0**, `ceiling=759 app=326 public=433 total=759`.
- `npm run lint:registers` → **rc 0**, `162 bugs, 3 bug docs, 213 follow-ups`, and the nine
  ratchets read **identical** to the figures `52959b8a`'s record entry claims — independent
  confirmation, not a re-quote.
- `git diff --name-only main...HEAD -- supabase/migrations supabase/seed.sql src` → **0 bytes**.
- `git diff --name-only d428d515..52959b8a` → **10 files**, all `docs/` plus
  `scripts/check-budget-anchor.mjs`. Nothing under `supabase/` or `src/`, so `test:db`, the four
  authz arms, the door sweep and `typecheck` are legitimately **not re-owed** at this tip — the
  record asserts this rather than assuming it, and I re-derived the same result.
- Independent grep sweeps for the `236` / `526` / `237` / `467` figures across tracked files, and
  a per-site read of every home the sweep returned.

---

## Summary

**Nothing in this unit can move the security boundary, and that is measured rather than argued.**
No migration, no ACL change, no policy change, no `src/` change, no `SECURITY DEFINER` object
created outside a rolled-back pgTAP transaction, no `NEXT_PUBLIC_` change, no service-role
reachability change. The R5 pathspec is empty at the tip and the five out-of-pathspec areas are
named beside the zero (R34). RLS is untouched; `prosecdef` was relevant only inside `320`'s
rolled-back probes, and §U6h proves the incumbent population undisturbed after them.

The six findings the FINAL independent tip gate raised at `d428d515` are addressed, and three of
the four items I would have raised myself were pre-empted by the fixer's own pushbacks:

- The Vitest flake is filed as `BUG-0137-MRN-WARNING-TEST-FLAKY` (`open` / `high` / `referrals`)
  with a per-bug document, and the document **refuses the rate the brief and the gate entry both
  used**: *"⚠ Stated as a sample, never as a rate … `n = 2` … ⛔ Do not quote 'one run in two' as a
  measured rate — it is two runs."* That is the correct handling of
  *two-accounts-of-one-event*, and the impact clause states the inverse harm (a step-1 green stops
  being evidence) rather than only the observed red.
- Gate 15's hardening is real, and its rc-0 mirror control was given the **discrimination half** it
  lacked: planting `326 → 327` in the mirror's own `320` makes the mirror copy exit **1** while the
  repo's pair stays clean. Without that, an rc 0 could not tell "reads the mirror" from "silently
  reads the repo".
- The `docs/lint-gates.md` falling-polarity clause is corrected to name **§U4**, with the
  superseded sentence quoted, and it says in its own words that nothing was ever unprotected — the
  defect was **attribution**, which is precisely what R11 exists to keep honest.
- Iteration 3 built the **right** three cells. I checked the mapping against the re-review's own
  five-row table rather than against the brief's paraphrase: rows 2, 3 and 4 → `B14+`, `B15+`,
  `B16+`; rows 1 and 5 were already held by `B11+` and `B13+`. R43's account is accurate. `M-G`'s
  result is the iteration's real product — deleting the `P3_DUPLICATE` branch moved **only**
  `B15+`, and it moved to `NOT CAUGHT (OK)`, so before `B15+` that branch could have been deleted
  with no arm noticing.

**Nothing here must not ship.** The verdict is `APPROVED` with **four MAJOR** items for
disposition at the Record step and six minors. Two of the four —
**M1** and **M4** — are *not* repaired as a side effect of the Record step's normal rewrites, so
they need to be done deliberately; **M2** and **M3** sit in hub sections the Record step rewrites
anyway, and both err in the **understating** direction.

I considered blocking on **M1** and did not, for reasons stated in the finding.

---

## MAJOR

### M1 — the new anon-residue follow-up's "derived" sweep misses a site of its own class, and its closing clause is a **false universal negative**: `docs/design/authz-evolution-census-ae0.md` carries the same figure under the same predicate over the same population, four times, including an operational instruction

**Requirement violated:** the follow-up's own body, quoted —
`docs/followups/FUP-AUTHZ-ANON-RESIDUE-FIGURE-HAS-MORE-HOMES-THAN-ANY-SWEEP-FOUND.md:30-31`:
*"**What it did NOT correct, and why** — these are outside the unit's subject and are listed here
from a **derived** sweep (`git grep -n '\b237\b'`), not from reading"* — and `:43-45`:

> ⛔ **Every other `237` in the tree is a different population** — C2 Tier-1 door counts (0171,
> 0187, the c2 design docs), `Buffers: shared hit=237` in perf traces, and line-number references.

That sentence is false. `docs/design/authz-evolution-census-ae0.md` § 6.2 / § 6.3 carries the
figure under the **identical** predicate over the **identical** population, and is named nowhere
in the entry — not in the corrected list, not in the not-corrected list, not among the protected
ADRs:

| site | text |
| --- | --- |
| `:384` | *"`app` functions that are `anon`-executable, **any security type**: **237**"* |
| `:391` | *"the residue should be stated as *'237 `anon`-executable `app` functions, of which 167 are DEFINER'*"* — an **operational instruction** |
| `:398` | *"`anon` lacks `USAGE` on schema `app`, so all 237 are unreachable"* |
| `:402` | *"the identical `has_function_privilege('anon', …)` predicate returns **237** for schema `app`"* — the predicate named in terms |

⭐ The classification is **inconsistent on its own terms**. `docs/design/authz-ae1-tier1-threat-review.md`
is a design document headed *"**Measured 2026-08-27**, local stack, migration head …"* and the
entry lists it as an open present-tense site. `authz-evolution-census-ae0.md` is a design document
headed *"**Measured:** 2026-08-27 (UTC)"* with the same shape and the same figure, and it is
swept into *"a different population"*. One of the two sibling axes was swept; the other was
declared clean without being looked at — *sweeping one sibling axis reads as sweeping the class*,
which is the lesson this very entry cites about the three rounds before it.

⚠ **I am not asking for a correction to `ae0`.** It is the source document ADR 0160 was written
from (`0160-ae0-corrections-to-adr-0155-measured-figures.md` § Correction 1 restates §6.2's
167/70/237 derivation), so it belongs in exactly the protected class the entry already names for
0155/0160. What is owed is the **classification**: name it and rule it protected, the way the ADRs
were named and ruled protected. One line.

**Second instance, same finding, and it is the tip gate's own.** The gate's finding 2 named
**three** stale instances: the hub, the plan, and *"a third, smaller instance:
`FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md:50` still reads *'the class is 237 of 467'*
unannotated."* `316c5367` corrected the first two and its commit message closes finding 2
(*"Homes 6 and 7 … Both now 236 of 526"*). `:50` is untouched and **no record says it was ruled
historical**. Read in context it is defensible — the sentence is inside the ⭐ *"How this was
nearly filed wrong"* narrative, i.e. a record of the original 2026-08-22 filing — but that is a
disposition, and a disposition nobody wrote down is indistinguishable from a miss. It is the
`:32`-corrected-and-`:50`-uncorrected pair the gate entry itself flagged, in one file.

**Why I did not block.** The item is open, 🟡, owned, carries no exposure (the figure is bounded by
a config line that is now gated), and its close condition's durable half — *"state how the class is
enumerated"* — would catch `ae0` on execution. Blocking would force a PO escalation over a
classification line in an open register entry.

**What closes it.** In `FUP-AUTHZ-ANON-RESIDUE-…md`: add `docs/design/authz-evolution-census-ae0.md`
§ 6.2/§ 6.3 to the not-corrected list, ruled protected for 0160's sake and named with its four
occurrences; and re-word `:43-45` from *"Every other `237` in the tree is a different population"*
to a statement of what was classified rather than a universal negative. In
`FUP-APP-SCHEMA-…md:50`: one dated clause saying the `237 of 467` there is the filing's own
figure and is left as written.

### M2 — the hub's `## Current state` says *"the gate is re-owed at the final tip"*; the FINAL 14-command tip gate has been run, and the summary does not mention it

`docs/features/privilege-surface.md:121-127`:

> **Gate at the tip** (independent runner, not a builder) — ⚠ **run against `bd50dfc9`, which is
> NOT the current tip** … ⇒ **The gate is re-owed at the final tip** and this paragraph names its
> commit so the two cannot be confused.

**Requirement violated:** CLAUDE.md §7 — `docs/features/<code>.md` § Current state is the unit's
**summary**; gate 13 checks its presence and shape, never its truth.

The paragraph was written by `1bb3fdf4` (iteration 2) and was **true then**. `f3bb6258` then
recorded `### 2026-09-08 — FINAL gate at the tip d428d515 (independent runner)`
(`docs/progress/privilege-surface.md:1260`) — 14 commands, every rc read bare, all green, the four
arm domains quoted verbatim, the `SCOPE:` line quoted, `PATHSPEC_BYTES=0`. `316c5367` — the commit
whose subject line is literally *"the final gate's lead items"* — then edited this file ten lines
above and left the sentence standing. At the tip it is false, and the summary's only account of a
tip gate is the **superseded** `bd50dfc9` run.

⚠ It errs in the **understating** direction (it claims less coverage than exists), which is why it
is not blocking, and the Record step rewrites this paragraph anyway. Recorded because it is the
third consecutive round in which the hub's present-tense prose describes a superseded tip.

### M3 — the hub's `### In progress` still reads *"Fix-loop iteration 1 of ≤5"* at a tip four iterations later, and the re-review's request for it was dropped with no record saying so

`docs/features/privilege-surface.md:129-134`:

> **Fix-loop iteration 1 of ≤5.** QA returned **CHANGES REQUESTED** … `backend` holds B1–B4, M2's
> `320` half and R35; the **lead** holds M1, M2's ADR half and this file.

Iterations 2, 3 and 4 have all landed. The re-review's M2 asked for **both** hub paragraphs
(*"re-word the hub's two paragraphs to the state at the tip"*); the lead's record entry for that
iteration (`docs/progress/privilege-surface.md:963`+) discharges the `Gate at the tip` half and is
**silent on this one** — so a reviewer cannot tell a decline from a miss. This is the same section
review round 1 blocked as **M4** and re-review round 2 raised as **M2**: three rounds, one
paragraph. *A reviewer's "could not verify" list is a work item* — so is a reviewer's request that
half-lands.

### M4 — the lead's iteration-4 commit `316c5367` carries **no session-log entry and no gate run**, and the tip gate's findings 2, 3 and 5 are recorded nowhere as discharged

**Requirement violated:** CLAUDE.md §7 — *"its **log** is its record's `## Session log`
(`docs/progress/<code>.md`; one dated entry per session, appended: witnesses, **gate runs**, dead
ends)"* and *"**Never report status verbally without writing it there first.**"*

`git grep -n 316c5367 -- docs/` returns **nothing**, and the record's last heading is
`### 2026-09-08 — fix loop 4, `backend`'s three of the tip gate's six findings (1, 4, 6)`
(`:1542`). The lead's half — the hub's homes 6 and 7, the `line 51 → 71` removal, the twice-stale
fixture count removal, the new anon-residue follow-up, and **R38's discharge in ADR 0195** — exists
only in a commit message. A reader of the record sees six findings reported by the tip gate and
three recorded as closed.

⛔ **This is a recurrence of a finding already blocked and already repaired one iteration earlier.**
The entry that closed it opens: *"⛔ **This entry exists because QA's re-review found the previous
one missing.** Commit `834e55d8` landed the lead's remaining fix-loop items and **carried no
session-log entry and no recorded gate run** — a breach of CLAUDE.md §7 … and of R37, which the
lead wrote **in this unit, about this unit's own freeze discipline**."* The same shape, two commits
later, in the same unit.

⚠ Mitigations, stated so this is not read as worse than it is: `52959b8a`'s entry records
`npm run lint` rc 0 / 15 of 15 at a tip that **includes** `316c5367`, and I re-ran it myself, so no
gate fact is in doubt. R38 **is** discharged — `docs/decisions/0195-…:197-203` now reads *"MEASURED,
not predicted … the independent tip runner **witnessed** it: rewriting the line-13 mitigation banner
leaves gate 14 **green (rc 0)**"* with the record cited. The defect is that the record does not say
so.

⛔ Unlike M2 and M3, the Record step does **not** repair this: the record is append-only, so a
missing entry stays missing unless one is written.

**What closes it.** Append the lead's dated entry for `316c5367`, naming its items, stating which
of the tip gate's six findings it discharged (2, 3, 5) and quoting the gate rc it stood on.

---

## MINOR / NOTED

**N1 — `docs/lint-gates.md:33` names the wrong actor for R35's baseline, inside the correction whose
subject is accurate attribution.** The new clause reads *"…as a **delta from a baseline that
`pg_temp.base()` re-derives from the live catalog in the same transaction**"*. `pg_temp.base()`
does not re-derive anything: it reads `pg_temp.budget_baseline`, a table materialised **once** at
`supabase/tests/320_act_expiry_and_acl_hardening.sql:557-560`, before §U5's first probe — and
`320`'s own comment says a function that re-queried the catalog *"would move WITH every probe below
and make every delta trivially 0"*, i.e. exactly the design R35 rejected. The sentence therefore
describes a **vacuous** control. The next clause (*"would snapshot 758"*) says the right thing, and
the same fixer's record entry gets it exactly right (*"a table **snapshotted** from the live catalog
in the same transaction (`320:557-560`)"*), so this is one word out of place rather than a wrong
belief. Repair: *"a baseline `pg_temp.budget_baseline` **snapshots** from the live catalog before
the first probe, read back by `pg_temp.base()`"*.

**N2 — all three acceptance-criteria boxes are `- [ ]` at the tip presented for approval.**
`docs/features/privilege-surface.md:33`, `:46`, `:59`. The section's own legend at `:30-31` exists
precisely to make checking them before closure correct: *"⚠ **A checked box means the CONDITION IS
MET AND PROVEN, not that the register entry is closed.** Entries stay `Status: open` until the
Record step."* I audited all three and **all three are met and proven** — the ceiling item on its
derivable clause (seven attributed by set difference, each with its increment; R24's ruling with
`CEILING: 752` quoted beside 759), and the two `PO to rule` items on R1 and R2, each with the
re-derivation its body demands and, for R1, the four-disjunct re-open condition in ADR 0195 D8.
The **Proven-to-fire** criterion holds (both gates red-first, re-verified from outside by the tip
runner), and the **Gate** criterion holds at `d428d515` with the tail of commands correctly
asserted not-owed at `52959b8a`. So the unchecked boxes understate the state rather than
overstating it — but leaving them unchecked at the QA gate is an absent claim where the hub's own
legend offers a present one. Either check them at the Record step or say in the hub when they get
checked. ⛔ All three follow-ups remaining `Status: open` is **correct** and must not be "fixed".

**N3 — an ungated copy of `320` §U1's pinned 236 inside gate 14's N1 message.**
`scripts/check-supabase-config-schemas.mjs:576`: *"§U1 pins the `app` PUBLIC-executable set at 236
and calls it defence-in-depth"*. Gate 15 mirrors only §U4's three tagged literals, so if §U1's
ratchet moves by triage this string goes stale silently — in the message a reader meets at a
security event. The header's own do-not-infer paragraph is what keeps it honest today; a pointer
(*"§U1's own pin — see `320`"*) instead of the digit would close it for free. Not requested.

**N4 — three of the record's dated entries sit at `##`, i.e. structurally outside `## Session log`.**
`docs/progress/privilege-surface.md:836`, `:1043`, `:1159` (fix-loop iterations 1, 2, 3) are `##`
headings, siblings of `## Session log` at `:41`, while every other dated entry is `###`. Iteration
3's was added inside this review's range. Gate 13 tolerates it; ADR 0186 D3 makes the log the dated
entries **under** `## Session log`.

**N5 — the follow-up register heading for the config-bounded item still reads *"half of `app` is
PUBLIC-executable"*.** `docs/followups/follow-ups-open.md:698`. True of `237 of 467` (≈51%) when
filed 2026-08-22; `236 of 526` is ≈45%. It is a filing heading and R30/R26's convention protects
it, so no action — recorded only so the closure does not inherit the word.

**N6 — informational, no action.** `FUP-AUTHZ-GATE14-OK-PATH-DISCARDS-THE-APP-SIGHTING`'s close
condition reads *"⛔ Not closed by observing that both branches exit non-zero today: one of them
exits **0**, which is the whole item."* The two clauses read as contradicting each other on first
pass; the meaning (*do not close it on a false observation*) is clear on second. Left as written.

---

## Verified sound in this fix loop — do not re-do these

- **The `236 of 526` figure, derived not read.** I ran the sweep myself (`git grep` on
  `236 of 526` / `of 526` / the `anon`-executable phrasings / `237 of 467`) and read every site it
  returned. **Seven live homes**, and every one names the **effective** predicate
  (`has_function_privilege('anon', …, 'EXECUTE')`), carries the head `20261003007350`, is dated
  2026-09-08, and carries the ⛔ do-not-infer-from-`320`-§U1 clause: `supabase/config.toml:17-24`
  and `:38-45` · `scripts/check-supabase-config-schemas.mjs:5-25` and its `report()` constants at
  `:560-561` (dated via the header it points to) · `docs/lint-gates.md:31` ·
  `docs/decisions/0195-…:32-33` · `docs/followups/FUP-APP-SCHEMA-…md:32` (dated note, superseded
  `237` quoted, the `:17-18` table correctly untouched) and its item 3 at `:57-65` (which
  deliberately restates **no** figure — the right call) · `docs/features/privilege-surface.md:60-68`
  · `docs/plans/pre-ae5-remediation.md:325`. ⛔ **None** of the seven infers the effective 236 from
  `320` §U1's ACL-shaped 236, and the coincidence is stated as measured with the disagreement probe
  named. `git grep "237 of 467"` returns exactly one residue, dealt with in **M1**.
- **The two new follow-ups' close conditions are falsifiable and close on the class.**
  `FUP-AUTHZ-ANON-RESIDUE-…`: *"⛔ **Not closed by correcting the sites alone** — that is precisely
  what each of the three previous rounds did"*, plus the durable conjunct (*state how the class is
  enumerated*), plus three explicit ⛔ non-closures (editing 0155/0160; any sweep treating `237` as
  one class). That is the right structure, and it is the direct answer to the *close-condition-names-
  the-case-that-cannot-fail* trap. `FUP-AUTHZ-GATE14-OK-PATH-…`: two named options, each with the
  consequent edit the other option forces (option (a) obliges re-wording the N1 headline; option (b)
  obliges changing `B16+`'s expectation), and ⛔ not closed by editing the comment. Both are
  decisions with owners, not defects with fixes. R45's disposal is correct.
- **Gate 15's hardening breaks nothing that relied on the old resolution.**
  `scripts/check-budget-anchor.mjs:120` is `resolve(fileURLToPath(import.meta.url), '..', '..')`,
  **character-identical** to gate 14's at `scripts/check-supabase-config-schemas.mjs:206` — I
  checked both rather than trusting the comment that says so. `resolve` is imported at `:102`. The behaviour change is
  confined to a copy placed **flat**, outside any `scripts/` directory (0 → 1, *subject absent*);
  the **`<mirror>/scripts/` shape the tip gate's external mutation harness actually used** is
  preserved and was proven live by the discrimination plant. The in-tree scan and self-test are rc 0
  under my own runs, and `npm run lint` (which always runs at the package root) is unaffected. ⛔ I
  found no consumer of the flat shape: the gate is invoked only as `npm run lint:budget-anchor` from
  `package.json` and as a `<mirror>/scripts/` copy by the harness.
- **The overclaims the fixer pushed back on were each right to push back on.** *"reds one run in
  two"* is an inference from `n = 2` and the bug row and document both refuse it in terms. The
  mirror-root rc-0 control genuinely had no discrimination half and now has one. And §U4's three
  pins really are separately-failing — I confirmed the corrected `docs/lint-gates.md` clause claims
  only what holds (each pin absolute ⇒ a fall in `app`, in `public`, or in the total reds U4a, U4b
  or U4c respectively); it does not claim a total-preserving redistribution is a fall, which would
  have been the overclaim.
- **Iteration 3's fixtures and the escalation are sound, and the honesty about their bound is
  better than asked.** `collectArrayBody` (docstring `:336-368`, body `:369-382`) is bounded and dumb, over-collection can only
  escalate an already-firing red, and the single-line early return leaves the `OK` path
  byte-identical — which is why the clean scan is still rc 0. Its docstring states what it does
  **not** buy (*"a basic string spelling it by escape (`"app"`) defeats both arms … the claim is
  'the word `app`, wherever it sits inside the array', NOT 'any expression denoting that schema'"*),
  which is the opposite of the false claim that was nailed over the unexercised cell one iteration
  earlier. `expectUnder` (`:1216-1222`) is the right addition: `expect` alone could not see whether
  the structural finding survived **underneath** the escalated headline, and a missing `detail`
  fails rather than passing silently. Every one of `B12+`–`B16+` carries a `shape` guard that pins
  which degenerate copy it must not become, and each guard uses `^[ \t]*` and
  `split(/\r\n|\r|\n/)` per R42.
- **`M1+` survives every edit and now asserts more.** Dead-instrument guard first (each headline
  ≥ 40 chars), positive control on the comparator (it must be able to return SAME), then N1 vs N2
  distinctness in both the plain and escalated forms, the word `app` on the headline in both, the
  `SECURITY EVENT` marker, the consequence **count** on the headline (`/\d{2,}/`), and the negative
  that no N2 headline announces itself as a security event. R16's hard condition is held by an arm,
  not by reading.
- **The `OK`-path bound is filed rather than picked.** `scripts/check-supabase-config-schemas.mjs:525-541`
  states the inconsistency as **constructed and read**, names the one return not routed through
  `positive()`, says explicitly that the escalation comment above the probe *"is true of every
  POSITIVE path and false here, and the sentence is left standing only because this note bounds
  it"*, and points at the follow-up. That is the correct disposal of a judgement inside a fix loop.
- **Security / RLS — unchanged and unmoved.** No migration, no seed change, no ACL change, no policy
  change, no `src/` change, no `prosecdef` object outside `320`'s rolled-back transaction, no
  secret, no `NEXT_PUBLIC_` change, no service-role reachability change. Gate 14's bound (**proves
  the FILE, never the DEPLOYED PostgREST config**) survives every edit in this loop and is still
  carried in all three of R18's places; the behavioural gap remains filed rather than papered over.
  Gate 15's bound (**compares two committed TEXTS, never the live population**) is printed on its
  own OK banner.

---

## Record-step worklist, in order

1. **M4** — append the lead's dated session-log entry for `316c5367`, naming its items and which of
   the tip gate's six findings (2, 3, 5) it discharged, with the gate rc it stood on. ⛔ The only
   item the Record step does not repair by itself.
2. **M1** — classify `docs/design/authz-evolution-census-ae0.md` § 6.2/§ 6.3 in the anon-residue
   follow-up (protected, for 0160's sake), re-word `:43-45`'s universal negative, and give
   `FUP-APP-SCHEMA-…md:50` its one-line disposition.
3. **M2 / M3** — the hub's `Gate at the tip` and `### In progress`, as part of the normal
   `complete` rewrite. Name the `d428d515` gate.
4. **N1** — one word in `docs/lint-gates.md:33`.
5. **N2** — check the three acceptance boxes (they are met and proven) or state when they get
   checked. ⛔ The three follow-ups stay `Status: open` until after PO approval.
6. **N3–N6** as written; **N5** and **N6** are informational only.
7. Carried from the re-review, unchanged: the hub's `reviews:` frontmatter is still `[]` and must
   name both prior reports and this one before the hub goes `complete`.

⚠ **No pinned literal moves and no gate logic changes in any of the above**, so `npm run test:db`
and the four authz arms stay not-owed; `npm run lint` is owed once after the edits because gates 7,
13 and 15 read files they touch. Quote which gates each run **REACHED** (`&&` short-circuits) and
read every rc **bare**.

⚠ **R46's unavoidable residue, stated rather than left to imply coverage:** this report's own commit
lands *after* the gate that blessed the tip it reviews. The lint and self-test runs quoted at the
top of this file were taken at `52959b8a` with the tree clean, and nothing was committed while they
ran.

---

*Reviewer: `qa`, final re-review (fix-loop iteration 4 of ≤5). Read-only on application code; the
DB stack was not touched; this file is the only artefact written.*
