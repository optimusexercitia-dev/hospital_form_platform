---
id: DEFINER-UNDECLARED-CLASS-REMEDY
title: "The undeclared-search_path DEFINER class gets ONE owner and ONE remedy: 414 § 0b names the convergence, 421 § 0c points at it"
status: complete
kind: fup-fix
program: AUTHZ
phase: "pre-AE5 remediation — ADR 0208 D4 forward convention applied to the undeclared class (PO ruled 2026-09-11: defect to converge, no new cell)"
branch: definer-undeclared-class-remedy   # cut from main @ f55b53ba
plan: ../plans/authz-evolution.md
progress: ../progress/definer-undeclared-class-remedy.md
reviews: ["../reviews/definer-undeclared-class-remedy-review.md"]
adrs: ["0208"]
handoff: ~
fup: FUP-DEFINER-QUALIFIED-BODY-GATE-UNDECLARED-CLASS-NOW-HAS-A-LIVE-ENFORCER
---

# DEFINER-UNDECLARED-CLASS-REMEDY — one owner, one remedy for the undeclared class

Closes `FUP-DEFINER-QUALIFIED-BODY-GATE-UNDECLARED-CLASS-NOW-HAS-A-LIVE-ENFORCER`. A `SECURITY DEFINER`
function in `app`/`public`/`authz` that declares **no** `search_path` at all is in neither gate's
checking domain: `419` freezes only NON-EMPTY paths (the census coalesces a missing value to `'""'`,
so it never enters the frozen set) and `421` body-checks only EMPTY paths. Today two assertions red
on such a function — `414 § 0b` (a named-offender string vs `''`) and `421 § 0c` (the partition
string `890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared`) — and **neither message names
the remedy**. The PO already RULED the remedy on 2026-09-11 (archive entry of
`…NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`, *Open half 1*): *"a `prosecdef` function with
**no** `search_path` is a **defect to converge to `''`**, never a member to add to any frozen set; a
red on `414 § 0b` means exactly that, and neither `414` nor `419` may be widened to admit it. No new
cell."* That ruling names `414 § 0b` as the assertion and orders NO new gate, so this unit takes the
FUP's second closing branch: `414 § 0b` becomes the named owner and carries the remedy; `421 § 0c`
points at it; and the ruling's carriers stop saying *"PO to rule"* / *"unbuilt"*. No migration, no
ADR (the ruling's non-log carriers are the two gate messages and the seam).

## Acceptance criteria

- [x] **AC-1 — `414 § 0b` names the remedy.** Its description string states, in one clause, that a
  listed function is a DEFECT whose remedy is `set search_path = ''` with schema-qualified references
  (ADR 0208 D4; PO ruling 2026-09-11), ⛔ never a widening of `414`/`419` and never a frozen-set
  entry. The section's header comment says the class is RULED (dated) and keeps the 890/890 figure
  as a dated measurement. The assertion's predicate and expected value are unchanged.
- [x] **AC-2 — `414 § 0b` is proven able to red.** A planted `prosecdef` function with NO
  `search_path` (created after `§ 0b` runs, dropped before any later live count; or in a rolled-back
  savepoint whose assertion is captured outside it) is LISTED by `v414_domain`'s `sp is null`
  predicate, and its twin planted with `set search_path = ''` is NOT. ⛔ The plant must not perturb
  `§ 0b`'s own live figure or `§ 1`'s population; `plan()` and the RUN SHAPE comment move together.
- [x] **AC-3 — `421 § 0c` partitions and points.** (i) The printed `non-empty` term EXCLUDES
  `<none>`, so an undeclared DEFINER moves exactly the total and the `undeclared` term (today a red
  reads `891 = 862 … | 1`, double-counting); the expected string stays
  `890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared`. (ii) The description names `414 § 0b`
  as the OWNER of an `undeclared` red and states the remedy in one clause, so the two gates name one
  remedy. (iii) The header sentence *"would be counted on 419's side"* is corrected: it is counted in
  NEITHER frozen set nor `421`'s arm, because the census coalesces the missing value to `'""'`.
- [x] **AC-4 — `421`'s partition control.** A planted undeclared DEFINER (rolled back) makes the
  recomputed four-term string read `+1` on the total and on `undeclared` ONLY — proving AC-3 (i) — and
  a planted `''` twin moves `empty` instead. ⛔ A control that cannot red voids the change.
- [x] **AC-5 — the carriers.** Every text that still calls the class *"PO to rule"*, *"not ruled"*
  or *"PO-ruled but unbuilt"* is corrected **by dated marker, never by rewriting a posted slice**:
  `docs/backend-state/authorization-and-audit.md` (the `DEFINER-SEARCH-PATH-NARROW-FIX` and
  `DEFINER-TEMP-TABLE-CONVERGENCE` slices; a new dated slice appended at the bottom), the
  `scripts/definer-search-path-census.sql` header comment (*"disposition is the follow-up's open half
  1"* — ⚠ outside the gate-18 byte-compared block; if it is inside, leave it and file), and
  `docs/lint-gates.md` gate 18 if it names the class. The lead replaces the seam's `

**Complete 2026-09-12** — PO approved (*"Approved, step 2 N/A, controls are fine"*); QA r1 + r2 APPROVED; ledger
row in `docs/progress/phase-ledger.md`; the gate-16 size warn this unit created is dispositioned by ADR 0210 (PO
ruling, same day), not filed; detail in the [record](../progress/definer-undeclared-class-remedy.md).
