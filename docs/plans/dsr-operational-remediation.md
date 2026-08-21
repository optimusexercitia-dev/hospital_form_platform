# DSR operational remediation — making the workflow actually work

**Opened:** 2026-08-20 · **Branch:** `feat/dsr-operational-remediation` · **Lead-authored.**
**Governing decisions:** ADR [0130](../decisions/0130-dsr-subject-request-workflow.md) (the
workflow), ADR [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md)
(erasure reach bounded to designated PHI fields), ADR
[0129](../decisions/0129-meeting-child-lock-disposal-flag.md) (the fix shape), ADR
[0056](../decisions/0056-phi-disposal-closure-narrowed-claim.md) (the doors), CLAUDE.md Rule 12.

> ⛔ **This is not a rebuild.** The DSR program closed 2026-08-20 with all four slices built,
> QA-approved and merged. Every route is mounted, every journey step is wired to a server
> action, every user-facing string is pt-BR. What this round fixes is that **the doors the
> workflow exists to call do not complete**, that the module's own persona **cannot navigate
> to it**, and that one mandatory human gate **guards a residue class the program proved
> absent**.

---

## 0. Why the round exists — the two live defects, measured

### 0.1 The erasure doors abort, and the filed record undercounts them

`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW` is filed as **9 statements across 3 guards**.
Re-derived from the live catalog and confirmed by execution: it is **10 statements across 4
guards**. The tenth appears in no filed record.

| # | Door | Statement | Guard | Raises when |
|---|---|---|---|---|
| 1–5 | `dispose_event_phi` | `rca_factors.text` · `rca_root_causes.text` · `rca_timeline_entries.description` · `rca_evidence.{title,citation_label}` · `rca_why_chains.root_text` | `app.guard_rca_child_lock` | `rca.status='completed'` → `HC047` |
| 6–8 | `dispose_event_phi` | `capa_effectiveness.method_md` · `capa_measure_result.note` · `capa_action_task.description` | `app.guard_capa_child_lock` | `capa_plan.status in ('completed','cancelled')` → `HC049` |
| 9 | `dispose_case_phi` | `case_interview_subjects.note` | `app.guard_interview_child_lock` | `case_interviews.status in ('completed','cancelled')` → `23514` |
| **10** | **`dispose_case_phi`** | **`meeting_cases.{summary,decision}`** | **`app.guard_meeting_child_lock`** | **`meetings.status in ('in_signature','signed','distributed','cancelled')` → `23514`** |

⭐ **#10 is the cheapest of the ten and the one nobody looked at.** `app.guard_meeting_child_lock`
**already reads** `app.in_disposal_rpc` — ADR 0129 gave it that stand-aside. `dispose_case_phi`
simply never sets the flag. It sets `app.in_meeting_rpc` with the inline comment
`-- for meeting_cases child-lock`, which is **false against the live guard**.

**Executed proof** (single psql session, rolled back, pre-state re-verified byte-for-byte):

| probe | setup | GUCs | result |
|---|---|---|---|
| A | meeting walked `held→in_signature→signed` | `dispose_case_phi`'s exact set (`in_case_rpc`, `in_narrative_rpc`, `in_interview_rpc`, `in_submit_rpc`, `in_meeting_rpc`) | ⛔ `ERROR: o conteúdo desta reunião está bloqueado (signed)` — `guard_meeting_child_lock` line 29 |
| B | identical | A **plus** `app.in_disposal_rpc='on'` | ✅ `UPDATE 1` |

Severity is set by what the abort destroys, not by what it blocks: the guard fires ~10
statements after the door's **Class-1 DELETE**, so the whole RPC rolls back and the patient's
identifiers survive with `phi_disposed_at` NULL. ⛔ *"We only erase designated PHI anyway"* is
therefore not a reason to defer — the designated PHI is exactly what stays behind.

⚠ **This is the recurrence of a known class**: ADR 0129 swept the sibling axis *"which DOOR is
gate-blind?"* and never the other one, *"which GUARD lacks the stand-aside?"*. The re-derivation
above swept the second axis and found a fourth guard the first sweep's successor also missed.
A half-swept class is buried under evidence, unlike an unswept one.

### 0.2 A mandatory human gate stands in front of a residue class the program proved absent

`create_dsr_request` unconditionally mints one `notify_scrub_check` task per request.
`close_dsr_request` raises `HCDS4` while any task is `pending` on a `granted`/`granted_partial`
outcome. ADR 0130 **Amendment 4** WITHDREW that scrub as premise-falsified — **the withdrawal
reached the ADR and never reached the code.** Today every granted LGPD request is blocked until a
human writes an attestation about notification residue that cannot exist, and that attestation
enters the legal record as a statement of work performed.

⚠ **The recorded rationale for the withdrawal is incomplete and must not be repeated.** It says
`notifications.entity_type`'s CHECK does not admit `case`/`referral`/`event`. True — but it does
admit **`meeting`** and **`capa_action`**, both of which the disposal doors touch. The conclusion
survives for a different reason: the writers pass `body = v_meeting_title` and
`body = capa_action.title` respectively, and **titles** are placed out of erasure scope by ADR
0131 D2 + the title invariant. Same verdict, sound reason. *Verify against the catalog, never a
sentence about it.*

