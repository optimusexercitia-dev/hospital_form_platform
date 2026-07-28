import type { Json } from "@/lib/types/database";
import type { VersionTree } from "@/lib/queries/forms";
import type {
  GroupInstance,
  ReferenceAnswer,
  RiskMatrixAnswer,
} from "@/lib/queries/responses";

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
  /**
   * FF-1 (ADR 0087) — the response's repeating-group instances.
   *
   * REQUIRED, not optional, and deliberately so: this screen is where a
   * staff_admin puts their name to a section's content. An optional field here
   * would let a future caller omit it and silently return the exact defect this
   * replaces — sign-off chrome over an empty section, signed blind
   * (BUG-FF1-003). The maps above carry TOP-LEVEL answers only; a
   * repeating-group child's answers live here and nowhere else.
   */
  instances: GroupInstance[];
  /**
   * FF-2 (ADR 0089 · FUP-FF2-1) — the response's TOP-LEVEL matrix grids
   * (`{ itemId: { rowCode: colCode } }`) and risk answers.
   *
   * REQUIRED for exactly the reason `instances` is: this screen is where a
   * staff_admin puts their name to a section's content, and until FF-2's Wave 3
   * the door projected every answer shape EXCEPT these two — so a section whose
   * content was a matrix rendered an EMPTY GRID and was signed blind. Optional
   * fields here would let a future caller reintroduce that silently; a required
   * one turns the same mistake into a type error.
   *
   * A matrix inside a repeating group is NOT here — it lives on its
   * {@link GroupInstance}, exactly as scalar answers do.
   */
  matrixCellsByItemId: Record<string, Record<string, string>>;
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>;
  /**
   * FF-5 (ADR 0091) — the response's TOP-LEVEL entity references, with labels
   * already resolved by live join (ruling 4).
   *
   * REQUIRED for exactly the reason the two fields above are, and it is the
   * THIRD instance of one defect: a reference is answerable with `answers.value`
   * NULL, so a screen that does not receive this renders an answered reference
   * as "Sem resposta" — and this screen is where a staff_admin puts their name
   * to the content. Signing blind to a matrix (FF-2) and signing blind to a
   * repetition (FF-1) were both caught after the fact; making the field required
   * turns the same omission into a compile error instead of a review finding.
   *
   * A reference inside a repeating group is NOT here — it lives on its
   * {@link GroupInstance}, exactly as scalar answers and matrix grids do.
   */
  referencesByItemId: Record<string, ReferenceAnswer>;
  /**
   * QA m-3 — the response's TOP-LEVEL "Outros" free text.
   *
   * REQUIRED, and it is the **fourth** answer shape this surface lost by being
   * optional: instances (FF-1), matrix grids (FF-2), references (FF-5), and now
   * this. The door was projecting `other_text_by_item` for INSTANCES only, so a
   * top-level "Outro" answer reached the signer as a bare chip with the typed
   * text missing — someone attesting to content they were never shown (Rule 4).
   *
   * Non-null only: the door filters empty/whitespace, so an absent key means
   * "no Outro text", exactly as it does per instance.
   */
  otherTextByItemId: Record<string, string>;
  /** Existing sign-off rows for this response, by section. */
  signoffsBySectionId: Record<string, SectionSignoff>;
}
