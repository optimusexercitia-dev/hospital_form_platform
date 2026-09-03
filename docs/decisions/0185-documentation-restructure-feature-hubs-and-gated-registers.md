# ADR 0185 — Documentation restructure: feature hubs, CURRENT.md, and gated registers for bugs, follow-ups and lessons

**Status:** accepted
**Date:** 2026-09-03
**Area:** documentation / tracking apparatus
**Amends:** ADR 0124, ADR 0139, ADR 0140, ADR 0179
**Related:** ADR 0127 (rules home + staleness gate), ADR 0048 (the D-numbered decision shape this ADR copies)

> **Number.** This ADR was written as **0183** — the highest number on any live branch at the time
> (0182) plus one, not the "next free" the index on its branch reported (0180) and not `main`'s
> (0172). Parallel branches that each take the index's next free number collide with zero merge
> conflicts and every number wrong (two sessions once both filed an "ADR 0050"), so the paragraph
> said: *if a sibling branch claims 0183 first, this file is renumbered at merge.* **It happened the
> same day** — `authz-ae4-catalog` filed its own 0183 (P2 invocation-count re-specification) and
> 0184 (C2 sweep) while this branch was in flight, and `lint:adr-index`'s duplicate detector caught
> the pair at the rebase. Renumbered to **0185** on 2026-09-03, at the rebase onto `3b21826b`; the
> branch name `docs-restructure` is the stable key. Decisions are cited as `ADR 0185 D<n>`.

## Context

The PO reported that documentation inconsistencies had cost work, and named four shapes on
2026-09-03: the state of a feature under construction is scattered across plans, ADRs, handoffs
and PROGRESS.md; PROGRESS.md sits at or above its size cap continuously; follow-ups are poorly
documented; bugs are poorly documented. A survey of the tree on the same day measured each:

| Measurement (2026-09-03, commit cccfb0ba) | Value |
|---|---|
| Recent doc commits whose subject is "corrected a false claim in the docs" | 14 of 60 |
| PROGRESS.md bytes; bytes remaining if § Now, § Bug Log, § Critical FUP, § Follow-ups leave | 48,191 → 12,086 |
| Branches with work in flight | 3 branches + 1 worktree |
| Distinct code prefixes in `BUG-` / `FUP-` ids, with no legend anywhere | 72 / 123 |
| Open-register entries carrying the literal `**Filed:**` / `**Owner:**` / `**Severity:**` fields their own template mandates | 11 / 27 / 11 of 156 |
| Open-register entries with no closing condition | 68 of 156 |
| Deferred-backlog bullets with no revisit signal | 31 of 62 |
| Closed bugs recording a root cause / a reproduction | 61 % / 65 % |
| `BUG-` ids cited in ADRs or plans but registered in neither bug register | 10 |
| Files referencing `PROGRESS.md` by path (blast radius of moving it) | 600 |
| ADRs on this branch / mean length in lines, against CLAUDE.md §8's "5–10 line ADR" rule | 178 / ~184 |

Three facts the proposal that prompted this ADR had not accounted for: a glossary already exists
(`CONTEXT.md`, root) and CLAUDE.md references it zero times; the `handoff` skill's convention
(24 KB cap, stale-branch sweep, no inbound citations) **has no gate** — the skill says so itself
and names `scripts/check-handoffs.mjs` as "the durable form, and this skill is the interim";
ARCHITECTURE.md has no admission rule — its only text about what belongs in it is the phrase
"extend, never contradict".

> ⚠ **Correction (2026-09-03, same day, commit after 8cdc1549).** The first version of this
> paragraph said the skill "cites a gate that does not exist". False: the skill correctly states
> the gate does not exist yet. The claim came from a survey paraphrase and was written into this
> ADR without reading the sentence it summarized — the exact class this ADR is about. Left
> visible rather than silently fixed.

## Problem

The failure is **prose rot**, not missing structure: records that were true when written and
that nothing can contradict once they go false. Every register in this tree that lacked a gate
rotted (ADR 0124, 0127, 0140, 0179 each record one). The proposal under evaluation was a
generic documentation standard; its parts either duplicated machinery that exists here under
other names (Architecture Rules = invariants, PHASES.md = roadmap, phase-ledger = roll-up,
program codes = feature ids), or reintroduced a failure already paid for (an index beside its
bodies; sequential ids across parallel branches; a 600-file path move). The parts that survive
are those that trace to a measured failure above **and** can be given a gate that reds.

## Decision

Eight decisions, numbered so CLAUDE.md and later ADRs can cite them as `ADR 0185 D<n>`.

### D1 — Feature hubs keyed on the existing program codes

