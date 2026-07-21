import { Check, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** One readiness item — a requirement the wizard tracks toward submit. */
export interface ChecklistItem {
  label: string;
  done: boolean;
}

/**
 * The create-wizard's right rail: a "Pronto para enviar" progress card whose
 * checklist bullets fill as each requirement is satisfied, plus a "Como funciona
 * a aprovação" explainer. Pure presentational (no client state) — the wizard
 * computes `items` from its own field state and passes them down. Token-driven;
 * the bar turns `success` at 100%. Reduced-motion collapses the width transition
 * globally (globals.css).
 */
export function ChecklistRail({ items }: { items: ChecklistItem[] }) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = done === total && total > 0;

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Pronto para enviar</h3>
          <span
            className={cn(
              "font-mono text-sm tabular-nums",
              complete ? "text-success" : "text-muted-foreground",
            )}
          >
            {percent}%
          </span>
        </div>
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do formulário"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-[--dur-base] ease-[--ease-out-soft]",
              complete ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  item.done
                    ? "border-success bg-success text-success-foreground"
                    : "border-border bg-card",
                )}
              >
                {item.done ? <Check className="size-3" /> : null}
              </span>
              <span
                className={cn(
                  item.done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
          Como funciona a aprovação
        </h3>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-xs text-muted-foreground text-pretty">
          <li>Ao enviar, o documento entra em Em aprovação.</li>
          <li>Cada aprovador assina de forma independente.</li>
          <li>Todos os aprovadores precisam aprovar para o documento ficar vigente.</li>
          <li>A versão vigente atual permanece em vigor até a publicação.</li>
        </ul>
      </div>
    </aside>
  );
}
