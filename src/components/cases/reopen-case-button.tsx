"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { reopenCase } from "@/lib/cases/actions";
import { Button } from "@/components/ui/button";
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
import { FormBanner } from "@/components/auth/form-banner";

/**
 * "Reabrir caso" (Case Correction Lifecycle, ADR 0085) — a staff_admin control on a
 * CONCLUDED case so its testimony can be corrected (a completed target on a closed
 * case must reopen the case first). A mandatory reason is durably recorded via
 * {@link reopenCase} (`reopen_case` door). A `cancelled` case is terminal-forever
 * (HC0M8) and never gets this control — the host renders it only for a completed
 * case. The dialog surfaces the door's pt-BR error inline; raw errors never show.
 */
export function ReopenCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    ).trim();
    if (!reason) {
      setError("Informe o motivo da reabertura.");
      reasonRef.current?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reopenCase(caseId, reason);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível reabrir o caso.");
        return;
      }
      setOpen(false);
      router.refresh();
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
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
      >
        <RotateCcw aria-hidden="true" />
        Reabrir caso
      </Button>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          reasonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Reabrir o caso?</DialogTitle>
          <DialogDescription>
            O caso volta a ficar aberto para que fases e narrativas concluídas
            possam ser corrigidas. O motivo fica registrado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <Field>
            <FieldLabel htmlFor="reopen-reason">Motivo da reabertura</FieldLabel>
            <Textarea
              ref={reasonRef}
              id="reopen-reason"
              name="reason"
              required
              rows={3}
              placeholder="Explique por que o caso precisa ser reaberto…"
              aria-describedby="reopen-reason-description"
            />
            <FieldDescription id="reopen-reason-description">
              Registrado no histórico do caso.
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Reabrindo…" : "Reabrir caso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
