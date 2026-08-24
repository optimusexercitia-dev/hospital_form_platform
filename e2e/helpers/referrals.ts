import { expect, type APIRequestContext } from '@playwright/test'

/**
 * Shared referral-fixture helper — the ONE place D4's send-time MRN
 * precondition (`send_referral` → `HC0T4` — "Informe o prontuário do
 * paciente antes de enviar o encaminhamento.") is satisfied for every spec
 * that mints and sends a referral purely as fixture setup (never as the
 * subject under test).
 *
 * ⭐ WHY THIS EXISTS. D4 renamed nothing — it added a PRECONDITION, so no
 * static sweep (grep for a dropped column/RPC name, `tsc`) could find the
 * specs it broke; only running them did. Six files / 9 real `send_referral`
 * call sites minted referrals and sent them without ever saving patient PHI,
 * because before D4 that floor did not exist. Centralizing the fix here
 * means the NEXT send-time precondition (if one is ever added) lands in one
 * place instead of being hand-copied into 9 call sites again.
 *
 * ⛔ **MINIMUM PHI ONLY — do not widen this "to be safe".** D4's floor is
 * exactly an MRN; `save_referral_patient` keeps its own `name OR mrn` floor
 * unchanged (a draft may still be saved with only a name, or nothing). This
 * helper is fixture plumbing for specs that need a referral in `sent` status
 * to test something else — it is not itself a test of D4, and must never be
 * mistaken for one. `e2e/case-referral-usability-batch.spec.ts`'s D4 tests
 * are the actual coverage of the refusal/floor; nothing here should ever
 * assert that `save_referral_patient` refuses a name-only save — it must not.
 * The MRN value is synthetic and traceable (derived from the referral id),
 * never a value resembling real PHI.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
    )
  }
  return key
}

/**
 * Save the minimum PHI `send_referral` requires (an MRN, nothing else) onto
 * a referral, as the SOURCE coordinator's own bearer token (the RPC is
 * authority-gated on `auth.uid()`, same as `create_referral_draft` /
 * `send_referral` themselves — a service-role-only call would not exercise
 * the real door). Call this immediately before `send_referral` in any
 * fixture-building helper.
 */
export async function saveMinimalReferralPatientForSend(
  req: APIRequestContext,
  bearer: string,
  referralId: string,
): Promise<void> {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/rpc/save_referral_patient`, {
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_referral_id: referralId,
      p_name: null,
      p_mrn: `E2E-FIXTURE-${referralId.slice(0, 8)}`,
      p_date_of_birth: null,
      p_age_years: null,
      p_sex: 'unknown',
      p_encounter_ref: null,
      p_unit: null,
      p_attending: null,
    },
  })
  expect(
    resp.ok(),
    `saveMinimalReferralPatientForSend(${referralId}): save_referral_patient failed: ${await resp.text()}`,
  ).toBeTruthy()
}
