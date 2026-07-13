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

---

## Amendment 1 (2026-07-12) — Referrals v2: dialogue + governance expansion (pre-pilot)

**Status:** Accepted (product owner, 2026-07-12) · **Build spec:**
[referrals-v2-dialogue-governance.md](../plans/referrals-v2-dialogue-governance.md) ·
**Evaluation:** [referral_data_model_evaluation.md](../design/temp/referral_data_model_evaluation.md)
· **Amends:** this ADR's Decisions **4, 5, 10, 15**.

### Context

Initial pilot-prep testing surfaced the one workflow the shipped Phase-22 model cannot
do: **mid-review, two-way dialogue**. Today B can only *decline with a note* or *conclude
with a single structured reply* (`referral_reply`, 0..1) — there is no channel for B to
**ask A a clarifying question and receive an answer before concluding**, which is the
most common real referral interaction. Separately, a partner team shared a from-scratch
inter-committee referral data model
([handoff](../design/temp/inter_committee_referral_data_model.md)); we evaluated it
feature-by-feature against our as-built module (the evaluation doc above). This amendment
records the disposition and authorizes a **bounded, additive** expansion **before pilot
deployment** (reset-OK — no live referral data yet).

### Decision — the three-bucket disposition

**ADOPT (Essential — closes the tested gap):** a shared **`referral_messages`** thread
(`information_request` / `information_response` / `clarification` / `general`) *layered
under* the existing snapshot + formal-reply spine (the terminal `referral_reply` and
`conclude_referral` are kept); a new **`awaiting_information`** status + a
**`waiting_on_committee_id`** column so "ball in A's court" is legible and feeds the
close-gate.

**ADOPT (Deferred — sequenced after the essential increment, still pre-pilot):**
committee-private **`referral_internal_notes`** (separate table, *never* a `visibility`
flag); **`priority`**; **`response_due_at`** + overdue (reuses the shipped
`due_date`/`isOverdue` pattern); **`requested_action_code`** vocab; **`parent_referral_id`**
(explicit lineage, *no automatic information flow*); **reopen + answered/resolved split**
(`referral_resolutions`); **`referral_assignments`** (responsibility ≠ access); multiple
typed **`referral_case_links`**; snapshot **`referral_context_versions`**;
**`referral_read_receipts`**; per-message **redaction workflow**; **idempotency keys**.

**AVOID (considered and rejected — we already have an equal-or-better mechanism):**
- **`row_version` optimistic concurrency** — redundant with our `SECURITY DEFINER` +
  `FOR UPDATE` + RLS model (zero `row_version` in-tree). We keep the partner design's
  transactional `sequence_number` lock for messages; we do **not** add compare-and-set.
- **`referral_status_events` history table** — redundant with the tamper-evident
  hash-chained `audit_log` (Rule 11); a second denormalized log = two sources of truth.
  A timeline UI, if needed, reads a **view over `audit_log`**.
- **`structured_context` jsonb carrying clinical/patient data** — violates Rule 12
  containment (PHI outside the isolated `referral_patient` door). Any such field must be
  PHI-free.
- **`referral_participants` per-user ACL table** — forks our authorization model; the
  `can_read_referral` / `can_read_referral_phi` / `referral_target_analyst` predicate
  trio already enforces least-privilege PHI access. Revisit only for a concrete
  non-member guest-access requirement.
- **A referral-local transactional outbox** — notification delivery is a platform-wide
  concern (there is *no* outbox anywhere today, only `audit_log`); it belongs to a
  dedicated notifications workstream (Phase 20), not this module.

### What v2 does NOT change (non-regression guarantees)

The Phase-22 **security core is preserved and extended, never contradicted**: the frozen
**snapshot remains the disclosure boundary** (B never reads A's live case); the **PHI
single-door** discipline holds — every **new free-text body** (`referral_messages.body`,
`referral_internal_notes.body`) is PHI-bearing by classification and inherits the exact
`frozen_body_md`/`result_md` treatment (**REVOKE** direct `SELECT` from `authenticated`,
served only to a `can_read_referral_phi` reader via the audited detail door, nulled for
metadata-only readers); the **hub/inbox/QPS-dashboard projections stay PHI-free** —
counts and metadata only, **never** a message-body or "last message" preview (Decision
16); the **QPS macro-oversight plane** (`is_pqs_member`) extends its read scope to every
new table; and the **`dispose_referral_phi`** door generalizes to purge the new bodies.

### Decisions amended

- **D4 (lifecycle).** Gains `awaiting_information` (with `waiting_on_committee_id`), and —
  in the deferred resolution phase — an **answered → resolved** split so the *source*
  committee formally confirms closure (partner §2.5) rather than B unilaterally
  concluding. The current anglicized keys are **extended, not renamed**.
- **D5 (close-gate).** HC076 now counts `awaiting_information` (and, post-split,
  `answered`) as *in-flight* for a `response_expected` referral; only `resolved` (source
  accepted) / `rejected` / `withdrawn` release the gate.
- **D10 (reply shape).** The single structured reply is no longer the *only* B→A channel;
  a message thread precedes and complements it. The formal reply stays the terminal
  structured act.
- **D15 (chaining).** May become **explicit** via `parent_referral_id` (a lineage
  denormalization for QPS) while the "downstream referral shares nothing automatically"
  rule stands.

A dedicated SQLSTATE block (above the current `HC0xx` high-water) and the new audit verbs
(`referral.message_created` / `referral.message_viewed` / `referral.note_created` /
`referral.note_viewed` / `referral.message_redacted`) are allocated in the build spec;
reopen/resolve ride the existing `referral.status_changed`. Delivered as the **Referrals
v2 — Dialogue & Governance** program (R0 gate → R1 essential → R2–R5 deferred), one Phase
Gate each, all pre-pilot and reset-OK.
