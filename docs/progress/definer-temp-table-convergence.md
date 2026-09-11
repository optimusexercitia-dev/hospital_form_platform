# DEFINER-TEMP-TABLE-CONVERGENCE — progress record

> Hub: [definer-temp-table-convergence.md](../features/definer-temp-table-convergence.md) ·
> branch `definer-temp-table-convergence`, cut from `main @ b1e9b924` · owed by ADR 0208 D4 (on touch)
> · closes `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-FOUR-TEMP-TABLE-DEFINERS-MEASURED-FREE-TO-CONVERGE`.

## Session log

### 2026-09-11 — unit opened; the PO ruled CONVERGE; scope mapped (lead)

**The ruling, and its scope written down:** the follow-up's *Closes when* was `PO to rule`. The PO
opened this session with *"Lets solve `The four temp-table DEFINERs measured free to converge,
unruled.`"* — read as the ruling to CONVERGE the four (ADR 0208 D4: *"converge to the empty form on
touch"*), nothing wider. ⛔ It does NOT rule the sibling follow-ups filed by the same unit
(`…QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`, `…RULES-CAP-DEFERS-THE-D5-HINT-FILE`,
`…DOOR-SWEEP-ARM-2-ROW-WAS-ARM-1-RELABELLED`); they stay open. If the PO meant otherwise, the
correction is one line here.

**Why no ADR:** 0208 D4 already orders convergence on touch; D6's precondition (targeted tests first)
was discharged by `420`; D5 requires a new ADR only to admit a SECOND compatibility form, which this
is not. ADR 0209 § *Considered and held* explicitly defers the four's sequencing to the convention's
unit. Highest ADR on any branch: 0209.

**Scope mapped (Explore, conclusions only):** nothing pins the four's `search_path` except `420` and
the freeze artifact — `271/274/276/277/280` are behavioural only, `413` names none of them, the
enforcement manifest and both generated surfaces carry no `search_path` column. The complete moving
set: migration `20261003007420_*` (four ALTERs) · the freeze artifact via `--write` (pure four-row
deletion, 865 → 861) · `419 § 0c`/`§ 0d` literals + header prose · `420` (`§ 5` / `§ 5b` pin the
four UNCONVERGED and will red; the per-section `[cfg]` witnesses stop discriminating once TODAY ==
converged) · the seam (`:57` clause, `:1291`, `:1304`, new slice, `## Current state` replaced) ·
the register entry. ⭐ `420 § 5b` says in its own words: *"a finding for a FUTURE convergence"* —
this is that unit.

**Plan approval:** the migration follows the already-approved `20261003007410` pattern (narrow
`ALTER FUNCTION`, no body); one-line plan + lead ack suffices (lead-playbook §3).
