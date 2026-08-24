import { execSync } from 'node:child_process'
import { test, expect } from '@playwright/test'

import { cachedSignIn } from './helpers/auth'

/**
 * ADR 0094 W4 / FUP-MEM-3 + 3b — the Diretor Técnico referral plane, end to end.
 *
 * W4 built the plane with NO product caller: `create_referral_draft`'s
 * `p_target_hospital_id` had no caller in `src/`, and no route admitted the office. The
 * declared-param-with-no-caller blind spot in its exact known shape — the branch behind
 * it passed tsc, lint, unit, pgTAP AND E2E, because no product code path reached it.
 * These specs are the code path.
 *
 * ⚠ The build alone proved nothing here. The inbox passed typecheck, lint and a real
 * `next build`, then crashed on first load (a function prop into a Client Component).
 * Everything below asserts RENDERED OUTPUT or DB truth for that reason.
 *
 *   DT-1  the coordinator's wizard can address the technical direction, and the row
 *         lands with `target_type='technical_director'` + the source hospital.
 *   DT-2  the DT lands on the inbox at login — the office confers no membership, so
 *         before this every root-landing branch stepped over it into "sem acesso".
 *   DT-3  the DT opens the referral and DRIVES the lifecycle (`sent` → `received`),
 *         which is the claim `295` §4 makes at the RPC surface and nothing wired.
 *   DT-4  the DEPUTY has the same authority (decision D1), asserted rather than
 *         assumed — a substituto who cannot act is decorative.
 *   DT-5  isolation: a coordinator of ANOTHER hospital's commission cannot open it.
 */

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

const ORG = 'rede-a'
const CCIH_CASE = 'd0000000-0000-0000-0000-0000000000c1'
const HOSPITAL_CENTRAL_A = '05000000-0000-0000-0000-00000000000a'
const CHEFE_CCIH = '00000000-0000-0000-0000-000000000002'

/** Subjects unique to this file, so cleanup never has to guess which rows are ours. */
const SUBJECT_WIZARD = 'E2E direcao tecnica wizard (technical-direction-referrals.spec)'
const SUBJECT_FLOW = 'E2E direcao tecnica fluxo (technical-direction-referrals.spec)'

function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`,
    { encoding: 'utf8' },
  )
    .toString()
    .trim()
}

/**
 * Ensure a SENT technical-direction referral exists with `subject`, creating it through
 * the real RPCs as the CCIH coordinator if it does not.
 *
 * ⚠ Each test that needs one calls this with its OWN subject, rather than reusing the
 * row DT-1 builds through the wizard. Two earlier shapes both failed:
 *   - seeding a SECOND row under DT-1's subject left two, so every later
 *     `where subject = …` asserted against whichever Postgres returned first;
 *   - depending on DT-1's row made the later tests fail whenever the serial group was
 *     RETRIED — a retry re-runs `beforeAll`, which purges, and DT-2 then looked for a
 *     draft that had just been deleted. The failure pointed at `send_referral`
 *     ("encaminhamento não encontrado"), which reads like a product bug.
 * A shared fixture cannot satisfy two specs; each owns its own.
 *
 * The RPC is authority-gated on `auth.uid()` (HC071 for a non-coordinator) and
 * `postgres` has no uid, so this must assume the coordinator's claims — running as
 * superuser is not enough.
 */
function ensureSentDtReferral(subject: string): void {
  const claims =
    `select set_config('request.jwt.claims', jsonb_build_object(` +
    `'sub','${CHEFE_CCIH}','role','authenticated','is_admin',false,` +
    // ACT ADR 0106 (D5): hand-minted claims bypass the token hook, so the implicit
    // single-role hat derive never runs — the hat claim must be minted explicitly
    // or every hat-gated door (send_referral's coordinator check) denies.
    `'active_role','staff_admin')::text, false); ` +
    `set role authenticated;`
  // ADR 0137 D4 — send_referral now refuses without an MRN (HC0T4). This file
  // uses raw SQL (not the RPC-over-REST pattern the other referral specs
  // share, so it cannot import `helpers/referrals.ts`'s
  // `saveMinimalReferralPatientForSend` directly) — restructured as a CTE
  // chain that mirrors the SAME floor: save_referral_patient with an MRN
  // ONLY, nothing more, before send_referral. `new_draft` stays empty (and
  // so do the two CTEs that depend on it) when the idempotent guard's `where
  // not exists` fires, preserving the original re-run-safe behavior.
  sql(
    `${claims} ` +
      `with new_draft as (` +
      `select (public.create_referral_draft(` +
      `p_source_case_id => '${CCIH_CASE}', p_target_commission_id => null, ` +
      `p_target_hospital_id => '${HOSPITAL_CENTRAL_A}', ` +
      `p_referral_type_id => (select id from public.referral_types where is_active limit 1), ` +
      // `send_referral` refuses an empty referral ("Informe uma descrição, ou anexe ao
      // menos uma narrativa ou documento") — a product rule, so the fixture satisfies
      // it rather than working around it.
      `p_description_md => 'Solicitamos parecer tecnico da direcao (fixture E2E).', ` +
      `p_subject => '${subject}')).id as id ` +
      `where not exists (select 1 from public.case_referral where subject = '${subject}')` +
      `), phi_saved as (` +
      `select public.save_referral_patient(` +
      `p_referral_id => new_draft.id, p_name => null, ` +
      `p_mrn => 'E2E-FIXTURE-' || left(new_draft.id::text, 8), ` +
      `p_date_of_birth => null, p_age_years => null, p_sex => 'unknown', ` +
      `p_encounter_ref => null, p_unit => null, p_attending => null` +
      `) as ok from new_draft` +
      `) ` +
      `select public.send_referral(new_draft.id) from new_draft, phi_saved;`,
  )
}

