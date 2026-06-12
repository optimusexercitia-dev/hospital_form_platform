import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";

import type { AdminCommissionListItem } from "@/lib/queries/commissions";

import { StatCount } from "./stat-count";

/**
 * Grid of commission cards for the admin landing — each shows the name, slug,
 * member count (with a small count-up flourish) and the current coordinators,
 * linking to that commission's management page. Server Component; the only
 * client island is the decorative `StatCount`.
 */
export function CommissionList({
  commissions,
}: {
  commissions: AdminCommissionListItem[];
}) {
  if (commissions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center text-muted-foreground">
        Nenhuma comissão ainda. Crie a primeira usando o formulário acima.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {commissions.map((commission, index) => (
        <li key={commission.id}>
          <Link
            href={`/admin/comissoes/${commission.slug}`}
            style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
            className="animate-rise-in group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">
                  {commission.name}
                </h2>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  /{commission.slug}
                </p>
              </div>
              <ArrowUpRight
                className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>

            <div className="mt-auto flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  <StatCount
                    value={commission.memberCount}
                    className="font-semibold text-foreground"
                  />{" "}
                  {commission.memberCount === 1 ? "membro" : "membros"}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Coordenação
                </p>
                {commission.staffAdmins.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground/80 italic">
                    Sem coordenadores
                  </p>
                ) : (
                  <p className="mt-1 line-clamp-2 text-sm text-foreground/90">
                    {commission.staffAdmins
                      .map(
                        (sa) =>
                          sa.fullName?.trim() || sa.email || "Sem identificação",
                      )
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