- One file per unit of work under **`docs/features/<code>.md`**, where `<code>` is the program /
  wave code already used in ids and file names (AE4, DM5, AFF2, …). A unit earns a hub when it
  has **its own branch or its own phase gate**. A follow-up worked on a branch gets a hub with
  `kind: fup-fix` pointing at its register entry.
- **YAML frontmatter** (hubs are a new file class; `.claude/rules/` and the handoff already use
  YAML — ADR headers keep bold labels, see D8): `id`, `title`, `status`, `kind`
  (`feature` | `fup-fix`), `program`, `phase`, `branch`, and links `plan`, `progress`, `reviews`,
  `adrs`, `handoff`.
- `status` ∈ `planned` · `in_progress` · `gated` · `complete` · `parked`. Gate cross-checks:
  `complete` ⇒ a `phase-ledger.md` row **or** an `APPROVED` review file; `in_progress` ⇒ a line in
  CURRENT.md (D2); `parked` ⇒ a `Revisit when` line in the hub.
- Body: the feature's **acceptance criteria** as the checkable list (forward-only — the criteria
  already written in PHASES.md, `docs/phases/accreditation-track.md` and `docs/plans/` stay where
  they are and are linked), and the **Current-state block** (D2).
- **`docs/features/INDEX.md` is generated** from hub frontmatter by
  `scripts/build-features-index.mjs` and byte-compared by the gate, the pattern
  `build-adr-index.mjs` already proves out.
- **`docs/features/legacy-codes.md`** is a hand-written legend for the historical prefixes,
  top ~20 by frequency, one line each. New `BUG-<CODE>-…` and `FUP-<CODE>-…` ids must use a code
  that is either a hub or in the legend; the gate reds on an unregistered code. Legacy ids are
  untouched.
- Hubs now: **AE4**, **C2 Tier 1**, the **scope-reaches fix** (`fup-fix`), the **C1b disposal
  rehearsal**, **DLB** (`planned`). From this ADR on, **a hub exists before a branch is cut.**

### D2 — CURRENT.md, and the Current-state block that lives in each hub

- **`docs/planning/CURRENT.md`** is a list of in-flight codes — one line and a link each — and
  nothing else. Gate: exact correspondence with hubs whose `status` is `in_progress`, both ways.
- The live working state lives **in the owning hub**, in a `## Current state` block with six
  fixed sections in fixed order: `Updated`, `Objective`, `Done since start`, `In progress`,
  `Next`, `Blockers`. **Replace, never append.** Hard cap **60 lines** per block. When the hub's
  status flips to `complete`, the block is cut into the feature's progress record and may no
  longer exist — an accreting "Done" list is what made § Now a diary.
- **"Always maintained" is enforced, not asked for:** when the current git branch equals the
  hub's `branch:` field, the block's `Updated` date may not be older than the newest commit on
  that branch touching `src/`, `supabase/` or `e2e/`. The check is skipped on `main`. The
  existing Stop hook reminds; the gate reds.
- This block **replaces PROGRESS.md § Now** (see D6). Handoffs (`docs/handoffs/`) are unchanged:
  on demand, via the skill, for a fresh session's full pickup.

### D3 — One bug register with a status column

- **`docs/bugs/BUGS.md`**: one table row per bug — id, status, severity (D4), area, one-line
  description, opened, closed, related (what produced it: a feature code, a gate, a review), doc
  link. Every known id gets a row: the ~152 archived, the 2 open, and the **10 ids cited in ADRs
  or plans but registered nowhere**, which enter as `untriaged` for the PO to rule on. A status
  cell replaces the open-section → archive **rotation**, which the record shows is chronically
  skipped.
- `docs/progress/bug-log-archive.md` moves to **`docs/bugs/archive.md`** with its bodies intact
  (named by zero scripts; its 24 referencing files are repaired in the same commit).
- A bug gets **its own document**, `docs/bugs/<ID>.md`, when severity is high or above, when
  root cause needed investigation, or when it reopened. Template sections: Symptom, Expected,
  Actual, Reproduction, Impact, Investigation, Root cause, Fix, Regression protection, Related
  code, Lesson, Resolution. Gate: a row may not carry `fixed` while its document exists with an
  empty `Root cause` or `Regression protection`. Forward-only; archived bodies are not split.
- New ids: **`BUG-<CODE>-<short-slug>`**, the shape `FUP-` ids already have. Sequential numbers
  collide across parallel branches; slugs do not.
- PROGRESS.md § Bug Log becomes a pointer (D6).

### D4 — One severity scale for bugs and follow-ups, defined by what the item blocks

| Level | Emoji | Definition |
|---|---|---|
| `catastrophic` | ⛔ | PHI exposure, a cross-tenant read, or data loss |
| `critical` | 🔴 | blocks the pilot, or returns a wrong authorization answer |
| `high` | 🟠 | blocks a phase gate |
| `medium` | 🟡 | wrong behaviour with a workaround |
| `low` | 🟢 | cosmetic or documentation |

