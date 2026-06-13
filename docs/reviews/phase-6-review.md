# Phase 6 — Section Sign-offs & Submission Lifecycle — QA Review

**Reviewer:** `qa` (qa-reviewer)
**Date:** 2026-06-13
**Phase Gate step:** §6.3 (QA review)
**Inputs audited:** PHASES.md §Phase 6, ARCHITECTURE.md (Rules 1–10), CLAUDE.md §8,
the three Phase-6 migrations (`20260613090001/02/03`), the Phase-1 originals they
amend (`100004`, `100005`, `100006`, `100001`), `src/lib/queries/signoffs.ts`,
`src/lib/responses/actions.ts`, `src/app/c/[slug]/manage/assinaturas/**`,
`src/components/signoffs/**`, the wizard sign-off/submit components,
`e2e/phase6-signoffs.spec.ts`, ADR 0016, generated `database.ts`.

**Test status (from tester):** full suite 70/70 green (gate run 2, post-P6-001);
`phase6-signoffs.spec.ts` 9/9. pgTAP 138/138.

**Verdict: APPROVED** (no blockers, no majors; minor/info items are carry-forwards).

---

## 1. Requirements Audit (per Acceptance Criterion)

| AC | Requirement (PHASES.md §Phase 6) | Verdict | Evidence |
| -- | -------------------------------- | ------- | -------- |
| AC1 | Respondent-signed flow end-to-end | MET | Wizard review `RespondentSignoff` records the row via `sign_section`; E2E `AC1/AC3` signs inline, asserts the F4 badge **and** DB truth (`signoffSections === [SECTION_RESPONDENT]`); lifecycle close in `AC2/AC6/AC1` submits to `submitted`. |
| AC2 | staff_admin-signed flow end-to-end incl. the pending queue | MET | `list_signoff_queue` (definer, `is_staff_admin_of`-gated) → `assinaturas` queue → `get_response_for_signoff` review → `sign_section`. E2E opens the seeded e1 row by href, reviews read-only, signs with a note, asserts both sign-off rows in the DB, and that e1 leaves the queue. |
| AC3 | Submission without a required sign-off rejected by the **SERVER** with clear pt-BR | MET | `submit_response` P0012 check is now live (flag flipped in `100001`-table via `20260613090001`); only walked for **visible** `requires_signoff` sections. E2E invokes `submit_response` under the **response owner's real JWT** (not the service key), asserts `P0012` and status still `in_progress`. Action maps P0012 → "Há seções pendentes de assinatura." |
| AC4 | Sign-offs immutable after submission | MET | `guard_submitted_signoffs_trg` (Phase-1 `100004`) blocks INSERT/UPDATE/DELETE on sign-offs once the parent response is `submitted`; no UPDATE/DELETE RLS policy exists on the table (deny-by-default defence in depth). E2E asserts no re-sign affordance post-submit, queue absence, and the review route 404s for the submitted response. |
| AC5 | A staff member cannot sign a `staff_admin` section (RLS verified through the UI) | MET | Wizard shows status-only ("Pendente — chefia") for staff_admin sections, never a respondent-operable button. E2E additionally calls `sign_section` directly **under the respondent's real JWT** → RLS `42501` + DB truth the section stays unsigned. This proves RLS, not UI hiding, is the boundary. |
| AC6 | Sign-off metadata visible in read-only views | MET | `SignoffStatus` renders "Assinado por X em DATA" (+ optional note) on the wizard review, the staff_admin review screen, and is reused by Phase-7 read-only views. E2E asserts the dd/mm/yyyy badge in both AC1 and AC2 paths. |
| AC7 (CLAUDE §8) | At least one keyboard-only flow | MET | E2E `AC7` drives queue → review → sign entirely by keyboard (`focus()`, `Enter`, `keyboard.type`), asserting `toBeFocused` at each step and DB truth on the resulting sign-off. |

All seven acceptance bullets are genuinely met — the E2E asserts on **DB state and
server behaviour under real user JWTs**, not merely on rendering. AC3 and AC5 in
particular bypass the UI and hit the RPCs directly, which is exactly the evidence
needed to prove the server/RLS is the authority.

---

## 2. Security / RLS Review (highest-risk: the `signoffs_insert`/`signoffs_select` rewrite)

### 2.1 Signer-role rule is byte-equivalent (no broadening of WHO may sign)

