import { test, expect } from '@playwright/test'

import { cachedSignIn } from './helpers/auth'
import { uniqueCpf } from './helpers/cpf'
import { svcSelect } from './helpers/service-role'

/**
 * AE3 (ADR 0155 D4) — the restricted personal-detail extraction, asserted at the
 * RENDERED-OUTPUT boundary.
 *
 * ⛔ WHY THIS FILE IS E2E AND NOT A UNIT TEST, AND WHY IT MAY NEVER BECOME A SOURCE GREP.
 * The D4 gate assertion is "raw restricted fields never appear in list / aggregate /
 * session-context outputs". That is a property of what the SERVER ACTUALLY SENDS, and the
 * three ways it could be violated are all invisible to the layers below:
 *   · a `.select('…')` column list is a runtime STRING — `tsc` cannot type it;
 *   · `.maybeSingle<T>()` takes its row type from the CALL SITE, so a widened query with a
 *     narrow type annotation type-checks perfectly;
 *   · an RSC serializes whatever the server component closed over, so a value fetched and
 *     never rendered can still cross the wire in the flight payload.
 * A source grep cannot separate live copy from prose about it (the `ui-copy-forbidden-strings`
 * lesson), and a unit test asserts the shape the mock was told to return. Only the response
 * body settles it.
 *
 * ⭐ THE ASSERTIONS ARE PHRASED AGAINST THE FULL PAGE PAYLOAD (`page.content()`), not against
 * a visible locator. A raw CPF sitting in the RSC flight payload but never painted is exactly
 * the leak this gate exists to catch, and `toBeVisible()` would report it as clean.
 *
 * ⛔ WHAT THIS FILE COVERS, AND WHAT IS DISCHARGED STRUCTURALLY INSTEAD (QA finding N4).
 * D4 names three output classes: **list**, **aggregate**, and **session-context**. Only the
 * LIST class is measured here, because it is the only one that currently has a consumer:
 *   · **aggregate** — the AE3.1 census found NO aggregate or reporting consumer of the three
 *     values (no view depends on them by `pg_depend`, and no dashboard query reads them), so
 *     there is nothing to assert against. This is discharge by CONSUMER ABSENCE, not by
 *     measurement, and it expires the moment one is written.
 *   · **session-context** — `getSessionContext()` is server-only with no API route, and its
 *     projection never touches `profile_private_details`. Same discharge, same expiry.
 * ⚠ Stated rather than left implicit so that a future author adding an aggregate or widening
 * the session context KNOWS THEY OWE A CELL HERE. Absence of a test is not absence of a
 * requirement — and the two absences above are the reason, not an oversight.
 */

const ORG = 'rede-a'

/** Seeded, from `supabase/seed.sql` § AFF T3.5. Digits-only, as stored. */
const DR_JOHN_ID = '00000000-0000-0000-0000-0000000000a1'
const DR_JOHN_CPF = '11144477735'
/** ADR 0147: digits 1-3 and 8-11 are shown; 4-7 never leave the server. */
const DR_JOHN_CPF_HIDDEN_DIGITS = '4447'
const DR_JOHN_CPF_MASKED = '111.•••.•77-35'

const ORGADMIN = 'orgadmin.a@test.local'

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