The two 🔵 follow-ups are re-rated. Existing 🔴 entries keep `critical`; any that meets the
`catastrophic` definition is flagged for the PO. The gate reds on any other value.

### D5 — Follow-ups: ADR 0179 stands, the register moves and gains fields, § Critical FUP moves in

- ADR 0179's one-open-register / separate-archive design **stands** (a merged table would
  recreate the index-beside-bodies shape that produced 27 double-registered items).
- The three files move to **`docs/followups/`** (`follow-ups-open.md`, `follow-ups-archive.md`,
  `deferred-backlog.md`); their ~75 reference sites in scripts, rules, the handoff skill and docs
  are repaired in the same commit, proven by the LINKS gate.
- **§ Critical FUP leaves PROGRESS.md** for a pinned `## ⭐⭐ Critical` section at the **top** of
  the open register — it cannot be buried at the top of the file it indexes. It stays PO-curated
  and additive (trigger + deadline on an item that keeps its entry); the orphan check is
  retargeted. **This reverses ADR 0179's "§ Critical FUP stays in PROGRESS.md unchanged"** and
  the "one protected section" sentence in CLAUDE.md §7.
- **Field gate** on every entry: `**Filed:**`, `**Owner:**`, `**Severity:**` (D4),
  `**Closes when:**`, and `**Revisit when:**` for anything parked. All 156 entries are
  normalized in one pass (the data is present in prose in most of them); the 68 with no
  derivable closing condition get `**Closes when:** PO to rule` — never invented text — and
  reach the PO as a list.
- `deferred-backlog.md` converts from bullets to entries with a **mandatory** `Revisit when`;
  the 31 with no derivable trigger get `PO to rule` the same way. Parked work with no trigger is
  lost work with a nicer name.

### D6 — PROGRESS.md becomes the roll-up

- **Keeps:** `## Phase Status` (live rows), a **generated feature roll-up** between
  `<!-- features-rollup:start/end -->` markers (written by `build-features-index.mjs`,
  byte-compared), `## State` (the live remote facts), and pointers.
