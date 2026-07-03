/**
 * Org NSP-admin console data-access (NSP-per-hospital, Phase B; ADR 0052, decision
 * 13; Architecture Rule 9). Backs the ORG-level, ZERO-PHI `nsp_org_admin` console
 * under `/o/[org]/nsp/**` (the org rollup view + coordinator management).
 *
 * SECURITY (Rule 12 — the qa keystone): the `nsp_org_admin` grant reads ONLY
 * PHI-FREE, per-hospital AGGREGATES — event/CAPA counts + status rollups + the staff
 * roster. It has NO PHI read (it appears in NO `can_read_*` / `get_*_patient` door)
 * and NO NSP workflow write. Every function here routes through a SECURITY DEFINER
 * RPC gated `is_nsp_org_admin_of(p_org_id)` whose result set is scoped to the org's
 * hospitals (ADR 0042 M3) and whose SELECT list is provably free of any PHI /
 * free-text / narrative column. A non-`nsp_org_admin` caller gets `[]`.
 *
 * CONTRACT STUBS: read paths safe-default (`[]`/`false`) so `frontend` can build the
 * B8 console against these frozen types without runtime crashes. Backed by migration
 * `20260710000000_nsp_per_hospital.sql`; keep the SIGNATURES stable once posted.
 */

import { createClient } from '@/lib/supabase/server'
import type {
  NspEventRollupRow,
  NspCapaRollupRow,
  NspOrgRosterRow,
} from '@/lib/pqs/roster-types'

export type {
  NspEventRollupRow,
  NspCapaRollupRow,
  NspOrgRosterRow,
} from '@/lib/pqs/roster-types'

/**
 * The org's per-hospital EVENT rollup — event counts by triage status + suspected-harm
 * band, keyed by hospital. PHI-FREE (counts + status only; never a patient column,
 * event code, title, or narrative). Backed by the `nsp_org_event_rollup(p_org_id)`
 * DEFINER RPC, gated `is_nsp_org_admin_of(orgId)`, result set scoped to `orgId`'s
 * hospitals. A non-`nsp_org_admin` caller gets `[]`.
 */
export async function getNspOrgEventRollup(
  orgId: string,
): Promise<NspEventRollupRow[]> {
  if (!orgId) return []
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('nsp_org_event_rollup', {
    p_org_id: orgId,
  })
  if (error || !data) return []
  return (data as unknown as NspEventRollupRow[]).map((r) => ({
    hospitalId: r.hospitalId,
    hospitalName: r.hospitalName,
    total: r.total,
    byStatus: r.byStatus,
    byHarm: r.byHarm,
  }))
}

/**
 * The org's per-hospital CAPA rollup — open / overdue / closed counts keyed by
 * hospital. PHI-FREE (counts only; never a plan id, lessons-learned, or action
 * description). Backed by the `nsp_org_capa_rollup(p_org_id)` DEFINER RPC, gated
 * `is_nsp_org_admin_of(orgId)`, result set scoped to `orgId`'s hospitals. A
 * non-`nsp_org_admin` caller gets `[]`.
 */
export async function getNspOrgCapaRollup(
  orgId: string,
): Promise<NspCapaRollupRow[]> {
  if (!orgId) return []
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('nsp_org_capa_rollup', {
    p_org_id: orgId,
  })
  if (error || !data) return []
  return (data as unknown as NspCapaRollupRow[]).map((r) => ({
    hospitalId: r.hospitalId,
    hospitalName: r.hospitalName,
    open: r.open,
    overdue: r.overdue,
    closed: r.closed,
  }))
}

/**
 * The org's per-hospital NSP ROSTER + coordinator — staff identity only (never
 * patient). Backs the console's roster-curation surface (the `nsp_org_admin` may
 * add/remove members + appoint coordinators for ANY hospital). Backed by the
 * `nsp_org_roster(p_org_id)` DEFINER RPC, gated `is_nsp_org_admin_of(orgId)`, result
 * set scoped to `orgId`'s hospitals. A non-`nsp_org_admin` caller gets `[]`.
 */
export async function getNspOrgRoster(
  orgId: string,
): Promise<NspOrgRosterRow[]> {
  if (!orgId) return []
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('nsp_org_roster', {
    p_org_id: orgId,
  })
  if (error || !data) return []
  return (data as unknown as NspOrgRosterRow[]).map((r) => ({
    hospitalId: r.hospitalId,
    hospitalName: r.hospitalName,
    coordinator: r.coordinator
      ? {
          userId: r.coordinator.userId,
          fullName: r.coordinator.fullName,
          email: r.coordinator.email,
        }
      : null,
    members: (r.members ?? []).map((m) => ({
      userId: m.userId,
      fullName: m.fullName,
      email: m.email,
      addedAt: m.addedAt,
      addedBy: m.addedBy,
    })),
  }))
}

/**
 * Is the current user an `nsp_org_admin` of `orgId`? Gates the org NSP-admin console
 * entry + nav. Safe-default `false` (called at render time, must never throw). Backed
 * by the `is_nsp_org_admin_of_self(p_org_id)` DEFINER probe.
 */
export async function isNspOrgAdmin(orgId: string): Promise<boolean> {
  if (!orgId) return false
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_nsp_org_admin_of_self', {
    p_org_id: orgId,
  })
  if (error) return false
  return data === true
}
