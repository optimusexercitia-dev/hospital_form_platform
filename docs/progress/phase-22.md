# Phase 22 — Inter-Committee Case Referrals (`case_referrals`)

**Status:** ✅ Complete (2026-06-21) · **Commit:** `768b9f1`
**Gate:** Build ✅ · Tests ✅ (pgTAP 705/705 · E2E 29/29 · 0 regressions) · QA ✅ APPROVED · Human ✅
**ADR:** [0037](../decisions/0037-inter-committee-case-referrals.md) · **Review:** [phase-22-review.md](../reviews/phase-22-review.md) · **Plan:** `~/.claude/plans/a-feature-must-be-streamed-quill.md`

> Archived from `PROGRESS.md` at the §6 Record step. The cross-phase logs (Bug Log, Test Run Summary, QA Verdicts) stay in `PROGRESS.md`.

## Summary

Human-approved plan (2026-06-21): committees send a `Case` to another committee for analysis
(Notification / Analysis Request) over a **frozen point-in-time snapshot** channel; the
destination commits a **structured reply**; each committee's internal work stays private from
the other; **QPS (the `is_pqs_member` roster)** gets the full end-to-end macro view; and an
outstanding reply-expected referral **hard-blocks `close_case`** (HC076). Referrals carry PHI
under NSP-grade safeguards (isolated `referral_patient`, audited single-door reads) — this
**reverses Rule 12 for this module** (new ADR 0037 supersedes ADR 0022). Contract-first;
backend + frontend in parallel.

## Tasks

