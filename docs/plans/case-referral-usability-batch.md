# Plan — Case & Referral usability batch (ADR 0137)

**Status:** DRAFT, awaiting PO approval. ⛔ **No code written.**
**Decisions:** ADR [0137](../decisions/0137-mrn-erasure-key-and-case-referral-usability-batch.md)
(D1–D14, all PO-ruled 2026-08-23). This plan implements them; it does not re-open them.
**Gate posture (PO ruling):** cheap gates per increment; the **full Phase Gate once, at the end**.

---

## 0. Shape of the work

Four increments, in this order. Increment 0 is the only one with a migration, so it is also the
only one that must be pushed schema-first.

| Inc | Title | ADR | Migration | Depends on |
|-----|-------|-----|-----------|------------|
| 0 | Schema: PHI mode, narrative rename, assignment role | D1–D3, D10, D11 | **yes ×2** | — |
| 1 | Case & Process quick wins | D8, D9, D13, D14 | no | — (parallel with 0) |
| 2 | Referral wizard rewrite + MRN | D4–D7 | **yes** (send guard) | 0 (types) |
| 3 | `Atividade` card redesign | D12 | no | — |

Increment 1 and 3 touch no schema and no file Increment 0 touches, so they may run in parallel with
it. Increment 2 must follow 0 because it consumes regenerated types.

⚠ **File-ownership (CLAUDE.md §4) collision to serialize:** `src/lib/cases/actions.ts` is edited by
Inc 0 (PHI-mode messages + floors) and read by Inc 1. Inc 1 must not edit it.

---

## Increment 0 — Schema

### 0a. Process PHI collection mode (D1–D3)

**Migration A — additive + backfill.**
1. `process_template_versions`: add `patient_mode text not null default 'none'` with
   `check (patient_mode in ('none','optional','required'))`, and
   `patient_required_fields text[] not null default '{}'`.
2. `cases`: add the same two columns (the snapshot).
3. Backfill, in one statement per table: `patient_mode = case when collects_patient then 'optional'
   else 'none' end` (templates) and the same off `patient_enabled` (cases).
   ⛔ **Never `required`** — ADR 0137 D1.
4. Constraint tying the two together: `check (patient_mode <> 'required' or 'mrn' = any(patient_required_fields))`,
   plus a domain check that every element is in the allowed set
   (`name`, `mrn`, `date_of_birth`, `sex`, `encounter_ref`, `attending`).
   ⚠ `age_years` and `unit` are **excluded by the constraint**, not merely absent from the picker —
   D2 and D9 must not be able to drift apart.
5. ⛔ **Any `set local` in this migration must be inside an explicit transaction** — a top-level
   `set local` is a silent no-op (`25P01`) and `lint:set-local` grandfathers only the 12
   pre-existing files. **Do not bump the watermark.**

