# CAN-MANAGE-PROFESSIONAL-SELF-CHECK — progress record

`app.can_manage_professional`'s self-check arm: pre-AE5 remediation **Batch 8**. The unit's
**summary** is its hub,
[docs/features/can-manage-professional-self-check.md](../features/can-manage-professional-self-check.md)
§ Current state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `app.can_manage_professional(p_org uuid, p_uid uuid)` as it exists in the **live
catalog** (never the migration text — ADR 0078; some migrations rewrite function bodies at
runtime), its callers, `docs/backend-state/authorization-and-audit.md` (the seam that owns the
predicate; a slice APPENDED there and its `## Current state` block REPLACED at the Record step),
`supabase/migrations/` and `supabase/tests/` **if the PO rules for a fix**, and ADR **0200**
(reserved at unit open; written only if there is a decision to record).
Decisions read: [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the
door-audit sweep is a standing gate — a migration owes both arms), 0190 + 0191 (the deriver and
the widened domain the sweep runs over), 0192 (the write arm), 0193 (the re-keyed representative
chain `can_create_professional → can_manage_professional` that AE5's `org_admin` increment
substitutes through) — all in `docs/decisions/INDEX.md`.

## Session log

### 2026-09-09 — unit opened (lead)

**Why now.** Batches 0–7 are concluded and on local `main`; the plan's §6 checklist reads
*"Batch 8 is next"*; the PO said *"initiate batch 8"* and authorised the Agent Team. The window
matters because AE5 substitutes eleven increments through the representative chain this predicate
sits on, and a self/third-party asymmetry in the template is copied eleven times.

**Preconditions, measured rather than assumed** (plan §6 step 1): `git status` porcelain empty on
`main` @ `4fe0c464`; `git rev-list --count origin/main..main` = **74** (⛔ unpushed and NOT pushed
by this unit — the Batch 4 and Batch 7 push overrides were each scoped in writing to one push;
`origin/main` sits at ADR 0193 while local `main` carries 0199); `docs/features/INDEX.md` shows no
`in_progress` hub; `git worktree list` shows only the primary tree. Branch
`authz-can-manage-professional-self-check` cut off `main` **before** the hub was written, because
gate 13 resolves an `in_progress` hub's `branch:` against local branches (Batch 6's finding).

**Migration head pair at open:** `(20261003007350, 524)` — keyed on the pair, never "head N"
(Batch 7's lesson: `…004710` was inserted below `…005300` after the commit that added it).

**ADR number.** `0200` reserved — *highest on any live branch + 1*: local `main` 0199,
`origin/main` 0193, `origin/authz-enforcement-manifest` 0193, `origin/authz-c2-tier1` 0180.
⚠ Written only if the PO's ruling is a decision worth recording; a DEFER ruling with a re-open
condition is one (Batch 0 / Batch 7 R1 precedent), and so is a fix.

**What the follow-up's body claims, and what is a measurement to re-derive.** The body (filed
2026-09-01) states: 13 callers, 12 passing `auth.uid()`, exactly one passing a third party
(`app.can_read_professional_profile` at `can_manage_professional(v_org, p_uid)`); the reachable
consequence is a `platform_admin` asking *"can user X read this profile?"* getting TRUE because
the **asker** is an admin. ⛔ Every one of those figures is eight days old and predates migrations
`…007190` (the BUG-PROF-INACTIVE-001 fix), `…007330` and `…007350`. Read from `pg_proc` at the
pair above, or it is a quotation, not a finding.

**Protocol.** Plan §4: `backend` (Opus — authz semantics) returns a FULL plan before touching
anything; the lead approves with rulings in ONE scratch file; the PO question (disposition) goes
to the PO **after** the reachability measurement, because it needs one. ⛔ Lead writes no feature
code, no migration, no SQL.

### 2026-09-09 — plan received; lead spot-check; rulings put to the PO (lead)

**Plan.** `backend` (Opus) returned a FULL plan (session scratchpad `batch8-backend-plan.md`,
886 lines; folded into ADR 0200 + this record at the Record step — a scratchpad is not a home).
Tree untouched by the planning turn (`git status` clean at `3553f912`).

**The follow-up is wrong in both directions, measured at pair `(20261003007350, 524)`:**
- **Defect BIGGER:** *both* arms are caller-keyed — `app.is_org_admin_of(p_org)` reads
  `auth.uid()` exactly as `app.is_admin()` does; `p_uid` is a pure null guard. The live body's own
  header comment says so (*"narrowed rather than fixed … Left alone deliberately"*, AE4.7c).
