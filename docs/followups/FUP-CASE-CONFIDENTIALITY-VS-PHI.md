# FUP-CASE-CONFIDENTIALITY-VS-PHI — a case can be classified "no patient data" while holding patient data (owner: backend + PO ruling)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> `cases.confidentiality_level` and `cases.has_patient` are **unconstrained against each other**:
> nothing in the schema, no CHECK and no trigger prevents a case from being classified
> `non_phi_internal` while carrying patient data. Measured on the seed 2026-08-25: **2 of 8 cases**
> hold exactly that pair. The label for that level is *"Interno (sem dados de paciente)"*, so the
> classification asserts something about CONTENT that the platform does not enforce.
>
> It surfaced in PDF·P3 as a printed dossier headed *"Interno (sem dados de paciente)"* while its own
> confidentiality band read *"CONTÉM DADOS DE PACIENTE"* and its body printed a patient name and MRN.
>
> ⚠ **The print side is already mitigated** (ADR 0144 Amdt 3 frames the label as *"Classificação
> declarada"*, which stays true regardless), so this is **NOT a printing bug and must not be closed by
> pointing at that fix.**
>
> Three candidate answers, none chosen: **(a)** constrain the pair (a trigger, or a CHECK plus a
> backfill of the offending rows); **(b)** derive `confidentiality_level` from content rather than
> storing it as a declaration; **(c)** accept the pair as legitimate and **re-label the level** so it
> stops asserting absence of patient data — the cheapest, and the only one touching no case data.
> ⚠ The level also drives access decisions elsewhere, so re-labelling is **not purely cosmetic**.
>
> Predates PDF·P3; found by its visual pass. **Owner:** `backend` + a PO ruling on which answer.

---
