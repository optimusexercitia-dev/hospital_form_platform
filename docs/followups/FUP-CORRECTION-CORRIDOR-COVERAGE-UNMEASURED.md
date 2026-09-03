# FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED — ✅ **ALL SEVEN LANES MEASURED 2026-08-20.** One lane is fully covered, six have a permanently-frozen state, and the meeting gate bound generalises to only two of six — while the *erasure* fallback turns out to be BROKEN on two lanes (owner: backend + PO; filed 2026-08-20 when the PO asked whether minutes-adjustment mechanisms already existed)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-20 · status open

Filed 2026-08-20 (lead). ADR
[0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) **Amendment 2**
promotes the reopen corridor from "a documented procedure" to **the platform's corrective
control** for PHI that reaches free text despite training. A control that load-bearing needs
its coverage known, and it was known for exactly one lane.

**MEASURED 2026-08-20 (lead)** — live catalog (`pg_proc` bodies, `pg_trigger`, the status
CHECKs) **plus an executed differential**: **59 probes** — 33 state/transition + 21 gate, and a
**5-probe corrective re-run**. Every probe matched its declared expectation, including **7
positive controls ALLOWED** and a **THAW control** (post-reopen child write succeeds) proving
the instrument can distinguish. ⚠ **The corrective run is why the count is 59 and not 54:** two
of the original 33 came back BLOCKED *as expected but for the wrong reason* — `42501` on a
persona scoped to the wrong commission, i.e. a **gate** refusal masquerading as the **state**
refusal being measured. Re-run against correctly-scoped rows (plus a sanity probe proving the
persona clears the gate, refused `HC033` on state) they returned the intended verdict. A
matching expectation is not a valid measurement. Fixtures were driven through the lanes' own guarded transitions — never a
trigger bypass — each with a post-condition assert so a silent no-op could not masquerade as
a built state. Every battery ran inside a rolled-back transaction; the pre-state was
re-verified row by row afterwards (all statuses identical, 0 disposal marks, 0 added rows).
⛔ **The catalog read alone would have been wrong** — see (c).

#### (a) Reachability — locked states vs states the corridor reverses

⭐ Read from the **transition graph** in each lane's `guard_*_status` matrix, not from the
door's own state check: every ⛔ state below has **no outgoing edge at all**, so it is
structurally terminal rather than merely un-reopened.

| lane | free text LOCKED in | reopen door reverses | ⛔ permanently frozen |
| --- | --- | --- | --- |
| meeting | `in_signature`, `signed`, `distributed`, `cancelled` | `in_signature`, `signed` | **`distributed`, `cancelled`** |
| case | `completed`, `cancelled` | `completed` | **`cancelled`** |
| referral | every state ≠ `draft` | `resolved` → `in_review` — **still ≠ `draft`** | ⛔ **every non-draft state** |
| rca | `completed` | `completed` | **none** ✅ |
| capa_plan | `completed`, `cancelled` | `completed` | **`cancelled`** |
| interview | `completed`, `cancelled` | `completed` | **`cancelled`** |
| triage / event | `triaged`, `closed`, `cancelled` | `triaged` | **`closed`, `cancelled`** |

⛔ **The referral lane's corridor does not do the job at all.** `case_referral.subject` /
`description_md` / `decline_note` are writable **only in `draft`** — `app.assert_referral_draft_writable`
gates the one door that writes them (`update_referral_draft`). `reopen_referral` lands on
`in_review`, which is not `draft`; probed directly, the post-reopen UPDATE still raises
`HC070`. What reopening *does* restore is the **reply** (`conclude_referral` requires
`in_review` and UPSERTs `referral_reply.result_md`) — so the **target's** text is correctable
and the **source's** never is, from the moment it leaves draft.

⚠ `reopen_capa_plan` **NULLs `lessons_learned_md`** rather than unlocking it. For that one
column the corridor is an erasure, not a correction — fine for PHI removal, but "reopen →
edit → re-sign" is not what happens.

#### (b) Gate relation — reopen vs the lane's erasure door

| lane | reopen gate | erasure door · gate | relation |
| --- | --- | --- | --- |
| meeting | `is_staff_admin_of` | `dispose_meeting_minutes` · staff_admin **OR** tenancy_admin | **NARROWER** ⊊ |
| case | `is_staff_admin_of` + not-excluded | `dispose_case_phi` · staff_admin + not-excluded | **EQUAL** = |
| referral | `is_staff_admin_of_for(source)` | `dispose_referral_phi` · tenancy(source) **OR** NSP(source hosp) **OR** NSP(target hosp) | ⛔ **DISJOINT** |
| rca | NSP operator **OR** `rca_members`(role ≠ observer) | `dispose_event_phi` · tenancy **OR** NSP | ⛔ **CROSSING** |
| capa | NSP operator of the plan's hospital | `dispose_event_phi` · tenancy **OR** NSP | **NARROWER** ⊊ |
| interview | not-excluded **AND** (staff_admin **OR** interviewer) | `dispose_case_phi` · staff_admin | ⛔ **WIDER** ⊋ |
| triage | `can_read_event` **AND** NSP operator | `dispose_event_phi` · tenancy **OR** NSP | **NARROWER** ⊊ |

