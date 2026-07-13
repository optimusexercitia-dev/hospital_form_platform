"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";

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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FormBanner } from "@/components/auth/form-banner";
import { commissionHref } from "@/lib/routing";
import type { SupersedeResponseState } from "@/lib/responses/actions";

type SupersedeAction = (
  prev: SupersedeResponseState | undefined,
  formData: FormData,
) => Promise<SupersedeResponseState>;

/**
 * "Corrigir envio" (SUP / ADR 0074, plan §5) — rendered ONLY when
 * `SubmissionDetail.canCorrect` is true (computed server-side; the client
 * never re-derives authority). Opens a confirm dialog with a MANDATORY
 * "Motivo da correção" field, calls `supersedeResponseAction`, and on success
 * routes straight into the successor draft in the fill wizard (reusing the
 * existing `/forms/[formId]/responder/[responseId]` route — the successor is
 * an ordinary in_progress response owned by the caller).
 *
 * Visual pattern mirrors `PublishDocumentDialog` / `SupersedeDocumentButton`
 * (server-action-as-prop, `Field`/`FieldLabel`) plus the mandatory-reason
 * input this flow requires. UNLIKE those, this calls the action directly
 * from the submit handler (via `useTransition`) instead of wiring it through
 * `useActionState`'s `<form action>`: `supersedeResponseAction` revalidates
 * THIS response's own detail page, which flips `canCorrect` to `false` on
 * success and unmounts this very button from the server-rendered tree — a
 * `useEffect` reacting to a `useActionState` result loses that race (the
 * button can vanish before its own effect runs the navigation). Calling
 * `router.push` synchronously after the awaited action, inside the same
 * event-driven transition, sidesteps that unmount race entirely.
 */
export function CorrectSubmissionButton({
  responseId,
  formId,
  org,
  slug,
  action,
}: {
  responseId: string;
  formId: string;
  org: string;
  slug: string;
  action: SupersedeAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reasonFieldRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action(undefined, formData);
      if (!result.ok || !result.successorId) {
        setError(result.error ?? "Não foi possível iniciar a correção.");
        return;
      }
      setOpen(false);
      router.push(
        commissionHref(org, slug, "forms", formId, "responder", result.successorId),
      );
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PenLine aria-hidden="true" className="size-4" />
          Corrigir envio
        </Button>
      </DialogTrigger>

      <DialogContent
        onOpenAutoFocus={(event) => {
          // Focus the reason field (not the dialog's default first-tabbable)
          // so a keyboard user can start typing immediately.
          event.preventDefault();
          reasonFieldRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Corrigir envio</DialogTitle>
          <DialogDescription>
            Isso cria uma nova versão em andamento a partir das respostas
            enviadas. A resposta original é preservada e passa a aparecer como
            &ldquo;substituído&rdquo;; a correção conta no lugar dela nos
            painéis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="responseId" value={responseId} />

          {error ? <FormBanner tone="error">{error}</FormBanner> : null}

          <Field>
            <FieldLabel htmlFor="supersede-reason">
              Motivo da correção
            </FieldLabel>
            <Textarea
              ref={reasonFieldRef}
              id="supersede-reason"
              name="reason"
              required
              rows={4}
              placeholder="Explique o que precisa ser corrigido e por quê…"
              aria-describedby="supersede-reason-description"
            />
            <FieldDescription id="supersede-reason-description">
              Registrado no histórico de auditoria junto com a correção.
            </FieldDescription>
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Iniciando correção…" : "Iniciar correção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
