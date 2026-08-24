import { expect, type Locator, type Page } from '@playwright/test'
import { notFoundKind } from './not-found'

/**
 * THE CASE-WIDE AFFORDANCE CLASS — derived by property, shared by every spec that
 * needs it.
 *
 * THE PROPERTY: *an affordance rendered by `CaseDetailView` (or by the manage
 * `(detail)` layout header, which is its twin) whose visibility gate is a CASE-WIDE
 * capability.* Everything else on the page is flag-gated, data-gated, or
 * NAME-attributed (the assignee tests precede the capability tests — ADR 0033 Q14 /
 * CA-002) and is therefore NOT in the class.
 *
 * The six gates are all resolved in ONE file,
 * `src/components/cases/case-detail-view.tsx`; that single derivation point is what
 * makes this an enumeration of a property rather than a checklist. The full
 * derivation, the NEVER-FED annotations, and the N1/N2 neutralization record live in
 * `e2e/casos-reading-surface-differential.spec.ts`'s header — read that before
 * changing anything here.
 *
 * ⛔ DO NOT EXTEND THIS BY ADDING A LABEL SOMEONE NAMED — re-run the derivation. The
 * follow-up that produced it was filed WRONG TWICE, both times because a hand-list
 * stood in for the property (v1's sweep was bounded by BUTTON LABELS and missed the
 * member whose control is labelled "Adicionar"; v2 reported a whole class as newly
 * narrowed when only one viewer class's cells were).
 *
 * ⭐ WHY THIS LIVES IN `helpers/` (QA case-surface-split-increment-2-review.md M-15).
 * It was module-private to the differential spec, so the very next spec that needed
 * "the read-only shell" — `case-surface-split-increment-2.spec.ts`'s S8-only
 * administrativo — named TWO absences by hand against this 16-member derived class,
 * in the same delivery that derived it. A hand-list beside an available derivation
 * is the failure this class exists to stop. Importing a `*.spec.ts` from another
 * spec would re-register its tests, so extraction here is the only safe reuse.
 */

/** The case HEADER on either host — the only `<header>` on the page carrying an h1. */
export function caseHeader(page: Page): Locator {
  return page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })
}

export const region = (page: Page, name: RegExp) => page.getByRole('region', { name })

/**
 * One member of the case-wide affordance class.
 *
 * `structure` is the load-bearing half: the region (or header) that HOSTS the
 * control, asserted present on BOTH hosts. That is what makes a `control` count of
 * 0 mean "the control is gone" rather than "the panel is gone" — the failure mode
 * that lets a bare absence assertion pass for the wrong reason.
 */
export interface Member {
  gate: 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6'
  name: string
  structure: (page: Page) => Locator
  control: (page: Page) => Locator
}

/** G1 — `caps.canWriteContent`. NEW for a write-grantee; PRE-EXISTING for a coordinator. */
export const G1_MEMBERS: Member[] = [
  {
    gate: 'G1',
    name: 'Novo item (Itens de ação)',
    structure: (p) => region(p, /^Itens de ação$/),
    control: (p) => region(p, /^Itens de ação$/).getByRole('button', { name: 'Novo item' }),
  },
  {
    gate: 'G1',
    // ⚠ SUBSTITUTED 2026-08-23 (ADR 0137 D12) — the "Registros" card was
    // redesigned as "Atividade": the region's accessible name is now driven by
    // its own `h2` ("Atividade"), so `region(/^Registros$/)` no longer matches
    // anything and the member would read as permanently absent rather than
    // relocated. The G1 `canWriteContent` control is now the inline COMPOSER's
    // submit button ("Registrar"/"Registrando…" while pending), not a
    // dialog-opening "Adicionar registro" button — that button no longer
    // exists on this card (the full form is now reached via "Mais detalhes").
    // Same property (a write-grantee's ability to add a manual record), same
    // gate, new name and control — not a different affordance.
    // ⛔ Anchored exactly like every sibling (`^…$`). The count badge beside
    // "Atividade" carries `aria-hidden="true"` (component fix, 2026-08-23) —
    // an EARLIER version of this locator had to widen past that count while
    // the badge was still exposed to the accessible name; that workaround is
    // gone now that the component is fixed. Do not re-widen this without
    // re-confirming the badge is still hidden.
    name: 'Registrar (Atividade)',
    structure: (p) => region(p, /^Atividade$/),
    control: (p) => region(p, /^Atividade$/).getByRole('button', { name: 'Registrar' }),
  },
  {
    gate: 'G1',
    name: 'Anexar documento (Documentos)',
    structure: (p) => region(p, /^Documentos$/),
    control: (p) => region(p, /^Documentos$/).getByRole('button', { name: 'Anexar documento' }),
  },
  {
    gate: 'G1',
    // The tag editor — the member v1 of the follow-up missed ENTIRELY, because its
    // existing coverage keys off a role+region locator and its control is labelled
    // "Adicionar", a string a button-label sweep for "tags" can never hit.
    name: 'Adicionar etiqueta (Etiquetas)',
    structure: (p) => region(p, /^Etiquetas$/),
    control: (p) => region(p, /^Etiquetas$/).getByRole('button', { name: 'Adicionar' }),
  },
]

