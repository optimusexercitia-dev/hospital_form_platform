# QA Review — unit WRITEPATH-BASELINE (pre-AE5 remediation, Batch 3)

**Reviewer:** `qa` · **Branch:** `authz-writepath-baseline`
**Subject:** `docs/features/writepath-baseline.md` § Acceptance criteria · ADR 0192 ·
`supabase/tests/mutation/p0-authz-writepath-audit.sh` · `docs/reviews/authz-writepath-audit-findings.md` ·
the three closures in `docs/followups/follow-ups-archive.md` § *Batch 3 closures* ·
the follow-ups filed/widened in `docs/followups/follow-ups-open.md`

| round | date | commit | verdict |
|---|---|---|---|
| 1 | 2026-09-08 | `6d0db87a` | CHANGES REQUESTED (B1–B4 blocking, N1–N5 non-blocking) |
| 2 — re-review | 2026-09-08 | `45f5880a` | **APPROVED** |

**Verdict: APPROVED**

⛔ Round 1's text below is **kept unrewritten** — it is the audit trail, and
`FUP-AUTHZ-PROOFS-CITED-BY-RECORDS-ARE-NOT-REPRODUCIBLE-FROM-THE-REPO` cites its
§ *What I verified, and what I did not* by heading. The re-review is appended at the foot.

---

# Round 1 — 2026-09-08 @ `6d0db87a` (CHANGES REQUESTED)

**Branch state at the time:** tree clean, 11 commits ahead of local `main`, push distance 1.

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

> ⚠ **CORRECTION 2026-09-08 (documentation audit, pre-merge) — "`256` … unchanged since" is FALSE,
> and this correction is the defect's own next instance.** The file moved **twice more inside the
> fix loop this review governs**. ⛔ Repaired by **anchoring**, never by a fresher number — a count
> is stale the moment anything after it is edited, so every figure below carries the commit it was
> measured at:
> `137` at `23ec1fa5` (`main`) · `401` at `e4062712` · **`256` at `3c763ffe`** and `6d0db87a` ·
> `304` at `0ff7d321` · **`311` at `a608e240`, `45f5880a` and `e4a16b33`**.
> ⭐ The finding is not the digit. `256` was itself this review's N1 correction of `251`; the fix
> loop then added 55 lines and nobody re-measured, and the stale figure **escaped the documents
> into a live instruction** when it was quoted as current in the audit brief. That is what N1
> predicted, one level up: a corrected count is not a fixed count.

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

---

# Round 2 — RE-REVIEW, 2026-09-08 @ `45f5880a`

**Verdict: APPROVED**

Fix loop 1 (`0ff7d321`, `a608e240`, `dc643256`, `45f5880a`), tree clean, production diff still empty.
**All four blocking findings are discharged and I re-measured each of them myself rather than reading
the fix.** Every non-blocking item landed, three of them beyond what I asked. Two findings were
repaired at a *better* grain than I stated them, and the branch found and disclosed three further
instrument faults of its own — including one it introduced while fixing B1, which would have reached
the lead's gate while failing nothing.

## What I re-measured, and what it returned

Every figure below was derived on this tree with the consumers' **own** extraction logic replicated
in shell (`blind_from_findings`, `verdicts_from_findings`, `verdicts_from_rowfindings`,
`skipped_from_findings`, `allow_body`, all lifted verbatim from
`supabase/tests/mutation/p0-authz-invariant.sh`), never by reading a document's claim.

**B1 — discharged, and the fix is correct at the class grain, not only at the row.**
Section × column-4 census of `docs/reviews/authz-writepath-audit-findings.md`: `## BLIND` holds
**15 rows, all verdict `BLIND`**; the COVERED section holds **102 COVERED + 3 ERROR**. Disagreements
**0**. `blind_from_findings` returns **15** labels, not 16. The row landed at `:189` in the slot the
generator's own sort produces (between `response_section_signoffs.signoffs_insert` and
`responses.responses_insert_own`), and its verdict, direction and file citation are **byte-identical**
to the misfiled original — only a dated `[row RELOCATED BY HAND …]` provenance suffix was appended.
The `## BLIND`-section-comes-first mechanism is recorded, and the *"correct only for the direction
that makes things worse — it fails closed"* reading is right and is the finding of this loop.

