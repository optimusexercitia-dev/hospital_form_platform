# Backend State — privacy, LGPD and subject requests

> Part of `docs/backend-state/` — **start at [`README.md`](README.md)**, which routes you to the
> one file you need and carries the maintenance rules in full. ⛔ A posted section is FROZEN:
> correct it by APPENDING a `⚠ **Superseded** — … See <file> § <heading>.` marker, never in place.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below. Replace this block in
place; never append to it, and never move a line of history into it (ADR 0198). Figures live in the
generated registries; the live catalog is the authority (ADR 0078).

### Surface

- **Three tables** — `hospital_dpos` · `dsr_requests` · `dsr_tasks`, RLS on at creation. `authenticated`
  holds **SELECT only**: every write is a DEFINER door, and there is **no write policy on any of the three**.
  Read policies `hospital_dpos_select` · `dsr_requests_select` · `dsr_tasks_select` carry **no
  platform-admin arm** — ADR 0130 D2 puts it outside this plane entirely: content, not tenancy.
- **The adjudication path** — `create_dsr_request` → `adjudicate_dsr_request` (stamping
  `dsr_requests.{adjudicated_at,adjudicated_by}`) → `complete_dsr_task` / `attest_dsr_task` →
  `close_dsr_request`; roster `appoint_hospital_dpo` · `revoke_hospital_dpo`; listers `list_my_dsr_hospitals`
  · `list_my_executable_dsr_tasks` · `list_my_dsr_task_commissions` · `list_dsr_disposable_meetings`;
  predicates `app.is_dpo_of` · `app.is_dpo_of_for` · `app.can_execute_dsr_task`. Signatures, `prosecdef`
  and grants: [`generated-rpc-surface.md`](generated-rpc-surface.md) · [`generated-helper-surface.md`](generated-helper-surface.md).
- **The attested tier** — `dsr_tasks.{completion_note,attested_by_name,attested_redactions}` plus the
  `attest_review` kind. `attested_by_name` is a **STAFF reviewer's** signature, never the subject's.
- **The erasure / disposal doors are NOT DSR doors** — `dispose_case_phi` · `dispose_event_phi` ·
  `dispose_referral_phi` · `dispose_meeting_minutes`. The workflow only **ASSIGNS** disposal work; the
  executor fires the door under their **own** session, so all four disposal gates apply unchanged.
- **SQLSTATEs** `HCDS1`–`HCDS5`. App layer: `/o/[org]/titulares` · `src/lib/dsr/{actions,messages}.ts` ·
  `src/lib/queries/dsr.ts` · `src/components/dsr/*`.

### Invariants

- **The retention duty and the erasure duty are reconciled by DECIDING, then RETIRING — never by leaving
  erasure work pending.** A `refused_retention` close writes `dsr_tasks.status = 'blocked'`, and ⛔ `blocked`
  means **RETIRED BY DECISION, not "waiting"**: demanding those tasks be done would force erasing what the
  refusal retained. The pending-count asymmetry **stays**, and retained-vs-stalled is legible ONE JOIN AWAY,
  in `dsr_requests.status='closed'` plus a non-granting `outcome`.
- **A live legal hold outranks Art. 18** — the `HC0D3` legal-hold aborts on `documents`/`file_objects` are
  the **same fail-closed shape as the child-lock defect, opposite intent**.
- **Adjudication is REQUIRED before any erasing close.** *Close may record a decision directly only when the
  decision erases nothing.* `granted`/`granted_partial` require a prior adjudication; the three non-erasing
  outcomes keep the one-step path — **and stamp `adjudicated_at` anyway**. ⚠ `status` is the WORK state,
  `adjudicated_at` the DECISION fact: execution begun before the decision stays `executing` and still carries
  the stamp, so a predicate written against `status = 'adjudicated'` is wrong for exactly that population.
- **"The doors actually erase" is asserted as *the Class-1 PHI is gone*, not *the free text was redacted*.**
  On the failing path nothing is written **including the redaction**, so a redaction-only assertion goes
  green while the patient's identifiers survive.
