# BACKEND-STATE-SERVICE-ROLE-SEAM — progress record

> Hub: [backend-state-service-role-seam.md](../features/backend-state-service-role-seam.md) ·
> governing decision: ADR [0196](../decisions/0196-backend-state-split-on-the-module-seam-axis.md)
> D4, applied by PO ruling of 2026-09-11 (register entry
> `FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE`). Branch:
> `backend-state-service-role-seam`, cut from `main` at `3c66efb6`.

Subjects: `docs/backend-state/authorization-and-audit.md` (the frozen slice
`## Service-role DML registry (AE1.4 …)` and the `## Current state` block above it),
`docs/backend-state/README.md` (the router), the new `docs/backend-state/service-role-dml.md`, and
`scripts/check-service-role-registry.mjs` (gate 11, which locates the registry by path + heading
regex). ⛔ No migration, no RLS, no `src/`.

## Session log

### 2026-09-11 — unit opened; review queue processed; nothing moved (lead)

**Why now.** The PO ruled the noun on 2026-09-11 and, in the next message, instructed the lead to
open the split unit. The tree was clean on `main` at `3c66efb6` (the rulings commit).

**Measured at open, not quoted.** Gate 16 (`node scripts/check-backend-state.mjs`, rc **0** bare):
`WARN — [D] docs/backend-state/authorization-and-audit.md — 160.4 KB is over the 160 KB warn line
(cap 200 KB)`; `wc -c` **164,204**; block at 97/100. The slice to move, by `awk` byte sum per `##`
heading: **40,694 B**, sub-headings Groups A–H + Summary, **13** outbound links (all
`../design/authz-ae1-rpc-rulings.md` — same directory depth in the new file, so they resolve
unchanged, ⚠ which is exactly why the check must be RUN and mutated rather than reasoned about).
Inbound: the file's own `## Current state` block names the section twice (bullets 17 and 34 of the
block, plus the § list at :89/:98); outside the directory only `docs/design/authz-ae1-rpc-rulings.md:8`
still links the pre-split `backend-state.md` (ADR 0105-exempt, per the split review). Gate 11 hard-codes
`DOC = docs/backend-state/authorization-and-audit.md` and `SECTION_RE = /^## Service-role DML registry\b/`
(`scripts/check-service-role-registry.mjs:62-64`) — ⇒ the unit is docs **plus one gate constant**.
Citations to re-point found by grep: `docs/lint-gates.md:25`,
`docs/followups/FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md:9`. `CONTEXT.md:359/374` cite the
file for the **privilege budget** — that noun stays.

**ADR number reserved: 0206**, measured as the highest on any live branch (`0205` on `main`; the
three `origin/*` feature branches carry none higher) + 1, skipping the reserved and unfillable
`0202` / `0204`. ⛔ Re-measure at the rebase stop before the file is created.

**CLAUDE.md review queue processed at open (Record step 7 debt, per-clone file).** Four entries
since the 2026-09-10 marker, dispositions:

| entry | signal | disposition |
|---|---|---|
| `c637a596` (4 bullets, Batch 10) | *stale* in quoted other-repo text; ADR 0200 "declare a tightening" prose; B-1 quoted back and verified; `Arm 1 guards: 7` in an audit front-matter | not a doc problem ×4 — the front-matter line now reads **13** (`docs/reviews/authz-writepath-audit-findings.md:12`), already regenerated (`docs/progress/writepath-baseline.md:694`) |
| `8544d35e` | `0202` absent, so §8's "highest + 1" yields a reserved number | not a CLAUDE.md defect — the rule is *necessary not sufficient*; plan reservations are the plan's, and every AE5 record since carries *never 0202 / never 0204* |
| `6809c28b` | a pre-rebase sha named in a QA review | the arm-3 unit's round-2 MINOR, already discharged (`5ffeed2c`) |
| `825e1912` (this lead, previous message) | *stale* in the PO's own task prompt | hook finding (ii) — the keyword fired on the instruction |

Outcome: **0 doc fixes**, processed marker prepended to the queue. No CLAUDE.md edit proposed.

**Homes written:** hub (`in_progress`, block at open), this record, `docs/features/INDEX.md`
regenerated. Gate 13 run bare after the writes; rc in the commit message.

### 2026-09-11 — the split built: slice moved verbatim, gate 11 followed it, link check mutated (backend)

