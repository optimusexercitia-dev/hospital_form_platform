"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import type { CapaMeasureResultInput } from "@/lib/safety/capa-types";
import type { ActionState } from "@/lib/safety/types";
import { recordCapaMeasureResult } from "@/lib/safety/capa-actions";
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

/** Record a measure result for a period (`recordCapaMeasureResult`). */
export function CapaMeasureResultForm({
  measureId,
  measureName,
}: {
  measureId: string;
  measureName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<ActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPeriod("");
      setValue("");
      setNote("");
      setState(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = value.trim() === "" ? null : Number(value);
    const input: CapaMeasureResultInput = {
      period: period.trim(),
      value: parsed != null && Number.isNaN(parsed) ? null : parsed,
      note: note.trim() || null,
    };
    startTransition(async () => {
      const result = await recordCapaMeasureResult(measureId, input);
      setState(result);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" />
        Resultado
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar resultado</DialogTitle>
            <DialogDescription>
              Medida: {measureName}. Informe o período e o valor medido.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {state && !state.ok && (
              <FormBanner tone="error">{state.error}</FormBanner>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Período</span>
                <input
                  type="text"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  required
                  className={FIELD_CLASS}
                  placeholder="Ex.: 2026-06 ou Jun/2026"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Valor</span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="Ex.: 8.5"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Observação (opcional)</span>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </label>
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
                {isPending ? "Salvando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
