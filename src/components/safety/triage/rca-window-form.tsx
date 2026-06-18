"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

import { setRcaDueWindow } from "@/lib/safety/triage-actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";

const FIELD_CLASS =
  "h-10 w-32 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The RCA due-window setting (`pqs_department.rca_default_due_days`): the number of
 * days `confirm_triage` adds to the event date to mint an RCA's due date. Bound to
 * the `is_pqs_member`-gated `setRcaDueWindow(days)` action (validated 1–365 server-
 * side). Pre-seeded with the current value from `getPqsDepartment`.
 */
export function RcaWindowForm({ defaultDueDays }: { defaultDueDays: number }) {
  const router = useRouter();
  const inputId = useId();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(String(defaultDueDays));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 365;
  const dirty = parsed !== defaultDueDays;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setRcaDueWindow(parsed);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar o prazo.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <FormBanner tone="error">{error}</FormBanner>}
      {saved && !dirty && (
        <FormBanner tone="success">Prazo da RCA atualizado.</FormBanner>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={inputId} className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Prazo padrão da RCA (dias)</span>
          <div className="flex items-center gap-2">
            <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSaved(false);
              }}
              className={FIELD_CLASS}
              aria-invalid={!valid && value !== "" ? true : undefined}
              aria-describedby={`${inputId}-help`}
            />
          </div>
        </label>
        <Button type="submit" disabled={isPending || !valid || !dirty}>
          {isPending ? "Salvando…" : "Salvar prazo"}
        </Button>
      </div>

      <p id={`${inputId}-help`} className="text-xs text-muted-foreground text-pretty">
        Dias somados à data do evento para definir o prazo de conclusão da RCA
        obrigatória (entre 1 e 365). O padrão recomendado é 45 dias.
      </p>
    </form>
  );
}
