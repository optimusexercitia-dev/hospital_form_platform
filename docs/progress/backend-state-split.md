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

### 2026-09-09 (4) — the stamp chain leaves the retrieval path (ADR 0199)

**Why this ran.** Entry (3) closed with `stamp-history.md` named as an open item: *"on the active
retrieval path and holds unique facts"*. An external QA finding put the same thing more sharply — the
reason it was kept (ADR 0196 D9: it holds facts appearing nowhere else) **is itself the defect**, because
a current fact whose only home is a frozen archive is a locality failure.

**Figures re-derived, not accepted.** `72,441` bytes, longest line **66,653 chars / 67,456 bytes**, 9.6%
of the directory, 60 lines, **38 stamps**. ⚠ The finding said 72,345 B / 66,557 chars and **was right for
`aa8eac1a`**, the split commit; `659e1bb1` (the 87-link repair) added 96 bytes to line 59 hours later. Not
an error — a demonstration of why a figure carries its query. Prior records inherited a third figure,
`67,360`, which is line 59's BYTE length at the split mislabelled as characters (ADR 0196 Context, and the
review at `backend-state-split-review.md:488`).

**Method — derived, never eyeballed.** The 66,653-char line cannot be read. Flattened the blockquote to
one stream, split it on the chain's own delimiters (`Last updated:` / `Previous:` / `prior:` / `Earlier:`,
excluding inline dates — a naive date split over-segmented at 43, the true count is 38), then tested every
backticked identifier against all 11 seam files. **1,049 tokens, 910 distinct, 328 distinct absent from
every seam.** Three parallel read-only agents then judged CLAIM-level presence per stamp, because a token
can be present while its qualifier is not — `verify_audit_chain` appears in the seams three times and its
deliberate-exception sentence appears zero.

**Catalog verification.** Local stack already up; **no `db reset`** (shared local stack, two sibling P1
branches live). Snapshotted `pg_proc`/`pg_tables`/`pg_policies`/columns/`schema_migrations` at migration
`20261003007350` and classified all 328. ⛔ **The first snapshot omitted indexes, constraints and triggers,
which produced two FALSE stale verdicts** — `memberships_title_idx` and
`responses_one_successor_per_superseded` both exist as indexes. Caught by re-querying the complete catalog
before writing anything; both verdicts withdrawn. A classifier is only sound for object classes its
snapshot can see.

