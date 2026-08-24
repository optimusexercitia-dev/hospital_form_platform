# NSP-per-org — phase record (archived)

> Rotated from PROGRESS.md 2026-07-02 (§7). ✅ COMPLETE 2026-06-25 (phase table). Design: [nsp-per-org-design.md](nsp-per-org-design.md); ADR [0042](../decisions/0042-nsp-per-org.md). Sub-phase A + B task detail below.

### NSP-per-org — Sub-phase A: Backend security core (✅ QA-APPROVED 2026-06-25)

> Bind the PQS roster + every PHI door to an **organization** so the NSP + referral PHI
> modules work under multi-tenancy (lifts ADR 0041 amendment 10's interim `is_multi_org()`
> guard). **A DONE:** migration `20260630000000_nsp_per_org.sql`; per-org seed; pgTAP
> **1073/1073** (cross-org PHI isolation proven); QA **APPROVED**
> ([report](../../docs/reviews/nsp-per-org-a-review.md)). **7 findings caught + fixed + permanently
> guarded** across 3 fix-loop iterations: BUG-NSP-001 (stale-base referral arity), BUG-NSP-002
> (within-referral PHI-body leak), BUG-NSP-003 (target-list platform arm), M1 (bundle over-grant),
> M2 (dropped-symbol callers `capa_viewer_can_manage`+`capa_kpis`), M3 (`capa_kpis` cross-org
> aggregate scope), I1 (folded-in: `dispose_case_phi` vendor-wall). Three systematized catalog
> checks banked in ADR 0042 (stale-base / missed-door / body-not-scoped). Full spec:
> [nsp-per-org-design.md](nsp-per-org-design.md). Next: sub-phase **B**.

Backend (`backend`):

| # | Task | Status |
| - | ---- | ------ |
| A1 | **Contract-first** typed stubs for new/changed query-layer signatures — DONE. Hermetic per lead ruling: per-org variants under NEW names (`searchPatientForOrg`/`getPatientAccessAuditForOrg`/`getPqsDepartmentForOrg` + `src/lib/pqs/{roster-types,actions}.ts` `addPqsMember`/`removePqsMember`/`setPqsRcaDueWindow(org,…)` + `isPqsMemberOfSelf`/`isNspCoordinatorOfSelf`/`listPqsMembers`); old org-blind names → deprecated throw/return-empty stubs tagged `TODO(nsp-per-org B)`. Whole-tree typecheck green, ZERO FE edits. Plan approved 2026-06-25. | ✅ done (`e84c490`) |
| A2+A3 | Migration `20260630000000_nsp_per_org.sql` (2166 lines) — DONE. Schema (role CHECK widen; `pqs_department`/`pqs_members` per-org + RLS swap) + primitives/helpers; rebound 9 read predicates; 8 CAPA writes via `can_write_capa` (event/rca→per-org, non-event→any-org); org-scoped `pqs_inbox`/lifecycle RPCs/vocab(→any-org)/`dispose_event_phi`(both arms; admin→`is_org_admin_of_commission`); per-org EV mint; flag/assert reversions; roster RPCs→(org,…) coordinator-gated + ORG-tier audit; **patient_index 4th surface** fully org-scoped; **forbid cross-org referrals**; dropped `is_multi_org`/`is_pqs_member`/`is_pqs_writer` last. Validated: full migration parses+executes clean in a rollback txn (drop-order proven). | ✅ done (`14ac673`) |
| A4 | Seed — DONE. 4 personas (`nspcoord.a/.b`, `pqs.a/.b`); per-org `nsp_coordinator` org-members (unenrolled → curate≠read); 2nd rede-b commission (Farmácia B); `pqs_department` 2 rows (rede-a 45d / rede-b 30d); per-org `pqs_members`; rede-b event+`event_patient` (PRT-B-0001) + intra-rede-b referral+`referral_patient` sharing the MRN. `db reset --local` clean. | ✅ done (`faa3ce4`) |
| A5 | Types + whole-tree typecheck/lint — DONE. Regenerated `database.ts` (new per-org signatures); `npm run typecheck` green; `npm run lint` 0 errors (1 benign unused-mapper warning). **pgTAP NOTE for tester A6:** targeted single-org suites do NOT pass as-is — but ALL failures are mechanical **fixture/signature mismatches** (the per-org `pqs_members` insert + `pqs_department` row + changed RPC arities), NOT behavior regressions (DB probe proves isolation works). A6 surface is bigger than just `173`: also `145` (rewrite) + a 1-line `organization_id` fixture fix in `140/141/142/143/150/151/152` + signature updates in `141`(`set_pqs_rca_due_window`)/`145`(`add_pqs_member`/`is_pqs_member`)/`152`(`search_patient_xref`). | ✅ done (`faa3ce4`) |

Tester (`tester`) — sub-phase A gate (spawn after A2–A4 land):

