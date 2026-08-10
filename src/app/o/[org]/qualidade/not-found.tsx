import Link from "next/link";
import { ShieldOff } from "lucide-react";

import { getRoleSwitchOptions } from "@/components/role/get-role-switch-options";
import { RoleSwitchHint } from "@/components/role/role-switch-hint";

/**
 * In-shell 404 for the quality console.
 *
 * ⚠ CORRECTED (ACT ADR 0106 build — verified live, not assumed): this
 * boundary does NOT catch `qualidade/layout.tsx`'s own `notFound()` (the
 * "this org doesn't exist / you review no hospital here" entry-denial case,
 * despite this file's prior docstring claiming otherwise). Empirically
 * confirmed with an isolated test route: a `notFound()` thrown from WITHIN a
 * layout component's own body is caught only by an ancestor boundary ABOVE
 * where that layout itself renders — never by that same segment's own
 * `not-found.tsx`. The entry-denial case actually lands on the GLOBAL
 * `src/app/not-found.tsx` (which now carries the same D9 hint below, gated to
 * authenticated callers only). This boundary is reached ONLY for a page
 * WITHIN an already-entered console calling `notFound()` itself (e.g. an
 * out-of-scope case id) — a real, narrower case, so the D9 hint below still
 * has a place to fire, just not the primary one the design note assumed.
 */
export default async function QualityConsoleNotFound() {
  const { options } = await getRoleSwitchOptions();

  return (
    <section className="animate-rise-in mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldOff aria-hidden="true" className="size-6" />
      </span>
      <h1 className="text-2xl text-balance">Página não encontrada</h1>
      <p className="text-muted-foreground text-pretty">
        Este endereço não existe ou você não tem acesso ao Escritório da
        Qualidade desta organização.
      </p>
      <Link
        href="/"
        className="rounded-lg px-4 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        Voltar ao início
      </Link>
      <RoleSwitchHint options={options} />
    </section>
  );
}
