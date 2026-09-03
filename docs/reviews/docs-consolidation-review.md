# DOCS-CONSOLIDATION — QA review

**Subject:** ADR 0186 / `docs/plans/docs-consolidation.md`, Waves 0–7
**Branch:** `docs-consolidation` · **HEAD:** `600db943` (7 commits ahead of `main` `8e0ecd1a`)
**Date:** 2026-09-03 · **Reviewer:** `qa` (read-only Sonnet subagent)

**Verdict: APPROVED**

All measurable acceptance criteria pass by direct command (not by recall). Two facts cut from
CLAUDE.md landed with no canonical home (F-1, F-2) and one acceptance-criterion sentence
under-counts the files a completed unit actually touches (F-4); none is high severity — no
gate lost coverage, no duplication was introduced, and both live-check mutations this review
ran proved able to red and were cleanly reverted. `git status --porcelain` is clean except
this file.

## Findings

| # | Severity | Finding |
|---|---|---|
| F-1 | medium | The Wave 4 diff table (`docs/plans/docs-consolidation.md` row "§4 the 79k→489k anecdote → LESSONS.md row") promised a LESSONS.md row for the delegation-floor token-growth anecdote cut from CLAUDE.md §4. `grep -rn "79k\|489k" --include=*.md .` (excluding `graphify-out`) finds it **nowhere** — not in `docs/learning/LESSONS.md`, not in `docs/lead-playbook.md`. The rule itself survives in CLAUDE.md §4 ("spawn an Explore subagent"); only its evidentiary anecdote is gone with no home. |
| F-2 | low | CLAUDE.md §5 used to say the two 🔴 pilot-gate checks were rotated to `docs/progress/dm5-po-decisions.md` § "Remaining pre-pilot work"; that sentence is cut with no replacement pointer anywhere live (`grep -n "pilot-gate" PHASES.md docs/quality-track-context.md CLAUDE.md` = 0 hits). Mitigated: the underlying facts — which items block the pilot — are independently reachable via the ⭐⭐ Critical pin at the top of `docs/followups/follow-ups-open.md` (rows C1–C4, `follow-ups-open.md:36-40`), which is CLAUDE.md §7's documented Critical-list home. `docs/progress/dm5-po-decisions.md` itself is now an orphan: no living file cites it. Low, not medium, because the fact survives elsewhere; the specific pointer does not. |
| F-3 | low | `.claude/agents/qa-reviewer.md:47` and `.claude/agents/backend-engineer.md:84,104` still route directly to `docs/progress/authz-handoff.md` §7, while CLAUDE.md §5 (Wave 4) now routes through `docs/learning/LESSONS.md` instead. Not a duplication — LESSONS.md rows (`LEARN-001`…`LEARN-075`, `docs/learning/LESSONS.md:24-98`) each cite `docs/progress/authz-handoff.md#7.N` as **Origin**, so this is a two-level index→detail hierarchy, not two homes for one fact — but the two agent files bypass the new top-level pointer CLAUDE.md was cut down to, which the plan's Wave 1 file list (`.claude/agents/{backend-engineer,frontend-engineer,qa-tester,qa-reviewer}.md`) did not flag for this specific sentence. |
| F-4 | low | Hub acceptance criterion "a status change touches ≤ 3 hand-written files" (`docs/plans/docs-consolidation.md` § 2) enumerates hub / PROGRESS.md-if-phase / ledger-at-completion, but omits the record file (`docs/progress/<code>.md`) that D3 and `docs/lead-playbook.md` §5 also require touching at completion ("append its `## Current state` block … into its progress record … then delete the block from the hub"). Completion of a feature-hub unit that is simultaneously a phase-status row would touch 4 files (hub + record + ledger + PROGRESS.md), not ≤3. In the two completions this branch actually performed (Waves 0–7 on itself is still pending; AE4/C2 handoffs folded into records in Wave 3) only hub+record were touched (2 files) — the bound holds in observed practice, but the criterion's enumeration is incomplete as written. |

No finding rises above medium; F-1 is the only one worth a follow-up.

## Question 1 — does every cut leave one canonical home?

