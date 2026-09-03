# FUP-P3-DOSSIER-HAS-NO-RECUSAL-ROSTER — the case dossier cannot show who was recused (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25 during the PDF·P3 build, as a named gap rather than a silent cut.**
>
> `CaseDetail.myRecusal` carries **the caller's own recusal only**; no per-participant recusal
> roster reader exists in `src/lib/queries/`. So `recusalDisplay` on the dossier's participant
> entries could be populated **for the minter and for nobody else**.
>
> ⛔ **A field populated only for the minter is worse than no field**, and the reason is ADR 0104
> **A7**: it makes the artifact vary by who printed it. The de-identified variant already carries
> one bounded A7 exception (ADR 0144 Amendment 2 — three demographic fields, justified by D5's
> clinical floor and by D14's requirement that a content-only reader can still print). This would
> be a **second** exception with **no** comparable justification, on a field D2 never enumerated.
>
> **Disposition: `recusalDisplay` is DROPPED from the v1 payload type.** D2's enumerated dossier
> contents do not include recusals, so this is inside v1's stated scope.
>
> ⚠ **Why it is filed anyway rather than closed by scope:** ADR 0144 **D8's Consequences paragraph
> discusses recused members by name** (a recused member can neither mint nor download). A reader who
> knows recusal is a first-class case concept can reasonably expect the printed record to show it,
> and "the ADR talks about recusals but the dossier is silent about them" is a gap someone will
> re-discover from the artifact rather than from this file.
>
> **Fix shape (not built):** a per-participant recusal roster reader in `src/lib/queries/`, then a
> `recusalDisplay` restored to the participant entry. ⛔ It must render for **every** participant or
> for none — a partial roster reintroduces exactly the minter-varying artifact this note rejects.
>
> **Owner:** backend.

---
