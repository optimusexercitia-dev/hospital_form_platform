# AE5-OPENING-ADR — progress record

AE5's opening decision: pre-AE5 remediation **Batch 9**, the last block under
[docs/plans/pre-ae5-remediation.md](../plans/pre-ae5-remediation.md) §3 § Remaining. The unit's
**summary** is its hub, [docs/features/ae5-opening-adr.md](../features/ae5-opening-adr.md)
§ Current state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: ADR **0201** (reserved at unit open — *highest on any live ref + 1*), the decisions ADR
0176 D8 bundles for AE5's first step, audit F5's seam model, ADR 0175 D3's arm-3 divergent cells;
`app.is_admin`, `app.is_admin_for`, `app.is_active`, `app.is_org_admin_of_for` and
`app.can_manage_professional` as they exist in the **live catalog** (⛔ never the migration text —
ADR 0078; some migrations rewrite function bodies at runtime), together with the `public` doors the
last of those gates; `supabase/tests/vectors/authz-enforcement-manifest.json` rows 31/32 and
`supabase/tests/401_ae4_authz_catalog.sql` § 19.2b/§ 19.2c; and
`docs/backend-state/authorization-and-audit.md` (the seam that owns these predicates — a slice
APPENDED there and its `## Current state` block REPLACED at the Record step; ⚠ that block stood at
**99 of 100 lines** at unit open, so the next slice on that seam must **cut before it adds**).
Decisions read: [0078](../decisions/0078-authorization-capability-model.md) A35 (the noun
rule), [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the door-audit sweep is
a standing gate), [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
G1 + [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) (AE5 is post-pilot),
[0172](../decisions/0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md)
(the deferred classification columns), [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md)
D3, [0176](../decisions/0176-authz-permission-layer-made-real.md) D8,
[0193](../decisions/0193-the-enforcement-manifest-declares-what-it-measured.md) D5 and
[0200](../decisions/0200-professional-identity-predicates-answer-about-their-subject.md) (the keying
obligation this batch inherits) — all in `docs/decisions/INDEX.md`.

## Session log

### 2026-09-09 — unit opened (lead)

**Why now.** Batches 0–8 are concluded, merged and pushed; the plan's §6 checklist has read
*"Batch 9 is next — and it is not a fix"* since Batch 8's Record step; the PO said *"initiate batch
9"* and authorised subagents. The window matters because AE5 substitutes eleven role increments
through **one** per-role template, and every defect left in that template is copied eleven times.

**Preconditions, measured rather than assumed** (plan §6 step 1):

- `git status --porcelain` **empty** on `main` @ `55e440c3`.
- `git rev-list --count origin/main..main` = **0**, and `main..origin/main` = **0** — ⛔ measured at
  open, not quoted: a clean push state is an **instant, not a lease**. Batch 8's record states the
  distance was *"large and growing"* at its own close; the Batch 8 merge-and-push witness commit
  (`55e440c3`, *"87 commits pushed, 0 ahead / 0 behind"*) is what moved it to 0, and this
  measurement is what confirms it still holds now. ⛔ The standing plan §4 step 6 instruction *"do
  not push"* is live again — the three overrides on record (Batches 4, 7, 8) were each scoped in
  writing to one push and are spent.
- `docs/features/INDEX.md` shows **no `in_progress` hub** (18 hubs: 0 in progress · 3 gated · 2
  planned · 0 parked · 13 complete). ⚠ **Stated, not absorbed:** the three `gated` hubs
  (`BACKEND-STATE-CURRENT-STATE`, `BACKEND-STATE-SPLIT`, `DATA-ACCESS-GENERATION`, all program
  DOCS) have **no live branch** — `git branch` lists neither `backend-state-current-state` nor
  `data-access-generation` — so each is either merged-and-unrecorded or lost, and ⛔ *a deleted
  branch is not evidence of a merge*. Plan §6 step 1's precondition tests `in_progress` only, so
  this does not block Batch 9; it is written down here so it is not re-discovered.
- `git worktree list` shows **only** the primary tree.
- `npm run lint` **rc 0 bare**, 17 of 17 gates, eslint 0 errors / 0 warnings — the baseline this
  unit must return to.

**Migration head pair at open:** `(20261003007360, 525)`, measured from
`supabase_migrations.schema_migrations` on the local stack, with 525 files on disk. ⛔ Keyed on the
**pair**, never *"head N"* (Batch 7's lesson: a migration can be inserted below a later version
after the commit that added it).

**ADR number.** **0201** reserved — *highest on ANY live ref + 1*, derived across
`refs/heads` + `refs/remotes` (`git ls-tree` over every ref, not the index's "next free"): the
maximum is **0200** on every ref that carries one. ⚠ Gate 9 catches a duplicate at rebase, so the
number is a reservation, not a claim.

**Branch.** `authz-ae5-opening-adr` cut off `main` @ `55e440c3` **before** the hub was written,
because gate 13 resolves an `in_progress` hub's `branch:` against local branches (Batch 6's
finding). Plan §6 step 3 words the same requirement the other way round; both agree on the reason,
and the branch existing when the gate runs is what satisfies it.

**PO rulings taken AT open** (`AskUserQuestion`, before any work — plan §4 step 2: *PO questions go
to the PO before the build where they change scope*):

- **R1 — scope shape: "Decide now, build later."** Batch 9 stays **not a fix**. It produces ADR 0201
  and the rulings that ADR records, plus the one text-only follow-up; where a ruling orders a
  database change, the change is deferred to a **named Batch 10** and the follow-up stays
  `Status: open` with a decided path. ⇒ Batch 7's **empty-pathspec assertion is live**.
  ⚠ This is a widening of Batch 9's *subject* (three follow-ups the plan did not assign to it) with
  **no** widening of its *kind*, and plan §3 owes an amendment saying so in writing.
- **R2 — the CLAUDE.md review queue: skip, and record the deferral.** Plan §6 step 4 says to process
  `.claude/claude-md-review-queue.md` before Batch 9 opens, on the ground that it was **13 KB and
  unprocessed** at Batch 8's Record step. ⛔ **Re-measured at open: 1,433 bytes, three entries**
  (2026-08-25, 2026-09-03, 2026-09-07), each a truncated staleness snippet about a figure, none a
  rule. The 13 KB figure in plan §6 is therefore **stale** and is corrected by this measurement, not
  by deletion. The PO ruled skip; the deferral is recorded here so it is attributable rather than
  forgotten.

**What the three follow-ups claim, and what is a measurement to re-derive.** ⛔ Batch 7's lesson is
binding on all three: *a `Closes when` can name stale heads, a wrong predicate, or a case that
cannot fail — read the body, re-measure what it names, and correct the clause before closing on it.*

1. `…-ADMIN-ARM-IGNORES-IS-ACTIVE` asserts, from `pg_proc` on 2026-09-09, that neither
   `app.is_admin()` nor `app.is_admin_for()` contains an `app.is_active` term. Same-day, so not yet
   stale — but it is still **a measurement, and it is re-derived at this head pair**, not quoted.
   Its clause has **two arms** and the PO's ruling picks one.
2. `…-PLATFORM-ADMIN-CLASS-2-WRITE` asserts **3 `public` RPCs** sit behind
   `app.can_manage_professional`, and its clause explicitly requires the door list *"derived from
   `pg_proc`, not quoted"* to be in front of the PO. ⇒ the count is re-derived and reported plainly
   if it is not 3. Two arms; the PO's ruling picks one.
3. `FUP-ENFORCEMENT-MANIFEST-COMMENT-…` is the only one that closes here unconditionally: rows 31/32
   of the manifest carry a `_comment` reading *"19.2b is RED on exactly this and must not be
   re-numbered to 2 … AWAITING A LEAD RULING"*. **Confirmed stale at open by reading `401`
   directly:** § 19.2b's expected value **is** 2 (`supabase/tests/401_ae4_authz_catalog.sql`), and
   § 19.2c exists beside it asserting the surviving pair is `can_manage_external_participant` +
   `can_manage_case_vocabulary` — i.e. the ruling the comment awaits was taken **and** the objection
   it raised (*"a bare count of 2 over three functions is satisfied by any of the three pairings"*)
   was answered by adding 19.2c rather than by editing 19.2b alone. ⛔ The close still owes a
   **fresh run of `401`** quoted beside the rewritten comment; the reading above is source text, and
   source text is not a run.

**Protocol.** Plan §4. `backend` (Opus — authz semantics) returns a FULL plan before touching
anything; the lead approves with rulings written into ONE scratch file the build turn reads; the two
disposition questions go to the PO **before** the build, because each changes scope — but only
**after** the live-catalog evidence exists, because both clauses require the measurement to be in
front of the PO. ⛔ Lead writes no feature code, no migration, no SQL. ⛔ One agent on the tree at a
time; an agent that reports "finished" while holding a background waiter is not finished.
