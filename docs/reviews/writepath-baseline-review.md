# QA Review — unit WRITEPATH-BASELINE (pre-AE5 remediation, Batch 3)

**Reviewer:** `qa` · **Date:** 2026-09-08 · **Branch:** `authz-writepath-baseline` @ `6d0db87a`
(tree clean, 11 commits ahead of local `main`, push distance 1)
**Subject:** `docs/features/writepath-baseline.md` § Acceptance criteria · ADR 0192 ·
`supabase/tests/mutation/p0-authz-writepath-audit.sh` · `docs/reviews/authz-writepath-audit-findings.md` ·
the three closures in `docs/followups/follow-ups-archive.md` § *Batch 3 closures* ·
the follow-ups filed/widened in `docs/followups/follow-ups-open.md`

**Verdict: CHANGES REQUESTED**

---

## Summary

The measurement work is sound and in places exemplary. The run itself
(120/120 · 102 COVERED · 15 BLIND · 3 ERROR · `resets=8` · bare rc 1) is valid, its health
observables are the right ones, and I independently confirmed the load-bearing artifacts: the nine
Part-3 policies are each present and **COVERED**; the three `storage.objects` INSERT policies are
present, **COVERED**, and each carries `[role=postgres via supautils.policy_grants
(owner=supabase_storage_admin)]`; the harness's fixes (`CASES_EXPLICIT`/`set_placement`,
`RESET_EVERY` + `LAST_BASELINE_SWEPT`, the derived DRYRUN banner, the six-step recovery block) are
all present at HEAD; **no production file changed** (`git diff --name-only main...HEAD --
supabase/migrations supabase/seed.sql src` is empty); **`authz-blind-allowlist.txt` is byte-identical
to `main`**, so nothing was allowlisted; ADR 0192 declares `**Amends:**` correctly and its
back-pointers and index entry are generated, with no duplicate number and no `docs/adr/`.

The failures are all in one family — **a sentence about a measurement, standing beside a correct
measurement, that no gate can contradict**. Five are in artifacts this unit produced, and one of
those is in the committed baseline itself and is *read by a gate*.

**Blocking:** B1–B4. **Non-blocking, fix at the Record step:** N1–N5.

---

## BLOCKING

### B1 — A COVERED row is filed inside the `## BLIND` table, and the invariant arm reads the SECTION, not the verdict column

*Requirement violated:* hub § Acceptance criteria, *"The findings baseline re-earned through the
merge"*; ADR 0079 (a findings file is what a `FROMFINDINGS` arm measures).

`docs/reviews/authz-writepath-audit-findings.md:75`, inside `## BLIND — the work-list (no keystone
exercises these)` (heading at `:56`):

```
| responses.responses_delete_own_draft (DELETE) | policy | open using->true | COVERED | 387_initplan_wrap_and_profiles_arm_identity.sql [role=postgres via ownership (owner=postgres)] |
```

Verdict census by section, measured: `## BLIND` holds **15 BLIND + 1 COVERED**; the COVERED/ERROR
section holds **101 COVERED + 3 ERROR**. 101 + 1 = 102 ✓, so the row is misplaced, not duplicated.

This is not cosmetic, because the consumer keys on the heading:

`supabase/tests/mutation/p0-authz-invariant.sh:133-136`

```
blind_from_findings () {
  awk '/^## BLIND/{f=1;next} /^## /{f=0} f && /^\| / && $0 !~ /gate . policy/ && $0 !~ /^\|---/ {print}' "$1" \
    | sed -E 's/^\| *//; s/ *\|.*$//' | grep -vE '^$'
}
```

It never reads column 4. Replicating it verbatim against the committed file returns **16** labels,
not 15 — the sixteenth is this COVERED policy. Consequences:

1. `FROMFINDINGS=1 ARM=policy` will count `responses.responses_delete_own_draft` as **BLIND** for as
   long as the row stays there, contradicting the run that measured it COVERED.
