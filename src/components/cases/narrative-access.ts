import type { CaseNarrative, CaseViewerCapabilities } from "@/lib/queries/cases";

/**
 * Narrative ATTRIBUTION-AWARE write rules (Case Access Control increment, ADR 0033
 * D4/D5/Q14). The per-narrative `assignedTo` / `status` / `concludedAt` fields now
 * live on {@link CaseNarrative} itself (added by `backend` in BE-3), so the UI reads
 * them directly — no adapter. This module holds only the shared DECISION logic so
 * the detail card, the focused editor, and the access panel agree.
 */

/**
 * Whether the current viewer may EDIT a narrative's body (Q14; ADR 0033 D4) — the
 * UI mirror of the DB predicate `app.can_write_case_narrative` (NOT the security
 * boundary; the RPC re-checks server-side).
 *
 * Narrative write = coordinator/admin OR the narrative's assignee OR
 * (`canWriteContent` AND the narrative is un-attributed). The assignee branch is
 * INDEPENDENT of `canWriteContent`: an assignee who reads only via attribution still
 * writes their own narrative (CA-002). Editing additionally requires the narrative to
 * be `aberta` (a concluded body is frozen) and the case non-terminal (`caseOpen`) —
 * the WHETHER, kept separate from the WHO.
 */
export function canEditNarrative(
  narrative: CaseNarrative,
  caps: CaseViewerCapabilities,
  caseOpen: boolean,
  viewerId: string | null,
): boolean {
  // WHETHER it is editable AT ALL (separate from WHO): a concluded body is frozen
  // and a terminal case is locked.
  if (!caseOpen) return false;
  if (narrative.status !== "aberta") return false;

  // WHO may edit — mirror the DB predicate `app.can_write_case_narrative` EXACTLY
  // (Q14). Order matters: the assignee check MUST precede the `canWriteContent` gate,
  // because an assignee who reads only via attribution (no write grant — CA-002) is
  // still the sole writer of their OWN narrative.
  //
  //   coordinator/admin  → any narrative (assigned or not)
  if (caps.canManageLifecycle) return true;
  //   the assignee       → their OWN narrative, regardless of canWriteContent
  if (viewerId != null && narrative.assignedTo === viewerId) return true;
  //   a case write-grantee → UN-attributed narratives only (attributed ones are
  //                          reserved to their assignee, Q14)
  if (caps.canWriteContent && narrative.assignedTo === null) return true;
  return false;
}