/**
 * Remove every referral this file created, BY SUBJECT — never positionally, and never
 * a bulk delete of the family. `guard_referral_status` refuses a non-draft delete
 * outside the referral RPCs, which is correct; `app.in_referral_rpc` is the same
 * deliberate-maintenance escape the RPCs use and is unreachable by `authenticated`.
 */
function purge(): void {
  sql(
    `begin; set local app.in_referral_rpc = 'on'; ` +
      `delete from public.case_referral where subject like 'E2E direcao tecnica%'; commit;`,
  )
}

/**
 * `case_referrals` is a GLOBAL flag, and this file OWNS ITS PRECONDITION.
 *
 * ⚠ It did not, and that cost a gate. Every route this spec drives — the case page's
 * "Encaminhar caso" wizard, `/o/{org}/direcao-tecnica`, the DT referral detail — is
 * behind the flag. The prod gate batches many specs onto ONE server, the seed default
 * (ON) does not reappear between specs of the same batch, and the referral specs that
 * share a batch flip the flag in their own `afterAll`. Batch 17 ran
 * `referral-registros` (which forced it OFF) before this file: DT-1 could not find
 * "Encaminhar caso", and because the file is `mode: 'serial'` the other FOUR tests
 * never ran at all — 4 did-not-run, which proves nothing while reading like silence.
 *
 * Depending on batch order is not a fixable property of other people's teardowns:
 * the next referral spec anyone adds re-arms it. So this file asserts its own
 * precondition, and restores whatever it found (the same discipline
 * `case-patient.spec.ts` / `patient-index.spec.ts` already follow).
 *
 * `set_referrals_feature_flag` does NOT exist in the live catalog — every spec that
 * posts to it 404s and falls through to a CLI/psql path. This uses the psql door this
 * file already owns, and READS BACK the value, so a silent no-op cannot masquerade as
 * a precondition.
 */
let referralsFlagBefore: boolean

function readReferralsFlag(): boolean {
  return sql(`select enabled from app.feature_flags where key = 'case_referrals';`) === 't'
}

function setReferralsFlag(enabled: boolean): void {
  sql(`update app.feature_flags set enabled = ${enabled} where key = 'case_referrals';`)
  expect(
    sql(`select enabled from app.feature_flags where key = 'case_referrals';`),
    'case_referrals flag did not take the requested value',
  ).toBe(enabled ? 't' : 'f')
}

test.beforeAll(() => {
  referralsFlagBefore = readReferralsFlag()
  setReferralsFlag(true)
  purge()
})

test.afterAll(() => {
  purge()
  setReferralsFlag(referralsFlagBefore)
})

test.describe.configure({ mode: 'serial' })

