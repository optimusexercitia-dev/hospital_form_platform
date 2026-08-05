"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the technical-direction area (inbox + referral detail). Friendly
 * pt-BR message and a retry — never the raw error (`notFound()` is handled by the 404
 * boundary, not here).
 *
 * ⚠ This boundary is the ONLY thing that stood between the Diretor Técnico and a blank
 * page on 2026-08-05: the inbox shipped with a green `next build` and crashed on first
 * load (a function prop across the RSC boundary). Without a boundary here the office —
 * whose users have no other route to fall back to, since the role confers no commission
 * membership — would have seen an unstyled runtime error as their entire application.
 */
export default function TechnicalDirectionError({
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
        Não foi possível carregar os encaminhamentos à direção técnica. Tente
        novamente em alguns instantes.
      </p>
      <Button onClick={reset} size="lg">
        Tentar novamente
      </Button>
    </div>
  );
}
