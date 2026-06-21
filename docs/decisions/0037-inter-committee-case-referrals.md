# ADR 0037 — Inter-Committee Case Referrals & the referral PHI posture

**Status:** Accepted · **Date:** 2026-06-21 · **Phase:** 22 (`case_referrals`) ·
**Supersedes:** ADR [0022](./0022-cross-committee-referrals.md) (header-only / no-PHI
linked-case model) · **Amends:** ADR [0030](./0030-patient-safety-phi-and-pqs-architecture.md),
ADR [0036](./0036-phi-access-hardening.md), ARCHITECTURE.md Rule 12 ·
**Relates to:** ADR [0035](./0035-lgpd-anvisa-regulatory-posture.md) (column encryption
declined), ADR [0031](./0031-event-custody-ledger-and-phi-isolation.md) (PHI isolation
pattern), ADR [0033](./0033-case-access-control.md) (`can_read_case`).

## Context

A committee needs to send a `Case` to **another** committee for analysis — e.g.
Morbidity & Mortality → Peer Review — as a **Notification** (no reply) or an
**Analysis/Review Request** (reply expected). Today `cases.commission_id` is
`NOT NULL` and committees cannot see each other's cases at all, so there is no
channel for this.

ADR 0022 proposed a minimal **header-only, no-PHI** linked-case model. The product
need is richer: A sends a **curated, frozen view** of its case (not just a header,
not the live case); each committee keeps its *internal* work private from the other
(A never sees how B analyzed it beyond the reply B returns); **Quality & Patient
Safety (QPS = the NSP/PQS roster)** gets a full end-to-end macro view across all
committees; and a case stays **unconcludable** while an expected reply is
outstanding. This requires structured PHI to travel with the referral — which ADR
0022 explicitly excluded. This ADR replaces 0022 and records the model as built.

## Decision — the 16 locked design decisions

1. **B's-side model.** The referral is a first-class record on A's case. B reads a
   curated subset, posts a **structured reply**, and MAY optionally **link a case B
   creates** in its own commission. A sees only the reply; QPS sees both ends.
2. **What B sees = a curated SUBSET** of A's case, not the whole live case.
3. **Curation = point-in-time SNAPSHOT.** At send, A picks narratives/documents; the
   referral **freezes copies** into referral-owned rows. B reads only referral-owned
   rows, never A's live case. Documents freeze the **reference** (Rule 6), not the
   object.
4. **Full status lifecycle.** `rascunho → enviada → recebida → aceita/recusada →
   em_analise → concluida`, plus `retirada`. A drives draft→send & withdraw; B drives
   received→accepted/declined→in-review→concluded (concluded delivers the reply).
5. **Conclusion gate (HARD).** `close_case` refuses while any referral with
   `response_expected = true` is in flight (`enviada/recebida/aceita/em_analise`).
   `concluida/recusada/retirada` count as resolved; `response_expected = false` never
   blocks; `rascunho` (unsent) never blocks.
6. **QPS = the NSP/PQS roster** (`app.is_pqs_member`). Scope: read on every referral +
   snapshot + reply, AND the **full live source (A) and linked (B) case** for any
   referral-touched case — but NOT a blanket reader of un-referred cases.
7. **Authority = coordinators both ends.** `staff_admin` of the source commission
   sends/withdraws (same authority as `close_case`); `staff_admin` of the target
   commission receives/accepts/declines/replies. Members participate via normal case
   assignment.
8. **Referral types = configurable vocabulary** (`referral_types`, seeded,
   admin-managed, hospital-wide): label, optional color token,
   `default_response_expected`.
9. **Snapshot content** = selected narratives (frozen `body_md` copies) + selected
   documents (frozen storage refs) + the referral's own subject + free-text description.
10. **Reply shape** = required `result_md` + optional attachments + a **structured
    outcome** from a second seeded vocabulary (`reply_outcomes`); frozen on conclusion.
    No-reply-expected referrals may conclude with an acknowledgment only.
11. **B's discovery** = a per-commission "Encaminhamentos" hub (incoming + outgoing) +
    a nav count badge.
12. **A's case detail** = an outbound-referrals card with status + reply.
13. **QPS surface** = a standalone QPS dashboard in `/admin/nsp/encaminhamentos`
    (filters, metrics, drill-down to the full trajectory).
