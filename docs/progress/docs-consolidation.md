# DOCS-CONSOLIDATION — progress record

The unit's **summary** is its hub, [docs/features/docs-consolidation.md](../features/docs-consolidation.md)
§ Current state (replaced every session, ≤ 60 lines). This file is its **log** (ADR 0186 D3):
one dated subsection per session, appended, holding what was verified and its witness, gate runs
with exit codes, dead ends, decisions made in flight, open questions. At completion the hub's
final Current-state block is appended here and the hub's block is cut.

Plan: [docs/plans/docs-consolidation.md](../plans/docs-consolidation.md). Decision: ADR
[0186](../decisions/0186-documentation-consolidation-one-home-per-fact.md).

## Session log

### 2026-09-03 — Wave 0 (lead session, branch `docs-consolidation`)

**Baseline, by command, at `main` = `8e0ecd1a`:**

| Measure | Command | Value |
|---|---|---|
| CLAUDE.md bytes | `wc -c CLAUDE.md` | 37,734 |
| Dated change-log annotations in CLAUDE.md | `grep -cE 'this line (said\|read)\|[Mm]easured 20[0-9]{2}-[0-9]{2}-[0-9]{2}\|rotated (here\|there\|verbatim)' CLAUDE.md` | 5 |
| Retired-section citations in living `.md` files (code spans and fences blanked) | the census script recorded in the plan's Wave 0.4, regex `§ (Now\|Bug Log\|Critical FUP\|Test Run Summary\|QA Verdicts)` or `PROGRESS.md § (Decisions\|Follow-ups)` | 36 files, 95 lines |
| `follow-ups-open.md` bytes | `wc -c docs/followups/follow-ups-open.md` | 737,876 |
| `**Register line**` paragraphs | `grep -c '\*\*Register line\*\*' docs/followups/follow-ups-open.md` | 123 |
| Hub Current-state lines, AE4 / C2 | `awk '/^## Current state/{f=1} f{n++} END{print n}' docs/features/{ae4,c2-tier1}.md` | 60 / 58 |
| Handoffs | `ls docs/handoffs/*.md \| wc -l`; `cat docs/handoffs/*.md \| wc -c` | 2 files, 33,898 B |
| Gate-13 checks with zero subjects | the 2026-09-03 audit's probe list (13.11, 13.19, 13.22, 13.23, 13.25, 13.26, 13.32, 13.37, 13.63–65, 13.67) | 11 of 74 |

**Verified:**

- Worktree `worktrees/docs-consolidation` on branch `docs-consolidation` at `8e0ecd1a`, own
  `node_modules` (`scripts/worktree-setup.sh docs-consolidation main`, exit 0). Base is local
  `main`, not `origin/main` — `main` is unpushed.
- Peer sessions on this tree at the time: four interactive (`ListAgents`), which is why the plan's
  worktree constraint applied.
- `origin/authz-c2-tier1` holds no ADR above 0180 (`git ls-tree`), so 0186 is highest + 1.

**Decisions in flight:** none beyond ADR 0186 as written.

**Open questions:** the ADR's acceptance and D3 are the PO's; Wave 1 and Wave 2 proceed without
them per the plan (falsehood repair; D1/D2/D7 reversible by revert).

### 2026-09-03 — Wave 1 (lead session + four subagents, branch `docs-consolidation`)

**Partition (no two agents on one file):** gate arm (`scripts/check-docs-registers.mjs`,
`docs/lint-gates.md`) · procedure text (`docs/lead-playbook.md`, `.claude/agents/*.md`,
`.claude/skills/{handoff,domain-modeling}/*`, four `.claude/rules/*.md`, `.prettierignore`,
PROGRESS.md line 12) · the docs sweep (`follow-ups-open.md`, seven `docs/plans/*.md`, five
`docs/design/*.md`, one runbook, two `docs/bugs/BUG-*.md`) · hubs, handoffs, `docs/INDEX.md`,
`BUGS.md` header, the two records' SHAs. The lead fixed the plan's own subject mentions.

