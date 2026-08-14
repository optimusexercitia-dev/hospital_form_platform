"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
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
import type { ActionState } from "@/lib/controlled-documents/actions";

type PublishAction = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Publish dialog (Phase 17, F3). Publishes a fully-approved version → `vigente`:
 * sets the effective date (required), an optional review-due override, and an
 * optional expiry. Posts to `publishDocument` (passed in as a prop); the RPC
 * requires ALL named approvers `aprovado` (else a pt-BR HC089+ message shown in
 * the open dialog). Review-due defaults to `effective + reviewCycleMonths` when
 * not overridden.
 *
 * The confirm control is a plain submit inside the dialog (not an auto-closing
 * action) so a validation error stays visible; on success we close and refresh.
 */
export function PublishDocumentDialog({
  documentVersionId,
  action,
}: {
  documentVersionId: string;
  action: PublishAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  const doneRef = useRef(false);

  useEffect(() => {
    if (state?.ok && !doneRef.current) {
      doneRef.current = true;
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="lg">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Publicar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicar versão</DialogTitle>
          <DialogDescription>
            A versão passa a vigorar e fica imutável. A versão vigente anterior,
            se houver, torna-se obsoleta.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="versionId" value={documentVersionId} />

          {state?.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          <Field>
            <FieldLabel htmlFor="effectiveDate">Data de vigência</FieldLabel>
            <DatePicker
              id="effectiveDate"
              name="effectiveDate"
              className="w-auto"
              aria-describedby="effectiveDate-description"
              aria-invalid={state?.fieldErrors?.effectiveDate ? true : undefined}
            />
            <FieldDescription id="effectiveDate-description">
              Data a partir da qual o documento passa a valer.
            </FieldDescription>
            <FieldError>{state?.fieldErrors?.effectiveDate}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="reviewDueDate">
              Data de revisão (opcional)
            </FieldLabel>
            <DatePicker
              id="reviewDueDate"
              name="reviewDueDate"
              clearable
              className="w-auto"
              aria-describedby="reviewDueDate-description"
            />
            <FieldDescription id="reviewDueDate-description">
              Se em branco, é calculada a partir da vigência e do ciclo de
              revisão.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="publishExpiryDate">
              Data de expiração (opcional)
            </FieldLabel>
            <DatePicker
              id="publishExpiryDate"
              name="expiryDate"
              clearable
              className="w-auto"
            />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Publicando…" : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