---

## 1. PO decisions taken 2026-08-20 (binding; do not re-open)

| # | Question | Ruling |
|---|---|---|
| **P1** | ADR 0131 Amdt 3 left the P0's resolution open: fix the guards, or roll the out-of-scope reach back under D4(b)? | ⭐ **FIX THE GUARDS.** ADR 0129 Decision 1 (shape 2) repeated per lane, exactly as ADR 0129 Amendment 2 prescribes. Rollback under D4(b) was **considered and declined**. Shipped free-text reach is preserved. |
| **P2** | ADR 0130 D1 promises the data subject a written answer with its legal basis (Art. 18 §4), but `dsr-outcome-record.tsx` renders on screen only — no export, print or download path exists anywhere in the module. Build one now? | **OUT OF SCOPE this round.** Filed as `FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY`. ⛔ Not closed, not descoped — deferred with the gap named. |
| **P3** | `ReferralDisposeDialog` has never rendered in a browser because no hat can both reach the route and pass `canDisposeReferralPhi`. Make it reachable, remove it, or accept the gap? | **MAKE IT REACHABLE** — a seed persona holding route access and the disposal gate at once. ⚠ Backend must also state whether a **production** hat could hold that combination; that answer decides whether this was a test gap or a product gap. |
| **P4** | `DSR_RESIDUE_NOTICE` line 1 is conditionally true under ADR 0131. Reword? | **KEEP AS-IS on the training premise.** ⛔ The premise must then be recorded **where the pilot decision is made**, not only in the ADR — the same requirement Critical FUP C3 carries. |

⛔ **P1 is not a rollback and must never be recorded as one.** ADR 0131 D4(b) makes the free-text
reach *eligible* for rollback; the PO declined to exercise it. D4's default — *maintained, not
rolled back* — stands, and the residue census gains nothing.

---

## 2. Workstreams

