# ADMIN-ARM-IS-ACTIVE — progress record

The admin arm made to follow the subject's state: pre-AE5 remediation **Batch 10**. The unit's
**summary** is its hub, [docs/features/admin-arm-is-active.md](../features/admin-arm-is-active.md)
§ Current state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `app.is_admin()`, `app.is_admin_for(uuid)` and `public.assume_role(...)` as they exist in
the **live catalog** (never the migration text — ADR 0078); `app.can_manage_professional`'s first
arm and `app.can_manage_case_vocabulary` (the R4 relocation); `app.active_role_selections` and the
`active_role.assumed` audit row (R10); `docs/backend-state/authorization-and-audit.md` (the seam
that owns every one of them — a slice APPENDED there and its `## Current state` block REPLACED at
the Record step); `supabase/migrations/` and `supabase/tests/`.
Decisions this unit BUILDS, never re-takes: ADR [0201](../decisions/0201-the-keying-asymmetry-is-the-model.md)
D4 (three `is_active` sites, R3 + R12) and D5 (the Class-2 arm, R4), ADR
[0203](../decisions/0203-the-seam-is-already-encoded-the-classification-columns-are-not.md), and
the R10 audit-stamp ruling — all recorded in
[docs/progress/ae5-opening-adr.md](ae5-opening-adr.md) § Session log (entries dated 2026-09-09/10).
⛔ The scope derives from those three sources, never from R3/R4 alone (Batch 9 BLOCK-2).

## Session log

### 2026-09-10 — unit opened; the review queue processed on THIS clone first (lead)

**Why now.** All nine batches of the plan are concluded and §3's remaining set is NONE; §6 names four
successors and hands the choice to the PO. The PO said *"continue batch 9"*, was shown the four
sized (Batch 10 · ADR 0202 · ADR 0204 · `AE5-MATRIX-ARM3-CELLS`) and chose **Batch 10**: a deactivated
or suspended `platform_admin` passing every admin arm in the tree is a **live** hole, not a latent
one, and it is the fix Batch 9 decided and deferred.

