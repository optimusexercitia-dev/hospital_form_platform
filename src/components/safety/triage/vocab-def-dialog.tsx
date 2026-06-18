"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/safety/types";
import type { VocabInput } from "@/lib/safety/triage-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { Textarea } from "@/components/ui/textarea";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** The vocabulary entry the dialog edits (event type OR sentinel criterion). */
export interface VocabEntry {
  id: string;
  key: string;
  label: string;
  description: string | null;
}

/**
 * Create / edit a configurable vocabulary entry — an event TYPE or a sentinel
 * CRITERION (`VocabInput { key, label, description }`). The two managers reuse this
 * one dialog, passing their own create/update actions. `key` is a stable ASCII
 * slug (immutable on edit — shown read-only so existing flags keep resolving).
 */
export function VocabDefDialog({
  mode,
  kind,
  open,
  onOpenChange,
  entry,
  onCreate,
  onUpdate,
}: {
  mode: "create" | "edit";
  kind: "eventType" | "criterion";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required for `edit`. */
  entry?: VocabEntry;
  onCreate: (input: VocabInput) => Promise<ActionState>;
  onUpdate: (id: string, input: VocabInput) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [key, setKey] = useState(entry?.key ?? "");
  const [label, setLabel] = useState(entry?.label ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setKey(entry?.key ?? "");
      setLabel(entry?.label ?? "");
      setDescription(entry?.description ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  const nouns =
    kind === "eventType"
      ? { title: "tipo de evento", titleCap: "Tipo de evento" }
      : { title: "critério sentinela", titleCap: "Critério sentinela" };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: VocabInput = {
      key: key.trim(),
      label: label.trim(),
      description: description.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create" ? await onCreate(input) : await onUpdate(entry!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? `Novo ${nouns.title}`
              : `Editar ${nouns.title}`}
          </DialogTitle>
          <DialogDescription>
            {kind === "eventType"
              ? "Vocabulário usado pelas comissões ao notificar e pelo NSP ao triar."
              : "Categorias que qualificam automaticamente um evento como sentinela."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.key && !state.fieldErrors?.label && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Chave</span>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              readOnly={mode === "edit"}
              className={FIELD_CLASS}
              placeholder="ex.: medicacao"
              aria-invalid={state?.fieldErrors?.key ? true : undefined}
            />
            <span className="text-xs text-muted-foreground">
              {mode === "edit"
                ? "A chave é estável e não pode ser alterada."
                : "Identificador estável (minúsculas, sem espaços)."}
            </span>
            {state?.fieldErrors?.key && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.key}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Rótulo</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder={
                kind === "eventType"
                  ? "Ex.: Erro de medicação"
                  : "Ex.: Cirurgia em local errado"
              }
              aria-invalid={state?.fieldErrors?.label ? true : undefined}
            />
            {state?.fieldErrors?.label && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.label}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Descrição (opcional)</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve explicação para apoiar quem classifica."
              className="min-h-20 text-sm"
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? `Criar ${nouns.title}`
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