- **The attested tier attests a REVIEW, not an erasure.** `dispose_meeting_minutes` erases the **whole** ata,
  including agenda items unrelated to the subject — so intake mints only `attest_review`. A `dispose_meeting`
  task exists **only** where a human passed that meeting's id to `adjudicate_dsr_request`, and the door bounds
  it three ways: the outcome must GRANT, the meeting must already be enumerated on **that** request (`HCDS2`),
  and it must not already be disposed (`HCDS5`).
- **`app.in_disposal_rpc` is the disposal bypass, and its SETTER SET is what bounds it** — every setter is a
  disposal door, every reader a child-lock trigger guard; a non-disposal door setting this flag voids every
  guarantee here. Its drift pin asserts that set **by NAME, not by count** (a count reds identically for two
  opposite causes). Re-derive both sets from `pg_proc.prosrc`, never from a map.
- **The erasure key is not the module noun.** `patient_xref` keys the **case** module on a
  **`patient_participants`** id while `dispose_case_phi` takes a **case** id; `create_dsr_request` resolves it
  via `app.case_of_patient_participant`, and without that resolution the case lane fails **closed forever and
  silently**. Events and referrals ARE keyed on the entity itself.
- **`complete_dsr_task` verifies the EFFECT, not the gate** — it reads the module row's own `phi_disposed_at`
  rather than mirroring four different gate expressions, because a fifth copy is a mirror nothing keeps in
  sync. ⛔ **ZERO disposal gates changed, and that is the design.**
- **Exactly ONE authorization gate in the whole program moved**: `public.search_patient_xref`, to
  `app.is_pqs_operator_of(h) **or** app.is_dpo_of(h)`. ⛔ Its keystone must be a **content differential** — the
  gate returns an EMPTY BUNDLE rather than raising, so `lives_ok` on a DPO's call is vacuous by construction.
- **Route reachability and the dispose gate are DISJOINT by `activeRole` — in production, not just in seed.**
  No persona holds both, so the **DSR task inbox is the only working UI path to all four erasure doors**.
  ⚠ `public.session_context()` being hat-blind is truth about the SQL and evidence about nothing downstream.

### Rollout

- Flag `dsr`. ⛔ Resolve its VALUE and its readers from [`generated-feature-flags.md`](generated-feature-flags.md),
  never from a sentence here — the go-live flip is its own migration, deliberately ordered after the
  child-lock erasure fix the execution tier depends on.
- ⛔ **Deployment status is not stated in this layer** (ADR 0198 D5). Whether a migration reached the
  remote is a claim about an external system that rots silently — measure it with the recipes in
  [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).

### Open edges

- A pure LGPD *Encarregado* with no commission membership **cannot reach `/o/[org]/titulares` at all** —
  `app.is_dpo_of_for` requires a commission role in the hospital as a hard conjunct, and `organizations_select`
  has no DPO arm. By design (ADR 0130 D2); `FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER`.
