import Link from "next/link";
import { ShieldOff } from "lucide-react";

import { getRoleSwitchOptions } from "@/components/role/get-role-switch-options";
import { RoleSwitchHint } from "@/components/role/role-switch-hint";

/**
 * Not-found boundary for the commission area (new sibling — ACT ADR 0106,
 * design note §5.4). Reached for an unknown commission slug OR a commission
 * the caller may not access (member/oversight-viewer/tenancy-admin, per
 * `layout.tsx`'s own gate) — indistinguishable by design (RLS), so the base
 * copy must not distinguish them either (D4). The D9 hint below is an
 * ADDITIONAL, self-sourced fact appended after that base copy, never a
 * softening of it.
 *
 * Cannot read the route's `org`/`commission` (not-found boundaries receive no
 * params), so the recovery link points at `/` rather than the commission root.
 */
export default async function CommissionNotFound() {
  const { options } = await getRoleSwitchOptions();

  return (
    <section className="animate-rise-in mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldOff aria-hidden="true" className="size-6" />
      </span>
      <h1 className="text-2xl text-balance">Página não encontrada</h1>
      <p className="text-muted-foreground text-pretty">
        Este endereço não existe ou você não tem acesso a esta comissão.
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
