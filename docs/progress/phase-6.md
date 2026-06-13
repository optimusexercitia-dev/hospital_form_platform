# PROGRESS archive — Phase 6

> Archived from `PROGRESS.md` to keep the live file small. Cross-phase logs
> (Bug Log, Test Run Summary, QA Verdicts, Decisions, Follow-ups) remain in
> `PROGRESS.md`. This file is the detailed record of Phase 6's tasks.

<details><summary>Phase 6 tasks (completed 2026-06-13)</summary>

**Phase 6 — Section Sign-offs & Submission Lifecycle** (started 2026-06-13)

Scope (PHASES.md §Phase 6): a sign-off STEP in the wizard for `requires_signoff`
sections — `respondent` role = an explicit confirmation by the filler recorded
as a sign-off row; `staff_admin` role = the in_progress response surfaces in a
staff_admin "pendentes de assinatura" queue, the staff_admin reviews the section
read-only and signs (optional note). Submission is now blocked until every
VISIBLE sign-off section is signed (`submit_response`'s sign-off check is enabled
this phase via the ADR-0004 flag flip). Sign-off display ("assinado por X em
DATA") in the review screen and in all read-only views. Notifications are minimal
(in-app pending queue only, no email).

Acceptance (PHASES.md §Phase 6): respondent-signed flow E2E; staff_admin-signed
flow E2E incl. the pending queue; submit without a required sign-off rejected by
the server with a clear pt-BR message; sign-offs immutable after submission; a
staff member cannot sign a `staff_admin` section (RLS verified through the UI);
sign-off metadata visible in read-only views.

Lead notes carried into this phase (from this session's schema + Phase-1/5 read):
- **Almost the entire backend authority already exists** (Phase 1): the
  `response_section_signoffs` table; submitted-immutability triggers freezing
  sign-offs after submission; `submit_response`'s P0012 sign-off check (every
  VISIBLE `requires_signoff` section needs a row) **already written**, gated by
  `app.feature_enabled('signoff_enforcement')` (ADR 0004) — Phase 6 flips the
  flag to `true` (a one-line migration). RLS already authorizes BOTH ends:
  `signoffs_insert` enforces the signer-role rule in the DB (respondent →
  `created_by`; staff_admin → `is_staff_admin_of`, `signed_by = auth.uid()`,
  in_progress only), and `signoffs_select` lets the creator/admin/staff_admin
  read sign-off rows. The data layer ALREADY maps P0012 → "Há seções pendentes
  de assinatura." (`src/lib/responses/actions.ts`).
- **The one genuine architectural gap is the staff_admin READ path.**
  `responses_select`/`answers_select` deliberately HIDE other members'
  in_progress responses + answers from staff_admins (Phase 7 enshrines "a
  staff_admin cannot read the answers of another member's in_progress
  response"). So the "pendentes de assinatura" queue and the read-only
  review-to-sign screen must NOT be served by broadening that general RLS (it
  would break the Phase-7 invariant and risk RLS recursion: an answers policy
  that reads answers to evaluate visibility). Instead expose a NARROW,
  purpose-limited `SECURITY DEFINER` read path, internally gated by
  `is_staff_admin_of(commission)` + the precondition "this in_progress response
  has a VISIBLE, unsigned, `staff_admin`-role sign-off section". This is a
  deliberate, documented exception scoped to the sign-off use-case only; the
  Phase-7 submissions-browser path stays RLS-tight and its invariant holds.
  **Backend plans this + writes the ADR** (the security-sensitive decision).
- **Sign action**: a `sign_section(response_id, section_id, note)` RPC,
  `security invoker` so RLS's `signoffs_insert` still enforces the signer-role
  rule — but the RPC ADDS the visibility precondition (Rule 4: signing only when
  the section is VISIBLE and the response is in_progress), which RLS can't
  cheaply evaluate. Same RPC backs BOTH the respondent (wizard) and the
  staff_admin (queue) sign — the signer-role rule is the DB's job. Handle the
  `unique(response_id, section_id)` race → "já assinada".
- **Fold the two carried Phase-5 QA findings** since Phase 6 next touches these
  RPCs: MINOR-1 (`save_section_answers` `p_section_id` cross-version guard) and
  MINOR-2 (give the cross-version item guard a DISTINCT SQLSTATE so
  `saveSection`'s error map stops mislabelling it "já enviada").
- **Submission/queue ordering** (v1, minimal): a response with a visible unsigned
  `staff_admin` section can't be submitted by the respondent (P0012) → it sits
  in_progress → surfaces in the staff_admin queue → staff_admin signs → the
  respondent returns and submits. Backend's plan picks the queue predicate
  (steer: visible + unsigned + `staff_admin` role; consider also requiring the
  response be otherwise submit-ready so half-filled drafts don't surface —
  document the choice).
- **Read-only sign-off metadata** ("assinado por X em DATA") lands in the review
  screen and the staff_admin review-to-sign screen this phase; Phase 7's
  version-faithful submission viewer will reuse the same display component.
- **Seed**: needs in_progress response(s) on Form B (Farmácia — it has both a
  `respondent` and a `staff_admin` sign-off section) positioned so the E2E can
  exercise BOTH the respondent sign + the staff_admin queue. Backend touches the
  seed in B4.

| Task | Owner | Status | Depends on | Notes |
| ---- | ----- | ------ | ---------- | ----- |
| B1 · **[plan-gated: migration + RLS/security]** Migration(s): (a) flip `signoff_enforcement` → true (ADR 0004); (b) fold Phase-5 MINOR-1 (`save_section_answers` `p_section_id` cross-version guard) + MINOR-2 (distinct SQLSTATE for the cross-version item guard); (c) sign-off RPCs — `sign_section` (security invoker, visibility-checked, RLS enforces signer-role, unique-race → already-signed), `list_signoff_queue(commission)` (security definer, `is_staff_admin_of`-gated, visible+unsigned+staff_admin predicate), `get_response_for_signoff(response)` (security definer, narrow read of an in_progress response with a pending staff_admin sign-off). RLS audit (existing `signoffs_insert`/`signoffs_select` cover write+read; document the definer read exception). Type regen. pgTAP (respondent sign, staff_admin sign, staff-cannot-sign-staff_admin-section RLS, visibility precondition, immutability-after-submit holds, queue predicate, enforcement-on submit P0012 reject + signed→success). ADR (definer read path + flag flip). | backend | done | – | 3 migrations: `090001` (flag flip + MINOR-1/2 cross-version guards → P0013) + `090002` (sign_section P0014/P0015, list_signoff_queue submit-ready via `app.response_required_complete`, get_response_for_signoff) + **`090003` (RLS fix, flagged to lead)**: `signoffs_insert`/`signoffs_select` had an RLS-subquery-filtering bug hiding the in_progress parent from the staff_admin signer → counter-sign path could never insert/read-back. Moved response fact-finding into definer predicates (`app.can_sign_section`/`app.can_read_signoff`); **role rules unchanged**, answers invariant intact. pgTAP **138/138** from clean `db reset` (was 133). Types regenerated (3 RPCs present). ADR 0016 + note in 0004. SQLSTATEs P0013/P0014/P0015. |
| B2 · Sign-off queries (`src/lib/queries/signoffs.ts`): `listSignoffQueue(commissionId)` + `getResponseForSignoff(responseId)` (compose the `get_response_for_signoff` definer RPC with the member-readable `getVersionTree`); extend `getResponseForFill` (or add a helper) to surface a response's existing sign-off rows so the wizard review shows status; domain types | backend | done | B1 | `src/lib/queries/signoffs.ts`: `listSignoffQueue(commissionId)→SignoffQueueItem[]`, `getResponseForSignoff(responseId)→ResponseForSignoff\|null` (composes definer RPC + `getVersionTree`, now carries `formId`/`formTitle`), `getResponseSignoffs(responseId)→SignoffRecord[]` (focused helper for wizard review badges, keeps `ResponseForFill` stable). Exported domain types `SignoffQueueItem`/`SignoffRecord`/`ResponseForSignoff`. lint clean. **Frontend's provisional `src/components/signoffs/types.ts` differs (sectionId vs pendingSectionId; signoffsBySectionId map vs signoffs array) — their pages adapt B2 → those props per their own note; 2 typecheck errors remain in FRONTEND-owned `src/app/.../assinaturas/*` pending that adapt.** |
| B3 · Sign-off action (`src/lib/responses/actions.ts`): `signSection({responseId, sectionId, note})` — backs BOTH the respondent (wizard) and the staff_admin (queue) sign; wraps `sign_section`; maps RLS signer-role rejection → forbidden, unique-race → "já assinada", not-visible/not-found → pt-BR; server-side authz re-check; no raw PG errors. (`submitResponse` already maps P0012.) | backend | done | B1 | `signSection({responseId, sectionId, note?})→ActionState`. Maps 42501→forbidden (signer-role RLS), P0014→não disponível, P0015→já assinada, P0002→not found, P0013→genérico. **P6-001 FIX (2026-06-13): removed the pre-RPC `contextOfResponse`/`authorizeMember` check** — it read the RLS-hidden in_progress `responses` row, so the staff_admin counter-signer 404'd before calling the RPC. `sign_section`+`signoffs_insert` RLS are the complete authority; action now calls the RPC directly. `responses_select` untouched (Phase-7 invariant). ALSO folded MINOR-2: `saveSection` maps P0013 (cross-version)→"Dados inválidos" distinct from check_violation→"já enviada". lint clean. |
| B4 · Seed touch-ups: in_progress response(s) on Form B so the E2E exercises the respondent sign + the staff_admin queue end-to-end; type regen; pgTAP regression (full suite from clean `db reset`); condition-vector SQL↔TS parity recheck | backend | done | B1–B3 | Added 1 in_progress Form B response (deterministic id `e0000000-…-e1`, by staff1.farm): submit-ready (organizacao='Sim', termolabeis='Não' hides conditional, sem_vencidos='Sim'), respondent section already SIGNED, staff_admin section UNSIGNED → surfaces in chefe.farm's queue. Phase-5 resume fixture (Form A) kept intact. Verified via psql: queue shows it for chefe.farm + empty for staff1.farm; `get_response_for_signoff` returns respondent + 1 signoff. Counts: 10 submitted (unchanged), 2 in_progress (+1), 9 signoffs. Seed survives `db reset`. **pgTAP 138/138**, **Vitest 24/24** (condition parity intact — evaluator untouched). Types regenerated, no drift beyond the 3 new RPCs. |
| F1 · **[plan-gated: new route group]** staff_admin "pendentes de assinatura" queue (`/c/[slug]/manage/assinaturas`): coordinator-gated (`getCommissionAccess` → `notFound()` for non-staff_admin); `listSignoffQueue` list (form, respondent, section, when) → link to review-and-sign; wire "Assinaturas" coordinator nav item + landing card; loading/error | frontend | **done** | B2 | **Wired to confirmed B2.** `manage/assinaturas/{page,loading,error}.tsx` (coordinator-gated, 404 non-staff_admin); page maps `SignoffQueueItem[]` (`pendingSectionId/Title`, nullable `respondentName`) → `SignoffQueueRow` w/ pt-BR fallbacks; `signoff-queue-list.tsx` (form+version, respondent, pending section +pendingCount, dates, empty state). Nav "Assinaturas" item (between Construtor/Gerenciar, prefix-active) + landing card. lint+typecheck+build green. **Live:** `list_signoff_queue` as chefe.farm returns the seeded `…e1` row (section "Revisão da chefia"); as staff2.farm → `[]` (RPC gated). |
| F2 · Review-and-sign screen (`/c/[slug]/manage/assinaturas/[responseId]`): coordinator-gated; read-only version-faithful render (reuse `read-only-tree.tsx`) + answers from `getResponseForSignoff`, focused on the `staff_admin` sign-off section(s); sign affordance + optional note → `signSection`; shows existing sign-off metadata; server-rejection surfaced in pt-BR | frontend | **done** | B2, B3, F1 | **Wired to confirmed B2/B3.** `[responseId]/{page,loading,error}.tsx` (gated; `getResponseForSignoff` null → 404; commission path-tamper guard); page adapts B2 `ResponseForSignoff` (`signoffs[]`→map, nullable names→pt-BR) via `signoffs/adapt.ts`. `review-and-sign.tsx` renders FULL response read-only (all VISIBLE sections via `evalCondition` + answers via `AnswerSummary` + display blocks via new `read-only-blocks.tsx`), per-respondent context banner; `sign-section-panel.tsx` (optional note → `signSection`, pt-BR rejection banner, `router.refresh` on success, F4 badge when signed) bound via `sign-runner.tsx`. **Live:** chefe.farm signs section b004 (HTTP 200) → queue empties; re-sign → P0015 "já assinada"; respondent signing b004 → 42501 forbidden. |
| F3 · Wizard respondent sign-off: a sign-off affordance/step for visible `requires_signoff(respondent)` sections → `signSection`; submission gating (can't submit until all visible sign-off sections signed) + surface server P0012 in pt-BR; sign-off status in the review screen | frontend | **done** | B2, B3 | **Wired to confirmed B2/B3 (per the wiring correction).** Wizard route page calls the STANDALONE `getResponseSignoffs(responseId)` and threads rows into `WizardData.signoffsBySectionId` via `prepare.ts` (`signoffRecordsToMap` from `signoffs/adapt.ts`); `respondentName = access.context.fullName`. `WizardActions.signSection` bound in `wizard-runner.tsx`; `WizardClient` holds optimistic sign-off state + computes the submit gate (every visible `requires_signoff` section signed); `respondent-signoff.tsx` (inline "Assinar e confirmar esta seção" + note for respondent role; status-only for staff_admin role) per section in `review-screen.tsx`; `submit-panel.tsx` disables submit w/ pt-BR `blockReason` until satisfied — server P0012 still surfaced. Wizard unit tests green; seed `…e1` already has the respondent sign-off on b003 (badge will render). |
| F4 · Reusable sign-off status display ("Assinado por X em DATA" / "Pendente — chefia" / "Pendente — sua assinatura") used in the review screen + read-only views; a11y (keyboard sign flows) + pt-BR polish across the new screens | frontend | **done** | B2, F2, F3 | `src/components/signoffs/signoff-status.tsx` — `{signoff?, role?, isRespondent?}`; "Assinado por X em DATA" (+ `<time>` + optional note) / role-aware pending ("Pendente — chefia"/"— sua assinatura"/"— responsável"/"Pendente"). Consumed by F2 (`review-and-sign`, `sign-section-panel`) and F3 (`respondent-signoff`). All sign-off UI under `src/components/signoffs/`. a11y: labelled note textareas, keyboard-operable sign buttons, status by icon+text (not colour alone). |

</details>
