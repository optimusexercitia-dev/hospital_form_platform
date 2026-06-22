# ADR 0038 — Case patient identifiers (`case_patient`, the third PHI module)

**Status:** Accepted · **Date:** 2026-06-21 · **Phase:** Cases-module increment
(`case_patient` flag) ·
**Amends:** ADR [0033](./0033-case-access-control.md) (reverses its Q13 "case access is
strictly PHI-free"), ADR [0030](./0030-patient-safety-phi-and-pqs-architecture.md),
ADR [0036](./0036-phi-access-hardening.md), ARCHITECTURE.md Rule 12 ·
**Relates to:** ADR [0035](./0035-lgpd-anvisa-regulatory-posture.md) (column encryption
declined), ADR [0031](./0031-event-custody-ledger-and-phi-isolation.md) (PHI isolation
pattern), ADR [0037](./0037-inter-committee-case-referrals.md) (the second PHI module +
the case→referral PHI prefill this generalizes).

## Context

When a `Case` is created, whoever later assumes it (fills `Phases`, authors `Narratives`)
needs to know **which patient records to look up**. The Cases module was deliberately
**PHI-free**: `cases` had no patient columns and the "Novo caso" dialog warned against
putting any identifier in the label (ADR 0033 Q13). There was no place to record the
minimum patient context a case-worker needs.

Two binding facts made this more than a dialog tweak: (a) structured patient identifiers
are PHI, and (b) Rule 12 confined PHI identifiers to **two** modules — the NSP
`event_patient` and the referral `referral_patient` — each under an isolated-satellite +
audited-single-door + disposal posture. Capturing identifiers on cases makes Cases the
**third** such module, which is a conscious Rule 12 change, not a silent edit.

Rather than build a generic custom-field engine (none exists, and it would be a PHI
minefield), we reuse the proven pattern: the same fixed 8-field identifier catalog and the
exact `event_patient`/`referral_patient` machinery, copy-and-adapted.

## Decision — the 8 locked design decisions

1. **Fixed identifier catalog** — the same 8 fields as `event_patient`/`referral_patient`
   (`name`, `mrn`, `date_of_birth`, `age_years`, `sex`, `encounter_ref`, `unit`,
   `attending`). No custom-field engine.
2. **`case_patient` 0..1 satellite** (PK = `case_id`), modeled exactly on `event_patient`:
   all direct DML **REVOKED** from `authenticated`; written via a DEFINER `set_case_patient`;
   read only via the audited DEFINER door `get_case_patient` (emits `case_patient.read`,
   returns NULL out-of-scope/absent with no audit row, never copies the payload into the
   audit). Denormalized `has_patient` flag on `cases`.
3. **Read predicate = the BROAD `can_read_case`** (coordinator OR phase/narrative
   attribution OR explicit `case_access` grant OR QPS) — **deliberately looser** than
   `can_read_event_patient`/`can_read_referral_phi` (staff_admin + PQS only), because case
   **assignees need the MRN to do the work**. Identifiers follow the same read scope as the
   case itself; every read is still funneled through the one audited door. This is the only
   intentional divergence from the other two modules — recorded here so a security reviewer
   sees it is by design, not an oversight.
4. **Writes/edits = coordinators only** — `staff_admin` of the case's commission OR platform
   `admin` (NOT assignees, NOT case-write grantees). Editable (upsert), not frozen.
   Minimum-necessary floor: require ≥ `name` OR `mrn` (enforced in the action layer, matching
   the existing pattern). The read-broad / write-tight asymmetry is the security spine.
5. **Per-template on/off toggle**, draft-only, **default OFF**: `process_templates.collects_patient`
   the committee sets in the template builder. The "Novo caso" dialog shows the optional PHI
   block only when the selected template has it on **and** the `case_patient` flag is on. The
   flag is **snapshotted** to `cases.patient_enabled` at creation (immutable per case).
   Existing/other templates stay PHI-free by default.
6. **Reveal-on-demand header** on the case-detail page — a protected-state panel with an
   "Exibir identificação" button; the audited read fires **only on click**, not on case open
   (a case page is high-traffic, so eager loading would drown the audit in incidental reads
   and put identifiers on screen for every glance). Mirrors the referral panel.
7. **Downstream snapshot-copy prefill** — `case_patient` becomes the preferred prefill source:
   the referral send wizard pre-fills `referral_patient`, and the NSP notify flow pre-fills
   `event_patient`, from the source case's `case_patient`. **Value copy** (editable,
   divergeable), never an FK link, so each module's isolation + disposal stays independent.
   Precedence: prefer `case_patient`, fall back to a linked event's `event_patient`. This
   generalizes the existing event→referral prefill (ADR 0037).