| # | Task | Status |
| - | ---- | ------ |
| A6 `[gate]` | Rewrite `173_multi_org_phi_guard.sql` → `173_nsp_per_org_isolation.sql` (mirror `171` personas). Keystone: org-A NSP member reads org-A event/referral/patient PHI, gets zero/null/false on org-B's across EVERY door; coordinator curates-but-can't-read-until-enrolled; org_admin can't curate; per-org EV; `patient_safety_enabled()`/`referrals_enabled()` now true with 2 orgs. Full pgTAP suite green; update total in `docs/backend-state.md` | ✅ **GREEN (iteration 3)** — `173` 53/53 + `145` 34/34 (restored §H event PHI-door matrix) + within-module guards: `150` BUG-NSP-002 (+4), `152` §M1 bundle-bypass (+4, mutation-proved), `143` §M2 (+3) + **§M3 result-scope (+4, mutation-proved)**, `151` §I1 dispose gate (+3), NEW `175` dropped-symbol sweep (4). **Full pgTAP suite 1073/1073 on fresh `db reset`** (39 files). BUG-NSP-001/002/003 + QA M1/M2/I1/M3 all fixed (`ecf40e1`, `19bb30a`, `5f4baf5`) + re-verified + RESOLVED. ⚠ `docs/backend-state.md` pgTAP total still stale ("full **1029**", line 65 MT row + the NSP row) — actual now **1073**; tester scoped to `supabase/tests/**` → flagged for backend/lead, not edited. |

### NSP-per-org — Sub-phase B: FE route-move + un-quarantine E2E (🏗️ in progress)

> A is QA-approved; the per-org doors + A1 contracts are live. **Decisions (human, 2026-06-25):**
> NSP console = standalone **`/o/[org]/nsp/**`** (per-org PQS-membership-gated); roster-curation UI
> lives **inside the NSP console** (coordinator-gated). org_admin *appoints* the `nsp_coordinator`
> in the org-admin members UI. Reuse the ~63 safety + 12 referral components; build against the A1
> contracts (no provisional shapes).

