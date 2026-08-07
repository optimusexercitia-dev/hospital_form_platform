"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormBanner } from "@/components/auth/form-banner";
import {
  REVOKE_REASON_CLASSES,
  type RevokeReasonClass,
} from "@/components/printing/labels";
import type {
  PrintedDocumentActionState,
  RevokePrintedDocumentInput,
} from "@/lib/pdf-mint/actions";

/** The revoke server action, passed down from the page. */
export type RevokeDocumentAction = (
  input: RevokePrintedDocumentInput,
) => Promise<PrintedDocumentActionState>;

/**
 * "Anular documento" (ADR 0104 D6/D12) — manual, rare, mandatory reason, audited.
 *
 * Revocation is a GOVERNANCE act, not an undo: it deletes nothing, the bytes and
 * the registry row are permanent, and what changes is what verification reports
 * and what the download overlay stamps. The dialog says all of that plainly,
 * because "anular" invites the reader to assume the document goes away.
 *
 * Authority is NOT decided here. The caller passes `canRevoke`, derived
 * server-side from the same gate the surrounding screen already enforces, and
 * the server action re-checks it — hiding a button is never the control
 * (Architecture Rule 1).
 *
 * The reason is a closed class PLUS mandatory free text, and the free text must
 * be PHI-free. That instruction is inline and wired into the field's
 * `aria-describedby`, not buried in a tooltip: this box writes into the audit
 * ledger, which is not a lawful home for patient data (Rule 11 records *that*
 * and *who*, never content).
 */
export function RevokeDocumentDialog({
  documentId,
  shortCode,
  action,
}: {
  documentId: string;
  /** Verification short code — identifies WHICH emission is being annulled when
   * a source has several. Not PHI; it is the code printed beside the QR. */
  shortCode: string;
  action: RevokeDocumentAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reasonClass, setReasonClass] = useState<RevokeReasonClass | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const classIds = useFieldIds("reasonClass", {
    hasError: Boolean(fieldErrors.reasonClass),
    hasDescription: true,
    required: true,
  });
  const reasonIds = useFieldIds("reason", {
    hasError: Boolean(fieldErrors.reason),
    hasDescription: true,
    required: true,
  });

  const selected = REVOKE_REASON_CLASSES.find((c) => c.value === reasonClass);

  function reset() {
    setReasonClass("");
    setReason("");
    setError(null);
    setFieldErrors({});
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!reasonClass) {
      setFieldErrors({ reasonClass: "Escolha um motivo." });
      return;
    }
    if (!reason.trim()) {
      setFieldErrors({ reason: "Descreva o motivo da anulação." });
      return;
    }

    startTransition(async () => {
      try {
        const result = await action({
          documentId,
          reasonClass,
          reason: reason.trim(),
        });
        if (!result.ok) {
          setError(result.error ?? "Não foi possível anular o documento.");
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          return;
        }
        setOpen(false);
        reset();
        router.refresh();
      } catch {
        setError(
          "Não foi possível anular o documento agora. Tente novamente em alguns instantes.",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Ban aria-hidden="true" className="size-4" />
          Anular
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular documento</DialogTitle>
          <DialogDescription>
            Emissão <span className="font-mono">{shortCode}</span>. O documento
            não é apagado: ele passa a constar como anulado na verificação
            pública e os downloads recebem a marca{" "}
            <span className="font-mono">ANULADO</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? <FormBanner tone="error">{error}</FormBanner> : null}

          <Field>
            <FieldLabel htmlFor={classIds.controlProps.id}>
              Motivo da anulação
            </FieldLabel>
            <NativeSelect
              {...classIds.controlProps}
              className="h-10"
              value={reasonClass}
              onChange={(event) =>
                setReasonClass(event.target.value as RevokeReasonClass | "")
              }
              disabled={isPending}
            >
              <option value="">Selecione um motivo…</option>
              {REVOKE_REASON_CLASSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription id={classIds.descriptionId}>
              {selected
                ? selected.hint
                : "Classificação registrada na auditoria junto com a anulação."}
            </FieldDescription>
            <FieldError id={classIds.errorId}>
              {fieldErrors.reasonClass}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor={reasonIds.controlProps.id}>
              Descrição do motivo
            </FieldLabel>
            <Textarea
              {...reasonIds.controlProps}
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isPending}
              placeholder="Explique por que esta emissão está sendo anulada…"
            />
            <FieldDescription id={reasonIds.descriptionId}>
              Registrado permanentemente na auditoria.{" "}
              <strong className="font-medium text-foreground">
                Não escreva dados de paciente
              </strong>{" "}
              — nada de nomes, prontuários, datas de nascimento ou detalhes
              clínicos. Descreva apenas o motivo administrativo da anulação.
            </FieldDescription>
            <FieldError id={reasonIds.errorId}>{fieldErrors.reason}</FieldError>
          </Field>

          <p className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm leading-relaxed text-pretty text-foreground">
            <ShieldAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-destructive"
            />
            <span>
              Vias já impressas continuam existindo em papel. A anulação passa a
              aparecer para quem verificar o QR code, mas não alcança a tinta.
            </span>
          </p>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="lg"
              variant="destructive"
              disabled={isPending}
            >
              {isPending ? "Anulando…" : "Anular documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
