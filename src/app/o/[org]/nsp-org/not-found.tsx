import Link from "next/link";
import { ShieldOff } from "lucide-react";

import { getRoleSwitchOptions } from "@/components/role/get-role-switch-options";
import { RoleSwitchHint } from "@/components/role/role-switch-hint";

/**
 * In-shell 404 for the org-level NSP-admin console (new sibling — ACT ADR
 * 0106).
 *
 * ⚠ Does NOT catch `nsp-org/layout.tsx`'s own `notFound()` (the "this org
 * doesn't exist / you are not `nsp_org_admin` here" entry-denial case) —
 * verified live: a layout's own `notFound()` is caught only by an ancestor
 * boundary above where that layout renders, never by its own segment's
 * `not-found.tsx`. That entry-denial case lands on the GLOBAL
 * `src/app/not-found.tsx` (which carries the same D9 hint, gated to
 * authenticated callers). This boundary is reached only for a PAGE within an
 * already-entered console calling `notFound()` itself.
 */
export default async function OrgNspAdminNotFound() {
  const { options } = await getRoleSwitchOptions();

  return (
    <section className="animate-rise-in mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldOff aria-hidden="true" className="size-6" />
      </span>
      <h1 className="text-2xl text-balance">Página não encontrada</h1>
      <p className="text-muted-foreground text-pretty">
        Este endereço não existe ou você não tem acesso à administração do
        Núcleo de Segurança do Paciente desta organização.
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
