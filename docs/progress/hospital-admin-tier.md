# Phase A — Hospital-admin tier, 4-tier audit & committee titles

> Archived from PROGRESS.md at the §6 Record step (2026-07-03). ✅ **COMPLETE + APPROVED**.
> Branch `feat/hospital-admin-tier`. QA: [review](../reviews/hospital-admin-tier-review.md)
> (CHANGES REQUESTED → all 5 findings fixed). ADR
> [0051](../decisions/0051-hospital-admin-tier-and-hospital-audit-tier.md); design
> [hospital-roles-nsp-titles-design.md](hospital-roles-nsp-titles-design.md) (locked
> decisions 1–10 + 16–19).

**Gate results:** build (typecheck exit 0 · `eslint src` clean · `build` green) ·
`e2e/hospital-admin-tier.spec.ts` **38/38** (prod standalone) · **pgTAP 1454/1454 PASS**
(fresh reset) · full E2E regression **497p/26f → 0 Phase-A regressions**. Bugs
BUG-HAT-001/002/003 (3 BLOCKERs) all resolved en route; QA MAJOR-1/2 + MINOR-1/2/3 all
fixed.

## Task table

| # | Owner | Task | Depends | Status |
| - | ----- | ---- | ------- | ------ |
| A0 | backend | **PLAN + contract-first signatures** — typed stubs in `src/lib/**`. [gate:plan] | – | ✅ `da0abd3` — signatures acked |
| A1 | backend | **Schema** — `organization_members` role widen + nullable `hospital_id` + iff-CHECK + `UNIQUE NULLS NOT DISTINCT`; `commission_member_titles` vocab + `commission_members.title_id`. | A0 | ✅ 2 migrations, applies clean |
| A2 | backend | **Predicates + swap** — `is_hospital_admin_of`/`is_commission_admin_of` (+`_for`); programmatic swap of 56 procs + 87 policies off the LIVE catalog; Q5 two-arm `commissions` rewrite. | A1 | ✅ catalog sweep ZERO residual |
| A3 | backend | **4-tier audit** — chain key `(org,hospital,commission)`; derived `hospital_id` in the hashed tuple; `audit_canonical`+`audit_write`+`verify_audit_chain` lockstep + 4 partial-unique indexes + 4-tier read policy + hospital emitters. | A1 | ✅ all 4 chains verify hash-correct |
| A4 | backend | **Appointment + titles RPCs/actions** — org_admin grants/revokes `hospital_admin`+`nsp_org_admin` (DEFINER, no self-delegation); titles CRUD; `appointNspCoordinator` onConflict fix. Disposal arms got the commission-admin arm via A2. | A2,A3 | ✅ migration + actions |
| A5 | backend | **Seed + pgTAP + types** — org-a 2nd hospital + personas `hospitaladmin.a1@`/`.dual@`/`nsporg.a@`; suites 184/185/186 + 187 sweep + ~5 fixture realigns; types regen. | A1–A4 | ✅ **pgTAP 1433 PASS**; typecheck + eslint src clean |
| A6 | frontend | **Manage area hospital scoping + switcher** — `/o/[org]/manage` renders hospital-scoped content from grants; hospital switcher when user holds several; `?hospital=` deep link. | A0 (stubs) | ✅ built + typecheck/lint/build green — layout/page/comissoes admit hospital_admin via `adminedHospitals`/`listOrgHospitals`/`listManagedCommissions`; `HospitalSwitcher` mirrors `CommissionSwitcher`; `OrgManageNav` hides org-only entries for hospital_admin. |
| A7 | frontend | **Appointment + titles UI** — org_admin appoint hospital_admin/nsp_org_admin; staff_admin titles settings + assignment; title badges on member pages / meeting attendees / signature blocks / atas. | A0 (stubs) | ✅ built + typecheck/lint/build green — `/o/[org]/manage/administradores` (`HospitalAdminManager` + `NspOrgAdminManager`); `manage/settings/titulos` tab (`TitlesManager`, FLIP reorder) + `TitleAssignControl` + `TitleBadge` on member list, meeting attendees, signatures. **A6b: consumed A9 reconciliation** — rosters via `listHospitalAdmins`/`listNspOrgAdmins` (`RoleHolder`), badges/assignment bound to real `memberId`/`titleId`/`titleName`, `MemberWithTitle`/`AttendeeWithTitle` wrappers dropped, `MemberTitle` from `titles-types`. |
| A8 | frontend | **Audit viewer** — hospital-tier chain surfaced to hospital_admin; readers scoped per decision 10. | A3 | ✅ built + typecheck/lint/build green — `/o/[org]/manage/audit` branches org_admin→`listAuditForOrg` / hospital_admin→`listAuditForHospital` + hospital switcher. (`verifyAuditChainAction` `hospitalId` widened by backend `91bff49`; AuditIntegrityCheck passes it through; QA MAJOR-1 removed the stale UI guard in `189ead7` — control now enabled for hospital scope.) |
| A6b | frontend | **Consume A9 reconciliation + hospital-scoped user directory/registration (decision 7 + Q2).** | A9, A10 (stub) | ✅ built + typecheck/lint/build green — Part 1: rosters + real title fields consumed (see A7). Part 2: `usuarios` directory admits hospital_admin via `listHospitalUsers` + hospital switcher; `usuarios/novo` admits hospital_admin with home-hospital LOCKED (read-only display) + hospital-scoped commissions; `usuarios/[userId]` admits hospital_admin with hospital-scoped hospital/commission lists; nav + landing re-show "Usuários" for hospital_admin. |
| A10 | backend | **Hospital-scoped user management (decision 7 + Q2, service-role widening).** `getSessionContext` resolves `hospitalAdminOf`/`nspOrgAdminOf` (self-read RLS arm); `registerUser` + per-user actions admit hospital_admin scoped to its hospital (home hospital HARD-SET server-side, no org roles, no cross-hospital); `listHospitalUsers` real; profiles hospital read arm. Also closed remaining stubs (`listAuditForHospital`, 5 title actions → A4 RPCs). pgTAP 188. | A5, A9 | ✅ **pgTAP 1447 PASS**; typecheck + eslint src clean (0 warnings) |

