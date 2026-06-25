import { FolderKanban, Hospital } from "lucide-react";

import type { HospitalSummary } from "@/lib/queries/org";

/**
 * Grid of hospital cards for the org-admin area (`/o/[org]/manage/hospitais`).
 * Each shows the hospital name, slug, and its commission count. Server Component;
 * pure presentation (the data is RLS-scoped to the org_admin's org). Hospitals
 * are a grouping attribute, not routed, so the cards have no drill-in link.
 */
export function HospitalList({
  hospitals,
}: {
  hospitals: HospitalSummary[];
}) {
  if (hospitals.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center text-muted-foreground">
        Nenhum hospital cadastrado ainda. Cadastre o primeiro usando o
        formulário acima.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {hospitals.map((hospital, index) => (
        <li
          key={hospital.id}
          style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
          className="animate-rise-in flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/60 text-accent-foreground"
            >
              <Hospital className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">
                {hospital.name}
              </h3>
              <p className="truncate font-mono text-xs text-muted-foreground">
                /{hospital.slug}
              </p>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2 text-sm">
            <FolderKanban
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              <span className="font-semibold tabular-nums">
                {hospital.commissionCount}
              </span>{" "}
              <span className="text-muted-foreground">
                {hospital.commissionCount === 1 ? "comissão" : "comissões"}
              </span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