**Migration B — RPC re-emission and boolean retirement.**
6. Re-emit, **from `pg_get_functiondef` on the live catalog, never from migration text**:
   `public.set_template_collects_patient` → replaced by `set_template_patient_mode(p_version, p_mode,
   p_required_fields)`; `public.create_case_from_template`, `public.create_case`,
   `public.bulk_create_cases` (snapshot the two new columns; raise a pt-BR refusal when
   `patient_mode = 'required'` and any required field is absent); `public.set_case_patient` (same
   refusal against the case's snapshot).
7. Refusals take a dedicated SQLSTATE per ADR 0135 — **not** a reused `23514`.
8. **Table-level backstop (BUG-SUP-002 lesson):** the RPC gate is bypassable if `patient_identifiers`
   accepts broad `authenticated` DML. Add a guard trigger enforcing the required-field set on direct
   INSERT/UPDATE, and pgTAP the direct-table exploit — not only the RPC path.
9. Drop `collects_patient` / `patient_enabled` **only after** 6–8 land, and only once no live
   function body references them (verify in the catalog).
10. `REVOKE ALL ON FUNCTION … FROM PUBLIC` before `GRANT EXECUTE … TO authenticated` on every new
    `public.*` RPC (else the dashboard t19 pgTAP guard reds).

### 0b. Narrative rename + assignment role (D10, D11)

**Migration C.**
11. `alter table case_narratives rename column type_label to display_label`; rename the CHECK
    `case_narratives_type_label_not_blank` → `…_display_label_not_blank`.
12. Re-emit the **seven** bodies that reference it, each regenerated from `pg_get_functiondef`:
    `app.trg_audit_case_narratives`, `public.add_ad_hoc_narrative`,
    `public.add_referral_shared_item`, `public.create_case_from_template`,
    `public.get_case_detail`, `public.list_my_cases`, `public.update_case_narrative_body`.
    ⚠ `public.update_case_narrative_body` is **`prosecdef = f`** — it is an INVOKER wrapper, the
    class `ARM=wrapper` exists for. Note it in the gate record.
    ⛔ `case_referral.type_label` is **not** renamed; leave the referral arm of
    `add_referral_shared_item` alone.
13. `case_narratives`: add `assignment_role_id uuid null references case_assignment_roles(id)`.
14. New DEFINER `public.set_case_narrative_assignment_role(p_narrative_id, p_role_id default null)`,
    a twin of `set_case_phase_assignment_role` (same authority: coordinator). REVOKE-then-GRANT.

### 0c. TS side
15. `npm run gen:types` (Rule 8), then update: `src/lib/queries/cases.ts` (`typeLabel` →
    `displayLabel`), `src/lib/queries/case-narratives.ts`, `src/lib/case-narratives/actions.ts`,
    `src/components/cases/case-narrative-card.tsx`, `narrative-type-dialog.tsx`,
    `src/lib/cases/actions.ts` (PHI-mode messages replacing `patientNameOrMrnRequired` for cases).
16. New pt-BR messages: per-field "obrigatório" copy driven off the required set, and a
    process-mode label set.

### 0d. pgTAP
17. `required`-mode create refused without MRN (RPC path **and** direct-table path).
18. `optional` mode behaves byte-identically to today's `collects_patient = true`.
19. Backfill correctness: every pre-existing `true` → `optional`, every `false` → `none`, zero
    `required`.
20. `set_case_narrative_assignment_role` authority mirrors the phase twin.
21. Positive control: each new guard must be shown to RED when disabled (`lint:vacuous` discipline).

---

## Increment 1 — Case & Process quick wins (no migration)

### 1a. Attributed-work affordance (D8)
- `src/components/cases/case-phase-article.tsx` — render a primary **Preencher** when
  `phase.status === 'active' && phase.assignedTo === viewerId && isOpen`, reusing
  `StartPhaseButton`. ⚠ Requires threading `viewerId` into the article (the list has it; the article
  does not).
- `src/components/cases/case-phase-list.tsx` — pass `viewerId` down.
- `src/components/cases/case-narrative-card.tsx` — promote the assignee's **Editar** from
  `variant="ghost" size="sm"` to the same primary treatment when
  `narrative.assignedTo === viewerId`; coordinators keep the ghost variant.
- ⛔ Gate on `assignedTo === viewerId` **only**. Do not read `caps`, do not add a prop that
  `narrowToReadingSurface` could zero.
- Applies to both hosts (`/casos/[caseId]` and `/manage/cases/[caseId]`) because both mount
  `CaseDetailView`; verify the manage host does not now show two competing actions.

### 1b. Field removals (D9)
- `src/components/cases/create-case-dialog.tsx` — remove `<CaseDepartmentField>`; remove the
  `departments` prop and the `patientAgeYears` hidden input.
- `src/components/cases/edit-case-meta-dialog.tsx` — remove the department field.
- `src/components/cases/case-bulk-grid.tsx` — drop the `ageYears` PHI column (verified: the bulk
  wizard has an age column and **no** department field, so only the age half applies here). Its
  companions `bulk-create-types.ts` / `bulk-grid-model.ts` keep the field in the model — **no
  backend change** — the column simply stops rendering.
- `src/components/safety/patient-fields.tsx` — add `hideAge?: boolean` mirroring `hideUnit`; set it
  from the two **case** call sites only. Safety + referral keep `Idade`.
- `src/app/o/[org]/c/[commission]/manage/cases/page.tsx` and the `(detail)/layout.tsx` — stop
  passing `departments` to the create/edit dialogs (keep any read-only display).
- **Display retained:** wherever a case currently renders its department, leave it. Add a read-only
  line if none exists.
- `src/components/cases/case-department-field.test.tsx` — the component survives (hospital admin
  surface still uses departments); decide per call-site rather than deleting the file.
- ⛔ **No backend change.** `department_id`, `department_other`, `age_years` and every RPC argument
  stay.

### 1c. Process detail page (D13, D14)
- `src/components/process-templates/template-builder-shell.tsx` — wrap the slot list in a titled
  shell mirroring `case-phase-list.tsx`'s `<section>` (border, `Trabalho do processo` heading,
  subtitle) with `Adicionar fase` / `Adicionar narrativa` in a bordered footer.
  ⛔ **No progress meter, no status bar.**
