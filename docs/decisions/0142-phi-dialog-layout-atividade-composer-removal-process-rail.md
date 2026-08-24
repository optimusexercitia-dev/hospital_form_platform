# ADR 0142 — One PHI dialog layout; the Atividade composer removed; the Process rail reordered

- **Status:** accepted (implemented on `feat/cases-board-redesign`)
- **Amends:** 0137
- **Context:** Five small frontend decisions, taken together by the PO on 2026-08-24.
  Four of them reverse or narrow a decision ADR 0137 took three days earlier, which is
  why they are recorded rather than treated as styling: 0137's own text is the thing a
  later session would otherwise read and believe. The PHI fieldsets had accreted their
  field order from two independent edits (safety-event first, referral cloned from it),
  so the four dialogs that collect patient identifiers agreed on the *fields* and
  disagreed on their *arrangement*.
- **Decision:**
  1. **ONE layout for every PHI dialog**, in four rows: `Nome` (full width) ·
     `Sexo` + `Data de nascimento` · `Prontuário` + `Atendimento` ·
     `Unidade / setor` + `Profissional responsável`. Applied identically to
     `PatientFields` (safety event, Novo caso, case patient-edit) and
     `ReferralPatientFields`. ⛔ The two components stay separate — they bind different
     draft types against different RPCs — so the layout is a CONVENTION held in two
     places, and the docblock in each names the other.
  2. **`Idade` is removed from every PHI dialog**, extending ADR 0137 **D9** — which had
     already removed it from the case surfaces — to the safety-event and referral ones.
     D9's reasoning (a date of birth and a free-typed age are two statements of one fact
     that drift apart, and only one is verifiable) was never case-specific; 0137 left the
     asymmetry deliberately and the PO closed it. ⚠ **HIDING, NOT CLEARING.**
     `PatientDraft.ageYears`, its `hasData`/`toInput` arms and the `age_years` column are
     untouched, so a record that already carries an age survives an edit-and-save round
     trip. The now-dead `hideAge` prop was deleted rather than left inert.
  3. **`Unidade / setor` stays hidden on the CASE dialogs** (ADR 0137 **D9** —
     the case collects a structured, non-PHI department instead). Row 4 therefore
     collapses to one cell there. This is the single permitted deviation from R1;
     restoring the field would have put two disagreeing statements of "where the patient
     was" on one case.
  4. **The Atividade card's INLINE COMPOSER is removed** — superseding half of ADR 0137
     **D12** — and replaced by one `Adicionar registro` button in a bordered footer below
     the feed (the `Trabalho do caso` / `Trabalho do processo` pattern). A permanently
     open form above the feed made the card read as a data-entry surface with a history
     attached, when what a coordinator opens it for is the chronology. Nothing is lost:
     `CaseEventForm` always carried a SUPERSET of the composer's fields — Tipo,
     Visibilidade, corpo, plus the título / data / hora the composer never offered. Its
     `initialKind` / `initialBody` props existed only to hand the composer's half-typed
     draft over and were deleted with it.
  5. **The process builder's rail is `Versões` → `Identificação do paciente` →
     `Campos personalizados`**, and the patient card is **no longer unmounted once the
     version leaves draft** — it renders read-only, amending 0137 **D1/D2**'s draft-only
     rule. It mounted on `isDraft && casePatientEnabled`, so publishing a version deleted
     the only statement of whether its cases carry patient identifiers at all — at
     exactly the moment that answer became permanent and unfixable in place. `editable`
     now carries the draft rule, matching `CustomFieldsCard` and the outcomes
     picker → published-card pair. It renders for `none` too: "does this process collect
     PHI?" is worth answering even when the answer is no.
  6. **`Salvar rascunho` on the referral wizard is a borderless text button**
     (`variant="ghost"`). Outlined, it carried the same visual weight as the
     `Avançar` / `Enviar` beside it, so the row read as two equal choices.
