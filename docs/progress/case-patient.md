# Archive — `case_patient` (third PHI module; ADR 0038)

> Archived verbatim from PROGRESS.md on 2026-06-25 at the §7 progress-tracker cleanup.
> This is the durable detail; PROGRESS.md keeps only a one-line pointer.

### Feature — `case_patient` (THIRD PHI module; ADR 0038) — ✅ COMPLETE

> **Gate APPROVED** — Build ✅ · E2E `case-patient.spec.ts` **15/15** (all 8 ACs) + full suite
> **green, zero regressions** · QA **APPROVED** ([docs/reviews/case-patient-review.md](docs/reviews/case-patient-review.md),
> 0 blockers/0 majors) · Human ✅ 2026-06-22. Feature code on `feat/case-patient` (`2accca7`); flag
> `case_patient` **ON** in local + remote (deployed 2026-06-22 — migrations `…017000`+`…018000` pushed; local↔remote in sync 18/18). ADR
> [0038](docs/decisions/0038-case-patient-identifiers.md); ARCHITECTURE Rule 12 (two→three PHI
> modules). Out-of-scope follow-ups (tracked, non-blocking): `dispose_referral_phi` parity gap;
> CN-APP-AC4 (pre-existing narrative-save re-render on the prod standalone build) — **RESOLVED 2026-06-23** (optimistic render in `case-narrative-card.tsx`; verified RED→GREEN on the prod build). See Bug Log.

Backend (`backend`):

| # | Task | Status |
| - | ---- | ------ |
| BE-1 | Migration `20260620017000_case_patient.sql` (flag OFF, `cases`/`process_templates` cols, isolated `case_patient` table + RLS + REVOKE, audit trigger `{}`, `log_audit_access` replace = full allow-list + `case_patient.read`, `can_read_case_patient` wrapping the LIVE broad `can_read_case`, `set`/`get`/`dispose`/`set_template_collects_patient`, `create_case_from_template` + `get_case_detail` replaces, grants) + pgTAP `151_case_patient.sql` | ✅ local-green — migration applies clean on `db reset`; pgTAP **35/35**; full suite **PASS** (referrals/audit/case_access regression green) |
| BE-2 | TS layer — NEW `src/lib/cases/types.ts` (client-safe); `Case`/`CaseDetail` + all 3 mappers + `getCasePhaseForFill`/`process-templates` selects (`hasPatient`/`patientEnabled`/`collectsPatient`); `getCasePatient` + `casePatientEnabled` probe; actions `setCasePatient` (name-or-MRN floor) / `revealCasePatient` / `disposeCasePhi` / `setTemplateCollectsPatient` / `loadCasePatientForNotify`; generalized precedence-aware `getCaseSafetyEventPatientPrefill` (`case_patient` preferred, event fallback) + `loadCaseSafetyPrefill` bridge | ✅ local-green — types regenerated (`--local`); `typecheck` 0, `lint` 0 errors, `vitest` 34/34 |

Frontend (`frontend`):

| # | Task | Status |
| - | ---- | ------ |
| FE-1 | Builder toggle + Novo-caso PHI block — NEW `CollectsPatientPicker` (draft-only switch → `setTemplateCollectsPatient`, rendered like `ProcessOutcomesPicker`); threaded `collectsPatient` + `casePatientEnabled` through `template-builder-shell` + builder page. `create-case-dialog`: `TemplateOption.collectsPatient` + `casePatientEnabled` prop, controlled template select, conditional **reused** `PatientFields` block (safety), post-create `setCasePatient` (non-blocking) before navigation, reworded label warning (now about the *label* only); board page passes `collectsPatient`/flag to both dialog instances | ✅ local-green — `lint` 0 errors, `typecheck` 0; flag-ON server render verified (board + Novo caso enabled). `frontend-design` applied |
| FE-2 | Case-detail reveal panel + edit dialog — NEW `case-patient-panel` (near-copy of referral panel; reveal-on-demand, softened "denied" copy for the broad read scope) + NEW `case-patient-edit-dialog` (coordinator-only; reuses `PatientFields`; pre-fills from a fresh `revealCasePatient` read; `setCasePatient` floor error surfaced). Bound `revealCasePatient`/`setCasePatient` in `case-detail-view` (shared by both detail pages); mounted in the rail; gated on `patientEnabled` (panel) + `hasPatient` (body); edit gated on `canManageLifecycle`. Threaded `casePatientEnabled` from both host pages | ✅ local-green — `lint` 0, `typecheck` 0; flag-ON server render verified (panel + reveal/edit affordances present, correct coordinator gating); door verified via SQL (`can_read_case_patient`=t, `get_case_patient` returns payload). `frontend-design` applied |
| FE-3 | Referral wizard + notify prefill — wizard `SafetyEventPrefill` widened with `source: 'case'\|'event'`; patient-step caption + button keyed on `result.source` ("…do caso" vs "…do evento"). Notify dialog/`EventNotifyForm`: optional `onLoadPatientPrefill` seeds the `PatientDraft` from `loadCasePatientForNotify` on dialog open (mount-time audited read), with a "pré-preenchido a partir do caso" caption; `case-detail-view` binds it only when the case collects PHI | ✅ local-green — `lint` 0, `typecheck` 0 |

