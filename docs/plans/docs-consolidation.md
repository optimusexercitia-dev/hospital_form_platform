# Documentation consolidation after ADR 0185 — implementation plan

- **Written:** 2026-09-03, from the read-only audit of the ADR 0185 restructure (audit findings
  are summarized in § 1; the measurements were taken at commit `8e0ecd1a`).
- **Status:** IN PROGRESS since 2026-09-03 on branch `docs-consolidation`. Live state is the
  hub, `docs/features/docs-consolidation.md`, never this file.
- **Decision record:** ADR [0186](../decisions/0186-documentation-consolidation-one-home-per-fact.md)
  (proposed; numbered by CLAUDE.md §8's rule, highest on any live branch + 1). It **amends**
  ADR 0185 D2 (CURRENT.md, handoffs, record timing), D5 (register shape), D6 (roll-up, contract
  file), D8 (contract file) and ADR 0179 (body location). Everything else in 0185 stands.

## 1. What the audit found, in one table

| Class | Measured 2026-09-03 |
|---|---|
| Same fact, many homes | "PROGRESS.md is live-state only" in 12 places; "where bugs / FUPs live" in 6; ADR-numbering rule in 5, contradictory; the 13-gate list in CLAUDE.md three sentences before "never re-list it" |
| Hub frontmatter projected | 3 times: `features/INDEX.md` (generated), PROGRESS.md roll-up (generated, subset, own gate arm), `planning/CURRENT.md` (hand-written, gated both ways) — plus DLB as a hand-written phase row |
| Unit state | hub `## Current state` **and** a handoff, same three questions, verbatim pairs; AE4's progress record holds two "`§ Now` snapshot" sections as cap overflow |
| Stale one day in | lead-playbook §5 describes the abolished PROGRESS.md; all 4 `.claude/agents/*.md` say "read `§ Now`"; the handoff skill routes bugs and status to PROGRESS.md; 25 living files cite `PROGRESS.md § Now` |
| Gates | 11 of gate 13's 74 checks have zero subjects; `complete` is mention-grade; `broad: >-` satisfies the breadth waiver; two link checkers, two resolved-heading regexes; ~70 tombstone comment lines |
| Registers | open FUP register 738 KB, 89 % prose, median entry 39 lines, 123 duplicated "Register line" paragraphs, 27 parked entries in the open file, 29 id-less backlog items; BUGS.md 159/161 rows with no body link; LESSONS.md 48/72 prose-only, 0 postmortems |
| CLAUDE.md | 37.7 KB into every spawn (grew 2 KB during the restructure); 13 % about itself, 34 % about the docs apparatus |

## 2. Goal, non-goals, acceptance

**Goal.** One home per fact. One state document per unit. Gates that can red on the live
population, not only on their fixtures. CLAUDE.md at or under 20 KB.

**Non-goals.** No root tracker moves (0185 D8 stands). No product code. No invented PO rulings —
the `PO to rule` lists stay the PO's; this plan only stops them growing.

**Acceptance criteria** (each measurable; the hub carries the before/after numbers):

- [ ] `CLAUDE.md` ≤ 20,480 bytes; zero change-log annotations ("this line said", "measured
      YYYY-MM-DD", "rotated here") — checked by the byte cap and a grep recorded in the hub.
- [ ] Zero citations of a retired PROGRESS.md section in living files — **gated** (new arm, § 5
      Wave 1).
- [ ] Hub frontmatter has exactly one projection, `docs/features/INDEX.md`. CURRENT.md and the
      PROGRESS.md roll-up do not exist; their gate arms are deleted, not disabled.
- [ ] Every `in_progress` / `gated` hub links a progress record with a `## Session log` —
      **gated**. Zero handoffs for landed units; the handoff template holds only the resume
      pointer, trust, tree and next command; a handoff with no `branch:` carries `expires:` and
      the gate reds past it.
- [ ] `follow-ups-open.md` ≤ 120 KB; every entry ≤ 20 lines; zero `**Register line**`
      paragraphs; zero `##` / `####` headings inside entries; zero parked entries outside the
      parked status — all **gated**.
- [ ] `PO to rule` and `per emoji at consolidation` counts cannot increase — **ratcheted**.
- [ ] The two link checkers and the two resolved-heading regexes are one each.
- [ ] A status change for one unit touches ≤ 3 hand-written files (hub; PROGRESS.md row only if
      the unit is a phase; ledger only at completion).
- [ ] Read-only review, `docs/reviews/docs-consolidation-review.md`, answers: does every cut
      leave one canonical home, and can every new check red on a live subject.

## 3. Where a unit's state lives

A feature that spans sessions has four kinds of state, and each has exactly one home. The
audit's worst overlaps came from two homes answering the same question; this table is the rule
the waves enforce.

| Layer | File | Holds | Read when |
|---|---|---|---|
| **Summary** | `docs/features/<code>.md` § Current state | Objective · done since start · in progress · next · blockers. ≤ 60 lines, **replaced** every session | First, by every session on the unit |
| **Detail** | `docs/progress/<code>.md` § Session log | One dated `### YYYY-MM-DD` subsection per session, **appended**: what was verified and its witness (command, SHA, file:line), gate runs with exit codes, dead ends, decisions made in flight (then promoted to an ADR), open questions | Second, when the summary is not enough |
| **Resume** | `docs/handoffs/<code>-<date>.md` | Only when a session pauses mid-task: the resume pointer, trust level, tree state, the next command. Nothing else | Once, by the resuming session; deleted on resume or at landing |
| **Approach** | `docs/plans/<feature>.md` | How, never status | Before starting |
| **Outbound** | ADRs · `follow-ups-open.md` · `BUGS.md` · `backend-state.md` | Anything that outlives the unit | On demand |

**Hub or record — the rule of thumb.** A line carrying a *state word* (done, in progress,
blocked, next) is hub. A line carrying a *witness* (a command, a SHA, a file:line, an exit
code) is record. The hub answers "where are we"; the record answers "how do we know" and "what
did we try". History never lives in the hub: when a Blockers item resolves, the hub line is
deleted and the record's dated section says how.

**Why the record and not the handoff.** Witnesses are evidence worth keeping; handoffs are
ephemeral by rule ("a handoff may not be cited") and deleted at landing. **Why the record and
not the hub:** the 60-line cap is what keeps the summary a summary. AE4's record already holds
two "state snapshot" sections because the cap forced detail somewhere; the plan makes that the
design instead of the overflow (Wave 3).

**Parallel sessions on one unit.** One unit, one branch, one hub. The lead owns the hub block
and teammates report into it (the lead-playbook rule for § Phase Status, applied to the hub);
each teammate appends its own dated subsection to the record. The hub's Updated-recency gate is
live exactly here, because the tree is on the hub's branch, so the summary cannot go stale
silently.

## 4. Constraints the sequencing obeys

1. **`npm run lint` green at every commit.** Gate 7 and gate 13 run on every commit of the
   branch; a wave that deletes a file and its gate arm does both in one commit.
2. **Gates before data** (0185 § Implementation constraints). Every new arm lands in the same
   commit as the data change that makes it green, never after.
3. **Repair the stale procedure text before cutting CLAUDE.md.** CLAUDE.md becomes pointers;
   pointers must land on true text. Wave 1 precedes Wave 4.
4. **CLAUDE.md changes are one PO-approved diff** (CLAUDE.md §5 "always ask"). The plan
   batches every CLAUDE.md edit into Wave 4 so the PO is asked once.
5. **Own worktree, own branch** (`docs/worktrees.md`). This work edits CLAUDE.md, which every
   other session loads from *its* tree — a stale-tree read is the failure class recorded in
   memory. Never run it in the primary tree while another session is live.
6. **Node scripts for any bulk edit; the Edit tool for hand edits.** `sed -i` and shell
   round-trips have corrupted encodings here before. Every `.md` is LF (`.gitattributes`).
7. **A gate that decides the next command runs bare**, as its own call — a pipe erases the
   exit code (LESSONS, hit again 2026-09-03).
8. **D1 applies to this unit**: hub first, then branch, then the CURRENT.md line — which this
   unit deletes in Wave 2 together with the arm that requires it.

## 5. Waves

Each wave is independently mergeable and leaves lint green. Effort is for one Sonnet-class
session with the lead reviewing; PO checkpoints are marked ⏸.

### Wave 0 — Decision and scaffolding (½ day) ⏸ ADR acceptance

| Step | Change | Proof |
|---|---|---|
| 0.1 | ADR `docs/decisions/<next>-documentation-consolidation-one-home-per-fact.md`: Context = § 1 table; Decision = D1…D8 below, numbered for citation; `**Amends:**` 0185, 0179; Considered options; Consequences. `npm run adr:index`. | gate 9 |
| 0.2 | Hub `docs/features/docs-consolidation.md` — `status: in_progress`, `branch: docs-consolidation`, `kind: feature`, `program: DOCS`, `adrs: [<next>, "0185"]`, `plan: ../plans/docs-consolidation.md`, `progress: ../progress/docs-consolidation.md`; acceptance list = § 2; `## Current state` with the baseline numbers. The record is created in the same commit with `## Session log` and a first dated entry (§ 3). `npm run features:index`. | gate 13 |
| 0.3 | Worktree + branch from `main` (`scripts/worktree-setup.sh`); CURRENT.md line for the hub. | gate 13 CURRENT arm — the first time it has a subject |
| 0.4 | Baseline measurements into the hub, by these commands, not by recall: `wc -c CLAUDE.md`; retired-section citations (`grep -rlF "PROGRESS.md § Now" docs .claude scripts --include=*.md --include=*.mjs --include=*.sh` minus `docs/progress`, `docs/decisions`, `docs/reviews`); `wc -c docs/followups/follow-ups-open.md`; `grep -c "Register line" …`; gate-13 arms with zero subjects (from § 1). | recorded |

Decisions the ADR carries (proposed text; the PO rules on each):

- **D1** CURRENT.md is deleted; `docs/features/INDEX.md` is the only projection of hub
  frontmatter (sorted `in_progress` first, count line at the top). Amends 0185 D2.
- **D2** The PROGRESS.md roll-up is deleted; PROGRESS.md carries one link to the index.
  Amends 0185 D6.
- **D3** A unit has one summary and one log. The summary is its hub's `## Current state`; the
  log is `docs/progress/<code>.md § Session log`, dated and append-only (§ 3). A handoff exists
  only while a session is paused mid-task, carries `branch:` when the unit has a hub, and holds
  only the resume pointer, trust, tree and next command. Branchless handoffs are for hubless
  spikes and audits, carry `expires:`, and the gate reds past expiry. Amends 0185 D2 on two
  points: "handoffs unchanged", and "cut into the progress record at completion" — the record
  is written throughout, not only at the end.
- **D4** The follow-up register is an index: heading + the four fields (+ `**Status:**`).
  Bodies over 10 lines live in `docs/followups/<FUP-ID>.md`, the D3-bugs pattern. The deferred
  backlog merges into the open register as `**Status:** parked`. The archive stays separate
  (0179's principle stands). Amends 0185 D5 and 0179 in the body-location clause.
- **D5** `.claude/rules/progress-contract.md` is deleted. Its "where a line belongs" table has
  one home, `docs/INDEX.md`; its rotation recipe has one home, lead-playbook §5; its
  mechanical content is gates 7 and 13. Amends 0185 D6/D8.
- **D6** Counts the gate today prints as warnings become ratchets: a constant in the script
  that may only decrease.
- **D7** The phase ledger holds completed rows only; PROGRESS.md § Phase Status holds the rest.
  One rule, not two.
- **D8** `docs/lint-gates.md` describes rationale and traps, one paragraph per gate, never a
  check list — the scripts are the authority.

### Wave 1 — Stop the bleeding: stale procedure text (1 day)

Must precede Wave 4. Sonnet with the file list; each replacement needs the right target, so
not Haiku.

| Step | Change | Proof |
|---|---|---|
| 1.1 | **New gate arm `RETIRED`** in `scripts/check-docs-registers.mjs`: red on `PROGRESS\.md § (Now\|Bug Log\|Critical FUP\|Decisions\|Test Run Summary\|QA Verdicts\|Follow-ups)` in any `*.md` / `*.mjs` / `*.sh` outside `docs/progress/`, `docs/decisions/`, `docs/reviews/`, `docs/design/temp/`. Self-test fixture included. Lands in the same commit as 1.2–1.6. | self-test + live red before the sweep, green after |
| 1.2 | `docs/lead-playbook.md` §5 rewritten against the real gates: no rotations of the retired sections (`§ Now`, `§ Bug Log`, `§ Test Run Summary`, `§ QA Verdicts`, `§ Decisions`); caps 20 / 30 KB; Critical list is in the register; the ADR-numbering sentence becomes a pointer to CLAUDE.md §8 (one rule, one home). §4's door-sweep text stays — it becomes the canonical copy when Wave 4 cuts CLAUDE.md's. | RETIRED arm |
| 1.3 | `.claude/agents/{backend-engineer,frontend-engineer,qa-tester,qa-reviewer}.md`: "read `§ Now`" → "read the hub of the unit you are assigned (`docs/features/INDEX.md`)"; tester files bugs as a `BUGS.md` row; reviewer writes the review file and the hub's `reviews:` link. Numbering sentence in `backend-engineer.md` → pointer. | RETIRED arm |
| 1.4 | `.claude/skills/handoff/SKILL.md`: promote-table rows "A bug" → `docs/bugs/BUGS.md`, "Status of anything" → the hub; RESUME step 1 → read the hub. (The template change is Wave 3.) `domain-modeling/SKILL.md` + `ADR-FORMAT.md` numbering sentence → pointer. | RETIRED arm; `lint:rules` |
| 1.5 | `.prettierignore` header and `.claude/rules/prettier-does-not-govern-this-tree.md`: caps 20 / 30 KB; the rule's `paths:` gains the register directories `.prettierignore` already lists. | `lint:rules` |
| 1.6 | Sweep the remaining retired-section citations (census at Wave 0: 36 living files, 95 lines, the bare `§ Now` form included): each becomes a pointer to where the text went — `docs/progress/2026-Q3.md` for the retired `§ Now` prose, `BUGS.md`, `decisions/INDEX.md`, the owning hub or review. Hubs and handoffs included. | RETIRED arm green |
| 1.7 | Point fixes: AE4 hub — delete the "main HOLD stands" line; Critical pin C2 row — drop the population number, point at the entry; `BUGS.md` L6–8 header — archive is at `docs/bugs/archive.md`; `docs/progress/docs-restructure.md` and `authz-ae4.md` — the three unreachable SHAs become `88c70964`; `docs/INDEX.md` — drop the `bug-log-archive.md` ghost, note that two Coolify runbooks exist (merge is out of scope; file a FUP). | gate 7 links; `git cat-file -e` on every SHA cited in the two records |

### Wave 2 — Collapse the projections (½ day)

| Step | Change | Proof |
|---|---|---|
| 2.1 | Delete the CURRENT arm (13.22/13.23) and its fixture; `build-features-index.mjs` banner no longer names CURRENT.md; CURRENT.md becomes a one-line stub pointing at the index. ⚠ **Found at implementation (2026-09-03):** gate 7 link-checks CLAUDE.md, which links CURRENT.md three times and may only change in the Wave 4 diff — so the file, its directory and its `docs/INDEX.md` row are deleted in Wave 4 together with those pointers. | gate 13 self-test; gate 7 |
| 2.2 | Delete the roll-up block and markers from PROGRESS.md; `build-features-index.mjs` loses the PROGRESS.md write and `--check` compare (13.72/13.74); PROGRESS.md gets one line: "Live feature state: `docs/features/INDEX.md`". | gate 7 + `features:index --check` |
| 2.3 | Ledger rule (D7): delete the four not-started rows (9, 18, 19, DLB) from `phase-ledger.md`; preamble says "completed rows only". DLB's PROGRESS.md row: Status cell → "planned — state in [hub]"; the status sentence lives once. | gate 7 (no `complet` in live rows) |
| 2.4 | `planned` hubs lose `## Current state` (c1b-disposal, dlb); gate 13.15 extended: the block is forbidden for `planned` and `complete`, required for `in_progress` and `gated`. | gate 13 self-test |
| 2.5 | `docs/features/legacy-codes.md` → `docs/followups/legacy-codes.md` (it is an id-prefix legend, read by the CODES arm); `PATHS.legacyCodes`, the index banner and `docs/INDEX.md` follow. | gate 13 LINKS + CODES |

### Wave 3 — One summary, one log per unit (½ day) ⏸ state model

The PO rules on D3 (above) or keeps handoffs unchanged. The plan assumes D3.

| Step | Change | Proof |
|---|---|---|
| 3.1 | Handoff template (`SKILL.md` § Template): remove § State, § Gates, § Dead ends, § Decisions in flight, § Open questions and the Re-derivation appendix — every one is record material (§ 3). Keep RESUME HERE, Trust, Tree, Next command. Location rules: a unit with a hub → `branch:` mandatory; branchless → `expires:` mandatory. | — |
| 3.2 | Gate arms. HANDOFFS: `branch:` **or** `expires:` required (13.67 gains subjects either way); red when `expires` < today. The inbound-citation allowlist **keeps** `docs/features/` — a hub's frontmatter `handoff:` link is the designed citation (corrected at implementation from "drops"). HUBS: `in_progress` / `gated` ⇒ `progress:` resolves and the record contains `## Session log`; the log's `### YYYY-MM-DD` dates are non-decreasing (append-only, mechanically). ⚠ Found at implementation: deleting the last handoff removes the directory and reds the docs-index LINKS check — `docs/handoffs/README.md` keeps it in git (the postmortems pattern). | self-test; both live hubs |
| 3.3 | Record convention: `## Session log`, one `### YYYY-MM-DD — <branch or session>` per session. Create `docs/progress/c2-tier1.md` (C2 has `progress: ~` today) seeded from the C2 handoff's witnessed Done, Gates, Dead ends and Re-derivation sections; add the AE4 handoff's equivalents to `authz-ae4.md`'s log. | gate 13 HUBS arm |
| 3.4 | Delete both landed handoffs — their content now lives in the records; hubs set `handoff: ~`. | gate 13 |
| 3.5 | `docs/progress/authz-ae4.md`: the two "State snapshot re-homed from `§ Now`" sections become dated entries under `## Session log`; the "more than the cap can hold" justification goes — it is the design now, not the overflow. | grep for "re-homed" = 0; the sections remain |
| 3.6 | Purge history from the AE4 and C2 `## Current state` blocks — resolved items out of Blockers, the git-archaeology paragraph, the merge-conflict narrative — **into the record's log, not deleted**. Target ≤ 40 lines each; the cap stays 60. | gate 13.16; line count in the hub |

### Wave 4 — CLAUDE.md, one PO-approved diff (1 day incl. review) ⏸ the diff

Preconditions: Waves 1–3 merged. The lead writes the diff; the PO approves it before commit.

| Cut | Lines (approx.) | Where the content already lives |
|---|---|---|
| §1 `case_patient` callout; hospital_admin / AFF / AFF2 lore; BUG-AUTHZ-001 noun-rule detail; PHI paragraph to 3 lines | −30 | ARCHITECTURE.md §2 / Rule 12; `docs/backend-state.md`; ADR 0133 |
| §2 tree-comment histories | −8 | git |
| §3 inline ⚠ lore under Rules 2, 12, 13 | −10 | ARCHITECTURE.md |
| §4 the 79k→489k anecdote | −2 | LESSONS.md row |
| §5 the pilot-gate rotation note; the authz-handoff blockquote → one line to LESSONS.md | −14 | LESSONS.md; backend/qa agent files |
| §6 step 1 → 3 lines (the gate names + "recipe: lead-playbook §4"); step 5 → "lead-playbook §§4–5" | −38 | lead-playbook |
| §7 → 6 lines: state → hub; registers → `docs/INDEX.md`; gates 7/13. Delete "must survive any trim", the review-cadence paragraph, the "presence not truth" note | −30 | `docs/INDEX.md`; lead-playbook |
| §8 lint bullet → 3 lines ("the chain is `package.json`; rationale `docs/lint-gates.md`; 0 warnings"); prettier → 1 line; ADR bullet → 3 lines; rules-admission → 1 pointer to ADR 0127 | −26 | package.json; the prettier rule; ADR 0127 |
| §9 comment histories; the seed-persona "measured" note | −6 | git |
| § graphify → 8 lines (query first; never `update`; the SQL exception); refresh policy → lead-playbook §6 | −16 | lead-playbook §6 |
| Every dated "this line said / measured / rotated" annotation (13) and the wrong-direction "rule below" | −13 | git |
| The three CURRENT.md pointers — and with them the stub file, its directory and its `docs/INDEX.md` row (Wave 2.1's finding) | −3 | retired in Wave 2 |

Also in the same diff: `.claude/rules/progress-contract.md` deleted (D5); `docs/INDEX.md`
gains the "where a line belongs" table verbatim from the rule; PROGRESS.md header shrinks to
three lines; `lint:rules` count drops to 10.

Proof: gate 7's CLAUDE.md byte check; `wc -c` ≤ 20,480 recorded in the hub; `lint:rules` —
every rule anchor that pointed into CLAUDE.md text must still resolve (gate 8 reds on the
ones that do not; fix the anchor, not the cut).

### Wave 5 — Registers (2 days)

Gate arms land first, in the same commit as the data they check.

| Step | Change | Proof |
|---|---|---|
| 5.1 | FOLLOWUPS arm gains: entry ≤ 20 lines in the index file; no `##`/`####` inside an entry; `**Register line**` forbidden; heading ≤ 160 chars; `**Status:**` ∈ `open \| parked`; `parked` ⇒ `Revisit when`; Owner ∈ a closed vocabulary (`lead`, `backend`, `frontend`, `tester`, `qa`, `PO`, joined by ` + ` in that order); every `docs/followups/FUP-*.md` linked by exactly one entry; LINKS arm covers the new files. Ratchets (D6): `MAX_PO_TO_RULE`, `MAX_PER_EMOJI` constants. | self-test; each new check reds on a live subject before the data change |
| 5.2 | **Split script** (one-off, `scripts/migrate-fup-bodies.mjs`, deleted after the wave, its invocation recorded in the ADR): for each of the 171 entries keep heading + fields in the index; body > 10 lines → `docs/followups/<FUP-ID>.md` with the heading as H1 and a back-link; delete the 123 `**Register line**` paragraphs; append `→ [body](<FUP-ID>.md)` to the index entry. Headings stay verbatim so every existing citation by id keeps resolving. | `wc -c` ≤ 120 KB; gate 7 links; gate 13 |
| 5.3 | Merge `deferred-backlog.md` into the index as `**Status:** parked` entries; the 29 id-less items get `FUP-BACKLOG-<slug>` ids; the 27 parked entries already in the open file get the status field; the 1 double registration resolved; the 4 parked bodies filed in the archive move to their body files. Delete `deferred-backlog.md`; repair its ≈ 75 reference sites (the LINKS gates prove it). | gate 7 + 13 |
| 5.4 | Archive hygiene: the 6 double-filed ids → one heading each; the 4 index-only sections deleted; the three "Resolved — rotated" stubs in the open file deleted. | gate 7.13 |
| 5.5 | `FUP-DM5-NO-ANSWER-VS-NOTHING` (resolved, 257 lines) → a LESSONS row + `docs/learning/postmortems/LEARN-<nnn>-no-answer-vs-nothing.md` (the first postmortem; the nine-section arm gains a subject); entry → archive. | gate 13 POSTMORT |
| 5.6 | Critical pin rows → id · trigger · deadline · owner, ≤ 300 chars, no narrative; gate: pin row length cap. | self-test |
| 5.7 | `BUGS.md`: Doc column filled for the 48 ids that have `archive.md` headings (anchor links; the unified link checker of Wave 6 verifies anchors); header states plainly that pre-2026-07 bodies were never registered; the ADR's "~152 archived bodies" corrected in the consolidation ADR. The 10 untriaged / 40 unrated / 5 catastrophic remain the PO's list, unchanged. | gate 13 BUGS |
| 5.8 | `LESSONS.md`: rows for "prosecdef beside pg_policies" and "text is not truth" (origin ADR 0078); Enforcement names `.claude/rules/` files where they exist (LEARN-046 → `authz-gate-results-need-a-current-baseline.md`). `docs/progress/authz-handoff.md` is historical and untouched; CLAUDE.md §5 (Wave 4) routes to LESSONS.md instead. | gate 13 LESSONS |

### Wave 6 — Gate hygiene (1 day)

| Step | Change | Proof |
|---|---|---|
| 6.1 | `complete` cross-check row-grade: a ledger **row** `^\| <ID> \|`, or a review whose verdict line matches `^\*\*Verdict:\*?\*? ?APPROVED` (the 20 live reviews use `**Verdict: APPROVED**` / `**Verdict:** APPROVED`); "NOT APPROVED" and "CHANGES REQUESTED" red. | self-test fixture for the negative |
| 6.2 | `check-rules-staleness.mjs`: parse YAML folded scalars, or red on a `broad:` / `source:` value of `>-` / `>`; a missing `.claude/rules/` directory reds (the gate-7 stance). | self-test |
| 6.3 | One link checker: export `checkLinks` (code-span blanking, extension filter, anchor check) from `check-docs-registers.mjs`; gate 7 imports it. One `RESOLVED_HEADING_RX`, exported, imported. | both gates green; a fixture with a backticked link passes both |
| 6.4 | Delete the tombstone docblocks in `check-progress-doc.mjs` (retired-check comments, ≈ 70 lines). | `node --check`; gate 7 |
| 6.5 | Gate 9's 30-day proposed-ADR review timer reds 2026-09-24: the PO does the review it asks for (it is owed), or the ADR rules it a warning. Plan assumes the review. | ⏸ PO |
| 6.6 | `ui-copy-forbidden-strings.md` `paths:` drops `docs/followups/follow-ups-open.md` (a UI-copy rule firing on register edits). | `lint:rules` |
| 6.7 | Every arm prints `subjects=N` at the end of its run; the hub records the N per arm on `main` after merge. Not gated — an instrument, so the next audit reads vacuity off the output instead of re-deriving it. | output |
| 6.8 | `docs/lint-gates.md` rewritten per D8: rationale + trap per gate, no check lists. | prose |

### Wave 7 — Record (½ day) ⏸ human approval

- Read-only review (`qa-reviewer`, Haiku/Sonnet): `docs/reviews/docs-consolidation-review.md`.
- Hub → `complete`; `## Current state` cut into `docs/progress/docs-consolidation.md` with the
  before/after table (§ 2 criteria, each with its number); `npm run features:index`.
- ADR status → accepted; `npm run adr:index`.
- Branch deleted; no handoff (D3). `chore(graphify):` refresh is the lead's, after merge.
- Commit: `docs(consolidation): complete — one home per fact, one state document per unit`.

## 6. Effort and checkpoints

| Wave | Effort | PO checkpoint |
|---|---|---|
| 0 | ½ day | ADR acceptance |
| 1 | 1 day | — |
| 2 | ½ day | — |
| 3 | ½ day | state model (D3) |
| 4 | 1 day | the CLAUDE.md diff |
| 5 | 2 days | — (the ruling lists stay open) |
| 6 | 1 day | gate 9 review or waiver |
| 7 | ½ day | approval |
| **Total** | **≈ 7 days** | 5 checkpoints |

Waves 1–2 can run before the ADR is accepted (they repair falsehoods; no decision is needed).
Waves 3–6 wait for it. Wave 5 is the largest and the most mechanical; Wave 4 is the smallest
diff with the highest blast radius.

## 7. Delegation

- Waves 1, 2, 3.3–3.6, 5.2–5.8: **Sonnet** with explicit file lists.
- Gate code (1.1, 2.1–2.2, 3.2, 5.1, 6.x): **Sonnet**; the `complete` and `broad:` semantics
  (6.1, 6.2) reviewed by **Opus**.
- Wave 4 diff: **the lead**, PO-reviewed.
- Wave 7 review: **qa-reviewer** (Haiku/Sonnet), read-only.
- Never Fable unless the PO assigns it.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The session log becomes the diary `§ Now` was | It is read only by sessions on that unit and never auto-loaded; the hub's 60-line summary stays the forced read; the gate keeps it append-only; its cost is bounded by relevance, which the old section's never was |
| The register split breaks inbound citations (ADRs, plans, memory cite `follow-ups-open.md` by id) | Headings stay verbatim in the index; ids are unchanged; gate 7 + 13 link sweeps run at every commit |
| A bulk edit corrupts encoding or line endings | Node scripts only, LF asserted by `.gitattributes`; `git diff --stat` before commit shows only the intended files |
| CLAUDE.md read from a stale tree by a parallel session | Own worktree; the PO merges Wave 4 when no other session is live |
| A clean auto-merge undoes a bulk repair (recorded lesson) | Re-run `npm run lint` mid-merge, bare, and read the exit code |
| The cut removes a sentence no other home holds | Wave 4's table names the home for every cut; the reviewer verifies each line of the diff against it |
| The ratchet constants become the new "PO to rule" — a number nobody lowers | Each ratchet line carries the date and the count; the register's ⭐⭐ Critical list gets one entry: "lower the ratchets", owner PO |

## 9. Out of scope, filed as follow-ups at Wave 0

- Merging the two Coolify runbooks (`docs/deploy-coolify.md`, `docs/deployment/coolify.md`).
- `docs/progress/` at 133 files / 3.9 MB: which archives are ever read; whether
  `test-run-archive.md` (417 KB) and `qa-verdicts-archive.md` (145 KB) should exist at all.
- The Stop-hook review queue: its own header records that the signal fires on the instruction
  and found none of the three real defects; decide whether it earns its keep.
- MEMORY.md ↔ LESSONS.md: ~90 memory lessons vs 72 rows, one cross-reference.
