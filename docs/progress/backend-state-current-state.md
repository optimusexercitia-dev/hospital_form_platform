# BACKEND-STATE-CURRENT-STATE — progress record

> Hub: [backend-state-current-state.md](../features/backend-state-current-state.md) · decision: ADR
> [0198](../decisions/0198-backend-state-seams-get-a-replaceable-current-state-layer.md). Branch:
> `backend-state-current-state`, cut from `data-access-generation` at `50af6915` (= `main` @
> `e4ac95e5` plus ADR 0197). ⚠ Cut from the SIBLING, not from `main`: the two P1 units both edit
> `docs/backend-state/`, and building on top is what serialising them means. It merges after 0197.

## Session log

### 2026-09-09 — re-derivation, eleven blocks, gate 16 checks G/H/I/J (one session)

**Why this ran.** The external review of `BACKEND-STATE-SPLIT` filed three P1/P2 items into that
unit's session log and nowhere else. ADR 0197 closed the second. This closes the first: *"no seam has
a replaceable current-state layer (57 of 67 sections are still slice-coded)"*.

**The finding re-derived, not inherited.** Every quoted figure was reproduced from the committed
corpus at `e4ac95e5` before any file was touched:

| claim | how it was re-derived | result |
| --- | --- | --- |
| 67 `##` sections, 57 slices (85%), 10 axis-free | `node scripts/measure-state-layer.mjs e4ac95e5` | **reproduces exactly** |
| "7 of the 11 seam files carry no axis-free section" | same run reports **8** files | **reconciles** — the eighth is `stamp-history.md`, the pre-split archive, which is not a seam |
| ~49 `SUPERSEDED` · ~68 `STALE` · ~17 `HISTORICAL` | `grep -o` per file over the same tree | **49 / 68 / 17 exactly** |
| deployment verdicts frozen into headings | `grep -n 'NOT PUSHED\|LOCAL ONLY'` | 3 headings + 1 self-contradicting sentence in `printing.md` |