**Verified:**

- `npm run lint` — exit 0 (full chain, thirteen gates).
- RETIRED arm — `0` findings, `237 md files scanned` (`node scripts/check-docs-registers.mjs`);
  baseline was 95 lines in 36 files. Self-test proven able to red: the gate agent short-circuited
  the checker and the run exited 2, then restored it.
- `node scripts/check-rules-staleness.mjs` — OK; rule sizes after edit: `authz-gate-results…`
  2,048 B (at the cap), `push-schema…` 2,047, `prettier…` 2,034, `live-facts…` 1,952.
- Every repointed citation's target was grep-verified by the agent that rewrote it (reports
  list each as before → after → how verified); the lead re-read the lead-playbook §5 and the
  tester / reviewer / handoff-skill diffs.
- Hub blocks after edit: AE4 58 lines, C2 58 (cap 60). Handoffs 14,104 B and 19,856 B (cap
  24,576). `git diff --stat`: 43 files, +303 / −190. Primary tree: 0 changes.

**Judgment calls to surface:** the tester role file also lost its "append a row to the Test
Run Summary" sentence, one line beyond the flagged list, same defect class. The four agent files
grew 150–210 B each (hub pointers replacing a shorter "read § Now"); lead-playbook shrank 1.1 KB.
The Critical pin's C2 row no longer states a population figure; the entry does.

**Dead ends:** a Bash heredoc mangled the census script's `\\` escapes twice; written with the
Write tool instead (the recorded lesson: shell round-trips corrupt).

### 2026-09-03 — Wave 2 (lead session + two subagents, branch `docs-consolidation`)

**Partition:** scripts (`check-docs-registers.mjs`, `build-features-index.mjs`, `lint-gates.md`)
· docs (`PROGRESS.md`, `docs/INDEX.md`, the CURRENT.md stub, `phase-ledger.md`, the two planned
hubs, the `legacy-codes.md` move). The lead regenerated `docs/features/INDEX.md` after both.

**Verified:**

- `node scripts/check-docs-registers.mjs --self-test` — OK; the new `planned` forbid proven able
  to red (short-circuited → exit 2, restored → exit 0).
- Live gate 13 — exit 0 after both halves; `build-features-index --check` red only until the
  regeneration, as designed.
- Ledger: the four deleted rows (9, 18, 19, DLB) were byte-identical to their PROGRESS.md rows
  modulo the documented link-prefix transform — checked before deletion.
- The two planned hubs' Current-state blocks held nothing not already in the runbook, the DLB
  plan's status banner, or `2026-Q3.md` — checked before deletion; nothing moved.
- `npm run lint` — exit 0 (recorded at commit).

**Decisions in flight:**

- **Plan correction (2.1):** gate 7 link-checks CLAUDE.md, which links `docs/planning/CURRENT.md`
  three times; CLAUDE.md may only change in the Wave 4 PO diff. So CURRENT.md is a one-line
  stub now and is deleted in Wave 4 with those pointers, its directory and its `docs/INDEX.md`
  row. Written into the plan's rows 2.1 and Wave 4.
- `listHubs()`'s by-name exclusion of `legacy-codes.md` was left in place as inert (the file can
  no longer appear in `docs/features/`); the scripts agent's call, recorded here.
- `docs/INDEX.md`'s authority-order row dropped `planning/CURRENT.md` from the trackers list — one
  edit beyond the docs agent's list, same file, same defect.

**Open questions:** none new. CLAUDE.md §7 still says PROGRESS.md holds "the generated feature
roll-up" — true until Wave 4's diff, and only that diff may fix it.

### 2026-09-03 — ADR 0186 accepted; Wave 3 (lead session + three subagents)