### A — the doors actually erase (backend) 🔴 P0
- **A1** One migration: extend the `app.in_disposal_rpc` stand-aside into `app.guard_rca_child_lock`,
  `app.guard_capa_child_lock`, `app.guard_interview_child_lock` (block copied verbatim from
  `app.guard_meeting_child_lock`); set the flag around the guarded child writes in
  `dispose_event_phi` and `dispose_case_phi`; **correct the false `meeting_cases` comment in the
  same migration** (ADR 0129 Decision 2's own rule).
- **A2** New pgTAP suite over four lanes (rca · capa · interview · **meeting_cases**), each carrying
  ADR 0129's three obligations: (a) locked parent with children ⇒ door completes; (b) the
  **no-flag differential**; (c) the **sibling-RPC over-grant twin** that pins shape 1's widening
  out. ⭐ Every lane asserts the **Class-1 rows are gone**, not merely that free text was
  redacted — a suite asserting only redaction goes GREEN while the rollback bug is live.
- **A3** Re-derive the remaining guard population **as a property over the catalog** (each door's
  write set × every row-level trigger that can `raise` × the trigger's `TG_OP` mask), with a
  recorded verdict per row: CONFIRMED-reachable / STRUCTURALLY-UNREACHABLE / NON-BLOCKING.
  ⛔ A candidate count is not a defect count — and an unproven row is not a clean row.
- **A4** Settle the `HC0D3` legal-hold abort on `dispose_case_phi`'s `documents`/`file_objects`
  writes: `dispose_referral_phi` documents it BY DESIGN, the case door does not.

### B — retire the dead `notify_scrub_check` gate (backend)
Stop minting it; keep the kind in the CHECK so historical rows stay valid; keep its render copy
correct; pgTAP that a new request mints zero of them (with a control proving the assertion can
fail) and that a granted request now closes without `HCDS4`. Record the corrected rationale
(§0.2), derived from an enumeration of `app.enqueue_notification`'s callers.

### C — close `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND` (backend)
`supabase/tests/352_dispose_event_door_gate.sql` (plan 6) is committed and has **never run inside
the full suite on a fresh reset**. The run is what closes the item; the item does not close on
the file existing.

### D — reachability (frontend + backend)
- **D1** The only `Direitos do Titular` link in the app is in the **commission-scoped** sidebar.
  A DPO whose only standing is the hospital-level *Encarregado* grant — the production shape —
  has no route into the module at all; so does a tenancy-admin executor. The seed's DPO happens
  to also be a CCIH member, which is why this never surfaced.
- **D2** The referral dispose dialog gets a persona that can actually reach it (P3).

### E — the promoted training control (frontend)
`"Não inclua dados do paciente."` via the shared `FieldDescription`/`aria-describedby` path, on
the DSR free-text fields and on the WS B/C title inputs. ADR 0131 Amdt 1 calls this *"the only
software support for the training control this decision now depends on"*. ⛔ Soft guidance only;
⛔ asserted on **rendered output**, never by grep; ⛔ must not flip `useFieldIds`' no-DOM-`name`
default (the MRN-in-URL scar).

### F — records (lead)
ADR 0129 Amdt 3 · ADR 0131 Amdt 4 (the corrected magnitude + P1) · ADR 0130 Amdt 5 (the
`notify_scrub_check` retirement) · the column-door operator procedure owed by
`FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES` · the ADR 0131 risk acceptance recorded where the pilot
decision is made (P4) · PROGRESS.md + `docs/backend-state.md`.

### G — tests and the gate (tester → qa → lead)
E2E over a locked-parent fixture so the P0 cannot return · the referral dialog driven in a real
browser · the live absent-row PHI-erasure assertions repaired
(`FUP-E2E-ABSENT-ROW-ASSERTIONS`: `case-patient.spec.ts:1193`,
`pdf-printing-meetings.spec.ts:335`, `meeting-audio-minutes.spec.ts:483/492/571` — the corrected
shape is at `dsr-subject-requests.spec.ts:258-264`) · then §6 steps 1–5.

---

## 3. Constraints any change must respect (binding, carried forward)

1. ⛔ **One setter class bounds the bypass.** `app.in_disposal_rpc` is set **only by disposal
   doors**. This round takes the setter count 1 → 3; all three are disposal doors, so ADR 0129
   Amendment 1's invariant — *"the setter count is what bounds the bypass"* — is preserved and
   must be restated, not silently relied on. Honouring a lane's own `app.in_*_rpc` flag
   (shape 1) **stays rejected**.
2. ⛔ **No disposal-gate widening.** The child-lock stand-aside is an **erasure** door's reach,
   never an access gate.
3. ⛔ **`complete_dsr_task` must not become a second door** — execution stays in the module action
   under the caller's session.
4. ⛔ **No surface may name a task-retirement cause from `status` alone** (ADR 0130 Amdt 3, QA r2).
5. ⛔ **Fixture discipline.** A disposal pin must run on a **locked** parent with every child
   table populated, paired with a sibling-row survival control — a `scheduled`/`held`/`draft`
   fixture fires no child lock and passes while the door is broken for every real disposal.
   **The seed cannot reproduce any of the ten states; every fixture must be constructed.**
6. ⛔ **`CREATE OR REPLACE` does not reset an ACL, but a plain `CREATE` leaves `proacl` NULL,
   which defaults to PUBLIC.** Census `pg_proc.proacl` before and after.
7. ⛔ **`seed.sql` is a contract with ~900 E2E tests** — add personas, never re-purpose or
   re-position, never delete by position.
8. ⛔ **New DSR doors are invisible to all four authz arms** (every one is a `prosecdef` scalar
   non-bool command door, Critical FUP C2). Coverage is a targeted neutralization battery with a
   verified-green baseline per probe — ⛔ *never* an ARM verdict.
9. ⛔ **The diff-scoped sweep's syntax filter returns an EMPTY case list for trigger functions and
   in-door `if not (...)` gates** — sweep by the property and say so, rather than reporting an
   empty list as coverage.

## 3b. ⛔ The deployment fact that makes every other item moot until it is decided

**The `dsr` flag ships OFF and nothing but `seed.sql` turns it on.** Measured 2026-08-20:
`supabase/migrations/20261001000000_dsr_dpo_capability.sql:31-33` inserts
`('dsr', false, …)`, and the only writer that flips it is `supabase/seed.sql:3027`
(`update app.feature_flags set enabled = true where key = 'dsr'`), which runs on local and E2E
resets **only**.

⇒ **On the deployed project the entire DSR module is unreachable today** — every `dsr_*` door
raises `HCDS1`, `list_my_dsr_hospitals()` returns `'[]'`, and `/o/[org]/titulares` 404s for
everyone. This is not a defect; it is the platform's standing convention (*"Ships OFF until the
DSR gate"*, flipped by its own migration at the gate, as `20260828000900` did for FF-1).

**The gate has since passed, so the flip is owed — but it is a PO call and an outward-facing
production change, and it must not happen while the doors are broken.** Order matters:
workstream A lands and is proven, *then* the flip. ⛔ Do **not** add a flip migration to this
branch until the PO rules, because merging one makes the next `db push` flip it as a side
effect.

⚠ Two questions ride with it, neither answered here: platform-wide or per-tenant, and whether the
pilot's Critical FUP **C1b** (the Cloud disposal rehearsal, which gates admitting real PHI) must
close first. C1b is about *bytes* and DSR is *columns*, so they are disjoint mechanisms — but a
live DSR console on a tenant with no rehearsed disposal path is a decision, not an oversight.

## 4. Explicitly NOT in this round

- ⛔ Outcome-record delivery to the data subject (P2) — the workflow's one promise with no
  mechanism. Filed, not built.
- ⛔ Class-2 professional-identity erasure for the `ethics_*` lane's second data subject — ADR
  0131 is written about PHI and flags this as the PO's to confirm.
- ⛔ The 133-column free-text census — ruled out of pilot scope by ADR 0131 and **accepted, not
  absent**. The census document stays as the record of what is knowingly retained.
- ⛔ Rewording `DSR_RESIDUE_NOTICE` (P4).