**Preconditions, measured rather than assumed** (plan §6 step 1): `git status` porcelain empty on
`main` @ `b87eac1e`; `git rev-list --count origin/main..main` = **0** after `git fetch` (Batch 9 was
pushed on a fourth one-push override; ⛔ that override is spent and *"do not push"* is the standing
instruction again); `docs/features/INDEX.md` shows `in progress 0 · gated 3 · planned 3`. Branch
`authz-admin-arm-is-active` cut off `main` **before** the hub was written (gate 13 resolves an
`in_progress` hub's `branch:` against local branches).

**Migration head pair at open:** `(20261003007380, 527)` — keyed on the pair, never "head N".

**ADR number.** None reserved: this unit builds ADR 0201 D4/D5 and the R10 ruling; it takes no new
decision. ⚠ If a re-ruling of an expected red turns out to *change a stated meaning*, that is an
amendment to 0201, dated in place — not a new number. ⛔ 0202 and 0204 stay reserved; 0205 is taken;
the next free number is re-measured at the moment of reserving.

**The CLAUDE.md review queue — processed on this clone before the unit opened** (lead-playbook §4
step 7; plan §6 item 4). ⭐ **The queue is gitignored, so it is PER-CLONE**: Batch 9's record says
*"queue cleared to empty"* (five entries, 1,433 B) — that was the other clone. This one held
**12 entries, 13,875 B**, dated 2026-09-05 → 09-09. Both figures the plan argued about were true, of
different clones; plan §6 corrected in two places (operational instruction ⇒ EDITED, superseded text
quoted). Four subagents read the transcripts by `grep` window, never whole. Dispositions:

| entry (session, date, signal) | what it was | class |
| --- | --- | --- |
| `9346f622` 09-05 · `da1d3285` 09-06 · `772cd8f6` 09-07 (byte-identical bullets) | ONE session resumed twice; the hook re-scanned its history on each stop. Bullets = its own earlier `/review-claude-md` run (fix B-1 verified live in CLAUDE.md §6), an open FUP quoted (`FUP-ONE-SUPABASE-PROJECT-SERVES-TEST-AND-PRODUCTION`, still correctly open), two FUPs since archived (`…HALF-AIMED` 09-08, `…HARNESS-TRANSACTIONAL` 09-04), and an in-flight scoping call | not a doc problem |
| `ec9c5880` 09-07 `claude-md` | the PO asked whether CLAUDE.md should tell the lead to delegate more; the session answered the floor had existed since 2026-08-24 (`4d08b8df`), the **mechanism** was missing, and proposed naming the sinks — then ended unanswered | **CLAUDE.md silent on the mechanism** ⇒ `docs/lead-playbook.md` §1 paragraph, **PO-approved 2026-09-10** (lead-only file; CLAUDE.md untouched) |
| `f14a06db` 09-07 `staleness` | Batch 3 recon: a findings file's header count stale vs its body; the DRYRUN banner literal `7` vs 13 keys — fixed in-unit (`p0-authz-writepath-audit.sh:1022-1029` now derives the count) | not a doc problem — already fixed |
| `834bddc0` 09-08 `claude-md` | a subagent reconciled every "gate N" citation against the chain and found **zero** disagreement; re-verified today at **17 gates** (14–17 appended by Batches 7–9): gates 7, 9, 12, 13, 16, 17 all cite correctly | not a doc problem |
| `5f55cb11` 09-08 `staleness` | Batch 7's own recon: no `lint:*` gate asserted a privilege count — the gap it then closed (`lint:budget-anchor`, gate 15) | not a doc problem — LEARN-091/092/093 |
| `fcdc27a3` 09-09 `staleness` | "stale" inside a quote of **another repo's** docs (`scheduler_platform`), research input for ADR 0196 | keyword false positive |
| `cd3a414d` 09-09 `staleness` | ADR 0197's initiating prompt citing prose rot as the reason to generate the registries; the session caught two wrong figures IN that prompt (533 vs 473; 15 vs 18), recorded in 0197 § Context | not a doc problem |
| `b3e8da7d` 09-09 `staleness` | ADR 0198's initiating prompt citing a measured count of `STALE`/`SUPERSEDED` markers; CLAUDE.md §7's backend-state paragraph re-verified line by line against the tree (router present, gate 16 = `lint:backend-state`, `--scaffold` exists) | not a doc problem |
| `4842764c` 09-09 · `86d6eb13` 09-09 (resume) `staleness` + `claude-md` | Batch 8: *"stale-**token** window"* — a JWT term; the tightening IS declared (ADR 0200 § Consequences R3, record, QA review). The `claude-md` hit = QA confirming CLAUDE.md was **not** touched; its MINOR (AFTER assertions never proven to fire) closed the same day with five plants | not a doc problem |

**One recurrence flagged, no edit proposed:** *"declare a TIGHTENING explicitly, never fold it into
a no-regression claim"* appears in at least six reviews and is formalized in no agent checklist. It
is relevant to **this** unit — gating three admin sites is a tightening by construction — so the
builder declares it in the migration header and the record, and the reviewer checks for it.

**What this unit does NOT do.** It takes no decision Batch 9 took; it does not write ADR 0202 or
0204; it does not open AE5 (post-pilot by ADR 0155 G1); it does not push.

### 2026-09-10 — backend plan received; PO rulings R1–R3; two lead decisions (lead)

**The plan** (`backend`, Opus, plan-only turn; the stack was DOWN at `(20261003007360, 525)`, started
and fresh-reset to `(20261003007380, 527)`) is in the session scratchpad `batch10-backend-plan.md`
(800 lines) — its measurements are re-stated in this record only where a ruling rests on them.

**Measured, with a discriminating control:** `app.is_admin()`, `app.is_admin_for(uuid)` and
`public.assume_role` all lack `app.is_active(` comment-stripped, while `app.is_org_admin_of_for` **has**
it (the control that proves the query can see the term). Blast radius as sets: **26 policies + 13
functions** read `is_admin()`, **0 + 5** read `is_admin_for`; 0 triggers; 0 readers outside the four
schemas — the Batch 9 figures reproduce. The Class-2 closure: **14 `public` doors** (all `prosecdef`,
EXECUTE to `authenticated`), **12 behaviourally affected**, ⭐ plus **2 RLS policies** ADR 0201's door
table does not list (both in the unaffected half). `active_role_selections` has **no scope column**
(D2 reason 1 confirmed).

**Four findings the plan surfaced, none in any ruling:**
1. ⭐⭐ **A fifth red file:** `257_ethics_e2_retention.sql` — four `redact_professional_profile` cells
   under the `platform_admin` hat (`:132 :141 :174 :209`) reach `HC0J7`/`HC000`/`lives_ok` only
   through the arm D5 removes, so they red *as if the retention bar had broken*. Derived from the
   candidate set (13 files) read cell by cell, closed over **both** hat-seating syntaxes (`claims_for`
   and raw `set_config` — the second intersection is empty). ⚠ The builder's **first** filter was wrong
   (`claims_for\([^)]*,\s*true` cannot span `(select admin from k)`) and silently dropped the four files
   the rulings name — LEARN-098's shape, recorded in the plan.
2. ⭐⭐ **A TS mirror:** `src/lib/queries/session.ts:270` mirrors `is_admin()`'s two conjuncts, and its
   own comment says `src/lib/{admin,users}/actions.ts` run on the service-role client with no RLS
   backstop — the SQL fix alone would *read* complete.
3. `315:246-249` is an **eighth** re-ruling ADR 0201's table calls unchanged: green, dead reason.
4. ADR 0201 D5's position numerals **115/342 do not reproduce** (measured 111/338, strip expression
   quoted); ordering unaffected. Also: `app.is_admin()` carries a **PUBLIC EXECUTE** ACL entry its two
   siblings lack (unreachable — no PUBLIC schema USAGE).

