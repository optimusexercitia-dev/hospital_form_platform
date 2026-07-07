import Link from "next/link";
import { ChevronRight, FolderKanban, Hospital } from "lucide-react";

import type { HospitalSummary } from "@/lib/queries/org";
import { orgHref } from "@/lib/routing";

/**
 * Grid of hospital cards for the org-admin area (`/o/[org]/manage/hospitais`).
 * Each shows the hospital name, slug, and its commission count, and links into
 * the hospital detail page (`/o/[org]/manage/hospitais/[hospitalId]`) where its
 * departments are managed. Server Component; pure presentation (the data is
 * RLS-scoped to the org_admin's org).
 */
export function HospitalList({
  org,
  hospitals,
}: {
  /** Org slug for the per-hospital detail hrefs. */
  org: string;
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
          className="animate-rise-in"
        >
          <Link
            href={orgHref(org, "manage", "hospitais", hospital.id)}
            className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/60 text-accent-foreground"
              >
                <Hospital className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold">
                  {hospital.name}
                </h3>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  /{hospital.slug}
                </p>
              </div>
              <ChevronRight
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
