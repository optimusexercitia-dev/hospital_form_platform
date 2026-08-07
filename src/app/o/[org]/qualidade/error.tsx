"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Error boundary for the quality console. Renders a pt-BR message and a retry —
 * never the underlying Postgres/Supabase text (CLAUDE.md §8): a raw SQLSTATE in
 * an oversight surface would leak schema detail to a strictly-read-only reader.
 */
export default function QualityConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side digest only; the message itself stays off-screen.
    console.error("quality console error", error.digest);
  }, [error]);

  return (
    <section
      role="alert"
      className="animate-rise-in mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">
        Não foi possível carregar a supervisão
      </h2>
      <p className="text-sm text-muted-foreground text-pretty">
        Houve uma falha ao buscar os dados das comissões supervisionadas. Tente
        novamente; se persistir, fale com a administração da sua organização.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        Tentar novamente
      </button>
    </section>
  );
}
