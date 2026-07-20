"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Error boundary for the charter page — friendly pt-BR message, never raw. */
export default function CharterError({
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
        Não foi possível carregar o regimento e a cadência desta comissão. Tente
        novamente em alguns instantes.
      </p>
      <Button onClick={reset} size="lg">
        Tentar novamente
      </Button>
    </div>
  );
}
