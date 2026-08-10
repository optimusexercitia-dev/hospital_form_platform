import Link from "next/link";

import { getRoleSwitchOptions } from "@/components/role/get-role-switch-options";
import { RoleSwitchHint } from "@/components/role/role-switch-hint";
import { Button } from "@/components/ui/button";

/**
 * Global pt-BR 404. Reached by any `notFound()` call (e.g. the commission
 * layout for an unknown OR inaccessible slug — the two are indistinguishable by
 * design, so this copy is deliberately neutral and reveals nothing about what
 * exists). Replaces Next's default English not-found page (Architecture Rule 10).
 *
 * ACT (ADR 0106 D9) — this is ALSO where the choke-point guards' own
 * entry-denial `notFound()` calls actually land. Verified live during Stage 3
 * build (isolated test route + a real production standalone run): a
 * `notFound()` thrown from WITHIN a layout component's own body is caught
 * only by an ancestor boundary above where that layout renders — never by
 * that same segment's (or any bare intermediate segment's) own
 * `not-found.tsx`. None of the six guard areas (`manage`, `qualidade`,
 * `nsp`, `nsp-org`, `direcao-tecnica`, the commission area) sit under a
 * `layout.tsx` between themselves and the app root, so their own gate's
 * denial always resolves HERE — the six areas' own `not-found.tsx` siblings
 * only catch a narrower case (a PAGE within an already-entered area calling
 * `notFound()` itself). This corrects `docs/design/act-role-picker.md` §5.4's
 * assumption that those six sibling files would carry the D9 hint alone.
 *
 * The hint is fetched only when a session exists (`getRoleSwitchOptions()`
 * returns an empty options list for an anonymous caller at no extra query
 * cost — `getRawGrants()` already documents this boundary), so the ordinary
 * "mistyped a public URL, not signed in" 404 pays no extra cost and renders
 * unchanged. `RoleSwitchHint` itself renders nothing when there is nothing to
 * say, so this page's neutral base copy (D4 — reveals nothing about what
 * exists) is never softened, only ever appended to.
 */
export default async function NotFound() {
  const { options } = await getRoleSwitchOptions();

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
      <RoleSwitchHint options={options} />
    </main>
  );
}
