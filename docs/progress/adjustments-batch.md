# Form-Builder Enhancements batch (ad-hoc, out-of-phase) — COMPLETE 2026-07-07

Grouped batch of user-requested refinements, run as an ad-hoc out-of-phase batch under
the normal Phase Gate (§6). Human-approved plan (`a-few-adjustments-…`); design locked in
interview. Rides the synthetic-reserved-key precedent so the SQL↔TS evaluator (Rule 3) +
shared vector fixtures stay **byte-for-byte unchanged**.

**Verdict:** ✅ COMPLETE — QA APPROVED (0 BLOCKER/MAJOR/MINOR, 3 INFO),
[review](../reviews/adjustments-batch-review.md). Human-approved 2026-07-07.
Commits: pre-gate checkpoint `20c1bf5` (feature code + migrations + specs) + gate-close
(test reconciliation, segmented time-field restore, typecheck fix, docs).

## The 10 tasks (all delivered)

| # | Task | Owner |
| - | ---- | ----- |
| 1 | Hospital Departments — `hospital_departments` table + member-read/admin-write RLS + `is_hospital_member_of` + hardened `reorder_departments` DEFINER RPC + `cases.department_id/department_other` + create-case wiring | backend |
| 2 | Departments UI — hospital detail page `…/hospitais/[hospitalId]` + Novo-caso dropdown + `hideUnit` | frontend |
| 3 | Flagged + aggregate result criteria — `form_item_options.flagged`, `config.flaggedWhen`, synthetic `__total_score__`/`__flagged_count__` injected into `compute_case_phase_result` (evaluator UNCHANGED) | backend |
| 4 | Form-builder dialog cluster — two-column shell + per-row Options toggle + Flagged/flaggedWhen + Others toggle + length + required-interlock + menu-clip + result-rule criterion editor | frontend |
| 5 | "Others" open option answer model — `is_other` reserved `__other__` row via reconcile, `answers.other_text`, `config.minLength/maxLength` submit validation | backend |
| 6 | "Others" fill + display — wizard reveal + response display | frontend |
| 7 | Wizard UX — Clear ("Limpar") button + always-visible observação; **segmented time-field** (see below) | frontend |
| 8 | Views & labels — Outcomes card · "Emite resultado" badge · "Etapas pendentes" · "Atendimento" relabel ×5 | frontend |
| 9 | Meeting participants — `seed_selected_meeting_attendees` RPC + dialog "Participantes" section ("Convocar todos" default) | backend+frontend |
| 10 | `openNarrativeCount` on cases board (Etapas-pendentes support) | backend |

## Migrations (6, pushed to remote 2026-07-07)

`20260713000500_hospital_departments` · `…000600_board_open_narrative_count` ·
`…000700_flagged_aggregate_result_criteria` · `…000800_others_open_option_and_length_limits` ·
`…000900_seed_selected_meeting_attendees` · `…001000_aggregate_keys_ruleset_validation`.
pgTAP: `201`/`202`/`203`/`204`.

## Gate bugs found + fixed (all tester-verified)

- **BUG-FBE-005 (BLOCKER)** — "Others" added client **value**-imports of `OTHER_OPTION_LABEL`/
  `OTHER_OPTION_CODE` from server-only `queries/forms.ts` → `next build` aborted (pulled
  `next/headers` into the client bundle) + wizard-fill/builder routes errored even on dev.
  Fix: relocated the 2 consts to client-safe `src/lib/forms/option-constants.ts` (re-exported
  from `forms.ts`); repointed 3 client imports. **New green-bar rule for this batch: a successful
  `next build` standalone output is required — tsc/lint/vitest miss client/server bundling violations.**
