/**
 * Shared client-safe view types for the bulk-case wizard ("Múltiplos casos", ADR
 * 0084). A tiny pure module (TYPE-ONLY imports, all erased) so the wizard and each
 * step share these shapes without an import cycle and without dragging any
 * server-only query module into the client bundle.
 */

import type { CustomFieldDef } from "@/lib/queries/process-templates";
import type {
  BulkCreateCasesInput,
  BulkCreateCasesResult,
} from "@/lib/cases/bulk-actions";

/** First phase only vs all phases pre-assigned to the same owner (Design #3). */
export type PhaseScope = "first_only" | "all_phases";

/** The server action, passed into the client wizard as a prop (WizardRunner boundary). */
export type BulkCreateAction = (
  input: BulkCreateCasesInput,
) => Promise<BulkCreateCasesResult>;

/** An ELIGIBLE process template (active + ≥1 phase) the wizard can bulk-create from. */
export interface BulkTemplateOption {
  id: string;
  title: string;
  /** Snapshotted into `cases.patient_enabled`; gates the PHI columns (with the flag). */
  collectsPatient: boolean;
  /** The template's custom-field definitions (drive the grid columns). */
  customFields: CustomFieldDef[];
}

/** A commission member the deal can distribute cases to. */
export interface BulkMember {
  userId: string;
  fullName: string | null;
  email: string | null;
}

/** The member's display name, falling back to email then a placeholder. */
export function memberName(member: BulkMember): string {
  return member.fullName || member.email || "Sem nome";
}