- **Consequences:**
  - ⚠ **TWO LIVE ACCESSIBILITY DEFECTS WERE FOUND IN `CaseEventForm` BY R4, AND FIXED
    HERE.** Both are the same family — text that belongs in a *description* sitting inside
    a wrapping `<label>`, where it becomes part of the accessible NAME:
    · the body textarea's `role="alert"` error renamed the control from "Descrição" to
      "Descrição Descreva o registro." on every validation failure, and a user tabbing
      BACK to the invalid field heard nothing, because nothing described it. This is
      FUP-0137-ALERT-INSIDE-LABEL-MUTATES-NAME — **the composer was fixed for it and the
      dialog was not**, because at the time the dialog was the secondary path and nobody
      swept the sibling;
    · the Visibilidade select announced its entire hint paragraph as its name.
    ⛔ The lesson is the ordering: removing the composer PROMOTED a known, already-
    classified defect from one path of two to the only path there is. A removal is a
    sweep trigger — what the removed thing was fixed for, its replacement must be too.
  - The composer's unit tests did not die with it: three properties MOVED, intact, to a
    new `case-event-form.test.tsx` (the six manual kinds and not the handoff's four
    action-item types; Visibilidade coordinator-only, ETH·E3a; the name-invariance test
    above — which is what caught the first defect). ⚠ A DELETED assertion is invisible to
    `lint:vacuous`, which reads the tests that exist, not the ones that used to. One
    property was retired deliberately and is recorded as such: "disables submit until the
    body has content" was the composer's controlled `!body.trim()`; the dialog is
    uncontrolled and validates server-side.
  - Five E2E specs updated, none because behaviour regressed: four drove the composer or
    its "Mais detalhes" escape hatch, and `helpers/case-affordance-class.ts`'s G1 member
    swapped control for the second time in two days (`Registrar` → `Adicionar registro`)
    while keeping its region locator and its property unchanged. The D12-K keyboard-only
    test gained a step it could not have had before — the dialog trigger is now the first
    thing a keyboard user must reach.
  - **E2E, re-run on a QUIET stack (all containers healthy 17 min, auth 200×4): 93 of 94
    green.** `case-patient` 18/18 · `ethics-e3a-surfacing` 21/21 ·
    `case-referral-usability-batch` 10/10 · `case-surface-split-increment-2` 7/7 ·
    `hospital-departments` 6/6 · `patient-mode-required` 5/5 ·
    `casos-reading-surface-differential` 5/5 · `phi-remediation` 8/8 ·
    `phase14a-safety-events` 16/17 · plus `cases-extras` AC-Docs and
    `cases-meetings-minor` A2. Each decision has a spec that actually exercises it: R1/R3
    by `hospital-departments` AC-5 and `patient-mode-required` AC-R3, R4 by D12-1/-2/-K
    and `ethics-e3a` EVT-3, R5 by D13/D14, R6 by D5-1/D5-2.
  - ⛔ **AN EARLIER VERSION OF THIS SECTION CALLED `patient-mode-required` AC-R1
    UNRESOLVED AND `phase14a` AC-7 A REGRESSION. BOTH WERE WRONG, IN OPPOSITE
    DIRECTIONS, AND BOTH FOR THE SAME REASON: A FLAKY TEST SAMPLED ONCE PER ARM.**
    AC-R1 was a red taken during an infra flap (auth 500s, `db` container restarting)
    and is green 5/5 on a quiet stack. AC-7 was worse — one control pass against one
    failure read as "my change broke it", and the A/B was only run because the single
    pass looked decisive. Run six times per arm it is **2 pass / 4 fail WITH the change
    set and 1 pass / 5 fail on the PRISTINE tree**: pre-existing, and marginally *more*
    flaky without the change. It focuses through `Locator.focus()`, the idiom
    `patient-mode-required`'s own docblock documents as unreliable after a
    `router.refresh()`.
    ⚠ The lesson is not "re-run reds" — it is that **one run per arm cannot distinguish a
    regression from a flake in either direction**, and a control that agrees with the
    hypothesis is the one least likely to be repeated. Compare RATES, n ≥ 5.
  - Layout was additionally verified by reading field order straight off the live DOM on
    all four PHI dialogs, plus the rail order and the read-only published card.
