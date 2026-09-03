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