- Same file — gate `<CaseTypePicker>` on `isDraft`; render the case type read-only otherwise.
  **Delete the dangling `ADR 0064 D4` citation** in the comment above it and cite ADR 0137 D14.

---

## Increment 2 — Referral wizard (D4–D7)

### 2a. Deferred creation (D5)
`src/components/referrals/referral-send-wizard.tsx`:
- Steps 2–3 stop calling `addReferralSharedItem` / `setReferralPatient`. `pickedNarratives`,
  `pickedDocuments` and `patient` become pure local buffers.
- New `flush(mode: 'draft' | 'send')`: `createReferralDraft` → `addReferralSharedItem` per pick →
  `save_referral_patient` if the buffer has data → `sendReferral` when `mode === 'send'`.
- ⚠ **Partial-failure policy must be explicit**: if `createReferralDraft` succeeds and a later step
  fails, the draft exists. Keep the minted id in state, surface the error, and let the user retry —
  never re-create (that orphans the first).
- `Salvar rascunho` renders left of the primary on all four steps, disabled until type +
  destination + subject are filled.
- The `toggle*` un-pick bug dies here (ADR 0137 D5); confirm no `addReferralSharedItem` call is left
  that passes both source ids null.

### 2b. Draft resume (D6, D7)
- `src/components/referrals/case-outbound-referrals-card.tsx` — a `status === 'draft'` row opens the
  wizard instead of linking to the detail page.
- New wizard prop `resumeReferralId`. On open: load via `getReferralDetail`, prefill the header,
  rehydrate picks from `sourceNarrativeId` / `sourceDocumentId`, load PHI lazily on the patient step
  through the existing audited `get_referral_patient` door.
- Flush in resume mode uses `updateReferralDraft` for the header and add/remove for items.
- Destination renders **read-only** with a note (D7).
- `src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx` — a `draft` reaching the
  detail page directly should redirect back to the case (or keep only discard); decide and state it.

### 2c. MRN mandatory (D4)
- `referral-patient-fields.tsx` — MRN marked required; step legend loses "(opcional)".
- `src/lib/referrals/messages.ts` — replace `patientNameOrMrnRequired` with an MRN-specific message;
  audit the other two modules' copies (`src/lib/cases/actions.ts`, `src/lib/safety/messages.ts`) and
  **leave safety's unchanged** (ADR 0137 Consequences).
- **Migration D:** `public.send_referral` refuses when the referral has no `referral_patient` MRN.
  Re-emit from the live catalog; ADR 0135 SQLSTATE; pgTAP both arms.
- `save_referral_patient` keeps its `name OR mrn` floor (D4).

---

## Increment 3 — `Atividade` card (D12, no migration)