**Baselines, re-measured at this session and not quoted from the ruling.** Gate 16
(`node scripts/check-backend-state.mjs`, rc **0** bare):
`WARN — [D] docs/backend-state/authorization-and-audit.md — 160.4 KB is over the 160 KB warn line
(cap 200 KB)`, and its headroom line named `authorization-and-audit.md (97, 3 left)`; `wc -c`
**164,204**, `wc -l` **1,443**; `state layer — 11 domain seam(s)`, `15 seam file(s) + README.md`.
The slice by `awk` byte sum per `##` heading: **40,694 B** — the largest heading in the file, ahead
of the privilege budget (18,091), the `authz` catalog (13,492) and quality-office oversight
(11,393 for its largest of three). Extracted as lines **362–584** it is **223 lines / 40,693 B**;
the 1-byte delta is the trailing blank line the `awk` sum attributes to the heading, not a
discrepancy. Outbound links in the slice, enumerated not eyeballed
(`grep -oE '\]\([^)]+\)' | sort | uniq -c`): **13, all** `](../design/authz-ae1-rpc-rulings.md)` —
same directory depth in the new file, so they resolve unchanged, which is exactly why the check was
RUN and MUTATED rather than reasoned about. Gate 11 before, from its own output:
`Service-role DML registry: OK -- 45 derived site(s) == 45 registry row(s) (census 40 + callDoor() 5).`
rc **0**.

**⚠ A frozen inconsistency travelled with the slice, unfixed, deliberately.** The Summary paragraph
says **44/44** and its family totals sum to 44, while the table carries **45** `Key`-bearing rows
(`grep -c '^| \`'`) and gate 11 parses 45. The surplus is in Group D: its heading says *8 sites* and
it lists **9** rows, because `assignOrgAdmin` calls `grant_role_for` twice (org tier + single-hospital
auto-seat) — the legitimate multiset duplicate the gate's own header paragraph describes. ⛔ Not
repaired here: the slice is frozen (ADR 0196 D5) and it already carries its own instruction to
*"re-derive this paragraph from the rows whenever the table changes — never adjust the numbers
arithmetically"*. What the new file's block does instead is point at gate 11's output as the live
count and warn against quoting the tally.

**The move.** `docs/backend-state/service-role-dml.md` built by CONCATENATION, never by retyping:
`title` (a Write-tool H1) + the preamble **extracted** with `sed -n '3,5p'` from
`authorization-and-audit.md` (300 B; `diff` against `notifications.md`'s same region rc **0**, so
check A/C pass by construction) + a `## Current state` block printed by
`node scripts/check-backend-state.mjs --scaffold` and filled from the slice's own sentences + the
slice. Result **316 lines / 47,349 B**, `grep -c $'\r'` = **0**.

**Verbatim, proved by diff and not by eye.** `git show main:docs/backend-state/authorization-and-audit.md
| sed -n '362,584p'` against `sed -n '94,316p' docs/backend-state/service-role-dml.md`: **empty
output, rc 0** read bare.

**The old file.** The heading `## Service-role DML registry (AE1.4; …)` stays as a stub with the
rule-2 forward marker directly under it, naming both the FILE and the HEADING (gate 16 check C
validates both halves since 2026-09-09; `§ 9999` used to pass). Its `## Current state` block was
re-cut: the Surface bullet became a two-line pointer, the Invariants bullet was **deleted whole**
rather than shortened (every clause in it was a bound — *"None found in TS" is not "unaudited"*,
`door: X` is a NAME, the census under-counts BY DESIGN — and README rule 4 says delete-and-point
rather than maim), the Open-edges sentence about `NONE`/`UNCONFIRMED` rows left with the noun, and
§ Where the detail lives now marks the entry as a stub and links the new seam. Each of those bounds
is restated in the NEW file's block, above the frozen text that carries it — the bounds relocated,
they were not compressed away. `**Updated:**` already read 2026-09-11 and stayed. Block **97 → 90
lines** by the gate's own `stateBlockOf` accounting; file **164,204 → 123,224 B**.

**Gate 11 travelled in the same commit**, all three sites: `DOC` (line 62), the header comment
(line 6) and the remediation text the failure path prints (line ~464). ⛔
`FUP-BACKEND-STATE-SPLIT-GATE-12-RESOLVES-FROM-CWD`'s subject (`ROOT = process.cwd()`) untouched.
After: `Service-role DML registry: OK -- 45 derived site(s) == 45 registry row(s) (census 40 +
callDoor() 5).` rc **0** — byte-identical to the baseline line, which is the claim. The one
surviving `authorization-and-audit` mention in that script is the history comment I wrote, which is
a dated statement and correct as such.

