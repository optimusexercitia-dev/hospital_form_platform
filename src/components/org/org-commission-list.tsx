import Link from "next/link";
import { ArrowUpRight, Hospital } from "lucide-react";

import type { OrgCommissionSummary } from "@/lib/queries/org";
import { orgHref } from "@/lib/routing";

/**
 * Grid of commission cards for the org-admin area
 * (`/o/[org]/manage/comissoes`). Each shows the commission name, slug, and its
 * hospital, linking to that commission's management detail. Server Component.
 */
export function OrgCommissionList({
  org,
  commissions,
}: {
  /** The org slug, for building the detail hrefs. */
  org: string;
  commissions: OrgCommissionSummary[];
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
            href={orgHref(org, "manage", "comissoes", commission.slug)}
            style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
            className="animate-rise-in group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">
                  {commission.name}
                </h3>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  /{commission.slug}
                </p>
              </div>
              <ArrowUpRight
                className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>

            <div className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Hospital className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {commission.hospitalName ?? "Sem hospital"}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
