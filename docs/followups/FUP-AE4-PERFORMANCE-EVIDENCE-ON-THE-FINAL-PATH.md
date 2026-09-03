# FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH — the AE4.4 measurement was never made, and it only became MEASURABLE at AE4.9 D6 (owner: backend; filed 2026-09-02 by `lead`, from audit finding IA-F9)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

**The obligation.** Audit `authz-evolution-implementation-audit-2026-09-02.md` F9: no AE4.4 scaled-fixture
performance artifact exists anywhere in the tree. ADR 0176 Consequences makes it a Gate AE4 item.

⛔ **Why it could not have been done earlier, which is also why it kept being deferred.** Before AE4.9 D6
the final path did not EXIST — no enforcement site called the permission layer, so the only thing
measurable was `authz.holds_role` in isolation. ADR 0176 Consequences says it outright: measuring before
the seam exists **makes the wrong thing faster**. D6 built the seam, so the measurement is now possible
for the first time, and the reason for deferring it has expired.

**What must be measured.** A re-keyed site's **policy body**, through **layers 3 → 2 → 1** —
`app.can_edit_commission_forms` / `app.can_create_professional` / `app.can_read_professional_profile`
→ `authz.has_permission` → `authz.entailed_grants` → `authz.assignment_facts`. ⛔ **Never `holds_role`
alone**: that is layer 1, it is what the pre-D6 world already measured, and a fast layer-1 number says
nothing about the path a query now takes. Nested plans, on a scaled and `ANALYZE`d fixture, under real
RLS principals (the AE0 method).

⚠ **Two traps this measurement is specifically exposed to.** (1) `seed.sql` is tiny and every function
here is `SECURITY DEFINER` with cached plans — a fixture that fits in memory will report that the seam
is free, which is a fact about the fixture. (2) The three authorizers retain **residual legacy arms**
(ADR 0178 §2), and short-circuit evaluation means a principal who passes the *legacy* arm may never
reach the permission arm at all — ⛔ so a "the seam is cheap" number taken on such a principal has not
measured the seam. Measure a principal whose ONLY grant path is the permission arm.

**Not blocking the build; blocking the gate.** ADR 0176 lists it under Gate AE4, and nothing in the
AE4.9 D6 record claims it was done — both `PROGRESS.md § Now` and the increment record say plainly that
it does not exist.

⭐ **THE EVIDENCE NOW EXISTS, AND THE ACCEPTANCE FAILED — 2026-09-02.** Four runs on a scaled
ANALYZEd fixture produced `AE4 ACCEPTANCE NOT MET (3 of 7 rows PASS)` (`8ca976d7`). DC1/DC2/P2/P3/P4
PASS; **P1 FAIL** (8 240 `Seq Scan on hospitals`) and **P5 FAIL** (6.19×/6.21× against a 4× threshold;
six readings, 5.20–6.27). ⛔ **This item's own premise is overturned by its own measurement:** the
non-inlinable DEFINER SRF evaluated per row — named here as *the* regression — is **~1–3 %** of
per-protected-row cost. The regression is `authz.scope_reaches` → `FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN`.
⛔ **Do NOT close this on the fix landing.** It closes when the acceptance is re-run *against* the fix
and the verdict table reads PASS on every row; a partial improvement in P5 that does not reach ≤4× is a
partial result, and the threshold does not move (protocol §8 item 5 licenses re-deriving only within a
few percent). Protocol + run artifacts: `../design/authz-ae4-performance-acceptance.md`.
