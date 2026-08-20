# ADR 0035 — Regulatory Posture (LGPD / ANVISA / CFM) & Column-Encryption Decision

**Status:** Accepted · **Date:** 2026-06-20 · **Phase:** PHI/HIPAA-readiness
remediation (post external-consultant review) · **Relates to:** ADR
[0030](./0030-patient-safety-phi-and-pqs-architecture.md) (PHI posture reversal),
ADR [0031](./0031-event-custody-ledger-and-phi-isolation.md) (PHI isolation),
ARCHITECTURE.md Rules 11–12.

> ## ⚠ AMENDMENT 1 (2026-08-19) — counsel's retention ruling: RECORDED, its SCOPE still open
>
> **What was reported.** The PO relayed a legal-team consultation, in substance: *"the
> requirement to retain patient data for 20 years overrides any patient request to remove
> data via LGPD [Art. 18]."* This replaces Decision 1's *reconciliation* of erasure with
> retention by a *precedence*: the retention duty wins.
>
> ⛔ **What was NOT reported — and must be, before this amendment finalizes: the ruling's
> SCOPE.** The question sent back to counsel (design session Q14, 2026-08-19):
>
> > *Does the CFM 1821/2007 20-year retention duty attach to quality-committee governance
> > records (meeting minutes, referrals, committee case records) held outside the
> > prontuário, or only to the medical record itself? If the former, state the basis; if
> > the latter, Art. 18 erasure applies to this platform's records normally.*
>
> CFM 1821/2007's duty attaches to the **prontuário**; this platform is positioned beside
> the EHR and does not duplicate it (CLAUDE.md §1). Reading a medical-record duty as
> covering committee prose is a real rule quoted at a grain it may not bound — and here it
> fails in the *permissive* direction (retaining PHI a subject asked to erase). An
> approval recorded without its scope is the record class that goes stale silently; hence
> the quote above, not a paraphrase of its conclusion.
>
> **Interim effect (until the return):** the `subject_request` disposal-reason value and
> the doors are UNCHANGED — no lane is closed at the schema or gate level. The DSR
> workflow (ADR [0130](./0130-dsr-subject-request-workflow.md)) is outcome-agnostic by
> design: it can record `granted` and `refused_retention` outcomes either way, and only
> its `refused_retention` guidance copy and default adjudication stance block on counsel's
> answer. Precedent inside the tree: ADR [0072](./0072-ethics-access-spine.md) already
> applies retention-over-erasure to Class-2 professional-identity records; this amendment
> is about whether that extends to **patient** PHI in governance records.
>
> **Owed when the return arrives:** update this amendment with counsel's answer verbatim
> + scope; settle ADR 0130's refusal guidance; re-examine the shipped dispose-dialog copy
> (`FUP-DISPOSE-DIALOG-OVERCLAIM`), which currently offers *"Solicitação do titular (LGPD
> Art. 18)"* as a reason for an erasure the hospital may have decided it will not perform.

## Context

ADR 0030 reversed the no-patient-data rule and framed the platform's PHI posture
around **HIPAA** and an executed Supabase **BAA**. An external database review
(2026-06-20) flagged two gaps in that framing, both accepted by the owner:

1. **(H5) Wrong primary regime.** This is a **Brazilian** hospital platform.
   HIPAA is a US statute and the BAA is a contractual safeguard on the
   infrastructure provider — not the law that governs this data. The **binding**
   regime is Brazilian: the **LGPD** (Lei 13.709/2018) for personal/health data,
   the **ANVISA RDC** patient-safety rules (RDC 36/2013 — the NSP itself), and
   **CFM Resolução 1821/2007** for medical-record retention. Framing compliance
   solely as "HIPAA" leaves the real obligations — LGPD legal basis, data-subject
   rights, ANPD breach notification, the 20-year retention floor — unstated.

2. **(H1) An encryption control claimed but never built.** ADR 0030 §3 and ADR
   0031 §3 advertised "optional column-level encryption (pgcrypto)" /
   "encryption-ready" identifiers. No column encryption exists; pgcrypto is
   installed but used only for the audit hash-chain digest. The docs claimed a
   control the code does not implement.

## Decision

1. **Binding regime is LGPD + ANVISA/RDC + CFM; HIPAA/BAA is the infrastructure
   layer.** Compliance obligations are stated against Brazilian law:
   - **LGPD Art. 11** — health data is *dado pessoal sensível*; processing rests
     on a permitted legal basis (tutela da saúde / care provision and the
     controller's legal obligation), not consent-by-default.
   - **Data-subject rights** including correction and **eliminação** (Art. 18) —
     satisfied by the controlled PHI-disposal RPC (`dispose_event_phi`),
     reconciled with retention below.
   - **ANPD breach notification** — an incident-response posture; a
     deployment-gating item alongside the BAA prerequisites of ADR 0030 §3.
   - **CFM 1821/2007 — 20-year retention** of the medical record. PHI disposal
     therefore **nulls/redacts identifiers + clinical free-text while preserving
     the governance skeleton** (codes, status, custody ledger, structured
     non-PHI, the hash-chained audit trail): it is a minimisation / right-to-
     erasure mechanism, **not** record destruction. The retention clock stays
     policy.
   - **HIPAA + the Supabase BAA** remain in force as the **infrastructure**
     safeguard (HIPAA-eligible tier, at-rest encryption, sub-processor controls).
     This ADR re-frames the legal basis; it does **not** drop the 0030 posture.

2. **Column-level encryption is declined; platform at-rest encryption is the
   posture.** pgcrypto column encryption is **not** adopted: it does not address
   the platform threat model (a compromised app/Postgres role decrypts on read),
   it co-locates keys with the ciphertext, and it breaks search/sort/equality on
   the very identifiers (MRN, name) the NSP must query. Confidentiality rests
   instead on **minimum-necessary RLS**, the **single-door audited identifier
   read** (`get_event_patient`), and **platform at-rest encryption** under the
   BAA. The "encryption-ready" / "optional column encryption" claims are struck
   from ADR 0030 §3, ADR 0031 §3, and ARCHITECTURE.md Rule 12.

## Consequences

- **Docs updated in lock-step:** ARCHITECTURE.md Rule 12 (encryption bullet +
  regime note), CLAUDE.md §1 (HIPAA-infrastructure + LGPD/ANVISA/CFM binding
  regime), ADR 0030 §3 / ADR 0031 §3 (encryption claim struck, pointer here).
- **Retention vs erasure is reconciled, not collapsed into deletion:** the
  disposal RPC minimises PHI on request while the governance/audit record
  survives the CFM retention window; a scheduled retention sweep is a later
  follow-up.
- **No infrastructure change:** the BAA, HIPAA-eligible tier, and at-rest
  encryption are unchanged. This ADR corrects the *legal framing* and *removes a
  control claim*; it does not weaken any implemented control.
- **Does not supersede ADR 0030's PHI-in-scope decision** — it refines that
  decision's regulatory basis and corrects its encryption sub-claim.
