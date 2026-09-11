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

**⛔ The local catalog was ONE migration behind the tree, and the missing one is this door's own
arm 1.** Measured before any derivation: `select count(*), max(version) from
supabase_migrations.schema_migrations` returned **`527 | 20261003007380`**, while the tree carries
**528** files with head **`20261003007390`** (`20261003007390_admin_arm_follows_account_state.sql`
— Batch 10's change to `app.is_admin()`, `app.is_admin_for()` and `public.assume_role`). ⇒ the live
stack was serving the **pre-Batch-10** admin arm, and `app.can_read_professional_profile`'s **arm 1
is `is_admin()`**. Deriving the candidate population against that stack would have labelled arm-3
divergence over a door whose *first* arm was a migration stale — the exact "text is not truth"
inversion, running in the opposite direction (here the **catalog** was behind the **tree**).
⇒ a fresh `supabase db reset --local` precedes any derivation, and the head pair is re-asserted
**after** it. ⛔ The three catalog facts read at that stale head (`prosecdef = t` and
`search_path=app, public, pg_catalog` on `can_read_professional_profile`, `can_manage_professional`
and `can_create_professional`) are recorded here as **discarded**, not as findings.

**Recon returned — three facts that reshape the acceptance criteria, and one defect found in passing.**
Both Explore agents read documentation and scripts only; ⛔ every catalog claim below is held
**unconfirmed** until re-read from the live catalog after the fresh reset (ADR 0078).

1. ⛔ **The generator CANNOT derive a label from the live catalog — it is catalog-free BY DESIGN.**
   `scripts/gen-authz-differential-cells.py` reads exactly one file (`authz-matrix-axes.json`,
   sha-stamped into its own header) plus two in-script constants (`REPS`, and `expected()`
   transcribing the 9-row deny-class effect table); its imports are `io, os, json, sys, hashlib` —
   no driver, no `psql`, no `DATABASE_URL`. The sibling `scripts/gen-authz-matrix-cells.mjs` is the
   same. That is deliberate: gate 12 (`lint:authz-vectors`) must run **without Docker**, so the
   live-catalog binding is pushed into pgTAP (`401` §12, `410` §2) instead. ⇒ the hub's criterion
   *"the label **derived** from the live catalog and the generator"* names **two** derivations that
   cannot happen in one place, and this unit must **choose the seam**, not assume it. ⚠ This is a
   design decision the criterion does not anticipate and it is put to the PO before anything is
   generated.
2. ⛔ **Retiring the `:1240` sentence reds NOTHING as things stand.** The field is
   `permissions["org.professionals.read"].legacyEquivalence.qualifier`; only `.gate` and `.expected`
   are emitted into `authz_enforcement_manifest.psql` (as `legacy_gate` / `legacy_expected`), and
   `grep -c qualifier` over the emitted psql is **0**. The qualifier and its sibling `.openArms` are
   **narrative-only and ungated** — they cannot go stale loudly. ⇒ the hub's criterion *"retiring
   them means the oracle covers arm 3, not that the sentence was deleted"* is correct **and**
   under-specified: the work is to give arm-3 coverage a **checked consumer**, and the sentence
   retires as a consequence.
3. **The oracle seam is a column, and it is identified.** `403_ae45_differential_oracle.sql` loads
   the vector at `:100`; §4.1 (`:441-450`) asserts `legacy is not distinct from catalog` per cell and
   §5.1 (`:453-470`) is the oracle proper — `catalog is distinct from expected_granted` must be
   empty. Today's oracle is the `expected_granted` column with `expected_source` as its provenance
   (9 values; the generator's arm6 refuses a blank `expected_source`). A divergence label plugs in as
   a **12th column** on the same `values` tuple, with its own coverage arm and a §5.1 partition.
   ⚠ `--check` on both generators is **byte-identical regeneration** (CRLF-normalised), not a hash
   and not a parse — so the label lands through the generator or not at all.

⭐ **DEFECT FOUND IN PASSING — the manifest row contradicts itself, and only the ungated half is
wrong.** `authz-enforcement-manifest.json:1239` `.openArms` names `app.can_create_professional`,
while the **emitted, gated** `residual_legacy_authority` for the same row names
`app.can_manage_professional` (`authz_enforcement_manifest.psql:64`). The re-key that inlined
`can_create_professional` moved one half and left the other. ⛔ Not filed as someone else's problem:
`openArms` is this unit's own subject line — it is the list of arms whose divergence is being
enumerated — so it is corrected **in this unit**, and the correction is the first evidence that
narrative-only manifest fields drift silently (fact 2's general case).

**The live door read from the catalog, and the population factorized as a SET.** After a fresh
`npx supabase db reset --local` (exit 0) the stack is at **`(20261003007390, 528)`** — the tree's own
head pair. `pg_get_functiondef(app.can_read_professional_profile)` read from `pg_proc` (⛔ never the
migration text) confirms **four grant terms in three structural arms**: arm 1 `app.is_admin_for(p_uid)`;
arm 2a `app.can_manage_professional(v_org, p_uid)` and arm 2b `authz.has_permission(p_uid,
'organization', v_org, 'org.professionals.read')`, both gated on `v_org` derived from the SUBJECT's
`professional_profiles.organization_id`; arm 3 the `professional_participants` → `case_participants`
(`removed_at is null`) → `app.can_read_case_committee(cp.case_id, p_uid)` traversal, whose own live
body is `app.can_read_case(...) and not app.is_oversight_only_reader(...)`. ⭐ The live body's own
comment states the divergence in the tree's words: *"this arm grants with NO org term at all and its
cells are exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3)"*.

The 216-cell population, derived from the vector rather than the generator's loop and stated as a
**set**: persona {`subject_holder`, `other_commission_holder`, `cross_org_actor`, `unprivileged`} ×
activeContext {`matching`, `other_role`, `absent`} × scope {`own_commission`, `sibling_commission`,
`foreign_org_commission`} × principalState {`active`, `pending`, `suspended`, `deactivated`} ×
`self_check` {t, f}, **minus** the exclusion that `absent` occurs only for `unprivileged`
⇒ 3 × 48 + 72 = **216** ✓. Current expected values partition 30 grant / 186 deny across 8
`expected_source` values. ⛔ **No axis encodes case participation**, so arm 3's reachability is
orthogonal to every swept coordinate — which is *why* the cells are exercised but not oracled, and it
is the structural reason a label cannot simply be computed over the axes as they stand.

**⭐ `openArms` corrected — and the gating model corrected with it.** The stale narrative half named
`app.can_create_professional` (inlined away by the re-key) and listed **three** arms; it now names the
**four** terms read from the live catalog, which is exactly the set the *emitted* `authorizer_composed_with`
already carried. ⚠ **The recon's claim that editing a narrative manifest field "reds nothing" is WRONG,
and the gate itself refuted it within a minute:** the edit drove `lint:authz-vectors` straight to
`DRIFT`. Regenerating showed the whole emitted delta is **one line in each output — the manifest's
`sourceSha256` / `manifestSha256` provenance stamp** (`205b9aa4…` → `a2f9fe85…`). ⇒ the accurate model
is that `openArms` and `qualifier` are **content-ungated but provenance-gated**: no assertion reads
their text, yet no edit to them can pass unnoticed either. That matters for criterion 3 in both
directions — deleting the qualifier is **not** silent (it reds until regenerated), but regenerating
greens it, so ⛔ the gate still cannot tell a retirement that earned itself from one that did not.
Gate 12 re-run after regeneration: **exit 0**, `in sync (1080 cells … / 2002 cells … manifest 43 rows)`.