/** G2 — `caps.canManageLifecycle`. PRE-EXISTING for every class (`8675b7cd`). */
export const G2_MEMBERS: Member[] = [
  {
    gate: 'G2',
    name: 'Encaminhar caso (Encaminhamentos)',
    structure: (p) => region(p, /^Encaminhamentos$/),
    control: (p) => region(p, /^Encaminhamentos$/).getByRole('button', { name: 'Encaminhar caso' }),
  },
  {
    gate: 'G2',
    name: 'Nova entrevista (Entrevistas)',
    structure: (p) => region(p, /^Entrevistas$/),
    control: (p) => region(p, /^Entrevistas$/).getByRole('button', { name: /nova entrevista/i }),
  },
  {
    gate: 'G2',
    name: 'Adicionar participante (Participantes)',
    structure: (p) => region(p, /^Participantes$/),
    control: (p) =>
      region(p, /^Participantes$/).getByRole('button', { name: 'Adicionar participante' }),
  },
  {
    gate: 'G2',
    // The whole outcome BLOCK is lifecycle-gated, so on `/casos` the region itself
    // is what disappears — the one member whose structural anchor cannot be the
    // region it lives in. Anchored on the work zone (present on both hosts) instead;
    // the region's own absence IS the assertion.
    name: 'Desfecho do caso (seletor de desfecho)',
    structure: (p) => region(p, /^Trabalho do caso$/),
    control: (p) => region(p, /^Desfecho do caso$/),
  },
  {
    gate: 'G2',
    name: 'Não necessária (fase pendente)',
    structure: (p) => region(p, /^Trabalho do caso$/),
    control: (p) => region(p, /^Trabalho do caso$/).getByRole('button', { name: 'Não necessária' }),
  },
  {
    gate: 'G2',
    // NEVER-FED — `adHocForms` is not passed by `/casos`, so neutralizing the
    // narrowing does NOT bring this back (measured, N1 + N2). A regression guard
    // against the fuel being restored, not a proof about the narrowing.
    name: 'Adicionar fase (rodapé do trabalho do caso) [NEVER-FED]',
    structure: (p) => region(p, /^Trabalho do caso$/),
    control: (p) => region(p, /^Trabalho do caso$/).getByRole('button', { name: 'Adicionar fase' }),
  },
  {
    gate: 'G2',
    // NEVER-FED — `adHocNarrativeTypes`, same as above.
    name: 'Adicionar narrativa (rodapé do trabalho do caso) [NEVER-FED]',
    structure: (p) => region(p, /^Trabalho do caso$/),
    control: (p) =>
      region(p, /^Trabalho do caso$/).getByRole('button', { name: 'Adicionar narrativa' }),
  },
]

/** G3 — `effectiveCanAssignPhases`. NEW for an administrativo; PRE-EXISTING for a coordinator. */
export const G3_MEMBERS: Member[] = [
  {
    gate: 'G3',
    name: 'Ativar e atribuir (fase pendente)',
    structure: (p) => region(p, /^Trabalho do caso$/),
    control: (p) => region(p, /^Trabalho do caso$/).getByRole('button', { name: 'Ativar e atribuir' }),
  },
]

