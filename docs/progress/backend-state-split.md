# BACKEND-STATE-SPLIT — progress record

> Hub: [backend-state-split.md](../features/backend-state-split.md) · decision: ADR
> [0196](../decisions/0196-backend-state-split-on-the-module-seam-axis.md). Branch: none — done
> directly on `main` at PO instruction.

## Session log

### 2026-09-09 — evaluation, split, gates, citations (one session)

**Why this ran.** The PO asked whether `scheduler_platform`'s documentation method would benefit
this project, `backend-state.md` having become a monolith; then instructed the two recommended
steps be executed immediately.

**Baseline, measured before touching anything** (`docs/backend-state.md`):

| fact | value | how |
|---|---|---|
| size | 742,255 B / 6,353 lines | `wc`, `git cat-file -s` |
| growth | 119 KB (07-01) → 314 KB (08-01) → 714 KB (09-01) → 742 KB (09-09) | `git cat-file -s` at each month's first commit touching it |
| churn | 183 commits, 84 in the last 30 days | `git log --follow --oneline \| wc -l` |
| sections | 66 `##` + a 381-line preamble | `grep -n '^## '` |
| chronological share | 53 sections / 4,577 lines = **72%** | classified each `##` as slice vs registry, summed |
| self-correction | 33 `SUPERSEDED` · 45 `STALE` · 35 "no longer" · 194 ⛔ · 257 ⚠ · 266 date stamps | `grep -ic` per token |
| worst line | line 380 at **67,360 chars** — the collapsed `Last updated / Previous / prior` chain | `awk 'length>5000'` |

⭐ **The theory I started with was WRONG and the record says so.** I expected the 53 slices to be
duplicates of `docs/progress/<code>.md` (143 records exist, named for the same units) and the fix to
be deletion. Comparing DM1 in both refuted it: the progress record holds the **process log** (task
table, turn records, triage ledger, gate steps), the backend-state slice holds the **surface delta**
("REMOVED: 3 tables, 5 RPCs, 7 `app.*` routines, 3 storage policies, 4 FKs"; parked seam columns;
the 7-item DM4 allowlist). The deltas are a genuinely homeless axis. Deleting them would have
destroyed information — which is why the split re-files rather than prunes.

**The split, done by script so the partition is provable, not eyeballed.** Each `##` mapped to
exactly one seam by an explicit prefix table; the script refuses on an unmapped OR ambiguous
heading. Partition assertion: `preamble 381 + moved 5,926 + deleted 47 == 6,354`. Then a separate
verifier compared the **multiset of source lines** against the multiset of output lines:
**`MISSING = 0`**, 220 added lines all accounted (12 preambles, 12 H1s, 4 cross-seam pointers, the
stamp-history header). Nothing was judged by reading.

**Two decisions taken during the split, both recorded because they changed the shape:**

1. `document-model.md` first landed at **174.6 KB — over the 160 KB warn line**, because it had
   absorbed the 381-line preamble containing the 67 KB line. The rule being written forbids raising
   the cap, so the cause was examined instead: lines 345–380 were the old file's own
   currency-stamp chain, cross-seam edit history, not document-model content. Split to
   `stamp-history.md` (frozen); `document-model.md` fell to 105.7 KB.
2. The END-STATE block (lines 14–344) contains facts belonging to other seams (REFNOTE's 23 referral
   doors, the `is_commission_admin_of` → `is_tenancy_admin_of` rename, the cadence surface, three
   corrected pt-BR authority messages). It stays **verbatim** in `document-model.md` — the freeze
   rule forbids editing it, and cutting it would select against qualifiers. Four **pointers** were
   added to the affected seam files instead. Pointers, not copies: one home per fact.

**Gate 16 (`lint:backend-state`), and a defect it found in itself.** Four checks (preamble identity,
router reachability, forward-marker targets, size). On its **first real run it fired on all 13
files** — the preamble and the README *quote* the `⚠ **Superseded**` marker form in order to mandate
it, so the detector was reading its own instructions as data. Fixed by cutting the **region** (the
preamble run, and the router whole), never by pattern-matching "descriptive" wording, which would be
a second thing to keep in sync. Three self-test arms were added specifically to prove the cut does
not blind the check below the preamble, including one asserting the reported line number stays true.