**B2 — discharged, and my own "5" now has a second independent derivation.**

| | write-arm BLIND labels | of which NOT on `authz-blind-allowlist.txt` |
|---|---|---|
| `main` | 3 | **0** |
| `45f5880a` | **15** | **5** |

The five I named are exactly the five the set difference returns, and the other 10 each resolve to a
standing allowlist entry. `authz-blind-allowlist.txt` is byte-identical to `main`
(`git diff main...HEAD -- supabase/tests/mutation/` returns **only** the write-arm harness — no
allowlist of any kind was touched). ⚠ The **post-fix** delta is `3 → 15`, not the `3 → 16` that stood
while B1's row was misfiled, and the documents state the post-fix figure. Disclosed at the hub
(`:133`), in the record (six sites), in ADR 0192 (`:209`) and in the follow-up (`:1036`), and
labelled *derived from committed artifacts, not observed from an arm run* at every one of them.
Framing checked adversarially: every site says the **offender set** gains five, never that the
blindness is new — the policies were always BLIND, the domain is what widened.

**B3 — discharged, and repaired at the sentence, not the digits.** My independent direction census of
the 15 returns **13 `ALL` / `open with-check->true`** and **2 `UPDATE` / `open using+check->true`** —
the entry now says exactly that, with the real direction tokens, and the inverted conclusion is
rewritten: the two `UPDATE` rows are now described as *both halves opened, so the BLIND is a claim
about the whole policy*. The *"nothing asserts…"* sentence is qualified against the recorded
`select_own` backstop **and** — better than I asked — says plainly that `notifications_update_own`
carries no recorded backstop and that this is *unmeasured, not clear*.

**B4 — discharged in the required form.** `:55-66` now carries a dated `⛔ SUPERSEDED 2026-09-08`
beneath the block, naming all three now-false claims individually and preserving the half that does
**not** expire (*absence of a row is absence of a verdict, never a COVERED*). The original block is
untouched; nothing was rewritten or deleted.

**N1–N5 — all landed.** `256` at the hub with a dated correction; the harness header numeral
**deleted** rather than refreshed (`GUARD_KEYS` = 13, no literal left to rot) and the banner follow-up
widened past *"executed banner"*; `adrs:` now carries `0192` and `build-features-index --check` is in
sync; hub criteria 4–6 are `[x]`; the register deltas are corrected to `10311 → 10934` and
`1790 → 1770` — I re-derived both from the anchored commits (`22402505` → `6d0db87a`) and they are
**exact**.

## Fault 9's blast radius — checked, and my instrument was proven able to see it

This was the item I was asked to verify hardest, so I did not take the repair on trust. I rebuilt the
census arm's `accounted` set — all four findings files with the right per-file filter, plus the three
allowlists — and ran it across the loop:

| commit | `verdicts_from_findings` on the write-path file | census `accounted` |
|---|---|---|
| `6d0db87a` (pre-loop) | 120 | 608 |
| `0ff7d321` (B1 fix, table un-indented) | **123** | **611** |
| `a608e240` (indented) | 120 | **608** |
| `dc643256` (lead re-ran `ARM=census` here) | 120 | 608 |
| `45f5880a` (tip) | 120 | **608** |

⭐ **My replication reproduces the lead's `608` exactly, and reproduces the fault before believing the
repair** — a detector that only ever printed 608 could not distinguish "repaired" from "never
looked". The `611` row is the discrimination half. It also settles a question the gate record leaves
open: the lead ran `ARM=census` at `dc643256`, one commit short of the tip, and `45f5880a` touches
only `follow-ups-open.md` and the progress record — neither is arm input — so **the accounted set is
byte-stable from `dc643256` to `45f5880a`** and R36 holds at the tip, not merely at the commit it was
run on.