2. ARM 1's stale-allowlist hygiene note (`:361`, `comm -13 blinds allowlist`) can **never** prune
   that policy's allowlist entry, because the entry is permanently inside the `blinds` set. The one
   mechanism that would surface the staleness is disabled by it.
3. The unit's own record calls this row the run's single improvement — *"`BLIND -> COVERED` 1
   (`responses.responses_delete_own_draft` — a real improvement)"*
   (`docs/progress/writepath-baseline.md:651`). The record says COVERED; the file's section says
   BLIND; the gate believes the section.

It was introduced by this branch: on `main` the row was genuinely BLIND and correctly placed
(`## BLIND` = 3 rows, all verdict BLIND, 0 off the allowlist).

⚠ Note why R30 condition 4's byte comparison did not catch it. That control asserted the 120 rows'
*identities, arms, directions and verdicts were **unchanged** across the disposition edit*
(`docs/progress/writepath-baseline.md:761-767`). Invariance across an edit is not correctness of
placement — the control was anchored on the wrong property, and it was green precisely because the
row was already misplaced before the edit.

**Fix:** move the row into the COVERED table, or make the merge/`emit_report` place a row by its
verdict rather than by its prior section, and state which. Then re-derive the 15-BLIND figure from
the file using the harness's own extractor and confirm it returns 15.

### B2 — The write arm's committed BLIND set gains **5 policies that are not on `authz-blind-allowlist.txt`**, and no document in the unit says so

*Requirement violated:* CLAUDE.md §6 step 1 (**BLIND blocks the phase**); ADR 0079 (an arm states its
own domain and its own holes); the unit's own disclosure convention.

`p0-authz-invariant.sh:8-12` states the contract: *"the sweep's BLIND set MUST be a SUBSET of this
file. A BLIND that is NOT listed here fails the gate (non-zero exit)"*, and ARM 1 in
`FROMFINDINGS=1` mode composes that set from **`WP_FINDINGS`** — this unit's file — at `:323-326`.

Set difference, computed with the harness's own `blind_from_findings` and `allow_body` replicated in
shell:

| | writepath BLIND labels | of which NOT on `authz-blind-allowlist.txt` |
|---|---|---|
| `main` (pre-run baseline) | 3 | **0** |
| `6d0db87a` (this branch) | 16 (15 + B1's misfiled row) | **5** |

The five, named individually (never as a count):

1. `cases.cases_staff_admin_write (ALL)`
2. `commission_member_titles.member_titles_staff_admin_write (ALL)`
3. `commissions.commissions_admin_write (ALL)`
4. `phase_results.phase_results_staff_admin_write (ALL)`
5. `process_template_versions.process_template_versions_staff_admin_write (ALL)`

The other 10 of the 15 are **already** entries in that allowlist (`:19, :21, :34, :35, :38, :40, :42,
:43, :56, :57`) — already-tracked backlog items, not newcomers.

⛔ **Nothing here asks for an allowlist entry — the standing rule is right and was obeyed.** The
finding is *disclosure*. Five places state, in these words, that `FROMFINDINGS=1 ARM=policy` is
*"RED **pre-existing** … its twelve are never allowlisted"* — the record at `:241, :566, :699, :826,
:838`, ADR 0192 at `:206`, and R36's tip gate. After this merge that characterisation is incomplete:
the arm's offender set contains five entries this unit's committed baseline put there, and they are
not among "the twelve". Because the arm is already red, **no gate can register the change** — which
is exactly why it has to be written down. Whoever eventually repairs that red will find five
offenders with no provenance.

**Fix:** state the delta explicitly — in the hub § Current state, in the record, and in
`FUP-WRITEPATH-BASELINE-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES` — as *"5 of the 15 are new ARM-1
invariant offenders (named); 10 were already on the standing allowlist backlog; zero entries were
added."* Better still, quote a `FROMFINDINGS=1 ARM=policy` offender count before and after, so the
figure is measured rather than derived.

### B3 — `FUP-…-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES` mis-states the direction census, contradicts its own cluster list, and over-claims one finding

*Requirement violated:* R18 / R29.3 (record the verdict, name the **property**, note the
discrimination). This entry is the only carried-forward home for 15 real write-path assertion gaps.

`docs/followups/follow-ups-open.md:1032`:

> ⚠ **Read the DIRECTION, not just the verdict.** **Twelve** are `ALL` policies opened
> `with-check->true` … **Three** are single-command policies opened `open->true`.

Measured from the committed file:

| claimed | measured |
|---|---|
| 12 `ALL`, `open with-check->true` | **13** |
| 3 single-command, `open->true` | **2**, and their direction is `open using+check->true` — a token that does not appear in the entry at all |

12 + 3 = 15, so the arithmetic sums while the partition is wrong — and this is the *interpretive*
paragraph, the one that tells a reader how much of a policy each BLIND covers. The error inverts its
own conclusion for the two rows that matter most: `notification_preferences_update_own` and
`notifications_update_own` were opened `using+check->true`, i.e. **both halves**, so their BLIND is a
claim about the whole policy, *not* "the `with check` half only". The entry then contradicts itself
two paragraphs later, where the cluster list correctly says **self-scoped UPDATE (2)** — as does the
record (`docs/progress/writepath-baseline.md:686-690`, which makes no 12/3 claim). The defect is
confined to the register entry.

Second, the same entry's sharpest sentence:

> ⚠ These two are the sharpest: a self-scoped UPDATE opened to `true` and unnoticed means **nothing
> asserts that one user cannot update another user's rows**.

`supabase/tests/mutation/authz-blind-allowlist.txt:33-36` records the opposite for one of them:

> `notification_preferences.notification_preferences_update_own (UPDATE)` — fully backstopped by
> `select_own`: a reassign to another user is blocked by the SELECT policy (the new row must stay
> visible), not by this policy's WITH CHECK.

The BLIND is real (no keystone exercises it), but "nothing asserts…" is an unqualified absence the
repo's own record contradicts — *an incidental guard closes a hole the definition predicts*. A
reader who takes the sentence at face value mis-prioritises the remediation.

**Fix:** correct the direction census to 13/2 with the real direction tokens; keep the cluster list;
add a line reconciling the 15 against the standing allowlist (10 tracked, 5 new — see B2); and
qualify the self-scoped claim against the recorded `select_own` backstop rather than asserting around
it.

### B4 — The re-earned baseline still opens by telling the reader not to read it as the audit's result

*Requirement violated:* hub § Acceptance criteria, *"the findings baseline re-earned"*; ADR 0186
(dated correction beside the original — applied one line above, omitted here).

`docs/reviews/authz-writepath-audit-findings.md:37-54`, uncorrected:

> ⛔ **Do not read this file as the write-path audit's result.** Its rows were produced when ARM 2's
> domain was a **33-row embedded snapshot** …
> … The gap closes only when a **full** sweep runs against the widened domain (~50 min, 120 cases)
> and its rows are **merged** into this file …
> All **33** snapshot rows were verified byte-identical to the live catalog on 2026-09-02 …

All three claims are now false of the artifact: 120 of its rows come from the full live-catalog
sweep, the gap is closed, and the 33-row population no longer describes the file (36 carried rows
were deleted). It is stated in the future tense for something achieved, in bold, with a ⛔, at the top
of the unit's central deliverable — the file AE5 will re-key against eleven times.

The turn *did* apply the right treatment one line earlier: `:35` (`## Note — 2026-09-03: THIS FILE
COVERS 39 OF 107 …`) received a dated `⛔ SUPERSEDED 2026-09-08` at `:36`, and the record documents
that as *"One action BEYOND R30's three"* (`docs/progress/writepath-baseline.md:801-809`). The
adjacent block, which makes the same stale claims more forcefully, got nothing, and the record does
not mention it anywhere. The `:36` correction cannot be read as covering it: its own wording is *"The
note above is kept…"* (singular), and the stale block sits **below** it — so a reader meets the
correction and then immediately meets a fresh, bolder contradiction of it.

**Fix:** add one dated `⛔ SUPERSEDED 2026-09-08` line beneath `:54`, in the same form as `:36`,
naming the post-run state. ⛔ Do not rewrite the block — same convention, one added line.

---

## NON-BLOCKING (fix at the Record step)

**N1 — `401 → 251` is wrong; the file is 256 lines.**
`docs/features/writepath-baseline.md:107` (*"the file went 401 → 251 lines"*),
`docs/progress/writepath-baseline.md:705` (*"401 → 251 lines, LF throughout"*) and `:790` (*"dead
against the 251-line file this turn produced"*). Measured across every commit on the branch:
137 → **401** (`e4062712`) → **256** (`3c763ffe`), unchanged since. The gap is exactly the five lines
the same turn added and then did not re-measure — the 4-line HTML comment at `:217-220` and the
1-line `SUPERSEDED` at `:36`. 251 + 5 = 256. This is the unit's headline "what changed on disk"
figure, in its summary, and it is the fourth instance in this batch of a printed count contradicting
its own sentence.

**N2 — the harness header's guard count is stale by two, inside the sentence that warns about exactly
that.**
`supabase/tests/mutation/p0-authz-writepath-audit.sh:21-26`:

> `# ── ARM 1: the authz RAISE-GUARDS — 11, NOT the 7 this header used to claim ──`
> `# ⚠ Corrected 2026-08-29, surfaced by the new ARM-DOMAIN line printing guard=N/11.`
> `# … ⛔ GUARD_KEYS is the truth — a count in a comment is an assertion, and this one was false for four additions.`

`GUARD_KEYS` at `:567` holds **13** (the header's 11 omits `create_professional_profile` and
`set_professional_link_state`); the run printed `guard=13/13`; the findings file's own regenerated
line says `Arm 1 guards: 13`. It recurred, and it recurred inside its own warning. It is pre-existing
on `main` and untouched here, so it is not a regression — but the unit enumerated this exact class in
this exact file three times (the DRYRUN literal, the reset delta, `READ ALL FIVE STEPS` above six)
and called the third *"the THIRD instance in this file"*. It is the fourth. It also falls **outside**
`FUP-WRITEPATH-BASELINE-HARDCODED-COUNTS-IN-HARNESS-BANNERS`, whose `Closes when` is scoped to
*"every count printed in an **executed banner**"* — this one is a comment, as was the `FIVE`/`SIX`
instance the unit *did* treat as in-class. Either fix it (delete the numeral, as was done for `FIVE`)
or widen that item's `Closes when` past "executed banner" and say the class boundary moved.

**N3 — the hub's `adrs:` frontmatter omits `0192`.**
`docs/features/writepath-baseline.md:12` reads `adrs: ["0079", "0153", "0173", "0189", "0190",
"0191"]` — the unit's own ADR is absent. `npm run features:index` regenerates the index from this
field, so the omission propagates.

**N4 — the hub's § Acceptance criteria contradicts its own § Current state.**
Items 4, 5 and 6 (baseline re-earned · every detector proven able to fire · the tip gate) are `[ ]`
unchecked at `:59-76`, while § Current state and the record report all three complete and R36 records
the gate green. Items 1–3 were checked by the same builder, so "unchecked" is not this unit's
convention for "awaiting the lead".

**N5 — register line-count deltas are off by one at each end.**
`docs/progress/writepath-baseline.md:1052`: *"Archive 10312 → 10935 lines; open register 1791 →
1769."* Measured: archive 10311 → **10934**; open register 1790 → **1770** (claimed delta −22, actual
−20). Trivial in itself; listed because the same turn's other counts are load-bearing.

---

## What I verified, and what I did not

**Verified independently on this tree (read-only):**
production diff empty · `authz-blind-allowlist.txt` byte-identical to `main` · the nine Part-3
policies each present and COVERED · the three `storage.objects` policies present, COVERED, with the
`supautils.policy_grants` route recorded per row · none of the 15 BLIND, 3 ERROR or 3 storage
policies added to any allowlist by this branch · verdict census 102/15/3 = 120 and its per-section
decomposition · `CASES_EXPLICIT`/`set_placement`, `LAST_BASELINE_SWEPT`, the derived DRYRUN banner and
the six-step recovery block all present at HEAD · the `READ ALL FIVE STEPS` numeral deleted · ADR 0192
header `**Amends:** 0189, 0153`, back-pointers generated in both targets, `INDEX.md` regenerated,
next-free advanced to 0193, no duplicate number, no `docs/adr/` · the archived closures' quoted
`Closes when` fields against `git show main:` · the truncated `…` field carried into the archive
unrepaired with the body's tail quoted verbatim and nothing paraphrased into the gap · the seven
instrument faults each present as a dated witness (`:192, :358, :432, :541, :909 ×2, :1075`), each
result discarded or re-earned rather than relied on.

**The three closures each discharge their own quoted clause.** I checked R2's concern specifically
and it holds: `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` closes on the recovery step **plus** the nine
policies swept, and the archive states in terms that the exit-code halves are *"cited as evidence the
tree is as claimed, not as the discharge"*. The exit codes are not smuggled in. Likewise the 3 ERROR
policies are recorded as **UNVERDICTED** *and* the "assertions FIRED" sentence is present in all three
homes required (follow-up entry, record `:822-826`, closure) — both halves are stated. R33's premise
correction sits beside the R30 approval (`:940-957`) and does not restate the approval as if given on
the corrected premise.

**Not verified — accepted on the record, or out of my reach:**

1. The four authz arms, `db reset`, `test:db`, `npm run lint`, `typecheck` and the `SELFTEST` arms at
   the tip. I was instructed not to re-run them; R36 is accepted as written. I did **not**
   independently confirm `Files=262, Tests=8876`.
2. `FROMFINDINGS=1 ARM=policy` was not run. B2's "5 new offenders" is a set difference computed from
   two committed artifacts using the harness's own extraction logic replicated in shell — arithmetic
   on the inputs, not an observed arm run. The arm's printed offender total may differ from 24 ± 5
   because it also draws on the door and rowdoor findings files, which this branch did not change.
3. The run itself — the 3.88 h log, the 120 runlogs' shapes, `resets=8` and its per-reset
   post-conditions, the sentinel behaviour, the plants, the negative controls and discrimination
   halves, the `RECOVER=1` proof on a storage policy, and the `cmp`-verified scratch copies. These
   exist only as record prose plus scratch artifacts outside the repo. The record's discipline in
   describing them is unusually good and none of my findings contradicts any of them — but they are
   attested, not audited.
4. Whether `lint:progress` / `lint:registers` pass at HEAD (not run).

---

## Re-review scope

B1–B4 are confined to `docs/reviews/authz-writepath-audit-findings.md`,
`docs/followups/follow-ups-open.md`, and the hub/record; none requires touching production code, the
harness's executed paths, or re-running the sweep. **B1 changes the input to
`FROMFINDINGS=1 ARM=policy`**, so after the fix that arm's offender list should be re-derived (and,
per B2, quoted). The four CLAUDE.md §6 arms (`census`, `hat`, `floor`, `wrapper`) do not read the
`## BLIND` section and need not be re-run on my account.

⛔ Explicitly **not** findings, and not to be treated as such: `FROMFINDINGS=1 ARM=policy`'s
pre-existing RED and its twelve section-stale rows (never allowlisted); the **427** command doors
outside the census domain; Tier 2's **190 doors**, which stay **deferred by ADR 0171 and are NOT
cleared**; and `297_process_template_versioning.sql`, correctly not fixed in this unit because the
fix moves `Tests=` and `Tests=` is the baseline shape the run asserted 120 times (R31).
