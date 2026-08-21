# QA review — DSR operational remediation

**Branch:** `feat/dsr-operational-remediation` (7 commits ahead of `main`, nothing pushed) ·
**Reviewer:** `qa` · **Date:** 2026-08-21 ·
**Contract:** [docs/plans/dsr-operational-remediation.md](../plans/dsr-operational-remediation.md)
(workstreams A–G, PO decisions P1–P4, constraints §3 + §3b, exclusions §4).

# VERDICT (round 1): **CHANGES REQUESTED**

> ⛔ **SUPERSEDED — see ROUND 2 at the bottom of this file, which is `APPROVED`. Do not act on
> this verdict.** All three blockers below are closed and verified; §§9–15 record how. This
> section is kept unedited as the record of what was found, not as a live verdict — the same
> in-place supersession discipline this review required of ADR 0131:349.

⛔ **The engineering is not what fails.** The fix is correct, tighter than the shape ruled
for, and better pinned than the ADR required. I re-derived every load-bearing catalog claim
myself and the census reproduces exactly. **What fails is the record layer** — and one of the
three blocking items is the *precise* defect class this round exists to close, sitting in the
live catalog, in the two functions that state the security bound.

Nothing here questions the fix's correctness. Every blocking item is a text change plus one
missing authorization.

---

## 0 · Method, and what "verified" means below

Every schema/RLS/RPC/trigger claim below was re-derived from the **live catalog**
(`pg_proc.prosrc` / `prosecdef` / `proacl` / `proconfig`, `pg_trigger.tgtype`, `pg_constraint`,
`pg_policies`, `supabase_migrations.schema_migrations`), never from migration text. All
`prosrc` regexes strip `--` comments first. Nothing was executed that mutates: no reset, no
pgTAP, no Playwright — the `e2e:prod` gate holds the stack.

**Consequence, stated plainly:** the suite/gate numbers, the six mutation runs and the four
authz ARM verdicts are **taken on the lead's word**, not re-measured by me. They are in the
"could not verify" work item (§6), not in the evidence.

---

## 1 · BLOCKING (each is `CHANGES REQUESTED` on its own)

### 🔴 C1 — the `dsr` go-live flip is on the branch, and its authorization exists in no record but the migration's own comment

`supabase/migrations/20261003000200_flip_dsr_flag_on.sql` (commit `2cb9b5da`) turns the
platform's LGPD subject-request module ON for production. Catalog confirms `app.feature_flags`
→ `dsr = t`.

The plan states, as a live binding constraint:

> `docs/plans/dsr-operational-remediation.md:192-194` — *"⛔ Do **not** add a flip migration to
> this branch until the PO rules, because merging one makes the next `db push` flip it as a
> side effect."*

The migration header asserts *"(PO decision, 2026-08-20, at the DSR remediation gate)"*. I
searched for that ruling and could not find it:

| where a ruling would be recorded | result |
|---|---|
| `docs/progress/dm5-po-decisions.md` — the file whose stated purpose is *where the pilot decision is made* | its branch diff adds **only** the P4 item; zero occurrences of the flip |
| `PROGRESS.md` § Now, the round's (A)–(G) scope list | flip **absent** from scope |
| the plan's P1–P4 table and §4 exclusions | **absent** |
| ADR 0130 / 0131 / 0129 | **absent** |
| `docs/backend-state.md`'s new section | **absent** (it does not even list the migration — see m1) |

**Its sole witness is comment text inside the migration it authorizes** — the artifact class
this repo's own binding rule declares non-authoritative. This is an outward-facing production
change on a legal-facing module, and CLAUDE.md §6 step 4 makes the human approval a gate step,
not a migration comment.

Two further facts make this blocking rather than pedantic:

1. **The two questions §3b said ride with the flip are still unanswered anywhere**:
   *platform-wide or per-tenant*, and *whether Critical FUP **C1b** (the Cloud disposal
   rehearsal that gates admitting real PHI) must close first*. The migration answers the first
   by fiat — it is platform-wide, because `app.feature_flags` has no tenant dimension at all
   (see M4) — and is silent on the second. §3b called that "a decision, not an oversight".
2. **The plan's own premise sentence is now false and unamended.**
   `docs/plans/dsr-operational-remediation.md:179-181` still reads *"The `dsr` flag ships OFF
   and nothing but `seed.sql` turns it on."*

⭐ **What I am NOT saying:** the ordering is correct and I verified it. `schema_migrations`
holds `20261003000000` → `…000100` → `…000200`, filename order is apply order, and every
`dsr_*` door gates on the flag inline (`create_dsr_request`, `adjudicate_dsr_request`,
`complete_dsr_task`, `attest_dsr_task`, `close_dsr_request`, `appoint_hospital_dpo`,
`revoke_hospital_dpo`, `list_dsr_disposable_meetings`, `list_my_dsr_hospitals`,
`list_my_dsr_task_commissions`, `list_my_executable_dsr_tasks`, plus
`app.can_execute_dsr_task` / `app.is_dpo_of_for`) — so nothing makes the module reachable
before the erasure fix. The ordering guarantee holds. **The authorization is what is missing.**

**Fix:** record the ruling where pilot decisions are made (`dm5-po-decisions.md`), naming the
platform-wide scope and the C1b disposition, and amend `plan:179-181`. Or drop the migration
from this branch and ship it separately once ruled.

---

### 🔴 C2 — the invariant this round tripled is still stated at its OLD value in the live catalog, in the two guards that carry the security bound

I re-derived the invariant from `pg_proc.prosrc` (comments stripped). **It is exactly as
claimed:**

| | members |
|---|---|
| **3 setters** | `public.dispose_case_phi` · `public.dispose_event_phi` · `public.dispose_meeting_minutes` — all disposal doors ✅ |
| **5 readers** | `app.guard_{rca,capa,interview,meeting,reserved}_child_lock` — all child-lock guards ✅ |

**And two of those five readers still say otherwise, in their own bodies:**

`app.guard_meeting_child_lock` (live `prosrc`):
> *"THE ONE NAMED STAND-ASIDE (ADR 0129, amended). `public.dispose_meeting_minutes` **is the
> only function that sets this flag** … **TWO readers, ONE setter**."*

`app.guard_reserved_child_lock` (live `prosrc`):
> *"`public.dispose_meeting_minutes` is **still the ONLY function that sets this flag**."*

And the ADR paragraph that ADR 0129 Decision 3 amended *for exactly this reason* has been
falsified again, unamended — `docs/decisions/0126-print-series-and-derived-currency.md:461`:
> *"reads **exactly one** RPC flag — `app.in_disposal_rpc`, **settable only by
> `public.dispose_meeting_minutes`**"*

(ADR 0126 is untouched by this branch — `git diff main..HEAD -- docs/decisions/0126*` is empty.)

**Why this is blocking and not a nit:**

- **It is the round's own governing rule, applied in one direction only.** ADR 0129 Decision 2
  binds a change to correct the false comment in the same migration; Decision 3 binds it to
  amend the positively-stated bound elsewhere, with the reason spelled out: *"Leaving §E as
  written would plant the next stale-comment defect in the ADR that documented this one."* The
  round honoured this for `dispose_case_phi`'s `-- for meeting_cases child-lock` comment
  (correctly, and at length) and skipped it for the guards' own statement of the bound and for
  §E. **The sibling axis that got swept was "which door has a false comment?"; the axis that
  did not was "which statement of the invariant did I just falsify?"** — structurally the same
  half-sweep the round exists to correct.
- **These are the highest-traffic statements of the bound.** ADR 0129 Amdt 1 and Amdt 3 both
  argue that *"the setter count is what bounds the bypass"*. An engineer deciding whether a
  fourth setter is safe reads the guard body first. It tells them the count is 1.