**Class sweep for the same shape, over the whole fix loop, in every file an arm reads.** I scanned all
four commits for added lines matching `^\+[[:space:]]*\|` and for added `skipped_from_findings`-shaped
bullets (`^- \`tbl / pol / CMD\``). Results: the write-path findings file gained exactly **one**
pipe-leading line — B1's relocated row, which is a real verdict row; `docs/progress/writepath-baseline.md`
and this review file gained tables, and **neither is read by any arm** (`p0-authz-invariant.sh`
hardcodes its four findings paths at `:102-105`); `docs/followups/follow-ups-open.md` gained **zero**
pipe-leading lines, so the register's stricter `^\s*\|` matcher is untouched; no allowlist changed; no
new skipped-bullet shape anywhere. The harness diff in this loop is **comment-only** (verified line by
line). ⭐ The escape genuinely does not generalise and the record says so — indenting rescues a
findings file because `^\| ` is anchored, and would **not** rescue the register.

## Class-wide measurement (`45f5880a`) — independently confirmed, including the lead's own correction

I censused all four findings files myself, section × column 4:

| file | `## BLIND` section | `## COVERED` section | disagreements |
|---|---|---|---|
| `authz-door-audit-findings.md` | 36 `BLIND` + **38 `COVERED`** = 74 | 256 `COVERED` + 23 `NOTICED` = 279 | **38** |
| `authz-writepath-audit-findings.md` | 15 | 105 | **0** |
| `authz-rowdoor-audit-findings.md` | 1 | 36 | **0** |
| `authz-invoker-audit-findings.md` | 41 | 13 | **0** |

**38, all one-directional** — the COVERED section holds **zero** `BLIND` rows in any of the four, so
the opposite polarity really is absent and not merely unlooked-for. 564 rows is the total excluding
the non-verdict sections, and I confirmed **no row inside a BLIND or COVERED section fails to parse a
verdict** in any file, so the census has no discard bucket hiding a disagreement.