**Acceptance:** the PO answered the Waves 0–2 report, which listed the four checkpoints, with
"continue". Recorded in the ADR header as acceptance of D1–D8 as written, D3 included; the Wave 4
CLAUDE.md diff keeps its own explicit approval. `proposed-review.json` drops 0186; gate 9 OK.

**Partition:** gate arms (`check-docs-registers.mjs`, `lint-gates.md`) · the handoff skill
(`SKILL.md`, 228 → 162 lines, four-section template) · records, hubs, handoffs, `docs/INDEX.md`.

**Verified:**

- Self-test proven able to red on five guards (whole record block, date order, missing heading,
  past `expires`, neither key) — each short-circuited → exit 2, restored → exit 0.
- Live: no `[HUBS]` or `[HANDOFFS]` finding; AE4's record has `## Session log` at line 1083 with
  three 2026-09-03 entries; C2's new record has one. Hub blocks 35 (AE4) and 32 (C2) lines.
- Every link carried from the two handoffs into the records resolves (agent-checked before the
  `git rm`); RESUME HERE and Trust sections were not carried, by D3's definition of that layer,
  and both records say so.
- `npm run lint` — exit 0 (recorded at commit).

**Decisions in flight:**

- The citation allowlist keeps `docs/features/`: a hub's frontmatter `handoff:` is the designed
  citation. Plan row 3.2 corrected.
- Deleting the last handoff deletes the directory (git tracks no empty dirs) and reds the
  docs-index LINKS check. `docs/handoffs/README.md` added — the pattern `docs/learning/postmortems/`
  already uses. Plan row 3.2 records it.
- The HANDOFFS arm has zero live subjects again (both handoffs gone); the self-test is its proof
  until a session pauses mid-task.
- The arm first counted the new README as a handoff (no `branch:`/`expires:`, and its name-keyed
  citation check tripped on every "README.md" in the tree). The lead added a listing exclusion
  for `README.md`, the same shape the hub listing uses for `INDEX.md`; no fixture, since the
  listing lives in `main()` — recorded here as a gap the Wave 6 hygiene pass may close.

**Dead ends:** the records agent messaged the earlier read-only audit agent about the directory
gap instead of the lead; that agent correctly declined. Subagents route findings to the lead.

### 2026-09-03 — Wave 5 (lead session + three subagents)

**Partition:** gate arms (both gate scripts, `lint-gates.md`) · the register split, backlog merge,
archive hygiene, pin (`docs/followups/**`, the migration script) · bugs, lessons, postmortem,
reference sweep (`BUGS.md`, `LESSONS.md`, `postmortems/`, the living citers of the backlog file).

**Verified (after reconciliation):**

- Gates 7, 8, 13 — exit 0 each, bare. Full chain at commit.
- `follow-ups-open.md` 737,876 → **151,978 B**; 204 entries (172 + 33 merged − 1 archived);
  159 body files; 0 `Register line` paragraphs (122 deleted; the audit said 123); the migration
  script is idempotent (second run: no change). Archive 725 KB (four parked bodies out, one
  resolved entry in, three double headings merged, three index-only sections deleted).
- Ratchet counts, measured after the data landed and written as the caps:
  closesWhenPoToRule 147 · severityPerEmoji 135 · severityUnrated 29 · revisitWhenPoToRule 38 ·
  longHeadings 97 · bugsUntriaged 10 · bugsUnrated 40 · lessonsProseOnly 47.
- BUGS.md: 48 rows link an archive heading by a computed GitHub slug, each verified against the
  real heading; 111 stay `—` and the header says why (101 have an un-headed trace, 10 none).
- LESSONS.md 72 → 75 rows (LEARN-073 the no-answer lesson with the first postmortem, LEARN-074
  `prosecdef` beside `pg_policies`, LEARN-075 text is not truth); two `prose only` cells replaced
  by the rule file that carries them, with the carrying sentence quoted in the agent's report.
- Proof-of-red: entry length, Owner vocabulary, a ratchet, the archive-anchor check (exit 2
  each when short-circuited).

