import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";

import type { HospitalDetail } from "@/lib/queries/org";
import { orgHref } from "@/lib/routing";
import { initials } from "@/components/org/format";

/**
 * Vertical stack of full-width hospital cards for the org-admin area
 * (`/o/[org]/manage/hospitais`). Each row shows the hospital's name/slug, its
 * `hospital_admin` roster, and its commission/user counts, linking into the
 * hospital detail page (`/o/[org]/manage/hospitais/[hospitalId]`). Server
 * Component; pure presentation — the aggregate counts + admin roster come
 * pre-computed from `listHospitalsForOrgDetailed`.
 */
export function HospitalList({
  org,
  hospitals,
}: {
  /** Org slug for the per-hospital detail hrefs. */
  org: string;
  hospitals: HospitalDetail[];
}) {
  if (hospitals.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center text-muted-foreground">
        Nenhum hospital cadastrado ainda. Cadastre o primeiro com o botão
        &ldquo;Criar hospital&rdquo; acima.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {hospitals.map((hospital, index) => (
        <li key={hospital.id}>
          <Link
            href={orgHref(org, "manage", "hospitais", hospital.id)}
            style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
            className="animate-rise-in group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-6"
          >
            <div className="flex min-w-0 flex-col gap-1 sm:w-56 sm:shrink-0">
              <h3 className="truncate text-lg font-semibold">
                {hospital.name}
              </h3>
              <p className="truncate font-mono text-xs text-muted-foreground">
                /{hospital.slug}
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {hospital.admins.length === 0 ? (
                <span className="text-sm text-muted-foreground italic">
                  Sem administrador local
                </span>
              ) : (
                hospital.admins.map((a) => (
                  <span
                    key={a.userId}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/60 py-1 pr-2.5 pl-1 text-xs font-medium text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[0.65rem] font-semibold text-accent-foreground"
                    >
                      {initials(a.fullName || a.email)}
                    </span>
                    <span className="truncate">{a.fullName || a.email}</span>
                  </span>
                ))
              )}
            </div>

            <div className="flex shrink-0 items-center gap-4 sm:ml-auto">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground tabular-nums">
                <span>
                  {hospital.commissionCount}{" "}
                  {hospital.commissionCount === 1 ? "comissão" : "comissões"}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5 shrink-0" aria-hidden="true" />
                  {hospital.userCount}{" "}
                  {hospital.userCount === 1 ? "usuário" : "usuários"}
                </span>
              </div>
              <ArrowUpRight
                className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