Original `signoffs_insert` (migration `100006`, lines 331–348) WITH CHECK:
```
signed_by = auth.uid()
and exists ( ... r.status = 'in_progress'
             and s.form_version_id = r.form_version_id
             and s.requires_signoff = true
             and ( (s.signoff_role='respondent' and r.created_by = auth.uid())
                or (s.signoff_role='staff_admin' and app.is_staff_admin_of(r.commission_id)) ) )
```
New (`20260613090003`): `signed_by = auth.uid() and app.can_sign_section(response_id, section_id, auth.uid())`, where
`app.can_sign_section` reproduces **exactly** the same predicate set
(`status='in_progress'`, `s.form_version_id = r.form_version_id`,
`requires_signoff = true`, respondent→creator / staff_admin→`is_staff_admin_of`),
with `p_signer = auth.uid()`. The only change is the **evaluation context**
(`SECURITY DEFINER`, so the inner `responses` read is not re-filtered by
`responses_select`). The role rule is unchanged. The `signed_by = auth.uid()`
clause remains in the policy (a staff_admin cannot sign on behalf of another).
**Verified — the fix strictly enables the previously-impossible legitimate
staff_admin path without widening authorization.**

### 2.2 `signoffs_select` exposes metadata only, not answers

New `app.can_read_signoff(response_id)` returns true for `created_by = auth.uid()
OR is_admin() OR is_staff_admin_of(commission)` — identical authz set to the
original `100006` select policy. The select is on `response_section_signoffs`
columns only (section_id, signed_by, signed_at, note) — **no answer columns**.
`responses_select` and `answers_select` are **untouched** by all three Phase-6
migrations (grep confirms only comments reference them). The Phase-7 invariant
("staff_admin cannot read another member's in_progress **answers**") therefore
still holds: in_progress answers reach a staff_admin **only** through the narrow,
pending-section-gated `get_response_for_signoff`. **Verified.**

### 2.3 SECURITY DEFINER hygiene

Every new definer function pins `search_path`:
- `app.response_required_complete` — `set search_path = app, public, pg_catalog`
- `app.signoff_target` — `set search_path = app, public, pg_catalog`
- `app.can_sign_section` — `set search_path = app, public, pg_catalog`
- `app.can_read_signoff` — `set search_path = app, public, pg_catalog`
- `public.list_signoff_queue` / `public.get_response_for_signoff` — `set search_path = public, pg_catalog`

Internal gating on the definer reads is present and correct:
- `list_signoff_queue` → `if not app.is_staff_admin_of(p_commission_id) then return; end if;` (empty set, no error, no leak).
- `get_response_for_signoff` → three gates: (1) exists + `in_progress`, (2)
  `is_staff_admin_of(commission)`, (3) a **visible + unsigned + staff_admin-role**
  pending section exists; otherwise `no_data_found`. The read right is scoped to
  the act of signing, exactly as ADR 0016 specifies.
- The `app.*` helpers `revoke all from public` then grant only to
  `authenticated, service_role`, and are not in the data API schema (not exposed
  via PostgREST — confirmed absent from `database.ts`).

### 2.4 `sign_section` constraint completeness

`sign_section` is `SECURITY INVOKER` — the INSERT runs under `signoffs_insert`, so
WHO-may-sign stays under RLS. The RPC adds the visibility precondition (Rule 4):
`app.eval_condition(visible_when, answer_map)` → `P0014` when hidden. The
metadata pre-read uses the definer `app.signoff_target` (necessary because
`responses_select` hides the in_progress parent from the legitimate staff_admin
signer). The unique(response_id, section_id) race is discriminated to `P0015`.
Together — visibility precondition (RPC) + `signoffs_insert` WITH CHECK (role +
`signed_by` + in_progress + requires_signoff + same-version) — the signing path is
fully constrained. **No bypass found.**

### 2.5 The P6-001 fix did not weaken authz

`signSection` (action) no longer pre-resolves the commission via the RLS-scoped
`responses` read (that pre-check was the BLOCKER P6-001: it 404'd the legitimate
staff_admin before reaching the RPC). The RPC + RLS are now the sole authority.
An unentitled caller still gets denied by `signoffs_insert` WITH CHECK → `42501`
→ mapped to the pt-BR `forbidden`. E2E `AC5` proves an unentitled respondent
hitting `sign_section` directly is rejected at `42501`. **The removal closed a
functional hole without opening a security one.**

### 2.6 Submission authority & single-sourcing

- `submit_response` remains the sole submission authority (Rule 3); the P0012
  sign-off check is gated on `app.feature_enabled('signoff_enforcement')`, flipped
  to `true` in `20260613090001`. The check only fires for **visible**
  `requires_signoff` sections (it lives inside the visibility-evaluated section
  loop) — correct.
- The queue's submit-readiness predicate is single-sourced: both
  `list_signoff_queue` and the readiness concept use
  `app.response_required_complete`, which mirrors `submit_response`'s
  visibility + required-answer walk. No drift between the queue gate and the
  submission gate. **Verified.**

---

## 3. Code-Quality Review