- **Reach SMALLER — the body's stated consequence is REFUTED:** 7 direct call sites (body said
  13), 20 call expressions in the transitive closure, **0 reachable third-party paths**. The one
  third-party caller the body names, `app.can_read_professional_profile`, is itself only ever
  called with `auth.uid()` (2 RLS SELECT policies, `get_case_professional`,
  `_audit_access_authorized` whose `v_uid := auth.uid()`). 0 triggers. 0 TS call sites (`app`
  is not PostgREST-exposed — `supabase/config.toml` `[api].schemas`). A latent trap, not a hole.
- **Second defect site the FUP misses:** `can_read_professional_profile` has its *own*
  `coalesce(app.is_admin(), false)` first arm that fires **before** it reaches
  `can_manage_professional`. Fixing only the named predicate leaves the FUP's own stated
  consequence true.
- **Both polarities constructed and measured (rolled back):** over-grant — admin caller `…b0`
  about `chefe.ccih` → `true`, oracle `false`; under-grant — no-role caller about `orgadmin.a` →
  `false`, oracle `true`; SELF control agrees.
- **The fix already exists:** `app.is_admin_for(p_uid)` (3 callers) and
  `app.is_org_admin_of_for(p_org, p_uid)` (14 callers); `is_admin_for`'s comment was written for
  this case. Two-identifier substitution, no new object, no signature change, `gen:types` a no-op.
- **One measured non-equivalence at SELF:** `is_admin()` has a JWT-claim fast path that
  `is_admin_for` lacks — a *tightening* (closes a stale-token window for a demoted admin); 0 seed
  principals and 0 pgTAP fixtures exposed (11 files use `claims_for(…, true)`, the one touching
  these predicates uses `…b0`, whose `profiles.is_admin` is true). Must be declared in ADR 0200.

**Lead spot-check (independent, same DB `supabase_db_azkbbhskturikxpgmafq`, rolled back):**
`prosrc like '%can_manage_professional%'` excluding itself = **8** (plan: 7 calls + 1 comment
match — agrees); both `_for` twins present = **2**; `prosecdef` = `t`; OVER-GRANT current
`t` vs oracle `f` — reproduced; `can_read_professional_profile(<profile>, chefe.ccih)` under the
admin caller = `t` — the second site's own arm confirmed.

**Corrections the plan made to the lead's brief:** `docs/backend-state/conventions.md` carries no
pgTAP persona idiom (0 hits) — homes are `supabase/tests/00_setup.sql` (`test_helpers.claims_for`)
and `409`; `404` is the wrong fixture model (no role switching); next free test number is
**415** across all live branches. Also found: the enforcement manifest's `_comment` on rows 31/32
says `401 §19.2b` is RED awaiting a ruling — measured GREEN (prose rot on the authority document;
to FILE, not fix here).

**Rulings put to the PO (AskUserQuestion), before any build:** R1 disposition (fix via the `_for`
twins / drop arm 1 / defer with a mechanical re-open condition; recommended fix) · R2 scope — also
fix `can_read_professional_profile`'s own arm in the same migration (recommended yes; a "fix"
without it must NOT close the FUP) · R3 acknowledge the claim-fast-path tightening as a declared
consequence. Outcome recorded in the next entry.

### 2026-09-09 — PO rulings R1–R3; lead rulings L1–L11; build authorised (lead)

**PO rulings (AskUserQuestion, all three on the recommendation):** **R1** FIX NOW via the
existing `_for` twins (Option i) · **R2** scope YES — `app.can_read_professional_profile`'s own
`is_admin()` first arm is fixed in the SAME migration, each site with its own cells; no
`FUP-CAN-READ-…` is filed · **R3** the claim-fast-path tightening is ACKNOWLEDGED and is declared
in ADR 0200 § Consequences, never inside a "no regression" claim.

**Lead rulings L1–L11** live in the session scratchpad `batch8-rulings.md` (the ONE file the
build turn reads) and are summarised here so they outlive the session: L1 full
`create or replace` for both functions with both-direction, `(`-terminated landing assertions and a
`-- door-sweep-targets:` header naming both · L2 new pgTAP `415`, 409 fixture model, bidirectional
pairs **for both sites** plus SELF discrimination cells, predicates called directly · L3 RED-first
observed at head and quoted in this record before the migration is written · L4 collateral
comment edits as dated notes; manifest row `org.professionals.read` `composedWith` →
`app.is_admin_for` with the projection regenerated · L5 ADR 0200 by `backend`, `Amends: 0193`, the
AE5 template obligation stated as data (0193 D5) · L6 backend drafts the seam slice, lead applies
at Record · L7 five follow-ups to file at Record (bodies drafted by backend) · L8 the rewritten
`Closes when` is the Record-step text; FUP stays open and the box unticked until then · L9 backend
is sole owner of the local stack during the build; the lead runs the tip gate · L10 a session-log
entry in the same commit as the code it witnesses; no amend, no push · L11 out of scope: Option
(ii), `is_active` on the admin arm, the manifest `_comment` rot (file only), anything in `src/`.
