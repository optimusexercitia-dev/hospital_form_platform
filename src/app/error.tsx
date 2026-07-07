"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Catches anything not already caught by a nested
 * `error.tsx` (the auth route group, the `o/[org]` org root, and any other
 * uncovered route) so no page falls through to Next's unstyled English error
 * screen (Architecture Rule 10 — pt-BR, no raw error text). Mirrors the
 * nested boundaries (e.g. `src/app/admin/error.tsx`) — same copy, same
 * pattern — for a consistent experience app-wide.
 */
export default function RootError({
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
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-2xl">Algo deu errado</h1>
      <p className="text-muted-foreground text-pretty">
        Não foi possível carregar esta página. Tente novamente em alguns
        instantes.
      </p>
      <Button onClick={reset} size="lg">
        Tentar novamente
      </Button>
    </main>
  );
}
