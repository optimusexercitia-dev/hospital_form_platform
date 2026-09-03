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
