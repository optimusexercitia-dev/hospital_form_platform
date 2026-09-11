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

**⭐ The build shape was written into `403` §7.3 by the batch that deferred this work — it is an
instruction to this unit, and it was found by reading the test rather than the plan.**
`supabase/tests/403_ae45_differential_oracle.sql:612-618` asserts *"ARM 3 CANNOT GRANT IN THIS
FIXTURE"* as `count(professional_participants for the two subject profiles) = 0`, and its own message
says why that number exists: *"⛔ THIS IS THE PO-DEFERRED DIVERGENCE (ADR 0175 D3) … measuring THAT
needs **a participation fixture plus expected values the AE5 matrix owns**. Until then: exercised,
not oracled. ⛔ **If this reds because someone added a participation row, do not adjust the number** —
the arm just became reachable and its cells need approved expected values first."*

⇒ three consequences, none of them optional:
- The sentinel is a **`0` that this unit is expected to break**, and breaking it is progress, not a
  regression. ⛔ It may not be renumbered to match a new fixture; §7.3 is **replaced** by assertions
  that say where arm 3 grants and what the approved answer is.
- **The order is fixed by the message**: approved expected values come **before** the participation
  fixture lands, not after. That is the same ordering the hub's criterion 2 states independently.
- ⭐ This is the **checked consumer** fact 2 said the qualifier retirement needs. The manifest
  sentence retires because `403` starts oracling arm 3 — not because the sentence was edited.

⚠ §7.2 is the sibling bound for arm 1 (*"no fixture principal is a platform admin"*), and its message
already states the asymmetry this unit inherits: *"a widening of arm 1 would be caught (catalog would
not move) and a defect INSIDE arm 1 would not."* ⛔ Recorded, not acted on: arm 1 is out of this
unit's scope, but the same reasoning applies to it and no row says so.

