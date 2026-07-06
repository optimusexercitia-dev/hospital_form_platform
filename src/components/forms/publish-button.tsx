"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import {
  publishVersion,
  type PublishVersionOptions,
} from "@/lib/forms/actions";
import type { ApproverCandidate } from "@/lib/queries/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * Publish flow (F6): confirms, then calls {@link publishVersion} (which runs the
 * `publish_form_version` RPC — condition validation + archive-previous + flip to
 * published). A validation failure (e.g. a forward/first-section condition
 * reference) comes back as a pt-BR message that we keep ON SCREEN inside the open
 * dialog; on success we close and refresh so the page re-renders the now-published
 * version read-only.
 *
 * Phase 17, F7 — when `controlledDocsEnabled` is on, the dialog also offers OPTIONAL
 * document-control metadata (a named approver, effective date, and review-cycle
 * months) forwarded to the widened RPC. All fields are optional and metadata-only
 * (forms carry NO e-signature workflow); when the flag is off the section is hidden
 * and publishing behaves exactly as before (bare `publishVersion(versionId)`).
 *
 * The confirm control is a plain Button (not `AlertDialogAction`) so the dialog
 * does NOT auto-close on click — it stays open to show a validation error.
 */
export function PublishButton({
  versionId,
  controlledDocsEnabled = false,
  approverCandidates = [],
}: {
  versionId: string;
  controlledDocsEnabled?: boolean;
  approverCandidates?: ApproverCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Optional document-control metadata (F7); only meaningful when the flag is on.
  const [approverId, setApproverId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reviewCycleMonths, setReviewCycleMonths] = useState("");

  function resetMeta() {
    setApproverId("");
    setEffectiveDate("");
    setReviewCycleMonths("");
  }

  function handleConfirm() {
    setError(null);

    // Build the options only when controlled-docs is on; otherwise call the bare,
    // backward-compatible form (no options → RPC behaves exactly as before).
    let options: PublishVersionOptions | undefined;
    if (controlledDocsEnabled) {
      const parsedCycle = reviewCycleMonths.trim()
        ? Number(reviewCycleMonths)
        : undefined;
      options = {
        approverId: approverId || undefined,
        effectiveDate: effectiveDate || undefined,
        reviewCycleMonths:
          parsedCycle != null && Number.isFinite(parsedCycle)
            ? parsedCycle
            : undefined,
      };
    }

    startTransition(async () => {
      const result = await publishVersion(versionId, options);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível publicar o formulário.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setError(null);
          resetMeta();
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" size="lg">
          <Send aria-hidden="true" />
          Publicar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publicar este formulário?</AlertDialogTitle>
          <AlertDialogDescription>
            Ao publicar, esta versão fica disponível para preenchimento e não
            poderá mais ser editada. Uma versão publicada anterior será
            arquivada. Para alterar depois, crie um novo rascunho a partir da
            versão publicada.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {controlledDocsEnabled ? (
          <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <legend className="px-1 text-sm font-medium">
              Controle de documento (opcional)
            </legend>

            <Field>
              <FieldLabel htmlFor="publish-approver">Aprovador</FieldLabel>
              <NativeSelect
                id="publish-approver"
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                className="h-10"
                disabled={approverCandidates.length === 0}
              >
                <option value="">Sem aprovador</option>
                {approverCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.title ? ` — ${c.title}` : ""}
                  </option>
                ))}
              </NativeSelect>
              <FieldDescription>
                Registra quem aprovou o formulário como documento controlado.
              </FieldDescription>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="publish-effective">
                  Data de vigência
                </FieldLabel>
                <DatePicker
                  id="publish-effective"
                  value={effectiveDate}
                  onChange={setEffectiveDate}
                  clearable
                  className="w-full"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="publish-cycle">
                  Ciclo de revisão (meses)
                </FieldLabel>
                <Input
                  id="publish-cycle"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  step={1}
                  value={reviewCycleMonths}
                  onChange={(e) => setReviewCycleMonths(e.target.value)}
                  placeholder="Ex.: 24"
                  className="h-10"
                />
              </Field>
            </div>
          </fieldset>
        ) : null}

        {error && <FormBanner tone="error">{error}</FormBanner>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            size="lg"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Publicando…" : "Publicar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
