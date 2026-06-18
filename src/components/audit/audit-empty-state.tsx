import { ScrollText } from "lucide-react";

/**
 * Empty state for the audit timeline — shown when no audit row matches the active
 * filters (or there is no audit history yet). Mirrors the dashboard/submissions
 * empty states (dashed card, muted icon, friendly pt-BR copy).
 *
 * `filtered` switches the copy: a fresh trail vs. an over-filtered view.
 */
export function AuditEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent/60 text-accent-foreground">
        <ScrollText aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">
        {filtered
          ? "Nenhum registro corresponde aos filtros"
          : "Nenhum registro de auditoria ainda."}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        {filtered
          ? "Ajuste ou limpe os filtros para ver mais registros."
          : "As ações realizadas na plataforma aparecerão aqui assim que ocorrerem."}
      </p>
    </div>
  );
}
