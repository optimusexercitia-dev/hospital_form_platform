import { test, expect } from '@playwright/test'

import {
  CONFORMIDADE_COLS,
  CONFORMIDADE_ROWS,
  LIKELIHOOD_COLS,
  ORG,
  RISK_BANDS_SQL,
  SEVERITY_ROWS,
  SLUG,
  axisInsert,
  cellsOf,
  enterWizard,
  getToken,
  psql,
  purgeByTag,
  readonlyCell,
  responseIdFromUrl,
  responseStatus,
  riskOf,
  rpcAs,
  seedForm,
  signInAs,
  sqlOne,
  sqlRows,
} from './helpers/ff2-matrix'

/**
 * FF-2 Wave 3 — the matrix READ surfaces (ADR 0089 · FUP-FF2-1 / FUP-FF2-2).
 *
 * Three producers project the matrix, and two of them shipped the SAME
 * predicate defect (`isInputItem` where `isAnswerableItem` was meant, so a
 * matrix fell through to the display branch and rendered nothing). They are
 * covered as three separate cases, not as variants of one:
 *
 *   FF2V-1  the SIGN-OFF route — the screen nobody had opened. A staff_admin
 *           counter-signs a section whose content is a matrix; before Wave 3
 *           the door did not project the cells at all, so the signature went
 *           over an EMPTY GRID. Also carries BUG-FF1-007 (an empty-string
 *           observation must be absent from the payload) and a matrix inside a
 *           repeating group, which renders through `InstanceAnswersReadonly` —
 *           a different path from the top-level one.
 *   FF2V-2  `getSubmissionDetail` — the third producer, its own case.
 *   FF2V-3  the DASHBOARD cell-unit distribution + risk summary, against three
 *           deliberately DIFFERENT submissions so a mis-keyed pivot cannot pass
 *           (identical answers would agree with almost any grouping bug).
 *   FF2V-4  aggregation keys on `rowCode`, never the label: relabel an axis in a
 *           clone and the series must NOT split (ruling 4's whole purpose).
 *   FF2V-5  a STORED `risk_score` outranks the product recomputed from current
 *           weights — a re-weighting must not restate what a historical
 *           response, and a signature over it, appear to say.
 *
 * Hermetic: every form is spec-owned (title carries SPEC_TAG) and purged.
 * Fixtures are built by postgres exactly as `supabase/seed.sql` does for the
 * seeded matrix form — `supabase/seed.sql` itself is `backend`'s file and is
 * shared with pgTAP, so it is deliberately NOT touched. The AUTHORING path is
 * already covered end-to-end by `ff2-matrix.spec.ts` (FF2-1, FF2-5, FF2-9).
 */

