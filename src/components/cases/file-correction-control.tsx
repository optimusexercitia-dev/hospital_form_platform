"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";

import type { CorrectionKind } from "@/lib/queries/corrections";
import { fileCorrectionRequest } from "@/lib/corrections/actions";
import {
  CORRECTION_CLASSIFICATIONS,
  CORRECTION_CLASSIFICATION_META,
  CORRECTION_KINDS,
  CORRECTION_KIND_META,
  type CorrectionCaps,
} from "@/components/cases/correction-labels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FormBanner } from "@/components/auth/form-banner";
import type { AssigneeOption } from "@/components/cases/case-phase-list";

/** The correction TARGET — a completed phase XOR a concluded/voided narrative. */
export type CorrectionTarget =
  | { kind: "phase"; casePhaseId: string }
  | { kind: "narrative"; caseNarrativeId: string };

/**
 * The "Corrigir…" affordance (Case Correction Lifecycle, ADR 0085): a dropdown menu
 * offering the three request kinds (Solicitar correção / adendo / anulação) on a
 * completed phase or a concluded narrative that has NO open request. Selecting a kind
 * opens a dialog with a MANDATORY reason + a descriptive classification; a
 * staff_admin may additionally designate the corrector (defaults to the target's
 * assignee), which a non-approver filer cannot — the server defaults it to the
 * assignee (HC0M4 gates the rest). Files via {@link fileCorrectionRequest}.
 *
 * The parent renders this ONLY when `caps.canFile` (flag on + case open) is true, so
 * this component assumes it may file; the DEFINER door re-checks every rule.
 */
export function FileCorrectionControl({
  target,
  targetLabel,
  assignees,
  caps,
  defaultCorrectorId,
}: {
  target: CorrectionTarget;
  /** Human label for the dialog title (e.g. "Fase 2 — Revisão"). */
  targetLabel: string;
  /** The commission roster — the corrector picker (staff_admin only). */
  assignees: AssigneeOption[];
  caps: CorrectionCaps;
  /** The target's current assignee id (pre-selects the corrector picker); `null` if none. */
  defaultCorrectorId: string | null;
}) {
  const [openKind, setOpenKind] = useState<CorrectionKind | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <PencilLine aria-hidden="true" />
            Corrigir…
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Solicitar correção</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {CORRECTION_KINDS.map((kind) => {
            const meta = CORRECTION_KIND_META[kind];
            const Icon = meta.icon;
            return (
              <DropdownMenuItem
                key={kind}
                className="gap-2"
                onSelect={() => setOpenKind(kind)}
              >
                <Icon aria-hidden="true" className="size-4" />
                {meta.action}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {openKind && (
        <FileCorrectionDialog
          kind={openKind}
          target={target}
          targetLabel={targetLabel}
          assignees={assignees}
          canDesignateCorrector={caps.canApprove}
          defaultCorrectorId={defaultCorrectorId}
          onClose={() => setOpenKind(null)}
        />
      )}
    </>
  );
}

function FileCorrectionDialog({
  kind,
  target,
  targetLabel,
  assignees,
  canDesignateCorrector,
  defaultCorrectorId,
  onClose,
}: {
  kind: CorrectionKind;
  target: CorrectionTarget;
  targetLabel: string;
  assignees: AssigneeOption[];
  canDesignateCorrector: boolean;
  defaultCorrectorId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const meta = CORRECTION_KIND_META[kind];
  const isVoid = kind === "void";
  // A void request has no draft, so no corrector is needed. Otherwise the picker
  // is offered to a staff_admin only; a plain filer lets the server default it to
  // the target's assignee.
  const showCorrectorPicker = canDesignateCorrector && !isVoid;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("reason") ?? "").trim();
    const classification = String(
      formData.get("classification") ?? "clerical",
    ) as (typeof CORRECTION_CLASSIFICATIONS)[number];
    const correctorRaw = String(formData.get("corrector") ?? "");
    const permittedCorrector =
      showCorrectorPicker && correctorRaw ? correctorRaw : undefined;

    if (!reason) {
      setError("Informe o motivo da correção.");
      reasonRef.current?.focus();
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await fileCorrectionRequest({
        kind,
        casePhaseId: target.kind === "phase" ? target.casePhaseId : null,
        caseNarrativeId:
          target.kind === "narrative" ? target.caseNarrativeId : null,
        reason,
        classification,
        permittedCorrector,
      });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível criar a solicitação.");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          reasonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{meta.action}</DialogTitle>
          <DialogDescription>
            {isVoid ? (
              <>
                A anulação marca <span className="font-medium">{targetLabel}</span> como
                anulada após aprovação. O registro é preservado no histórico; refaça o
                trabalho com uma fase adicional, se necessário.
              </>
            ) : (
              <>
                Abre uma solicitação de {meta.label.toLowerCase()} para{" "}
                <span className="font-medium">{targetLabel}</span>. O conteúdo original é
                preservado; a correção passa por aprovação antes de valer.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}

          <Field>
            <FieldLabel htmlFor="correction-reason">Motivo</FieldLabel>
            <Textarea
              ref={reasonRef}
              id="correction-reason"
              name="reason"
              required
              rows={3}
              placeholder="Explique o que precisa ser corrigido e por quê…"
              aria-describedby="correction-reason-description"
            />
            <FieldDescription id="correction-reason-description">
              Registrado na solicitação e no histórico de auditoria.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="correction-classification">Classificação</FieldLabel>
            <NativeSelect
              id="correction-classification"
              name="classification"
              className="h-10"
              defaultValue="clerical"
              aria-describedby="correction-classification-description"
            >
              {CORRECTION_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {CORRECTION_CLASSIFICATION_META[c].label}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription id="correction-classification-description">
              Descreve o tipo de mudança para quem for aprovar. Não altera as regras.
            </FieldDescription>
          </Field>

          {showCorrectorPicker && (
            <Field>
              <FieldLabel htmlFor="correction-corrector">Corretor</FieldLabel>
              <NativeSelect
                id="correction-corrector"
                name="corrector"
                className="h-10"
                defaultValue={defaultCorrectorId ?? ""}
                aria-describedby="correction-corrector-description"
              >
                <option value="">Responsável atual da etapa</option>
                {assignees.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
              <FieldDescription id="correction-corrector-description">
                Quem fará a correção. Por padrão, o responsável original.
              </FieldDescription>
            </Field>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Enviando…" : meta.action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