- **Leaves:** `## Now` (→ hubs' Current-state blocks, D2), `## Bug Log` (→ D3),
  `## ⭐⭐ Critical FUP` (→ D5), `## Follow-ups` (pointer already; folded into the header),
  `## Decisions` (one-liners duplicating the generated ADR index → `docs/decisions/INDEX.md`),
  `## Test Run Summary` and `## QA Verdicts` (per-feature results → the owning hub).
- **Cap: 20 KB target, 30 KB hard** — amends ADR 0124 Amendment 3 (80 / 100 KB), whose headroom
  problem this removes at the source rather than by ratchet.
- **§ Now rotations end** — amends ADR 0139: the quarterly `docs/progress/<YYYY>-Q<n>.md` files
  stay as history and receive nothing further.
- `scripts/check-progress-doc.mjs` `REQUIRED_SECTIONS` / `CAPPED_SECTIONS` / size constants and
  `.claude/rules/progress-contract.md` change in the same commit.

### D7 — Lessons and postmortems

- **`docs/learning/LESSONS.md`**: one row per lesson — `LEARN-NNN`, area, lesson, origin,
  **enforcement**. Enforcement names a gate (`lint:x`, `ARM=census`, a pgTAP file), a spec, a
  `.claude/rules/` file, or the literal **`prose only`**, so a reader can tell a protected claim
  from an unprotected one. Anchors are checked the way `lint:rules` checks them. Sources at
  creation: the 17 lessons in `docs/progress/authz-handoff.md` §7, plus the session-memory
  lessons whose origin resolves to a repo record.
- **`docs/learning/postmortems/<LEARN-NNN>-<slug>.md`** for failures costly enough to deserve a
  file. Nine required sections: What happened · Why it happened · Why we didn't detect it
  earlier · What worked well · What failed · General lesson · Changes made · New rule · Applies
  to. **Any session may open one** — the same judgement that decides what enters memory — and
  the PO prunes. A postmortem shares its id with its LESSONS row (row = short form, file = long
  form). Gate: the nine sections are non-empty and the row exists. None is written by this ADR.

### D8 — The apparatus around them

- **`docs/INDEX.md`** maps `docs/` and states the **authority order**: live catalog > code >
  ARCHITECTURE.md > ADRs > trackers > generated files > historical — with the SQL exception
  (CLAUDE.md § graphify) stated, not implied. `docs/design/temp/` enters as historical.
- **CLAUDE.md**: the pointer list shrinks to the four root trackers + `docs/INDEX.md` +
  CURRENT.md; §7 is rewritten for the new homes; §8's dead "5–10 line ADR" rule is replaced by
  what ADRs are; the missing **`CONTEXT.md` pointer** is added. CONTEXT.md gains the authz jargon
  (door, gate, arm, keystone, BLIND, census, hat, floor, footprint, neutralizer, noun rule).
- **ARCHITECTURE.md** gains an admission header (binding rules + the canonical-schema list only;
  the catalog wins on any schema fact) and an **`Enforced by:`** line under each of Rules 1–13
  naming the gate, test or rule that asserts it — or `prose only`.
- **ADR headers** gain `**Area:**` and `**Related:**` labels (no edge verb, so the index ignores
  them by construction — verified against `parseEdges` before this file was written); new ADRs
  carry *Considered options* and *Consequences* sections, as this one does.
- The handoff gate the skill asks for **is built**, as an arm of `lint:registers` rather than a
  separate `check-handoffs.mjs`: a 24 KB cap on `docs/handoffs/*.md`, a red when a handoff's
  `branch:` no longer exists, and the **inbound-citation check** ("a handoff may not be cited" —
  citations allowed only from hubs, CURRENT.md, other handoffs and review files).
- All of the above land in **one new gate**, `scripts/check-docs-registers.mjs`, wired as
  **`lint:registers`** (the 13th link of `npm run lint`), self-tested on every run like
  `check-progress-doc.mjs`, and documented in `docs/lint-gates.md`.
- **Admission rule for this and every later register:** no register or field ships without a
  gate that can red on it. A claim no gate reads is labeled `prose only` where it stands.
- **Not adopted, on purpose:** `INVARIANTS.md` (Architecture Rules 1–13 already are, cited by
  number in 261 files), `ROADMAP.md` with status (a third status copy), `PROJECT.md` /
  `DOMAIN.md` (CLAUDE.md §1 is the auto-loaded copy), YAML ADR headers (178-file rewrite for no
  new capability), `FEAT-NNN` sequential ids, and moving any root tracker.

## Considered options

- **A — adopt the proposed documentation standard wholesale.** Rejected: it duplicated the
  invariants, roadmap and roll-up under new names, converted 178 ADRs for no new capability,
  moved files that 600 / 261 / 191 others reference, and introduced sequential ids that
  collide across the three live branches.
- **B — keep the structure, only tighten enforcement of the existing contract.** Rejected: the
  scattering of feature state has **no home to enforce into** — § Now cannot be gated into shape
  while every branch appends to one section on `main`; a per-feature owner is the precondition.
- **C — the subset above, each item traced to a measurement and given a gate.** Chosen.

## Consequences

- PROGRESS.md drops from 48 KB to roughly 12 KB plus a generated table; three in-flight branches
  rebase once and re-home their § Now text into their hubs — a migration that had to happen for
  the AE4 hub anyway.
- `npm run lint` grows from twelve gates to thirteen; CLAUDE.md §8's count and §7's homes are
  rewritten with the PO's diff approval.
- Roughly 75 + 24 link sites are repaired for the two file moves; the LINKS gate proves it.
- The PO rules on three lists as they surface: 10 untriaged bugs, 68 blank closing conditions,
  31 blank revisit triggers — plus any 🔴 flagged as `catastrophic`.
- ADR 0179 is amended in one clause; 0124 Amdt 3's caps, 0139's rotation target and 0140's
  PROGRESS.md-side gate list are superseded in the parts D6 names; everything else in them
  stands.

## Implementation constraints

- **Gates land before the data they protect**, or the migration ships unchecked.
- `lint:progress` (gate 7) is green at **every** commit on the branch, which fixes the order:
  new files first, the PROGRESS.md cut and the follow-up move last, in one commit with the
  CLAUDE.md and contract edits they invalidate.
- No root tracker moves. Work is on the `docs-restructure` worktree cut from the AE4 tip
  (`main` is 106 commits behind and still holds the pre-0179 register); it merges **after** AE4.
- A read-only reviewer answers one question before merge, in
  `docs/reviews/docs-restructure-review.md`: does every new register have a gate that can red.

## Related implementation

- `scripts/check-docs-registers.mjs` (`lint:registers`) · `scripts/build-features-index.mjs`
  (`features:index`, `--check`)
- `docs/features/` · `docs/planning/CURRENT.md` · `docs/bugs/` · `docs/followups/` ·
  `docs/learning/` · `docs/INDEX.md`
- `scripts/check-progress-doc.mjs` · `.claude/rules/progress-contract.md` · `CLAUDE.md` §§ 7–8 ·
  `ARCHITECTURE.md` header · `CONTEXT.md` · `.claude/skills/handoff/SKILL.md` · `docs/lint-gates.md`