⭐ **The FUP's own warning lands harder than it was stated.** Of the six lanes it said must
not be generalised, only **two** repeat the meeting's "narrower": one is **equal**, one
**wider**, one **crossing**, one **disjoint**. Generalising the meeting bound would have been
wrong for **four of six — and wrong in both directions.**

Every relation is pinned by an executed *pair*, never read off the source. DISJOINT, for
instance: org_admin → `reopen_referral` **BLOCKED 42501** and source staff_admin →
`dispose_referral_phi` **BLOCKED 42501**, with each **ALLOWED** on the other door.

⛔ **The filed "only 2 of 7 doors mention `is_staff_admin_of`" undercounts** — it was a symbol
grep. **Four** lanes reach that predicate; two of them through a helper
(`can_manage_referral_source`, `can_write_interview`). The conclusion it supported still
holds, but for a different reason than the evidence given.

⚠ On the triage lane an org_admin is refused at the **read** gate (`can_read_event` → `P0002`),
before the authority arm is reached: the actor who may **erase** the event's PHI cannot **read**
the event.

#### (c) ⛔ The erasure fallback is BROKEN on two lanes — found only by EXECUTION

The premise underneath this item — *where the corridor cannot reach, the erasure door still
can* — is **false**, and it fails in states the corridor **can** reach too. Each measured with
a matched positive control:

- `dispose_event_phi` **raises `HC047`** whenever the lane's RCA is `completed` — the normal end
  state of a finished investigation. `app.guard_rca_child_lock` refuses `rca_factors` /
  `rca_root_causes` / `rca_timeline_entries` / `rca_evidence` / `rca_why_chains`.
- `dispose_event_phi` **raises `HC049`** whenever the CAPA plan is `completed` **or** `cancelled`
  (`app.guard_capa_child_lock` on `capa_effectiveness` / `capa_measure_result` / `capa_action_task`).
- `dispose_case_phi` **raises `23514`** whenever the case has a `completed`/`cancelled` interview
  with subject rows (`app.guard_interview_child_lock` on `case_interview_subjects`).
- **Positive controls**: the same doors **ALLOWED** with rca `in_progress` / interview
  `awaiting_follow_up`; and `dispose_meeting_minutes` on a **`distributed`** meeting,
  `dispose_referral_phi` on a **`completed`** referral, `dispose_case_phi` on a **`cancelled`**
  case — all ALLOWED. The lock is the child guard, not the terminal state as such.

The raise aborts the whole RPC, so **nothing is erased** — `event_patient` is not even deleted.
It fails **loudly**, which is the one mercy here.

⛔ **This is ADR [0129](../decisions/0129-meeting-child-lock-disposal-flag.md)'s defect,
recurring in three siblings its fix never looked at.** 0129 gave `app.in_disposal_rpc` to
`guard_meeting_child_lock` alone; the other three child locks read **no stand-aside GUC at
all**. The enumeration that closed `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` was bounded by
the **instance**, not the property.

Property-bounded sweep (write sets **derived** from the door bodies, crossed with every
row-level trigger that can `raise`): **15 guards with no `app.in_*` stand-aside sit on tables
the erasure doors write; 3 are confirmed blockers by execution.** ⚠ **A candidate count is not
a defect count** — most of the other twelve are *coherence* guards (they refuse an incoherent
write, not a state) and some are DELETE-only triggers on tables the door only UPDATEs. They are
**unproven either way, not cleared.** Filed as `BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`.

#### Residue — what is still open

1. **PO ruling per ⛔ cell in (a)**: corrective path, widened corridor, or an explicit
   *"no correction, erasure only"* acceptance — recorded **where the pilot decision is made**,
   not only here (the requirement C3 and `FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING` both carry).
   ⛔ Do not read `rca`'s ✅ as safe: its corridor is complete and its erasure door is the
   broken one.
2. **A capa_plan with `source in ('manual','meeting','indicator','audit_finding')`** — permitted
   by the `capa_plan_source_shape` CHECK — is matched by **no** erasure door at all
   (`dispose_event_phi` reaches capa only via `source_event_id` / `source_rca_id`). Combined with
   `cancelled` being corridor-unreachable, such a plan's free text has **neither** remedy.
   Sibling item: `FUP-DOOR-ERASURE-FREETEXT-CENSUS`.
3. **Two guard messages point at a door that will refuse the reader** — `guard_capa_status`
   *"(reabra para editar)"* on a `cancelled` plan, and `guard_event_triage` *"(reabra a triagem
   para editar)"* on a `closed`/`cancelled` event. Both corridors are unreachable from those
   states. Copy fix, but it is an instruction to attempt the impossible during an LGPD response.
4. **The twelve unproven sweep candidates** above.