14. **Phase / flag** = new **Phase 22**, behind feature flag `case_referrals` (ships
    OFF; flipped ON in-phase by the E2E gate).
15. **Chaining = implicit.** B refers onward by sending a NEW referral from its linked
    case; QPS stitches chains by case lineage. No special primitive.
16. **PHI posture (reverses Rule 12 for THIS module).** Referrals MAY carry PHI under
    **NSP-grade safeguards**: an isolated structured `referral_patient` block (modeled
    exactly on `event_patient`) + PHI-bearing free text, all behind the tightest RLS
    with **audited single-door reads**, **no column encryption** (declined, ADR 0035).
    The subject/status/commission names stay **PHI-free** so list/inbox/dashboard
    views never leak; patient context surfaces only on drill-down to authorized
    readers, audited.

## Supersession & amendments

- **Supersedes ADR 0022.** The header-only / no-PHI linked-case model is replaced by
  the frozen-snapshot channel + structured PHI + the full lifecycle + QPS macro
  visibility. The one piece of 0022 that survives is its *spine* observation: B's
  linked case is a normal, independently-owned case in B's commission — no shared
  ownership, no change to `cases.commission_id NOT NULL` or per-commission numbering.
- **Amends ADR 0030 / 0036 + Architecture Rule 12.** Referrals are a **SECOND
  PHI-bearing module outside the NSP**, governed by the same isolated-table +
  audited-single-door safeguards Rule 12 established for patient-safety. Rule 12's
  "PHI confined to the patient-safety module" now reads "PHI confined to the
  patient-safety module **and the referral module**, both under identical
  safeguards." ADR 0036's free-text PHI classification + single-door identifier-read
  discipline extend to the referral free-text columns (`description_md`,
  `decline_note`, `frozen_body_md`, `result_md`) and the `referral_patient` door.
- **Cross-links ADR 0035.** Column-level encryption is **declined** here as it is for
  `event_patient` — at-rest encryption is the platform/infrastructure control; the
  application control is isolation + tight RLS + audited single-door reads.

## The concrete surface as built (for QA to audit against)

**Seven tables** (`public.*`, RLS enabled): `referral_types`, `reply_outcomes`,
`case_referral` (lifecycle, PHI-free subject/status/code), `referral_shared_item`
(frozen snapshot rows; `frozen_body_md` PHI-bearing), `referral_patient` (⚠ isolated
PHI, modeled on `event_patient`), `referral_reply` (⚠ `result_md`),
`referral_reply_attachment`. `code` is a global `ENC-NNNN` sequence (PHI-free).

**Access predicates** (`app`, `SECURITY DEFINER STABLE`):
- `can_read_referral(referral, uid)` — BROAD metadata + snapshot-metadata boundary:
  `is_pqs_member OR is_member_of_for(source) OR is_member_of_for(target)`.
- `can_read_referral_phi(referral, uid)` — TIGHT PHI predicate (mirrors
  `can_read_event_patient`): `is_pqs_member OR is_staff_admin_of_for(source) OR
  is_staff_admin_of_for(target) OR referral_target_analyst`. **No `is_admin` term** —
  a platform admin who is not QPS/coordinator reads no PHI (duty separation).
- `referral_target_analyst(referral, uid)` — how B's analyst earns PHI access: `uid`
  is `assigned_to` on a phase/narrative of the referral's `target_case_id`, or a
  `case_access` grantee on it. Before B links a case, PHI is coordinators + QPS only.
- `can_manage_referral_source/_target` — coordinator authority each end.

**PHI lockdown (the security core).** `referral_patient` has **all DML REVOKED from
`authenticated`** (no policy; exact `event_patient` posture); reads go through the
audited DEFINER door **`get_referral_patient`** (re-gates `can_read_referral_phi`,
returns NULL out of scope with **no** audit row, emits `referral_patient.read` only on
a real entitled read, attributed to the source commission, empty metadata). The
PHI-bearing **free-text bodies** are tightened the same way: the SELECT policies on
`referral_shared_item` and `referral_reply` are `can_read_referral_phi` (not the broad
predicate); `frozen_body_md` and `result_md` are served by **`get_referral_detail`**
(DEFINER) **only** to a `can_read_referral_phi` reader and nulled for a metadata-only
reader; `case_referral.description_md` and `decline_note` are **column-level REVOKEd**
from `authenticated` (a column grant omits them) and likewise served only by the door
to PHI readers. PHI-free metadata (subject, status, kind, `frozen_title`,
`outcome_label`, counts, attachment metadata) still flows to every `can_read_referral`
reader, so the hub/detail render for the whole committee — patient context never does.
This closes the case-access undercut (a snapshot copies source-case narratives that
`case_access` gates by `can_read_case`; the broad predicate would have let a walled-out
member read them through the snapshot).

