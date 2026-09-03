# FUP-MINT-KIND-TIER-RULE-ONE-DIRECTION — the mint door refuses the wrong tier for one kind and not the other (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25, QA pass 2 finding N-1.** `mint_printed_document`'s `p_contains_phi` defaults
> to `false`. The door **refuses `TRUE`** for `form_response` (`p_source_kind not in
> ('meeting','case')`) but has **no mirror refusing `FALSE` for `case`**.
>
> ADR 0144 Amendment 5's claim — *"no registered case document can be standard-tier, without
> exception"* — **holds today**, and QA proved the complement by construction through the real
> door: `registers` true→false on disposal, label → `[PHI removido]`, mint → `HC0DP`. So
> `contains_phi = false ⟺ caseDisposed ⟺ refused`. ⛔ **But it is closed by the D3 registration
> gate, not by a tier check** — the invariant lives in a *composition*, one edit from breaking:
> any future derivation for `containsPhi` reopens standard-tier for a **live** case with nothing
> in the catalog objecting.
>
> **Owed:** a `if p_source_kind = 'case' and not coalesce(p_contains_phi,false) then raise`
> conjunct, so the invariant lives where Rule 1 puts it. ⚠ It is a gate change: it owes a keystone
> and a diff-scoped door sweep. **Not reachable today — and "not reachable" is not "protected",
> which is why this is filed rather than dropped.**