/** G5 — `effectiveCanManagePhaseResults`. PRE-EXISTING for EVERY class. */
export const G5_MEMBERS: Member[] = [
  {
    gate: 'G5',
    name: 'Corrigir resultado (fase concluída que emite resultado)',
    structure: (p) => region(p, /^Trabalho do caso$/),
    control: (p) =>
      region(p, /^Trabalho do caso$/).getByRole('button', { name: 'Corrigir resultado' }),
  },
]

/**
 * G6 — the case-meta edit door. NEW for an administrativo. ⚠ Its `/casos` absence
 * is STRUCTURAL: ADR 0134 F-5 deleted the dialog's JSX from `CaseDetailView`, so no
 * neutralization can bring it back (measured, N1 + N2). What carries the
 * differential here is the manage-side positive.
 */
export const G6_MEMBERS: Member[] = [
  {
    gate: 'G6',
    name: 'Editar (metadados do caso, no cabeçalho)',
    structure: caseHeader,
    control: (p) => caseHeader(p).getByRole('button', { name: /^Editar$/ }),
  },
]

/**
 * G2, NEVER-FED — the offered-outcomes EDITOR. Rendered only on a PROCESS-LESS case
 * (`isProcessless`), so it is exercised on its own fixture by PLESS-1 rather than in
 * the main table.
 */
export const PLESS_MEMBER: Member = {
  gate: 'G2',
  name: 'Editar desfechos disponíveis (editor do conjunto ofertado) [NEVER-FED]',
  structure: caseHeader,
  control: (p) => p.getByRole('button', { name: 'Editar desfechos disponíveis' }),
}

/**
 * G4 — custom-field editing. The panel renders only when the case CARRIES values, and
 * exactly one case platform-wide does, so it is exercised on that seeded case by CF-1.
 */
export const CF_MEMBER: Member = {
  gate: 'G4',
  name: 'Editar (Campos personalizados)',
  structure: (p) => region(p, /^Campos personalizados$/),
  control: (p) => region(p, /^Campos personalizados$/).getByRole('button', { name: /^Editar$/ }),
}

/** The members exercised together on the templated fixture case (COORD-1's table). */
export const CASE_WIDE_CLASS: Member[] = [
  ...G1_MEMBERS,
  ...G2_MEMBERS,
  ...G3_MEMBERS,
  ...G5_MEMBERS,
  ...G6_MEMBERS,
]

/**
 * THE WHOLE DERIVED CLASS — 16 members. `CASE_WIDE_CLASS` is only the 14 that share
 * one fixture; the other two need a case of a particular SHAPE (process-less /
 * carrying custom-field values) and so live in their own tests. They are declared
 * HERE, beside the rest, because an enumeration split across files is a hand-list
 * again — and a hand-list is what this whole class exists to replace.
 */
export const FULL_CLASS: Member[] = [...CASE_WIDE_CLASS, PLESS_MEMBER, CF_MEMBER]

/**
 * ⛔ THE PAGE-LEVEL ANCHOR, required by every assertion below.
 *
 * An absence assertion passes for free against a 404, a crashed render, or a
 * navigation that never landed. Every helper here establishes FIRST that a case
 * detail actually painted, so "the control is absent" can never be satisfied by
 * "there is no page".
 *
 * ⛔ WHY NOT "an h1 is visible" — MEASURED, and it was this helper's own first
 * draft. `c/[commission]/not-found.tsx` renders `<h1>Página não encontrada</h1>`, so
 * a bare level-1-heading anchor is SATISFIED BY THE 404 PAGE and the sweep then runs
 * 16 absence checks against a boundary, every one of them passing for free. The
 * probe that was supposed to prove the anchor could fail is what caught it.
 *
 * The anchor is therefore the case HEADER (a `<header>` carrying an h1 — the 404
 * boundary renders a `<section>`), cross-checked against the 404 detector itself.
 *
 * ⚠ It returns a KIND, not a boolean: a failure says whether the root boundary, the
 * commission boundary, or nothing at all is on screen. A boolean anchor collapses
 * "the shell refused", "the page refused" and "still loading" into one "false".
 */
type DetailState = 'rendered' | 'root-404' | 'commission-404' | 'nothing'

