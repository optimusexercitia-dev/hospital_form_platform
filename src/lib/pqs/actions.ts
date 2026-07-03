'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { ActionState } from '@/lib/safety/types'

// Local pt-BR messages (Rule 10; raw Postgres errors never reach the UI). The DEFINER
// RPCs are the authority — a caller who is neither the hospital's coordinator nor the
// org's nsp_org_admin hits 42501 → `forbidden`.
const MESSAGES = {
  forbidden:
    'Apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe.',
  generic: 'Não foi possível concluir. Tente novamente.',
  memberAdded: 'Membro adicionado à equipe do NSP.',
  memberRemoved: 'Membro removido da equipe do NSP.',
  windowSaved: 'Janela de RCA atualizada.',
  windowRange: 'A janela de RCA deve estar entre 1 e 365 dias.',
} as const

const PG_RLS_DENIED = '42501'

/** Revalidate the NSP console after a roster / config mutation (the roster + config
 * surfaces live beneath the `/o/[org]/nsp` layout; 'layout' covers them all,
 * including the `?hospital=` per-hospital views). */
function revalidateNsp(): void {
  revalidatePath('/o/[org]/nsp', 'layout')
}

/**
 * NSP / PQS roster-curation + per-hospital config server actions (NSP-per-hospital,
 * Phase B; ADR 0052) — CONTRACT STUBS.
 *
 * The PQS roster is PER-HOSPITAL: enrollment in a hospital's roster (`pqs_members`,
 * PK `(hospital_id, user_id)`) grants that hospital's PHI read. The hospital's
 * `nsp_coordinator` (a full local operator) OR the org's `nsp_org_admin` may CURATE
 * the roster/config; `org_admin` only appoints the `nsp_org_admin`. A coordinator is
 * a full operator (implicit PHI read + write, decision 12) but is still enrolled
 * explicitly to appear on the roster.
 *
 * Every write routes through a SECURITY DEFINER RPC landed by migration
 * `20260710000000_nsp_per_hospital.sql` (B1–B5); the RPC's curator gate (42501 for
 * an unauthorized caller) + RLS are the authority.
 *
 * A `"use server"` module may export ONLY async functions, so the result type is
 * imported from the CLIENT-SAFE `@/lib/safety/types` (`ActionState` — the
 * `useActionState`-shaped result the FE roster UI binds to) and input shapes are
 * primitives. Keep these SIGNATURES stable once posted (contract-first). All
 * user-facing strings are pt-BR; raw Postgres errors never reach the UI.
 */

/**
 * Enroll `userId` into `hospitalId`'s PQS roster (grants that hospital's PHI read).
 * Backed by the `add_pqs_member(p_hospital_id, p_user_id)` DEFINER RPC, gated
 * `is_nsp_org_admin_of(org_of_hospital) OR is_nsp_coordinator_of(hospital)` (42501
 * otherwise); idempotent (`on conflict do nothing` on the `(hospital,user)` PK). A
 * coordinator may enroll THEMSELVES here to appear on the roster (they already read
 * PHI via the coordinator arm).
 */
export async function addPqsMember(
  hospitalId: string,
  userId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('add_pqs_member', {
    p_hospital_id: hospitalId,
    p_user_id: userId,
  })
  if (error) {
    return {
      ok: false,
      error: error.code === PG_RLS_DENIED ? MESSAGES.forbidden : MESSAGES.generic,
    }
  }
  revalidateNsp()
  return { ok: true, message: MESSAGES.memberAdded }
}

/**
 * Remove `userId` from `hospitalId`'s PQS roster (revokes that hospital's PHI read).
 * Backed by the `remove_pqs_member(p_hospital_id, p_user_id)` DEFINER RPC, same
 * curator gate; deletes by `(hospital, user)`.
 */
export async function removePqsMember(
  hospitalId: string,
  userId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_pqs_member', {
    p_hospital_id: hospitalId,
    p_user_id: userId,
  })
  if (error) {
    return {
      ok: false,
      error: error.code === PG_RLS_DENIED ? MESSAGES.forbidden : MESSAGES.generic,
    }
  }
  revalidateNsp()
  return { ok: true, message: MESSAGES.memberRemoved }
}

/**
 * Set the per-hospital RCA due-window (`pqs_department.rca_default_due_days` for
 * `hospitalId`) — the days `confirm_triage` adds to the event date to mint an RCA due
 * date. Backed by the `set_pqs_rca_due_window(p_hospital_id, p_days)` DEFINER RPC
 * (curator gate; validated 1–365 → HC046; **audited at the HOSPITAL tier** via the
 * Phase-A 4-tier chain).
 */
export async function setPqsRcaDueWindow(
  hospitalId: string,
  days: number,
): Promise<ActionState> {
  // Client-side range guard for a friendly message; the RPC re-validates → HC046.
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return { ok: false, error: MESSAGES.windowRange }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_pqs_rca_due_window', {
    p_hospital_id: hospitalId,
    p_days: days,
  })
  if (error) {
    return {
      ok: false,
      error: error.code === PG_RLS_DENIED ? MESSAGES.forbidden : MESSAGES.generic,
    }
  }
  revalidateNsp()
  return { ok: true, message: MESSAGES.windowSaved }
}
