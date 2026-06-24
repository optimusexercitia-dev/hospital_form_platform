import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Not-found boundary for the commission area. Renders INSIDE the commission
 * shell (the top nav stays) when a page under `c/[slug]/**` calls `notFound()`
 * for a member who lacks access to that specific area — e.g. a staff member
 * reaching the coordinator-only form builder. Without this boundary such a
 * `notFound()` rendered a blank content area.
 *
 * An UNKNOWN or inaccessible slug is a different case: the commission
 * `layout.tsx` itself calls `notFound()`, which is handled one level up by the
 * global `app/not-found.tsx` (no shell, leaks nothing about what exists).
 */
export default function CommissionNotFound() {
  return (
    <div className="animate-rise-in mx-auto flex max-w-xl flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
        Erro 404
      </p>
      <h1 className="text-3xl text-balance">Não encontramos esta página.</h1>
      <p className="max-w-md text-muted-foreground text-pretty">
        O endereço pode estar incorreto ou você pode não ter acesso a esta área
        da comissão.
      </p>
      <Button asChild size="lg">
        <Link href="/">Voltar para o início</Link>
      </Button>
    </div>
  );
}