**Router.** A row for `service-role-dml.md` ("touch a service-role write — a `createAdminClient()`
call site, the `callDoor()` wrapper, or any row gate 11 diffs"); *a service-role write* removed from
the `authorization-and-audit.md` row. § The seam axis's arithmetic **re-measured from the directory
listing, and what was counted is now stated in the sentence**: `ls docs/backend-state/*.md` = **17**,
minus `README.md`, minus the **4** `generated-*.md` exemptions the gate prints on every run = **12**
files that owe a `## Current state` block — 8 domain-mapped + 4 cross-cutting. `service-role-dml` is
filed **cross-cutting**, and the sentence says why the word means something different for it: it
enumerates ONE property across the domains rather than binding them all. The sentence read
*"Eight … eleven … three"*; both prior corrections are kept in place.

**Citations.** Sweep run: `grep -rn "authorization-and-audit" --include=*.md --include=*.mjs
--include=*.sh --include=*.json . | grep -v node_modules`, then filtered to the lines that name the
REGISTRY. Two are pointers and were re-pointed (ADR 0196 D10): `docs/lint-gates.md:25` (now names
`service-role-dml.md` and records the former home for the dated records that still cite it) and
`docs/followups/FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md:9` (its link text still said
`../backend-state.md` from the pre-split era — fixed too). ⛔ **Left alone as historical claims:**
`docs/reviews/backend-state-split-review.md:92/169/411` (a dated review of the 2026-09-09 split),
`docs/plans/authz-evolution.md:319` (the AE1.4 instruction as written, which already said *"or a
dedicated file"*), `docs/followups/follow-ups-open.md:1959` and the ruling body, the AE-era progress
records, and this unit's own hub/record. **`CONTEXT.md:359` and `:374` stay**: they cite the file for
the **privilege budget**, and that noun did not move — gate 15 confirms, still resolving its anchor
at `docs/backend-state/authorization-and-audit.md:168`.

**The link check RUN and PROVEN ABLE TO FAIL (LEARN-090).** Green first: gate 16 rc **0**, no `[D]`,
no findings. Then one link *inside the moved slice* mutated —
`[rulings §9](../design/authz-ae1-rpc-rulings.md)` → `…-MUTATED.md`, chosen because `rulings §9`
occurs exactly once. ⚠ **The mutation asserted itself applied before the gate ran** (the 2026-09-09
attempt at this proof edited a link the file did not contain and reported rc 0 — a vacuous test that
read like a passing one): `grep -c` = **1** and `git diff --stat` = *1 insertion, 1 deletion*. Gate
16 then: rc **1**, `backend-state gate: FAILED`,
`[LINKS] docs/backend-state/service-role-dml.md:236 — link ../design/authz-ae1-rpc-rulings-MUTATED.md
does not resolve`. ⚠ The finding is labelled `[LINKS]`, not `[F]` — check F is gate 13's `checkLinks`
imported, never re-implemented, and it keeps its own label. Restored with `git checkout --`
(possible because the move was committed first): `grep -c MUTATED` = **0**, `git status` clean, gate
16 rc **0** again. Both readings bare.

**ADR 0206** — `docs/decisions/0206-the-service-role-dml-registry-gets-its-own-seam.md`. Number
**re-measured at reservation, not inherited**: highest on ANY live ref by
`git for-each-ref refs/heads refs/remotes` + `git ls-tree` over `docs/decisions/` across all five
refs (`main`, this branch, `origin/{main,authz-ae5-matrix-arm3-cells,authz-c2-tier1,authz-enforcement-manifest}`)
= **0205**, +1 = **0206**; `0202`/`0204` are reserved and unfillable and were skipped, not counted.
`**Amends:** 0196` (D1 gains a twelfth hand-written seam; D4's remedy applied for the first time).
`npm run adr:index` rebuilt the index and the generated back-pointer on 0196 (its only diff);
`build-adr-index: OK (202 ADRs indexed, next free 0207)`.

**Gate, every rc read bare, never through a pipe.** `npm run lint` → **rc 0**, all 17 gates, eslint
at 0 errors / 0 warnings. Inside it: gate 11 `45 == 45`; gate 13
`check-docs-registers: OK (… 451 md files scanned for retired citations)` + `build-features-index:
OK (24 hubs; index in sync)`; gate 15 `budget-anchor gate: OK — …authorization-and-audit.md:168
ceiling=759`; gate 16 `OK — 16 seam file(s) + README.md, all routed, preamble identical, 1066 KB
total, largest authorization-and-audit.md at 120.3 KB (warn 160 KB / cap 200 KB)` with **no `[D]`
line** and `12 domain seam(s)`. `npm run typecheck` → **rc 0**. `git diff --stat main -- supabase/
migrations src` → **no output**, rc 0. ⛔ **`test:db` and `e2e:prod` are NOT owed and were NOT run**:
this unit adds no migration, no RLS, no `src/` change and no UI — the empty pathspec diff above is
that claim's evidence. Nothing was run against the remote; no `supabase db reset` was issued.

**Dead ends / things not done.** (i) The block for the new file was first drafted with a Rollout
bullet naming *"AE1.3 HAS LANDED"*; dropped the verb — check H's `DEPLOY_VERDICT` regex catches
`\bPUSHED\b` and the neighbouring shape is exactly the deployment claim README rule 8 bans, so the
bullet was rewritten to describe the flagless PATTERN instead. (ii) `sed -i` was not used anywhere;
the two whole-file rewrites went through `head`/`tail`/`cat` with the diff as the check, and every
targeted change through the Edit tool. (iii) The follow-up is **not closed here** — the lead closes
it at the Record step after QA; a `**Landed (pending QA)**` line naming the branch and the unit was
added to its body, with the sha left for the lead (a commit cannot cite its own sha).

### 2026-09-11 — gate re-run at the tip by the lead; QA review APPROVED, zero findings (lead)

**Gate at `f2af1940`, run by the lead, not the builder, every rc bare on its own line.** `git status`
clean; `main..HEAD` = 4 commits (`e7c34683` open · `3ccf6ffe` ADR · `f101d17e` move · `f2af1940`
record). `npm run lint` **rc 0** (output redirected to the scratchpad, only the gate lines read):
gate 11 `OK -- 45 derived site(s) == 45 registry row(s)`; gate 16 `OK — 16 seam file(s) + README.md,
all routed, preamble identical, … largest authorization-and-audit.md at 120.3 KB` with **no `[D]`
line**. `npm run typecheck` **rc 0**. `git diff --stat main -- supabase/migrations src` printed
nothing. Verbatim move re-proved independently: `main` lines 362–584 vs the new file's 94–316,
`diff` **rc 0**; `wc -c` 123,224 / 47,349. Every changed file `grep -c $'\r'` = 0. The stub marker
sits directly under the retained heading and names file **and** heading (read at `:355-360`).

**QA review** (`qa`, read-only): `docs/reviews/backend-state-service-role-seam-review.md` —
**APPROVED, 0 findings** (no MAJOR / MINOR / NOTE survived). Each hub claim reproduced by command:
slice boundaries exact, 20 frozen headings preserved, six block bullets traced to source sentences,
gate 11 diff confined to path / comment / help text with `ROOT` untouched, seam-axis arithmetic
re-derived from the listing (17 − 1 − 4 = 12), citation sweep judged hit by hit, ADR 0206 numbered
against all five live refs, the 44-vs-45 tally confirmed pre-existing on `main`. Its could-not-verify
list: the 2026-09-09 vacuous-mutation anecdote and a few exact byte counts, superseded by coarser
checks that found no discrepancy.

**State:** hub → `gated`, review linked. Awaiting **human approval** (Phase Gate step 4). Owed at the
Record step: close `FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE` in both homes and fill
the sha into its `**Landed**` line; ledger row; hub → `complete` with the block cut here; ff-merge to
`main`; ⛔ no push.

### 2026-09-11 — RECORD STEP on the PO's approval (*"approved — run the Record step, merge to main, no push"*) (lead)

**Approval scope, written down:** the PO approved the unit as gated at `83d05708` — the five commits
above `main` at `3c66efb6` — and instructed the Record step, a merge to `main`, and no push.

**Playbook §4, step by step.** (1) Ledger row appended to `docs/progress/phase-ledger.md`; its Commit
cell is filled after the fast-forward, in the docs commit that records the merge. (2) The follow-up
`FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE` **closed in both homes**: the register
entry moved VERBATIM to `docs/followups/follow-ups-archive.md` under a `✅ RESOLVED 2026-09-11`
heading with a `>` note quoting the clause it closed on, its body file folded in beneath a `####`
heading naming the same id (rule 7) after the lead filled the closing sha (`f101d17e`, the move
commit) into its `**Landed**` line; the register entry and the body file then deleted, the three
field lines `cmp`-verified at the destination first (gate 7's order). No bug to flip. (3) No task
detail to archive beyond this record. (4) **No seam slice owed**: the unit changed the map's
STRUCTURE, not the backend surface — the change is carried by the seam files themselves (the stub
marker in `authorization-and-audit.md`, the new file's block, the router row) and by ADR 0206; a
dated slice saying "this file moved" would be a phase-named statement in a seam file, which D2
forbids. (5) `npm run adr:index` was run at the ADR commit; `**Amends:** 0196` present in the
header and 0196's generated back-pointer landed in `3ccf6ffe`. (6) `lint:progress` and
`lint:registers` run bare after these edits; the phase commit follows. (7) Review queue: the four
entries were processed at open; no entry has been added since (count re-read at this step). (8)
**Rulings reconciled against artefacts:** the PO's single ruling — *the service-role DML registry
leaves* — is landed in ADR 0206 § Decision, in the README router row, in the register clause
(archived verbatim), and in gate 11's `DOC` constant; none of those is a log. (9) Both homes of
the follow-up edited (register + body), then both archived. (10) Sets named, not sized: the
re-pointed citations are `docs/lint-gates.md` and
`docs/followups/FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md`; the historical claims left
alone are listed in the build entry above. (11) The hub's block is cut here as the last edit.

### Current state at close (cut from the hub on completion, 2026-09-11)

#### Objective
Move the service-role DML registry out of `authorization-and-audit.md` into its own routed seam
file, take gate 11 with it, leave a forward pointer behind, and prove the move by gates run bare
rather than by eye.

#### Done since start
The frozen slice moved to `docs/backend-state/service-role-dml.md` **verbatim** (region diff rc 0);
preamble byte-identical by construction; `## Current state` scaffolded and filled from the slice's
own sentences. The old file keeps the heading as a stub with a rule-2 forward marker naming file
**and** heading; its block re-cut shorter with the registry bounds relocated, not compressed. Gate
11 moved in the same commit at all three sites and parses the same row count. Router row added,
seam-axis arithmetic re-measured from the listing. Two pointers re-pointed, historical claims left,
`CONTEXT.md`'s privilege-budget citations untouched. ADR 0206 (`**Amends:** 0196`), index rebuilt.
Gate re-run at the tip by the lead: lint rc 0, typecheck rc 0, empty pathspec diff, gate 16 with no
`[D]` line at 120.3 KB, gate 11 `45 == 45`. QA **APPROVED, 0 findings**. PO approved 2026-09-11;
the follow-up closed in both homes; ff-merged to `main`; ⛔ **not pushed**.

#### In progress
Nothing — the unit is closed.

#### Next
Owned by others: the frozen 44-vs-45 tally inside the moved slice stays frozen (ADR 0196 D5) and is
read through gate 11's output, never quoted; the remaining seam-size headroom is gate 16's to
report. The next AE5 increment appends to `authorization-and-audit.md` with ~40 KB of headroom
regained.

#### Blockers
None.

### 2026-09-11 — ⚠ the phase commit landed with gate 9 RED; found one command later, fixed in the next commit (lead)

**What happened.** The phase commit `5fb5c055` was gated on `lint:registers` and `lint:progress`
(both rc 0) — and `lint:adr-index` (gate 9) was RUN in the same command, printed **rc 1**, and was
**not consumed by the guard**: the `if` keyed on two of the three codes. That is the shape memory
already names — *reading a gate is not gating on it*. The finding was real and this unit's own:
ADR 0206 line 29 linked the follow-up's **body file**, which the Record step had just deleted after
folding it into the archive. A pointer, not a historical claim (ADR 0196 D10) — re-pointed at
`docs/followups/follow-ups-archive.md` with a clause saying why. A grep for the deleted filename
across `*.md`/`*.mjs` found no other LINK (the QA review mentions it in a code span, which is a
mention, not a link). ⛔ Not amended: the sha was already written into this record.

**Re-run after the fix**, full chain, bare: `npm run lint` rc and `lint:adr-index` rc are in the fix
commit's message.

### 2026-09-11 — merged: `main` fast-forwarded to `94d52cb5` (written on `main`) (lead)

`git merge --ff-only backend-state-service-role-seam` on `main` (was `3c66efb6`): fast-forward, **no
merge commit** — `main` = `94d52cb5`, the ADR re-point fix, one above the phase commit **`5fb5c055`**;
`git merge-base --is-ancestor 5fb5c055 main` **rc 0**, read bare. Working tree empty before and
after. Local branch deleted with `-d` (rc 0 — never pushed, so nothing upstream to disagree).
Measured at the time of writing: `origin/main..main` = **36** commits, ⛔ **not pushed** (the PO's
instruction). Ledger row's Commit cell filled with `5fb5c055` in this same docs commit.
