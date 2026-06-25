import { Building2, FolderKanban, Hospital } from "lucide-react";

import type { OrganizationSummary } from "@/lib/queries/org";

/**
 * Grid of organization cards for the platform-admin registry at `/admin`. Each
 * shows the org name, slug, and its hospital + commission counts. Server
 * Component — pure presentation; the data is RLS-scoped (platform_admin sees all
 * orgs, everyone else sees none). Organizations are not routed from here: the
 * vendor is walled off from tenant data, so there is no drill-in link — in-org
 * administration is the org_admin's job.
 */
export function OrganizationList({
  organizations,
}: {
  organizations: OrganizationSummary[];
}) {
  if (organizations.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center text-muted-foreground">
        Nenhuma organização ainda. Crie a primeira usando o formulário acima.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {organizations.map((org, index) => (
        <li
          key={org.id}
          style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
          className="animate-rise-in flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/60 text-accent-foreground"
            >
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">{org.name}</h3>
              <p className="truncate font-mono text-xs text-muted-foreground">
                /o/{org.slug}
              </p>
            </div>
          </div>

          <dl className="mt-auto grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Hospital
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Hospitais</dt>
              <dd>
                <span className="font-semibold tabular-nums">
                  {org.hospitalCount}
                </span>{" "}
                <span className="text-muted-foreground">
                  {org.hospitalCount === 1 ? "hospital" : "hospitais"}
                </span>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <FolderKanban
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Comissões</dt>
              <dd>
                <span className="font-semibold tabular-nums">
                  {org.commissionCount}
                </span>{" "}
                <span className="text-muted-foreground">
                  {org.commissionCount === 1 ? "comissão" : "comissões"}
                </span>
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
