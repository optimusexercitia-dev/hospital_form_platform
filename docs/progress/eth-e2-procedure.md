# ETH·E2 — Ethics disciplinary procedure (S4, gate unit 1) — ✅ COMPLETE

**Gate passed + human-approved 2026-07-18; ff-merged to `main`.** Branch `feat/eth-e2-procedure` (base `c318cc1`).
Rotated out of PROGRESS.md at Record. ADR [0073](../decisions/0073-ethics-procedure-model.md) (see its **As-built**);
build plan [`docs/phases/ethics-e2-procedure.md`](../phases/ethics-e2-procedure.md); QA report
[`docs/reviews/eth-e2-review.md`](../reviews/eth-e2-review.md).

Reconciled to ADR [0078](../decisions/0078-authorization-capability-model.md) before build (SQLSTATE `HC0F·`→`HC0J·`;
hearings as `participants_only` meetings, no meeting-policy rewrite; `legal_privileged` decision letter → Stage E, not
rendered; the 5 coordinator app-actions wired). Migrations `20260817000000`–`…000700`; pgTAP `253`–`259`; SQLSTATE `HC0J·`.

## Build (backend BE-1…BE-11, all mutation-proven at authz seams)

| Task | Commit | Notes |
|---|---|---|
| BE-1 contract stubs | `ada4c97` | §2 typed contract (queries + `ethics/actions.ts` + types); 5 gaps → lead rulings |
| BE-2 intake tables | `d4f47ba` | `ethics_case_details`/`ethics_allegations`(+cat)/`ethics_findings`; flag OFF; pgTAP `253` 23/23 |
| BE-3 decisions/votes | `d40672e` | `case_decisions`/`ethics_decision_details`/`case_votes`; `cast_case_vote` `HC0J4/5`; `254` 25/25; mutation RED-proven |
| BE-3b D13 targeted door | `5ff03e1` | `target_case_response`/`submit_targeted_case_response` `HC0J9`; `255` 26/26; supersedes D10; 2 findings blessed |
| BE-4 notices/hearings/appeals | `54ce537` | `schedule_ethics_hearing` = `participants_only` meeting door (roster-then-flip); `256` 21/21 |
| BE-5 M2 retention | `04d9f62` | pin trigger + `redact_professional_profile` `HC0J7`; `app.in_redaction_rpc` GUC; `257` 18/18 |
| BE-6 HC0J RPC surface | `8b8e68d` | admissibility/allegations/findings/decision/issue/notif/hearing/appeal; authority-first `HC0J1`, quorum `HC0J8` fires pin; `258` 28/28 |
| BE-7/8/10 batch | `2c9314e` | N ethics scan arm (`259` 9/9); `get_ethics_case_procedure` read; 5 coordinator app-actions (`setCaseVisibility` created) |
| BE-9 flag flip | `22e7d34` | `ethics` ON **seed-only** (`seed.sql:1989`; no migration enables it → remote OFF); PHI-free fixtures on case `…-e1` |
| BE-11 action wiring | `0972ed0` | wired the 27 procedure actions → RPCs + `mapEthicsError`; added `listEthicsSanctionTypes` + `listCaseRecusals` (contract gap the lead missed, caught by FE via the frozen contract) |
| FE UI | `c1f2e33`+`3d1315a` | coordinator-gated "Processo ético" tab (ethics-typed only) + 8 panels + 5 controls; pt-BR; sanitized MD |
| E2E | `3d75ddd` | `e2e/ethics-e2-procedure.spec.ts` 20/20 (2× fresh reset); keyboard-only vote; zero cross-spec contamination (E1 13/13 on same DB) |
| QA | `2adb169` | **APPROVED** — 0 P0/0 MAJOR/1 doc/3 info; crux verified live under `set local role` |

## Test gate (Phase Gate §6.2) — green

- Ethics E2E 20/20 twice; full `npm run e2e:prod` = 638 pass / 66 fail raw, **all 66 lead-triaged to infrastructure
  flakiness — 0 deterministic E2 regression.** Batches 3/5/9 = Windows server batch-collapse (`ERR_CONNECTION_REFUSED`);
  isolated small-batch re-run = 221 pass / 0 connection-refused, ethics-e2 20/20 + all blast-radius green. Residual 7 in
  `notifications.spec.ts` = GoTrue login rate-limit at its `open_capa_plan` setup (root-caused: the exact path returns
  HTTP 200 directly; `phase14d-capa` 104/104 uses the same REST call; E2 touches neither auth nor capa). See
  [[e2e-prod-build-flaky-baseline]].
- Pre-existing (NOT E2): 8 `authz_p0` pgTAP failures in files 250/251/252 (run before ethics 253–259; base-parity proven).

## QA verdict (`docs/reviews/eth-e2-review.md`) — APPROVED

Audited against the **live catalog** on a fresh reset, every crux door exercised as a real caller under `set local role`
+ JWT (rows read/written, not predicate returns): 36 ethics DEFINER doors `prosecdef=t`/owner postgres/anon-revoked;
non-vacuity proven live (`cast_case_vote` authority `42501` *before* exclusion `HC0J5`; `issue_decision` `HC0J1` before
`HC0J8`; `redact` `42501` before `HC0J7`); 9 case-child tables carry exactly one SELECT policy = verbatim
`can_read_case`; respondent/recused/foreign read 0 rows on every ethics table; D13 respondent reaches only its 1 targeted
response; M2 pin + redaction freeze hold; flag flip seed-only.

## Open follow-ups (non-blocking; logged at Record)

- **DOC-1 — DONE at Record:** the O-3 vote-quorum eligibility rule is now documented in ADR 0073's As-built:
  `required = greatest(coalesce(commission_meeting_settings.quorum_value, ceil(eligible/2)), 1)`; eligible = active
  members − recused − respondent; under-quorum → `HC0J8`.
- **INFO-1:** a respondent can `PATCH` their *own* targeted-response `status` directly via PostgREST, bypassing the
  `submit_targeted_case_response` audit row — self-scoped + non-escalating, but an audit-completeness gap worth closing
  (candidate for a small RLS write-tighten or routing status changes through the audited RPC).
- **INFO-2:** org_admin sees case-phase responses via the pre-existing `responses` admin arm (not a D13 widening).
