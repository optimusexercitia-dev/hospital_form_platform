import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { qualidadeHref } from "@/lib/routing";
import { UserMenu } from "@/components/shell/user-menu";

/**
 * The commission-area shell a QUALITY REVIEWER gets (ADR 0100 D10) — mounted by
 * `/o/[org]/c/[commission]/layout.tsx` INSTEAD of the member shell when the
 * caller reaches the commission only as an oversight viewer.
 *
 * ⚠ WHY A SEPARATE SHELL RATHER THAN A HIDDEN SIDEBAR. `AppSidebar`'s visibility
 * predicate ends `return role === null || item.roles.includes(role)` — `null` is
 * the "platform admin sees the whole menu" branch. A reviewer resolves to
 * `role: null` (they are a FLAG, never a member role — D10), so mounting the
 * member sidebar for them would render EVERY coordinator item: Construtor,
 * Casos, Assinaturas, Painel, Gerenciar, Configurações — a dozen links that all
 * 404. Hiding them one flag at a time would leave the reviewer one forgotten
 * predicate away from an affordance leak, forever. A different shell asserts
 * nothing about the member menu because the member menu never renders.
 *
 * It also skips the member layout's read fan-out entirely (sign-off queue, open
 * case count, pending signatures, member overview, eleven feature flags) — all
 * of which are meaningless for a non-member and several of which would be empty
 * or denied.
 *
 * The reviewer's way OUT is the only navigation offered: back to the console.
 */
export function QualityViewerShell({
  org,
  commissionName,
  fullName,
  email,
  children,
}: {
  org: string;
  commissionName: string;
  fullName: string | null;
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={qualidadeHref(org)}
            className="flex items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Escritório da Qualidade
          </Link>
          <span aria-hidden="true" className="text-muted-foreground/50">
            /
          </span>
          <span className="max-w-[16rem] truncate text-sm font-semibold tracking-tight">
            {commissionName}
          </span>
          <span
            aria-hidden="true"
            className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase"
          >
            Somente leitura
          </span>
          <div className="ml-auto">
            <UserMenu fullName={fullName} email={email} />
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
