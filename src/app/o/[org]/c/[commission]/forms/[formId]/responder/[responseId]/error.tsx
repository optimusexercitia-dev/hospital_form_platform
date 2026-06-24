"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the wizard route. Friendly pt-BR message with a retry and
 * a way back to the form list — never the raw error.
 */
export default function ResponderError({
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
      <h1 className="text-2xl">Não foi possível abrir o formulário</h1>
      <p className="text-muted-foreground text-pretty">
        Ocorreu um problema ao carregar o preenchimento. Suas respostas já
        salvas estão preservadas. Tente novamente em alguns instantes.
      </p>
      <Button onClick={reset} size="lg">
        Tentar novamente
      </Button>
    </div>
  );
}