Sampled removed blocks from the Wave 4 CLAUDE.md diff (`git show 600db943 -- CLAUDE.md`, −556/+289 net lines edited, file 37,734→20,454 B), spanning every section, plus the four required non-CLAUDE.md deletions:

| Cut (CLAUDE.md unless noted) | Claimed home | Verified |
|---|---|---|
| §1 `case_patient` FEATURE-FLAG-KEY callout | ARCHITECTURE.md §2 | `ARCHITECTURE.md:629-630`: "⚠ There is no `case_patient` table — `case_patient` is a FEATURE-FLAG KEY and the name of the predicate `app.can_read_case_patient`; no relation…" — present, verbatim in substance |
| §1 `hospital_admin` org-scoped-directory / AFF2 footprint lore | `docs/backend-state.md` | `docs/backend-state.md:1228` "`fields`/`credentials` → intersection; `cpf_change`/`lifecycle` → subset"; `:5504` `list_addable_commission_members` detail — present |
| §1 BUG-AUTHZ-001 noun-rule detail ("census figures are TABLE-level reads … DEFINER bypasses RLS") | ARCHITECTURE.md / LESSONS.md (implied) | Exact phrase absent from ARCHITECTURE.md and `docs/bugs/archive.md`; **paraphrased**, not verbatim, in `docs/learning/LESSONS.md:97` (LEARN-074: "`prosecdef` belongs beside `pg_policies` — a DEFINER function's gate replaces RLS, so a policy census is not proof") — accepted as the same fact in general form |
| §1 PHI paragraph (case_patient/module detail to 3 lines) | ARCHITECTURE.md §2 / Rule 12 | confirmed present, `ARCHITECTURE.md:620-642` |
| §2 repo-tree comment histories | git | trivially true (comment-only prose, no fact lost) |
| §3 Rule 2 `commission_members` scar detail | ARCHITECTURE.md | `ARCHITECTURE.md:116-117` present |
| §3 Rule 13 affiliation LOCATES/GRANTS + pgTAP 392 | ARCHITECTURE.md | `ARCHITECTURE.md:718,735-738` present |
| §4 delegation-floor 79k→489k anecdote | LESSONS.md row | **NOT FOUND anywhere** — F-1 |
| §5 pilot-gate rotation pointer | (unstated; plan implies LESSONS.md/agent files) | **Orphaned** — F-2 |
| §5 authz-handoff §7 blockquote → "one line to LESSONS.md" | LESSONS.md | `docs/learning/LESSONS.md:19,24-98` present; two agent files still cite the old target directly — F-3 |
| §6 step 1 (authz ARM recipe + door-sweep-cases.sh) | `lead-playbook.md` §4 | Present, `docs/lead-playbook.md:94-97` "Gate step-1 note (authz sweeps)" despite the section heading reading "Record step (§6 step 5) mechanics" — content is there, heading is misleading (not filed as a finding: cosmetic) |
| §6 step 1 "what each ARM proves" (BLIND/ERROR semantics) | ADR 0079 | Confirmed, `docs/decisions/0079-authz-door-blindness-standing-invariant.md:252,403,493-494,619,678-682,736-752` |
| §6 step 5 (Record mechanics) | `lead-playbook.md` §§4-5 | Present in full, `docs/lead-playbook.md:57-140` |
| §7 whole ("where a line belongs" contract) | `docs/INDEX.md` | Row-by-row match verified against the pre-deletion `.claude/rules/progress-contract.md` (`git show 600db943~1:.claude/rules/progress-contract.md`) — phase status, unit state, bug, follow-up, standing prohibition rows all present in `docs/INDEX.md:51-68`; the rotation-mechanics incident count (474/41/20 broken links) survives in `docs/lead-playbook.md:141-146`, not `docs/INDEX.md`, which is fine (one home, not necessarily the same home as the deleted rule) |
| §8 lint-gate rationale (13-gate list + traps) | `docs/lint-gates.md` | Confirmed, `docs/lint-gates.md` (29 lines, one paragraph per gate); chain independently verified against `package.json:12-14` (13 gates, matches) |
| §8 ADR-numbering / rules-admission detail | git / ADR 0127 | ADR 0127 exists and is cited; detail preserved |
| §9 seed-persona "measured 2026-08-26" annotation | git | trivial, no fact lost |
| § graphify refresh cadence + 12,729-line anecdote | `lead-playbook.md` §6 | Confirmed, `docs/lead-playbook.md:160-168` |
| `docs/planning/CURRENT.md` (+ directory) | `docs/features/INDEX.md` (generated) | Deleted (`ls docs/planning` → no such file); the RETIRED-arm-adjacent grep sweep below shows no live dangling reference |
| `.claude/rules/progress-contract.md` | `docs/INDEX.md` § "Where a line belongs" | Deleted; content verified row-for-row above |
| `docs/followups/deferred-backlog.md` (34 blocks → parked entries) | `docs/followups/follow-ups-open.md`, `**Status:** parked` | Sampled 5 of 33 merged ids (`FUP-BACKLOG-P7-AUDITLOG…`, `-D3-JSONBARRAY…`, `-D7-THREAD-PHOSPITALID…`, `-BREAKGLASS-ACCESS…`, `-CASEPATIENT-DISPOSAL-UI…`) — all 5 found with body text landed verbatim (`docs/followups/follow-ups-open.md:1392-1534`) |
| Two handoffs (`authz-ae4-2026-09-03.md`, `c2-tier1-2026-09-03.md`) | `docs/progress/authz-ae4.md`, `docs/progress/c2-tier1.md` | Sampled 3 sections each: AE4's "Done — VERIFIED" table (11 rows, SHAs `cf30dfe9`/`974328e6`/`8ca976d7`/`a6ff4ad0`) found verbatim at `docs/progress/authz-ae4.md:1125-1135`; C2's "Dead ends" bullets (5 sampled: "Sweeping per DOOR", "Stubbing a door's body", "Depth-0 grain", "Rescuing the TENANCY disjunct", "PHI comment convention") found at `docs/progress/c2-tier1.md:103-115`. Both handoffs deleted, directory holds only `README.md` |
| `docs/features/legacy-codes.md` → moved | `docs/followups/legacy-codes.md` | Confirmed moved; old path gone |