> **Smoke-test note (FE-1/2/3).** Flag flipped ON locally (`app.feature_flags`); seed template set
> `collects_patient=true`, case #1 set `patient_enabled/has_patient=true` + a `case_patient` row.
> Server-side render is correct on all surfaces (panel renders with reveal + coordinator-edit
> affordances; board + Novo caso enabled) and the audited door returns the payload for the entitled
> coordinator (verified by direct RPC SQL). Interactive click-through could NOT be exercised on the
> **dev** server — React never hydrated this session (`__reactFiber$`/`onClick` absent; persists across
> reload; Next 16 + Turbopack dev quirk, matches the `e2e-prod-build` memory note). Full interactive
> click-through (reveal, dialog open, prefill apply) is the tester's job (task #7) against a **prod
> build**; a local prod build smoke is in progress.

> **Verify-local only (not pushed to remote).** Background-agent `supabase db push` is auto-denied;
> the remote deploy is a separate user-authorized step. Left uncommitted on `feat/case-patient` for
> lead review (PHI / SECURITY DEFINER path).
>
> **Contract handoff to `frontend` (FE-1/2/3):** new exports in `src/lib/cases/types.ts`
> (`CasePatient`, `SetCasePatientInput`, `CasePatientSex`, `CASE_PATIENT_SEX_LABELS`,
> `PhiDisposeReason`, `CASE_PHI_DISPOSE_REASON_LABELS`); `getCasePatient(caseId)` +
> `casePatientEnabled()` in `queries/cases`; `setCasePatient` / `revealCasePatient` /
> `disposeCasePhi` / `setTemplateCollectsPatient` / `loadCasePatientForNotify` in `cases/actions`;
> `Case`/`CaseDetail` gain `hasPatient` + `patientEnabled`; `ProcessTemplate` gains
> `collectsPatient`. The referral prefill `loadCaseSafetyPrefill` now returns a `CaseSafetyPrefill`
> **structural superset** (`source: 'case'|'event'` added; `eventId` kept non-null) — existing wizard
> compiles unchanged; FE-3 reads `source` for the "a partir do caso" caption (additive).

---

**Previous increment (complete; remote `db push` ✅ applied 2026-06-21): PHI / HIPAA-Readiness Remediation** — owner-approved plan from an
external-consultant DB review (2026-06-20). Owner agreed with all findings EXCEPT M1
(action-item triplication — `case_action_items` / `meeting_action_items` / `capa_action`
kept as-is) and authorized a full local DB reset. Backend owns code/migrations; lead owns
the prose-docs workstream (clean file-ownership split).

| WS | Scope | Owner | Status |
| -- | ----- | ----- | ------ |
| 0 | Squash ~90 migrations → domain-partitioned baseline; prove `db diff` no-diff before any delta | backend | ✅ complete — 86→12 files, no-diff gate passed (pgTAP 619/619, types byte-identical) |
| A | `event_patient` lockdown (P0): real `pqs_members` (drop `is_admin` fallback) + tighter `can_read_event_patient` + single-door audited `get_event_patient` RPC + REVOKE direct DML (fully RPC-only) + sever admin from NSP PHI policies | backend | ✅ complete — pgTAP 641/641, `db diff` clean, intended-delta-only, types +58 additive. (RCA-*write* severance ruled in → round 3) |
| B | Audited free-text `*.viewed` detail reads (6 verbs) + reclassify **22** free-text cols as PHI (P0) | backend (code) / lead (docs) | ✅ complete — `.viewed` emits in 6 detail reads, 22 column COMMENTs, allow-list + TS unions; classification docs in Rule 11/12 + ADR 0036 |
| C | `dispose_event_phi` controlled PHI-disposal RPC (LGPD erasure ↔ CFM retention) (P1) | backend | ✅ complete — delete/null/redact PHI, preserve skeleton+custody+audit, constrained-category `reason`, one-shot `HC056`, audit-PHI-safety proven |
| D | Docs: encryption-claim strike (H1) + LGPD/ANVISA/CFM ADR 0035 (H5) + CLAUDE.md framing + free-text-PHI classification + hardening ADR 0036 | lead | ✅ complete — ADR 0035 + 0036, ARCHITECTURE Rule 11/12 rewrite, CLAUDE.md §1+§3, ADR 0030/0031 pointers |
| E | Efficiency (P2): M2 shared vocab helpers, M3 index verify, M4 `capa_plan.source` growth note | backend | ✅ complete — M3 verified (all idxs present), M4 comment added, M2 **deferred** (dynamic-SQL net-negative, documented) |