**Decisions in flight:**

- **Register size target re-set 120 → 160 KB** (plan § 2, hub): headings stay verbatim (Amdt 1)
  and the merge added 33 entries; 152 KB is the honest figure, not a compression.
- **checkBugs exempts archive anchors** from the two-section completeness check and verifies the
  anchor instead (the lessons agent's finding; routed to the gate agent, fixed, proven).
- **`relLinks` blanks code spans and fences** — pulled forward from Wave 6.3 because two split
  bodies talk *about* link patterns; the unification with gate 7's checker remains Wave 6.3.
- **The archived resolved entry's body was folded back inline** (a resolved item's body lives in
  the archive, 0185 D5); its `Status` cell is `resolved`. The one-off fold script lives in the
  session scratchpad, not the tree.
- The mutation-harness rule's anchor followed its literal into a body file; the rule was trimmed
  13 bytes to stay under the 2,048 cap (2,035 B).
- `docs/progress/aff4.md:103` linked the deleted backlog — repointed to the register.

**Findings the agents corrected in my brief, kept as written by them:** the fourth "index-only"
archive section held real bodies (left); three of the six "double-filed" ids had one heading
(left); two "▶" blocks with no id sat unindexed in the open file and became the two backlog
items' fuller bodies; the backlog's uniform 🟡 read as boilerplate, so merged items carry
`unrated`; the BUGS.md header states the measured 101/10 split rather than "do not exist".

**Open questions:** `docs/reviews/authz-evolution-implementation-audit-2026-09-02.md` cites two
`#L…` line anchors into the register that the split invalidated — a historical review, left;
CLAUDE.md §7 still names `deferred-backlog.md` (Wave 4). `scripts/migrate-fup-bodies.mjs` is
committed with this wave and deleted at Record, its SHA recorded in the ADR then.

### 2026-09-03 — Wave 6 (lead session + two subagents), commit `dfdda783`

**Verified:** each gate's self-test OK; proof-of-red on the mention-only ledger case, the folded
scalar, and an archive `**Body:**` link (exit 2 each, restored); full chain green on the Wave 6
state alone — measured by stashing Wave 4's documents, linting, committing, then restoring.
Ratchets unchanged. `check-progress-doc.mjs` 742 → 649 lines; `lint-gates.md` 131 → 29 lines
(one long line per gate).

**Decisions in flight:** the `complete` check's verdict regex also accepts the heading form
`## Verdict: **APPROVED**`, which the one live complete hub's review uses — widened, not
weakened (NOT APPROVED still reds, proven). The plan's "drop `docs/features/` from the citation
allowlist" stays reverted (Wave 3). No live rule had an empty folded scalar behind `>-`.

### 2026-09-03 — Wave 4 (lead session), the PO-authorized CLAUDE.md diff

**Authorization:** the PO wrote "CLAUDE.md diff authorized" after the diff page was published
(https://claude.ai/code/artifact/7d4166e9-2bc7-493a-97d3-ada0a2f374f7 — the diff and the full
proposed file, with the home of every cut).

**Verified:** CLAUDE.md 37,734 → **20,454 B**, 499 → 289 lines; every relative link resolves;
no rule anchor pointed into cut text; 0 retired-section citations; gate 7's byte cap holds.
`docs/planning/` deleted with the stub; `.claude/rules/progress-contract.md` deleted (rules
11 → 10); its "where a line belongs" table lives once, in `docs/INDEX.md`; PROGRESS.md's header
is five lines; the prettier rule's `paths:` drop the deleted directory; the RETIRED arm's
CLAUDE.md exclusion constant and its guard are gone and the fixture asserts inclusion. Full
chain green at commit.

**Decisions in flight:** the cut table in the diff page names each removed block's home; two
blocks were compressed rather than moved (forms/responses concepts, the modules list) because a
teammate needs the concept, not the schema detail ARCHITECTURE.md holds.