**What was found.** D9's example list is wrong in both directions. `hospital_indicator_rollup`'s lost
`is_admin` arm — one of its three named facts — is fully documented at `data-access.md:129` and was never
chain-only. The real set is ~150 claims, of which **six contradict a posted seam section, the seam being
wrong in all six**, verified: no `dashboard_*` carries `is_admin` (9 checked, and ⚠ the chain's own "all
nine carry `is_staff_admin_of OR is_tenancy_admin_of`" is ALSO wrong — six do, three are staff-admin-only);
`can_read_case_or_admin` does not exist while a posted line calls it mandatory; `allowed_result_ids`
dropped; `submitted_form_responses` does carry the successor-exclusion; `mint_event_code` is per-hospital;
`supersedes_id` exists.

**Negative claims shipped with controls**, so an empty result is distinguishable from a dead instrument:
`is_nsp_org_admin_of` in PHI doors 0 / 11 overall; `member_can` in `cases`/`case_phases` policies 0 / 3
elsewhere; `title_id` in policies 0, in authz predicates 0 / 7 procedures overall.

**Gate proof.** Gate 16 check C mutation-run on the new markers, **both arms** — bogus heading and bogus
file — each red, then reverted to green. Run only after committing, since `git checkout --` would have
taken uncommitted work with it.

**Two pre-existing worktree artifacts fixed to reach a green baseline, neither caused by this work.**
(1) **98 markdown files carried CRLF** while their blobs are LF — content-identical, `git status` clean
because `text eol=lf` normalises on read, and it red gates 7 and 8. Exactly the failure gate 8's own
message describes. Normalised the 97 remaining + `CLAUDE.md`; `git diff` empty afterwards. (2) `npm run
typecheck` failed on `RouteContext` in two route files: `tsconfig.json` includes `.next/types/**/*.ts` and
this worktree had never been built. `npx next typegen` (not a full build) fixed it.

**Outcome.** Directory 734 KB → **669 KB**, 11 seams + router, largest 119.7 KB against a 160 KB warn.
Chain → `docs/progress/backend-state-stamp-history-archive.md`, header rewritten to read as history and its
two `README.md` links repointed; every other link is `../` and rebased to nothing. Router row and file moved
in ONE commit (check B2). README's own arithmetic — *"Seven of these eleven … four"*, summing to 11 while
the directory held 12 — corrected as a side effect. `npm run lint` rc=0, `npm run typecheck` rc=0, bare.

**Left undone, deliberately.** The four tracks with no owning seam section (S1·SUP, S1·MEM, f-cleanup,
nsp-per-hospital Phase B) are filed as a follow-up, not reconstructed here: their end states already reached
the seams via later work, and the sources for *when and by what* are the migration files and
`schema_migrations`, not a frozen archive. `conventions.md` has a bounded ledger hole — **16 of 16**
migrations applied between `20260719000000` and `20260720000600` are absent from it.

⚠ **Merge note.** The sibling `backend-state-current-state` branch (ADR 0198) adds an in-place
`⛔ **ARCHIVE**` block to `stamp-history.md` and a gate-16 check-G exemption for it. That subject no longer
exists in the directory; whoever merges second drops the exemption and the block rather than restoring the
file. ADR numbering: 0197 and 0198 are taken on the two sibling branches, so this took **0199** —
highest-on-any-branch + 1, not the index's next free.

### 2026-09-09 (4) — reconciling the three P1 branches into one

Three P1 units ran in parallel off `e4ac95e5`. Two landed on this branch —
**ADR 0197** (`data-access-generation`, the four generated registries) and **ADR 0198**
(`backend-state-current-state`, the replaceable state layer). The third, **ADR 0199**
(stamp-chain retirement), ran in the worktree `claude/adoring-ellis-baa4e4` and is merged here.

⭐ **ADR numbering held across three parallel branches** — 0197 / 0198 / 0199, no collision. That is
the failure this repo has hit twice before (0183, and the rule in CLAUDE.md §8 exists because of
it); recorded as a pass, not assumed.

**Conflicts, and how each was resolved by INTENT rather than by side:**

- `README.md` — both rewrote the router table. Kept this branch's four `generated-*` rows and its
  re-scoped `data-access.md` row ("what a door is FOR"), dropped its `stamp-history.md` row, and
  kept the worktree's ⛔ block explaining where the chain went. The worktree's `data-access.md` row
  was the pre-0197 wording and was discarded as stale, not as losing.
- `data-access.md` — both sides appended `⚠ **Superseded**` markers at the same two anchors. **Both
  kept.** This branch's say the inventory is now derived; the worktree's are factual corrections
  extracted from the chain (the Phase 8 dashboard gate, `allowed_result_ids`,
  `app.submitted_form_responses`'s SUP exclusion, `mint_event_code`'s per-hospital lock,
  `app.can_read_case_or_admin` no longer existing). ⛔ Taking either side alone would have silently
  dropped real corrections — the merge-undoes-a-repair shape, avoided by reading both.
- ADR 0196's back-pointer block and `decisions/INDEX.md` — both GENERATED. Resolved by regenerating:
  0196 now correctly reads "amended by 0197, 0198, 0199".

**Verified mid-merge, before committing** (a clean auto-merge is not evidence): the chain is gone
from the seam directory and archived at 73,570 B; **7** seam files carry
`## Extracted from the pre-split stamp chain`; **4** generated registries present; **11** domain
seams carry a `## Current state`; the record carries both stories.

⛔ **LEARN-090 recurred, in the other direction.** Moving `stamp-history.md` from
`docs/backend-state/` to `docs/progress/` left one intra-directory link — `[README.md](README.md)` —
pointing at a `README.md` that does not exist beside it. Gate 7 caught it, because `docs/progress/`
IS in its link corpus. Repaired to `../backend-state/README.md`. The worktree rebased the other 30+
links correctly; a move leaves exactly the links that were relative to the OLD directory.

⚠ **Ratchet breach, and two wrong instruments before the right one.** `longHeadings` went 97 → 98:
the worktree's new follow-up heading is 188 chars. My first measurement reported it as **55 and
"ok"** — a non-greedy `^### .*?(FUP-[A-Z0-9-]+)` truncated the heading at the id, so the instrument
answered a different question and reported clean. My second stripped the emoji, which the gate does
not (`checkFollowupEntryShape` strips only `### `), and 🟡 is **2** UTF-16 units in JS `.length`
against 1 code point in Python — so a heading I measured at 159 was 162 to the gate. Fixed by
measuring in node with the gate's own rule: now 157. ⛔ The heading kept all four track names; only
the duplicated `(owner: backend)` and padding were cut, because compressing to fit a cap must not
select against qualifiers.

**Gate runs after reconciliation** — bare: `npm run lint` **rc=0** (`longHeadings=97/97`, at the cap,
not over), `npm run typecheck` **rc=0**, gate 16 **rc=0** — 15 seam files + router, 1018 KB, largest
`authorization-and-audit.md` at 128.7 KB against the 160 KB warn.

### 2026-09-09 (5) — P2: the preamble tax, a bulk cap, and two properties left ungated on purpose

**The duplicated preamble is gone.** The external review costed it at 11,640 bytes across twelve
files; by the time I got to it the directory had fifteen, so it was **14,550 bytes** — the cost
scales with every seam added, which is the argument. Replaced with a **3-line pointer** (970 → 299
bytes per file, **10,065 bytes recovered**). ⛔ Before cutting, every rule the preamble carried was
verified still present in `README.md § Maintenance rules` — map-not-authority, the live catalog,
`prosecdef`, "not the migration files", EXTENDS-its-seam-file, frozen, the marker form. This was
de-duplication, not deletion. Check A still enforces byte-identity of whatever the shared preamble
is, so the pointer cannot drift either.

**New check K — BULK.** Check D bounds a FILE and is silent on the shape inside one, and the
predecessor's worst artefact was never a big file: it was a single **66,557-character line**, living
in a file that was under cap the whole time, unreadable in any editor or diff. K caps lines at
**8,000** anywhere and hand-written sections at **450** lines. Generated seams are exempt from the
SECTION cap — their size is a property of their source, and check J already proves their currency —
but never from the LINE cap, where a giant line is a generator bug rather than a large table.

⚠ **Both caps sit ABOVE today's measured maxima** (longest line 6,798 in `conventions.md`; largest
hand-written section 394 in `printing.md`), deliberately: K is a ceiling against the pathological
case, not a style rule, and nothing already posted has to be reflowed. ⛔ **The consequence is that
nothing in the tree exercises K, so the self-test and the real-corpus mutation are its ONLY
evidence.** Six self-test arms (each paired with a silent half, including that a generated file is
exempt from the section cap but NOT from the line cap), plus a live mutation planting a
**66,557-character line** — the predecessor's actual defect — and a **502-line** section. Both fired;
baseline green after rollback. Each mutation asserts it applied before the result is judged.