**PO rulings (AskUserQuestion, plan file in front of the PO):**
- **R1 — `assume_role` gate is DOOR-WIDE (variant A), a DECLARED WIDENING of R12.** R12's words gate
  the seating door reasoning about the admin hat; (A) puts one `is_active` check before **any** seating.
  Measured cost: zero expected reds (no test seats a deactivated principal); every tenant predicate
  already carries `is_active`, so (A) removes a pointless seating and its audit row, never an ability.
  Recorded in ADR 0201 D4 as a dated note at the docs pass. The hat-blind allowlist reason for
  `assume_role` **survives** on re-derivation (account state is not a hat/grant read) and gets a dated
  appended paragraph, never inherited silently.
- **R2 — the DERIVED red set and the proposed texts are approved as written**: nine assertions across
  five files (`228 · 409 · 415 · 229`→2 · `257`×4) plus two green-but-dead-reason rewrites (`315:212`,
  `315:246-249`). Every one gets a message saying what it now proves; every old property is re-homed
  (a `lives_ok` twin under org authority beside `228`'s negative twin; `257` re-actored onto `oa_b` with
  one authority cell per pair; `229` and `257` split freeze/retention from authority). Hub box reworded.
- **R3 — the TS mirror is IN SCOPE**: `session.ts:270` gains the same `is_active` term, keyed the same
  way, with a Vitest cell RED first; the diff touches `src/` by ruling and the hub's gate line names
  the two files exactly.

**Lead decisions (not PO):** **L1** ADR 0201 D5's numerals get a dated note beside them (a record of a
measurement is annotated, never edited); **L2** the PUBLIC EXECUTE entry is a follow-up filed at the
Record step, out of Batch 10's scope. **L3** the declared-tightening sentence goes in the migration
header, this record, and the QA brief — the recurrence the queue processing flagged, applied here.
