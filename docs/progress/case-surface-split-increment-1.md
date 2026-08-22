# Case surface split — Increment 1 (ADR 0134)

_Rotated from PROGRESS.md § Now at the §6 step-5 Record, 2026-08-21, on PO approval of Increment 1.
Live status stays in PROGRESS.md § Now; this file is the completed record. Links were repointed on
rotation and all five verified to resolve from this directory._

**Outcome:** §6 steps 1–5 complete for Increment 1. QA **APPROVED r3** (r1 and r2 were both CHANGES
REQUESTED). Merged to `main` on PO approval; **no remote `db push`** — the increment is DB-free and
the standing discipline is unchanged.

## The § Now narrative, verbatim at rotation

- **🏗 IN BUILD 2026-08-21 — CASE SURFACE SPLIT (ADR [0134](../decisions/0134-case-surface-split-and-administrativo-case-read.md)).**
  Branch `feat/case-surface-split`; plan [case-surface-split.md](../plans/case-surface-split.md)
  (Step 0 → Increment 1 → Increment 2, strictly ordered, full §6 step-1 gate between each).
  **✅ Step 0 DONE** (`4ec53577`) — `quality-oversight.spec.ts` 21 p / 0 f / 0 did-not-run / exit 0
  on a fresh reset; both QO bugs closed and rotated. **🏗 Increment 1 code BUILT** (`01b41c87`) —
  T1–T5, lint 8/8 + `tsc` green (lead-verified, exits read directly). **T6 specs written**
  (`0d839242`); **§6 steps 1+2 re-run CLEAN at `e7ec7529`** (superseding `ea89aeb0` — see Test Run Summary; full `e2e:prod`
  GATE GREEN exit 0, census sums). **⛔ Step 3 QA: CHANGES REQUESTED — TWICE (r1 and r2)**
  ([review](../reviews/case-surface-split-increment-1-review.md)). **r1:** 3 blocking, no security
  defect; **F-1 falsified D1's own acceptance bullet** (a *second* `/casos` route file,
  `casos/[caseId]/narrativa/[narrativeId]/page.tsx`, never converted, keeping two case-wide arms —
  the fifth instance of this plan's hand-list hazard). **All five r1 code findings fixed**
  (`3475c4d6`, + specs `134138af`), two better than asked — F-1 closed with a *class* fix
  (`reading-surface.ts`, one definition of the narrowing) plus the new manage narrative host.
  **r2 blocked again on three NEW items:** ⛔ **R-1 — `npm run lint` exits 1 at HEAD** (`lint:vacuous`
  false-positive on the new keyboard spec) **so §6 step 1 was UNSATISFIED and the lead's recorded
  “lint 8/8” was FALSE** — measured 18:14, specs landed 18:35, never re-measured (row withdrawn; the
  detector bug is `FUP-VACUOUS-DETECTOR-FALSE-POSITIVE`). ⛔ **R-2 — an UNDER-GRANT REGRESSION this
  increment introduced**: the F-5 seam deletion dropped the `|| effectiveCanEditMeta` disjunct that
  carried an administrativo's **custom-field** editing, which `update_case_custom_field_values`
  genuinely grants (`is_staff_admin_of ∨ member_can('create_cases')`) — door grants it, no surface
  offered it. **No signature: no `42501`, no log, no failing test**; nothing in 8 lint gates, pgTAP,
  4 ARMs or a green `e2e:prod` could catch it. ⛔ **R-3** — F-1's approval existed only in a commit
  body (recorded below). **Both blockers fixed** (tester hoist; frontend mirrors the door on the
  manage host, over-grant twin run both directions).
  **✅ r3 APPROVED 2026-08-21** — both r2 blockers verified closed independently; gate re-run **clean
  at `e7ec7529`** (every figure re-measured on that tree, none reused). **§6 steps 1–3 COMPLETE.**
  ⛔ **Step 4 (PO approval) NOT SOUGHT YET; nothing merged; `main` unchanged.** r3 attached four
  conditions, all **Record-edit** and none blocking merge — all four now discharged: the fixture-gap
  measurement is filed (`FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE`, stated as *one
  disjunct unreachable*, **not** “no coverage”), the detector FUP now requires **both** directions,
  this bullet's drift is corrected (**third** occurrence, this time in the safe direction), and
  PROGRESS.md was rotated **before** this edit (it had 1,119 bytes of headroom — gate 7 would have
  redded on the very edit recording completion). **Increment 2 NOT started.**
  ⚠ **Scope note:** the gate figures describe **`e7ec7529`**; HEAD is `121748fe`, which — despite a
  `docs:` message — also carries the 21-line QA §8.4 backstop (lead committed with `git add -A` while
  `frontend` was mid-edit). At HEAD: lint/`tsc`/vitest **re-measured**, the three case specs
  **re-measured** (41 p, exit 0), pgTAP + the 4 ARMs **unaffected by construction** (empty
  `supabase/` diff), full `e2e:prod` **NOT re-run** — the change is provably the **identity** on
  every reachable path (3 premises enumerated, not asserted: two mount sites, one passes
  `managementElsewhere`, no unit test renders it). ⛔ An **argument**, not a measurement, and **not a
  precedent** for reporting an unmeasured tree as gated — detail:
  [test-run-archive.md](test-run-archive.md).
  ⛔ Nothing merged; `main` unchanged.
  **✅ F-1 APPROVAL SCOPE — PO-ruled 2026-08-21, written down here because it authorized a NEW ROUTE and previously existed only in a commit body** (QA r2 **R-3**; their positive control: OPEN-4, ruled in the same commit, appears 8× across ADR/plan/tracker — F-1 appeared **0×**). The ruling: **narrow the `/casos` narrative route's two case-wide arms AND build a manage narrative host**, so they relocate rather than vanish. **Authorizes:** the narrowing, the new route `manage/cases/[caseId]/narrativa/[narrativeId]`, and its E2E. **Does NOT authorize:** touching the assignee arm (name-attributed work stays on `/casos` — ADR 0033 Q14), any other new route, or a D1 exception. ⚠ In a program whose own § Now header reads *“Approval scope, written down because it is a new fact”*, this one was not — the lead recorded OPEN-4's scope thoroughly and the same commit's other ruling not at all.
  ⚠ *This line previously read "T6 specs NOT written and no `e2e:prod` run" — stale from the moment
  the gate ran, contradicted by the Test Run Summary in this same file, and caught by QA (F-2), not
  by any gate. `lint:progress` cannot see a claim that has gone false.*
  **Approval scope, written down because it is a new fact:** ADR 0134 **D11 explicitly withheld
  build start** from the 2026-08-21 design ratification ("implementation happens in a future
  session, per the PO"). The PO gave the build go **2026-08-21, this session**, with the agent
  team authorized. **That go covers exactly:** creating the branch and executing the plan's
  Step 0 + Increments 1–2 locally. **It does NOT cover** — remote `db push` (standing
  discipline, unchanged), merge to `main` (a separate PO call per increment), any widening
  beyond D6's read-only S8 arm.
  **✅ OPEN-1 RULED by the PO 2026-08-21: NO BACKFILL.** Existing administrativo appointees do
  **not** receive `read_cases`; the coordinator opts in per appointee. `seed.sql` still grants it
  explicitly to `staff2.ccih` (a fixture decision — update the seed header roster note in the same
  change). Increment 2's M1 is unblocked.
  **✅ OPEN-2 RULED by the PO 2026-08-21: ALLOW BULK CREATION UNDER THE SAME `create_cases` KEY** —
  *"an `administrativo` role is granted to a responsible healthcare professional; creating many
  cases carries the same logical responsibility as creating one."* The PO was shown the magnitude
  argument (one case vs. up to 200 atomically + assignment, and that reusing the key silently
  changes the reach of every checkbox already ticked) and ruled **against** a separate sixth menu
  key. ⛔ **This is a WIDENING of administrativo WRITE authority, which ADR 0134 D11 had placed
  outside the ratified scope — so this ruling EXTENDS D11's scope and AMENDS D5**, and needs an
  ADR 0134 amendment rather than living only here. Work lands in **Increment 2** (it is a DB
  change; Increment 1 has none): a `member_can('create_cases')` arm on `bulk_create_cases`
  routed through the flag-aware chokepoint so the `administrativo` kill switch darkens it, its own
  pgTAP differential incl. the over-grant twin, then `multiplos` + the "Múltiplos casos" link
  re-gate onto the capability. ⚠ **That supersedes Increment 1's T4 narrowing** — T4 was correct
  when shipped (the door refused the capability; the route must not out-run the door) and is
  reversed only once the door admits it. Sequence, not flip-flop.
  ✅ **OPEN-3 — RESOLVED BY MEASUREMENT 2026-08-21: Rule 12 HOLDS, no change needed.**
  `set_participant_patient` is `SECURITY DEFINER` with a **single** authority branch,
  `app.is_staff_admin_of` — an administrativo with **all four** capabilities and a per-case
  write-grantee are **both REFUSED**, so **door 2 cannot become a PHI-write widening**. The
  conditional dead-end it left (PHI call is step (d) of the per-row loop, whole batch rolls back on
  a patient-collecting template) became **OPEN-4**, ruled below. Full measurement + the dead-end
  analysis rotated verbatim 2026-08-21 → [decisions-log.md](decisions-log.md).
  **✅ OPEN-4 RULED 2026-08-21 — OPTION D** (ADR 0134 **Amendment 2**, PROPOSED → **ACCEPTED**).
  Authorizes exactly §A2.7's "yes on D" list — the A2.2 split-writer mechanism, its migrations, the
  A2.5 test bill and the A2.6 record updates — **locally**. NOT authorized: remote `db push`, merge
  to `main`, PHI **read** in any form, PHI write outside the creation path, changes to
  `dispose_case_phi` or the xref gates. **Increment 2 work; does not start until Increment 1
  gates.** ⚠ Keystone `189_bulk_create_cases.sql:153` must be **inverted deliberately**, new intent
  stated in its header; A2.6's record updates (incl. **CLAUDE.md Rule 12**) ship in the **same
  commit**; A2.4's four residual risks are accepted explicitly, and risk 2's mitigation (echo the
  written identifiers back so a typo is caught at the keyboard) is **required in the same change**.
  ⚠ *Asked for, not inferred — Amendment 2 was authored as PROPOSED and stated that it authorized
  nothing, so the pointer to it was treated as the analysis, not the approval.*
  ⇒ *Original filing, retained as the record of the question —* **options
  WRITTEN UP as ADR 0134 Amendment 2:** (A) suppress the
  wizard's PHI columns for administrativos, (B) block the capability on patient-collecting
  templates, (C) accept the 42501, or **(D, recommended)** a **creation-scoped** PHI write — entry
  during `create_case*`/`bulk_create_cases` only, still **no read, no edit, no disposal** (the
  overwrite hazard is edit-time only: a case being minted has no participant chain, so the create
  path can only insert). ⚠ D is a **Rule 12 widening** extending D11's scope a second time, and
  its mechanism is binding: an `app._…_unchecked` writer called by the create RPCs — **not** a
  `app.in_case_rpc` GUC gate (22 setters incl. `close_case`/`dispose_case_phi`) and **not** a
  `member_can` disjunct on the public door (which checks the commission, never the caller's tie to
  the case). Ruling needed before Increment 2's door 2 ships.
  ✅ **OPEN-2 — RULED 2026-08-21** (ruling + scope in the IN-BUILD bullet above; ADR 0134 Amdt 1
  §A1.2). The measured **record of the question** — why D5's letter would have built a dead-end door,
  and why the `context.isAdmin` bypass was dead code whose removal no E2E can pin — rotated verbatim
  2026-08-21 at the §7 size cap → [decisions-log.md](decisions-log.md).