**Dangling-reference sweep** — `grep -rn "planning/CURRENT\|progress-contract.md\|deferred-backlog.md" --include=*.md . --exclude-dir={node_modules,.next,worktrees,graphify-out}`: every hit is either (a) historical — `docs/decisions/*.md` (ADRs 0124,0127,0139,0140,0179,0185,0186 — explaining what used to exist), `docs/followups/follow-ups-archive.md`, `docs/followups/FUP-*.md`, `docs/followups/legacy-codes.md`, `docs/progress/*.md`, `docs/reviews/*.md` (all explanatory prose about what was rotated, no live link expected to resolve), or (b) `.claude/claude-md-review-queue.md`, which is gitignored (`.gitignore:76`) and untracked (`git ls-files` confirms) — a Stop-hook-generated staleness queue reporting on exactly these paths as historical findings, not a live citation. **Zero live dangling references.**

**Conclusion, Q1:** the consolidation's central claim mostly holds. Two facts (F-1, F-2) were cut with no live home, both non-blocking; one home is a paraphrase rather than a verbatim carry (accepted); one routing sentence (F-3) is stale in two agent files.

## Question 2 — can every new check red on a live subject?

New/changed arms this branch added to `scripts/check-docs-registers.mjs` (1,081 lines changed), plus `check-rules-staleness.mjs` (D8) and the shared-checker unification (D8):

