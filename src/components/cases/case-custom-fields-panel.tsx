import { SlidersHorizontal } from "lucide-react";

import type { CaseCustomFieldValue } from "@/lib/queries/cases";
import { CustomFieldValue } from "@/components/cases/custom-field-input";
import { EditCaseCustomFieldsDialog } from "@/components/cases/edit-case-custom-fields-dialog";

/**
 * The case-detail custom-fields panel (ADR 0083 D8) — a compact rail card showing
 * the case's administrative descriptors as read-only "label: value" pairs (a
 * single-select code resolves to its option label; blank → em-dash). A caller who
 * may edit (coordinator / commission-admin / `create_cases` Administrativo) on an
 * OPEN case gets an "Editar" affordance opening {@link EditCaseCustomFieldsDialog}.
 *
 * The parent gates rendering on the flag + a non-empty field set, so this always
 * has at least one field to show.
 */
export function CaseCustomFieldsPanel({
  caseId,
  fields,
  canEdit,
}: {
  caseId: string;
  fields: CaseCustomFieldValue[];
  /** Whether the viewer may edit the values (coordinator + open case). */
  canEdit: boolean;
}) {
  return (
    <section
      aria-labelledby="case-custom-fields-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="case-custom-fields-heading"
          className="inline-flex items-center gap-2 text-base font-semibold"
        >
          <SlidersHorizontal
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          Campos personalizados
        </h2>
        {canEdit && (
          <EditCaseCustomFieldsDialog caseId={caseId} fields={fields} />
        )}
      </div>

      <dl className="flex flex-col gap-3">
        {fields.map((field) => (
          <CustomFieldValue key={field.id} field={field} />
        ))}
      </dl>
    </section>
  );
}
