"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CapaMeasure, CapaMeasureInput } from "@/lib/safety/capa-types";
import type { ActionState } from "@/lib/safety/types";
import { addCapaMeasure, updateCapaMeasure } from "@/lib/safety/capa-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Create/edit a CAPA measure of success (name / target / definition). Includes a
 * DISABLED Phase-15 indicator picker (the `indicator_id` hook) with an explanatory
 * hint — the contract's `CapaMeasureInput` carries no indicator field yet, so this is
 * a visible-but-inert affordance until Indicadores (Fase 15) lands.
 */
export function CapaMeasureForm({
  mode,
  open,
  onOpenChange,
  capaId,
  measure,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capaId: string;
  /** Required for `edit`. */
  measure?: CapaMeasure;
}) {
  const router = useRouter();
  const indicatorHintId = useId();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [name, setName] = useState(measure?.name ?? "");
  const [target, setTarget] = useState(measure?.target ?? "");
  const [definition, setDefinition] = useState(measure?.definition ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setName(measure?.name ?? "");
      setTarget(measure?.target ?? "");
      setDefinition(measure?.definition ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: CapaMeasureInput = {
      name: name.trim(),
      target: target.trim() || null,
      definition: definition.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await addCapaMeasure(capaId, input)
          : await updateCapaMeasure(measure!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova medida" : "Editar medida"}
          </DialogTitle>
          <DialogDescription>
            Defina como o sucesso do plano será medido ao longo do tempo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nome da medida</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder="Ex.: Tempo até escalonamento"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Meta</span>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Ex.: < 10 minutos"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Definição</span>
            <Textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={2}
              className="text-sm"
              placeholder="Como a medida é calculada e coletada."
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">
              Indicador vinculado
            </span>
            <select
              disabled
              aria-describedby={indicatorHintId}
              className={FIELD_CLASS}
            >
              <option>Nenhum</option>
            </select>
            <span id={indicatorHintId} className="text-xs text-muted-foreground">
              Disponível com Indicadores (Fase 15).
            </span>
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
                  ? "Adicionar medida"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
