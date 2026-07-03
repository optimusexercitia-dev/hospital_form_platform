/**
 * NSP / PQS roster — CLIENT-SAFE domain types (NSP-per-hospital, Phase B; ADR 0052,
 * re-keyed from the per-org ADR 0042 shape).
 *
 * **Purity contract** (the `safety/types.ts` discipline). This module has ZERO
 * imports — it must remain importable from CLIENT components (the per-hospital roster
 * curation UI + NSP hospital switcher + org NSP-admin console under `/o/[org]/nsp/**`
 * that Phase B FE builds). It must NEVER import `@/lib/supabase/*`, `next/headers`,
 * `server-only`, or any data-access/action module. The server-only query functions
 * (`@/lib/queries/pqs`) and the `"use server"` roster actions import their types FROM
 * here, so a `"use client"` component never transitively drags
 * `@/lib/supabase/server` into the client bundle.
 *
 * Background (ADR 0052): the PQS roster (`public.pqs_members`) is PER-HOSPITAL (PK
 * `(hospital_id, user_id)`). Enrollment in a HOSPITAL's roster is what grants that
 * hospital's PHI **read** (`app.is_pqs_member_of(hospital, uid)`). The three-tier
 * chain: `org_admin` (appoints the `nsp_org_admin`) → `nsp_org_admin` (org-level,
 * ZERO PHI — curates any hospital's roster + appoints per-hospital coordinators +
 * reads PHI-free aggregates) → `nsp_coordinator` (the local hospital NSP head, a
 * FULL operator: implicit PHI read + NSP write + curates own hospital). An enrolled
 * `pqs_member` reads/writes their hospital's PHI. *Curate ≠ read* now holds at the
 * ORG tier (nsp_org_admin curates but reads no PHI); the local coordinator both
 * curates and reads.
 *
 * All user-facing strings are pt-BR, resolved in the UI (Rule 10); these are data.
 */

/**
 * One enrolled member of a HOSPITAL's PQS roster, as the per-hospital roster
 * curation UI lists them. PHI-free: a roster row is `(hospital_id, user_id)` +
 * who/when added; the profile join supplies name/email for display only.
 */
export interface PqsRosterMember {
  /** The enrolled user's profile id (= `pqs_members.user_id`). */
  userId: string
  /** Display name from `profiles.full_name` (may be null — treat as unknown). */
  fullName: string | null
  /**
   * Denormalized auth email copy (`profiles.email`, nullable citext — MEMORY:
   * treat as `string | null`).
   */
  email: string | null
  /** When the user was enrolled into THIS hospital's roster. */
  addedAt: string
  /** The curator (coordinator / nsp_org_admin) who enrolled them; null for seed rows. */
  addedBy: string | null
}

/**
 * A user eligible to be enrolled in a HOSPITAL's PQS roster — i.e. anyone with
 * membership in the hospital's org (org-level OR a commission in the org). PHI-free
 * (profile name/email for display). Serves the roster enroll-picker (coordinator /
 * nsp_org_admin) and the appoint-coordinator picker.
 */
export interface PqsEligibleUser {
  /** The user's profile id. */
  userId: string
  /** Display name from `profiles.full_name` (may be null — treat as unknown). */
  fullName: string | null
  /** Denormalized auth email copy (`profiles.email`, nullable — `string | null`). */
  email: string | null
}

/**
 * One hospital whose NSP the current user OPERATES (enrolled `pqs_member` OR
 * appointed `nsp_coordinator`) — the unit of the NSP hospital switcher (ADR 0052,
 * decision 12). PHI-free. `role` reports the STRONGEST grant the user holds for the
 * hospital (`'coordinator'` implies full operator; `'member'` is roster enrollment).
 */
export interface NspHospitalGrant {
  /** The hospital whose NSP the user operates (= the PHI-scope key). */
  hospitalId: string
  /** Display name from `hospitals.name`. */
  hospitalName: string
  /** The hospital's organization (for routing under `/o/[org]/nsp`). */
  orgId: string
  /** Strongest grant: `'coordinator'` (full local operator) or `'member'` (enrolled). */
  role: 'coordinator' | 'member'
}

// ===========================================================================
// Org NSP-admin console — PHI-FREE aggregate rollups (ADR 0052 §N.1, decision 13).
//
// The `nsp_org_admin` reads org-wide, per-hospital ROLLUPS — counts + status only,
// NEVER a PHI/free-text/narrative column (the qa keystone). These shapes carry ONLY
// hospital identity (staff-facing) + integer counts / status buckets. NO patient
// identity, NO codes tied to a patient, NO narrative.
// ===========================================================================

/**
 * Per-hospital event rollup for the org NSP-admin console. PHI-free: hospital
 * identity + integer counts keyed by triage status and suspected-harm band. Never a
 * patient column, event code, title, or narrative.
 */
export interface NspEventRollupRow {
  /** The hospital these counts belong to. */
  hospitalId: string
  /** Display name from `hospitals.name`. */
  hospitalName: string
  /** Total events reported by the hospital's commissions. */
  total: number
  /** Event counts grouped by triage/workflow status (status slug → count). */
  byStatus: Record<string, number>
  /** Event counts grouped by suspected-harm band (band slug → count). */
  byHarm: Record<string, number>
}

/**
 * Per-hospital CAPA rollup for the org NSP-admin console. PHI-free: hospital identity
 * + integer counts by CAPA lifecycle bucket. Never a plan id, lessons-learned, or
 * action description.
 */
export interface NspCapaRollupRow {
  /** The hospital these counts belong to. */
  hospitalId: string
  /** Display name from `hospitals.name`. */
  hospitalName: string
  /** Open (in-progress) CAPA plans. */
  open: number
  /** Overdue CAPA plans (past due, not closed). */
  overdue: number
  /** Closed CAPA plans. */
  closed: number
}

/**
 * Per-hospital roster + coordinator for the org NSP-admin console. Staff identity
 * only (never patient) — the nsp_org_admin curates rosters org-wide but reads ZERO
 * PHI. `coordinator` is the hospital's appointed `nsp_coordinator` (or null).
 */
export interface NspOrgRosterRow {
  /** The hospital this roster belongs to. */
  hospitalId: string
  /** Display name from `hospitals.name`. */
  hospitalName: string
  /** The hospital's appointed coordinator (staff), or null if none. */
  coordinator: PqsEligibleUser | null
  /** The hospital's enrolled roster members (staff). */
  members: PqsRosterMember[]
}