**Disposition of the stale-catalog finding — this record IS its home, decided against the bars
rather than by preference.** The finding ("the local stack can sit BEHIND the tree, so a catalog read
answers about the wrong head") was tested against the three candidate homes and rejected by two:
- ⛔ **Not `.claude/rules/`.** ADR [0127](../decisions/0127-standing-rules-home-and-staleness-gate.md)
  admits a rule only if it *"(a) declares machine-checkable `anchors:` and (b) is not already enforced
  by a gate or by code."* This prohibition is about a **method**, not a file class — there is no tight
  glob that would make it fire where it matters and nowhere else, which is the exact ground on which
  0127 rejected the supersession candidate (*"spans 8+ files, so the rule would fire everywhere or
  nowhere"*). It fails (a).
- ⛔ **Not `docs/learning/LESSONS.md`.** The table's `Enforcement` column feeds the
  `lessonsProseOnly` ratchet, which stands at **52/52** and *"may only be lowered"*. A new entry needs
  a real enforcer, and none is available: the lint chain is **Docker-free by design** (the reason gate
  12 is catalog-free in the first place), so no lint gate can compare `schema_migrations` against the
  tree; and a pgTAP mirror would have to pin a migration **count**, i.e. an expected value maintained
  by editing it every migration — which this tree already names as the anti-pattern (*"an expected
  value that tracks reality by being edited is not an assertion"*).
⇒ recorded here, in full, with the measurement that produced it. ⛔ A future session finding this
should not re-file it as a lesson or a rule without first supplying the enforcer that both bars want.

### 2026-09-10 — arm 3 derived against the live catalog; a live unmasked grant found (lead + backend)

`backend` derived the arm; ⛔ the two load-bearing measurements were **re-run by the lead with its own
SQL** rather than accepted — the teammate's numbers are cited only where the lead reproduced them.

**Arm 3 reduces to `content ∧ deliberation`.** `app.can_read_case_committee(c,u)` =
`can_read_case ∧ ¬is_oversight_only_reader`, which collapses to `C ∧ ¬(C ∧ ¬D) = C ∧ D`; both bits
come from `app._case_caps`, so `_case_caps` **is** arm 3's whole gate.

**Axis dependence, from the live bodies:**
- **(a) organization — NO term. ADR 0175 D3 CONFIRMED, not assumed.** Every tenancy term in
  `_case_caps` anchors on the CASE (`cases.commission_id`); `trg_assert_participant_same_org_as_case`
  binds `cases.organization_id = participants.organization_id`, and ⛔ **nothing** binds
  `professional_profiles.organization_id` to either. Proven by rolled-back probe with the trigger
  ACTIVE: an org-B profile on an org-A case gives `ARM1=f ARM2a=f ARM2b=f ARM3=t WHOLE=t`.
- **(b) account state — YES. ⭐ The lead's sharp worry is REFUTED.** `_case_caps` **STEP 2** is
  `if not app.is_active(p_uid) then return 0`, verified in `pg_get_functiondef` at `:23-24`.
  ⇒ suspended and deactivated principals close arm 3 outright. ⚠ **But `pending` is not an
  `is_active` state**: `app.is_active` reads only `profiles.is_active` and `suspended_until` — ⛔ no
  `email_confirmed_at` — while `403` models `pending` as `email_confirmed_at is null`. ⇒ arm 3 is
  **fully reachable on all 54 `pending` cells**.
- **(c) active_context — PARTIAL, and this is the finding.** S1/S5/S6/S7/S8 route through
  `has_role`/`has_role_any`/`holds_role`, each ending `… or <role> is not distinct from
  app.active_role()`. ⛔ **S3 (`case_access_grants`) and S4 (case assignment) contain no role lookup
  at all** ⇒ arm 3 survives **any** hat, including an absent one.
- **(d) self_check — no syntactic term**; one data-conditional correlation through
  `app.is_case_respondent` (role key `respondent_doctor`, joined on `prof.user_id = p_uid`).

**⛔ Two corrections to the lead's own brief, from the teammate, both accepted.** (1) In `403`
`self_check` is **not** *"subject == caller"* — it is *"the `p_uid` argument == `auth.uid()`"*; the
gate is always called as `can_read_professional_profile(<prof>, v_principal)`, and under `not p_self`
the hat term is **vacuously satisfied**, which is exactly why `other_role|third_party` expects GRANT
while `other_role|self` expects DENY. Under `not p_self` a cell's `active_context` label is
**decorative** (the caller's hat is hardcoded `quality_reviewer`). (2) Both live call sites pass
`auth.uid()`, so the hat does bind in production.

**⭐⭐ A LIVE, UNMASKED ARM-3 GRANT ON THE UNTOUCHED SEED — reproduced by the lead, own SQL, in a
rolled-back transaction, claims set so `auth.uid()` and `app.active_role()` bind.** Subject profile
`fb000000-…-00e1` (org `0c00…000a`), caller `chefe.ccih@test.local` (`…0002`):

| hat | whole_fn | arm1 | arm2a | arm2b | arm3 |
|---|---|---|---|---|---|
| `staff_admin` | **t** | f | f | **t** | t |
| `staff` | **t** | f | f | **f** | **t** |
| *absent* | **t** | f | f | **f** | **t** |

⇒ with no hat at all, three arms deny and **arm 3 alone answers `true`**. The reach is **S3**, not
S1: case `ca00…e1` is `explicit_grants_only` and chefe holds one live `case_access_grants` row; at
hat `staff` caps drop 111 → 6 while arm 3 stays true. ⚠ At `staff_admin`, **arm 2b also grants**, so
arm 3 is **masked** there — a differential written at that coordinate passes with arm 3 broken, which
is precisely what the manifest's `:1240` warned and what makes *"exercised, not oracled"* concrete.
⛔ Method stated: measured as `postgres` against the **function's answer**, not over the PostgREST
hop; the door is DEFINER and traverses base tables by design, so the hop is not what is in question.

**The classes, DERIVED — count first: FIVE, of which THREE diverge; 78 of 216 cells.**
`108 + 30 + 36 + 32 + 10 = 216` ✓ — a partition, not a sample.

| # | Class | Predicate | Cells | Diverges |
|---|---|---|---|---|
| 1 | Structurally blocked | `state ∈ {suspended, deactivated}` ⇒ STEP 2 returns 0 | 108 | no — ⛔ *and unreachable by any fixture* |
| 2 | Agrees but masks | `state ∈ {active, pending}` ∧ `expected_granted = true` | 30 | no — but arm 3 keeps them green for an arm they do not name |
| 3 | **DIVERGENT · not-a-holder** | `state ∈ {active, pending}` ∧ `persona = unprivileged` | **36** | **yes** — S3/S4 need no role and no hat; the only class that diverges at `active_context = absent` |
| 4 | **DIVERGENT · cross-org** | `state ∈ {active, pending}` ∧ (`cross_org_actor` at own/sibling [16] ∨ holder at `foreign_org_commission` [16]) | **32** | **yes** — proven live |
| 5 | **DIVERGENT · wrong-hat self** | `state ∈ {active, pending}` ∧ `self_check` ∧ `active_context = other_role` ∧ holder persona | **10** | **yes** — denied *only* by the hat term, which S3 ignores |

⚠ Class 1's 108 cells are **unreachable by any fixture**, so a participation fixture can never make
them speak — ⛔ they must not be counted as coverage.

**The proposed axis:** `case_reach ∈ {none, role_keyed, grant_keyed, unreachable}`, predicate *"the
subject profile is a live participant on some case, and the caller holds both `read_case_content` and
`read_case_deliberation` on that case"* — neither conjunct is a function of any swept axis except
`is_active`. `grant_keyed` (S3, hat- and role-free) is the divergence generator. ⭐ `unreachable` is
**mandatory**: without it every deny cell is satisfied by an **empty join** rather than by
`_case_caps`, which is the *"keystone that could not fail"* shape LESSONS opens with. 216 × 4 = **864**.
⇒ existing `scope` already selects the cross-org profile, so no second axis is needed.

⭐ **Classes 3 and 5 are demonstrable TODAY on the untouched seed** (the table above is class 5's
shape); only class 3's `unprivileged` persona and class 4's cross-org coordinate need new data.

**PO ruling R1 — THE SEAM IS GENERATOR-SIDE, AXIS-DRIVEN.** `case_reach ∈ {none, role_keyed,
grant_keyed, unreachable}` becomes a real axis in `authz-matrix-axes.json`; the generator computes the
divergence label from it exactly as `expected()` already transcribes the 9-row deny-class table; pgTAP
`403` binds the label to the live catalog through the participation fixture. ⇒ gate 12 stays
**Docker-free** and its `--check` stays **byte-identical**, and the label is derived from the door's
**structure**, encoded once and reviewably, rather than from a live read the lint chain cannot make.
⛔ Accepted cost, stated so it is not rediscovered as a defect: the transcription does **not**
self-update if arm 3's structure changes — **pgTAP is what catches that**, not the generator. Vector
growth for this rep 216 → **864** (overall 1080 → 4320).

**PO ruling R2 — CLASSES 3 AND 4 ARE APPROVED AS DESIGNED REACH; CLASS 5 IS A BUG.** The PO's
reasoning, recorded because it is narrower and sharper than the lead's and ⛔ the lead's framing was
**corrected by it**:
- **Classes 3 (36) and 4 (32) — approved.** *"The case-grant path deliberately anchors on the case,
  not on the caller's org or role. That is the whole point of an explicit grant. Narrowing it would
  silently break cross-org case collaboration that the referral module exists for."* ⇒ their 68 cells
  take **GRANT** as the approved expected value and the oracle **records** the divergence.
- **Class 5 (10) — a bug, but ⛔ NOT for the reason the lead gave.** The lead argued *"an absent hat
  fails closed everywhere else"*. The PO's reason is narrower and is the one that governs: *"The
  self-read cells in class 5 are readable only because the caller happens to hold a case grant on a
  case they participate in. The hat term was meant to say 'you cannot read your own profile while
  acting as another role'. Arm 3 makes that rule **unenforceable** for anyone with a case grant."*
  ⇒ the defect is a **rule made unenforceable**, not a fail-open. Named fixes, either acceptable:
  make the case-grant arm respect the active-hat check, **or** have the door evaluate the hat term
  **before** the arms rather than inside some of them.
- ⭐⭐ **The PO's caveat, which binds the fix and its test.** *"Class 4 and class 5 overlap
  conceptually. If the fix for class 5 adds a hat check inside arm 3, it must not accidentally add an
  **org** check, or class 4's approved reach breaks."* ⇒ the bug row says this explicitly **and the
  pgTAP guard for the fix must assert one class-4 cell STILL GRANTS** — a fix verified only by class
  5 going red-to-green would silently revoke an approved reach.

**Increment 1 built (backend) — the axis and the labels; ⛔ no fixture, no migration.** Files touched
were only `scripts/gen-authz-differential-cells.py`, `authz-matrix-axes.json` and the three generated
artifacts; `git status --porcelain` confirms no migration, no `src/**`, no `403_*.sql`, no seed, no
tracker. `npm run lint:authz-vectors` **EXIT 0**, read bare, Docker-free, `--check` byte-identical.
⭐ **RED-FIRST, unprompted**: with the axis declared and no disposition, coverage arm7 refused —
*"axis `caseReach` is declared in the axes JSON with NO disposition"*, exit 1 — before the sweep.

⛔ **The lead re-counted the vector itself rather than accepting the report**, and every figure below
is the lead's own parse of `authz_differential_cells.psql`: 4320 cells, **4320 distinct `cell_id`**,
13 columns; `expected_granted` true = **552 = 138 × 4** ⇒ ⛔ no existing expected value was edited;
arm-3 rep = **864 = 216 × 4**; the `arm3_divergence` census **sums to 864 — a partition, not a
sample**. ⭐ The cross-tabulation is the real result, and it is stronger than the summary:

| `case_reach` | labels | Σ |
|---|---|---|
| `grant_keyed` | blocked 108 · masking 30 · **cross-org 32** · **not-a-holder 36** · **defective 10** | **216** |
| `role_keyed` | blocked 108 · masking 30 · cross-org 24 · follows-the-hat 18 · needs-a-role 36 | 216 |
| `none` | no-participation 108 · blocked 108 | 216 |
| `unreachable` | caps-deny 108 · blocked 108 | 216 |

⇒ at `grant_keyed` the **original five-class partition is reproduced exactly** (108/30/32/36/10), which
is the independent confirmation that the axis encodes the derivation rather than re-deriving it. ⭐ And
class 5's ten cells become `silent:reach-follows-the-hat` at `role_keyed` — **the control proving the
hat rule DOES bind where the reach is role-keyed**, which is what makes the `grant_keyed` behaviour a
defect and not a quirk. ⭐ `unreachable` earns its mandate: it separates *"no participation row"*
(`none` → 108 `silent:no-participation`) from *"participation exists and `_case_caps` denies"*
(`unreachable` → 108 `silent:caps-deny`), so a deny is never satisfied by an empty join.

**Three corrections from the teammate, all accepted, all of which improve on the lead's brief:**
1. ⭐⭐ **It is TWO columns, not one.** `case_reach` had to become a real column (12), not merely a
   `cell_id` segment: arm7 resolves a swept axis through `CELL_AXIS_COL`, whose fallback is
   `emitted = declared` when an axis has no column index — so `missing` would have been **empty by
   construction** and arm7 could **never fire** for `caseReach`. ⛔ That is a *detector that could not
   fail*, on the very axis being added — LESSONS' opening shape, caught inside the increment that
   created it. The label is column 13.
2. **R2's "classes 3 and 4 take GRANT as their approved expected value" is deliberately NOT in this
   increment.** `403`'s driver has no `case_reach` branch yet, so it builds `none` for all four values
   and the door denies for want of a participation row; a GRANT expectation **today** would red `403`
   for a **fixture** reason wearing a **defect's** label. `expected()` therefore takes no `reach`
   argument, and gaining one is the reviewable event when the fixture lands. ⇒ R2 is **scheduled, not
   skipped**.
3. **The reach loop sits OUTSIDE the skip rules**, not as an inner fan-out — otherwise `skipped`
   counts pre-reach coordinates while `cells` counts post-reach ones: a census that cannot sum.

**Increment 2 — `caseReach` gate-scoped by a named rule, bound to the manifest by a new coverage arm
(`7aed31ea`).** Lead ruling, measured before it was taken: of the 4320 cells, **3456** belonged to the
four reps whose gates have **no case arm**, all carrying `arm3:not-in-gate`, over only **864 distinct
payloads** ⇒ **2592 exact redundant copies** that cannot discriminate anything. ⛔ The extra cells
bought no safety either: the `not-in-gate` label is itself computed from a static list, so **neither**
design would have noticed a new case arm. Same risk, 2592 rows cheaper, ~4× `403` runtime saved.

**Verified by the lead, independently, at the tip:** `lint:authz-vectors` **EXIT 0** bare; `in sync
(1728 cells, 10272 skipped)`; 1728 rows / **1728 distinct `cell_id`**; arm-3 rep **864**, its census
**sums to 864**, and its `grant_keyed` column is **108 / 30 / 32 / 36 / 10 = 216** — ⛔ byte-for-byte
the same partition as increment 1, so **zero arm-3 coverage was deleted**; the other four reps hold
864 cells, **all at `none`**.

⭐⭐ **Per-cell identity PROVEN, not argued** — the lead diffed the emitted row sets against `9ad8258b`:
of 1728 rows now emitted, **0** are not byte-identical to a HEAD row; exactly **2592** HEAD rows were
deleted and **none altered**. That is a stronger guarantee than the count the lead asked for.

⛔ **A LEAD CONSTRAINT WAS ARITHMETICALLY IMPOSSIBLE, AND THE TEAMMATE REPORTED IT RATHER THAN
ADJUSTING IT.** The brief demanded *"`expected_granted` true must stay **552**"*. ⛔ It cannot: 552 was
`138 × 4`, i.e. four copies of every rep's granted cells, and the ruling deletes three of those copies
for the four inert reps ⇒ `552 − 3 × (138 − 30) = 552 − 324 = **228**`. The lead re-derived it from the
other direction and got the same: arm-3 rep `30 × 4 = 120`, plus the four inert reps at `none` = 108
⇒ **228**, measured. ⇒ the constraint was the **lead's error**, carried over from increment 1 where it
was true; the teammate was explicitly told *"if your arithmetic disagrees, stop and tell me rather than
adjusting a number to fit"* and did exactly that. ⭐ The invariant the constraint was **protecting**
— *no existing expected value was edited* — holds, and is now witnessed by the byte-identity check
above rather than by a count that happened to be stable.

⭐ **`arm9` makes the standing condition a GATE, not a sentence.** It does not merely count `REPS`: on
**every run** it resolves the premise against the enforcement manifest's
`permissions[<code>].legacyEquivalence.openArms` — the field this unit corrected at open — so *"if any
other permission's `openArms` gains `app.can_read_case_committee`, revisit this exclusion"* is
enforced rather than hoped. It fires in **both** directions (a second armed rep; zero armed reps) plus
absent-rep and unreadable-manifest branches. Red-first on a **real invocation** in an isolated copy of
the tree (⛔ the real manifest never written — `git diff --quiet` CLEAN): arming
`org.case_vocabulary.manage` printed `COVERAGE FAILURE … arm9 … assumes exactly
{can_read_professional_profile}`, exit 1; untouched control exit 0.

⭐⭐ **A PRE-EXISTING HARNESS DEFECT SURFACED BY ADDING arm9, and it is the general case worth keeping.**
arm9 **silently took over the `arm1b` self-test fixture** — arm1b's fake rep code was absent from the
manifest, so arm9 fired first and the runner printed **arm9's** message under **arm1b's** name. The
old criterion was `if not got`, i.e. *"did something catch?"* — which calls a **wrong-arm** catch a
pass. ⇒ the runner now asserts **which** arm fired and prints the fired list, the fixture was
re-pointed at a real permission, and **two further pre-existing contaminations became visible** that
nothing could see before. Controls caught: **19** (was 14), zero `NOT CAUGHT`, zero `WRONG ARM`,
discrimination control clean; `--self-test` exit 0.

**Increment 3 — `403` now ORACLES arm 3. ⛔⛔ AND THE LEAD'S BRIEF WAS WRONG ON ITS CENTRAL ITEM.**
The brief said *"give `expected()` its `reach` argument so R2's GRANT values land"*. ⛔ That would have
**RED** `403`, not greened it, and the teammate **measured it instead of building it**:
`expected_granted` is what §5.1 compares against **`authz.candidate_has_permission`** — a
role/permission resolver with **no case arm at all**. Measured live at the class-4 `grant_keyed`
coordinate: door `t` (arm1 f · arm2a f · arm2b f · caps 6) versus catalog `f`. ⇒ arm 3's divergence is
**legacy-vs-catalog (§4)**, ⛔ **not** catalog-vs-matrix (§5), and the catalog resolver is **RIGHT to
deny** — the lead's brief would have written an arm-3 grant into the expectation for a resolver that
correctly has no arm 3. ⭐ R2's GRANT therefore landed in a **new 14th column
`expected_legacy_granted`**, and `expected()` is **unchanged**.

**Lead's own verification at the tip** (⛔ the lead, not the builder, ran the arms — the hub requires
it): `git status --porcelain` shows only the six permitted files — no migration, no `src/**`, no
seed, no manifest, no tracker. `lint:authz-vectors` **EXIT 0** bare, `in sync (1728 cells, 10272
skipped)`. ⭐ **Per-cell proof, re-run by the lead**: strip the appended 14th column from all 1728
rows and **0** differ from `63b46a06` ⇒ the first 13 columns are **byte-identical** and the entire
change is the new column. `expected_granted` **228 / 1500 → 228 / 1500 — zero movement**;
`expected_legacy_granted` = **320** true; **flips = 92**, and they fall on
`cross-org@role_keyed 24 + cross-org@grant_keyed 32 + not-a-holder@grant_keyed 36` — ⛔ **only**
approved labels. `grant_keyed` partition unmoved at **108 / 30 / 32 / 36 / 10**. Class 5: **10** cells,
approved legacy answer true on **0** ⇒ the filed defect is **not** encoded as approved reach.
`403` run by the lead: **EXIT=0, Files=2, Tests=28, 0 `not ok`, Result: PASS**.

**§7.3 REPLACED, not renumbered** — `grep -c "ARM 3 CANNOT GRANT IN THIS FIXTURE"` = **0**. What now
stands: **§7.3** the whole `grant_keyed` column with each partition's approved legacy answer;
**§7.3b** the four reaches measured live at a coordinate where arms 1 and 2 are false — ⭐
`unreachable` and `grant_keyed` differ by **one `case_access_grants` row and nothing else**, which is
what makes a deny mean `_case_caps` denied rather than an empty join; **§7.4** the filed defect pinned
by shape; **§7.5** the class-4 guard; **§4.1b** paying for §4.1's carve-out with a value.

⭐⭐ **Mutation-proven, and it WIDENS the PO's caveat — recorded into the bug body.** Three mutants on
scratch copies, real `403` untouched: **A** (org check inside arm 3) reds §4.1b/§7.3b/§7.4/**§7.5**;
**B** (grant row removed) reds the same four; **C** (a **hat** check inside arm 3 — *the intended
fix*) reds §7.4 and leaves **§7.5 GREEN** ⇒ the PO's caveat demonstrated. ⚠⚠ But **C also reds §4.1b,
correctly**: a **role-keyed** hat check kills **class 3's** 36 approved cells too, because **S3 is
role-free by design**. ⇒ the real constraint is **wider than the PO's wording**: the fix may add
neither an **org** check nor a **naive role-keyed hat** check, which points at R2's *second* named
shape — evaluate the hat **before** the arms — rather than its first.

⚠ Costs, stated: `403` **20s → 40s**. The teammate also de-staled `caseReach.values.none` in the axes
JSON (it still claimed the fixture had no participation), moving the axes sha ⇒ both `.mjs` artifacts
regenerated, **exactly one line each** (`sourceSha256`). Generator gained **arm10**; its first fixture
reported `NOT CAUGHT` because it rewrote a cell to the value it already had — ⭐ caught and fixed,
the same wrong-fixture family as LEARN-103.

### 2026-09-11 — second documentation pass: eleven homes audited, nine corrected (lead)

**Why.** The PO asked for a pass over every home this unit touched. ⛔ The instrument was a
**diff-driven** audit, not memory: `git diff --name-only main..HEAD` lists 18 paths, and the useful
half is what is **absent** from it — the authz seam, the unit's own `plan:` target, the QA finding the
hub calls its *"live home"*, and `PROGRESS.md`. Every claim below was **re-verified by the lead** at
the cited line before it was patched.

**Found by the lead before the sweep returned, both mine:**
- ⛔ **The hub's `## Current state` still read "through increment 2"** while increment 3 had landed.
  Replaced (45 lines, cap 60).
- ⛔ **`docs/bugs/BUGS.md`'s header claimed 3 per-bug docs; derived = 5** — and it was **already wrong
  at 4** before this unit added one. ⭐ The header's own text says *"do not trust that figure, derive
  it"*, and the drift still survived, because nothing summed the three Doc-cell classes. Corrected
  **with** that check: 48 + 5 + 111 = **164** rows.

**Corrected — statements this unit made FALSE.** Each is an **appended dated marker**; ⛔ no decision
text was edited in place, and ⛔ none of them closes ADR 0175 D3:
1. `docs/decisions/0201-…:432-435` — *"the enumeration is measurably absent … **216** rows … **0**
   occurrences of `divergent`"*. Spent: 1728 cells, the rep 864, every cell labelled.
2. `docs/plans/pre-ae5-remediation.md:405-407` — the same measurement. ⚠ **This file was edited on
   this very branch** (§2 row 10) while this line was left stale — which is how a measurement
   outlives its subject, and is worth more than the fix.
3. `docs/decisions/0175-…:76` — D3's *"three-arm disjunction: `is_admin()` · `can_create_professional`
   · a case-committee traversal"*. ⛔ **Two of those three names are dead.**
4. `docs/decisions/0175-…:119-121` — the **load-bearing** *"arms 1 and 3 are exercised but not
   oracled"*, owed to the Gate AE4 record. **Narrowed to arm 1 only**; ⛔ arm 1's half is still owed.
5. `docs/reviews/authz-ae4-review.md:93-101` (**F3**, the hub's declared live home) — had **no**
   pointer to the unit, the bug, or `403`'s new sections. Appended, and marked that ⛔ **arm 1 is
   still outside**. Its own 3-arm enumeration corrected on the same ground as item 3.
6. `…authz-ae4-review.md:261` — still listed *"F3's arm-3 divergence disposition"* as unassigned PO
   work. **R2 took it**; struck, with arm 1's disposition explicitly left open.
7. `docs/bugs/BUG-…-UNENFORCEABLE.md` — its Related anchor `403…:612-618` was ⛔ **stale the day it
   was written**: this same unit replaced §7.3 by ~400 lines and that range now lands inside §4.1b.
   ⇒ sections are now named, never line-numbered.
8. `docs/bugs/BUGS.md:201` — Related did not cite the two pgTAP homes built **for this bug**
   (§7.4 pin, §7.5 guard), so a register reader could not find the pin; and the Scope grain
   (*"10 of 216"*) was ambiguous beside a 1728-cell vector. Both stated.
9. `supabase/tests/403_…sql:92` — the RUN SHAPE narrative still read *"864 → 1080"* five lines above
   a correctly-updated `23 → 27`, under the file's own instruction to keep it in step. ⭐ The rep
   count (**five**) never moved; what moved is the **axis** count. Marked 1080 → **1728**.
10. `docs/backend-state/authorization-and-audit.md:706` — the frozen row lists **three** residual arms
    against the live door's **four**, and the existing superseded marker at `:696` corrects only
    `is_admin` → `is_admin_for`, ⛔ saying nothing about the missing `authz.has_permission`.
    ⭐ **The same omission was the manifest `openArms` defect this unit fixed at open** ⇒ it was a
    **two-home** drift and only the emitted, gated half was ever right. Appended with its own forward
    marker (README § Maintenance rule 1), ⛔ never edited in place.
11. `docs/plans/authz-evolution.md` — ⛔ **the unit's own declared `plan:` target had ZERO mention of
    it**; the defect was the **absence**, not staleness. Its § Per-role checklist still described the
    **pre-unit** differential shape, so AE5 increment 1 would have copied a template that cannot see
    this class of divergence. A forward note now names the axis, the label, the 14th column, `arm9`
    /`arm10`, the 1728 count, and the generalisation: *a role whose door carries a non-permission arm
    that no axis varies owes the same treatment.*

**⛔ Deliberately NOT done, each with its reason** — ⛔ absence of a diff is not absence of a decision:
- **`PROGRESS.md`: nothing owed, and adding a line would BE the defect.** It holds only § Phase Status
  and § State; its own header routes units to `docs/features/INDEX.md`, and gates 7/13 red on a
  retired section returning. `INDEX.md` already carries the row.
- **The authz seam's SLICE + `## Current state` replacement stays a RECORD-STEP obligation** (CLAUDE.md
  §7). ⚠⚠ **A trap for the successor, measured here:** gate 16's check I couples them — a slice headed
  `2026-09-11` against a `2026-09-10` stamp **reds**, so the slice and the re-stamp must land as **ONE**
  change. ⚠ And headroom is thin: that block is **96 lines against a 100-line ratchet (4 left)** and the
  file is **155.1 KB against a 160 KB warn / 200 KB cap** ⇒ the slice will need a **paraphrase pointing
  at the frozen section**, ⛔ not a bound. Gate 16 at this tip: **exit 0**.
- **ADR 0175 D3 stays open** — its closure is acceptance criterion 4 and is owed at the gate, not here.
- **The manifest `qualifier` stays** — it retires *because* `403` oracles arm 3, ⛔ never by editing it.
- `docs/design/authz-ae43-…:332,:996` describe the door as *"two arms"* — ⛔ **not this unit's home**;
  already flagged as drifting by a prior unit at `:1235`, and noted only so it is not mistaken for one.

**⚠ A grain correction on this unit's own witness.** The record's increment-3 entry cites
`Files=2, Tests=28`. That is the **run** figure across `00_setup.sql` + `403`. `403` itself declares
`plan(27)` and carries **27** assertions — 27 + 1 = 28. ⛔ Both are true at different grains; the
figure to quote for the suite is **27**, and for the two-file invocation **28**.