test.use({ viewport: { width: 1280, height: 1400 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const SPEC_TAG = 'FF2V-SPEC'

test.beforeAll(() => {
  purgeByTag(SPEC_TAG)
})
test.afterAll(() => {
  purgeByTag(SPEC_TAG)
})

// ---------------------------------------------------------------------------
// Fixture bodies
// ---------------------------------------------------------------------------

/** A matrix + a weighted/banded risk matrix + a short_text, in one section. */
function matrixAndRiskBody(prefix: string) {
  return ({
    versionId,
    sectionId,
    id,
  }: {
    versionId: string
    sectionId: string
    id: (n: string) => string
  }) => {
    const matrixId = id('matrix')
    const riskId = id('risk')
    const textId = id('text')
    return (
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${matrixId}','${sectionId}',0,'matrix','${prefix}_grade','Avalie cada critério',false);\n` +
      axisInsert('form_matrix_rows', matrixId, versionId, CONFORMIDADE_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', matrixId, versionId, CONFORMIDADE_COLS) +
      '\n' +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)\n` +
      `values ('${riskId}','${sectionId}',1,'risk_matrix','${prefix}_risco','Classifique o risco',false,${RISK_BANDS_SQL});\n` +
      axisInsert('form_matrix_rows', riskId, versionId, SEVERITY_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', riskId, versionId, LIKELIHOOD_COLS) +
      '\n' +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${textId}','${sectionId}',2,'short_text','${prefix}_obs','Responsável pela verificação',false);`
    )
  }
}

/** Save a whole matrix payload for one section under a persona's token. */
async function saveMatrix(
  page: import('@playwright/test').Page,
  token: string,
  responseId: string,
  sectionId: string,
  body: Record<string, unknown>,
) {
  const resp = await rpcAs<unknown>(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: sectionId,
    ...body,
  })
  expect(resp.ok, `save_section_answers: ${resp.text}`).toBeTruthy()
}

// ===========================================================================
// FF2V-1 — The sign-off route: the screen nobody had opened
// ===========================================================================

test('FF2V-1 (sign-off route): a staff_admin counter-signs a section whose content is a matrix — top-level grid, per-instance grids and the risk score all render BY VALUE, and an empty observation is absent from the payload', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Assinatura ${SPEC_TAG} ${Date.now()}`

  const fx = seedForm(
    title,
    ({ versionId, sectionId, id }) => {
      const base = matrixAndRiskBody('ff2v_sign')({ versionId, sectionId, id })
      const groupId = id('group')
      const childId = id('groupMatrix')
      return (
        base +
        '\n' +
        `insert into public.form_items (id, section_id, position, item_type, label, config)\n` +
        `values ('${groupId}','${sectionId}',3,'repeating_group','Setor auditado',\n` +
        `        jsonb_build_object('minInstances',0,'maxInstances',5));\n` +
        `insert into public.form_items (id, section_id, position, item_type, question_key, label, required, parent_item_id)\n` +
        `values ('${childId}','${sectionId}',4,'matrix','ff2v_sign_setor','Avalie o setor',false,'${groupId}');\n` +
        axisInsert('form_matrix_rows', childId, versionId, CONFORMIDADE_ROWS) +
        '\n' +
        axisInsert('form_matrix_columns', childId, versionId, CONFORMIDADE_COLS)
      )
    },
    { signoff: true },
  )

  // --- The respondent fills it (stays in_progress: a staff_admin sign-off
  //     happens BEFORE submit — `submit_response` refuses to finalize while a
  //     required staff_admin section is unsigned, HC012). -------------------
  await signInAs(page, 'staff1.ccih@test.local')
  const staffToken = await getToken(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  await saveMatrix(page, staffToken, responseId, fx.sectionId, {
    p_matrix_cells: {
      [fx.items.matrix]: {
        higienizacao: 'conforme',
        epi: 'nao_conforme',
        descarte: 'na',
      },
    },
    p_risk_matrix: {
      [fx.items.risk]: { severity: 'grave', likelihood: 'provavel' },
    },
    p_answers: { [fx.items.text]: 'Enfermeira Marta' },
  })

  // BUG-FF1-007 — an EMPTY observation, planted DIRECTLY.
  //
  // Passing `p_observations: {item: ''}` does not produce one: both writers
  // (`save_section_answers` and `app.save_instance_answers`) normalize with
  // `nullif(btrim(...), '')`, so an empty — or whitespace-only — observation is
  // UNREACHABLE through either canonical write path and lands as NULL. Verified
  // against `pg_proc`, and the first draft of this test asserted it into a red
  // bar by assuming otherwise.
  //
  // So `bf7fae1`'s filter is defence-in-depth over rows that predate that
  // normalization (or any non-RPC path), and reproducing it means planting the
  // legacy row. Fixture-only: the state under test is a legacy row, and no
  // product behaviour is being simulated here — only its input.
  psql(
    `update public.answers set observation = ''\n` +
      ` where response_id = '${responseId}' and item_id = '${fx.items.text}';`,
  )

  // Two repeating-group instances, each holding ONLY a matrix — the
  // `InstanceAnswersReadonly` path, and incidentally ADR 0089 §A again.
  const instanceIds: string[] = []
  for (const cells of [
    { higienizacao: 'conforme', epi: 'conforme', descarte: 'conforme' },
    { higienizacao: 'nao_conforme', epi: 'na', descarte: 'nao_conforme' },
  ]) {
    const added = await rpcAs<{ id: string }>(page, staffToken, 'add_group_instance', {
      p_response_id: responseId,
      p_group_item_id: fx.items.group,
    })
    expect(added.ok, `add_group_instance: ${added.text}`).toBeTruthy()
    instanceIds.push(added.json.id)
    await saveMatrix(page, staffToken, responseId, fx.sectionId, {
      p_instance_answers: [
        { instance_id: added.json.id, matrix_cells: { [fx.items.groupMatrix]: cells } },
      ],
    })
  }

  // Arrange is REAL: the empty observation is on the row, not merely intended.
  //
  // Read through a SENTINEL rather than the raw column: `psql -tA` prints an
  // empty string for both "one row holding ''" and "no rows at all", so a bare
  // `select observation` cannot tell the state under test from its own absence
  // — which is precisely the assertion this test exists to make.
  expect(
    sqlOne(
      `select case
                when observation is null then 'NULL'
                when observation = '' then 'EMPTY'
                else 'TEXT'
              end
         from public.answers
        where response_id = '${responseId}' and item_id = '${fx.items.text}';`,
    ),
    'a observação vazia precisa existir no banco, senão o filtro abaixo não prova nada',
  ).toBe('EMPTY')

  // --- BUG-FF1-007, asserted where the fix actually lives: the DOOR's payload.
  //     The rendered screen cannot distinguish '' from absent (AnswerSummary
  //     trims and drops a falsy note), so the screen assertion further down is
  //     a weak guard and THIS is the strong one. Canonical server path, under
  //     the signer's own token. -------------------------------------------
  const chefeToken = await getToken(page, 'chefe.ccih@test.local')
  const payload = await rpcAs<{ observations_by_item?: Record<string, string> }>(
    page,
    chefeToken,
    'get_response_for_signoff',
    { p_response_id: responseId },
  )
  expect(payload.ok, `get_response_for_signoff: ${payload.text}`).toBeTruthy()
  const observations = payload.json?.observations_by_item ?? {}
  expect(
    Object.prototype.hasOwnProperty.call(observations, fx.items.text),
    'uma observação VAZIA não pode aparecer no payload de assinatura (BUG-FF1-007)',
  ).toBe(false)

  // The same payload must carry the matrix halves — the FUP-FF2-1 fix.
  const projected = payload.json as unknown as {
    matrix_cells_by_item?: Record<string, Record<string, string>>
    risk_matrix_by_item?: Record<string, unknown>
  }
  expect(
    projected.matrix_cells_by_item?.[fx.items.matrix],
    'o door de assinatura precisa projetar as células da matriz',
  ).toEqual({ higienizacao: 'conforme', epi: 'nao_conforme', descarte: 'na' })
  expect(projected.risk_matrix_by_item?.[fx.items.risk]).toBeTruthy()

  // --- The screen itself. This is the composition nobody had seen. --------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/assinaturas/${responseId}`)
  await expect(page.getByRole('heading', { name: /Verificação em campo/ }).first()).toBeVisible({
    timeout: 20_000,
  })

  // TOP-LEVEL grid, by value — the exact cells, and a NEGATIVE so "renders a
  // grid" cannot be mistaken for "renders THIS grid".
  //
  // Scoped to its OWN grid: the per-instance grids below use the same row and
  // column labels, so an unscoped match is ambiguous (it resolved to 2 elements
  // on the first run). That ambiguity is a property of the screen being right —
  // several real grids on one page — not of the locator being lazy.
  const topGrid = page.getByRole('group', { name: /^Avalie cada critério/ })
  await expect(topGrid).toBeVisible()
  await expect(readonlyCell(topGrid, 'Higienização das mãos', 'Conforme')).toBeAttached()
  await expect(readonlyCell(topGrid, 'Uso de EPI', 'Não conforme')).toBeAttached()
  await expect(
    readonlyCell(topGrid, 'Descarte de perfurocortantes', 'Não se aplica'),
  ).toBeAttached()
  await expect(
    readonlyCell(topGrid, 'Higienização das mãos', 'Não conforme', 'não selecionado'),
  ).toBeAttached()

  // The RISK answer: 9 × 3 = 27, banded Alto.
  const riskStatus = page.getByRole('status').filter({ hasText: 'Pontuação:' }).first()
  await expect(riskStatus).toContainText('27')
  await expect(riskStatus).toContainText('Alto')

  // PER-INSTANCE grids — a different rendering path (InstanceAnswersReadonly).
  // Instance 1 is all-Conforme, instance 2 is not: asserting a cell unique to
  // each proves they are not the same grid drawn twice.
  // `InstanceAnswersReadonly` renders each repetition as a <fieldset>/<legend>,
  // which is ARIA `group` — NOT the `region` the wizard's own instance block
  // uses. Different component, different role; asserting the wizard's shape
  // here would be asserting a screen this route never renders.
  const inst1 = page.getByRole('group', { name: 'Setor auditado 1 de 2' })
  const inst2 = page.getByRole('group', { name: 'Setor auditado 2 de 2' })
  await expect(inst1).toBeVisible()
  await expect(inst2).toBeVisible()
  await expect(readonlyCell(inst1, 'Uso de EPI', 'Conforme')).toBeAttached()
  await expect(readonlyCell(inst2, 'Uso de EPI', 'Não se aplica')).toBeAttached()
  await expect(
    readonlyCell(inst2, 'Uso de EPI', 'Conforme', 'não selecionado'),
  ).toBeAttached()

  // The weak-but-asked-for half of BUG-FF1-007: no stray empty note rendered.
  await expect(page.getByText('Observação:', { exact: true })).toHaveCount(0)

  // --- And the signature actually goes through on this screen -------------
  await page.getByRole('button', { name: 'Assinar seção' }).first().click()
  await expect
    .poll(
      () =>
        sqlOne(
          `select count(*)::text from public.response_section_signoffs
            where response_id = '${responseId}' and section_id = '${fx.signoffSectionId}';`,
        ),
      { timeout: 20_000, message: 'a assinatura não foi persistida' },
    )
    .toBe('1')
  expect(
    sqlOne(
      `select signed_by::text from public.response_section_signoffs
        where response_id = '${responseId}' and section_id = '${fx.signoffSectionId}';`,
    ),
  ).toBe('00000000-0000-0000-0000-000000000002')

  // Nothing about signing disturbed the answers it attested to.
  expect(cellsOf(responseId, fx.items.matrix)).toEqual([
    ['higienizacao', 'conforme'],
    ['epi', 'nao_conforme'],
    ['descarte', 'na'],
  ])
})

