"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the commission area. Shows a friendly pt-BR message and a
 * retry — never the raw error. (`notFound()` from the layout is handled by the
 * 404 boundary, not here.)
 */
export default function CommissionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to server logs / monitoring; never rendered to the user.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-2xl">Algo deu errado</h1>
      <p className="text-muted-foreground text-pretty">
        Não foi possível carregar esta área da comissão. Tente novamente em
        alguns instantes.
      </p>
      <Button onClick={reset} size="lg">
        Tentar novamente
      </Button>
    </div>
  );
}
