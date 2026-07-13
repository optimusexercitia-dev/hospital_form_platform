# Evaluation — External Inter-Committee Referral Data Model vs. Shipped Phase 22

**Author:** Lead · **Date:** 2026-07-12 · **Reviewed doc:**
[`inter_committee_referral_data_model.md`](./inter_committee_referral_data_model.md)
(external team handoff) · **Against:** Phase 22 as built (ADR
[0037](../decisions/0037-inter-committee-case-referrals.md), shipped 2026-06-21,
behind flag `case_referrals`).

> Purpose: decide, feature-by-feature, what to **adopt now (essential)**, **defer**,
> and **avoid** — grounded in what our platform already has, not in a greenfield vacuum.
> The external doc is *their* from-scratch design; we already shipped a referral module
> with a deliberate, security-forward shape. This is an **adoption** evaluation.

---

## 1. The core difference in one paragraph

Our model is a **frozen-snapshot → single structured reply** channel with a
**QPS macro-oversight plane** on top (a Quality & Patient-Safety roster that reads both
ends for accreditation). The external model is a **multi-message peer conversation**
(`information_request` / `information_response` loops, threading, read receipts) with
**reopenable resolution cycles**, **explicit downstream referrals**, **priority**,
**SLA deadlines**, and a **transactional outbox** — but **no oversight plane** and a
**weaker audit story** than ours. So the honest read is: *they designed for richer
two-way dialogue; we designed for stronger disclosure control + governance visibility.*
The right move is to **borrow their dialogue capability without giving up our PHI
single-door discipline, our tamper-evident audit, or the QPS plane.**

**What testing most likely surfaced** (the "need to increase functionality"): our
lifecycle has **no mid-review back-and-forth**. B can only *decline with a note* or
*conclude with one structured reply* — there is no way for B to **ask A a clarifying
question and get an answer before concluding**, which is the external doc's stated
primary use case ("requests additional information when needed, sends one or more
replies"). That gap is the spine of the "essential" list below. *(If initial testing
actually surfaced different pain points, re-weight accordingly — see §7.)*

---

## 2. Feature-by-feature comparison