- **Rule 9 (data access through `src/lib/queries/`):** all sign-off reads live in
  `src/lib/queries/signoffs.ts`; the mutation lives in `src/lib/responses/actions.ts`.
  No inline supabase-js in components. The client tree imports only **types** from
  `@/lib/queries/*` (e.g. `adapt.ts` uses `import type`), or the server action
  `signSection` (the supported client→action pattern), or the pure mirrored
  `evalCondition` from `@/lib/queries/conditions` (client-safe, type-only deps).
  **No server-only module value-imported into a client component.**
- **Rule 8 (types regenerated):** `database.ts` contains `sign_section`,
  `list_signoff_queue`, `get_response_for_signoff`. The `app.*` definer helpers
  are correctly absent. **Verified.**
- **TypeScript strict / no unjustified `any`:** grep over the new files found no
  `: any` / `as any`. The two `as unknown as <T>` casts (`getResponseForSignoff`
  RPC payload) are at jsonb-RPC boundaries and are typed to explicit interfaces.
- **Error-mapping completeness (Rule 10, no raw PG in UI):** `signSection` maps
  `42501`→forbidden, `P0014`→not-available, `P0015`→already-signed,
  `P0002`→not-found, `check_violation`→generic, default→generic. `submitResponse`
  maps P0010/P0011/P0012/P0002. `saveSection` maps `P0013`→invalidData (distinct
  from `check_violation`→alreadySubmitted) — this is the Phase-5 MINOR-2 fold-in.
  All strings pt-BR. **Complete.**
- **Phase-5 QA carry-forwards folded in:** MINOR-1 (`save_section_answers`
  `p_section_id` cross-version guard, lines 80–87 of `20260613090001`) and
  MINOR-2 (distinct `P0013` SQLSTATE + remap in `saveSection`) are both resolved
  this phase. **Confirmed.**
- **Coordinator gating (defence in depth):** both `assinaturas` pages
  `notFound()` for non-staff_admin/non-admin and cross-check
  `data.commissionId === access.commission.id` (rejects a tampered URL). This is
  belt-and-suspenders over the definer RPC's internal `is_staff_admin_of` gate —
  RLS/definer remains the true boundary, never the UI.

---

## 4. UX & a11y

- pt-BR throughout; no raw Postgres errors surface (mapped or generic fallback).
- Accessible sign-off affordances: `RespondentSignoff` note textarea has a `label
  htmlFor`; `SubmitPanel` uses `role="alert"` for the error banner, a disabled
  state with a `title`/visible pt-BR reason when gated; `SignoffStatus` uses a
  semantic `<time dateTime>` element. Keyboard path proven by AC7.

---

## 5. Itemized Findings

No **BLOCKER** or **MAJOR** findings.

- **INFO-1 (carry-forward, documented v1 limitation).** No answer-lock between a
  staff_admin sign-off and submission: the creator can still edit a signed
  section's answers before submitting (ADR 0016 §"Known v1 limitation"). I concur
  this is acceptable for v1 — `submit_response` re-checks required answers and
  visibility at submit time, and the sign-off row still records who/when. It is
  explicitly documented, not silently dropped. *Recommendation for a future
  phase:* invalidate a staff_admin sign-off (and re-surface it in the queue) when
  any answer in its section changes after signing, or freeze the section's answers
  on sign-off. No action required this phase.

- **INFO-2 (consistency, non-blocking).** `signoff-status.tsx`'s `Signoff`
  interface types `signedByName: string` (non-nullable) while the query layer
  (`SignoffRecord.signedByName`) is `string | null`. Every path funnels through
  the shared `signoffRecordsToMap`/`toClientResponseForSignoff`/`toWizardData`
  adapters that apply pt-BR fallbacks ("Usuário"/"Responsável"), so no null ever
  reaches the badge — the drift is cosmetic and currently sound. Consider aligning
  the display type to `string | null` (or documenting the adapter as the single
  null-coalescing point) to keep the invariant from regressing if a future caller
  bypasses the adapter. No action required this phase.

- **INFO-3 (carry-forward from prior phases, unchanged).** Phase-1 INFO-1 (revoke
  anon DML/EXECUTE grants in Phase 8 hardening) and Phase-2 (prod asymmetric JWT
  signing keys) remain open for the Phase-8 deploy checklist. Not in Phase-6 scope.

---

## 6. Verdict

**APPROVED.** All seven Phase-6 acceptance criteria are met with adversarial E2E
evidence (DB-truth + real-JWT RPC assertions, not just rendering). The highest-risk
change — the `signoffs_insert`/`signoffs_select` rewrite — strictly **enables** the
legitimate staff_admin counter-sign path without broadening WHO may sign or read:
the signer-role rule is byte-equivalent, only the evaluation context moved to
`SECURITY DEFINER`; `responses_select`/`answers_select` are untouched so the
Phase-7 in_progress-answers invariant holds; every definer function pins
`search_path` and is internally gated. The P0012 submission check is live and
single-sourced with the queue's readiness predicate. P6-001 is resolved without
weakening authorization. Remaining items are INFO-level carry-forwards.
