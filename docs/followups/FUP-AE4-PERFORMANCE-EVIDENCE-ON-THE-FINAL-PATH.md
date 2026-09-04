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

## ⭐⭐ MEASUREMENT DISCHARGED 2026-09-03 (runs 6 + 7) — the record below this line is SUPERSEDED

**Both sharp conditions of "What must be measured" were met, and verified independently on
2026-09-03 rather than read off an acceptance banner.**

- **Condition 2 — a principal whose ONLY grant path is the permission arm: PROVEN, as a machine
  assertion, not prose.** § 4 of `../design/authz-ae4-performance-acceptance.md` is titled for
  exactly this; § 4.1 turns it into ten VOIDing checks (one per competing arm), and both runs'
  artifacts print the table — `is_tenancy_admin_of_for` FALSE, `can_manage_professional` FALSE, zero
  `org_admin` / `hospital_admin` rows, `is_admin` FALSE, while `authz.has_permission` is TRUE. § 6.2
  VOIDs the run if any competing arm reads TRUE. The P2 checker takes the principal from
  `ae4perf.fixture_meta`, never from a literal.
- **Condition 1 — the policy body through layers 3 → 2 → 1, never `holds_role` alone: MET at run 7,
  and genuinely VIOLATED at run 6.** Run 6's P2 evidence folded three off-path `holds_role` nodes
  (reached via `app.can_manage_professional`) into its own subject — breaking the rule written at
  `scripts/authz-ae4-perf-harness.sql:41-44`. The acceptance record caught it, ruled **P2 `UNRUN`
  until run 7**, and run 7's OID-keyed counter re-derived the decomposition with that term named and
  excluded: `A = 7 = asi 1 + entailed_grants 3 + holds_role 3`, residual **0**.

⛔ **Four bounds on that discharge, all disclosed by the acceptance document itself.** (1) Only
**one** of the three named authorizers is measured at policy level — `can_read_professional_profile`;
`can_create_professional` has no policy, and `can_edit_commission_forms` is measured for **plan shape
only** (its audit trigger dominates, so § 5 forbids using M2/M3/M3b for a ratio). Every headline
number is the professional-profile read path. (2) The "PASS on every row" clause is met as a
**composite across two runs**, not by one table: run 6 supplies P3/P4/P5/P7/DC1–DC3 at head
`20261003007320`, run 7 supplies P1/P2 at `…007320 + …007330` and does not re-table the rest.
(3) Run 6's P2 PASS was withdrawn, not inherited. (4) It is plan-shape and invocation-count evidence
on a fully cache-resident fixture — **not** a production latency prediction; AE7's entry condition 2
is a separate obligation.

**Still owed administratively:** this entry's `Closes when` is `PO to rule`, and no PO ruling is
recorded. The measurement obligation is discharged; the ruling that closes the entry is not.

---

_Superseded record, kept because it is the history of the obligation:_

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
