import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Not-found boundary for the per-org NSP console. Renders INSIDE the NSP shell
 * (the top nav stays) when a page under `/o/[org]/nsp/**` calls `notFound()` —
 * e.g. a non-enrolled coordinator opening a PHI detail page whose data door
 * returned `null`, or an out-of-scope/cross-org entity id. Without this boundary
 * such a `notFound()` escaped to the global `app/not-found.tsx` (a full-page 404
 * outside the console shell).
 *
 * An UNKNOWN org OR a caller who is neither a PQS member nor the coordinator of
 * the org is a different case: the NSP `layout.tsx` itself calls `notFound()`,
 * handled one level up by the global `app/not-found.tsx` (no shell, leaks nothing
 * about which organizations exist).
 *
 * Cannot read the route's `org` (not-found boundaries receive no params), so the
 * recovery link points at `/` rather than the console root.
 */
export default function NspNotFound() {
  return (
    <div className="animate-rise-in mx-auto flex max-w-xl flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
        Erro 404
      </p>
      <h1 className="text-3xl text-balance">Não encontramos esta página.</h1>
      <p className="max-w-md text-muted-foreground text-pretty">
        O endereço pode estar incorreto ou este registro pode estar fora do seu
        escopo de acesso no Núcleo de Segurança do Paciente.
      </p>
      <Button asChild size="lg">
        <Link href="/">Voltar para o início</Link>
      </Button>
    </div>
  );
}
