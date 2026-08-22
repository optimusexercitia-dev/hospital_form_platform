# Case surface split — Increment 2 (ADR 0134)

_Opened 2026-08-22 as the rotation destination for Increment-2 material while the increment is still
IN BUILD. Live status stays in [PROGRESS.md](../../PROGRESS.md) § Now; this file takes rulings whose
**binding work has landed**, so § Now carries what is still actionable rather than a record of what
was decided. It becomes the completed record at the §6 step-5 Record._

⛔ **Nothing here is a completion claim.** Increment 2 is **not merged**; every follow-up these bullets
name keeps its own index line in § Follow-ups and stays OPEN until it is.

## Rulings whose implementation has landed

### ADR 0134 Amendment 4 — rotated 2026-08-22

Rotated because the bullet's own words were *"binds M2 before it is written"* and **M2 is written**:
the `not v_eg` bound is applied, and P9 / P9-twin / P10 / P11 are green with the twin
mutation-proven — removing the bound reddens the locked-case pins **and** the bit-shape pins, which is
Amendment 4 §A4.2's derivation becoming evidence in the direction it predicted. The door-set
enumeration it demanded is done **and pinned in `356` §13** rather than merely recorded: 4 direct
routines, 0 direct policies, and — the number the "4 routines" framing hides — **11 RLS policies + 3
routines transitively**, through its negation `app.can_read_case_committee`, which is keyed on **bits,
not arms**. ⚠ `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY` **stays OPEN** until this branch merges.

- **✅ RULED 2026-08-22 — ADR 0134 Amendment 4: S8 is bounded by `not v_eg`, like its siblings.** An
  `explicit_grants_only` case is invisible to the `read_cases` arm; reach there rides an explicit grant
  (S3) or nothing, exactly as for S5/S7. ⛔ Ruled **separately** from Amdt 3 and does not inherit its scope.
  Unbounded, a capability checkbox would have **outranked a per-case access policy**, and left the appointee
  `read_case_content ∧ ¬read_case_deliberation` — **the quality reviewer's exact bit-shape** — so every door
  keyed on `is_oversight_only_reader` would misread an administrativo as a reviewer.
  **Binds M2 before it is written:** the `not v_eg` condition · **P9** locked-case negative · **P9-twin**
  (remove the bound ⇒ P9 RED — an omitted sibling check is invisible to every ARM) · **P10** bit-shape both
  directions (Amdt 4's claim is *derived, not executed*) · **P11** the S3 grant path still works · and the
  `is_oversight_only_reader` **door set enumerated by `prosrc` property** — ⚠ its size is **not established**
  (one member found while measuring something else). `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY` stays **OPEN**
  on that implementation residue: ruled ≠ discharged.
