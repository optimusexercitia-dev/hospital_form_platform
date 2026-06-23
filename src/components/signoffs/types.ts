import type { Json } from "@/lib/types/database";
import type { VersionTree } from "@/lib/queries/forms";

import type { Signoff } from "./signoff-status";

/**
 * Thin CLIENT-facing prop shapes the sign-off UI (F1/F2) renders against. The
 * route pages adapt B2's query results (`src/lib/queries/signoffs.ts`) into
 * these via `./adapt` — so the client tree never value-imports `src/lib/queries/*`
 * (Rule 9 + the client/server boundary) and a backend shape change is absorbed
 * in one adapter file. Differences from B2's server types are deliberate: the
 * client uses non-null display strings (pt-BR fallbacks applied in the adapter)
 * and a `signoffsBySectionId` map (B2 returns a `SignoffRecord[]` array).
 */

/** One row in the staff_admin "pendentes de assinatura" queue (F1). */
export interface SignoffQueueRow {
  responseId: string;
  formId: string;
  formTitle: string;
  versionNumber: number;
  respondentName: string;
  /** The pending (visible, unsigned, staff_admin-role) section being awaited. */
  sectionId: string;
  sectionTitle: string;
  /** How many such sections are pending on this response (≥1). */
  pendingCount: number;
  /** ISO timestamps. */
  startedAt: string;
  updatedAt: string;
}

/**
 * A recorded sign-off row keyed by its section (F2). Reuses the `Signoff`
 * display shape (`signedByName`, `signedAt`, `note?`) the F4 badge consumes.
 */
export interface SectionSignoff extends Signoff {
  sectionId: string;
}

/**
 * Everything the review-and-sign screen (F2) renders for one in_progress
 * response that has a pending staff_admin sign-off. Adapted from B2's
 * `ResponseForSignoff` by `./adapt` (`signoffs[]` → `signoffsBySectionId`,
 * nullable names → pt-BR fallbacks).
 */
export interface ClientResponseForSignoff {
  responseId: string;
  formId: string;
  commissionId: string;
  formTitle: string;
  respondentName: string;
  startedAt: string;
  updatedAt: string;
  /** The version-faithful section/item tree (immutable for this response). */
  tree: VersionTree;
  /** Saved answer values keyed by `form_items.id`. */
  answersByItemId: Record<string, Json>;
  /** Per-item observation notes keyed by `form_items.id`
   *  (form-builder-enhancements; surfaced by BE-8). */
  observationsByItemId: Record<string, string>;
  /** Existing sign-off rows for this response, by section. */
  signoffsBySectionId: Record<string, SectionSignoff>;
}
