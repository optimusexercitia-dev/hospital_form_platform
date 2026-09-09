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
