"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for "Meus Casos". Friendly pt-BR message and a retry — never the
 * raw error.
 */
export default function MyCasesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-5 py-24 text-center">
      <h1 className="text-2xl">Algo deu errado</h1>
      <p className="text-muted-foreground text-pretty">
        Não foi possível carregar os seus casos. Tente novamente em alguns
        instantes.
      </p>
      <Button onClick={reset} size="lg">
        Tentar novamente
      </Button>
    </div>
  );
}
