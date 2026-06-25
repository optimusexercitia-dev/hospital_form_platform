/**
 * NSP / PQS roster — CLIENT-SAFE domain types (NSP-per-org, sub-phase A; ADR 0042).
 *
 * **Purity contract** (the `safety/types.ts` discipline). This module has ZERO
 * imports — it must remain importable from CLIENT components (the per-org roster
 * curation UI under `/o/[org]/nsp/**` that sub-phase B builds). It must NEVER import
 * `@/lib/supabase/*`, `next/headers`, `server-only`, or any data-access/action
 * module. The server-only query functions (`@/lib/queries/pqs`) and the `"use
 * server"` roster actions import their types FROM here, so a `"use client"`
 * component never transitively drags `@/lib/supabase/server` into the client bundle.
 *
 * Background: under multi-tenancy the PQS roster (`public.pqs_members`) becomes
 * PER-ORG. Enrollment in an org's roster is what grants that org's PHI **read**
 * (`app.is_pqs_member_of(org, uid)`). A dedicated per-org `nsp_coordinator` grant
 * (on `organization_members.role`) CURATES the roster — three-way duty separation:
 * `org_admin` (appoints the coordinator) ≠ `nsp_coordinator` (curates the roster) ≠
 * enrolled `pqs_member` (reads PHI). A coordinator is NOT implicitly a reader; they
 * enroll themselves explicitly.
 *
 * All user-facing strings are pt-BR, resolved in the UI (Rule 10); these are data.
 */

/**
 * One enrolled member of an organization's PQS roster, as the per-org roster
 * curation UI lists them. PHI-free: a roster row is `(organization_id, user_id)` +
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
  /** When the user was enrolled into THIS org's roster. */
  addedAt: string
  /** The curator (coordinator) who enrolled them; null for seed/system rows. */
  addedBy: string | null
}
