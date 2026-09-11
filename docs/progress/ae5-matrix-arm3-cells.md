# AE5-MATRIX-ARM3-CELLS — progress record

The arm-3 divergent cells enumerated: the inheritance ADR
[0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md) D3 promised AE5 would
receive, named as a unit at pre-AE5 Batch 9 by PO ruling **R9**. The unit's **summary** is its hub,
[docs/features/ae5-matrix-arm3-cells.md](../features/ae5-matrix-arm3-cells.md) § Current state;
this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `supabase/tests/vectors/authz_differential_cells.psql` and
`supabase/tests/vectors/authz-enforcement-manifest.json` as the **generators** produce them
(`scripts/gen-authz-differential-cells.py`, `scripts/gen-authz-matrix-cells.mjs`), never as
hand-edited text — gate 12 `lint:authz-vectors` `--check`s both; the arms' defining SQL as it
exists in the **live catalog** (never the migration text — ADR 0078); the pgTAP tests that consume
those vectors; the live QA finding at `docs/reviews/authz-ae4-review.md:99-101`, which is the
**existing home** for this work and must not be duplicated.

Decisions this unit DISCHARGES, never re-takes: ADR 0175 **D3**'s forward promise (a promise about
the hand-off, not a claim of completion). ⛔ It takes no new decision of its own unless the PO's
per-class rulings turn out to change a stated meaning, in which case the ADR number is
*highest on any live branch + 1*, re-measured at the moment of reserving — ⛔ never `0202` (reserved
and unfillable) and never `0204` (reserved); `0205` is **spent** (the grant-plane convention).

## Session log

### 2026-09-10 — unit opened; scope derivation begun, nothing built (lead)

**Why now.** The pre-AE5 remediation programme is exhausted by its own plan (`docs/plans/pre-ae5-remediation.md`
§2 — all ten batches concluded; §3's REMAINING SET is NONE), and §6 hands the successor choice to
the PO, naming three: ADR **0202** (F7 · F8 · `platform_role`, docs-only, due before AE5 increment
**2**), ADR **0204** (the `D` ceiling · the `search_path` convention, docs-only, both censuses
already written into their follow-up bodies, no ordering constraint), and this unit (due before
increment **1** runs its **matrix**). The PO said *"continue implementation of AE5"*, was shown the
three sized plus the barred fourth — starting **AE5 increment 1 itself**, which ADR 0155 G1 keeps
post-pilot and which plan §6 twice says no successor starts — and chose **`AE5-MATRIX-ARM3-CELLS`**.
⛔ AE5 proper remains unstarted; this unit is its precondition, not its first increment.

**Preconditions, measured rather than assumed** (plan §6 step 1): `git status` porcelain empty on
`main` @ `44f69ff6`; `git rev-list --count origin/main..main` = **0** *after* `git fetch`;
`git worktree list` shows the one checkout; `docs/features/INDEX.md` read `in progress 0 · gated 3 ·
planned 3`. Branch `authz-ae5-matrix-arm3-cells` cut off `main` **before** the hub was flipped to
`in_progress` (gate 13 resolves an `in_progress` hub's `branch:` against local branches).

⚠ **A changed basis, found by re-measuring instead of quoting.** `docs/plans/pre-ae5-remediation.md`
§2 row 10 — the ONE durable home for merge and push state — recorded Batch 10 as ff-merged at
`ef2625f2` with *"25 commits unpushed at close"* and ⛔ **NOT pushed**. Re-measured here after
`git fetch`: `origin/main` = `main` = **`44f69ff6`**, so `main` **has since been published** (that tip
plus the two docs commits that followed it). ⛔ The row is not wrong — it records what that Record
step *did*, and it told its reader to re-measure rather than quote; this is the divergence that
instruction exists to catch. The correction was written **into row 10 itself**, not here. ⛔ Nothing
in this session pushed anything, the push's authorship is **not established**, and *"do not push"*
remains the standing instruction (§6).

**Migration head pair at open:** `(20261003007390, 528)` — keyed on the **pair**, never "head N"
(Batch 7). ⚠ This matters immediately: the hub's three headline figures (**216** `org.professionals.read`
rows, first at `:456`; `grep -c divergent` = **0**; the manifest's `:1240` sentence) were measured
**2026-09-09 at `(20261003007360, 525)`** — three migrations back. They are **re-derived at this
tip before any of them is used**, never quoted forward.

**`.claude/claude-md-review-queue.md` — deliberately deferred, not skipped silently** (plan §6 step
4; the file is **gitignored and therefore per-clone**, so another clone's state says nothing about
it). Measured **on this clone**: 3,041 bytes, **3** entries, all stamped 2026-09-10. Read in full at
open. Every entry is a truncated mid-sentence transcript fragment from a session whose work is
already merged and recorded — two echo findings those sessions **state they fixed** (*"MAJOR-1 (hub
Current state) | PARTLY | four stale sections fixed"*), and one is the hook logging the act of
processing the queue (*"claude-md: process the CLAUDE.md review queue"*). ⇒ deferred to **this
unit's Record step**, which lead-playbook §4 step 7 already makes the trigger. ⛔ This is a
disposition, not a claim that the queue is empty.

**Delegation.** Two read-only Explore agents were spawned at open rather than reading the surface
into the lead's context (CLAUDE.md §4 delegation floor; lead-playbook §1's measured 79k → 489k):
one over the AE5 programme (increment 1 and its *matrix*, ADR 0155 G1's exact bar, the live QA
finding, and the re-measurement of the three headline figures), one over the two generators, the
arms' concrete SQL, and the pgTAP consumers. ⛔ Nothing was built, generated or migrated this
session; the tip differs from `main` only by the hub flip, this record and the index rebuild.

**⭐ Found at open, before any recon returned — the constraint that shapes the build.**
`authz_differential_cells.psql` is **generated** by `scripts/gen-authz-differential-cells.py`, and
`npm run lint:authz-vectors` (gate 12) runs `--self-test` **and** `--check` on it and on
`scripts/gen-authz-matrix-cells.mjs`. ⇒ the divergence labels this unit owes must land **through
the generator**; a hand-edit of the `.psql` reds gate 12 by construction. This is also what makes
the hub's *"derived not eyeballed"* criterion mechanically enforced rather than aspirational.
