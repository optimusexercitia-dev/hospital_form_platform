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

---

## ✅ RULED — 2026-09-11 (PO, unit `AE5-SUCCESSOR-ADRS`); the lead closes this at the Record step

**Ruling (PO, 2026-09-11):** closed on **branch (a)** of this entry's own close condition — the
census was run and lands in a durable home, **ADR
[0207](../decisions/0207-the-role-catalog-holds-roles-administrativo-is-a-capability-provider.md)
D7**, which carries the query beside every figure (ADR 0195: a count in ungated prose rots).

| limb | reach |
| --- | --- |
| `platform_role` enum labels | **11** |
| columns typed by it | **1** — `app.active_role_selections.role` |
| routines naming it | **1** — `public.assume_role(p_role platform_role)`, `prosecdef`, not overloaded |
| RLS policies naming it | **0** |
| first-party TS files | **7** — 6 hand-written + the generated `src/lib/types/database.ts` |

Cross-checked independently of the three catalog queries: `select distinct d.classid::regclass,
d.objid from pg_depend d where d.refobjid = 'public.platform_role'::regtype and d.deptype <> 'i'` →
exactly two dependents (`pg_class` + `pg_proc`), consistent with 1 column + 1 routine and **no third
limb**. ⚠ `prokind in ('f','p')` is required in the routine query — without it `pg_get_functiondef`
errors on aggregates and the census returns **nothing at all**, a silently-empty sweep.

⭐ **The understatement this entry warned about is addressed on all three limbs, not one.** F7 and
F8 were the two limbs with no census in any home: **F8**'s is ADR 0207 D7's 12-row `authz.roles`
table plus D2's five-value `commission_administrativo_capabilities` CHECK (⚠ five capabilities and
one **door**, `bulk_create_cases` — not six capabilities); **F7**'s is D4's five live declarations in
`src/lib/role/role-catalog.ts`, each shifted +10 lines since the audit, with the note that F7's
*second* complaint (the Docker shell-out in Vitest) is **already remediated**.

`docs/plans/pre-ae5-remediation.md:398`'s *"3 sites and fully measured (see the unit record)"*
carries a dated correction beside it naming ADR 0207 D7 as the home; R8's `hat_ok` resolver trio
stays attributed to F6 / ADR 0201 where it belongs.

⛔ **Not closed by this note.** The entry stays `open` until the lead's Record step for
`AE5-SUCCESSOR-ADRS`.