test.describe('AE3-D4: raw restricted details never cross the wire on list/aggregate output', () => {
  test('the user directory carries NO raw CPF and NO phone for any listed person', async ({
    page,
    request,
  }) => {
    // Every CPF currently on file, read service-side. Asserting against ONE seeded value
    // would pass while some other person's CPF leaked; the population is the property.
    // ⛔ Derived, never hardcoded — this DB accumulates `addable.*`/`e2e.*` people across
    // runs, so a fixed list would silently stop covering the newest rows.
    const stored = await svcSelect<{ cpf: string | null; phone: string | null }>(
      request,
      'profile_private_details',
      'select=cpf,phone',
    )
    const cpfs = stored.map((r) => r.cpf).filter((c): c is string => !!c)
    const phones = stored.map((r) => r.phone).filter((p): p is string => !!p)

    expect(
      cpfs.length,
      'NON-VACUITY: at least one CPF must be on file, or this test asserts nothing',
    ).toBeGreaterThan(0)

    await signInAs(page, ORGADMIN)
    await page.goto(`/o/${ORG}/manage/usuarios`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

    const html = await page.content()
    for (const cpf of cpfs) {
      expect(html, `the roster payload leaked a raw CPF (${cpf.slice(0, 3)}…)`).not.toContain(cpf)
    }
    for (const phone of phones) {
      expect(html, 'the roster payload leaked a raw phone').not.toContain(phone)
    }

    // ⛔ THE REACHABILITY TWIN — without it the sweep above is satisfiable by an EMPTY
    // roster, a 404, or a redirect to /login, all of which contain no CPF and would report
    // as a clean pass. Search for a person KNOWN to hold a CPF and assert the page really
    // lists them: only then is "their CPF is not here" an absence rather than a vacuum.
    await page.goto(`/o/${ORG}/manage/usuarios?search=dr.john`)
    await expect(page.getByText('dr.john@test.local').first()).toBeVisible({ timeout: 15_000 })
    const searched = await page.content()
    expect(
      searched,
      'the person IS listed, so the CPF absence below is measured and not vacuous',
    ).toContain('dr.john@test.local')
    expect(
      searched,
      '…and their raw CPF still does not appear on the very page that lists them',
    ).not.toContain(DR_JOHN_CPF)
  })

  test('⭐ the person detail page shows the MASKED CPF and never digits 4-7', async ({
    page,
  }) => {
    await signInAs(page, ORGADMIN)
    await page.goto(`/o/${ORG}/manage/usuarios/${DR_JOHN_ID}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

    const html = await page.content()

    // ⛔ BOTH HALVES. The absence alone is satisfiable by a page that renders no CPF at
    // all — including a broken page — so the masked form must be asserted PRESENT in the
    // same breath. This is the reachability twin of the leak assertion.
    expect(html, 'the masked CPF must be rendered').toContain(DR_JOHN_CPF_MASKED)
    expect(html, 'the RAW CPF must never reach the client').not.toContain(DR_JOHN_CPF)
    expect(
      html,
      'ADR 0147: digits 4-7 do not leave the server under any branch',
    ).not.toContain(DR_JOHN_CPF_HIDDEN_DIGITS)
  })
})

test.describe('AE3-AUDIT: the CPF probe still emits exactly one audit row after the move', () => {
  test('one directory CPF search emits exactly ONE person.cpf_lookup row', async ({
    page,
    request,
  }) => {
    // ⛔ BEFORE/AFTER DELTA, never an absolute count. This DB is shared across specs and
    // runs; a total would be wrong the moment it was measured.
    const before = await svcSelect<{ id: string }>(
      request,
      'audit_log',
      'action=eq.person.cpf_lookup&select=id',
    )

    await signInAs(page, ORGADMIN)
    await page.goto(`/o/${ORG}/manage/usuarios/novo`)
    await page.getByRole('textbox', { name: 'CPF' }).fill(DR_JOHN_CPF)
    await page.getByRole('button', { name: /buscar pessoa/i }).click()
    // The search must actually resolve before the delta is read, or the assertion races
    // the request and a passing 0-delta means "too early", not "no row emitted".
    await expect(page.getByText(/dr\.? ?john/i).first()).toBeVisible({ timeout: 15_000 })

    const after = await svcSelect<{ id: string }>(
      request,
      'audit_log',
      'action=eq.person.cpf_lookup&select=id',
    )
    expect(
      after.length - before.length,
      'exactly one probe row — D11/audit LOW-2 survives the storage move',
    ).toBe(1)

    // Rule 11 / Rule 12: the audit records THAT and WHO, never the payload.
    const rows = await svcSelect<{ metadata: Record<string, unknown> }>(
      request,
      'audit_log',
      // ⚠ `seq`, not `created_at` — this table's timestamp column is `occurred_at`, and it
      // carries a monotonic `seq` besides. Ordering on a column that does not exist is a
      // 42703 the helper surfaces as a hard failure, which is how this was caught.
      'action=eq.person.cpf_lookup&select=metadata&order=seq.desc&limit=1',
    )
    expect(
      JSON.stringify(rows[0]?.metadata ?? {}),
      'the probe row must never carry the CPF digits',
    ).not.toContain(DR_JOHN_CPF)
  })
})

test.describe('AE3-KBD: the CPF field is operable with no mouse', () => {
  test('a CPF can be entered and submitted keyboard-only, and the mask forms as you type', async ({
    page,
  }) => {
    // The accessibility rule (CLAUDE.md §8) asks for one keyboard-only flow per phase, and
    // the CPF field is AE3's most-touched input: it is masked as you type, which is exactly
    // the shape that breaks under keyboard entry when a caret is repositioned on each
    // keystroke.
    const cpf = uniqueCpf()

    await signInAs(page, ORGADMIN)
    await page.goto(`/o/${ORG}/manage/usuarios/novo`)

    const field = page.getByRole('textbox', { name: 'CPF' })
    await expect(field).toBeVisible({ timeout: 15_000 })

    // ⛔ FOCUS VIA KEYBOARD, not `.focus()` — Playwright's `.focus()` is not auto-waiting
    // and, more to the point here, it bypasses the very tab-order this test exists to
    // prove. Tab until the field holds focus, bounded so a failure reports "never reached"
    // rather than hanging.
    let reached = false
    for (let i = 0; i < 40; i += 1) {
      if (await field.evaluate((el) => el === document.activeElement)) {
        reached = true
        break
      }
      await page.keyboard.press('Tab')
    }
    expect(reached, 'the CPF field must be reachable by Tab alone').toBe(true)

    await page.keyboard.type(cpf)

    // The mask forms from keystrokes, not from a paste or a blur handler.
    const shown = await field.inputValue()
    expect(shown, 'the field must render the familiar 000.000.000-00 form').toMatch(
      /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
    )
    expect(shown.replace(/\D/g, ''), 'and it must carry the digits typed').toBe(cpf)

    // Submitting the lookup from the keyboard alone.
    await page.keyboard.press('Enter')
    await expect(
      page.getByText(/nenhuma pessoa|cadastrar nova pessoa|não encontrad/i).first(),
      'a fresh CPF must resolve to the not-found branch, reached with no mouse',
    ).toBeVisible({ timeout: 15_000 })
  })
})