- **BUG-FBE-006 (BLOCKER)** — aggregate result rules couldn't save: `validate_template_result_ruleset`
  rejected `__total_score__`/`__flagged_count__` via HC016 (compute path wired, save/validate seam wasn't).
  Fix: migration `…001000` whitelists the 2 synthetic keys (mirrors `__phase_result__`), skips option-code
  assertion for their numeric values; unknown key still throws HC016. pgTAP `202` §5 save-path assertion added.
- **BUG-FBE-007 (MAJOR)** — masked time `930`→`93:0`→blur cleared instead of `09:30`. (Ultimately mooted by
  restoring the segmented control — see below — but the mask↔normalize pipeline was made self-consistent first.)
- **BUG-FBE-008 (MAJOR)** — "Outro" free text never persisted. Four fix iterations chased upstream
  suspects (setOtherText upsert, getLatestSnapshot ref) before the **true root cause**: the `actions`
  adapter in `wizard-runner.tsx` hand-listed forwarded fields and **omitted `otherTextByItemId`** in
  both `saveSection` and `saveAndExit` — a verbatim recurrence of BUG-FBE-004 (`Parameters<…>` types the
  input, not the forwarded literal; an optional field's omission is tsc-invisible). Fix: spread-forward
  the whole input in both adapters (recurrence-proof) + a `wizard-runner.test.tsx` adapter-layer regression.
  Wire-confirmed: `saveAndExit` body now carries `otherTextByItemId`, `answers.other_text` non-NULL on resume.
- **BUG-FBE-009 (reclassified NOT-A-BUG)** — filed MAJOR against the app; frontend proved the app is
  correct. AC-9's `.first()` observação locator grabbed an unrelated unanswered controller MC's (correctly)
  disabled button. App a11y improvement landed anyway: each observação button now carries
  `aria-label="Adicionar observação — <pergunta>"`; tests scoped to the per-item name + `toBeEnabled`.

## Time-field: masked → segmented (human decision 2026-07-07)

The batch replaced the accessible react-aria segmented `TimeField` (`role="group"` "Hora" + hour/minute
`spinbutton` segments) with a single masked textbox. The human ruled the masked textbox an **accessibility
downgrade** and chose to **restore the segmented control**. Frontend reverted `src/components/ui/time-field.tsx`
to the pre-batch segmented control (identical public value/onChange/name contract → all 5 consumers unchanged)
and **deleted** the 3 batch-added mask files (`time-format.ts`, `time-format.test.ts`, `time-field.test.tsx`).
Also fixed a gate blocker the batch shipped: `tsc --noEmit` had 9 errors in the batch's own iter-4
`wizard-runner.test.tsx` (zero-arg `vi.fn` spies → TS2556/2493/2352; Vitest ignores types) — gave the 5 spies
a `(..._args: unknown[])` rest param.

## Test reconciliation (test-side only; app was sound)

The batch's intended, QA-approved cross-cutting UI changes broke several **pre-existing** specs' locators —
each fixed test-side, not app-side, and re-verified green on `next dev` + fresh `supabase db reset`:

- **Clear ("Limpar") button** — its aria-label embeds the question text, so `getByLabel(/question/i)` matched
  2 elements. Disambiguated to `getByRole('combobox'|'textbox'|'spinbutton', {name})` across `phase5-wizard`,
  `answer-model-v2`, `form-builder-enhancements`.
- **Segmented time restore** — reconciled `wizard-others-ux` + `views-labels-participants` onto the shared
  `e2e/helpers/date-pickers.ts` (`fillTimeField`/`setDateTimeField`: `group[Hora] > spinbutton`).
- **Builder dialog redesign (NORM-1)** — per-option score / Código de análise / flagged now sit behind a
  per-row "Opções" progressive-disclosure toggle. `form-model-normalization` helpers now
  `await ensureRowOptionsExpanded(dialog, position)` (idempotent; clicks `/opções da opção N/i` only when
  `aria-expanded!=='true'`) before filling. Colour picker is always-visible (outside the panel), unaffected.
- **"Convocar todos" default (phase10 AC6)** — UI meeting-create now auto-convokes all members, so CHEFE_CCIH
  was already an attendee → the explicit `add_meeting_attendee` hit the unique index → non-200. **Confirmed
  TEST-ONLY, not an app gap:** `update_meeting_attendee(p_attendee_id,p_role,p_attendance)` exists + is granted
  to `authenticated`. Fix: promote the existing attendee to `presente` (fall back to `add` only if absent).
  Audit confirmed the other 5 `add_meeting_attendee` sites create meetings via the `create_meeting` RPC (which
  does not auto-convoke), so only AC6 (UI-dialog path) was affected.
- **case-patient AC-8b** — Novo-caso dialog gained a 2nd `<select>` (the department dropdown) → scoped
  `dialog.locator('select')` to `select[name="templateId"]`.

## Test gate result

- **Batch specs: 29/29** on fresh prod-standalone (hospital-departments 6/6 · flagged-aggregate-result 3/3 ·
  wizard-others-ux 7/7 · views-labels-participants 8/8 · builder-dialog-ui 5/5).
- **Full-suite verification** via the infra-stable chunked method (fresh reset per chunk, `next dev`,
  `--workers=1`): **619 passed, 0 app regressions, 0 batch-spec failures.** Every failure surfaced was a
  pre-existing spec broken by an approved batch change (all reconciled above) or contamination
  (perf-sweep-wave2 passes alone). Final targeted re-verify of the last two fixed specs together on one fresh
  reset: `form-model-normalization` 5/5 + `phase10-meetings` AC1–AC8 = **20/20**.
- Prod-standalone remains unreliable for the full suite (BUG-AIF-001 "success-feedback" hang class); the team
  declares full-suite green on **DEV**, per memory `e2e-gate-run-mechanics`.

## Notes / follow-ups

- **Concurrent auth-screen workstream** — `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`,
  `src/components/auth/auth-hero.tsx`, `src/components/auth/login-form.tsx` (the "Mostrar senha" toggle) were
  a **different workstream**, deliberately EXCLUDED from this batch's commits.
- **QA INFO (deferred, non-blocking):** the wizard `getLatestSnapshot` ref (iter-3 of FBE-008) is a candidate
  simplification now that the true cause was the adapter — QA weighed keep-vs-simplify and said KEEP for now.
- **BUG-AIF-001** (pre-existing, non-batch) remains OPEN — Windows-prod-standalone RSC-response truncation →
  dialog stuck "Salvando…"; see the Bug Log + memory `case-dialog-prod-refresh-layout-revalidate`.
