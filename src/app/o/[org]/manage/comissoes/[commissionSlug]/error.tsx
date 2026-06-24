"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { orgHref } from "@/lib/routing";

/**
 * Error boundary for the org-admin commission detail. Friendly pt-BR message with
 * a retry and a way back to the registry — never the raw error. The back-link is
 * org-aware (reads the `[org]` route param).
 */
export default function OrgCommissionDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ org: string }>();
  const backHref = params?.org
    ? orgHref(params.org, "manage", "comissoes")
    : "/";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-5 py-24 text-center">
      <h1 className="text-2xl">Algo deu errado</h1>
      <p className="text-muted-foreground text-pretty">
        Não foi possível carregar esta comissão. Tente novamente em alguns
        instantes.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} size="lg">
          Tentar novamente
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={backHref}>Voltar para as comissões</Link>
        </Button>
      </div>
    </div>
  );
}