**Mutation run against the REAL corpus** (fixtures prove the function; this proves the wiring):
preamble drift on `printing.md` → `[A]` fired; `printing.md` unrouted from the README → `[B]` fired;
a dangling `⚠ **Superseded** … See no-such-file.md` appended → `[C]` fired at the correct line 565.
Baseline green after each rollback.

**Gate moves.** Gate 15 `check-budget-anchor.mjs` and gate 12 `check-service-role-registry.mjs`
both hard-code a path plus a heading regex; both sections landed in
`docs/backend-state/authorization-and-audit.md` and both gates were repointed in the same edit.
Re-run green: budget-anchor now reports `authorization-and-audit.md:88 ceiling=759 app=326
public=433 total=759` with its 15-bad/5-good self-test intact; the registry gate reports
`45 derived == 45 rows`.

**Citations — measured, not predicted.** 5,516 raw hits, most in `graphify-out/` (generated) and
historical records. Rather than guess the blast radius I ran the three link-gated gates and read the
findings: **19**, all repaired (17 in gate 7's corpus, 2 in gate 13's). ⚠ **Gate 9 was green from
the start** — ADRs cite the map by code span, not by markdown link — so no ADR needed editing, which
keeps ADR 0105's "historical records are deliberately not rewritten" intact. Live authoritative
documents (`CLAUDE.md`, `ARCHITECTURE.md`, `CONTEXT.md`, `docs/INDEX.md`, `lead-playbook.md`,
`lint-gates.md`, the handoff skill, two hubs, `.claude/rules/`) were updated; applied migrations were
**not** (their text is frozen by ADR 0078) and two carry now-stale mentions, recorded in 0196.

⚠ **Gate 8 caught a mistake of mine and is why the anchor form is what it is.** I rewrote
`.claude/rules/migrations-forward-only.md`'s anchor as a GitHub slug
(`#migrations-forward-only-additive`); `check-rules-staleness` resolves `path#literal` by **literal
text search**, so it red. Restored to `#Migrations (forward-only, additive)`.

**Gate runs at close** — ⛔ both taken **bare, not through a pipe**, because a pipe erases the exit
code and this repo has been bitten by exactly that:

- `npm run lint` → **rc=0** (all 16 gates, eslint 0 errors / 0 warnings)
- `npm run typecheck` → **rc=0**
- `node scripts/check-backend-state.mjs` → OK, 12 seam files + README, all routed, preamble
  identical, 732 KB total, largest 114.6 KB

**Not run, and therefore not claimed:** `npm run test:db`, `npm run e2e:prod`, and §6 step 3 (QA
review). Nothing in this unit touches SQL, application code or specs — the only `supabase/` edits
are comment lines in four pgTAP files and one mutation shell script — but "did not run" is stated
rather than reasoned away.

