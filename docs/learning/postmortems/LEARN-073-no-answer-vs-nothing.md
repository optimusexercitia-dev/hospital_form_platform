# LEARN-073 — "I could not look" is not "I looked and found nothing"

Long form of [`LESSONS.md` LEARN-073](../LESSONS.md). Source: `FUP-DM5-NO-ANSWER-VS-NOTHING`,
filed 2026-08-17 (backend, S5.D), all six instances closed 2026-08-19, retained in
`docs/followups/follow-ups-open.md` as a review lens by PO ruling 2026-08-28.

## What happened

Six instances of one class surfaced in the DM5 storage-disposal / PHI-retention tooling,
filed together because the lead ruled it "to be filed as a class, not as two bugs": "Two
independent instances in one tool, in unrelated code paths, found days apart by different
means." The instances, quoting the entry's own table:

1. **`--allow-orphans`** — the flag muted both "proof unavailable" and genuine
   `ORPHANED_BYTES` findings at once.
2. **`.list('')` on an absent bucket** — "absence of a **bucket**" read as "absence of
   **keys**."
3. **`complete_document_disposal`** — a **metadata row** being gone was recorded as
   **bytes** being gone, in a persisted regulatory record.
4. **destruction (`rm`)** — a file being **unlinked** was recorded as bytes being
   **unrecoverable**.
5. **a backup pipeline** — the pipeline having "ran, exit 0" was recorded as "a backup
   exists" (caught pre-ship; it never shipped).
6. **`verdictFor`** — "no volume **directory**" was read as "the bucket is **consistent
   and empty**," found by QA "by CONSTRUCTING the state."

The entry states: "ALL SIX INSTANCES CLOSED 2026-08-19," and the class statement itself was
"retained here in full" as, in the entry's words, "the most productive review lens this
program produced (six instances, three variants, four of them found *inside the fix for
another one*)."

## Why it happened

The entry's own class statement, promoted after a QA correction, is: "**An observable PROXY
is substituted for the property that actually matters — and it always fails in the
REASSURING direction.**" The entry records that the *first* headline it tried —
"an action performed is recorded as the state achieved" — was wrong for two of the six
instances: "QA was right that it fits instances 3/4/5 and **not 1/2**: 'I could not look' is
not an action performed." The corrected sentence was needed because, as the entry states,
"a class that mis-describes two of its own instances will mis-train the next reader." Three
named variants: "I could not look" (1, 2), "action → state" (3, 4, 5), and "I looked at the
WRONG THING" (6) — the entry calls variant 6 "a THIRD distinct variant" and "the hardest of
the three to spot in review, because the measurement genuinely happened."

## Why we didn't detect it earlier

The entry gives a distinct detection mechanism for each hard-to-find instance rather than one
shared cause:

- Instance 2 "surfaced only because a control was built for a state nobody had seen — not by
  review, and not by any run of the existing 15 controls."
- Instance 6 was "Found by QA (MAJOR-1) by CONSTRUCTING the state" — the existing tool "the
  tool consulted the volume and reported honestly about it, while never consulting the API
  set that contradicted it."
- Instance 6b was found only because someone did, in the entry's words, "the guard-set diff
  the fix implies" on the sibling branch "two lines below" the branch just fixed, "in the
  same function, in the same commit" — it was not caught by the review that fixed 6.
- Instance 5 (the encrypted-backup pipeline) failed silently because "with stderr suppressed
  the encryptor consumes the empty stream and 7-Zip prints 'Everything is Ok'" — the action
  ran and reported success while the state (a non-empty archive) was never achieved.

Not recorded in the source entry: a single root cause for why the class as a whole went
unnoticed before instance 1 was filed.

## What worked well

Filing it as a class rather than as separate bugs meant, per the entry, that "it gets a
design answer" instead of each fix leaving "the shape" open for the next occurrence; the
entry notes four of six instances were "found *inside the fix for another one*," which it
gives as "the argument for having a class statement rather than four separate tickets."
The fix for instance 1 shipped with mutation controls "all observed RED before the fix"
(C20/C21/C22/C22b/C22c, C23, C19) and a keystone, C19, explicitly "aimed at the NEXT
instance, not this one." Instance 5 was "caught pre-ship" by verifying the pipeline's
output rather than trusting its exit code. Instance 3's resolution was a measurement, not a
decision: "the Cloud question was MEASURED, and answered NO — 2026-08-18,
`cloud-orphan-probe.mjs` against the live project." Instances 6/6b were "Fixed" and "pinned
red-first" by rehearsal `R7` (+ `R7-twin`) and selftest `C14`/`C15`/`C16`, "both observed RED
before the fix."