| Task | Owner | Status |
| ---- | ----- | ------ |
| P22-001 migration (7 tables, predicates, guards, storage, grants + `referral_patient` REVOKE, flag OFF) | backend | ✅ `20260620013000_referrals.sql` — 7 tables, 8 `app` predicates, 3 guards + 2 audit triggers, `referral-attachments` bucket + the flag-gated `case-documents` snapshot OR-term (RLS-consistent, no service-role per lead), grants + `referral_patient` REVOKE, vocab seed (4 types/4 outcomes), flag OFF. `db reset` clean |
| P22-002 RPCs + `close_case` HC076 gate + `can_read_case` QPS term + audit allow-list + wire contract + regen types + timeline data | backend | ✅ `20260620014000_referrals_rpcs.sql` — 21 RPCs (draft/assemble, src+tgt transitions, audited detail/PHI/signed-URL doors, GAP-1 `list_referral_target_commissions`, `is_pqs_member_self`); `close_case` HC076 + `can_read_case` QPS term (before `case_access` fallback) + `log_audit_access` allow-list via CREATE OR REPLACE (forward-only). Wired `actions.ts`+`queries/referrals.ts` (incl. `revealReferralPatient`, GAP-2 `getCaseSafetyEventPatientPrefill`, QPS reads gated on `is_pqs_member_self`); regen `database.ts`; timeline `referral` source in `case-timeline.ts` + audit TS unions. **PHI tighten (`20260620015000`):** `frozen_body_md`/`result_md`/`description_md` follow `can_read_referral_phi` (not broad `can_read_referral`) — SELECT policies swapped, `get_referral_detail` nulls bodies for metadata-only readers; `referral.viewed` fires on a body-serve to any non-source-coordinator (incl. QPS). **Description lockdown (`20260620016000`):** column-level `REVOKE SELECT ON case_referral` + `GRANT SELECT (25 PHI-free cols)` so `description_md`+`decline_note` aren't directly selectable. **`loadCaseSafetyPrefill`** action added (on-demand GAP-2). pgTAP `150_referrals.sql` (40 assertions); full suite **705/705**; tsc+lint+34 unit clean; clean `db reset` |
| P22-003 contract stubs (`src/lib/referrals/{types,messages,actions}` + `queries/referrals`) | backend | ✅ |
| P22-004 FE hub + nav badge + case-detail card + timeline rendering | frontend | ✅ hub `encaminhamentos/page.tsx` (Recebidos/Enviados) + loading/error; nav item + count via `layout.tsx`→`app-sidebar.tsx`; outbound card in `case-detail-view.tsx` (host pages via `build-case-referrals-module.ts`); timeline `referral` in `type-meta.tsx` + `--event-referral` CSS |
| P22-005 FE send wizard (snapshot curation + optional patient block) | frontend | ✅ `referral-send-wizard.tsx` 4-step; type seeds `responseExpected`; per-pick `addReferralSharedItem`; `referral-patient-fields.tsx`. GAP-1/GAP-2 wired (P22-011) |
| P22-006 FE B's detail + reply form + audited PHI panel + downloads | frontend | ✅ `encaminhamentos/[referralId]/page.tsx`; snapshot (`referral-snapshot.tsx`, server-side signed URLs), `referral-actions.tsx` (receive/accept/decline/start/withdraw + link-case + reply), `referral-patient-panel.tsx` (lazy reveal). PHI reveal wired (P22-011) |
| P22-007 FE QPS dashboard (`/admin/nsp/encaminhamentos`) | frontend | ✅ page + loading/error (`isAdmin` route gate; data layer = `is_pqs_member`); URL filters; KPIs + aging/by-committee Recharts; drill-down table; linked from NSP inbox |
| P22-008 seed (vocab + 2 demo referrals) | backend | ✅ vocab in migration; `seed.sql` §10 = ENC-0001 (`concluida` isolation fixture: frozen snapshot + isolated PHI + delivered `procede` reply + linked B case) + ENC-0002 (`enviada`, phase-clean source so the close-gate hits HC076, not HC031). `db reset` clean |
| P22-009 tester (pgTAP + Playwright, flag ON, local only) | tester | ✅ GREEN — pgTAP 705/705; `e2e/phase22-referrals.spec.ts` **29/29** (all 8 flows); full gate **276 passed / 26 failed** (26 = pre-existing baseline; 0 Phase-22 regressions; 0 spec-induced). 2 inherited `phi-remediation.spec.ts` type errors fixed. Flow 4 isolation fix: mints a disposable case + referral in `beforeAll`, exercises HC076 + withdraw→close on the throwaway, discards it; seeded fixtures untouched; `test.skip()` guards removed |
| P22-010 docs (ADR 0037 + ARCHITECTURE/CLAUDE/PHASES/PROGRESS/backend-state) | backend + lead | ✅ ADR 0037 + `backend-state.md` (backend); ARCHITECTURE Rule 12 "second PHI module" bullet + intro pointer, CLAUDE.md governance bullet + Rule-12 brief, PHASES Phase 22 row, PROGRESS finalization (lead) |
| P22-011 FE wire the 3 posted contract additions | frontend | ✅ GAP-1 eager in `build-case-referrals-module.ts`; GAP-3 `revealReferralPatient` → PHI panel. **GAP-2**: lazy on the wizard patient step (lead-RATIFIED — eager would fire `event_patient.read` on every case-detail open), loader = `loadCaseSafetyPrefill` from `@/lib/referrals/actions`; temp `src/components` bridge rebound + DELETED. Full-`src` tsc zero errors, `eslint src` clean |

## Lead notes

SQLSTATE block **HC070–HC07A** (HC054/55 taken; HC056+ reserved by the accreditation track).
Locked risk decisions: snapshot-doc download via a flag-gated `can_read_referral_phi` term on
`case_documents_select_member` + cookie-client signing (**NO service-role**); QPS read =
`is_pqs_member` early-return in `can_read_case` **before** the `case_access` fallback (so it
doesn't depend on that flag); B's analyst PHI access is coordinator/QPS-gated **until B links a
case**. Snapshot freezes narrative text + the document **reference** (Rule 6). Verification was
**local-only** — the remote `supabase db push` (the 4 referral migrations atop the prior squash)
is owner-run, destructive to remote migration history; back up the remote first, regen types after.