- The correct statement **does** exist in `backend-state.md:494`, `ADR 0129:264-265`,
  `PROGRESS.md:157` and `plan:152-155`. This is not ignorance — it is three surfaces updated
  and three left contradicting them.

**Substance is unaffected** — all three setters are erasure doors, none revises content, so
ADR 0126 §E's currency argument survives with "doors" pluralised. This is a text fix in three
places (two of them a `CREATE OR REPLACE` of the two meeting guards).

---

### 🔴 C3 — ADR 0131's live text still carries the *overturned* P3 ruling, and the revision is recorded at no pilot-decision surface

`docs/decisions/0131-…md:345-349`, under **"Two further rulings taken at the same time"**,
still reads as current:
> *"**The referral dispose dialog is made REACHABLE** rather than removed or accepted as a
> gap"*

ADR 0131 ends at line 356; there is no Amendment 5 superseding it. The PO overturned this when
the premise was measured false, and the dialog was **deleted** (`13610c0d`; I confirmed zero
references to `ReferralDisposeDialog` remain in `src/` or `e2e/`).

The same overturned ruling survives unamended in three more places in the plan —
`:81` (P3 = **"MAKE IT REACHABLE"**), `:126` (D2), `:142` (§G still schedules *"the referral
dialog driven in a real browser"*) — and `docs/progress/dm5-po-decisions.md` records the P3
revision **nowhere at all**; its diff adds only the P4 item.

Note the asymmetry: P4's premise *was* correctly carried to `dm5-po-decisions.md` item 2, in
full and well written. P3's reversal was not. A reader arriving at ADR 0131 — the decision the
round is executed under — is told the opposite of what shipped.

⚠ Related, and worth checking while fixing this:
`docs/progress/bug-log-archive.md:1408` cites *"PO ruling, see **ADR 0130 D11**"* as the
authority for the removal. D11 (`0130:401-405`) is the *Surfaces* decision and contains no such
ruling.

---

## 2 · MAJOR — claims that are true of the build and false of the function

### 🟠 M1 — `backend-state.md`'s causal explanation of the blindness is false, and it is the durable surface map

`docs/backend-state.md:484-485`:
> *"Nothing in the gate could see it: **every disposal fixture in the tree used a non-locking
> parent state** (`rca 'draft'`, interview `'scheduled'`, meetings `'held'`)"*

Both halves fail:

- **`meetings 'held'` is false by construction.** `supabase/tests/348_disposal_flag_meeting_child_lock.sql:99-100` walks `held → in_signature`, and `351_meeting_disposal_redaction_set.sql:180-181` does the same — both **purpose-built by ADR 0129 / Amdt 1 to construct a locked parent**. Those two suites are the counterexample to the sentence, and they were written by this same programme.
- **The two named statuses contradict the round's own measurement.** `353`'s header (lines 19-23) records the seed as `rca` **`in_progress`**, `capa_plan` `in_execution`, `case_interviews` **`awaiting_follow_up`** — not `'draft'` / `'scheduled'`.

This is the sentence a future session reads to understand *why* six gates were green over a
broken door. It generalises an rca/interview-lane fact across the whole class, including the
one lane where the opposite was true by design — the same shape as
`[[sweeping-one-sibling-axis-reads-as-sweeping-the-class]]`.

### 🟠 M2 — "the four LGPD erasure doors did not complete" over-claims by two doors, in the same file

`docs/backend-state.md:483`:
> *"The DSR program closed green on 2026-08-20 with every gate passing **and the four LGPD
> erasure doors did not complete** on ordinary mature records."*

By the round's **own census**: `dispose_meeting_minutes` has **zero** CONFIRMED-reachable
child-lock crossings (its lane was fixed by ADR 0129 on 2026-08-19 and pinned by `348`/`351`),
and `dispose_referral_phi`'s only CONFIRMED rows are the `HC0D3` legal-hold aborts, which the
census itself verdicts **BY DESIGN**. The defect was **two of four doors** —
`dispose_event_phi` (rca + capa) and `dispose_case_phi` (interview + `meeting_cases`) — which is
exactly what the census's §3a table says: 10 statements, both doors, 4 guards.

Over-claiming a fixed lane as broken devalues the ADR 0129 build record and is the kind of
magnitude drift this round was opened to correct in the opposite direction.

### 🟠 M3 — the over-claim test's roster still says "four of four" while pinning three

`src/components/dsr/dsr-disposal-overclaim.test.tsx:15-22` header:
> *"THE ROSTER, and where each surface is pinned (**four of four, none by accident**): … 4.
> `referral-dispose-dialog` — `referral-dispose-dialog.test.tsx` claim 2, **left in place**
> because it is `FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument …"*

That file and its component were deleted, and **the same file documents the deletion 300 lines
below** (`:315-318`). This file exists specifically because *"the tests cover it is a claim with
a CARDINALITY, and this one's was 1"* (`:6-7`) — and its own cardinality statement is now wrong,
inside the instrument built to close `FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY`.

No coverage **gap** results (surface 4 no longer exists), so this is a record defect, not a
hole. It needs the roster reduced to three with the fourth entry marked removed.

Two sibling dangling references, same commit:
`src/components/dsr/disposal-copy-property.ts:5-8` still says the property *"is asserted from
two files"* (one remains, which also dissolves the module's stated reason to exist), and
`src/components/dsr/dsr-meeting-dispose-dialog.tsx:55,193` still point at
`referral-dispose-dialog.tsx`. Contrast `canDisposeReferralPhi`, whose orphaning **was**
documented at length and correctly (`src/lib/queries/referrals.ts:1530-1567`) — the discipline
was applied to one orphan and not the others.

### 🟠 M4 — the new operator procedure states a precondition the doors do not have

`docs/deployment/phi-column-disposal-procedure.md:60-62`:
> *"1. **The `dsr` flag is on** for the tenant, and the lane's own flag is on … A door raises
> `HCDS1`/lane-specific codes rather than silently no-op'ing when its flag is off."*

Catalog:

- **"for the tenant" is false — flags are global.** `app.feature_flags` is `(key, enabled, description)`; `app.feature_enabled(p_key)` is `select enabled … where key = p_key`. There is no tenant dimension. (This also silently answers C1's first riding question.)
- **`HCDS1` is raised by no `dispose_*` door.** `HCDS1` appears only in the seven DSR-surface doors + `list_dsr_disposable_meetings`.
- **The `dsr` flag is not a precondition for a door at all.** Called directly, all four doors work with `dsr` off — the DSR module is the *caller*, not a gate. Telling an operator running the manual procedure that `dsr` must be on is a false blocker on an erasure path that may be needed when the module is down.

⚠ **One half of this is correct and must not be "fixed" away**: each door *does* check its
**lane** flag, via `app.assert_{patient_safety,case_patient,case_referrals,meetings}_enabled` →
`app.feature_enabled`, raising `check_violation` — so *"raises rather than silently
no-op'ing"* is true. Only the tenant scoping, the `HCDS1` code, and the `dsr` conjunct are wrong.

**The rest of the procedure doc is excellent.** I spot-checked ten identifiers/codes/gates
against the catalog (all four door gates verbatim, `42501`, `HC056` on all four, the five
`p_reason` values, the four audit action names, `meeting_minutes_jobs.purged_at`,
`HC047`/`HC049`/`23514`/`HC0D3`) — **10 of 10 exact**. Precondition 1 is the only failure.

### 🟠 M5 — `PhiInputHint`'s host census carries four mutually inconsistent numbers, and the load-bearing one is wrong

Four figures for one population, in two files written in the same commit:
`phi-input-hint.tsx:81` (*"16 of the 17 annotated hosts"*), `:87` (*"only ONE of the 17 hosts
uses those primitives"*), `phi-input-hint.test.tsx:18` (*"Fourteen title/free-text sites"*),
`:20` (*"all twelve legacy sites"*).

Measured on this branch: `<PhiInputHint` = **14 production call sites** across 14 files, plus
**6 constant-only usages** in 5 files. Neither 17, 16, 15 nor 12 is reproducible.

The half that matters is `:87` — the stated rationale for choosing a render prop over
`useFieldIds`. **Four hosts / five usages already use the field primitives**
(`dsr-adjudication-panel.tsx:291,312`, `dsr-attest-form.tsx:210`, `dsr-intake-panel.tsx:255`,
`dsr-task-inbox.tsx:431`), and a fifth hand-rolls `useId` + `aria-describedby`
(`case-bulk-grid.tsx:193`). The design decision still holds directionally (14 legacy vs 5); the
measurement offered for it does not.

### 🟠 M6 — one defect, two IDs, contradictory verdicts, and the fix is already in the branch

- `PROGRESS.md:236` — 🔴 **`BUG-DSR-S3-AGENDA-TITLE-STALE`**, open, owner `tester`.
- `docs/progress/bug-log-archive.md:2776` — 🟢 **`BUG-DSR-AGENDA-TITLE-STALE-PIN`**, "RESOLVED, verified by tester".

Same spec, same line, same root cause (`3d5e9a9c`). **The fix is on this branch** —
`e2e/dsr-slice3-adjudication.spec.ts:720-731` now carries the corrected assertion with its
rationale. `lint:progress` cannot see this: a 🔴 row is not a "completed row", and the archive
entry sits under a name the tracker never used
(`[[a-rename-orphans-a-name-keyed-verdict]]`).

⚠ **This one has operational consequence right now.** `PROGRESS.md:230` cites the open ID as
the *third* live pre-existing `e2e:prod` failure. With the fix on the branch, that spec should
be **green** in the run the lead is waiting on. Left as-is, a green result will be misread as
flake or as a baseline that never had three failures.

---

## 3 · MINOR

| # | finding |
|---|---|
| **m1** | `backend-state.md:26` and `:490` both state the migration registry as **433 == 433, "measured 2026-08-21"**. Live: **434 == 434** (DB and `ls supabase/migrations/*.sql`). The flip landed after `fb563bda` and neither number was re-measured — a "measured" banner fact, stale inside its own branch, in the file whose header tells readers to measure. Same section header names migrations `20261003000000`–`…000100`, **omitting `…000200`**, the round's highest-consequence migration. |
| **m2** | `ADR 0129:299-300` Gates records **vitest 1512/1512**; the lead's verified figure for the round is **1506/1506**. The block was written at `fb563bda`, before the frontend/test commits added and removed unit tests — a mid-round number presented as the round's gate. |
| **m3** | `ADR 0129:264` — *"3 setters (**all disposal doors**)"* reads naturally as *all disposal doors are setters*. There are **four**; `dispose_referral_phi` sets none. `backend-state.md:494`, `PROGRESS.md:157` and `plan:152` name the three members explicitly and are unambiguous — only the ADR line invites the wrong inference. |
| **m4** | `PROGRESS.md`'s `BUG-DISPOSAL-CHILD-LOCK-…` entry keeps its superseded body under the ⭐ CORRECTED block: lines ~202-218 still read *"**15** guards, 3 confirmed"*, *"the **9** guard-tripping statements"*, and *"**TWO fix paths, and the choice is the PO's**"* — an open PO choice that P1 closed. A reader entering mid-entry sees the pre-correction state. |
| **m5** | `.claude/rules/ui-copy-forbidden-strings.md:7` was repointed from the deleted `referral-dispose-dialog.test.tsx` to `dsr-meeting-dispose-dialog.test.tsx`. The swap was **gate-forced** (`check-rules-staleness.mjs` reds on a glob matching zero files) and correct, but the rule is about proving the UI does **not** say something and the new target contains **no absence assertion**. The file that carries the pattern — `dsr-meeting-residue.test.tsx` (`queryByText(line)).toBeNull()`) — is still not in `paths:`. |
| **m6** | `src/components/shell/dsr-console-link.tsx:20-33` presents the hat→shell mapping under *"⛔ WHICH SHELLS MUST RENDER IT IS A MEASURED SET, NOT A GUESS"* and never states the executor precondition. **Measured from `pg_proc.prosrc`:** `list_my_dsr_hospitals()`'s executor arm is `select distinct t.hospital_id from public.dsr_tasks t … where app.can_execute_dsr_task(…)` — **an executor sees the link only once a routed task exists**; the DPO arm is unconditional. ⭐ **My judgement: stale/incomplete docblock, not a defect.** It never *asserts* unconditional visibility, the sibling prop doc gets it right (`app-sidebar.tsx:488-490`), and there is no bootstrap deadlock because intake is DPO-only (`titulares/page.tsx:62`). One sentence fixes it. |
| **m7** | `dsr-console-link.tsx:45-51` names three deliberate shell omissions. Two more are unlisted: `src/app/o/page.tsx` (the org picker, where root landing sends a multi-org `org_admin`) and the `QualityViewerShell` early return at `c/[commission]/layout.tsx:126`, which precedes the tenancy branch at `:150`. Neither is a reachability break (both personas have `/manage`), but the exclusion list is not the complete measured set it claims to be. |
| **m8** | `phi-input-hint.tsx:132` uses raw `useId()`, while `useFieldIds` (`field.tsx:143-152`) deliberately sanitises ids because *"this codebase resolves ids by string-building a selector (`#${id}`)"* — which `e2e/dsr-nav-and-phi-hint.spec.ts:177` does. Inert on React 19.2.4; it is the forward-defence `field.tsx` documents, and the `PhiInputHint` docblock justifies `useId` without mentioning it. |
| **m9** | `dsr-meeting-dispose-dialog.test.tsx:6-7` claims the deleted file was *"the ONLY place in the repo asserting the type-to-confirm arming pattern (`toBeDisabled`/`toBeEnabled` appeared in that file and nowhere else)"*. At `main` those matchers appear in **32 files**. The substantive claim survives — `DsrMeetingDisposeDialog` is now the only type-to-confirm control in `src/components` and had no arming test — but the parenthetical reads as a measurement and is not one. |
| **m10** | **Two of the four lanes' shape-1 pins were not executed as mutations.** ADR 0129 Amdt 3's table lists widening mutations for `guard_rca_child_lock` and `guard_interview_child_lock` only; the capa (t26/t27) and `meeting_cases` (t59/t60) twins are reasoned, not executed. I closed the gap by catalog instead: all four twin RPCs do set their lane GUC (`update_rca_factor`→`in_safety_rpc`, `set_capa_action_task_done`→`in_safety_rpc`, `update_interview_subject`→`in_interview_rpc`, `link_meeting_case`→`in_meeting_rpc`), so all four pins **are** sensitive to a shape-1 widening. Recorded so the coverage asymmetry is visible, not as a defect. |

---

## 4 · VERIFIED CLEAN — with how

### 4.1 Security / authorization (§A)

**The invariant.** Re-derived independently from `pg_proc.prosrc` with `--` comments stripped:
**3 setters / 5 readers**, members exactly as claimed (§C2 table). ✅

**This is NOT a widening of an access gate — I agree, and here is what would make it one.**
Four structural checks, all clean:

1. **No authorization surface changed.** The round's three migrations contain **zero**
   `create/alter/drop policy`, `grant`, `revoke`, or `enable row level security` statements.
   No `prosecdef` flipped; all eight touched objects are `SECURITY DEFINER` with pinned
   `search_path = app, public, pg_catalog`.
2. **The flag cannot be forged by a caller.** No function anywhere in the catalog calls
   `set_config` with a **non-literal** first argument, so there is no path that forwards user
   input into a GUC name. `app.*` is not a PostgREST-exposed schema, and `set_config` is not an
   exposed RPC.
3. **The bypass is transaction-local and narrow.** Every `set_config('app.in_disposal_rpc', …)`
   passes `is_local = true`, so it cannot leak into a pooled session. The doors open **four
   tight windows** (two each), and **no window spans `capa_plan`, `cases`, `documents` or
   `file_objects`** — verified by reading both door bodies. This is tighter than ADR 0129's
   shape required.
4. **Shape 1 stays out.** Every guard's stand-aside reads `app.in_disposal_rpc` and nothing
   else — no guard reads `app.in_safety_rpc` / `in_interview_rpc` / `in_meeting_rpc`.

**What would make it a widening:** a *non-erasure* door joining the setter set; a guard reading
a lane flag (shape 1); a window widened to span a table whose guard enforces access rather than
immutability; or `is_local = false`. None is present. The stand-aside is an **erasure** door's
reach through an **immutability** guard — it grants no read, no new write target, and no new
principal. ✅

**ACLs.** Censused `pg_proc.proacl` across `public` and `app`:
- **No `public`-schema function has a NULL `proacl`.** All three setters and all eleven DSR
  doors carry explicit `{postgres, authenticated, service_role}` grants; **`anon` appears in
  none**. ✅
- The five child-lock guards' NULL `proacl` is **pre-existing** (I did not attribute it to this
  round) and **structurally harmless**: they are `returns trigger`, which Postgres refuses to
  invoke directly — I probed `select app.guard_rca_child_lock()` as `authenticated` and it does
  not execute. **Judgement: acceptable.** Worth noting that the wider `app`-schema NULL-`proacl`
  population is large and long-standing; that is a pre-existing posture question, not this
  round's.

**Migration ordering / reachability.** `schema_migrations` holds `20261003000000` <
`…000100` < `…000200`; 434 registered == 434 files; the DSR module is gated *only* by the flag
and every door checks it inline; nothing pushed yet, so both land in one ordered `db push`. ✅
(The **authorization** for the flip is C1.)

### 4.2 Does the fix work, and can the tests fail? (§B)

**⭐ "Every lane asserts the Class-1 PHI is gone" — VERIFIED PER LANE**, by reading all 60
assertions:

| lane | keystone | Class-1 assertion |
|---|---|---|
| A · rca (`HC047`) | t5 | **t6** `event_patient` = 0 · t7 `phi_disposed_at` stamped + reason |
| B · capa `completed` (`HC049`) | t18 | **t19** `event_patient` = 0 · t20 stamped |
| B2 · capa `cancelled` | t29 | **t30** `event_patient` = 0 |
| C · interview `completed` (23514) | t35 | **t36** `patient_identifiers` = 0 · t37 stamped + reason |
| C2 · interview `cancelled` | t46 | **t47** `patient_identifiers` = 0 |
| D · `meeting_cases`, signed meeting (23514) | t52 | **t53** `patient_identifiers` = 0 |

No lane is redaction-only. ✅ The suite additionally carries, per lane: a fixture-reached-the-
locked-state control (t1/t15/t28/t32/t45/t49), a children-exist control (t2/t16/t33/t50),
a PHI-exists-before control (t3/t17/t34/t51), a **sibling-row survival control**
(t10/t23/t40/t55) that defeats `delete from` and unfiltered `update`, a flag-reset pin
(t8/t21/t38/t57), and message-pinned refusals rather than bare SQLSTATE — which matters because
23514 is also what these lanes' validations raise.

**The six mutations.** I could not re-run them; instead I read each named RED set against the
suite line by line. **All six are internally consistent** — each mutation reds exactly the
lane's keystone + its downstream Class-1/redaction pins and leaves the survival, status and
flag-reset pins green, which is what a savepoint-rolled-back door produces. Nothing in the
table is a set that could not arise from its mutation.

**The shape-1 pin exists per lane and can fail** — see m10 for the two lanes verified by
catalog rather than by execution.

**The census (`docs/reviews/disposal-guard-crossing-census.md`) — reproduced, not accepted:**

- I ran its §6 query against the live catalog: **48 direct crossings, 9 MASK-DISJOINT** — exact.
- I ran its cascade-closure query: `answers` → 4 FK children, of which **3** carry a raising DELETE-masked trigger (`answer_references` does not). **48 + 3 = 51.** ✅
- Parts sum: 14 + 9 + 28 = 51 ✅, and I mapped **all 48 enumerated rows** back to the document's five sections (3a=10, 3b=4, §4=9, 5a=13 direct, 5b=4, 5c=8). Every row is accounted for; none is invented, none omitted.
- **All nine STRUCTURALLY-UNREACHABLE mask bits re-derived from `pg_trigger.tgtype`** — `reject_answer_on_display_item` I+U, `ensure_securable_resource{,_rca,_referral}` I, `trg_attendee_roster` D, `guard_meeting_active_print` D, `guard_referral_message` I. All nine correct.

**Is the property the right one?** Yes, and it is the property ADR 0129 Amdt 2 asked for. It is
narrower than "everything that can abort a door", so I probed the three residual classes it
does not cover — **all three are clean today**:

| residual | probe | result |
|---|---|---|
| trigger fns using a bare `RAISE` (plpgsql defaults to EXCEPTION), which `raise\s+exception` misses | negative-lookahead regex over every raising trigger on the write set | **zero** |
| a non-`CASCADE` FK child of a DELETE target (RESTRICT/NO ACTION aborts the delete, same shape) | `pg_constraint` where `confdeltype <> 'c'` on the four DELETE targets | **zero** |
| **transitive** writes through called functions (the property covers each door's own statements only) | the only nested writer is `app.audit_write` → `audit_log`, whose raising triggers are DELETE+UPDATE-masked | **INSERT is not in mask — clean** |

⭐ Worth adding to the census as a stated bound rather than leaving it implicit: the property is
**direct writes × row-level raising triggers**, so `CHECK`/`NOT NULL` constraints and transitive
writes are outside it. I checked the 17 columns the doors null-out or redact for `NOT NULL`:
only `participants.display_name` is NOT NULL, and the door writes `'[PHI removido]'`, not NULL.

### 4.3 Records that verify (§C)

- **ADR 0130 Amdt 5's corrected rationale — both halves, from the catalog.**
  `notifications_entity_type_check` admits `{capa_action, response_section_signoff, meeting,
  action_item, ethics_notification, commission, controlled_document_version,
  controlled_document}` — no `case`/`referral`/`event` ✅, and it **does** admit `meeting` and
  `capa_action` ✅, so Amdt 4's original argument really was incomplete.
  `app.enqueue_notification` is the **sole** `insert into notifications` in the whole catalog,
  with **16 callers / 25 call sites — exactly the figures the migration header claims.** I
  extracted all 25 call sites: every `capa_action` body is `capa_action.title`; every `meeting`
  body is `meetings.title` verbatim or `title || ' — <fixed string>'` in the two minutes-job
  lanes. And `dispose_meeting_minutes` writes only `minutes_md` + the disposal stamps on
  `meetings` — **it never touches `meetings.title`** — while `dispose_event_phi` writes
  `capa_action_task.description`, never `capa_action.title`. No disposal door writes
  `action_items`, `controlled_documents`, or `form_sections`. **The corrected rationale holds,
  at the right grain, naming the two columns rather than generalising about "titles"** — which
  matters, because the doors *do* erase `meeting_agenda_items.title`, `case_events.title`,
  `documents.title` and `cases.label`. The header gets this right, including flagging that
  `controlled_documents.title` is a different table from `documents.title`.
- **`notify_scrub_check` is genuinely retired.** **No function body in the catalog mentions it**
  any more; `dsr_tasks_kind_check` still admits it (historical rows stay valid);
  `close_dsr_request`'s `HCDS4` gate is generic over pending tasks and untouched.
- **Suite `354` is a model of the anti-vacuity discipline** — t3's zero is paired with a
  populated-request control (t4), a **positive control that constructs the row and requires the
  same query to read 1** (t5), a kind-still-admitted pin (t6), a still-completable pin (t7), and
  an over-grant twin (t12) proving the gate was not simply deleted. Its own header records that
  the `kind <> 'notify_scrub_check'` filter at `:120` was a real vacuity in the first draft,
  caught by asking what the mutation would do — not by the suite going green.
- **No record describes this round as a rollback.** Every occurrence of "rollback" is either the
  *declined* D4(b) option, D4(b)'s eligibility, or the failure mechanism ("the RPC rolls back").
  `PROGRESS.md:176` and `ADR 0131:285` state explicitly that it is not one. **P1 honoured.** ✅
- **P4 honoured.** `dm5-po-decisions.md` item 2 carries the training premise, the 133-column
  census, the two-layered control and the `DSR_RESIDUE_NOTICE` ruling — at the pilot-decision
  surface, as ADR 0131's Consequences require. ✅
- **`npm run lint:progress` passes**; PROGRESS.md = 71,568 bytes, under the 80 KB cap.

### 4.4 Frontend (§D)

- `DsrConsoleLink` is `"use client"` and does **zero** data access — every caller resolves
  `reachesDsr` server-side through `listMyDsrHospitals()` in `src/lib/queries/dsr.ts:253`
  (Rule 9 ✅, `cache()`-wrapped, safe-defaults `[]`). Flag-off / empty renders nothing at all
  five call sites. ✅
- The hospital-level **Encarregado with no commission membership is correctly locked out** — not
  a nav bug: `app.is_dpo_of_for` carries an `exists (… app.has_role_any('commission', …))` hard
  conjunct and `organizations_select` has no DPO arm. That is `FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER`, already filed. ✅
- **All 20 PHI-hint instances resolve through `aria-describedby`** — 14 via `PhiInputHint`'s
  render prop + `FieldDescription`, 5 via `useFieldIds().descriptionId`, 1 hand-wired. Tests
  assert on **rendered DOM**, resolve `aria-describedby` to real nodes, and carry two genuine
  positive controls (an unwired hint and a dangling id must both throw). Strings are pt-BR. ✅
- **`useFieldIds`' no-DOM-`name` default is NOT flipped** — `src/components/ui/field.tsx` is
  untouched by the branch (empty diff), `name: options.nameRequiredFor ? name : undefined`
  stands, and the new dialog explicitly forbids adding `nameRequiredFor`. The MRN-in-URL scar
  is respected. ✅
- **Both silent coverage drops were real and both relocations can fail.** The residue-CLASS
  content pin moved to `dsr-disposal-overclaim.test.tsx:335-357` (⚠ property changed from
  rendered text to the constant — declared openly, and jointly covered by
  `dsr-meeting-residue.test.tsx`'s rendered iteration); the type-to-confirm arming pin ported to
  `dsr-meeting-dispose-dialog.test.tsx:83-118` as four tests pinning **both** directions, so
  neither a hard-disabled nor a hard-enabled component passes. The negative arm shrinking 5→4
  surfaces is documented rather than allowed to shrink silently. ✅
- No dangling **imports** or code references to `ReferralDisposeDialog` anywhere. `error.tsx`
  is `"use client"`, pt-BR, leaks no Postgres error, and deliberately renders nothing about the
  request (`file_ref` is free text stored in the clear). ✅

### 4.5 Scope discipline (§E)

Nothing PO-ruled-out was built. I diffed all of `src/` and `supabase/` for outcome-record
export/print/download paths (**none**) and for Class-2 `professional_profiles` / `ethics_*`
erasure (**none** — the single `ethics_notification` hit is a line in the notification-writer
census comment). `DSR_RESIDUE_NOTICE` is unchanged. **The one scope breach is in the other
direction: the flip migration (C1), which §3b prohibited.**

---

## 5 · Comments on the already-known items (not re-filed)

- **`FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE` may be mis-severitied.**
  `backend-state.md` now records that the DSR task inbox is **the only working UI path to all
  four erasure doors** (route reachability and the dispose gate are hat-disjoint in production).
  That makes the referral lane the one erasure door with **zero** browser coverage on the only
  surface that can reach it — a stronger position than when it was filed alongside a dialog.
- **`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE` closing on removal of its subject is the right
  grounds**, and the residual is correctly named. No objection.
- **`FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE`** — correctly filed by its own author, and
  the spec states its bound in its header rather than letting the shared fixture imply coverage.
  Good practice; leave as filed.
- **`FUP-E2E-HELPERS-SWALLOW-FAILED-READS`** (~48 files, deliberately unswept) — I agree with not
  sweeping: where a helper reads under an RLS-scoped key, asserting `ok()` would be the wrong
  assertion. The reasoning is recorded, which is what the item needs.

---

## 6 · ⛔ COULD NOT VERIFY — this is a work list, not a caveat

| # | item | why | who should close it |
|---|---|---|---|
| **W1** | **The four authz ARM verdicts** (`census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper`). `ARM=census` is the arm that catches a gate you just added; the round rewrote three `public.*` DEFINER bodies and three `app.*` trigger bodies, all of which re-enter its domain. | stack busy | lead — already run; needs no re-run, only the record naming the ARM |
| **W2** | **The six mutation runs**, incl. the hash-verified restores. I read them for sensitivity (§4.2) but executed none. ⚠ `[[mutation-harness-must-prove-its-rollback-first]]`: a restore claim needs both directions proven, and I could not check the stack is clean of a left-open neutralization. | stack busy | backend/lead — confirm no residual neutralization survives on the shared stack |
| **W3** | pgTAP 6789/6789 (205 files), vitest, `tsc`, `lint` 8/8, 434/434 migrations. | not re-run | lead (verified); m2 flags the one figure that disagrees |
| **W4** | **`e2e:prod`.** Pending. ⚠ See M6 — expect the third "pre-existing" failure to be **green**, because its fix is on this branch. | running | lead |
| **W5** | **Whether the PO authorized the `dsr` flip** (C1) and its two riding questions. I can only report that it is recorded nowhere outside the migration comment. | outside the repo | PO / lead |
| **W6** | The five child-lock guards' `proacl` **before** the migration. I verified the after-state and argued harmlessness structurally; I cannot re-run a reset to establish the before-state. | cannot reset | accepted — the harmlessness argument does not depend on it |
| **W7** | **`dm5-po-decisions.md` item 2's corridor figure** — *"only `rca` is fully covered; six lanes each have a structurally terminal state no door reverses"*. This widens ADR 0131 Amdt 2's explicitly **meeting-only** measurement to all seven lanes, and `FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED` is open **because** that was unmeasured. I did not re-derive the seven `reopen_*` transition graphs. ⭐ A newly-precise number that arrived without a new measurement is worth an independent check. | not re-derived | backend |
| **W8** | Runtime behaviour of the DSR nav for the two named personas, and `next build`. The new spec `e2e/dsr-nav-and-phi-hint.spec.ts` covers exactly them (and constructs a routed task first), but it was not run; the five layouts now import `@/lib/queries/dsr` server-side, which only a build proves clean of the `lint:client-server-imports` class. | stack busy | W4 covers it |

---

## 7 · What to change to reach APPROVED

**Blocking:**

1. **C1** — record the flip's PO authorization at `dm5-po-decisions.md` (naming the
   platform-wide scope and the C1b disposition), and amend `plan:179-181`. Or drop
   `20261003000200` from this branch.
2. **C2** — `CREATE OR REPLACE` `app.guard_meeting_child_lock` and
   `app.guard_reserved_child_lock` with the corrected bound (**3 setters, all disposal doors ·
   5 readers, all child-lock guards**), and amend ADR 0126 §E:461 in the same change — ADR 0129
   Decision 3's own rule.
3. **C3** — add ADR 0131 Amendment 5 recording the P3 reversal and its measured premise; fix
   `plan:81`, `:126`, `:142`; record the revision at `dm5-po-decisions.md`; correct the
   `ADR 0130 D11` citation at `bug-log-archive.md:1408`.

**Major (all text/record):** M1, M2 (`backend-state.md`), M3 (the roster + two sibling dangling
comments), M4 (procedure §2 precondition 1 — keep the lane-flag half), M5 (one reproducible
host count), M6 (reconcile the two bug IDs and refresh the E2E baseline line **before** reading
the gate result).

**Minor:** m1–m10 at the lead's discretion; m1 and m4 are the two most likely to be believed by
a future session.

---

## 8 · Closing note

The four-lane fix, the four tight windows, the per-lane Class-1 assertions, the census as a
reproducible property, and `354`'s positive controls are the strongest disposal work in this
repo's record — the census in particular is an artifact I could re-run and fully account for,
row by row, which almost nothing here supports.

⭐ **And the round's own lesson recurred inside it.** ADR 0129 Amdt 2 named the failure as
*sweeping one sibling axis and reading it as having swept the class*. This round swept "which
**door** carries a false comment?" — thoroughly, at length, in the migration body — and did not
sweep "which **statement of the invariant** did I just falsify?". Three surfaces were corrected;
three were left asserting the old count, two of them in the catalog this repo calls the sole
truth. That is C2, and it is why the verdict is CHANGES REQUESTED rather than APPROVED with
notes.

---
---

# ROUND 2 — 2026-08-21

**Reviewed at:** `188469dd` (14 commits ahead of `main`) · **6 new commits since round 1.**
⛔ **Round 1 above is left exactly as written.** It is the record of what was found; the
round-2 section says what happened to each item, not what round 1 should have said.

# VERDICT: **APPROVED**

with **one record obligation that must land before merge** — §12.1 **R2-1**. It belongs to
CLAUDE.md §6 **step 5 (Record)**, which has not run yet, and it needs no re-measurement: the
correct figures are already known, they are simply not in the repo.

All three round-1 blockers are **closed and independently verified from the catalog**. All six
majors are **closed**. The `e2e:prod` gate is red for exactly one pre-existing reason with
`did-not-run 0`. The fix's correctness has now been proved twice, the second time by me.

---

## 9 · Method for round 2

Everything in §§10–11 was re-measured on the live stack, not read from the round-2 report.
The one thing I could do this round that I could not do last round: **round 1's catalog dump of
both meeting guards is verbatim in my context**, taken *before* migration `20261003000300`
existed. That made an independent before/after body-invariance proof possible (§11.2) rather
than an audit of someone else's proof.

Re-derived from scratch: the setter/reader invariant, the 48+3 crossing census, migration and
suite counts, both guard bodies and their attribute sets, the `content_hash` chain, and the
`app.feature_flags` shape.

---

## 10 · The three blockers — CLOSED

### ✅ C1 — the flip's authorization

Recorded in all three places, and the two riding questions are answered rather than deferred:

- `plan:84` — new **P5** row, with the honest provenance line: *"⚠ Recorded here only on 2026-08-21, after QA blocker C1 found the authorization existed **nowhere but the migration's own comment**."*
- `plan:183-199` — §3b amended in place, the now-false premise superseded **with the old text kept** rather than overwritten.
- `dm5-po-decisions.md` **item 3** (the pilot-decision surface) and **ADR 0131 Amendment 5 §2**.
- ⛔ **"The PUSH is a separate, untaken decision"** is stated explicitly. That is the right boundary: this branch's merge does not itself flip production.

⭐ **The lapse was written up as a lead failure rather than filed as a nit.** That is the
disposition that makes the lesson survive; a nit gets closed.

### ✅ C2 — the invariant stated at its old value

Re-derived by me from `pg_proc.prosrc`, comments stripped: **3 setters / 5 readers**, members
unchanged. The corrected statements are live in the catalog — I read both guard bodies from
`prosrc`, not from the migration file.

⭐ **`backend` did not stop at the three instances I named.** It swept the axis
*"which statement of the invariant did I just falsify?"* and found **two more** that neither of
us had: ADR 0129 Decision 3's own quotation of what §E "becomes", and `follow-ups.md:4958`.
**That is the sweep C2 was actually asking for** — my three were a hand list, and a hand list is
what this round has spent itself correcting. Five instances, one axis, swept.

**And the fix changes shape, not just value.** Both guards and ADR 0126 §E now state the bound
as a **property** (*"only the disposal doors bypass a child lock"*) with the count beside it as
a **dated measurement plus the re-derivation query**. A property does not go stale on the next
correct change; that is the difference between this fix and the one it replaces.

**Detectability now exists**, which it did not before: suite `355` (§11.3).

### ✅ C3 — the overturned P3 ruling

ADR **0131 Amendment 5 §1** reverses it; the Amendment-4 bullet at `:349` is marked
*"⛔ REVERSED THE SAME DAY — see Amendment 5. Do not act on this bullet"* **in place**, so a
reader arriving mid-document cannot act on the dead ruling. Plan P3/D2 corrected;
`dm5-po-decisions.md` **item 4** records it at the pilot-decision surface. The
`ADR 0130 D11` mis-citation is corrected.

---

## 11 · The three things the lead asked me to be sceptical about

### 11.1 ⭐ ADR 0126 §E's NEW safety argument — it holds, and I verified it through the hash chain rather than through the artifact §E cites

§E's replaced reasoning genuinely did have a hole, and §E is right about where:
`dispose_case_phi` writes `meeting_cases` — one of `guard_meeting_child_lock`'s own four tables
— and stamps `cases.phi_disposed_at`, **never** `meetings.phi_disposed_at`, so §F's
un-registration does not fire. Confirmed from both door bodies.

The new argument is *"`meeting_cases` content is not in the printed ata at all"*, derived from
the TS body type and the template. **A TS type is not automatically evidence about a hash**, so
I chased the hash to its source before accepting it:

| step | measured |
|---|---|
| `printed_documents.content_hash` | a **parameter** — `p_content_hash` — to `mint_printed_document`; the SQL computes nothing (`prosrc`) |
| what computes it | `sha256(renderDocumentHtml(payload))` — `src/lib/pdf/fingerprint.test.ts:281,321` |
| `renderDocumentHtml`'s only input | `DocumentPayload` → the meeting arm is `MeetingDocumentBody` |
| `MeetingDocumentBody` | meeting metadata · `minutesMd` · `agenda` · `attendance` · `actionItems` — **no case-shaped field exists to populate** (`types.ts:254-281`) |
| `MeetingAgendaEntry` | exactly the four `meeting_agenda_items` columns (`types.ts:236-241`) |

**⇒ Because the print hash is computed application-side over the rendered payload, the TS body
type IS the right artifact — §E cites the correct layer.** A `meeting_cases` redaction cannot
reach `renderDocumentHtml`, so it cannot move the hash.

⭐ **A second, independent surface §E does not use, and it is the stronger one.**
`sign_meeting`'s `content_hash` is `encode(digest(coalesce(v_minutes,''),'sha256'),'hex')` —
**`meetings.minutes_md` alone**, straight from `prosrc`. `dispose_case_phi` never writes
`minutes_md`. So the signature hash is immune **by a catalog-level formula that does not go
stale when a template changes** — precisely the weakness §E names in its own bound. Worth
adding; not required.

**§E's stated bound is exactly right** and I want it on the record because it is unusually
honest: *"derived from the TS body type and the template, **not** from an end-to-end hash
differential … If a future template ever renders per-case notes into the ata, THIS is the
paragraph that goes false — and it goes false silently."*

⚠ **One completeness gap.** §E says the argument was *"re-derived for the new setters"*
(plural) and re-derives it for `dispose_case_phi` only. The other new setter,
`dispose_event_phi`, writes **none** of `guard_meeting_child_lock`'s four tables — verified from
the 48-crossing enumeration (its write set is `rca*`, `capa*`, `event_triage`,
`patient_safety_event`, `event_patient`). It is silently clean; a symmetric re-derivation says
so in one clause. **Not a defect** — the conclusion is unaffected — but "re-derived for the new
setters" currently shows one of two.

### 11.2 ⭐ Body-invariance — the remediation is real, and I did not take it on trust; I proved it myself

Round 1's dump of both guards predates migration `20261003000300`. I normalised both
before/after pairs (strip `--` to end of line, remove all whitespace) and hashed:

```
guard_meeting_child_lock    OLD 6b6865410fcbae04b2c45855f4e9c6e6   NEW 6b6865410fcbae04b2c45855f4e9c6e6   (592 chars)
guard_reserved_child_lock   OLD 1280e25f5b8c58e7822b7d6ae02ba2de   NEW 1280e25f5b8c58e7822b7d6ae02ba2de   (1200 chars)
POSITIVE CONTROL - one executable token mutated in OLD (in_signature -> in_signatureX)
                            CTL 827427a213c4448023f0dc03eb13a72b   != OLD   the detector moves
```

**The executable bodies are byte-identical. Comment text only, as claimed.** ⭐ Note the
normalised strings are **592 and 1200 characters** — non-empty by a wide margin, which is the
specific property that defeats the empty-compares-equal-to-empty failure. My proof is not
vulnerable to the defect it is checking.

⭐⭐ **And I reproduced the silent failure itself.** My own attribute census hit
`ERROR: operator is not unique: text || "char"` on `provolatile` — **the identical error**
`backend` reported. In `psql -c` it surfaced and exited 1; in a harness capturing stdout into a
variable it yields an **empty string**, and empty compares equal to empty. **The reported defect
is real, not a hypothetical retold.** That is exactly the class this round exists to close,
found inside the instrument meant to prove the fix — and reported by its own author, which is
the behaviour to keep.

Attributes with explicit casts, both guards:
`prosecdef=t · provolatile=v · proisstrict=f · proparallel=u · procost=100 · prorettype=trigger ·
proacl=NULL · search_path=app,public,pg_catalog · plpgsql`. **`prosecdef`, `proconfig` and
`proacl` match my round-1 record exactly**; `prorettype`/`proargtypes` cannot change under
`CREATE OR REPLACE` (Postgres refuses). `proacl` is still NULL — unchanged, pre-existing, and
harmless for the reason established in round 1 §4.1.

✅ **The choice not to use a runtime `pg_get_functiondef() + replace() + execute` rewrite is
correct** and the rationale is right: that pattern is what makes migration text stale by design
and has already produced a confident false P0 here. Full literal text plus a proof is the better
trade.

### 11.3 Suite `355`, and the lead's own three instrument errors

**`355` is well built.** t1/t2 are real vacuity controls (the identical predicate shape run
against `app.in_meeting_rpc`, required non-empty, **before** anything else is believed). t3 is
`set_eq` on **names**, not a count — and the header's reasoning for that is correct and worth
keeping: *"a count reds identically for two opposite events … **the bump is the defect**"*. t4
is a **property** (every reader is a trigger function) that survives a legitimate fourth child
lock, paired with t5 so an empty reader set cannot satisfy it. Both pins are mutation-proven.

**The two bounds it states are the right two**, and stating the `lint:vacuous` blindness inside
the file is exactly right — `check-vacuous-assertions.mjs` globs `.spec.tsx?`/`.test.tsx?` over
`e2e/` and `src/` and never scans `supabase/tests/`, so nothing outside `355` checks that `355`
can fail.

⭐ **I probed the bound I expected to find missing, and it is empirically covered.** The literal
`like` predicate on `set_config('app.in_disposal_rpc'` has no whitespace tolerance, so
`set_config( 'app.in_disposal_rpc'` would evade it. Measured across the whole catalog: **164
functions call `set_config`, and 164 of 164 use the exact literal shape; 0 use whitespace before
the quote.** Same for `current_setting`: **0**. The predicate matches the entire population as
written. This belongs as one line in `355`'s bounds paragraph — not as a finding.

**On the lead's three instrument errors** (`test-run-archive.md` §2026-08-21): the write-up is
accurate and does **not** understate them. Both gate-run errors are named with their mechanism
(a trailing `echo` supplying exit 0; `&&` reading `tail`'s status), and the third — the two
over-cap cells at 741/345 against a 300 cap — is the stated reason for the rotation, with the
right principle attached: *"a table cell carrying a paragraph is an archive entry that has not
been written yet."* ⭐ It also names error 2 as a **recurrence** of a lesson the repo already
carries. See **R2-6** for the one thing that follows from that and is not yet done.

⭐ **The census-sum finding is a genuine resolution, not a restatement.** `1166 + 2 + 3 + 11 =
1182` sums exactly; the gate prints `accounted for 1171 of 1182` because its coverage line omits
the skipped bucket. So `FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER`'s *"11 tests in no bucket"*
were **always skips in a bucket the coverage line does not add** — the arithmetic half is
closed on evidence, and the write-up correctly keeps the crash-classifier half open rather than
closing the whole item.

---

## 12 · Round-2 findings

### 12.1 🟠 R2-1 — MUST FIX BEFORE MERGE. The gate record is one increment behind the branch, in all three places it appears, and the true figures exist nowhere in the repo

| | recorded | live, measured by me |
|---|---|---|
| pgTAP | **6789/6789**, Files=**205** | Files=**206** on disk (`355` added by `188469dd`) |
| migrations | **434/434** | **435 == 435** — `select count(*) from supabase_migrations.schema_migrations` **and** `ls supabase/migrations/*.sql \| wc -l`, both 435 (`20261003000300` registered) |

Stale in `PROGRESS.md:299`, `docs/progress/test-run-archive.md:799`, and
`docs/decisions/0129-…md:299`. The lead's own message states the correct figures — **pgTAP
6795/6795, Files=206, 435/435** — and a `grep -rn` for `6795`, `Files=206`, `435/435` or
`435 == 435` over `PROGRESS.md` and `docs/` returns **nothing**.

⛔ **This is C1's shape one layer down: a verified measurement whose only witness is outside the
repo.** The commit it fails to describe is precisely the one that added a pgTAP suite and a
migration, so the recorded evidence does not cover the change being approved. It is the fourth
instance in this round of *a mid-round number presented as final* (round-1 **m2** was the
first).

**It is not a step-3 blocker** — nothing needs re-running, the delta is fully explained
(+1 suite = +6 tests, +1 migration), and the numbers are already verified. It is a **§6 step 5
(Record)** obligation, which is the lead's own step and runs before merge. Hence APPROVED with
this named.

### 12.2 🟡 R2-2 — `backend-state.md`'s migration registry is now wrong by two, and the section still omits two of the round's four migrations

Round-1 **m1**, unaddressed and now worse. `docs/backend-state.md:26` and `:501` both read
**433 == 433, "measured 2026-08-21"**; live is **435 == 435**, measured today. The section header
at `:480` still lists migrations `20261003000000`–`…000100`, omitting **`…000200`** (the
production go-live flip — the round's highest-consequence migration) and **`…000300`**.

This is the banner fact a new session reads first, in the file whose own header instructs the
reader to measure rather than quote.

### 12.3 🟡 R2-3 — suite `355` is recorded in no durable document

A `grep -rln` across `docs/` and `PROGRESS.md` for `355_disposal_bypass_invariant` or
"suite 355" returns **nothing**. The pin that makes the next drift of the security invariant go
RED is reachable only from two guard comments and one migration header — not from
`backend-state.md`'s disposal section, not from ADR 0129 Amdt 3, not from the gate row. C2's fix
turned an undetectable invariant into a detectable one; the surface map does not know it.

### 12.4 🟡 R2-4 — `355` t6's comment asserts more than its SQL checks

```
-- Stronger than "returns trigger": every reader is actually INSTALLED as a row-level
-- BEFORE trigger somewhere. … a reader that is installed on a table NOT under a child
-- lock would be a silent widening.
… not exists (select 1 from pg_trigger t where t.tgfoid = p.oid and not t.tgisinternal)
```

The query examines **no `tgtype` bit** — neither row-level (`&1`) nor BEFORE (`&2`) — and does
not check *which* table the trigger sits on. It asserts "installed somewhere, as some kind of
trigger". The **test title is accurate** (*"installed as a trigger on at least one table"*); the
comment above it is not, and it raises a widening it then does not detect. ⛔ In the newest
artifact of a round about comments that assert more than the code does. Either tighten the SQL
(`(t.tgtype & 1) = 1 and (t.tgtype & 2) = 2`, and constrain `tgrelid` to the child-lock tables)
or narrow the comment to what t6 proves.

### 12.5 🟡 R2-5 — `ADR 0129:300` still records vitest **1512/1512**

Round-1 **m2**, unaddressed. The lead's verified figure is 1506/1506. Same class as R2-1.

### 12.6 🟡 R2-6 — the `| tail` masking has now fired twice in ~24 hours, and the response is a third prose record

`test-run-archive.md` carries the Slice-4 method note (*"a gate summary can hide a failed gate;
capture `$?` from the gate itself, never from a pipeline"*) **and**, below it, the same defect
recurring against a different gate. The standing lesson currently lives in a memory note and two
archive paragraphs — **none of which is a gate or a `.claude/rules/` entry.**

CLAUDE.md §8's admission test is met cleanly: it is a standing prohibition with **no resolution
event**, it has a **checkable anchor** (a `package.json` script, or an invocation piping a gate
into `tail`/`head`), it names a `source:`, and it is cheap to path-scope. Two occurrences in one
day is the evidence the prose form does not hold. ⛔ **Recording a recurrence is not a control** —
that is this round's own thesis.

### 12.7 🟡 R2-7 — one dangling reference to the deleted dialog still reads as present tense

`src/components/dsr/disposal-copy-property.ts:5-9`: *"The property **is asserted from two
files** (`dsr-disposal-overclaim.test.tsx` …, **`referral-dispose-dialog.test.tsx` claim 2** for
the referral dialog, where it **is also** `FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure
instrument)."* That file no longer exists — and the sentence is also the module's own stated
reason to exist (*"Two copies of a pattern drift"*), which is now one copy.

The other four references were correctly rewritten as historical provenance and are fine. This
is the one still stated as a current fact.

---

## 13 · Majors from round 1 — all CLOSED

| | how it was closed |
|---|---|
| **M1** | `backend-state:483-490` now states it at the right grain and says so: *"⛔ It is **not** true that every disposal fixture in the tree used a non-locking parent: `348` and `351` deliberately walk a meeting to `in_signature`, which is exactly why the **meeting** lane's door worked."* ⭐ The narrowed version is a better lesson than the one it replaces — **the lane forced to build a locked fixture is the lane that worked.** |
| **M2** | now **"two of the four"**, naming `dispose_event_phi` and `dispose_case_phi`, with `dispose_referral_phi` and `dispose_meeting_minutes` each excluded for its own stated reason. |
| **M3** | roster corrected to **three**, with *"three is the whole population, not a shortfall"* and an explicit ⛔ block explaining that the fourth surface **ceased to exist** rather than going unpinned. |
| **M4** | precondition rewritten; all three corrections carried explicitly — flags are **GLOBAL not per-tenant**, the code is the lane's **`check_violation` not `HCDS1`**, and the `dsr` conjunct is gone. The true half (`app.assert_<lane>_enabled()` raises rather than no-ops) is kept. |
| **M5** | fully re-derived with the grep beside each digit: **19 hosts / 20 rendered hints** — 14 render-prop, 5 constant-only, and the 4-vs-14 split that is the actual rationale for the render prop. ⭐ `frontend` also caught **its own** re-quoted figure ("eight pins" → 7). |
| **M6** | deduplicated — `BUG-DSR-S3-AGENDA-TITLE-STALE` no longer appears in `PROGRESS.md` (0 occurrences); the archive keeps the `-PIN` name. |

---

## 14 · The round-1 "could not verify" list — what discharged

| | status |
|---|---|
| **W1** ARMs | Re-run and HOLD per the lead. Still lead-verified, not qa-verified — unchanged in kind. |
| **W2** mutations / stack cleanliness | ⭐ **Partly discharged by measurement.** I re-ran the census on the live stack: **48 direct crossings / 9 mask-disjoint**, identical to round 1; the invariant re-derives at 3/5; both guard bodies are byte-identical to their pre-migration state. Nothing in the disposal area is left neutralized. The mutation *runs* remain unre-executed. |
| **W3** gate numbers | ⛔ **Superseded by R2-1** — the recorded figures are now one increment stale. |
| **W4** `e2e:prod` | ✅ **DISCHARGED.** 1166p / 2f / 3 flaky / 11 skipped / **did-not-run 0** / 1182 collected, census sums. Both failures are `BUG-QO-STALE-CASOS`. Every DSR spec passed, including both new ones (batch 4, 57/57). ⭐ **`did-not-run 0` on all nineteen batches is the field that answers the serial-abort question**, and it is the right thing to have led with. |
| **W5** flip authorization | ✅ **DISCHARGED** — §10, C1. |
| **W6** pre-migration `proacl` | Unchanged; the harmlessness argument never depended on it. |
| **W7** corridor coverage (7 lanes) | ⛔ **STANDS, UNTOUCHED.** ⚠ It is **not** discharged by the gate run, and I want to be plain about that since the message suggested it might be: W7 is a re-derivation of seven `reopen_*` **transition graphs** in the catalog. An E2E suite cannot answer it, and `FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED` is open precisely because nobody has. The precise claim still resting on nothing is `dm5-po-decisions.md` item 2's *"only `rca` is fully covered; six lanes each have a structurally terminal state no door reverses"* — a newly-precise number that arrived without a new measurement, sitting at the pilot-decision surface. |
| **W8** nav runtime + build | ✅ Discharged by W4 — `e2e/dsr-nav-and-phi-hint.spec.ts` ran green in a prod-standalone build. |

---

## 15 · Why APPROVED

The three blockers were not merely patched to the letter of what I wrote. **C2 in particular
was answered by sweeping the axis rather than fixing my list** — which found two instances I had
missed, changed the statement from a count to a property, and added the pgTAP pin that makes the
next drift red instead of silent. That is a better outcome than the finding asked for, and it is
the correct response to a finding of this class.

What remains (R2-1 … R2-7) is entirely record and comment text. None of it is security-bearing,
none changes behaviour, and R2-1 — the only one I am gating on — needs a transcription, not a
measurement.

⚠ **One pattern to name, because it is the round's own subject and it has not stopped.** Round 1
found records quoting numbers from mid-round; round 2 finds the same thing again, three more
times (R2-1, R2-2, R2-5), including the figures for the very commit that fixed C2. The
mechanism is stable and worth stating once: **a record written at commit *n* is measured at
commit *n*, and the round keeps going.** The `docs/backend-state.md` header's own instruction —
*"re-derive from `pg_proc`, never from this table"* — is the right rule; **the same rule applied
to the round's own gate figures would have caught all three.** The durable fix is what C2 did to
the invariant: state the property, and mark the number as a dated measurement with the query
beside it.

⭐ Finally, the thing I most want on the record: **`backend` reported its own harness failing
silently, and `frontend` reported its own re-quoted figure.** Both were found by their authors,
not by review. Five corrected magnitudes in this round came from somebody re-measuring their
own claim. That is the control that actually works here, and it is worth more than any of the
findings above.
