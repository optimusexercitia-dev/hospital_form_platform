'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Quality-office oversight write action (ADR 0100 D8/D9, QO·A).
 *
 * ONE mutation: `public.set_commission_oversight` — the SECURITY DEFINER door
 * that is the ONLY writer of `commissions.quality_oversight` (a BEFORE UPDATE
 * trigger blocks raw column writes for everyone, superuser included). Authority
 * lives in the door — `is_hospital_admin_of OR is_org_admin_of`; the committee
 * cannot opt itself out and platform_admin stays out (noun rule) — so this seam
 * only shapes the pt-BR error, never decides access.
 *
 * Error codes: `42501` authority · `HC0L0` invalid value · `P0002` unknown
 * commission (distinct SQLSTATEs per failure class). Raw Postgres errors never
 * reach the UI (CLAUDE.md §8).
 */

export type QualityOversight = 'visible' | 'excluded'

/** The shared `useActionState`-shaped result (the coordinator-action contract). */
export interface ActionState {
  ok: boolean
  error?: string
}

const MESSAGES = {
  forbidden:
    'Apenas a administração do hospital ou da organização pode alterar a supervisão da qualidade.',
  notFound: 'Comissão não encontrada.',
  generic: 'Não foi possível alterar a supervisão da qualidade. Tente novamente.',
} as const

function mapOversightError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case '42501':
      return error.message || MESSAGES.forbidden
    case 'HC0L0': // invalid classification value
      return error.message || MESSAGES.generic
    case 'P0002':
      return MESSAGES.notFound
    default:
      return MESSAGES.generic
  }
}

/**
 * Opt a commission in/out of quality-office oversight. Audited by the door
 * (`commission.oversight_changed`, PHI-free metadata incl. the previous value).
 */
export async function setCommissionOversight(
  commissionId: string,
  oversight: QualityOversight,
): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_commission_oversight', {
    p_commission_id: commissionId,
    p_oversight: oversight,
  })

  if (error) {
    return { ok: false, error: mapOversightError(error) }
  }

  // The toggle lives on the org manage screen; the reviewer board reads the
  // classification live. Both re-render on the next request; revalidate the
  // manage layout tree the toggle sits in.
  revalidatePath('/o/[org]/manage', 'layout')
  return { ok: true }
}
