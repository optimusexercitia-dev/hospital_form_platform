/**
 * Shared client-safe view types for the bulk-case wizard ("Múltiplos casos", ADR
 * 0084). A tiny pure module (TYPE-ONLY imports, all erased) so the wizard and each
 * step share these shapes without an import cycle and without dragging any
 * server-only query module into the client bundle.
 */

import type { CustomFieldDef } from "@/lib/queries/process-templates";
import type { PatientMode, PatientRequiredField } from "@/lib/queries/cases";
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
  /**
   * Snapshotted into `cases.patient_mode`; gates the PHI columns (with the flag).
   *
   * ⛔ This was `collectsPatient: boolean` until 2026-08-24, and the boolean was
   * LOSSY IN EXACTLY ONE DIRECTION — it could not express `'required'`. That is why
   * a `required` template's PHI columns were offered UNMARKED here while the
   * single-case dialog marked them: nothing failed, no gate fired, and the user
   * filled a whole grid before the door refused it (FUP-0137-BULK-WIZARD-STILL-BOOLEAN).
   */
  patientMode: PatientMode;
  /**
   * When {@link patientMode} is `'required'`, the identifier fields every ROW must
   * carry. `mrn` is always a member (the LGPD erasure key; the DB welds it in).
   * Empty for the other two modes.
   */
  patientRequiredFields: PatientRequiredField[];
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