> **✅ BUILD COMPLETE (2026-06-20)** — all workstreams (0, A, B, C, D, E + the RCA-write severance
> ruled in mid-stream) landed. Backend final state: **pgTAP 665/665, `db diff` clean (90→12 baseline),
> types +93 additive, lint/typecheck/unit green, 10 personas seeded — all LOCAL (no push)**. Docs:
> ADR [0035](docs/decisions/0035-lgpd-anvisa-regulatory-posture.md) (regulatory posture / encryption
> declined), ADR [0036](docs/decisions/0036-phi-access-hardening.md) (PHI access hardening),
> ARCHITECTURE Rule 11/12, CLAUDE.md §1+§3. **Next: §6 Phase Gate → Test pass (`tester`) → QA review
> (`qa`) → human approval → owner-run remote `db push` → Record.**
>
> **Open follow-ups for the FRONTEND backlog** (logged, not in this remediation): a `pqs_members`
> management UI (admin enrols PQS staff; today via `add_pqs_member` RPC); NSP-route gating on
> `is_pqs_member` for a tailored "não autorizado" (today a non-PQS admin gets a clean 404); a
> "Descartar dados do paciente" disposal UI (reason-category `<select>`, calls `disposeEventPhi`);
> input helper-text discouraging PHI in `*.title` fields.

> **🧪 TEST GATE — lead-run (2026-06-20).** The `tester` background agent was lost twice to host-process
> restarts, so the lead ran the §6 E2E pass directly (serial `--workers=1`, clean DB per chunk).
> **Remediation PASSES:** acceptance `phi-remediation.spec.ts` **9 passed / 2 skipped** (rca/capa `.viewed`
> — no seeded RCA/CAPA on EV-0001; pgTAP-covered); NSP `audit + 14a–d` **91/91**; core platform
> (`home`/`auth`/`admin`/`builder`/`wizard`/`signoffs`/`cases`/`dashboard`/`outcomes`/`meetings`/
> `interviews`/`timeline`/`case-access`/`narratives`) **green**. Backend pgTAP **665/665**, `db diff` clean.
> **Infra note (NOT a code defect):** `npm run start` (= `next start`) is wrong for this `output: standalone`
> build — it mishandles Server Actions and collapses under parallel workers; the gate must run against the
> **dev server** (Playwright-managed `webServer`) or `node .next/standalone/server.js`, never a long-lived
> `next start` (which also dies at the 10-min background-task cap). **One known failure —
> `phase7-cases AC-HappyPath`:** a flaky/stale *pre-existing* legacy assertion (navigates to `/minhas-fases`,
> which redirects to `/meus-casos` under the shipped `case_access`-ON flag) — **NOT a remediation regression**
> (zero case-workflow code changed; flag end-state correctly preserved). Logged as a tester follow-up.

> **§6 GATE: ✅ COMPLETE.** Build ✅ · Test pass ✅ · QA ✅ **APPROVED** (0 blockers, 0 majors, 2 INFO —
> `docs/reviews/phi-remediation-review.md`) · Human ✅ **approved 2026-06-21** → recorded (this commit).
> **Remote `supabase db push` ✅ APPLIED 2026-06-21 (owner-run).** The squash baseline + PHI-remediation
> deltas + the Phase 22 referral migrations (`…013000–016000`) are all on remote now; `database.ts` already
> matches (regenerated from the same migrations). The `case_referrals` flag is now **✅ ON in remote/prod**
> — flipped 2026-06-21 via `supabase db query --linked` (`UPDATE app.feature_flags SET enabled = true WHERE
> key = 'case_referrals'`); **Phase 22 is live**, with `audit_trail`/`case_access`/`patient_safety` confirmed
> ON alongside it.

**Previous increment (complete): Case Access Control & "Meus Casos"** — plan
[docs/phases/case-access-control.md](docs/phases/case-access-control.md), ADR
[0033](docs/decisions/0033-case-access-control.md). Human-approved kickoff 2026-06-19 (DB reset +
interviews-deferral authorized). Phase 14 (Patient-Safety / NSP) complete (14a `984e787`, 14b–d
`c4e20b3`); Case Narratives increment FE done (below).