> **Backend support landed (`8fc63be`, on `feat/nsp-per-org`):** (1) **`getNspAccessByOrg(orgSlug)`** is
> implemented in `session.ts` — `{ context, organization, orgId, isPqsMember, isCoordinator }`,
> returns `null` only when BOTH booleans false (an unenrolled `nsp_coordinator` IS admitted to curate;
> PHI stays enforced at the data doors). The A1 probes `isPqsMemberOfSelf`/`isNspCoordinatorOfSelf` are
> now live. Required an **additive `organizations_select` RLS broadening** (+`is_pqs_member_of`/
> `is_nsp_coordinator_of`) so a bare PQS member/coordinator reads their own org row — else the seam 404s
> the very user who needs it (same pattern as `…628000`'s `is_org_member`; cross-org still denied).
> (2) **Security verify (FE's referral-dashboard concern): NOT a leak.** `listAllReferrals`/
> `referralFlowMetrics`/the `safety-events` lists read via the **invoker/cookie client** under RLS
> (`can_read_referral`/`can_read_event`, rebound per-org in A) — `is_pqs_member_self()` is only the
> render-gate. Live probe: `pqs.a` reads zero rede-b referrals/events. FE may client-filter the per-org
> view; no backend fix needed. (Differs from the M3 `capa_kpis`/`pqs_inbox` DEFINER aggregates, which
> bypass RLS and DID need body-scoping.)

Frontend (`frontend`):

| # | Task | Status |
| - | ---- | ------ |
| B1 | **`getNspAccessByOrg(orgSlug)`** seam (backend landed it in `session.ts` to the agreed signature) + `/o/[org]/nsp/layout.tsx` gate + **moved the 8 `/admin/nsp/**` pages → `/o/[org]/nsp/**`** (inbox/triage/event/rca/capa/encaminhamentos/pacientes/config) via `git mv` (history preserved). Added `nspHref` to `src/lib/routing.ts`; new `NspConsoleNav` (PHI nav gated on `isPqsMember`, "Equipe do NSP" on `isCoordinator`). Rewired the `isAdmin`→`getNspAccessByOrg` gate on all 8 pages + `listCommissionsForAdmin`→`listCommissionsForOrg(orgId)` (inbox/triagem). Threaded `org` through 8 nav components (`pqs-inbox-list`, `triage-workstation`, `capa-{header,plan-card,stage,workspace}`, `rca-{header,workspace}`, `trajectory-{table,result}`, `patient-search-view`). Removed the dead NSP entry from `src/app/admin/layout.tsx`. **Gating model corrected:** PHI pages do NOT 404 a non-enrolled coordinator (the data doors return empty → "sees it empty" per the decision); only `!access`→404 + the natural `null`→404 on detail pages. `/encaminhamentos`+`/pacientes`+`/configuracoes` data-wiring left as **`TODO(B2)`** with the settled contracts captured inline. **Verified:** typecheck/lint(0 err)/`next build` clean (8 routes registered, `/admin/nsp` gone); preview-smoke proved member sees PHI-nav+data, coordinator sees Equipe-nav+empty-inbox, `pqs.a`→`/o/rede-b/nsp`=404. **2 items flagged to lead** (below). | ✅ done |
| B2 | DONE + committed (`f9271d8` + `/pacientes` completion in `866e67c`). `/encaminhamentos` client-filters to `access.orgId` (via `listCommissionsForOrg`) + derives metrics from the filtered set (`deriveFlowMetrics`); `/configuracoes` → `getPqsDepartmentForOrg`+`RcaWindowForm`→`setPqsRcaDueWindow(orgId,…)`; `/pacientes` → `searchPatientAction(orgId,…)`/`loadPatientAccessAudit(orgId,…)`; + in-shell `not-found.tsx`. The 7 backend stub bodies (flagged note ⓵) are now **all implemented** (`1bd473a`) → all 3 pages verified rendering real data (`/configuracoes` shows rede-a 45d window; `/pacientes` search view; `/encaminhamentos` org-filtered). | ✅ done |
| B3 | DONE + committed (`866e67c`), built contract-first against the per-org signatures (backend implemented bodies in lockstep). **(1)** "Equipe do NSP" roster `/o/[org]/nsp/equipe` (coordinator-gated): `PqsRosterManager` list/enroll(`addPqsMember`)/remove(`removePqsMember`) from `listOrgEligibleUsersForPqs`. **(2)** Coordinator-first landing: `isCoordinator && !isPqsMember` on the inbox → `redirect(/equipe)`. **(3)** Focused appoint surface `/o/[org]/manage/equipe-nsp` (org_admin-gated, flag-gated) — `NspCoordinatorManager` appoint(`appointNspCoordinator`)/revoke(`revokeNspCoordinator`)/list(`listNspCoordinators`); wired into the manage card-grid + `OrgManageNav`. **Verified end-to-end on real data:** org_admin appoints Chefe CCIH → coordinator enrolls them → Chefe CCIH reads the PHI inbox (3 events). typecheck/lint(0 err)/`next build` clean. | ✅ done |
| B4 | ✅ done — backend deleted the 4 orphaned org-blind stubs + docstring cleanup (grepped-first, zero callers; `15a4d83`); the old `/admin/nsp` group was removed by B1's `git mv`; commission-level `eventos\|encaminhamentos` surface verification folded into B5's E2E un-quarantine. | ✅ done |

> **B-support landed beyond the B1 seam** (all on `feat/nsp-per-org`): `revalidatePath('/admin/nsp')`→`revalidatePath('/o/[org]/nsp','layout')` in the 5 action files (`8fa8de7`, Context7-verified); the **7 unimplemented A1 TS stub bodies** filled (`1bd473a`) — they typecheck-passed A's gate as throwing stubs and surfaced only at B-runtime (lesson: typecheck ≠ runtime); the **appoint flow** (`listOrgEligibleUsersForPqs` DEFINER RPC + `appoint/revokeNspCoordinator` + `listNspCoordinators` + canonical `PqsEligibleUser`); the **orphan-the-org appoint guard** (`1a820bc` — appoint refuses to demote an `org_admin`; `org_admin`/`nsp_coordinator` now mutually exclusive per user). _(Session-limit pause 2026-06-25 resolved; B1–B4 complete.)_

Tester (`tester`) — sub-phase B gate (spawn after B1–B4 land + dev server runs):

| # | Task | Status |
| - | ---- | ------ |
| B5 `[gate]` | Un-quarantine the **124 `MULTI_ORG_PILOT_SKIP`** specs (8 files: `phase14a/b/c/d`, `phi-remediation`, `patient-index`, `phase22-referrals`, `case-patient`); re-home to `/o/[org]/nsp/**` + per-org NSP personas (`pqs.a/.b`, `nspcoord.a/.b`); **add cross-org E2E** (org-A NSP user cannot reach org-B's console/PHI) + verify the commission-level `eventos\|encaminhamentos` surfaces un-inert; **new pgTAP guards** (`organizations_select` PQS/coordinator broadening · `list_org_eligible_users_for_pqs` · `appointNspCoordinator` refuses org_admin). Full pgTAP green; un-quarantined E2E green (fresh reset, `--workers=1`, chromium); lead runs the full E2E suite to declare. | ✅ **TARGETED-GREEN** — all 8 specs re-homed + green: 14a 16/16 · 14b 13/13 · 14c 17/17 · 14d 19/19 · phi-remediation 22/22 (+2 seed-gap skips) · patient-index/case-patient green · **phase22 29/29** (BUG-NSP-005 fix `9c53035` verified). NEW `e2e/nsp-cross-org-isolation.spec.ts` **10/10**; NEW pgTAP `176_nsp_per_org_b_support.sql` **29/29** (incl. §D commissions_select broadening + keystone negative, mutation-proved); **full pgTAP 1102/1102** on fresh reset. Both B-phase bugs (NSP-004/005) fixed + re-verified + guarded. **Lead runs the full E2E suite to declare the gate.** |

> Then: whole-phase **QA** → **human approval** → **Record** (§6). The A-core QA report
> ([nsp-per-org-a-review.md](../../docs/reviews/nsp-per-org-a-review.md)) covers the backend; B QA covers the UI + E2E.