async function detailState(page: Page): Promise<DetailState> {
  const kind = await notFoundKind(page)
  if (kind === 'root') return 'root-404'
  if (kind === 'commission') return 'commission-404'
  if ((await caseHeader(page).count()) > 0) return 'rendered'
  return 'nothing'
}

async function assertCaseDetailRendered(page: Page, where: string) {
  await expect
    .poll(() => detailState(page), {
      message: `${where}: a case detail must actually RENDER before any assertion below can mean anything`,
      timeout: 15_000,
    })
    .toBe('rendered')
}

/**
 * One half of a differential: every member's host structure renders, and every
 * member's control is ABSENT.
 *
 * ⚠ The per-member verdicts are COLLECTED and asserted once, deliberately. A
 * fail-fast loop reports only the FIRST member that regressed, which is precisely
 * the shape that makes a class look swept when one axis of it was measured — the
 * error this whole class exists to stop repeating.
 */
export async function assertAbsentOnCasos(page: Page, members: Member[]) {
  await assertCaseDetailRendered(page, '/casos')
  const unexpectedlyPresent: string[] = []
  for (const m of members) {
    await expect(m.structure(page), `${m.name}: host structure must render on /casos`).toBeVisible({
      timeout: 15_000,
    })
    if ((await m.control(page).count()) > 0) unexpectedlyPresent.push(`${m.gate} · ${m.name}`)
  }
  expect(
    unexpectedlyPresent,
    'these case-wide affordances must be ABSENT on /casos (ADR 0134 D1/D2)',
  ).toEqual([])
}

/**
 * The other half: the SAME controls, for the SAME user and case, on the manage host.
 *
 * ⛔ THE WAIT IS REAL NOW (QA M-15). This used to read
 * `.isVisible({ timeout: 15_000 })`. `Locator.isVisible()` does NOT auto-wait — its
 * `timeout` option is ignored — so that 15 000 was INERT and the check was a bare
 * snapshot dressed as a wait. It failed in the safe direction (a late-rendering
 * control was reported MISSING, i.e. a false red), but a number that does nothing is
 * worse than no number: it stops the next reader from asking. `waitFor` honours it.
 */
export async function assertPresentOnManage(page: Page, members: Member[]) {
  await assertCaseDetailRendered(page, '/manage/cases')
  const missing: string[] = []
  for (const m of members) {
    await expect(
      m.structure(page),
      `${m.name}: host structure must render on /manage/cases`,
    ).toBeVisible({ timeout: 15_000 })
    const visible = await m
      .control(page)
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false)
    if (!visible) missing.push(`${m.gate} · ${m.name}`)
  }
  expect(
    missing,
    'these case-wide affordances must be PRESENT on /manage/cases — the positive controls that make the absences above a RELOCATION, not a deletion',
  ).toEqual([])
}

/**
 * A both-hosts control: a class the viewer never held, absent HERE for its own
 * reason.
 *
 * ⛔ IT HAS A STRUCTURE CHECK NOW (QA M-15). This was the only helper with none — a
 * bare `count() > 0` sweep, which passes identically when the panels are gone, the
 * page 404'd, or the navigation never landed. It now shares the page-level anchor
 * and checks each member's host structure, so an empty `present` list means "the
 * controls are absent from panels that ARE on the page".
 *
 * ⚠ Structure verdicts are COLLECTED, not fail-fast, for the same reason the control
 * verdicts are: a fail-fast structure check reports only the first missing panel and
 * hides how much of the class was never really measured. Both lists are asserted.
 */
export async function assertAbsentHere(
  page: Page,
  members: Member[],
  why: string,
  where = 'this host',
) {
  await assertCaseDetailRendered(page, where)
  const present: string[] = []
  const structureMissing: string[] = []
  for (const m of members) {
    const rendered = await m
      .structure(page)
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
    if (!rendered) structureMissing.push(`${m.gate} · ${m.name}`)
    if ((await m.control(page).count()) > 0) present.push(`${m.gate} · ${m.name}`)
  }
  expect(
    structureMissing,
    `${why} — but FIRST: every member's host structure must render on ${where}, or the absences below are about a page that is not there`,
  ).toEqual([])
  expect(present, why).toEqual([])
}