// ===========================================================================
// FF2V-2 — `getSubmissionDetail`, the third producer
// ===========================================================================

test('FF2V-2 (submission detail): a submitted response shows its matrix grid and derived risk score by value — the third producer, which carried the same predicate defect', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Detalhe ${SPEC_TAG} ${Date.now()}`
  const fx = seedForm(title, matrixAndRiskBody('ff2v_det'))

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  await saveMatrix(page, token, responseId, fx.sectionId, {
    p_matrix_cells: {
      [fx.items.matrix]: {
        higienizacao: 'na',
        epi: 'conforme',
        descarte: 'nao_conforme',
      },
    },
    p_risk_matrix: {
      [fx.items.risk]: { severity: 'moderada', likelihood: 'frequente' },
    },
  })
  const submit = await rpcAs<unknown>(page, token, 'submit_response', {
    p_response_id: responseId,
  })
  expect(submit.ok, `submit_response: ${submit.text}`).toBeTruthy()
  expect(responseStatus(responseId)).toBe('submitted')
  // 3 × 9 = 27, so the band is Alto here too — but via a DIFFERENT cell than
  // FF2V-1, so a hard-coded 'grave/provavel' anywhere would show up.
  expect(riskOf(responseId, fx.items.risk)).toEqual([['moderada', 'frequente', '27']])

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/dashboard/submissions/${responseId}`)

  await expect(readonlyCell(page, 'Higienização das mãos', 'Não se aplica')).toBeAttached({
    timeout: 20_000,
  })
  await expect(readonlyCell(page, 'Uso de EPI', 'Conforme')).toBeAttached()
  await expect(
    readonlyCell(page, 'Descarte de perfurocortantes', 'Não conforme'),
  ).toBeAttached()
  await expect(
    readonlyCell(page, 'Uso de EPI', 'Não conforme', 'não selecionado'),
  ).toBeAttached()

  const riskStatus = page.getByRole('status').filter({ hasText: 'Pontuação:' }).first()
  await expect(riskStatus).toContainText('27')
  await expect(riskStatus).toContainText('Alto')
})

