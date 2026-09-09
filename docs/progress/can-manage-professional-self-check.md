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