⭐ **The lead's grain correction to its own R40 is right, and I derived it a third way.** Of the 38
door rows, **26 are on `authz-blind-allowlist.txt` and 12 are not** — and the 12 not-allowlisted are
precisely the offenders that are section-stale, so `26 + 12 = 38` reconciles the standing *"12"* with
the new *"38"* without either being wrong. I checked the consequence too: the five documents that say
"12" (`docs/plans/pre-ae5-remediation.md:247`, `docs/progress/pred-domain.md:2931`,
`docs/reviews/pred-domain-rereview.md:357`, and the follow-up's own `Status` line) were **not**
rewritten to 38, exactly as ruled. The `75 → 74` correction to that entry's `Status` line is present
beside the original, and 36 + 38 = 74 confirms it. The entry now carries a numeric acceptance
criterion (`$4 == "BLIND"` takes the door BLIND set 74 → 36 and drops the named twelve), which turns
it from a description into something a future gate can be judged against. ⛔ Leaving the 38 unrepaired
here is correct — the door file is byte-identical `main`…`HEAD`, so they are Batch 2's baseline.

## Gates I ran myself this round

`npm run lint:registers` → **rc 0** (self-test + 10 hubs, 8 records, 79 ledger rows, 161 bugs,
212 follow-ups, 88 lessons, 411 md files scanned; all eight ratchets held or improved;
`build-features-index: index in sync`). `npm run lint:progress` → **rc 0**. Both were on my round-1
could-not-verify list and are now measured. Read-only; nothing else was executed.

## New observations this round

Neither blocks. Both are the batch's own recurring class, which is why I am naming them rather than
letting them pass.

**O1 — `FUP-AUTHZ-PROOFS-CITED-BY-RECORDS-ARE-NOT-REPRODUCIBLE-FROM-THE-REPO` says "seven instrument
faults" and the record now enumerates ten.** `docs/followups/follow-ups-open.md:1078` states, in the
present tense and about the record rather than about my review, that its claims include *"**seven
instrument faults caught**"*. That was filed in `0ff7d321`, the same commit that recorded **fault 8**;
faults 9 and 10 arrived in the two commits after it. The record's own running total says **nine**
(`docs/progress/writepath-baseline.md:1312`, written at `a608e240` and correct as a dated log entry —
the session log is append-only and I am **not** asking for historical entries to be restated). The
register entry is the live field, and it is the durable home for this item after the record ages out.
⭐ This matters more than a digit because **the entry's size is its severity**: an item arguing that
unreproducible proofs are a program-wide risk under-counts its own evidence by three. It is the
seventh instance of *a count quoted from before the last edit* in this unit — and the repair the batch
already discovered is the right one: anchor it (*"seven as filed 2026-09-08; ten at `45f5880a`"*)
rather than typing a fresher number that goes stale on the next fault.

**O2 — the fix loop added 47 lines of hand prose to a gate input whose protection is *whitespace*, and
nothing asserts that whitespace survives a merge.** The write-path findings file's non-table
hand-authored lines went **112 → 159** across this loop, and the new material includes the B1
explanatory note whose illustration is a **deliberately indented** pseudo-table. Indentation is the
only thing keeping those three lines out of `verdicts_from_findings` — un-indent them and
`ARM=census` goes 608 → 611 **while failing nothing**, which is fault 9 verbatim. The in-file ⛔
warning covers a *human* editing the file, and the record's *"a future merge's protected-set
reconciliation must use the new inventory"* (`:699`) covers the inventory — but that sentence was
written at `e4062712`, before this prose existed, and **no assertion anywhere says an indented
pseudo-table survives `merge-findings-baseline.sh` still indented**. AE5 re-keys this file eleven
times. ⛔ Not a fix request against this branch: the correct home is
`FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST`, whose `Closes when` already
demands standing `scripts/door-sweep-selftest.sh` cases for hand-table preservation — one more case,
*"a deliberately indented pseudo-table survives the merge still indented"*, closes it, and the batch
has already built the discrimination half for it (census 353 → 352 on an indented row).

**Records note, for the lead's Record step, not a finding:** the hub's `reviews:` frontmatter is still
`[]` while this report is committed on the branch — linking it is the lead's step-5 action, per the
role split.

## Could not verify — carried forward, still work items at APPROVED

Round 1's list stands except where noted. Items 1 and 4 have moved.

1. **Improved.** `npm run lint:registers` and `lint:progress` I ran myself (rc 0 both). `db reset`,
   `test:db` (`Files=262, Tests=8876`), `lint`, `typecheck`, the four authz arms and the `SELFTEST`
   arms remain accepted on R36 as the lead ran them — but `ARM=census`'s **608** I have now
   independently reproduced at the tip, so that one line is measured rather than attested.
2. **Unchanged.** `FROMFINDINGS=1 ARM=policy` was still not run. Both the "5 off-allowlist" and the
   "26 + 12 = 38" figures are arithmetic over committed artifacts using the consumers' own extraction
   logic — the documents now label them so at every site, which is the correct disposition, not a
   discharge. The arm's own printed offender total may still differ.
3. **Unchanged, and now filed.** The 3.88 h run, the 120 runlogs, `resets=8` and its post-conditions,
   the plants, the negative controls, the discrimination halves, the `RECOVER=1` storage proof, the
   `cmp`-guarded scratch copies, and the two-polarity re-merge through the real merge library that
   underwrites the B1 mechanism — all exist as record prose plus out-of-repo scratch. They are
   attested, not audited; nothing I measured contradicts any of them. This is now
   `FUP-AUTHZ-PROOFS-CITED-BY-RECORDS-ARE-NOT-REPRODUCIBLE-FROM-THE-REPO`, whose `Closes when`
   correctly refuses both escape hatches (bulk log commits; fixing one harness).
4. **New.** Whether the merge preserves the indentation of the note added this loop — see O2. Nobody
   has measured it, in either direction.

## Basis for APPROVED

Every acceptance criterion in `docs/features/writepath-baseline.md` is met and each is evidenced by a
measurement rather than a claim. No production file, migration, seed, RLS policy or `SECURITY DEFINER`
gate changed on this branch (`git diff --name-only main...HEAD -- supabase/migrations supabase/seed.sql src`
is empty, re-checked at the tip), so Architecture Rules 1, 2, 5, 9 and 12 are untouched by
construction and there is no authorization surface to re-audit; the only executable change is the
write-arm mutation harness, and the sole change to it in this loop is comment text. No allowlist
gained an entry — the one action that could have converted a finding into silence. The four blocking
findings are fixed at the mechanism rather than the symptom, the two figures I got at the wrong grain
were corrected *against* me with the measurement shown, and the branch disclosed three faults of its
own that no gate would have caught. O1 and O2 are register work, not merge blockers.