## What failed

Quoting each instance's own failure: `--allow-orphans` "also silenced genuine
`ORPHANED_BYTES` verdicts," so "an operator who wanted a usable exit code had to buy
blindness to the finding the tool exists to produce." `.list('')` on a bucket "whose **row is
gone** returns `{data: [], error: null}`," so the deletion tool's classifier "took the
**reassuring** branch ... for a bucket it had never interrogated, **on the destructive
path**." `complete_document_disposal`'s absence check "reads **`storage.objects`** — the
metadata table," so "`disposed` proves the metadata row is gone and **not** that the bytes
are gone" — a risk the entry calls "a **false compliance assertion**" under the stated
regulatory regime. `verdictFor` verdicted a removed volume directory `CONSISTENT_EMPTY`
("a member of `CLEAN_VERDICTS`"), so `capture` "printed **CAPTURE CLEAN and exited 0** over a
bucket whose PHI bytes were gone" — the entry flags this "**Non-monotonic in severity:** lose
*some* of a bucket's bytes (directory survives) ⇒ `MISSING_BYTES`, dirty, exit 1. Lose
**all** of them (directory removed) ⇒ clean, exit 0. **The worse state reported better.**"

## General lesson

The entry's class statement, quoted verbatim: "**An observable PROXY is substituted for the
property that actually matters — and it always fails in the REASSURING direction.**" It names
three variants that all share this shape — "I could not look" mistaken for "I looked and
found nothing," an action performed recorded as the state achieved, and a real measurement
that consulted the wrong surface — and states the transferable rule found while fixing
instances 6/6b: "**a fix applied to one arm is a question asked of every sibling arm — diff
their guard sets.**"

## Changes made

- **Instance 1:** `CLEAN` / `UNPROVEN` / `DIRTY` now "**partition** the nine-verdict
  codomain," exit **3** for UNPROVEN and exit **1** for DIRTY, "**dirty outranks
  unproven**"; `--allow-unproven` / `--allow-dirty` each acknowledge exactly one class;
  `--allow-orphans` is "**refused by name, not aliased**" (ADR 0128).
- **Instance 2:** the deletion tool's classifier is "now gated on `getBucket`, which does
  error" (shipped in `d2b19808`).
- **Instance 3:** ADR 0121 D4 made `disposal_evidence` record `metadata_absent` +
  `metadata_source` plus a closed `byte_proof` vocabulary
  (`local_volume_verified` / `unavailable_on_platform` / `not_attempted`);
  `FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED` made the one lane that actually deletes bytes declare
  `unavailable_on_platform`; the open Cloud question was closed by measurement
  (`cloud-orphan-probe.mjs`, recorded in
  `docs/progress/cloud-orphan-probe-2026-08-18.md`) rather than left open.
- **Instance 4:** the runbook (`docs/deployment/phi-disposal-runbook.md` §6b) now records
  "destroy the KEY first, then delete the archive," logging what each step proves rather than
  claiming an unverifiable `shred`.
- **Instance 5:** caught before shipping; the runbook gained "a **mandatory** count-vs-census
  verification step."
- **Instances 6 / 6b:** `verdictFor` was fixed; `UNVERIFIED_PROOF_ERROR` replaces
  `CONSISTENT_EMPTY` for a failed `docker exec` measurement.

## New rule

Not recorded in the source entry as a `.claude/rules/*.md` file. The entry states this is
deliberately **not** converted into a tooling gate: it is "retained ... as a review lens,"
and the entry itself is the one standing exemption from gate 7's "no resolved entry in the
open register" check — "PO-RULED 2026-08-28: this note STAYS — it is the live-register entry
gate 7's residue check requires for that body, not concluded residue; cutting it reds the
gate." No new rule file was filed for this class.

## Applies to

The six instances, per the entry: `scripts/storage-manifest.mjs` (`--allow-orphans`,
`verdictFor`, `volumeCensus`, and their `selftest`/`rehearse` controls C14–C23, R3d, R6–R10c,
R7/R7-twin); the storage-deletion tool's post-deletion classifier (instance 2, `.list('')`,
fixed in `d2b19808`); `complete_document_disposal` and
`docs/deployment/phi-disposal-runbook.md` §§4 and 6b (instances 3 and 4); and the PHI backup
pipeline verified while writing the runbook (instance 5). Related records named in the entry:
ADR 0128, ADR 0121 D4, `FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED`, `FUP-DM5-CLOUD-ORPHAN-SURFACE`, and
the sibling lesson `[[new-door-must-inherit-every-sibling-arm]]`.
