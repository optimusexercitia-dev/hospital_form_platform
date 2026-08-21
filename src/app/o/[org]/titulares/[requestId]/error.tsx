"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for ONE subject request (`/o/[org]/titulares/[requestId]`).
 * Friendly pt-BR + retry — never the raw Supabase/Postgres error (CLAUDE.md §8).
 *
 * ⚠ WHY A SEPARATE BOUNDARY AND NOT THE PARENT'S. Without this file a failure here
 * bubbled to `../error.tsx`, whose copy reads "Não foi possível carregar as
 * solicitações de titulares" — a claim about the LIST. On a detail page that is
 * simply wrong: it tells an operator working a legal deadline that the whole queue is
 * unavailable when one record failed to load, which is the difference between
 * "retry this" and "the module is down". Nearest-boundary scoping is what keeps the
 * message true about what actually failed.
 *
 * ⛔ Deliberately says nothing about the request itself — not its reference, not its
 * subject, not its status. An error boundary renders on a render that FAILED, so no
 * loaded value can be trusted here; and this route's data is a DSR record whose
 * `file_ref` is authored free text. Copy that stayed generic cannot leak it.
 */
export default function DsrRequestError({
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
        Não foi possível carregar esta solicitação de titular. Tente novamente em
        alguns instantes — a solicitação e as tarefas já registradas não foram
        alteradas.
      </p>
      <Button onClick={reset} size="lg">
        Tentar novamente
      </Button>
    </div>
  );
}