- `src/lib/queries/case-documents.ts` — widen `CaseEvent.kind` from `CaseEventKind` to
  `AnyCaseEventKind` (the deferred BE-5 widening). `EVENT_KIND_LABEL` is already exhaustive over it,
  so this should be a one-line type change plus a cast removal.
- `src/components/cases/case-events-timeline.tsx` — rebuild per the handoff:
  header + subtitle, `Tudo / Atualizações / Sistema` pills, inline composer (6 case kinds, not the
  handoff's 4), timeline grid `32px 1fr` with a connector spine, tinted icon circles, type chips,
  empty-filter state. Keep the `coordinator_only` badge and the edit/delete affordances.
- Partition: `isCaseEventKind(ev.kind)` → *Atualizações*; else → *Sistema*.
- Composer visibility stays `canWrite`; the visibility control stays `canSetVisibility`.
- Tokens: use the project's existing Tailwind v4 tokens, **not** the handoff's raw oklch values.
  ⛔ Bare `[--var]` utilities are dead CSS — `lint:css-vars` fails the build on them.
- Motion via the `src/components/motion/` tokens (CLAUDE.md §2 GSAP mandate), not ad-hoc CSS.
- E2E impact: any spec scoping to the `Registros` heading or the add-record button needs updating —
  tester's call, not an engineer edit.

---

## Gates (run once, at the end — PO ruling)

Per increment (cheap): `npm run lint` (8/8), `npm run typecheck`, `npm run test`.

At the end, in §6 order:
1. **Build complete** — the above, plus `npm run test:db` on a **fresh `supabase db reset`**;
   `ARM=census` · `ARM=hat` · `ARM=floor` · `FROMFINDINGS=1 ARM=wrapper`; **plus a diff-scoped door
   sweep** over every policy and `prosecdef` gate this batch touches, derived from the migration
   diff (ADR 0079 Amdt 1), never by hand.
   ⚠ The new gates (`set_case_narrative_assignment_role`, the `required`-mode refusals, the
   `send_referral` MRN refusal) are in **no BLIND set** and pass `ARM=policy` vacuously —
   **`ARM=census` is the arm that catches them** (Amdt 3). `update_case_narrative_body` being
   `prosecdef = f` puts it in `ARM=wrapper`'s domain.
2. **Test pass** — tester updates specs for: the phase Preencher affordance, the removed fields, the
   referral deferred-create + resume flow, the MRN refusal, and the Atividade card's new
   accessible names. Declare green via `npm run e2e:prod` (fresh reset, `REBUILD=1`).
   ⚠ Baseline any red against `main` in the **same configuration** before calling it a regression.
3. **QA review** → `docs/reviews/…`.
4. **Human approval.**
5. **Record** — PROGRESS.md, `docs/progress/phase-ledger.md`, `docs/backend-state.md` (the backend
   surface changes in Inc 0 and 2). **Name the ARM, never the script.**

**Deploy order:** schema first, then code. Additive migrations make old-code/new-schema safe;
new-code/old-schema is the broken state, and Coolify auto-deploys on push.

---

## Risks

1. **The seven-body re-emission (D10) is the highest-risk item in the batch.** A missed body fails at
   *runtime*, not at migration time, and `graphify`/grep cannot see it — only the catalog can. Verify
   post-migration that zero live bodies still reference `case_narratives.type_label`.
2. **Dropping `collects_patient` / `patient_enabled`** is destructive and irreversible in place. Do
   it in Migration B, after the re-emissions, and verify no body references them first.
3. **The referral flush is multi-step and non-atomic.** There is no transaction across the RPCs, so a
   mid-flush failure leaves a partial draft. The retry policy above is the mitigation; state it in
   the code, not just here.
4. **`required` mode is a live-process footgun** (ADR 0137 Consequences). Consider a confirm step in
   the builder; decide before Inc 0's UI half.
5. **E2E churn.** Increments 1 and 3 rename or remove several accessible names. Expect spec updates;
   engineers must not edit specs without tester sign-off (§6 step 2).