| External component | Our current equivalent | Verdict |
|---|---|---|
| `case_referrals` root | `case_referral` (23 cols, PHI-free subject/status/`code`=`ENC-NNNN`) | **Have it** |
| Frozen snapshot | `referral_shared_item` (narratives + doc refs, Rule 6) | **Have it** |
| Isolated PHI | `referral_patient` (single-door `get_referral_patient`, REVOKEd, audited) | **Have it — stronger** |
| Structured outcome vocab | `reply_outcomes` + `referral_reply` | **Have it** |
| Configurable type vocab | `referral_types` (seeded, admin-managed) | **Have it** |
| Source-side resolution gate | `close_case` HC076 hard block | **Have it** |
| `referral_messages` (multi-message thread) | — single `referral_reply` (0..1) | **ESSENTIAL** |
| `awaiting_information` + `waiting_on_committee_id` | — implicit in status only | **ESSENTIAL** |
| `referral_internal_notes` (committee-private) | — (privacy via each side's own case) | **Defer (adopt shape)** |
| `priority` (routine…critical) | — (only `event_triage.harm_severity`) | **Defer** |
| `response_due_at` / SLA / overdue | — (but `case_action_items.due_date` + `isOverdue()` pattern exists) | **Defer** |
| `requested_action_code` | — (implicit: `response_expected` + type) | **Defer** |
| `parent_referral_id` (downstream chain) | — implicit chaining via case lineage (ADR 0037 D15) | **Defer** |
| `referral_resolutions` (reopen + cycles) + answered/resolved split | — single terminal `completed` | **Defer** |
| `referral_assignments` (operational responsibility) | — normal case assignment | **Defer** |
| `referral_case_links` (multiple, typed) | — single `target_case_id` | **Defer** |
| `referral_context_versions` (versioned snapshot) | — flat snapshot | **Defer** |
| `referral_read_receipts` | — none | **Defer** (they defer it too) |
| Per-message redaction workflow | — append-only + `dispose_referral_phi` door | **Defer** |
| Idempotency keys | — | **Defer** |
| `row_version` optimistic concurrency | — DEFINER RPCs + `FOR UPDATE` + RLS | **AVOID** |
| `referral_status_events` (history table) | — hash-chained `audit_log` (Rule 11) | **AVOID** |
| `structured_context` jsonb (clinical/patient) | — typed `referral_patient` behind the door | **AVOID** |
| `referral_participants` (per-user ACL) | — `can_read_referral(_phi)` + `referral_target_analyst` predicates | **AVOID** |
| Transactional outbox (referral-local) | — no outbox anywhere; audit only | **AVOID** (do platform-wide instead) |

---

## 3. ESSENTIAL — adopt now (closes the tested back-and-forth gap)

### E1. A shared message thread (`referral_messages`)
The one structural change that unlocks the primary use case. Generalize our single
`referral_reply` into an **ordered message stream** *layered under* the existing
snapshot + formal-reply spine — **keep** `referral_reply`/`conclude_referral` as the
terminal structured act; add messages for the dialogue that precedes it.

- **Minimal shape:** `id, referral_id, sequence_number, sender_committee_id,
  sender_user_id, message_type, body, created_at`. `message_type ∈ {general,
  information_request, information_response, clarification}`.
- **Adopt from their §5.5:** first-class rows (not JSONB), transactional
  `sequence_number` via `SELECT … FOR UPDATE` — this matches our house locking pattern.
- **Skip for now:** threading (`in_reply_to`), `supersedes`, redaction, read receipts
  (all → Defer). Keep the first cut lean.
- **Non-negotiable PHI gate:** `body` is PHI-bearing free text → it must live behind
  `can_read_referral_phi` exactly like `frozen_body_md` / `result_md`: REVOKE direct
  `SELECT` from `authenticated`, serve via the `get_referral_detail` door, audit a
  `referral.message_viewed` on non-author serves and `referral.message_created` on
  write (metadata only, Rule 11).

### E2. `awaiting_information` state + `waiting_on_committee_id`
Makes "request info → provide info" legible and drives the close-gate and QPS
"who's blocking" view. Cheap: one enum value + one nullable FK (must equal source or
target) + RPC wiring.

- **Extend, don't rename.** Add `awaiting_information` to our current anglicized
  lifecycle (`draft → sent → received → accepted/rejected → in_review → completed` +
  `withdrawn`). Do **not** re-label to the external doc's status vocabulary — we just
  anglicized in migration `20260719000700`; that would be pure churn.
- **Wire HC076:** the close-gate must treat `awaiting_information` as *in-flight* for a
  `response_expected=true` referral (the source still owes information; not resolved).
- Their §5.1 rationale is right: keep `waiting_on_committee_id` **separate** from
  `status` rather than exploding into `awaiting_source_*` / `awaiting_target_*` states.

**Why only these two are "essential":** together they deliver iterative clarification —
the missing capability. Everything else improves triage, analytics, or governance but
does **not** block the primary use case.

---

## 4. DEFER — valuable, sequence after the dialogue loop

Ordered high→low ROI:

1. **`referral_internal_notes` (separate table).** If we add private deliberation
   notes, adopt their **separate-table** design (§2.4) — it matches our house PHI
   isolation exactly; **never** a `visibility='internal'` flag on the shared thread.
   Cheap, security-aligned, pairs naturally with E1. Only "defer" because the dialogue
   loop ships without it.
2. **`priority` enum** (`routine|high|urgent|critical`). Net-new but tiny (CHECK-vocab
   like `harm_severity`). High inbox-triage ROI.
3. **`response_due_at` + overdue.** **Reuse the existing pattern** —
   `case_action_items.due_date` + `src/components/cases/format.ts:isOverdue()`. QPS
   already renders an aging view by timestamp; a real due date sharpens it.
4. **`requested_action_code` vocab.** Cheap seeded vocabulary; makes QPS analytics
   ("what was asked" vs. "what outcome") first-class instead of inferring from
   `response_expected`.
5. **`parent_referral_id`.** ADR 0037 D15 deliberately chose *implicit* chaining; a
   nullable self-FK is a cheap denormalization that makes QPS lineage explicit. Keep
   their §9 rule: **downstream referrals share nothing automatically.**
6. **Reopen + answered/resolved split (`referral_resolutions` lite).** Their §2.5
   governance model — *requester confirms closure, can reopen on new info* — is genuinely
   better for accreditation than our unilateral B-side `completed`. Adopt when reopen is
   needed; it pairs with the answered/resolved split.
7. **`referral_assignments`.** Per-referral reviewer responsibility distinct from
   access. Normal case assignment covers the pilot.
8. **Multiple typed `referral_case_links`.** Beyond our single `target_case_id`
   (related / follow-up / escalated / duplicate). Refinement.
9. **Snapshot versioning (`referral_context_versions`).** Only if we need formal "what
   did B know at time T" reconstruction beyond the audit log — the E1 message thread
   already carries incremental disclosure.
10. **Read receipts, per-message redaction, idempotency keys.** Hardening; the external
    doc itself defers receipts. Note we already have the stronger compliance primitive
    (`dispose_referral_phi`) that their redaction sketch lacks.

---

## 5. AVOID — do not adopt as specified

1. **`row_version` optimistic concurrency (§15.1).** Redundant with — and foreign to —
   our concurrency model (`SECURITY DEFINER` RPCs + `FOR UPDATE` + RLS, used everywhere,
   zero `row_version` in the codebase). The RPCs already serialize; a parallel
   compare-and-set scheme adds surface for no benefit. **Keep their §5.5 sequence-lock
   idea; drop `row_version`.**
2. **`referral_status_events` history table (§5.10).** Redundant with our append-only,
   **hash-chained `audit_log`** (Rule 11), which already emits `referral.created /
   status_changed / updated`. A second denormalized history = two sources of truth, and
   ours is tamper-evident (theirs isn't). If a UI needs a timeline, build a **read-model
   view over `audit_log`**, not a write table.
3. **`structured_context` jsonb carrying clinical/patient data (§5.2).** Directly
   violates Rule 12 containment — it would put PHI (their example has `clinical_summary`,
   `patient_identifiers_included`) in a free JSONB column **outside** the isolated
   `referral_patient` table and its audited door. If any `structured_context` is used,
   it must be **PHI-free** and gated identically. Structured PHI belongs in the typed,
   single-door satellite.
4. **`referral_participants` per-user ACL table (§5.3).** Forks our authorization model.
   Least-privilege PHI access is **already** enforced by the predicate trio
   (`can_read_referral` broad-metadata / `can_read_referral_phi` tight / 
   `referral_target_analyst` earns-via-case-assignment). A per-referral ACL adds exactly
   the RLS surface where a mistake becomes a PHI leak. Revisit **only** for a concrete
   requirement we don't have yet — e.g., adding a non-member outside consultant to a
   single referral.
5. **A referral-local transactional outbox (§12).** We have **no** outbox infrastructure
   at all (only `audit_log`). Notification delivery is a **platform-wide** concern;
   bolting a referral-specific outbox creates a one-off. If we want notifications, that's
   its own ADR / workstream serving cases, CAPA, meetings, and referrals uniformly —
   not part of this expansion.

---

## 6. Protect these when adopting (what the external model lacks — don't regress)

- **The QPS macro-oversight plane.** No external equivalent. It's our accreditation
  differentiator (`is_pqs_member` reads both ends + the aging/by-committee dashboard).
  Every new table (messages, notes if added) must extend the QPS read scope, and every
  new **PHI** body must stay behind the tight door.
- **PHI single-door discipline.** `get_referral_patient` / `get_referral_detail`,
  REVOKE-from-`authenticated`, audited reads, **PHI-free list/inbox/dashboard
  projections** (ADR 0037 D16). The inbox must **never** show a message-body preview or
  a `last_message` text snippet — counts and metadata only.
- **Frozen snapshot as the disclosure boundary.** B reads referral-owned rows, never A's
  live case. Their `access_mode='live_reference'` (§5.7) is the opposite of our
  guarantee — if adopted at all, keep `snapshot` the only mode for PHI-bearing content.
- **`dispose_referral_phi`** — our real retention/erasure primitive, stronger than their
  redaction sketch. Keep it central.

---

## 7. Adoption constraints (non-negotiable) + next step

**Constraints for the essential build:**
- New free-text bodies (`message.body`, future `note.body`) are PHI by classification →
  tight-door + REVOKE + audited, mirroring `frozen_body_md`/`result_md`.
- Tenant scoping follows our spine (referral → source/target **commission → hospital**,
  re-keyed in NSP-per-hospital), **not** the external doc's verbatim
  `(organization_id, id)` composite-FK convention.
- Keep the anglicized lifecycle; **add** `awaiting_information`, don't rename the rest.
- Extend HC076 to count `awaiting_information` as in-flight.

**Recommended next step:** a short **ADR amending 0037** that records this three-bucket
decision, plus a scoped phase for **E1 + E2** (message thread + `awaiting_information`/
`waiting_on`) as the "Referrals v2 — dialogue" increment, with D1–D5 as the fast-follow
backlog. Estimated as one contract-first phase (backend: 1 table + 1 enum value + ~3
RPCs [`post_referral_message`, extend `get_referral_detail`, transition wiring] + audit
verbs + pgTAP; frontend: thread UI on the referral detail + hub unread count).

**Net:** adopt **2** essentials, defer **12**, avoid **5**. The essentials are small and
high-leverage; the "avoids" are all cases where we already have an equal-or-better
mechanism and the external pattern would fork it.