- Every DSR door is a `prosecdef` **scalar non-bool** command door, outside every official ARM's domain by
  shape (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`): the arms all pass and **none of them can see these doors**.
  Coverage is a hand-run neutralization battery, one at a time, every restore hash-verified — ⛔ do not read
  a green arm as a verdict here.
- `notify_scrub_check` is no longer minted at intake (the scrub was withdrawn as premise-falsified), but the
  kind **stays** in `dsr_tasks_kind_check` and stays completable for historical rows; no backfill, and the
  `HCDS4` gate is untouched.
- The disposal drift pin states two bounds of its own: a **dynamically composed** GUC name is invisible to it,
  and `lint:vacuous` does not scan `supabase/tests/`.

### Where the detail lives

- The frozen slices below, in order: **§ DSR Slice 2** · **§ DSR Slice 3** · **§ DSR operational
  remediation**. The guard-crossing derivation: [`disposal-guard-crossing-census.md`](../reviews/disposal-guard-crossing-census.md).
- ADR [0130](../decisions/0130-dsr-subject-request-workflow.md) (subject-request workflow) ·
  ADR [0129](../decisions/0129-meeting-child-lock-disposal-flag.md) (child lock, disposal flag) ·
  ADR [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) (erasure reach bounded to
  designated fields) · ADR [0035](../decisions/0035-lgpd-anvisa-regulatory-posture.md) (LGPD / ANVISA posture)
  · ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (door blindness).

## DSR Slice 2 — LGPD subject requests (2026-08-20; ADR **0130** Accepted + **Amendment 2**; migrations `20261001000000`–`…000200`, **3**; pgTAP `349` `plan(53)`; E2E `dsr-subject-requests.spec.ts`; flag **`dsr` OFF** — seed forces ON local/E2E)

Re-derive every row from the catalog; this table is a map, not the authority.

| surface | what | note |
| --- | --- | --- |
| tables | `hospital_dpos` · `dsr_requests` · `dsr_tasks` | RLS on at creation; `authenticated` holds **SELECT only** — every write is a DEFINER door, there is no write policy on any of the three |
| predicates | `app.is_dpo_of(hospital)` · `app.is_dpo_of_for(hospital, uid)` · `app.can_execute_dsr_task(hospital, commission, uid)` | all `prosecdef`; all **COVERED** by the diff-scoped door sweep (`authz-door-audit-findings.md`, hand-merged 2026-08-20) |
| doors | `create_dsr_request` · `complete_dsr_task` · `close_dsr_request` · `appoint_hospital_dpo` · `revoke_hospital_dpo` · `list_my_dsr_hospitals` · `list_my_executable_dsr_tasks` | ⚠ all seven are **outside every ARM's domain by shape** (scalar non-bool / void / jsonb command doors — the `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` class). Keystoned by hand instead, one neutralization at a time with a hash-verified restore; the list of which test catches which is in suite 349's header |
| policies | `hospital_dpos_select` · `dsr_requests_select` · `dsr_tasks_select` | ⛔ **none carries a platform-admin arm** — ADR 0130 D2 puts `platform_admin` outside this plane entirely (ADR 0078 A35 noun rule). This is content, not tenancy |
| SQLSTATE | `HCDS1` flag off · `HCDS2` unroutable/unresolvable xref row · `HCDS3` task not completable · `HCDS4` close refused, work outstanding · `HCDS5` illegal transition | |
| app layer | `/o/[org]/titulares` · `src/lib/dsr/{actions,messages}.ts` · `src/lib/queries/dsr.ts` · `src/components/dsr/*` | |

⛔ **ZERO disposal gates changed, and that is the design, not an omission.** The workflow ASSIGNS
disposal work; executors fire `dispose_case_phi` / `dispose_event_phi` / `dispose_referral_phi`
under their OWN sessions, so all four gates apply unchanged. `complete_dsr_task` verifies the
**effect** — the module row's own `phi_disposed_at` — rather than mirroring four different gate
expressions, because a fifth copy is a mirror nothing keeps in sync (ADR 0130 Amdt 2 item 2).

⚠ **THE GRAIN, because the module name lies.** `patient_xref` keys the **case** module on a
**`patient_participants` id**, not a case id (`app.trg_xref_maintain_patient_identifiers`), while
`dispose_case_phi` takes a **case** id. `create_dsr_request` resolves it via
`app.case_of_patient_participant`. Without that resolution the case lane fails **closed forever
and silently**. Events and referrals ARE keyed on the entity itself. Verify in `pg_proc`, never here.

⚠ **`hospital_dpos_select` was BLIND when first written** — opening it left the whole suite green.
Found by neutralization, not review. A NEW gate belongs to no BLIND set and so clears `ARM=policy`
vacuously; only `ARM=census` sees it, and only after a diff-scoped sweep gives it a verdict.

## DSR Slice 3 — adjudication + the attested tier (2026-08-20; ADR **0130** + **Amendment 3**; migrations `20261002000000`–`…000100`, **2**; pgTAP `350` `plan(56)`; flag **`dsr`**)

| surface | what | note |
| --- | --- | --- |
| ⭐ the ONE widening | `public.search_patient_xref` gate → `app.is_pqs_operator_of(h) **or** app.is_dpo_of(h)` | the ONLY authorization gate the whole DSR program changes (ADR 0130 D3). ⛔ Its keystone must be a **content differential** — the gate returns an EMPTY BUNDLE, it does not raise, so `lives_ok` on a DPO's call is vacuous by construction (`350` t4–t8) |
| new columns | `dsr_requests.{adjudicated_at,adjudicated_by}` · `dsr_tasks.{completion_note,attested_by_name,attested_redactions}` | table-wide `authenticated=r` already covers them (verified in `column_privileges` — these are NOT column-list grants like `profiles`/`case_referral`). `attested_by_name` is a **STAFF reviewer's** signature, never the subject's — Rule 12 pinned as a POSITIVE column list on both tables (`350` t11/t12) |
| new doors | `adjudicate_dsr_request(uuid,text,text,text,uuid[])→int` · `attest_dsr_task(uuid,text,int,text)` · `list_dsr_disposable_meetings(uuid)→jsonb` | all `prosecdef`; ACLs `{postgres, authenticated, service_role}`, no PUBLIC (diffed from the catalog, not from intent) |
| changed doors | `create_dsr_request` (attested-tier population) · `close_dsr_request` (consumes the decision; `p_outcome` now OPTIONAL) · `complete_dsr_task` (refuses `attest_review`; stops overwriting `note`; advances from `adjudicated` too) · `app.patient_trajectory_bundle` (case-code grain) | |
| new index | `dsr_tasks_request_kind_commission_uniq` `(request_id, kind, commission_id) WHERE entity_id IS NULL AND commission_id IS NOT NULL` | the pre-existing guard is `WHERE entity_id IS NOT NULL` and **cannot** cover an entity-less commission-scoped task |
| policies | **none added, none changed** | |
| refusal retirement | `close_dsr_request` writes `dsr_tasks.status = 'blocked'` (migration `20261002000300`) | ⛔ Measured defect: after a `refused_retention` close **all six tasks stayed `pending` and the executor was still offered six executable tasks — three of them PHI erasures** — for a request whose decision was to RETAIN. The workflow was instructing the opposite of its own decision, failing **open against a retention decision**. ⚠ The pending-count asymmetry **stays** (demanding those tasks be done would force erasing what the refusal retained); the fix RETIRES them. ⚠ **`blocked` means RETIRED BY DECISION, not "waiting"** — that distinction lives only in `dsr_requests.status='closed'` + a non-granting `outcome`, ONE JOIN AWAY. Every reader of `dsr_tasks.status` was swept before the value was first written (all nine SQL readers + TS + UI; list in the migration header): `complete_dsr_task`, `attest_dsr_task` and `list_my_executable_dsr_tasks` all needed fixing, and `getDsrOutcomeRecord` gained a `retired` count so `total` still equals its parts |
| BUG-DSR-S3-002 fix | `public.list_my_dsr_task_commissions(uuid)→jsonb` (migration `20261002000200`) | ⛔ `listMyDsrTasks` read commission names through a PostgREST **embed on `commissions`**, which is RLS-filtered — and the Encarregado is a plain member of ONE commission BY DESIGN, so a sibling commission's attestation rendered "Comissão fora do seu acesso" above procedure text saying "review THIS COMMISSION". An attestation against an unnameable scope is a NOMINAL one, and the outcome record reports it as coverage. Same fix shape as ADR 0130 Amdt 2 item 5, one grain down: a DEFINER lister over tasks the caller can already see. ⛔ **`commissions_select_member_or_admin` does not move.** Pinned by `350` t57–t60, incl. a **differential** (t58) that reds if the copied predicate ever drifts from `dsr_tasks_select`, and an **over-list twin** (t60) |

⛔ **THE `dispose_meeting` ESCALATION IS THE ONE THING TO GET RIGHT.** `dispose_meeting_minutes`
erases the **whole** ata — `minutes_md` plus `description`/`discussion_notes`/`resolution` on EVERY
agenda item, including items unrelated to the subject. Intake therefore still mints only
`attest_review` (Amdt 2 item 3). A `dispose_meeting` task exists **only** where a human passed that
meeting's id to `adjudicate_dsr_request`, and the door bounds it three ways: the outcome must GRANT,
the meeting must already be enumerated on **that** request (`HCDS2` — so the door's reach is its own
request, not the hospital), and it must not already be disposed (`HCDS5`). ⛔ The disposal gate does
not move; the DSR mints a **task**, and the executor fires the door under their own session.

**The close rule, statable in one line:** *close may record a decision directly only when the
decision erases nothing.* `granted`/`granted_partial` require a prior adjudication; the three
non-erasing outcomes keep the one-step path — **and stamp `adjudicated_at` anyway**, so every closed
request answers "when was this decided, and by whom?" with exactly one non-null answer.

⚠ **`status` is the WORK state; `adjudicated_at` is the DECISION fact.** They are deliberately not
the same thing: a request whose execution began before the decision stays `executing` and still
carries the stamp. Read the value, not the noun — a predicate written against `status = 'adjudicated'`
will be wrong for exactly that population.

⚠ **Every official authz ARM passes and NONE of them can see this slice's gate change.** `ARM=census`,
`hat`, `floor` and `FROMFINDINGS=1 wrapper` all HOLD, but ARMs 1/3/5 bound their domain by
**boolean-ness** and the row-door sweep by **row-returning-ness**; `search_patient_xref` and all three
new doors are `prosecdef` **scalar non-bool** command doors (`jsonb`/`void`/`integer`, `proretset=f`)
— the `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` class, same as Slice 2's seven. The diff-scoped recipe's own
syntax filter (`^(is_|can_|has_)`) yields an **EMPTY** case list for this diff, and a `CASES=`-scoped
row-door run swept **0**. ⛔ So "the arms hold" is true and says NOTHING about these doors.

> ⚠ **2026-09-08 (pre-AE5 Batch 6, ADR [0194](../decisions/0194-a-sweeps-cases-has-three-states-and-a-parent-unsets-it.md)) — the idiom in the sentence above has CHANGED MEANING; the measurement it records has not.**
> All four `p0-authz-*-audit.sh` sweeps now read `CASES` on **set-ness**, not value: unset = FULL run,
> set-and-non-empty = subset, **set-and-EMPTY = selects nothing and exits 3 UNPROVEN**. ⭐ A run that
> "swept **0**" is exactly the outcome that used to be **silent** and is now a loud, non-zero exit —
> which is the defect this batch closed: an empty `CASES` previously selected EVERYTHING and took the
> full-run branch that rewrites the committed baseline. ⛔ So do not reproduce that historical run by
> pasting `CASES=` — under the current semantics it stops rather than sweeps. A parent script asking
> for a full sweep must **`unset CASES`**; `p0-authz-invariant.sh`'s four call sites were repaired to
> that form in the same change. The two-step recipe is ADR 0079 § The recipe and `lead-playbook.md` §4. Their
coverage is a hand-run **37-probe** neutralization battery, one at a time, every restore hash-verified —
recorded per keystone in `350`'s header. **Do not read a green arm as a verdict here.**

## DSR operational remediation — the doors actually erase (2026-08-21; ADR **0129 Amdt 3 + 3a** + **0130 Amdt 5** + **0131 Amdt 4 + 5**; migrations `20261003000000`–`…000300`, **four**; pgTAP `353` `plan(60)` + `354` + **`355` `plan(6)`**; flag **`dsr` FLIPPED ON**)

⛔ **Read this before touching any `dispose_*` door or any `*_child_lock` guard.** The DSR program
closed green on 2026-08-20 with every gate passing **and two of the four LGPD erasure doors did not
complete** on ordinary mature records — `dispose_event_phi` and `dispose_case_phi`.
`dispose_referral_phi` trips no child lock at all, and `dispose_meeting_minutes` had already been
fixed by ADR 0129.

**Why no gate saw it — stated at the right grain, because a wider version of this sentence was wrong
and QA caught it.** ⛔ It is **not** true that every disposal fixture in the tree used a non-locking
parent: `348` and `351` deliberately walk a meeting to `in_signature`, which is exactly why the
**meeting** lane's door worked. The true statement is narrower and is the whole lesson: **no fixture
anywhere reached a locking parent state for the three lanes that were still broken** — the seed's
only `rca` is `in_progress`, its only `capa_plan` `in_execution`, its only `case_interviews`
`awaiting_follow_up`, all three meetings `held`, and `197`'s constructed RCA is `'draft'` with a
`'scheduled'` interview. ⭐ **The lane that had been forced to build a locked fixture was the lane
that worked.** A fixture is written in the state that makes the feature easy to set up, which is
systematically the state *before* the lifecycle locks — i.e. the state the guards do not fire in.

| fact | detail |
| --- | --- |
| migration registry | **435 == 435** (DB == files), re-measured 2026-08-21 at the round's close. ⛔ This row read **433 == 433** for part of the day and was one commit stale — the four migrations are `…000000` child-lock fix · `…000100` scrub retirement · `…000200` **`dsr` go-live flip** · `…000300` guard-comment correction |
| the defect | a child-lock trigger raised **~10 statements after** the door's Class-1 DELETE, rolling the whole RPC back: `event_patient` 1 → **1**, `phi_disposed_at` **NULL**, `description_md` intact. ⭐ It failed **loudly**, which is the one mercy — a half-erasing door is strictly worse |
| ⭐ the magnitude | **TEN statements across FOUR guards**, not the nine across three that `BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW` and ADR 0131 Amdt 3 both filed. The tenth — `dispose_case_phi` → `meeting_cases`, guarded by `app.guard_meeting_child_lock` — needed **no guard change**: that guard has read `app.in_disposal_rpc` since ADR 0129 and the door simply never set it, while carrying an inline comment claiming `app.in_meeting_rpc` covered the child lock |
| the fix | ADR 0129 Decision 1 (**shape 2**) repeated per lane: the stand-aside block copied **verbatim** into `app.guard_{rca,capa,interview}_child_lock`, and `app.in_disposal_rpc` set around **four tight windows** (two per door — the guarded child writes form non-adjacent runs, so no window spans `capa_plan`, `cases`, `documents` or `file_objects`) |
| ⛔ **THE INVARIANT** | **`app.in_disposal_rpc` has exactly 3 SETTERS — `dispose_case_phi`, `dispose_event_phi`, `dispose_meeting_minutes`, all disposal doors — and 5 READERS, all child-lock trigger guards** (`guard_{capa,interview,meeting,rca,reserved}_child_lock`). ADR 0129 Amdt 1: *"the setter count is what bounds the bypass."* A non-disposal door setting this flag voids every guarantee here. Re-derive from `pg_proc.prosrc`, never from this table |
| ⛔ shape 1 stays rejected | teaching a guard to honour its lane's own `app.in_*_rpc` flag would give **every** lane RPC child-write power over locked parents. Pinned out by `353`'s over-grant twins, mutation-proven |
| the census | `docs/reviews/disposal-guard-crossing-census.md` — **51 crossings = 14 CONFIRMED-reachable + 9 STRUCTURALLY-UNREACHABLE + 28 NON-BLOCKING** (48 direct + 3 cascade). Derived as a **property** (each door's write set × every row-level trigger that can `raise` × its `TG_OP` mask), with `--` comments stripped before the regex. ⚠ The previously filed **15** was event+case only |
| legal hold | 4 of the 14 CONFIRMED are `HC0D3` legal-hold aborts on `documents`/`file_objects` — **same fail-closed shape as the bug, opposite intent**: a live hold outranks Art. 18. Executed with a matched control (no hold ⇒ door completes, `patient_identifiers` 0; hold live ⇒ `HC0D3`, `patient_identifiers` 1). Intent is now stated in `dispose_case_phi`'s own body — it was stated only in `dispose_referral_phi`, which is **exactly how the child-lock defect stayed invisible** |
| `notify_scrub_check` retired | `create_dsr_request` no longer mints it. ADR 0130 Amdt 4 withdrew the scrub as premise-falsified and **the withdrawal never reached the code**, so `close_dsr_request`'s `HCDS4` blocked **every** granted close on an attestation to a residue that cannot exist. ⛔ The kind stays in `dsr_tasks_kind_check` and stays completable (historical rows); no backfill; the `HCDS4` gate is untouched and pinned by `354` t12 |
| ⚠ the corrected rationale | the recorded one (*"`notifications.entity_type` does not admit `case`/`referral`/`event`"*) is **incomplete** — it also admits **`meeting`** and **`capa_action`**, both of which the doors touch. The conclusion survives because their writers pass `body = v_meeting_title` / `capa_action.title`, i.e. **titles**, out of scope by ADR 0131 Amdt 1's title invariant. Full writer census (16 callers / 25 call sites of `app.enqueue_notification`) is in the migration header |
| ⭐ coverage note | `353` asserts in **every** lane that the **Class-1 PHI is gone**, not merely that free text redacted — on the failing path nothing is written *including the redaction*, so a redaction-only suite goes green while the patient's identifiers survive. Mutation-proven both directions, six mutations, every restore hash-verified |
| ⭐ **the drift pin — suite `355`** | `355_disposal_bypass_invariant.sql` `plan(6)` makes the NEXT drift of this invariant **red** instead of silently true. **Pin A** `set_eq` on the setter SET **by name** (⛔ not a count — a count reds identically for *"someone smuggled in a setter"* and *"we added a fourth disposal door"*, and the reflex fix for both is to bump the digit; naming forces a human to say which door). **Pin B ⭐** every reader has `prorettype = trigger` — rules out a **door** learning to read the flag and stand itself aside, and needs no edit when a legitimate child lock is added. **Pin C** the vacuity controls, run FIRST, against `app.in_meeting_rpc` (~26 setters) requiring non-empty. Both pins mutation-proven. ⚠ **Two bounds in its header, both real:** a **dynamically composed** GUC name (`set_config('app.in_'\|\|x\|\|'_rpc',…)`) is invisible to it, and **`lint:vacuous` does not scan `supabase/tests/`** (measured 207→209, +0 from this suite) — so its non-vacuity rests entirely on its own t1/t2/t5 |
| `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND` | ✅ **DISCHARGED** — `352` ran inside the full suite on a fresh reset and was re-neutralized in that context (opening the gate reds 2/6). The item did not close on the file existing |

⛔ **Two reachability facts that are PRODUCT boundaries, not fixture gaps** (measured, and one was retracted after a wrong first answer):
1. **Route reachability ⟺ activeRole ∈ {`staff`,`staff_admin`}** — `session.ts` hat-filters grants to `g.role === activeRole` **before** `partitionGrants`, and `session-grants.ts` admits only those two roles into `memberships`. **Dispose gate ⟺ activeRole ∈ {`org_admin`,`hospital_admin`,`nsp_coordinator`,`pqs_member`}** (every arm bottoms out in `app.has_role`'s active-hat conjunct). **Disjoint — in production, not just in seed.** No persona can hold both; the referral detail page's dispose dialog was therefore removed, and the **DSR task inbox is the only working UI path to all four erasure doors**.
   ⚠ `public.session_context()` (SQL) IS hat-blind by design (ADR 0106 D9) — ⛔ **that is truth about the SQL and evidence about nothing downstream.** Reading it and inferring the route's behaviour produced a wrong "fixture gap" verdict.
2. **`app.is_dpo_of_for` requires a commission role in the hospital as a hard conjunct**, and `organizations_select` has no DPO arm — so a pure LGPD *Encarregado* with no commission membership **cannot reach `/o/[org]/titulares` at all**. By design (ADR 0130 D2); filed as `FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER`.
