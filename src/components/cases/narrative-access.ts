import type { CaseNarrative, CaseViewerCapabilities } from "@/lib/queries/cases";

/**
 * Narrative ATTRIBUTION-AWARE write rules (Case Access Control increment, ADR 0033
 * D4/D5/Q14). The per-narrative `assignedTo` / `status` / `concludedAt` fields now
 * live on {@link CaseNarrative} itself (added by `backend` in BE-3), so the UI reads
 * them directly — no adapter. This module holds only the shared DECISION logic so
 * the detail card, the focused editor, and the access panel agree.
 */

/**
 * Whether the current viewer may EDIT a narrative's body (Q14; ADR 0033 D4).
 * Narrative write = coordinator/admin OR the narrative's assignee OR
 * (`canWriteContent` AND the narrative is un-attributed). Editing additionally
 * requires the narrative to be `aberta` (a concluded body is frozen) and the case
 * non-terminal (`caseOpen`). The DB re-checks `can_write_case_narrative` — this is
 * the UI mirror, not the security boundary.
 */
export function canEditNarrative(
  narrative: CaseNarrative,
  caps: CaseViewerCapabilities,
  caseOpen: boolean,
  viewerId: string | null,
): boolean {
  if (!caseOpen) return false;
  if (narrative.status !== "aberta") return false;
  // Coordinator/admin: always (they also hold canManageLifecycle).
  if (caps.canManageLifecycle) return true;
  if (!caps.canWriteContent) return false;
  // Write-grantee: the narrative's assignee, or any un-attributed narrative (Q14).
  if (narrative.assignedTo === null) return true;
  return viewerId != null && narrative.assignedTo === viewerId;
}