**`can_read_case` QPS term** (ADR 0033 function, extended): a flag-gated QPS
early-return is inserted **before** the `case_access` fallback so QPS macro-read does
not depend on the `case_access` flag — QPS reads any referral-touched **source (A) OR
linked (B)** case. There is **no `target_commission` membership term**, so B never
gains live read of A's case; B's only window into A is the frozen
`referral_shared_item` snapshot. Flag-OFF behavior is byte-identical to before.

**`close_case` HC076 gate** — before the status flip, dark unless the flag is on:
raises **HC076** while any `response_expected = true` referral on the case is in flight.

**Snapshot-doc download (RLS-consistent, no service-role).** A frozen snapshot
*document* references A's existing `case-documents` object; B is not a member of A's
commission. Rather than sign with a service-role client (the codebase's first
RLS-bypassing download — **rejected**), a flag-gated OR-term on the `case-documents`
`SELECT` storage policy grants the read when the object is a frozen snapshot the caller
may read at PHI level (`app.can_read_snapshot_document`, a DEFINER helper to avoid
storage→referral RLS recursion). The DEFINER `get_referral_snapshot_document_path`
re-gates + audits and returns the path; the **normal cookie client** signs it. RLS
stays the security boundary (Rule 1). Reply attachments live in a new immutable
`referral-attachments` bucket whose SELECT/INSERT key on the referral predicates.

**SQLSTATE block `HC070–HC07A`** (HC054/HC055 taken by cases; HC056+ reserved by the
accreditation track): HC070 wrong-status, HC071 not-source-coordinator, HC072
not-target-coordinator, HC073 snapshot frozen, HC074 reply shape invalid, HC075
conclude-with-reply missing result/outcome, HC076 close blocked by pending reply,
HC077 shared-item shape invalid, HC078 `set_referral_patient` not entitled (not
`can_read_referral_phi` — i.e. not a source/target coordinator, the assigned
`referral_target_analyst`, or QPS) or referral concluded,
HC079 target-case link invalid, HC07A vocab CRUD violation.

**Audit verbs** (PHI-free metadata throughout, Rule 11): mutation triggers emit
`referral.created` / `referral.status_changed` / `referral.updated` and
`referral_patient.updated` (empty metadata, no identifier — mirrors
`trg_audit_event_patient`); the audited read doors emit `referral_patient.read` (every
entitled PHI-identifier read) and `referral.viewed` (a PHI free-text *body* serve by a
non-originator — the target coordinator/analyst AND QPS, for parity with
`get_referral_patient`; the source coordinator is exempt as the content's author). All
six are on the `log_audit_access` positive allow-list.

## Consequences

- **Four forward-only migrations** `20260620013000`–`016000` (tables/predicates/guards/
  storage/grants/flag; RPCs + the `close_case`/`can_read_case`/`log_audit_access`
  overrides via `CREATE OR REPLACE`; the PHI-body tightening; the column lockdown).
  No prior migration is edited.
- **PHI surface doubled but contained.** The referral module is the second place PHI
  lives. The containment is identical to the NSP's: one isolated structured table
  (REVOKEd, DEFINER-only), audited single-door reads, PHI-free list/dashboard
  projections, no column encryption (ADR 0035). A reviewer can audit the referral PHI
  posture by the same checklist as `event_patient`.
- **B's internal work stays private from A by construction** — A reads only the frozen
  snapshot it sent + the structured reply B chose to return; B's linked-case analysis
  is never reachable from A's side (the QPS term has no `target` membership leg for B→A,
  and A is not a member of B).
- **Pilot-ready behind the flag.** Ships OFF; the whole feature is dark until the
  in-phase flip, exactly like `audit_trail` / `patient_safety` / `case_access`.
