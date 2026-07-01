# Ad-hoc Case Narratives — task detail (archived)

Feature: a staff coordinator adds a **narrative to an OPEN case** (`add_ad_hoc_narrative`
DEFINER RPC + `case_narratives.is_ad_hoc`), mirroring `add_ad_hoc_phase`. Type from the
commission vocabulary or an inline "Criar novo tipo" (atomic create-or-reuse that
un-archives). Reverses ADR 0032 D7's "no per-case add" for open cases only
(remove/reorder stay template-authored); closes the process-less-case gap (a
process-less case could grow phases but never a narrative).

- **Plan:** `~/.claude/plans/validated-sprouting-lake.md` (human-approved 2026-07-01).
- **ADR:** [0047](../decisions/0047-ad-hoc-case-narratives.md); supersession note on
  [0032](../decisions/0032-case-narratives.md) D7.
- **QA review:** [ad-hoc-narratives-review.md](../reviews/ad-hoc-narratives-review.md)
  — CHANGES→APPROVED (0 BLOCKER, 1 MAJOR + 2 MINOR, all cleared).
- **Completed / approved:** 2026-07-01. Branch `feat/ad-hoc-case-narratives`.

## Frontend (`frontend`)

| # | Task | Status |
| - | ---- | ------ |
| FE-1 | NEW `add-ad-hoc-narrative-dialog.tsx` — `useActionState`-bound dialog on `addAdHocNarrative`; type picker with inline "＋ Criar novo tipo…" sentinel (empty `narrativeTypeId` → `newTypeLabel`), optional título/instruções/responsável; phase-dialog accessibility bar (labels, `aria-invalid`, `role="alert"`, focus, pt-BR). | ✅ done |
| FE-2 | EDIT `case-lifecycle-actions.tsx` — 2nd outline "Adicionar narrativa" button + `narrativeOpen` state + mount dialog; new props `narrativeTypes`/`narrativesEnabled` (button shown on feature-on, NOT disabled on empty vocab). | ✅ done |
| FE-3 | EDIT `(detail)/layout.tsx` — fetch `listNarrativeTypes(commissionId)` (gated on `narrativesEnabled()`), map to `{id,label}`, pass `narrativeTypes` + `narrativesEnabled` into `CaseLifecycleActions`. | ✅ done |
| FE-4 | EDIT `case-narrative-card.tsx` — muted provenance chip near the type label when `narrative.isAdHoc`, label `adicional` (QA M2: was English `Ad-hoc` — Rule 10 fix; now mirrors the phase chip `case-phase-article.tsx:91`). | ✅ done |

Verify: `lint` clean; `typecheck` GREEN end-to-end (backend merged `addAdHocNarrative` +
`AddAdHocNarrativeState` + `CaseNarrative.isAdHoc`). QA MINOR **M2 cleared**.

## Backend (`backend`)

| # | Task | Status |
| - | ---- | ------ |
| BE-1 | NEW migration `20260701000000_ad_hoc_narratives.sql` — `case_narratives.is_ad_hoc` column (default false) + `'is_ad_hoc'` added to `trg_audit_case_narratives` allow-list (body_md/title/instructions stay OUT, Rule 11). | ✅ done |
| BE-2 | NEW RPC `public.add_ad_hoc_narrative(p_case_id, p_narrative_type_id?, p_new_type_label?, p_title?, p_instructions?, p_assigned_to?)` — `SECURITY DEFINER`, mirrors `add_ad_hoc_phase`: narratives-flag gate → terminal HC020 → coordinator 42501 → type create-or-reuse (`on conflict (commission_id,label) do update … archived=false` — **un-archives on reuse**, QA-M3) / cross-commission HC054 → `display_position` = max over phases+narratives interleave → non-member assignee HC021 → insert `is_ad_hoc=true,status='aberta'`. `REVOKE PUBLIC` + `GRANT authenticated,service_role` (100_dashboard t19 anon-exec guard). | ✅ done |
| BE-3 | `get_case_detail` `CREATE OR REPLACE` — added `'is_ad_hoc', cn.is_ad_hoc` to the narratives jsonb (only change). Regenerated `src/lib/types/database.ts` (`--local`). | ✅ done |
| BE-4 | `src/lib/queries/cases.ts` — `CaseNarrative.isAdHoc: boolean` + `DetailNarrativeJson.is_ad_hoc?` + mapper (`?? false`); updated the `narrative()` unit-test fixture. | ✅ done |
| BE-5 | `src/lib/case-narratives/actions.ts` — `AddAdHocNarrativeState` + `addAdHocNarrative(_prev, formData)` (local `commissionOfCase` helper; `narrativesEnabled` gate; `authorizeCommission`; `mapNarrativeError`; `revalidateCase`) + `MESSAGES.narrativeAdded`. | ✅ done |
| BE-6 | NEW pgTAP `supabase/tests/178_ad_hoc_narratives.sql` (14 assertions) — existing-type add; inline new-type create-or-reuse (no dup); **archived-type reuse un-archives**; HC020 terminal; HC021 non-member; HC054 cross-commission; display_position after all phases+narratives; 42501 plain staff; Rule-11 audit (no title/instructions/body_md). | ✅ done |

Backend verify: `supabase test db` **1219/1219** (47 files, +14) on fresh `db reset`;
`lint` 0 errors; `typecheck` clean; `case-narratives.test.ts` 10/10. **QA-M3 cleared.**

## Gate

- Build complete — lint · typecheck · Vitest **176/176** · pgTAP **1219/1219**.
- Test pass — new `e2e/ad-hoc-narratives.spec.ts` **5/5** (existing-type, inline
  new-type/reuse on process-less, terminal-case reject HC020, staff-denied, keyboard);
  full E2E **461p / 7 fail (identical pre-existing contamination) / 4 skip — 0 regressions**.
- QA — **APPROVED** (M1 ADR, M2 chip pt-BR, M3 un-archive-on-reuse all cleared).
- Human approval — 2026-07-01.