test('DT-1: a coordinator addresses the direção técnica from the send wizard', async ({
  page,
}) => {
  await cachedSignIn(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${CCIH_CASE}`)

  await page.getByRole('button', { name: /encaminhar caso/i }).click()

  const dialog = page.getByRole('dialog')
  // ⚠ Scope to the RADIO, not to the text "Destino": four other strings in this step
  // contain "destino" ("Comissão de destino", "Data-limite para a comissão de
  // destino…", …) and a text locator is a strict-mode violation, which fails
  // identically to a missing element and reads like a missing feature.
  const dtRadio = dialog.getByRole('radio', {
    name: 'Direção técnica do hospital',
  })
  await expect(dtRadio).toBeVisible({ timeout: 30_000 })

  // The destination is a SUM TYPE; picking the DT arm must hide the commission select
  // entirely rather than leaving both set (the RPC refuses "both" with a check
  // violation, and the UI should never be able to send that).
  await dtRadio.check()
  // ⚠ `exact: true` is load-bearing. `getByLabel` substring-matches the ACCESSIBLE
  // NAME case-insensitively, and the description textarea's placeholder is "Contexto
  // para a comissão de destino. Aceita Markdown." — so the loose form matches a
  // control that never unmounts and reports "the select is still there" forever.
  await expect(
    dialog.getByLabel('Comissão de destino', { exact: true }),
  ).toHaveCount(0)

  await dialog.getByLabel('Tipo de encaminhamento').selectOption({ index: 1 })
  await dialog.getByLabel('Assunto').fill(SUBJECT_WIZARD)
  // ⚠ ADR 0137 D5 — creation is DEFERRED: "Continuar" only advances the
  // wizard's local step, it no longer mints the draft (that used to happen
  // synchronously on this exact click, which is what this test originally
  // relied on). An explicit "Salvar rascunho" is what actually persists the
  // header fields under test here; nothing needs sending or picking for
  // that, so save right after step 1 rather than driving further steps.
  await dialog.getByRole('button', { name: 'Continuar' }).click()
  await dialog.getByRole('button', { name: 'Salvar rascunho' }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  // DB truth: the sum type resolved to the technical-direction arm, anchored on the
  // SOURCE commission's own hospital (the RPC refuses any other with HC071).
  await expect
    .poll(
      () =>
        sql(
          `select coalesce(target_type,'') || '|' || coalesce(target_hospital_id::text,'') || '|' || coalesce(target_commission_id::text,'<null>') ` +
            `from public.case_referral where subject = '${SUBJECT_WIZARD}'`,
        ),
      { timeout: 20_000 },
    )
    .toBe(`technical_director|${HOSPITAL_CENTRAL_A}|<null>`)
})

test('DT-2: the Diretor Técnico lands on the inbox and sees the referral', async ({
  page,
}) => {
  ensureSentDtReferral(SUBJECT_FLOW)

  await cachedSignIn(page, 'dt.a@test.local')
  // Root landing, not a deep link: the office confers no membership, so every branch
  // above it used to step over a pure DT into the "sem acesso" screen.
  await page.goto('/')
  await expect(page).toHaveURL(new RegExp(`/o/${ORG}/direcao-tecnica`), {
    timeout: 30_000,
  })

  await expect(
    page.getByRole('heading', { name: 'Encaminhamentos à direção técnica' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: SUBJECT_FLOW })).toBeVisible()
})

test('DT-3: the titular opens it and drives the lifecycle (sent → received)', async ({
  page,
}) => {
  await cachedSignIn(page, 'dt.a@test.local')
  await page.goto(`/o/${ORG}/direcao-tecnica`)
  await page.getByRole('link', { name: SUBJECT_FLOW }).click()

  await expect(page.getByRole('heading', { name: SUBJECT_FLOW })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Receber' }).click()

  await expect
    .poll(
      () => sql(`select status from public.case_referral where subject = '${SUBJECT_FLOW}'`),
      { timeout: 20_000 },
    )
    .toBe('received')
})

test('DT-4: the DEPUTY holds the same authority (D1), not a lesser one', async ({
  page,
}) => {
  await cachedSignIn(page, 'dt.dep.a@test.local')
  await page.goto(`/o/${ORG}/direcao-tecnica`)
  await page.getByRole('link', { name: SUBJECT_FLOW }).click()

  await expect(page.getByRole('heading', { name: SUBJECT_FLOW })).toBeVisible({
    timeout: 30_000,
  })
  // Carries the lifecycle forward from where the titular left it — the substituto
  // acting is the assertion, not merely seeing.
  await page.getByRole('button', { name: 'Aceitar' }).click()

  await expect
    .poll(
      () => sql(`select status from public.case_referral where subject = '${SUBJECT_FLOW}'`),
      { timeout: 20_000 },
    )
    .toBe('accepted')
})

test('DT-5: a coordinator of another hospital cannot open the DT inbox', async ({
  page,
}) => {
  // chefe.farm coordinates a commission of the SAME hospital but holds no technical
  // direction; staff1.qual.b is another org entirely. Both must be refused the route.
  await cachedSignIn(page, 'staff1.qual.b@test.local', undefined, 'staff_admin')
  await page.goto(`/o/${ORG}/direcao-tecnica`)
  await expect(
    page.getByRole('heading', { name: 'Encaminhamentos à direção técnica' }),
  ).toHaveCount(0)
})
