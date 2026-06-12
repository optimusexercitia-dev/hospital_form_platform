import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Global pt-BR 404. Reached by any `notFound()` call (e.g. the commission
 * layout for an unknown OR inaccessible slug — the two are indistinguishable by
 * design, so this copy is deliberately neutral and reveals nothing about what
 * exists). Replaces Next's default English not-found page (Architecture Rule 10).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
        Erro 404
      </p>
      <h1 className="max-w-xl text-4xl text-balance">
        Não encontramos esta página.
      </h1>
      <p className="max-w-md text-muted-foreground text-pretty">
        O endereço pode estar incorreto ou você pode não ter acesso a este
        conteúdo.
      </p>
      <Button asChild size="lg">
        <Link href="/">Voltar para o início</Link>
      </Button>
    </main>
  );
}