| Check | Fixture (self-test) | Live subjects today | Verdict |
|---|---|---|---|
| RETIRED (D8, Wave 1) | y (`check-docs-registers.mjs` self-test short-circuits it per Wave 1 log) | 394 md files scanned, 0 citations (`node scripts/check-docs-registers.mjs` output) | exercised (was 95 lines/36 files at baseline, now proven swept to 0) |
| HUBS: `in_progress`/`gated` ⇒ `progress:` resolves + `## Session log` non-decreasing (D3) | y (line 1217-1258 area; "HUBS complete ledger mention-only reds", verdict-regex self-tests) | 3 `in_progress`/`gated` hubs live (`ae4`, `c2-tier1`, `docs-consolidation`) each with a record | exercised |
| HUBS: `## Current state` FORBIDDEN for `planned`/`complete` (D1/D2 cleanup) | y (`must('HUBS block on planned', …)`, line 1217-1218) | 2 live `planned` hubs (`c1b-disposal.md`, `dlb.md`) | exercised — **and this review mutated a third case (see below)** |
| FOLLOWUPS: entry ≤20 lines, no nested `##`, `**Register line**` forbidden, Owner vocab, Status enum (D4) | y (line 1423-1447) | 204 live entries | exercised |
| RATCHET (D6): 8 named constants | y (`checkRatchets`) | all 8 non-zero (147/135/29/38/97/10/40/47 — gate's own OK line) | exercised — **this review raised one live and confirmed the red (see below)** |
| `complete` cross-check row-grade + heading-form widen (D8, Wave 6.1) | y (5 self-tests incl. NOT APPROVED / CHANGES REQUESTED negative, lines 1222-1258) | 1 live `complete` hub uses the heading form (per Wave 6 log) | exercised |
| CODES watermark = 2026-09-04 (pre-existing, unaffected by this branch's edits) | y | **0** — latest BUGS.md `Opened` is 2026-09-02, latest FUP `Filed` is 2026-09-03, both before the watermark | fixture-only today, by design (forward grandfather date; will gain live subjects tomorrow) |
| HANDOFFS: `branch:`/`expires:` required (D3) | y (5-guard self-test per Wave 3 log) | 0 (only `README.md`, explicitly excluded by name) | fixture-only — no session is currently paused mid-task; will gain a live subject the next time one is |
| `isHandoffFile` excludes `README.md` (Wave 3 finding, closed) | y (`must('isHandoffFile excludes the README placeholder', …)`, line 1557) | 1 (the README itself) | exercised |
| BUGS archive-anchor exemption (Wave 5 finding) | y (lines 1327-1338, good+bad anchor) | 48 rows link an archive heading | exercised |
| `check-rules-staleness.mjs`: folded-scalar parse + missing-`.claude/rules/`-directory red (D8, Wave 6.2) | y (`fmFolded`, `fmEmptyBehindIndicator`, missing-dir self-tests, lines 283-318) | 10 live rule files, 0 use a bare `>-`/`>` literal today | fixture-only for the specific defect shape (no rule is currently mis-written); directory-presence arm is exercised (directory exists) |
| One `checkLinks` / `RESOLVED_HEADING_RX` (D8, Wave 6.3) | y (lines 536-539) | every register + hub + record file's links | exercised |

**Live mutation proofs run by this review** (both reverted with the Edit tool; `git status --porcelain` clean after each):

1. Appended 26 lines to `docs/features/ae4.md`'s `## Current state` (35→61 lines). `node scripts/check-docs-registers.mjs` → **exit 1**, `[HUBS] docs/features/ae4.md — Current state is 61 lines; cap is 60`. Reverted; re-run → exit 0.
2. Changed `docs/followups/follow-ups-open.md`'s `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` entry's real `**Closes when:**` clause to `PO to rule`. `node scripts/check-docs-registers.mjs` → **exit 1**, `[RATCHET] closesWhenPoToRule is 148, cap 147 — may only be lowered`. Reverted; re-run → exit 0, ratchets back to `147/147…`.

**Conclusion, Q2:** every arm this branch touched is proven able to red, either on a live subject today or by a self-test with an explicit, honest "0 live subjects" acknowledgment (CODES, HANDOFFS, the rules-staleness folded-scalar defect shape) — consistent with the task's framing that fixture-only is not itself a defect. No arm's "OK" here is a vacuous pass on an empty population it silently declared proven.

## Acceptance criteria (hub) — measured

| Criterion | Command | Result |
|---|---|---|
| CLAUDE.md ≤ 20,480 B | `wc -c CLAUDE.md` | **20,454** — pass |
| Zero retired-section citations | `node scripts/check-docs-registers.mjs` | 0 findings, 394 files scanned — pass |
| One projection of hub frontmatter | `ls docs/planning` (absent); `grep -n "features-rollup" PROGRESS.md` (0 hits) | pass — `docs/features/INDEX.md` only |
| `in_progress`/`gated` hubs have `## Session log` | HUBS arm, `npm run lint` | pass (see Q2 table) |
| Handoffs for landed units = 0 | `ls docs/handoffs/` | only `README.md` — pass |
| Register ≤ 160 KB | `wc -c docs/followups/follow-ups-open.md` | **151,978** — pass. Target re-set 120→160 KB at Wave 5: sound — headings had to stay verbatim (ADR 0186 Amdt 1, breaking 160-char compression) and the backlog merge added 33 entries the original 120 KB target predated; 152 KB is disclosed as the honest post-merge figure, not a compression that was later abandoned |
| Entries ≤20 lines, no inner `##` | FOLLOWUPS arm | pass (self-tested, live population clean per gate OK line) |
| Ratchets set (OK line) | `node scripts/check-docs-registers.mjs` | `closesWhenPoToRule=147/147 severityPerEmoji=135/135 severityUnrated=29/29 revisitWhenPoToRule=38/38 longHeadings=97/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=47/47` — pass |
| One link checker | `grep -c "function checkLinks" scripts/*.mjs` | **1**, in `check-docs-registers.mjs`; `check-progress-doc.mjs:92` imports it — pass |
| Status change ≤3 hand files | `docs/INDEX.md` § "Where a line belongs" + `docs/lead-playbook.md` §5 | Mostly true in observed practice (2 files for the completions this branch performed); the criterion's own enumeration omits the record file — F-4 |
| `npm run lint` | bare, redirected to a file (not piped) to preserve the real exit code | **exit 0** — 13 gates, `lint:rules` reports 10 rule files (11→10 confirmed) |
| `node scripts/build-features-index.mjs --check` | direct | **exit 0**, "6 hubs; index in sync" |

## Judgment calls

| Call | Ruling | Note |
|---|---|---|
| Register target re-set 120→160 KB | **sound** | disclosed math, pre-landing, not a post-hoc fudge |
| `unrated` severity for pre-watermark follow-ups | **sound** | explicit ADR 0186 Amdt 1(b), ratcheted (29/29), not silently invented |
| Headings kept verbatim + long-heading ratchet | **sound** | Amdt 1(a); citations by id/anchor would otherwise 404 |
| Archive-anchor exemption in `checkBugs` | **sound** | self-tested both polarities (lines 1327-1338), verifies the anchor rather than skipping the check |
| Resolved entry folded back inline | **sound** | consistent with 0185 D5 (resolved bodies live in the archive); one-off script correctly not left in the tree |
| README exclusion in handoff listing | **sound, and closed** | Wave 3 log flagged it as a gap with no fixture; `isHandoffFile` now has a direct self-test (line 1557) — the gap named in the session log was actually fixed, not just noted |
| Verdict regex widened to heading form | **sound** | proven not to admit `NOT APPROVED`/`CHANGES REQUESTED` (self-tests lines 1231-1250) |
| Four "index-only" archive sections, one held real bodies | **sound** | agents self-corrected against the plan's assumption rather than force-deleting a section that wasn't actually index-only |
| Three "double-filed" ids had one heading | **sound** | same self-correction pattern; not merging non-duplicates |

## Could not verify

- Whether the qualitative content of every one of the ~556 changed lines in the Wave 4 CLAUDE.md diff (beyond the ~20 sampled blocks above) has a home was not exhaustively re-derived line-by-line; the sample spans all nine sections plus § graphify per the task's instruction, but is a sample, not a full line-by-line diff replay.
- Whether `docs/progress/dm5-po-decisions.md` (F-2) is cited from any non-Markdown file (`.mjs`/`.sh`) was not checked — the sweep was `--include=*.md` only.
- The full ~5-hour `ARM=wrapper` ADR-0079 authz sweep and the pgTAP suite were not re-run; this review is documentation-only per its charter and the branch touched no application code, migrations, or RLS (confirmed by `git diff --stat main..HEAD` touching only `CLAUDE.md`, `PROGRESS.md`, `docs/**`, `.claude/**`, `scripts/*.mjs`, `.prettierignore`).
