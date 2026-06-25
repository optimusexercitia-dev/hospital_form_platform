'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { ActionState } from '@/lib/safety/types'

// Local pt-BR messages (Rule 10; raw Postgres errors never reach the UI). The DEFINER
// RPCs are the authority — a non-coordinator hits 42501 → `forbidden`.
const MESSAGES = {
  forbidden: 'Apenas o coordenador do NSP da organização pode gerenciar a equipe.',
  generic: 'Não foi possível concluir. Tente novamente.',
  memberAdded: 'Membro adicionado à equipe do NSP.',
  memberRemoved: 'Membro removido da equipe do NSP.',
  windowSaved: 'Janela de RCA atualizada.',
  windowRange: 'A janela de RCA deve estar entre 1 e 365 dias.',
} as const

const PG_RLS_DENIED = '42501'

/** Revalidate the per-org NSP console after a roster / config mutation (the roster +
 * config surfaces live beneath the `/o/[org]/nsp` layout; 'layout' covers them all). */
function revalidateNsp(): void {
  revalidatePath('/o/[org]/nsp', 'layout')
}

/**
 * NSP / PQS roster-curation + per-org config server actions (NSP-per-org, sub-phase
 * A; ADR 0042) — CONTRACT STUBS.
 *
 * The PQS roster is PER-ORG: enrollment in an org's roster (`pqs_members`, now keyed
 * `(organization_id, user_id)`) grants that org's PHI read. A dedicated per-org
 * `nsp_coordinator` grant CURATES the roster; `org_admin` only APPOINTS the
 * coordinator (via the org-members surface) and has NO direct roster write — three-way
 * duty separation. A coordinator is NOT implicitly a reader; they enroll explicitly.
 *
 * Every write routes through a SECURITY DEFINER RPC landed by migration
 * `20260630000000_nsp_per_org.sql` (A2/A3); the RPC's coordinator gate (42501 for a
 * non-coordinator) + RLS are the authority. Bodies throw until the migration lands.
 *
 * A `"use server"` module may export ONLY async functions, so the result type is
 * imported from the CLIENT-SAFE `@/lib/safety/types` (`ActionState` — the
 * `useActionState`-shaped result the FE roster UI binds to) and input shapes are
 * primitives. Keep these SIGNATURES stable once posted (contract-first). All
 * user-facing strings are pt-BR; raw Postgres errors never reach the UI.
 */

/**
 * Enroll `userId` into `orgId`'s PQS roster (grants that org's PHI read). Backed by
 * the `add_pqs_member(p_org_id, p_user_id)` DEFINER RPC, gated
 * `is_nsp_coordinator_of(p_org_id)` (42501 otherwise); idempotent (`on conflict do
 * nothing` on the `(org,user)` PK). A coordinator may enroll THEMSELVES here to
 * become a reader (explicit enrollment).
 */
export async function addPqsMember(
  orgId: string,
  userId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('add_pqs_member', {
    p_org_id: orgId,
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
 * Remove `userId` from `orgId`'s PQS roster (revokes that org's PHI read). Backed by
 * the `remove_pqs_member(p_org_id, p_user_id)` DEFINER RPC, coordinator-gated;
 * deletes by `(org, user)`.
 */
export async function removePqsMember(
  orgId: string,
  userId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_pqs_member', {
    p_org_id: orgId,
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
 * Set the per-org RCA due-window (`pqs_department.rca_default_due_days` for `orgId`)
 * — the days `confirm_triage` adds to the event date to mint an RCA due date. Backed
 * by the `set_pqs_rca_due_window(p_org_id, p_days)` DEFINER RPC (coordinator/member
 * gate; validated 1–365 → HC046; **audited at the ORG tier**, passing
 * `p_organization := p_org_id`). Supersedes the global `setRcaDueWindow(days)` in
 * `@/lib/safety/triage-actions`, which targeted the lone singleton.
 */
export async function setPqsRcaDueWindow(
  orgId: string,
  days: number,
): Promise<ActionState> {
  // Client-side range guard for a friendly message; the RPC re-validates → HC046.
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return { ok: false, error: MESSAGES.windowRange }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_pqs_rca_due_window', {
    p_org_id: orgId,
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