// ===========================================================================
// FF2V-3 — Dashboard: cell-unit distribution + risk summary
// ===========================================================================

test('FF2V-3 (dashboard): the cell distribution counts by (row, col) across three DIFFERENT submissions, the risk summary reports média 36,33 · mínima 1 · máxima 81, and every cell prints its number', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const title = `Painel ${SPEC_TAG} ${Date.now()}`
  const fx = seedForm(title, matrixAndRiskBody('ff2v_dash'))

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')

  // Three DELIBERATELY different submissions. Identical answers would agree
  // with almost any grouping bug; these do not.
  //   higienizacao → conforme, conforme, nao_conforme   = 2 / 1 / 0
  //   epi          → conforme, nao_conforme, nao_conforme = 1 / 2 / 0
  //   descarte     → conforme, na, conforme             = 2 / 0 / 1
  //   risk scores  → 27, 1, 81   ⇒ média 36,33 · mín 1 · máx 81
  const submissions = [
    {
      cells: { higienizacao: 'conforme', epi: 'conforme', descarte: 'conforme' },
      risk: { severity: 'grave', likelihood: 'provavel' }, // 9 × 3 = 27
      score: '27',
    },
    {
      cells: { higienizacao: 'conforme', epi: 'nao_conforme', descarte: 'na' },
      risk: { severity: 'leve', likelihood: 'rara' }, // 1 × 1 = 1
      score: '1',
    },
    {
      cells: { higienizacao: 'nao_conforme', epi: 'nao_conforme', descarte: 'conforme' },
      risk: { severity: 'grave', likelihood: 'frequente' }, // 9 × 9 = 81
      score: '81',
    },
  ]

  for (const s of submissions) {
    await enterWizard(page, title)
    const rid = responseIdFromUrl(page)
    await saveMatrix(page, token, rid, fx.sectionId, {
      p_matrix_cells: { [fx.items.matrix]: s.cells },
      p_risk_matrix: { [fx.items.risk]: s.risk },
    })
    const submit = await rpcAs<unknown>(page, token, 'submit_response', {
      p_response_id: rid,
    })
    expect(submit.ok, `submit_response: ${submit.text}`).toBeTruthy()
    expect(riskOf(rid, fx.items.risk)[0][2]).toBe(s.score)
  }

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/dashboard?form=${fx.formId}`)

  const card = page.locator('article').filter({ hasText: 'Avalie cada critério' }).first()
  await expect(card).toBeVisible({ timeout: 25_000 })
  await expect(card).toContainText('3 grades preenchidas')

  /**
   * The COUNT in one data cell, by its row + column headers.
   *
   * Read from the count's own <span>, never by parsing the cell's text: the
   * count and its share are adjacent spans separated only by a margin, so
   * `innerText` yields "267%" for "2" + "67%" — and a leading-digits regex
   * would confidently read 267. (Observed, not theorised: the first version of
   * this helper did exactly that.)
   */
  const distCount = async (rowLabel: string, colLabel: string): Promise<string> => {
    const cols = await card.locator('thead th').allTextContents()
    const colIndex = cols.findIndex((t) => t.trim() === colLabel)
    expect(
      colIndex,
      `coluna "${colLabel}" não encontrada em ${JSON.stringify(cols)}`,
    ).toBeGreaterThan(0)
    const row = card.locator('tbody tr').filter({ hasText: rowLabel }).first()
    // -1 because the row header is a <th>, not a <td>.
    const cellSpan = row.locator('td').nth(colIndex - 1).locator('span').first()
    return (await cellSpan.innerText()).trim()
  }

  expect(await distCount('Higienização das mãos', 'Conforme')).toBe('2')
  expect(await distCount('Higienização das mãos', 'Não conforme')).toBe('1')
  expect(await distCount('Higienização das mãos', 'Não se aplica')).toBe('0')
  expect(await distCount('Uso de EPI', 'Conforme')).toBe('1')
  expect(await distCount('Uso de EPI', 'Não conforme')).toBe('2')
  expect(await distCount('Uso de EPI', 'Não se aplica')).toBe('0')
  expect(await distCount('Descarte de perfurocortantes', 'Conforme')).toBe('2')
  expect(await distCount('Descarte de perfurocortantes', 'Não conforme')).toBe('0')
  expect(await distCount('Descarte de perfurocortantes', 'Não se aplica')).toBe('1')

  // COLOUR IS NEVER THE ONLY CHANNEL: every data cell prints a number, so a
  // greyscale print or a reader who cannot resolve the tint steps loses
  // nothing. Asserted over ALL cells, not a sample.
  const dataCells = await card.locator('tbody td').allInnerTexts()
  expect(dataCells.length).toBe(9)
  for (const text of dataCells) {
    expect(text.trim(), 'toda célula precisa imprimir seu número').toMatch(/^\d+/)
  }

  // --- The risk summary card ---------------------------------------------
  const riskCard = page.locator('article').filter({ hasText: 'Classifique o risco' }).first()
  await expect(riskCard).toBeVisible()
  // pt-BR decimal comma: (27 + 1 + 81) / 3 = 36,33.
  await expect(riskCard).toContainText('36,33')
  await expect(riskCard).toContainText('Média')
  await expect(riskCard).toContainText('Mínima')
  await expect(riskCard).toContainText('Máxima')

  /**
   * One summary stat, read as <dt>label</dt> → its own <dd>.
   *
   * NOT by scanning `innerText`: the labels carry Tailwind's `uppercase`, and
   * `innerText` applies CSS text-transform, so the card's text really does read
   * "MÍNIMA" and a `/Mínima/` regex over it never matches. `filter({hasText})`
   * works off textContent, which is untransformed — the same reason
   * `toContainText('Mínima')` above passes.
   */
  const stat = async (label: string): Promise<string> => {
    const dt = riskCard.locator('dt').filter({ hasText: label }).first()
    return (await dt.locator('xpath=following-sibling::dd[1]').innerText()).trim()
  }
  expect(await stat('Mínima')).toBe('1')
  expect(await stat('Máxima')).toBe('81')
  expect(await stat('Média')).toContain('36,33')
})

// ===========================================================================
// FF2V-4 — Aggregation keys on the CODE, never the label (ruling 4)
// ===========================================================================

test('FF2V-4 (ruling 4): relabelling an axis in a clone does NOT split the dashboard series — the cell unit is (question_key, row_code, col_code)', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const title = `Rótulo ${SPEC_TAG} ${Date.now()}`
  const fx = seedForm(title, matrixAndRiskBody('ff2v_lbl'))

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')

  // One submission against v1.
  await enterWizard(page, title)
  const r1 = responseIdFromUrl(page)
  await saveMatrix(page, token, r1, fx.sectionId, {
    p_matrix_cells: {
      [fx.items.matrix]: { higienizacao: 'conforme', epi: 'conforme', descarte: 'conforme' },
    },
  })
  expect((await rpcAs<unknown>(page, token, 'submit_response', { p_response_id: r1 })).ok).toBeTruthy()

  // --- Clone to a draft and RELABEL the row, keeping its code -------------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/forms/${fx.formId}`)
  await page.getByRole('button', { name: /Editar publicado/ }).click()
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible({ timeout: 40_000 })

  const draftVersionId = sqlOne(
    `select id from public.form_versions where form_id = '${fx.formId}' and status = 'draft';`,
  )
  // The relabel is a plain UPDATE of `label` (the immutability trigger guards
  // `code`, not `label`) — the builder path for this is already covered by
  // ff2-matrix.spec.ts FF2-5; here the relabel is the ARRANGE, not the subject.
  psql(
    `set client_encoding to 'UTF8';\n` +
      `update public.form_matrix_rows r set label = 'Higiene das mãos (revisado)'\n` +
      ` from public.form_items i\n` +
      ` where r.item_id = i.id and i.form_version_id = '${draftVersionId}'\n` +
      `   and i.item_type = 'matrix' and r.code = 'higienizacao';`,
  )
  // The code survived the relabel — the premise of everything below.
  expect(
    sqlRows(
      `select r.code, r.label from public.form_matrix_rows r
         join public.form_items i on i.id = r.item_id
        where i.form_version_id = '${draftVersionId}' and i.item_type = 'matrix'
        order by r.position;`,
    )[0],
  ).toEqual(['higienizacao', 'Higiene das mãos (revisado)'])

  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByRole('button', { name: /Editar publicado/ })).toBeVisible({
    timeout: 40_000,
  })

  // --- A second submission, now against v2 with the NEW label -------------
  await signInAs(page, 'staff1.ccih@test.local')
  const token2 = await getToken(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const r2 = responseIdFromUrl(page)
  const v2Section = sqlOne(
    `select id from public.form_sections where form_version_id = '${draftVersionId}';`,
  )
  const v2Matrix = sqlOne(
    `select id from public.form_items where form_version_id = '${draftVersionId}' and item_type = 'matrix';`,
  )
  await saveMatrix(page, token2, r2, v2Section, {
    p_matrix_cells: {
      [v2Matrix]: { higienizacao: 'conforme', epi: 'nao_conforme', descarte: 'conforme' },
    },
  })
  expect((await rpcAs<unknown>(page, token2, 'submit_response', { p_response_id: r2 })).ok).toBeTruthy()

  // --- The series must be ONE row, not two --------------------------------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/dashboard?form=${fx.formId}`)
  const card = page.locator('article').filter({ hasText: 'Avalie cada critério' }).first()
  await expect(card).toBeVisible({ timeout: 25_000 })
  await expect(card).toContainText('2 grades preenchidas')

  // Three criteria, three rows — NOT four. A label-keyed pivot would emit a
  // separate row for the old wording and the new one.
  const rowHeaders = (await card.locator('tbody th').allInnerTexts()).map((t) => t.trim())
  expect(
    rowHeaders.length,
    `a série se dividiu por rótulo: ${JSON.stringify(rowHeaders)}`,
  ).toBe(3)
  // Display resolves to the LATEST published wording (ruling 4 permits the
  // relabel); the old wording must not survive as its own series.
  expect(rowHeaders).toContain('Higiene das mãos (revisado)')
  expect(rowHeaders).not.toContain('Higienização das mãos')

  // …and the two submissions COMBINED under that one code: both chose
  // `conforme` for it.
  const cols = await card.locator('thead th').allTextContents()
  const conformeIdx = cols.findIndex((t) => t.trim() === 'Conforme')
  const row = card.locator('tbody tr').filter({ hasText: 'Higiene das mãos (revisado)' }).first()
  // Count span only — see `distCount` in FF2V-3 for why the cell's text is not
  // safe to parse ("2" + "67%" reads as "267").
  const countSpan = row.locator('td').nth(conformeIdx - 1).locator('span').first()
  expect(
    (await countSpan.innerText()).trim(),
    'as duas versões precisam somar sob o mesmo code',
  ).toBe('2')
})

