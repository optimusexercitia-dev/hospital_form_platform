# FUP-AE5-MATRIX-ARM3-CELLS-ADR-0202-BLAST-RADIUS-CITES-ANOTHER-ADRS-CENSUS

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-10 · status open

**The observation.** `docs/plans/pre-ae5-remediation.md:398` tells whoever opens ADR **0202**
(F7 · F8 · the `platform_role` retirement) that *"Its blast radius is **3 sites** and fully measured
(see the unit record)."* ⛔ **That census is not in the unit record.** Measured 2026-09-10 over
`docs/progress/ae5-opening-adr.md`: `platform_role` occurs **4** times, none of them a census; the
only *"three sites"* measurement in the file is **PO ruling R8's** resolver trio at `:604-606` —
`authz.has_permission`, `authz.candidate_has_permission`, `authz.explain_permission`, the three
consumers of `entailed_grants.hat_ok` — which is **F6's** blast radius and therefore **ADR 0201's**
subject, not 0202's. The plan borrowed a number that belongs to a different decision.

**Why it matters now rather than later.** ADR 0202 is one of the **two** successors still unopened
(plan §6). A session opening it reads *"fully measured"*, skips the census, and writes a decision on
a blast radius nobody established. That is the shape the pre-AE5 programme exists to retire — a
sentence that reads settled while its cited home is silent.

**What the reach actually looks like, stated as a MEASUREMENT and explicitly NOT as the census.**
At head pair `(20261003007390, 528)`, live catalog: the `platform_role` enum carries **11** labels;
**1** routine in `app`/`public`/`authz` (`prokind='f'`) mentions the type in its
`pg_get_functiondef`; **1** column anywhere is of type `platform_role`. First-party TypeScript:
**7** files under `src/`, **13** occurrences. ⛔ This is a reach probe, not 0202's census — it counts
only the `platform_role` limb and says **nothing** about **F7** (one manifest entry per role in
`role-catalog.ts`, today spread across `ROLE_LABELS` + `ROLE_SCOPE_KIND` + `ROLE_ORDER` +
`ROLE_BRANCH` + a `scopeSummary` switch) or **F8** (`administrativo` seeded as a 12th `authz.roles`
row under a `capability_plane` sentinel while its own comment says NOT A ROLE). Those two limbs have
**no census at all**, in any home. ⇒ under any reading that includes F7 and F8, *"3 sites"*
understates the subject; under the narrowest reading it is unverifiable.

**Why no gate catches it.** `lint:registers` resolves ADR **link targets**, never the claim that a
cited document *contains* a particular measurement. A citation to a live file that simply does not
carry the fact is invisible to every gate in the chain — the `409` § 3.7 shape again, and the second
instance of it found at this unit's open (the first was the manifest's self-contradicting
`openArms`).

**Not fixed in this unit, deliberately.** Running 0202's census is **0202's work**, and this unit's
scope is arm-3 divergence enumeration. ⛔ Widening it to absorb a neighbouring ADR's measurement is
exactly the drift the phase discipline forbids. What is owed here is the **warning**, so the next
session starts from *"census owing"* rather than *"census complete"*.