## Lead notes

### Gate + fix-loop summary
- **BLOCKER fix-loop (converged in 2 iterations):** BUG-HAT-001 (root landing, frontend `9b2a0ff`), BUG-HAT-002 (commission-access seam, backend `18b37af`), BUG-HAT-003 (hospitals/organizations SELECT arms — the upstream cause that starved 001/002, backend `b6338a0` + migration `…000800`). Convergence audit confirmed no HAT-004.
- **BUG-HAT-003 root cause:** `hospitals_select` += `is_hospital_admin_of(id)`, `organizations_select` += `is_org_level_admin_within(id)` (new helper — an org-level admin holds no commission membership, so `is_org_member` didn't cover it). These were the upstream cause that left HAT-001/002 inert (`getSessionContext` embeds dropped → `hospitalAdminOf` empty).
- **QA (CHANGES REQUESTED → all fixed):** MAJOR-1 hospital-tier "Verificar integridade" control wired (frontend `189ead7`; stale `blockedByMissingHospitalSupport` guard removed; tester flipped HA-5 to positive OK-verdict, green). MAJOR-2 cross-hospital `removeCommittee` authz (backend `da1d00d`; now gates on `authorizeForCommission` mirroring `assignCommitteeRole`; pgTAP 188 §7 negative). MINOR-1 `updateUserProfile` home-hospital hard-set (amendment 11). MINOR-2 stale-doc sweep. MINOR-3 revalidatePath repoint (`/c/[slug]` → `/o/[org]/c/[commission]/manage`).
- **⚠️ pgTAP-run note:** run pgTAP on a **fresh `supabase db reset --local`**. Against a DB left mutated by an E2E full-suite run it shows 3 spurious count-assertion failures (`171#37`, `176#22/#24`) from a leftover "Ética" rede-a commission — a dirty-DB artifact, NOT a defect. Clean-reset full suite = 1454/1454.
- **Full-regression triage:** 497p/26f on prod standalone → 24 = pre-existing BUG-AIF-001 (standalone dialog-refresh, human-deferred) + prod-flaky baseline (all green on dev); 2 = stale case-access dropdown specs from the pre-Phase-A `2507e77` refactor, rewired to the dialog flow (`803f775`). **0 Phase-A regressions.**

### Build detail
- **ADR [0051](../decisions/0051-hospital-admin-tier-and-hospital-audit-tier.md)** (Decision 2 phasing corrected — Phase-A CHECK binds only `hospital_admin`).
- **A9 (backend reconciliation) — pgTAP 1436:** rosters `listHospitalAdmins`/`listNspOrgAdmins` (`RoleHolder`), title fields on `MemberListItem`(+`memberId`)/`MeetingAttendee`, A6 read stubs made real, `MemberTitle`→`@/lib/commissions/titles-types`, `server-only` on `titles.ts`; audit-action `hospitalId` closed earlier (`91bff49`).
- **Scope correction — hospital-scoped USER MANAGEMENT is Phase A (decision 7 + Q2).** A6 hid org-only nav from hospital_admin, leaving it with no user directory/invite; decision 7 requires it. **A10 (backend) — pgTAP 1447:** `getSessionContext` resolves `hospitalAdminOf`/`nspOrgAdminOf` (self-read RLS arm on `organization_members` — migration …000500); `access.ts` helpers derive from the real grants; `registerUser` + per-user actions admit a hospital_admin **scoped to its hospital** (home hospital HARD-SET server-side, amendment 11; no org-role assignment; committees limited to own-hospital commissions); `profiles` gained a hospital_admin READ arm (migration …000600, WRITE not widened); `listHospitalUsers` real. **Four new RLS shapes** total (org_member self-read `…000500`; profiles hospital read arm `…000600`; hospitals_select + organizations_select hospital_admin arms `…000800`) — all QA-reviewed minimum-necessary + isolation-preserving. `assign_member_title` p_title_id made nullable via migration …000700.
- **Predicate swap:** must not touch org-level-only sites (`is_org_admin_of(org)` stays). Backend surface reference: [docs/backend-state.md](../backend-state.md).
- **Frontend (A6–A8) contract gaps — ALL RESOLVED via A9 reconciliation, consumed in A6b:** rosters feed the "administradores atuais" panels; `MemberListItem`/`MeetingAttendee` carry real title fields; `verifyAuditChainAction` widened with `hospitalId` (`91bff49`) + control enabled (`189ead7`). Person-picker reuses `listOrgEligibleUsersForPqs` (org_admin-gated) — accepted as-is. `titles.ts` is `server-only`; client-safe type path `@/lib/commissions/titles-types`.

### NOT in Phase A (→ Phase B)
NSP-per-hospital, `nsp_org_admin` PHI-free aggregates/coordinator appointment, dual-hospital
referrals, `dispose_referral_phi`. `nsp_org_admin` is in the role CHECK now (A1) but its behavior
lands in B. ADR 0052 forthcoming.
