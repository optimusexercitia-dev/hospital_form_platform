# ADR 0191 — The door arm's domain gains a SCHEMA axis, the set-valued resolvers get a committed home, the read arm stops being mirror-ambiguous, and a fourth outcome stops discarding a real signal

**Status:** proposed (unit PRED-DOMAIN, Batch 2 of the pre-AE5 remediation batches; awaiting PO
approval of the unit)
**Date:** 2026-09-05 (branch `authz-pred-domain`)
**Area:** authorization / the door-blindness sweep / measurement domains / findings baselines
**Amends:** ADR [0173](./0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md) (§4
"`PRED_DOMAIN` is NOT widened. The bound is NAMED and ROUTED to C2" — the bound is now widened
along a THIRD axis §4 did not consider, and §4's own reason is why that is consistent) · ADR
[0079](./0079-authz-door-blindness-standing-invariant.md) (Amendment 9's "NAME *or* PROPERTY"
domain gains a third admitting disjunct; the §7.15 shape classifier gains a fourth outcome; the
arm gains a printed DOMAIN STATEMENT)
**Related:** ADR [0182](./0182-statement-scoped-authorized-scope-ids.md) (the set-valued
resolvers; it records NO suite shape and NO verdict tokens, which is why they owe FIRST verdicts)
· ADR [0184](./0184-c2-sweep-runs-against-the-current-branch-schema.md) point 4 + ADR
[0187](./0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md) D1 (the
uncovered populations a gate record must state — this ADR adds the fourth) · ADR
[0190](./0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md) (the deriver
LIFTS `PRED_DOMAIN`, so this widening needs no deriver change; and the merge this re-baseline is
the first real exercise of) · ADR [0153](./0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)
· ADR [0171](./0171-c2-tier-2-deferred.md) · ADR [0176](./0176-ae49-resolver-contract.md) D4 ·
`FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` ·
`FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS` ·
`FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` ·
`FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE` ·
`FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN`

## Context

`supabase/tests/mutation/p0-authz-door-audit.sh` is the instrument behind CLAUDE.md §6 step 1: it
neutralizes each authorization gate, runs the whole pgTAP suite, and reads whether **anything**
noticed. ADR 0079's governing sentence is that **a green arm bounds its own domain** — a verdict
is meaningless without the domain printed beside it.

Five open follow-ups all said the same thing about this arm from five directions: **its domain is
smaller than its name**, and in one place its verdict claims more than it measured.

AE5's eleven per-role increments re-key enforcement sites onto exactly the population the arm
cannot select. That is what made this a batch rather than a backlog item.

## Problem

1. **`authz.scope_reaches` and `authz.candidate_has_permission` are `prosecdef` BOOLEANS in no
   arm's domain.** They match neither `PRED_NAME_RE` nor `PRED_IDENTITY_RE` — measured on the live
   catalog 2026-09-05, `by_name = f` and `by_identity = f` for both, because their bodies reach
   identity only through `authz.*` helpers the identity regex does not name. `authz.has_permission`
   *is* in domain, by `^has_`. So the resolver family was swept **on one axis only** and the green
   from that axis read as if it covered the family. `candidate_has_permission` held **no verdict of
   any kind**.
2. **Three more are excluded by RETURN TYPE.** `authz.authorized_scope_ids`,
   `authz.candidate_authorized_scope_ids` and `app.current_professional_read_organizations` return
   `SETOF uuid`, so `t.typname='bool'` drops them before any regex runs. A regex cannot fix a
   type bound.
3. **A `FOR ALL` COVERED was mirror-ambiguous.** The read arm bounded itself `polcmd in ('r','*')`
   and opened `using (true)` **and** `with check (true)` together, so a COVERED on an ALL policy
   could be earned entirely by a **write** keystone — the mirror of the defect the write arm had
   already fixed for itself. Two arms, one bug, one of them corrected.
4. **A broad gate that makes a file ABORT threw away a real signal.** `app.event_current_custodian`
   opens → `140_patient_safety.sql` reds its test 11 and then aborts, the denominator moves, and
   §7.15 recorded ERROR. The suite plainly noticed; ERROR says *unclassifiable* and sits beside 28
   genuine harness bugs.
5. **Trigger enforcers can never enter this arm, and nothing said so.** Postgres invokes a trigger
   from the TABLE, so a trigger function has no call edge from the door that fires it and no
   boolean to flip. `public.reopen_interview` came back BLIND while `121_interviews.sql` pins its
   `HC038` — because the `HC038` observed belongs to `app.guard_interview_status`, a trigger. A
   trigger-caused BLIND and an absent-assertion BLIND need **different** remedies and the findings
   file cannot tell them apart.
   > ⚠ **CORRECTION — 2026-09-07 (QA `F-BLOCK-3`). The paragraph above is left unedited and its
   > MECHANISM is confirmed; its TENSE was wrong when this ADR was written.**
   > `public.reopen_interview` has been **COVERED since 2026-09-04** (`f33d9ba7`;
   > `docs/reviews/c2-command-door-findings.md`) — one day before this ADR's date — so it was not
   > "BLIND" at the time of writing and the `DOMAIN-STATEMENT` must not present it as a live
   > witness. What is true, re-measured 2026-09-07 against the C2 findings and the live catalog:
   > `app.guard_interview_status` IS a `prosecdef` trigger wired on `case_interviews`;
   > `121_interviews.sql:297` pinned only the CODE (`throws_ok(…, 'HC038', null, …)`), so under
   > mutation the trigger's `HC038` satisfied it against the WRONG enforcer; and
   > `121_interviews.sql:565` discharged it by pinning the door's OWN message on an
   > `awaiting_follow_up` fixture the trigger cannot pre-empt — which is exactly the remedy this
   > point predicts. ⛔ **No BLIND door on this stack is attributable to a trigger today** (C2 is
   > 170 COVERED / 1 BLIND / 0 ERROR and the one BLIND, `app.print_source_series`, has no trigger
   > in its path), so the population is now **stated as ASSERTED, witnessed only historically**,
   > and the emitter says so. `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN`'s closure
   > stands on the bound being STATED and per-run derived — QA's Q8 ruling — not on this witness.

## Decisions

### D1 — `PRED_DOMAIN` gains a THIRD admitting disjunct: `n.nspname = 'authz'`, bounded at `bool`

A `prosecdef` **boolean** in the `authz` schema is an authorization predicate **by virtue of its
schema**. No application role holds USAGE on `authz` (pgTAP 401 §18), so a `SECURITY DEFINER`
function there exists to answer an authorization question; there is nothing else it could be.

**Written LITERALLY, not as a fourth sub-variable** (PO ruling Q4). `scripts/door-sweep-cases.sh`
lifts `PRED_DOMAIN` verbatim and expands exactly three sub-variables, aborting on any surviving
`$`; a new variable would have required a deriver edit and put its 34/0 self-test at risk for no
gain.

⛔ **Bounding it at `bool` is load-bearing, and it is MEASURED rather than defensive.** Ten
`prosecdef` functions live in `authz`; only **4** are boolean. An unbounded `n.nspname='authz'`
would admit the other **6** — `assignment_facts`, `authorized_scope_ids`,
`candidate_authorized_scope_ids`, `entailed_grants`, `explain_permission`,
`rebuild_implication_closure` — which the direction classifier labels `positive`, whose
neutralization is `select true`, which does not type-check against `record` / `SETOF uuid` /
`permission_explanation` / `int4`. That is **6 guaranteed ERROR rows**: the widening-by-TYPE trap
the script's own header declined, re-entered through the schema door.

⭐ **This is why ADR 0173 §4's refusal does not reach this axis.** §4 declined to widen
`PRED_DOMAIN` because doing so would change the **neutralization model**, and its four subjects
return `int4`/`responses`. The `bool` bound leaves the neutralization model untouched: the two
newcomers are `language sql` booleans classified `positive`, neutralized to `select true` exactly
like the other 125. §4 is amended in its scope, not contradicted in its reasoning.

**Selection is the success criterion, and it was proven by SELECTION, not by a passing sweep**
(ADR 0173 §4's own words). Measured on a fresh reset, running the real script's own worklist
queries at HEAD and at the widened text:

| | before | after |
| --- | --- | --- |
| `PRED_TOTAL` | 125 | **127** |
| `PRED_OUT` (§7.17b census) | 37 | **35** |
| delta (in after, not before) | — | **exactly** `authz.candidate_has_permission`, `authz.scope_reaches` |
| reverse delta (in before, not after) | — | **0 rows** |
| newly OUTSIDE the census | — | **0 rows** |
| the legitimately-outside set | 35 | **35, unchanged** |
| policy worklist | — | **byte-identical** |

⚠ The `!~ '^is_valid_'` clause is **pre-existing** (ADR 0079 Amendment 9's "minus `^is_valid_`"),
not part of this widening, and is **measured inert**: zero `prosecdef` booleans match
`^is_valid_` on this catalog. It is kept because dropping it would edit a bound ADR 0079 recorded,
for no measured effect.

### D2 — The bound, stated as this arm's domain and accepted as such

> `prosecdef` boolean in app/public/authz by authz-shaped **name**, identity-touching **body**, or
> `authz` **schema** membership, minus the 2 side-effecting writers; the 35 outside are enumerated
> per run in §7.17b and in the `DOMAIN-STATEMENT`.

⚠ **Corrected 2026-09-07 (QA `F-REC-10`), beside the unedited quote above: this rendering is
NOT byte-verbatim.** The emitter closes the same sentence with *"…enumerated per run in §7.17b and
in **this statement**"* (`domain_statement ()` in `supabase/tests/mutation/p0-authz-door-audit.sh`,
the `$PRED_OUT outside are enumerated` line), because inside the block "the `DOMAIN-STATEMENT`" is
a self-reference. Semantically identical, byte-different — and quoting it under a "stated verbatim"
label is this unit's own LEARN-088 shape. The AUTHORITY is the emitted block, not this quote.

PO-accepted 2026-09-05 as the arm's stated domain. It is still an **approximation** of "is an
authorization predicate" — a gate reaching identity only indirectly through a helper the regex
does not name, in `app` or `public`, remains outside — and the census is what keeps that admission
attached to every report.

### D3 — The set-valued resolvers are swept by TARGETED cases with a committed, scheduled home

`supabase/tests/mutation/authz-setvalued-targeted-cases.sh`. Only a boolean predicate is sweepable
by the door arm's mechanism (ADR 0079 hazard 4), so this family cannot be fixed by any widening of
`PRED_DOMAIN`.

⛔ **The scope is an EXPLICIT RECORDED LIST of three, not a derived property, and the correction
matters.** The follow-up proposed "a scope-id set **consumed by a policy**" as the selecting
property. **Measured 2026-09-05, that property selects exactly ONE of the three**: only
`app.current_professional_read_organizations` is named by an RLS policy
(`professional_profiles_select`); the two `authz.*` resolvers are reached only **transitively**,
through it. A property that selects 1 of 3 while being described as selecting the family is
precisely the shape this program exists to catch, so the list is written down and its
**cardinality** is asserted instead (§4b): the live population of `prosecdef` `SETOF uuid`
functions must equal the **five** the file rules on — 3 in scope, plus `app.eligible_voters`
(recipient computation under ADR 0173 §4's "iterate → recipients; branch → authority" discharge,
and `authenticated`-EXECUTE-able so it owes the **census** its verdict) and
`app.person_authority_orgs` (an affiliation footprint; EXECUTE for no application role) named out
of scope **with their dispositions**. A sixth appearing reds there rather than passing silently.

**Neutralization = the UNIVERSAL SET**, signature / `SETOF uuid` / `STABLE` / `SECURITY DEFINER` /
`search_path` preserved. ⭐ That is strictly stronger than `select true` could be for this shape:
it does not merely grant, it grants **every** scope, so a caller that had begun ignoring its own
scope argument is still measured.

⛔ **It ships its own degeneracy arm, because the existing one cannot see this shape.**
`DEGENERATE_PREDICATE` matches `select true` / `begin return true; end` / `begin return; end`; a
universal-set body matches none, so a crash residue of this harness would not stop the sibling
sweeps. Two locks of **different kinds**:
- **§4a — residue by PROPERTY, baseline-free.** Every `prosecdef` `SETOF uuid` function whose
  comment-stripped body references no authorization term is residue. Enumerated to **0** on a
  clean tree, and **proven able to fire on every run**: while each mutation is live the check must
  NAME that function, or the harness aborts. The proof is the run itself, not a knob.
- **the MARKER form**, added to BOTH hand-kept `DEGENERATE_PREDICATE` copies, so this harness's
  residue stops the p0 sweeps the way theirs stop each other.

⚠ ADR 0182 records **no** suite shape and **no** verdict tokens for these three, so the verdicts
they hold are hand-run and un-anchored. The verdicts earned here are their **first recorded**
ones. ⚠ And a verdict is recorded **at a suite shape**: 0182's own increment had to RE-EARN a
verdict when pgTAP 413 grew five assertions.

### D4 — The read arm opens the `using` half ALONE

At the policy arm's open: `alter policy … using (true)`, with no `with check (true)`. Capture,
restore and the in-flight probe still cover **both** halves — the restore must return the policy
exactly as it was.

⚠ **Measured precondition, not assumed:** all **62** `FOR ALL` policies in domain carry a non-null
`polwithcheck`. That matters, because Postgres falls back to `qual` for the check when
`polwithcheck IS NULL` — on such a policy `using (true)` alone would open the write half anyway
and the fix would be **vacuous** for it. The harness now derives that set every run and
**discloses** any member; today it is empty.

⛔ **This is strictly weaker, so only COVERED → BLIND flips are possible**, bounded by the 51
COVERED `(ALL)` rows in the baseline. Those flips are **findings, not regressions**: each one is a
`FOR ALL` policy whose read half no keystone exercises, which was previously masked by a write
keystone. **They are disclosed, never relabelled** (PO ruling Q1) and carried as a named keystone
work-list in `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS`.

**D4a — the direction column stays `open->true` (deferred, deliberately).** Re-keying it to
`open using->true` would change columns 1–4 of all 62 ALL rows; the merge splices only when
columns 1–4 are identical, so every one of them would land in `CARRIED` as pure formatting noise
for a human to re-file. The half is recorded in **prose** — in `emit_body`'s domain paragraph, in
the `DOMAIN-STATEMENT`, and on the run banner. ⚠ The option is deferred, not rejected: the moment
a re-baseline is happening for another reason, re-keying costs nothing extra.

**D4b — row KEYS are unchanged, and that is not cosmetic.** `p0-authz-invariant.sh` labels these
`relname.polname (ALL)` and `verdicts_from_findings` keys on column 1. A key migration would leave
62 ALL policies **UNKNOWN** in `ARM=census` — an arm going green because it stopped recognising
its own subjects.

### D5 — A FOURTH classifier outcome: `NOTICED`

Shape moved **AND** `Result: FAIL` → `NOTICED`. Every **other** shape move stays `ERROR`.

The follow-up's option (a) — a bespoke neutralization per aborting case — is the wrong instrument
for this class: the abort is `140`'s own value assertion whose subject now raises (LEARN-083), not
a defect in the neutralization, so there is nothing bespoke to write. And the class grows as the
arm's domain grows: a broader gate is exactly the kind whose opening makes some file abort.

⛔ **`NOTICED` never collapses into COVERED and is never a pass.** It has its own count on the
report line and its own place in the tables; it is in the DIRTY test, so it exits 1 exactly like a
BLIND; and it claims strictly **less** than COVERED, because with the denominator moved the
failing assertions may belong to a different gate entirely. `COVERED` is computed as the residual,
so `NOTICED` is subtracted there too — a fourth outcome must not inflate COVERED by arithmetic
after being kept out of it by logic.

Proven on four constructed strings with **the control named**: (shape-moved, PASS) → ERROR is what
distinguishes this from renaming ERROR. The instrument was itself proven able to fail, and the
pre-change classifier was run over the identical strings.

⚠ **Corrected 2026-09-07 (QA `F-REC-12`), beside the sentence above, which is left unedited:
SIX constructed strings ship, not four.** The two the sentence omits are the `Dubious` path and
the missing-`Result:` path — and those two are the ones that make the classifier's OTHER code
paths evidence rather than the happy path twice. The count is not a claim to take on trust: the
offline arm reports it every run as `classify 6/6` (the door harness's `SELFTEST` total line,
`TOTAL: 23/23 ok, 0 failed`, quoted in the lead's gate entry). Understated, never false.

#### D5 Amendment 1 — 2026-09-07, PO ruling: `NOTICED` is DISCLOSED, NON-BLOCKING, WORK-LISTED

⛔ **This amendment supersedes exactly one sentence of D5**, and it is quoted here rather than
rewritten in place: *"it is in the DIRTY test, so it exits 1 exactly like a BLIND"*. Everything
else D5 says stands — `NOTICED` still never collapses into COVERED, is still never a pass, is
still subtracted from the COVERED residual, and still claims strictly **less** than COVERED.

The PO ruled on the 23 `NOTICED` rows of run 2 (2026-09-07): **`NOTICED` is coverage EVIDENCE, not
a verdict.** It is its own class; it must be **quoted in every gate record** that cites this sweep,
beside the BLIND count; and it **does not block the phase**. BLIND still blocks; ERROR is still not
a pass.

The ruling changes an **exit code**, so it is encoded where the RESULT line is computed and not
only in the prose that describes it. `p0-authz-door-audit.sh`'s trailing `if/elif` chain was
extracted into **`emit_result()`** for exactly that reason: inline, the only way to exercise it was
a 15-hour sweep, which is how the `NOTICED` class came to ship with its classifier tested and its
exit semantics untested.

| tally | before | after |
| --- | --- | --- |
| any BLIND, or any ERROR | 1 — `DIRTY` | **unchanged**, 1 — `DIRTY`, with the classes printed separately |
| 0 BLIND · 0 ERROR · >0 NOTICED | 1 — `DIRTY` | **0 — `CLEAN WITH DISCLOSURE`**, the NOTICED count and its remedy printed |
| merge abort · `swept=0` · UNMATCHED | 2 · 3 · 3 | unchanged (and UNMATCHED still outranks a bare NOTICED) |

The RESULT line now separates the three claims — `N BLIND (blocks) · M NOTICED (disclosed,
non-blocking — evidence, not a verdict) · K ERROR (not a pass)` — because `36 BLIND, 23 NOTICED,
0 ERROR` invited a reader to sum them into "59 problems", which is three different questions
answered as one.

⛔ **A non-blocking class must not become an invisible one**, which is the failure mode this
amendment is closest to. Two safeguards: the rc-0 branch **prints** the disclosure (an rc 0 that
printed nothing would be a silent pass — worse than the DIRTY it replaces), and the remedy is
**work-listed**, not merely named: capture-then-assert under
`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`, whose body now carries run 2's 23
aborting-file signatures, plus a keystone entry for the four rows with no authz-shaped file
reddening outside the aborting file.

⚠ **Corrected 2026-09-07 (QA `F-REC-13`), beside the unedited sentence above, on both of its
counts.** (1) The body carries **15 DISTINCT aborting-file signatures over 23 rows**, not 23
signatures — a work-list sized by the number of files to repair, not by the number of gates that
lost a verdict, and the two numbers are the two ends of a many-to-one join. (2) The "keystone
entry for the four rows" is **not** in that body: the four live in their own register entry,
`FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING`, filed separately because
`FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` fences NOTICED rows out of its own work-list. A reader sent
to one body for both would find only 19 of the 23 accounted there.

SELFTEST gains an 8-case arm over `emit_result()`. ⛔ Its control is the **pair** `(0 BLIND,
0 ERROR, 1 NOTICED) → rc 0` against `(1 BLIND, 0 ERROR, 1 NOTICED) → rc 1`: same NOTICED count,
opposite code. Without both halves a green row would prove only that the function returns a number,
not that NOTICED stopped blocking **while BLIND kept blocking**, which is the whole ruling. Proven
able to fail: a mutant restoring `|| [ "$noticed" -gt 0 ]` in the DIRTY test reds exactly the two
rows that encode the ruling and no others (bare rc 1).

### D6 — Every run prints a `DOMAIN-STATEMENT`, and it names FOUR uncovered populations

⚠ **FIVE since 2026-09-07** — population 5 below was added by D5 Amendment 1 and the heading is
left as written so the amendment is visible rather than smoothed away.

Quotable exactly like the deriver's `SCOPE:` line, printed on stdout and emitted into the findings
header. It states, **derived from the live catalog each run, never literal**:

> ⚠ **CORRECTION — 2026-09-07 (QA `F-MAJOR-7`); the sentence above is left as written and is
> FALSE as a claim about the whole block.** MEASURED: only population 4's two counts
> (`TRIG_SECDEF` / `TRIG_WIRED`), `PRED_OUT` and `SETVALUED_N` are catalog-derived. **190, 60, 6,
> ~10 and 39 are hard-coded `echo` literals**, and rightly so — they are DECISION figures from ADR
> 0171 / ADR 0184 pt 4, and nothing in this tree derives them (measured: no committed query
> anywhere computes the `HCDS*` / `28000` / C2-ERROR counts). The defect was the LABEL, not the
> literals. ⛔ Fixed in the emitter the same day: provenance is now stated **per figure** —
> `DERIVED THIS RUN` or `[literal — <source>, as of <date>]` — and the block header no longer
> makes a blanket claim. ⚠ Note the shape: a number a banner states about a population nothing
> re-derives is a claim with no owner, which is the exact warning `p0-authz-invariant.sh`'s ARM 3
> banner carries about itself.

1. **Tier 2 — 190 doors, deferred by ADR 0171, not cleared** (ADR 0187 D1's required wording).
   ⚠ **CORRECTED 2026-09-07 (QA `F-MAJOR-1`)**: that rendering is a REORDERING, not D1's wording.
   The required sentence, verbatim, is **"Tier 2's 190 doors stay deferred by ADR 0171 and are NOT
   cleared"**; the emitter now prints it byte-exact and the door harness `SELFTEST` asserts it
   against ADR 0187 itself (extracted, never re-typed), with an instrument-alive row and a
   one-token-perturbation control.
2. The `HCDS*` family (60 raises) and `28000` (6) — structurally absent from the C2 worklist.
3. The C2 ERROR class — ~10 enforcers expected, no verdict.
4. ⭐ **Trigger enforcers** — `prosecdef` trigger functions behind wired triggers (**174 / 268**
   today, re-derived every run). A trigger has no call edge from the door that fires it, so a
   trigger-caused BLIND is **indistinguishable here** from an absent-assertion BLIND: the first is
   discharged only by a keystone on a fixture the **trigger** does not already refuse, the second
   by a keystone on the door. A defence-in-depth pair can therefore look like a gap.

5. ⭐ **The `NOTICED` class — disclosed, non-blocking, and NOT a verdict** (added 2026-09-07 by D5
   Amendment 1). A gate whose neutralization reddened the suite while a file ABORTED carries
   `NOTICED`, never `COVERED`: the denominator moved, so the failing assertions cannot be
   attributed to THIS gate. It is an **UNRESOLVED** gate, not a covered one. The population must
   be quoted beside the BLIND count, and its remedy is capture-then-assert.

Plus this arm's own bounds: `PRED_OUT`, the 2 side-effecting writers, the value-returning
raise-guards, the set-valued family with a pointer to its home, and the `using`-half statement.

⛔ **Not an allowlist entry**, which the follow-up explicitly rules out: `reopen_interview` is not
never-called and its verdict is not wrong. What was missing is the **domain beside the verdict**.

### D7 — The findings baseline is re-earned through the merge, and every CARRIED row is a human decision

The full run is the **first real exercise** of ADR 0190's merge on the committed door baseline.
Provenance is fixed by measurement, not by trust: the committed file's `cksum`/`md5` are
snapshotted before the run; the merge is verified three ways after it (bare rc; a `MERGE_VERIFY`
pass over the merged file; enumeration of all 9 `HAND-MERGED` blocks and the `CARRIED` block row by
row); and `git status --short` must show only that file changed.

⛔ **No `CARRIED` row is re-attached silently.** They are enumerated for the PO — key, current
verdict, note, which arm's file the row belongs to, and a recommended disposition (re-attach /
retire-to-another-arm / delete deliberately) — and the re-baselined file is committed only after
that ruling.

#### D7 Amendment 1 — 2026-09-07: the run-2 provenance, the ruling, and what the disposition cost

**The baseline that is committed is run 2's, and run 1 is void** (D8). Provenance, measured:

```
353 cases · 14 h 53 m 42 s · bare rc 1 · resets=40 (RESET_EVERY=20)
   = 17 scheduled ((DONE-1) % 20 == 0 over 353) + 23 retries; `grep -c 'drift suspected'` = 23
ARM-DOMAIN predicate=127/127 policy=226/226 out-of-domain-bool=35   (policy arm: `using` half ONLY)
SWEPT 353 · COVERED 294 · BLIND 36 · NOTICED 23 · ERROR 0
   all 23 NOTICED were RETRIED after a reset and all 23 REPRODUCED — 23 rows carry
   `(retried after reset)` in both the generated and the merged file, so none recovered
POST_MD5 d2ca2de362b97a0f7b486d34c1e0411a · 2043 lines · merge verified three ways
```

⭐ **ERROR fell 5 → 0 and the 84 rows that moved between runs moved in ONE direction only** — out
of the unclassifiable classes (NOTICED→COVERED 61, NOTICED→BLIND 18, ERROR→COVERED 5; zero run-1
COVERED and zero run-1 BLIND rows moved at all). Run 2 is the same measurement with 84 previously
unreadable cells filled in, which is the strongest available evidence that the retrofit resolved
drift rather than perturbing the arm.

**The PO carried the disposition table as recommended (2026-09-07).** 275 CARRIED rows, applied
**by script** off that table — joined 1:1 on key + baseline verdict + run-2 verdict + a hand flag
**recomputed from column 5** rather than read from the table, so the join key is not a restatement
of the thing it keys on (it agreed at 31/31):

| | n |
| --- | --- |
| deleted or retired to another arm | **242** |
| hand notes re-attached to their run-2 row, byte-for-byte | **15** (13 carried + 2 HOLD-resolved) |
| hand notes archived verbatim into `docs/progress/pred-domain.md` | **15** (10 + 4 HOLD-resolved + 1 retired to C2) |
| re-filed as ROWS so `ARM=census` reads a verdict, not a bookkeeping hole | **3** |
| hand-prose rows in → preserved | **31 → 31**, zero lost |

⛔ **The re-filed three are shaped against the merge's classifier, not to taste.** A row is
classified as a verdict row if it sits under a header the generator emits, **or** carries a
generator verdict token in column 4, **or** carries a key the generator emitted — and a verdict row
absent from the next run is relocated into the `CARRIED` block, where the leading-pipe test
`ARM=census` uses no longer matches it. Re-filing them under the generator's own header with a bare
`COVERED` would have re-created the hole one full run later. They therefore use a header the
generator never emits and `COVERED (targeted mutation)` in column 4, so the merge keeps them as
prose, in place — while the header still contains the literal `gate / policy` that the census's own
`grep -vE 'gate . policy'` uses to drop a header.

⚠ **Corrected 2026-09-07 (QA re-review `N1`), beside the unedited sentence above: "keeps them as
prose, in place" is true of the ROWS and FALSE of the HEADER.** MEASURED by QA on copies, with the
shipped `scripts/lib/merge-findings-baseline.sh` and a generator-only `GENERATED`: the merge exits
**0**, all **six** hand-filed rows survive in place and un-indented, and `verdicts_from_findings`
reads all six — so the load-bearing property holds and **no verdict is at risk**. But **both hand
table HEADER lines are relocated into the `CARRIED` block and indented**, leaving each section with
a bare `|---|---|---|---|---|` delimiter and no header. The merge helper's documented exception 2
covers hand *rows*, not hand *headers*. Cosmetic for the census, wrong for a reader — and it is a
claim about a measurement, which is this unit's own subject. ⚠ QA's `GENERATED` was a synthesis
(the committed file truncated at its first `## Note`), so this stays on the could-not-verify list
until a real full run confirms it. Filed, not fixed:
`FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST`.

⛔ **The `CARRIED` block, comment included, was removed** — not left empty. The merge appends the
whole block only when it carries something, and it aborts when a baseline prose line does not
survive; an empty comment block would therefore be duplicated by the next run that carries
something and would abort the next run that carries nothing. Removal is the only state stable in
both directions.

### D8 — The door arm bounds its own TAIL DRIFT: ADR 0189 D6's design is ported here, and the first full run is VOID from case 275

⛔ **The first full run measured the harness, not only the doors.** 353 cases, 12 h 17 m, bare
exit 1, `SWEPT 353 · COVERED 228 · BLIND 18 · NOTICED 102 · ERROR 5`. The suite held the captured
baseline shape `Files=262, Tests=8876` for **274** cases; from case **275**
(`interview_sessions.interview_sessions_write`) to case 353 it read `Files=262, Tests=8470` with
the **identical** nine aborting referral files on every one of the 79 remaining cases — 78
`NOTICED` and 1 `ERROR`, a perfect tail. A per-case abort varies per case and recovers; this did
neither.

> ⚠ **CORRECTION — 2026-09-07 (QA `F-MAJOR-8`). The paragraph above is left unedited; three of
> its figures are contradicted by `docs/progress/pred-domain.md`, which is the authority for run
> 1, and this ADR contradicts one of them itself twenty lines below.** Re-read against the record:
>
> | this ADR says | the record measures |
> | --- | --- |
> | "held the captured baseline shape `Files=262, Tests=8876` for **274** cases" | **104 of 353** run-1 rows carried an OFF-baseline shape, and row **274 itself** was at `Tests=8723`. The uniform TAIL begins at 275; "held the shape for 274 cases" is a different and false claim, and this ADR's own "Drift reached at least as far back as case 274" says so |
> | "the **identical** nine aborting referral files on every one of the **79**" | **78** rows carried `Tests=8470`; the 79th (`process_template_versions_select`) was run 1's ERROR at `Files=0 Tests=0`, so the nine-file signature is identical on 78, not 79 |
> | "of the **23** `NOTICED` rows outside the tail … the other **22** are unclassified" | **24** outside the tail: 1 genuine + **1 proven drift (row 274)** + 22 unclassified. ⚠ **23** is run **2**'s NOTICED count, which appears three lines earlier in this same ADR — the two runs' figures were transposed |
>
> ⛔ **None of this moves a verdict** — run 1 is VOID and every live figure comes from run 2 — but
> this ADR is the durable artefact a later session reads, and the record it contradicts is the one
> it cites. The corrected reading of run 1 is: drift is **cumulative and reaches back past 274**,
> the uniform nine-file tail covers **78** rows plus one ERROR, and **1 of the 24** pre-tail
> NOTICED rows is established genuine.

**Proven, not inferred**, by two subset runs each on its own fresh `supabase db reset --local`,
both bare rc **0**:

- Two tail cases run **alone** (`interview_summaries.interview_summaries_select`,
  `responses.responses_select`) came back **COVERED** at `Files=262, Tests=8876`. The door was
  never the variable; RUN POSITION was.
- The drift-onset neighbourhood re-run in **worklist order** — cases 274, 275, 276
  (`interview_sessions_select`, `interview_sessions_write`, `interview_summaries_select`) — came
  back **3/3 COVERED with the shape never moving at all**.

⛔ **So there is NO originating case, and looking for one was the wrong question.** Case 274 was
itself already drifted (run 1 scored it `NOTICED` at `Tests=8723`; in isolation it is `COVERED`),
and three consecutive cases from that region do not reproduce the abort on a clean DB. The damage
is **cumulative** — a function of how many `supabase test db` runs have preceded, not of any gate.
That is precisely the failure `RESET_EVERY` bounds and that no per-case fix could reach.

⚠ **A consequence for reading run 1**: "not in the uniform tail" is NOT evidence that a `NOTICED`
was earned. Drift reached at least as far back as case 274, so of the 23 `NOTICED` rows outside the
tail exactly **one** is established genuine (`app.event_current_custodian`, reproduced on a fresh
reset in isolation, 2026-09-05) and the other 22 are **unclassified**.

And the damage is **data the suite left behind, not a gate left open** — §7.5 byte-compares every
restore and `exit 2`s on a mismatch, the run exited **1**, and the post-run catalog enumerated
**0** degenerate function bodies and **0** degenerate non-`SELECT` policies.

⛔ **This is the same defect `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` closed on
2026-09-04 — closed at ONE of its two sites.** ADR 0189 D6 built `RESET_EVERY`, the in-flight
interlock, reset-and-retry-once, worklist re-derivation and baseline re-capture into
`c2-command-door-neutralizer.sh` alone. The bug is a property of the *shape* — one database, one
baseline captured at the top, one suite run per case, hundreds of cases — and
`p0-authz-door-audit.sh` has exactly that shape. Nothing recorded it as still exposed, because *a
fix correct at most of its sites reads as a complete one.*

**Decision.** The design is ported verbatim in mechanism, adapted in two places:

1. **Keyed on the classifier's own predicate, not on note text.** C2's retry net matches
   `SHAPE changed` / `did not come back green` in the note string. This arm's drift-shaped
   outcomes are `NOTICED` **and** `ERROR` (D5), so `classify()`'s `shape_moved` is promoted to a
   global `SHAPE_MOVED` and the retry net reads it. One predicate, three readers — a note-matching
   copy is how a banner comes to describe a rule the code no longer implements.
2. **The OID is re-resolved from the function's IDENTITY at case time.** ⛔ A
   `supabase db reset --local` drops and recreates the database, so **every `pg_proc.oid` is
   reassigned**, while the predicate worklist's OID column was captured before the first case. A
   periodic reset that kept using the captured OID would mutate whatever now holds it. C2 does
   exactly that (`c2-command-door-neutralizer.sh:797`, `:889`, `:922`) and has not misfired — a
   deterministic replay of the same migrations tends to reproduce the same OIDs, which is what
   makes it dangerous: masked by an incidental property, not closed by a guard. Here the OID is
   looked up from `nspname.proname(identity_args)` per case and a case whose identity resolves to
   nothing scores `ERROR` rather than mutating. **C2 is not changed by this unit** — reported for
   its own entry.

Everything else is as ADR 0189 D6 ruled it and is not re-litigated: `RESET_EVERY` default **20**;
**set-ness, not value**, captured before the `:-20` default; a **non-subset** run resets every N, a
**subset** run only when `RESET_EVERY` is set explicitly, `0` disables everywhere; the in-flight
interlock is **first**, ahead of the subset gate, and exits 2 with the sentinel intact;
`cd "$ROOT"` before the reset; the §7.16 preflight, the worklist re-derivation (to a `.reset`
suffix — ⛔ never the file the sweep loop is reading) and the baseline re-capture all re-run, each
aborting 2 rather than measuring on an unknown DB; the retry suffixes `(retried after reset)`, and
where the run may not reset the row says so rather than asserting a reset that did not happen.

**Consequence for the run.** The 79 tail verdicts are **VOID, not verdicts**; run 1's merged output
was **not committed** (working tree reverted to md5 `2ef469ca…`) and is kept out of tree as a
measurement of the drift. One more full run is owed, and it is the one the re-baseline is earned
from. ⚠ **A count of flipped rows taken from run 1 is an UNDER-count**: 16 `(ALL)` policies that
were `COVERED` in the baseline sit unmeasured in the void tail, so D4's read-half work-list is
bounded below by 5 and above by 21 until run 2 measures them.

> ⭐ **SETTLED — 2026-09-06 by run 2, recorded here 2026-09-07 (QA `F-MAJOR-8`); the bound above
> is left as written because it was correct when written.** Run 2 measured them: the read-half
> work-list is **11**, not "5 to 21" — exactly 11 `(ALL)` `COVERED → BLIND` flips (5 `capa_*_write`
> + 6 `rca_*_write`) and **zero** non-`(ALL)` flips. Enumerated with each policy's `using` qual in
> `docs/followups/FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS.md` and in `docs/progress/pred-domain.md`.
> ⚠ This ADR carried two 2026-09-07 amendments and left this bound open; an amendment recorded
> only in the new document is the shape D3's own reasoning is about, here inside ONE document.

## Considered options (and why they lost)

- **Widen `PRED_DOMAIN` by RETURN TYPE.** Rejected — it changes the neutralization model and
  manufactures 6 guaranteed ERROR rows in `authz` alone (ADR 0173 §4 was right about this).
- **Rename the resolvers to `has_*` / `is_*`.** Rejected — ADR 0079 Amendment 9 already recorded
  that the rename workaround makes coverage depend on a naming convention no gate enforces.
- **Select the set-valued family by "consumed by a policy".** Rejected by measurement: it selects
  1 of 3.
- **Allowlist the trigger enforcers.** Rejected by the follow-up's own close condition.
- **Fold the abort case into COVERED.** Rejected — the failing assertions may belong to another
  gate; the whole point of §7.15 is that an assertion which never ran is not evidence.
- **Re-key the direction column now.** Deferred (D4a) — 62 rows of formatting noise for a human.

## Consequences

- The arm's domain is **127 + 226**; two resolvers AE5 re-keys onto are inside it, and
  `candidate_has_permission` holds a verdict for the first time.
- The findings baseline moves, and `ARM=census` gains two accounted gates — so the two backlog
  entries for the same resolvers are **removed** in the same change, or the census double-accounts
  them through `allow_body "$UNSWEPT"`.
- ~~A run can now end DIRTY for a **third** reason (`NOTICED`), and a gate record must quote four
  counts, not three.~~ ⚠ **Corrected 2026-09-07 by D5 Amendment 1**: `NOTICED` does **not** end a
  run DIRTY. A gate record still quotes four counts, and `NOTICED` is still never a pass and never
  COVERED — but with 0 BLIND and 0 ERROR the run exits **0**, printing `CLEAN WITH DISCLOSURE`.
  BLIND blocks; `NOTICED` discloses.
- The `DOMAIN-STATEMENT` names **five** uncovered populations, not four.
- **A gate record citing this arm must quote the `DOMAIN-STATEMENT`**, not merely say "the arms
  hold".
- The set-valued home needs a **scheduling line** in the lead playbook, or it becomes the thing it
  was built to replace: cases that run when someone remembers.
  ✅ **DISCHARGED 2026-09-07 (QA `F-REC-14`), recorded beside the consequence rather than deleting
  it:** the lead landed the §4 line at `376d5717`, and `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE`
  is closed on it at the Record step. ⚠ The landed sentence is the drafted one **plus**
  `; ADR 0079 hazard 4` — a strengthening, not a byte-verbatim paste; see that follow-up's archive
  entry.
- ⚠ **Residual, filed not fixed**: `DEGENERATE_PREDICATE` remains **two hand-kept copies**; no arm
  reds on a stale `authz-unswept-backlog.txt` entry that has since earned a verdict; the deriver's
  exit code conflates "derived some" with "derived all owed".