// ===========================================================================
// FF2V-5 — A stored risk_score outranks the recomputed product
// ===========================================================================

test('FF2V-5 (stored score wins): after a re-weighting, a historical response keeps the risk_score it was signed over rather than silently restating a new product', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Peso ${SPEC_TAG} ${Date.now()}`
  const fx = seedForm(title, matrixAndRiskBody('ff2v_stored'))

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  await saveMatrix(page, token, responseId, fx.sectionId, {
    p_risk_matrix: { [fx.items.risk]: { severity: 'grave', likelihood: 'provavel' } },
  })
  expect(
    (await rpcAs<unknown>(page, token, 'submit_response', { p_response_id: responseId })).ok,
  ).toBeTruthy()

  // The writer derived 9 × 3 = 27 — the honest starting point.
  expect(riskOf(responseId, fx.items.risk)).toEqual([['grave', 'provavel', '27']])

  // Simulate what a re-weighting leaves behind: the axes still say 9 × 3 = 27,
  // but the STORED score of this historical answer is 99. A viewer that
  // recomputes would show 27 and thereby restate what the response — and any
  // signature over it — appears to say.
  // `session_replication_role = replica` because `guard_submitted_risk_matrix_trg`
  // correctly refuses to let a SUBMITTED response's risk answer be rewritten —
  // that immutability is the product working, and it is exactly why the stored
  // score is the durable fact this test is about. The guard is bypassed only to
  // MANUFACTURE the historical state; nothing in the assertion depends on it.
  psql(
    `set session_replication_role = replica;\n` +
      `update public.answer_risk_matrix arm set risk_score = 99\n` +
      ` from public.answers a\n` +
      ` where a.id = arm.answer_id and a.response_id = '${responseId}';`,
  )
  expect(riskOf(responseId, fx.items.risk)).toEqual([['grave', 'provavel', '99']])

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/dashboard/submissions/${responseId}`)

  const riskStatus = page.getByRole('status').filter({ hasText: 'Pontuação:' }).first()
  await expect(riskStatus).toBeVisible({ timeout: 20_000 })
  await expect(riskStatus, 'o valor ARMAZENADO precisa vencer o produto recalculado').toContainText(
    '99',
  )
  // 27 is what recomputation from the current weights would produce; it must
  // not be what the screen says.
  await expect(riskStatus).not.toContainText('27')
  // The band follows the STORED score (99 ≥ 27 → Alto), not a second rule.
  await expect(riskStatus).toContainText('Alto')
})
