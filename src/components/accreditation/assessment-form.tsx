"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { setStandardAssessment, type ActionState } from "@/lib/accreditation/actions";
import { ASSESSMENT_STATUS_LABELS, type AssessmentStatus } from "@/lib/accreditation/types";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { AssessmentStatusChip } from "@/components/accreditation/status-chips";

const STATUS_OPTIONS: AssessmentStatus[] = [
  "conforme",
  "parcial",
  "nao_conforme",
  "nao_aplicavel",
];

/**
 * The commission's self-assessment for one standard — `set_standard_assessment`
 * upsert. `noteMd` is sanitized Markdown (`standard_assessments.note_md`,
 * Rule 7) carrying the standing PHI-discouragement helper text (D8 — "the
 * module stays PHI-free"; mirrors `edit-case-meta-dialog.tsx`'s copy). Renders
 * a READ-ONLY summary when `canEdit` is false — the same capability-gate
 * pattern the case surfaces use (`caps.canManageLifecycle`), not a bundle of
 * independent booleans.
 */
export function AssessmentForm({
  commissionId,
  standardId,
  currentStatus,
  currentNoteMd,
  canEdit,
}: {
  commissionId: string;
  standardId: string;
  currentStatus: AssessmentStatus | null;
  currentNoteMd: string | null;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionState | undefined, FormData>(
    setStandardAssessment,
    undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-3">
        <AssessmentStatusChip status={currentStatus} />
        {currentNoteMd ? (
          <MarkdownRenderer content={currentNoteMd} />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma observação registrada.</p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="commissionId" value={commissionId} />
      <input type="hidden" name="standardId" value={standardId} />

      {state && !state.ok && !state.fieldErrors && <FormBanner tone="error">{state.error}</FormBanner>}
      {state?.ok && <FormBanner tone="success">{state.error}</FormBanner>}

      <label htmlFor="assessment-status" className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Status de conformidade</span>
        <NativeSelect
          id="assessment-status"
          name="status"
          defaultValue={currentStatus ?? ""}
          required
          aria-invalid={state?.fieldErrors?.status ? true : undefined}
          aria-describedby={state?.fieldErrors?.status ? "assessment-status-error" : undefined}
        >
          <option value="" disabled>
            Selecione…
          </option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {ASSESSMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
        {state?.fieldErrors?.status && (
          <span id="assessment-status-error" role="alert" className="text-sm font-medium text-destructive">
            {state.fieldErrors.status}
          </span>
        )}
      </label>

      <label htmlFor="assessment-note" className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          Observações <span className="font-normal text-muted-foreground">(opcional)</span>
        </span>
        <Textarea
          id="assessment-note"
          name="noteMd"
          rows={4}
          defaultValue={currentNoteMd ?? ""}
          placeholder="Justifique a avaliação, cite lacunas ou próximos passos…"
          aria-describedby="assessment-note-help"
        />
        <span id="assessment-note-help" className="text-xs text-muted-foreground">
          Não inclua nome, prontuário ou outros dados do paciente. Aceita Markdown básico.
        </span>
      </label>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar autoavaliação"}
        </Button>
      </div>
    </form>
  );
}