8. **Disposal built now** — `dispose_case_phi` (copy of `dispose_event_phi`): deletes the
   `case_patient` row + redacts the case free-text PHI (`case_narratives.body_md` → NULL,
   `case_events.body` → `'[PHI removido]'`), preserves the governance skeleton + hash-chained
   audit, one-shot (`HC056`), constrained reason enum, stamps `phi_disposed_at/by/reason` +
   `has_patient = false`, emits `case_patient.disposed` (reason-only metadata). Gate =
   staff_admin-of-commission OR admin. A disposal **UI** affordance is a fast-follow (NSP
   disposal is RPC-only today).

## Supersession & amendments

- **Reverses ADR 0033 Q13** ("case access is strictly PHI-free"). The Cases module now
  carries optional structured identifiers, under the identical isolation + audited-door +
  disposal safeguards Rule 12 established. The case-access model itself is unchanged — the
  read scope simply now *also* governs the audited identifier door.
- **Amends ARCHITECTURE.md Rule 12 ("two → three").** PHI now lives in the NSP, referral,
  **and case** modules. The first two restrict identifiers to staff_admin + PQS; the case
  module deliberately uses the broad `can_read_case` (Decision 3) — the divergence is
  recorded in Rule 12.
- **Amends ADR 0030 / 0036.** ADR 0036's free-text PHI classification already named case
  narratives/events as PHI-bearing; this ADR adds the structured `case_patient` door and the
  `dispose_case_phi` erasure path the Cases module previously lacked.
- **Cross-links ADR 0035.** Column-level encryption is **declined** here as for the other two
  modules — at-rest platform encryption + tight RLS + audited single-door reads are the
  controls.

## The concrete surface as built (for QA to audit against)

**One forward-only migration** `20260620017000_case_patient.sql` (no prior migration edited):

- **Table** `public.case_patient` (RLS enabled): the 8 identifiers, PK `case_id`, FK →
  `cases ON DELETE CASCADE`. **All DML REVOKED from `authenticated`** (`service_role`
  retained); a SELECT policy on `can_read_case_patient` for defense-in-depth.
- **`cases` columns:** `has_patient`, `patient_enabled` (`NOT NULL DEFAULT false`),
  `phi_disposed_at/by/reason` (+ 5-value reason CHECK). No `updated_at` (cases has none).
- **`process_templates.collects_patient`** (`NOT NULL DEFAULT false`).
- **Predicate** `app.can_read_case_patient(case, uid)` = a thin DEFINER wrapper over the
  live broad `app.can_read_case` (the QPS-term version).
- **Doors / writers** (DEFINER): `get_case_patient` (audited single read door),
  `set_case_patient` (coordinator gate `42501`; asserts `patient_enabled`; refuses after
  disposal), `dispose_case_phi` (staff_admin/admin gate; one-shot `HC056`; reason enum),
  `set_template_collects_patient` (draft-only). `create_case_from_template` + `get_case_detail`
  re-emitted via `CREATE OR REPLACE` (snapshot `patient_enabled`; echo the two flags).
- **Audit verbs** (PHI-free metadata, Rule 11): `case_patient.updated` (trigger, empty
  metadata) and `case_patient.disposed` (reason-only) flow through `audit_write`;
  `case_patient.read` is appended to the `log_audit_access` positive allow-list (the full
  base + referral allow-list carried forward — no verb dropped).
- **Feature flag** `case_patient` ships **OFF**; asserted first-line in the writers + dispose;
  the query layer probes `case_patient_enabled()`. Flag-OFF is byte-identical to before.

**TS + UI:** client-safe `src/lib/cases/types.ts`; `getCasePatient`/`casePatientEnabled` +
`Case.hasPatient`/`patientEnabled` in the query layer; `setCasePatient` (name-or-MRN floor)
/`revealCasePatient`/`disposeCasePhi`/`setTemplateCollectsPatient` actions; a precedence-aware
prefill loader + a notify bridge. UI reuses the NSP `PatientFields` block; a near-copy
`CasePatientPanel` (reveal-on-demand) + a coordinator `CasePatientEditDialog`; a draft-only
builder toggle; the create dialog writes PHI post-create (NSP notify→set sequence); the
referral wizard + notify dialog seed from the case.

## Consequences

- **PHI surface tripled but contained.** A reviewer audits `case_patient` by the same
  checklist as `event_patient`: one isolated REVOKE-ed table, DEFINER-only writes, audited
  single-door reads, PHI-free list/board/dashboard projections, no column encryption. The one
  intentional difference is the broad read predicate (Decision 3).
- **Cases gained the disposal path it lacked.** `dispose_case_phi` covers both the new
  identifiers and the pre-existing case free-text PHI.
- **Related parity gap (follow-up).** `dispose_referral_phi` still does **not** exist — the
  referral module (ADR 0037) shipped its PHI satellite/door/REVOKE but no LGPD-erasure RPC.
  Building `dispose_case_phi` now leaves referrals as the only PHI module without disposal; a
  follow-up should add `dispose_referral_phi` for parity before production.
- **Pilot-ready behind the flag.** Ships OFF; the whole feature is dark until the in-phase
  flip, exactly like `audit_trail` / `patient_safety` / `case_access` / `case_referrals`.