**Owed, carried out of this unit:** a read-only review of the split; extending derive-and-compare to
the eleven still-ungated registries; the `process.cwd()` → resolve-from-this-file hardening missing
from `check-service-role-registry.mjs` (gate 15's sibling, hardened 2026-09-08, this one not).

### 2026-09-09 (2) — QA review round 1: CHANGES REQUESTED, all 20 findings addressed

⚠ **Scope ruling, moved here from the hub (QA m11) because a hub's `## Current state` is CUT into
this record at completion, and this fact had its only home there:** the lead advised deferring this
unit past the Batch 7/8 boundary — it competes with the pre-AE5 remediation programme and touches a
file with 84 commits in 30 days. **The PO overrode that and instructed it be done immediately.**
Recorded because an approval's scope is a fact that must be written down.

Review: [backend-state-split-review.md](../reviews/backend-state-split-review.md) — **2 BLOCKING,
4 MAJOR, 14 MINOR**. Run on Opus, read-only, briefed to falsify each claim rather than confirm it.

**What the review could NOT break** (re-derived independently, not taken from my run): losslessness
in both directions — its own multiset comparison against `git show 2b4fa89b:` found the same two
deletions and **no content duplication**, and the four authorization sections are **byte-identical
by sha256** with both gated numbers unchanged. Gate 16's self-test non-vacuous; gates 12/15 green
and still fail loud on a corrupted subject; `lint`/`typecheck` rc=0.

**B1 (BLOCKING) — I planted a false amendment banner on ADR 0078, the authorization capability
model.** `**Amends:**` is the LAST label in an ADR preamble, so `build-adr-index.mjs` runs its value
to the **end of the preamble** — swallowing my ⛔ blockquote, whose text cites "ADR 0078". The
generator then wrote *"amended by 0196"* into 0078, telling every reader to distrust it. ⛔ **Gate 9
was GREEN throughout**, because the index agreed with the wrong parse, and it re-landed on every
`adr:index`. The sentence mis-parsed was the one promising 0196 *"does not move a single fact into a
different authority rank"*. Fixed by moving the blockquote below `## Context`; the generator's own
parser now yields `[{"verb":"amends","target":"0186"}]` and 0078's banner is clean.

**B2 (BLOCKING) — "742 KB became 732 KB" was arithmetic between two different units.** 742 kB
decimal vs gate 16's 732 KiB binary. The corpus **GREW: 742,255 → 749,842 B, +7,587 B (+1.02%)**.
⭐ I then explained the non-existent 10 KB delta causally ("the deleted ADR index minus twelve added
preambles") — the explanation is what made a unit error read as a measurement. Corrected in ADR 0196
with the superseded text quoted; the finding survives and is stronger than what I wrote.

**M1/M2 — two real holes in gate 16, both closed and both mutation-proven on the real corpus.**
⛔ Deleting a seam file left the gate at **rc=0 still printing "all routed"**: check B asked whether
every file was named, never whether every name existed — the classic one-directional check, and
`docs/backend-state/` is outside all three link-gated corpora so nothing else would have caught it.
⛔ **D2 had no enforcer at all** — a routed `phase-24-2026-09-20.md` passed green, so the decision the
whole design rests on was prose. Added **B2** (router targets exist) and **E** (a seam filename may
not contain a digit — a seam is a NOUN). M3: check B now requires a router row with a real
"when to open it" clause; that the clause names an *action* stays prose, and the ADR says so.

Gate 16 is now **six checks / 32 self-test arms**, and **all six** are mutation-run against the real
corpus, including both size arms (226.1 KB reds; 167.5 KB warns at rc=0 — a warn that reds gets
raised). ⚠ Widening check C's window from 3 lines to the marker's paragraph was forced by the gate
**catching my own m8 forward marker** as "names no target": a fixed window would have taught the next
author to shorten the explanation rather than name the target.

**M4 + minors.** `docs/quality-track-context.md` (live, CLAUDE.md-cited) dangled — fixed. m3: the
link count had two homes; it is **19 gate findings across 18 unique sites** and both numbers now say
what they count. m4: `lint-gates.md` claimed "all four" while naming three — the fourth was **run**
rather than the sentence trimmed. m5 gate-12 message clause restored · m7 `config.toml` line-number
citation repointed · m8 frozen text given a D5 forward marker instead of an edit · m9 `PROGRESS.md`
link *text* · m12 `[0]`-on-empty · m13 the router now states the measured truth (**57 of 67 sections,
85%, are still slice-coded; 7 of 11 seam files have no axis-free section** — I verified this myself
before writing it) · m14 the inherited "three…names two" is now flagged rather than reproduced
silently. m1/m2/m6 recorded as stated bounds in the gate header and the cwd follow-up.

⛔ **Two figures in the entry ABOVE are wrong and are corrected here, not edited there** (a session
log is append-only, ADR 0186 D3). (a) Its growth row *"119 KB (07-01) → 314 → 714 → 742"* mixed
decimal kB with KiB on an unstated day boundary and does not reproduce; the series is
**112.5 → 307.0 → 697.4 → 724.9 KiB** at `9fdd1114` · `598447e3` · `cb66dfa9` · `2b4fa89b`, taking
the last commit touching the file on or before 23:59 that day. (b) Its *"732 KB total"* gate line is
KiB and must not be read against the 742 kB decimal beside it — see B2 above.

⛔ **Dropped a claim rather than defend it:** the record's "220 added lines" was not reproducible
(QA measured 287/214 by its own instrument, and the corpus has moved since). `MISSING = 0` is the
load-bearing half and stands; the added-line count carried no weight and is gone.

**Gate runs after the fix round** — bare, not piped: `npm run lint` **rc=0**, `npm run typecheck`
**rc=0**, gate 16 self-test **32/32**, `git status` clean.

⛔ **Re-review owed.** The hub stays `gated`.

### 2026-09-09 (3) — EXTERNAL review: P0, the split broke 87 outbound links

⛔ **The headline finding, and it is mine.** Moving 6,353 lines from `docs/backend-state.md` (which
sits in `docs/`) into `docs/backend-state/` changed the base of every relative path inside them.
Every `decisions/…`, `plans/…`, `progress/…`, `reviews/…` and `design/…` target was copied unchanged
and dangled. Measured with the repo's own shared `checkLinks`, not a new instrument: **87 findings,
68 unique (file, target) pairs, and all 87 resolve by prepending `../`.**

⛔ **Three separate passes walked past it.** The split's own verification proved *content*
losslessness (`MISSING = 0`) and never asked whether the content still *pointed* anywhere. The
internal QA round went hunting specifically for holes in gate 16, found two real ones (M1, M2), and
still did not look outward. And gate 16 was green the entire time, because it validated router
destinations and marker filenames and nothing else. ⭐ **D10 — "a pointer that resolves nowhere is
worse than none" — was in the ADR the whole time; it was read as being about INBOUND citations to
the map and never turned around.** A move changes the base of every relative path in the moved file:
the reviewer of a move must look *outward from* it, not only *inward at* it.

**Fixed:** all 87 rebased. **Gated:** new check **F** hands this directory to gate 13's `checkLinks`
— **imported, never re-implemented**, so `docs/backend-state/` becomes the FOURTH corpus on the one
shared checker, which is exactly what `FUP-REGISTER-GATE-HYGIENE-LINK-CHECKING-HAS-NO-GATE-OUTSIDE-
THREE-CORPORA` asks for.

⚠ **The first mutation written to prove F fires DID NOT APPLY, and reported rc=0.** It un-rebased
`](../decisions/` in `printing.md`, a string that file does not contain — a vacuous test that reads
exactly like a passing one, and I nearly recorded "F does not fire" as a defect in F. Re-run against
the link the file actually has (`../progress/pdf-p3-reconciliation.md`): fires at `printing.md:236`.
Mutations here now assert the mutation applied before judging the result.

⚠ **Also caught: `git checkout -- <file>` to revert a mutation silently reverted that file's link
repairs too**, because the repairs were uncommitted. Baseline went red for a reason unrelated to the
mutation. Re-ran the repair; the lesson is that a rollback to HEAD is not a rollback to *baseline*
when baseline is uncommitted work.

**Two further hardenings taken while in here.** The `§ <n>` half of the supersession form is now
checked — `See notifications.md § 9999.` used to pass, and the mandated form in the router is now
`§ <heading>`, because validating what you mandate is the point. ⛔ The section check returns
UNDECIDED, not a finding, when it cannot read the target's text — a check that fires because it
could not look is a false positive wearing a verdict. And `main()` no longer runs on IMPORT, which
it did until a gate started importing another gate.

⭐ **One external finding is NOT a defect and is recorded as refuted, with evidence.** The
"malformed Markdown link" at `conventions.md:267` is
`` `app.is_pqs_member_of[_for](org[,uid])` `` — **inside a code span**, and CommonMark binds code
spans before links, so it renders as literal text. The repo's `checkLinks` blanks code spans by
design and has a self-test for exactly this (`check-docs-registers.mjs:2205`); it returns `[]` for
that string. The external checker did not blank code spans. That is why our count is 87 and theirs
88.

**Gate runs** — bare: `npm run lint` **rc=0**, `npm run typecheck` **rc=0**, gate 16 self-test
**39/39**, F and the section half both mutation-proven on the real corpus with the mutation asserted
to have applied.

⛔ **Still open, and NOT addressed here** — the review's P1/P2, which are design changes rather than
repairs: no seam has a replaceable current-state layer (57 of 67 sections are still slice-coded);
`data-access.md` names 170 of 533 public functions and omits 15 of 42 typed flags, hand-maintained
where the service-role and privilege-budget generators show the pattern; `stamp-history.md` (72 KB,
one 66,557-char line) is on the active retrieval path and holds unique facts; and gate 16 still does
not check registry completeness, duplicate facts across seams, per-section size, or the
historical/current-state ratio.
