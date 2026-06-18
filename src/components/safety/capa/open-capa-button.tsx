"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  CAPA_CLASSIFICATION_LABELS,
  type CapaClassification,
  type CapaSource,
  type OpenCapaInput,
} from "@/lib/safety/capa-types";
import type { ActionState } from "@/lib/safety/types";
import { openCapaPlan } from "@/lib/safety/capa-actions";
import { cn } from "@/lib/utils";
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

const CLASSIFICATIONS: CapaClassification[] = [
  "corretiva",
  "preventiva",
  "melhoria",
];

/**
 * Opens a CAPA plan from a source (an RCA or an event) and refreshes so the new
 * plan card appears in the source's list. The root-cause link (for an RCA-sourced
 * plan opened from a specific root cause) is established at the ACTION level inside
 * the workspace; a hint reminds the user to pre-select it on the first action.
 */
export function OpenCapaButton({
  source,
  sourceId,
  label = "Abrir plano de ação",
  variant = "default",
  size = "default",
  rootCauseHint = false,
}: {
  source: Extract<CapaSource, "rca" | "event">;
  sourceId: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  /** Show the "pre-select the root cause on the first action" hint (RCA root-cause entry). */
  rootCauseHint?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classification, setClassification] =
    useState<CapaClassification>("corretiva");
  const [state, setState] = useState<ActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setClassification("corretiva");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: OpenCapaInput = { source, sourceId, classification };
    startTransition(async () => {
      const result = await openCapaPlan(input);
      setState(result);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir plano de ação</DialogTitle>
            <DialogDescription>
              Inicie um plano de ação corretivo/preventivo (CAPA) para endereçar este{" "}
              {source === "rca" ? "achado da análise" : "evento"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {state && !state.ok && (
              <FormBanner tone="error">{state.error}</FormBanner>
            )}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">Classificação</legend>
              <div
                role="radiogroup"
                aria-label="Classificação do plano"
                className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5"
              >
                {CLASSIFICATIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={classification === c}
                    onClick={() => setClassification(c)}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                      classification === c
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {CAPA_CLASSIFICATION_LABELS[c]}
                  </button>
                ))}
              </div>
            </fieldset>
            {rootCauseHint && (
              <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                No plano, adicione uma ação e vincule-a a esta causa raiz no campo
                “Causa raiz endereçada”.
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={isPending}>
                {isPending ? "Abrindo…" : "Abrir plano"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