⛔ **Two P2 properties are NOT gated, and the measurement is the reason.** The review asked for
duplicate-fact and content-belongs-to-seam checks. Measured over this corpus first:

| candidate key | distinct | in >1 seam | |
|---|---:|---:|---|
| migration ids | 186 | **33 (18%)** | legitimate — one migration touches several seams |
| pgTAP suite refs | 117 | **18 (15%)** | same |
| `##` section headings | 76 | **3 (4%)** | all three STRUCTURAL by design |

The three duplicate headings are `## Current state`, `## Extracted from the pre-split stamp chain`
and `## The generated function registry` — so a heading-keyed check enforces nothing once they are
allowlisted, and the other two keys fire constantly and are *right* to. A detector that finds a lot
needs proving as much as one that finds nothing; this one would be disabled within a week, which is
worse than not having it. "Content belongs to its seam" is not mechanically decidable at all.
**Both are written into the gate header as stated bounds**, so a green run is never read as coverage.

**Gate runs** — bare: `npm run lint` **rc=0**, `npm run typecheck` **rc=0**, gate 16 self-test
**90 arms** (the count is derived from the arm counter, not a literal — a P1 session fixed that),
directory now **1008 KB** across 15 seam files + router, largest `authorization-and-audit.md` at
**128.1 KB** against the 160 KB warn.