⚠ `scripts/measure-state-layer.mjs` is a NEW artifact whose only justification is maintenance rule 5:
a figure without its query is not a measurement. ⛔ Its classifier is a heuristic FITTED to this
corpus (LEARN-089's trap), which is why it prints every heading and its verdict under `--verbose` and
says so in its own header. Its agreement with a by-hand classification of all 67 headings is the only
evidence it is sound, and that is evidence about one corpus at one commit.

**What was built.** Eleven `## Current state` blocks, first among each file's `##` sections; the
frozen slices below them untouched. Shape reused from gate 13's hub block with
`CURRENT_STATE_MAX_LINES` **imported** rather than re-declared; the five section names deliberately
differ (ADR 0198 D2). `stamp-history.md` gained an `⛔ **ARCHIVE**` declaration naming its live
successor; the four `generated-*.md` files already carried a conforming `⚙ **GENERATED FILE**`
declaration and were not edited at all — which is what let this unit and ADR 0197's land in either
order.

**Witness that history was not rewritten:** work-unit slice count **57 at `e4ac95e5`, 57 now**;
axis-free sections **10 → 26**; seam files with no axis-free section **7 → 0**.

**Drafting discipline (ADR 0198 D3), and its verification.** Each block was drafted against its seam
file with a per-bullet citation map — bullet, source line, source sentence verbatim. The maps were
then checked mechanically:

- **409 quoted fragment-groups checked, 373 matched on the strict matcher, 36 residual.**
- A second, deliberately weaker matcher (letters and digits only) resolved **32** of those as
  formatting drift — blockquote `> ` continuations, table pipes, escaped markdown.
- The remaining **4 were hand-checked against the source and all four are real text**:
  `authorization-and-audit.md:696–702` (a fenced SQL predicate re-flowed onto one line, with its
  trailing `-- leg 4` comments elided), `:157` (a blockquote wrap), `conventions.md:20` (a wrap) and
  `:227` (a registry row whose `…090008` was mis-split by the verifier's own elision character).
- **0 fabrications.** ⛔ Vacuity control first: with every quote replaced by a sentence no file
  contains, all 409 failed — the verifier was proven able to see a fabrication before its silence was
  read as evidence.
- ⚠ **BOUND, STATED:** this proves each cited SENTENCE EXISTS. It does not prove the bullet above it
  says the same thing. Inversion remains a human judgement and is what a review should spend itself on.

**Gate 16 — four new checks, and one number stopped being remembered.**

- **G** present · FIRST `##` · `**Updated:** YYYY-MM-DD` · exactly the five sections in order · within
  the line ratchet. **H** no supersession marker, no deployment verdict, no date but the stamp.
  **I** the stamp is not older than the newest date in any heading below. **J** an exemption must be
  DECLARED and must NAME its proof, and the set is ratcheted and printed on every run.
- ⚠ **H's date rule had a real flaw, found by a draft rather than by design.** `conventions.md` must
  cite `§ REMOTE CENSUS 2026-08-18` — a frozen heading whose own NAME carries a date. Banning all
  dates would have forced a writer to mangle the section name and break the navigation the section
  exists to provide. The ban is now lifted only inside `### Where the detail lives`, and only on a
  line that actually cites (carries a `§` or a markdown link); a bare dated CLAIM parked there still
  reds, and there are arms for both.
- The self-test is **79 arms** (39 pre-existing + 40 new). ⛔ `return 39` was replaced by a counter:
  the literal was already wrong against `docs/lint-gates.md`'s "32-arm", and a count somebody must
  remember to update has a hole shaped like forgetting — this gate's own D7.

**Mutation run — 12 arms against the REAL corpus, `node scratchpad/mutate-gate16.mjs`.** Every arm
asserts three things separately: the mutation reached disk (bytes changed), the intended CHECK LETTER
fired (a red from the wrong check is a failure, not a pass), and the rollback restored the file
byte-for-byte with the baseline green again.

| # | mutation | file | expected | result |
| --- | --- | --- | --- | --- |
| 1 | the `## Current state` heading is typo'd away | `privacy-and-dsr.md` | G | caught |
| 2 | `### Rollout` renamed `### Deployment` | `printing.md` | G | caught |
| 3 | `### Surface` and `### Invariants` swapped | `notifications.md` | G | caught |
| 4 | the block padded past the ratchet | `conventions.md` | G | caught |
| 5 | a slice interposed above the block | `meetings-and-governance.md` | G | caught |
| 6 | a `⚠ **Superseded**` marker inside the block | `forms-and-responses.md` | H | caught |
| 7 | a `NOT PUSHED` verdict inside the block | `cases-and-ethics.md` | H | caught |
| 8 | a `✅ PUSHED` verdict inside the block (opposite polarity) | `data-access.md` | H | caught |
| 9 | a stray date inside `### Surface` | `tenancy-and-identity.md` | H | caught |
| 10 | history appended, projection not re-stamped | `document-model.md` | I | caught |
| 11 | a GENERATED declaration naming no gate | `generated-feature-flags.md` | J | caught |
| 12 | an ARCHIVE declaration naming no successor | `stamp-history.md` | J | caught |

⛔ **The mutation run failed one arm, and the arm was right — check J was UNFALSIFIABLE in the file
it governs.** Deleting `(gate 17)` from `generated-feature-flags.md`'s declaration left the gate at rc=0,
because the "names its gate" test was a WHOLE-FILE `/gate NN/` regex and that file contains a generated DATA
ROW whose prose reads "Gate 2". So the requirement could not fail there, for any declaration. ⚠ The
79-arm self-test passed throughout — its fixtures are small and carry no incidental match, which is
exactly why a synthetic self-test cannot replace a run against the real corpus. Fixed by cutting the
REGION first (`declarationParagraph` — the marker line to the next blank line, the same cut check C
makes for the preamble), plus four discrimination arms proving that naming the proof in the BODY does
NOT satisfy a claim about the DECLARATION. Filed as **LEARN-093**; the re-run is 12/12.

⛔ **A second defect, found by a byte-level proof rather than by any gate: the block boundary swallowed
pre-existing prose.** A block ENDS at the next `##`, so inserting it directly after the shared preamble
put whatever sat between preamble and first slice INSIDE a region this ADR documents as REPLACEABLE —
four files carry such intro prose (`authorization-and-audit`, `cases-and-ethics`,
`meetings-and-governance`, `tenancy-and-identity`). ⚠ Worse, it then read as MY content: two blocks
measured 101 lines, and a fold-to-fit edit reformatted a pre-existing paragraph into a list item. A
future REPLACE would have deleted all four. ⛔ Nothing caught it — gate 16 was green, the mutation run
was 12/12, and the slice count was unchanged, because none of them asks about the region ABOVE the
first slice. The proof that found it: strip this unit's additions from every file and compare to
`git show HEAD:`. **All eleven blocks were then rebuilt from HEAD**, inserted immediately BEFORE the
first pre-existing `##` instead — which keeps the block the first `##` section (check G still holds)
while leaving the intro prose above it, outside the replaceable region. Re-proved after the rebuild:
**16 of 17 files byte-identical to HEAD once this unit's additions are removed**; the seventeenth is
`README.md`, changed on purpose (maintenance rules 7–8, the axis paragraph). Mutation run re-run
against the rebuilt corpus: 12/12.

⚠ **That boundary defect is NOT in `docs/learning/LESSONS.md`, and the omission is deliberate.** It was
drafted as LEARN-094 with `Enforcement: prose only` and gate 13 red: `lessonsProseOnly is 53, cap 52 —
may only be lowered`. No honest enforcement exists for it — the fix is an authoring placement, and no
check can tell pre-existing prose from new — so the choices were to raise the ratchet or to withdraw
the entry. ⛔ Raising a ratchet to admit an unenforced lesson is precisely what that ratchet forbids, so
the entry was withdrawn and the account lives here instead. **Open for the PO**: admit it under the
register's bar (which needs the cap earned down elsewhere, not raised), or leave it as a record entry.
The lesson in one line: *a count that is unchanged is not a proof that nothing changed — when the claim
is "I added and edited nothing", the evidence is a byte comparison, not a census.*

**The ratio gate was considered and rejected**, with the reasoning in ADR 0198 § Considered options:
history is append-only by 0196 D5, so a historical/current ratio necessarily degrades as the corpus
grows CORRECTLY, and the only remedy a ratio gate leaves is deleting posted sections — which D5
forbids and maintenance rule 4 names. Check I gates the falsifiable half instead. The ratio is
printed on every run so the concern stays visible without being enforced.

**The line ratchet was set from measurement and then bit its own introduction.** Ten blocks were
drafted under an "under 100 lines" instruction and came in at 93–99; two came in above it
(`document-model.md` 111, `tenancy-and-identity.md` 125). The ratchet is **100** and those two were
TRIMMED to fit rather than the number raised — against an explicit rule, because compressing to fit a
cap selects against qualifiers: cut paraphrase, never a negation, a bound or an exception; where a
bullet could not be shortened safely, delete it whole and leave the pointer. The smallest seam
(`notifications.md`) honestly needs 61, so the ratchet has room to be lowered later. `SEAM_STATE_CEILING`
is DERIVED as twice the imported hub cap, so the ratchet can never be argued up to an arbitrary number.

**Citation maps were NOT committed.** They are drafting evidence; a twelfth register nobody maintains
is the drift this directory exists to retire (ADR 0186). They lived in the session scratchpad, and
the verification result above is what survives.

**Defects found in the frozen text and deliberately NOT fixed** (0196 D5 makes each an APPEND
somebody must still write; listed on the hub, with locations here):

- `authorization-and-audit.md:81` / `:88` say `CEILING: 759` while `:144` says `` `CEILING: 752` is
  UNCHANGED``; the file's own note at `:147–157` concedes a reader "meets a present-tense sentence
  that is false about the document in front of them" and that **nothing gates the pair** — gate 15's
  `PROSE_RE` is `/\*\*CEILING:/`, which the backticked form does not match.
- Same file: § Zero-policy tables (`:20–51`) is headed "seven tables"; AE3 (`:516–518`) says the class
  is "now **8** tables", with no forward marker on the earlier section. The two `382` plan sizes also
  disagree (`plan(72)` at `:25` vs `plan(83)` at `:499`).
- `printing.md:178` — "NOT PUSHED at the time of writing — ✅ **PUSHED 2026-08-25**" in one sentence.
- `conventions.md:76–78` points at "the correction record at the top of this file"; the split left it
  behind, so the pointer resolves nowhere. The counts it cites are the ones it warns are unreliable.
- ⚠ `ARCHITECTURE.md` §2 stale against two seam files — the case `collects_patient` /
  `patient_enabled` booleans (`cases-and-ethics.md:22–24` records them DROPPED) and `answer_references`
  still described as write-inert after § FF-5 records the arms landing.
- ⚠ `docs/features/backend-state-split.md` § Current state is stale against its own file (says a
  17-arm self-test and 18 links; its record says 39 and 87).

⛔ **The mutation harness left a mutation ON DISK, and only the NEXT run's baseline check saw it.** An
uncaught error between "write the mutation" and "restore" left a `⚠ **Superseded**` marker inside
`forms-and-responses.md` — a defect the harness itself invented, sitting in the corpus, with the gate
reporting it as real. ⚠ It was caught only because the harness refuses to run on a red baseline; had
that guard been absent it would have been committed. This is the standing rule
`.claude/rules/mutation-harnesses-are-not-killable.md` reproduced in a harness written the same day.
Fixed: every mutation is registered BEFORE it is written and drained by a `finally` plus `exit` /
`uncaughtException` / `SIGINT` / `SIGTERM` hooks, and each restore is verified by re-reading. The file
was restored from `HEAD` + its block, the byte proof re-run, and the harness re-run 12/12.

**The instruction pass — where "how to keep this current" lives, and why there (ADR 0198 D8).** The
layer is only as durable as the instruction for maintaining it, so the homes were audited before
anything was written, to avoid adding a fourth copy of a rule that already exists in three places.

| home | what it carries | why there |
| --- | --- | --- |
| `scripts/check-backend-state.mjs --scaffold` | the canonical EMPTY block | emitted from `SEAM_STATE_SECTIONS`, the same constant G and H read, so the form cannot drift from the checker. 5 self-test arms assert what it prints passes G, H and I |
| `docs/backend-state/README.md` § Writing and refreshing a current-state block | THE procedure — triggers, the four rules no gate can enforce, a gate-red decoder, and where the block goes | it is the deep home: gate 16's failure footer now names this heading, so a reader who just got a finding is routed to it |
| `README.md` § Maintenance rules 7–8 | the two-layer rule and the deployment-status rule | rules state WHAT; rule 7 points at the procedure for HOW rather than restating it |
| `CLAUDE.md` §7 | the invariant only: a phase **APPENDS** its slice **and REPLACES** the block | always-loaded, so it carried the wrong instruction to every teammate — it said "EXTENDS its seam file", which is now half the obligation |
| `docs/lead-playbook.md` Record step 4 | the TRIGGER: two edits to one file, not one | the Record step is the moment the obligation fires |
| `docs/INDEX.md` map row | that each seam OPENS with the projection | routing only |

⛔ **`.claude/rules/` was the obvious-looking home and is the wrong one.** ADR 0127's admission filter
rejects a rule a gate already enforces — G/H/I/J enforce the shape — and requires a tight `paths:`
glob, which "a phase changed the backend surface" does not have. 0127's own words: *a rule a gate
already enforces is a downgrade dressed as a cleanup.*

⚠ **CLAUDE.md was edited with explicit PO approval**, +205 bytes (21,444 → 21,649). It is already 964
bytes over ADR 0186's 20,480 target, and the alternative offered — a size-neutral edit that dropped
the over-cap prohibition — was declined. Recorded because a size decision made once reads later like
an oversight.

⚠ **A first draft of the playbook step was WRONG and was cut back.** It restated the four un-gateable
rules inline, creating a second copy of README prose — the exact drift this pass existed to avoid, in
the edit meant to prevent it. The step is now a trigger plus two pointers, matching the shape of its
neighbours in that list.

⚠ **Nothing gates the agreement between those homes**, and that is stated in ADR 0198's Consequences
rather than left to be discovered. The pre-existing "ONE seam file / never a new file" clause already
sits in four places, two of them byte-identical parentheticals. If they disagree, the README wins.

⚠ **Found while auditing, not fixed here:** the `docs/features/<code>.md` hub block — the convention
this layer reuses — has **no scaffold and no template**, only a constant, a validator and a self-test
fixture in gate 13. It is the same drift exposure one level up, and it is outside this unit.

**Gate runs, all taken BARE — a pipe destroys the exit code.**

| command | rc |
| --- | --- |
| `node scripts/check-backend-state.mjs --self-test` | 0 (75 arms) |
| `node scripts/check-backend-state.mjs` | 0 |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |

⛔ **Not run, and not claimed:** `npm run test:db` and the E2E gate. This unit changes documentation
and one lint gate; it touches no migration, no RLS, no `src/` behaviour. Saying so is cheaper than
letting a reader assume a green suite that was never started.
