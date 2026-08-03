import Link from "next/link";

import type { AccreditationFramework } from "@/lib/accreditation/types";
import { FrameworkStatusChip } from "@/components/accreditation/status-chips";
import { CloneFrameworkDialogTrigger } from "@/components/accreditation/clone-framework-dialog";

/**
 * The commission's visible frameworks — global packs (SELECT-able by every
 * authenticated user) plus any of its OWN custom/cloned frameworks (Amendment
 * 1 A1·2 — a clone carries licensed text, RLS-scoped to the owning
 * commission's members). A global pack offers "Clonar para editar"
 * (staff_admin only); a clone is already fully editable elsewhere (standard
 * CRUD is out of this turn's wired UI, ADR 0093 Wave 2 plan) so it just says so.
 */
export function FrameworkList({
  frameworks,
  commissionId,
  canManage,
  frameworkHref,
}: {
  frameworks: AccreditationFramework[];
  commissionId: string;
  /** Whether the viewer may clone a global pack (staff_admin of this commission). */
  canManage: boolean;
  frameworkHref: (frameworkId: string) => string;
}) {
  if (frameworks.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
        Nenhum framework de acreditação disponível ainda.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {frameworks.map((framework, index) => (
        <li
          key={framework.id}
          style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
          className="animate-rise-in"
        >
          <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[transform,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {framework.key} · v{framework.version}
                </span>
                <h3 className="text-lg font-semibold text-balance">{framework.name}</h3>
              </div>
              <FrameworkStatusChip status={framework.status} className="shrink-0" />
            </div>

            {framework.description && (
              <p className="text-sm text-muted-foreground text-pretty">{framework.description}</p>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={frameworkHref(framework.id)}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                Ver padrões
              </Link>
              {framework.ownerCommissionId === null ? (
                canManage && (
                  <CloneFrameworkDialogTrigger
                    frameworkId={framework.id}
                    frameworkName={framework.name}
                    commissionId={commissionId}
                    frameworkHref={frameworkHref}
                  />
                )
              ) : (
                <span className="text-xs text-muted-foreground">Clonado — editável pela sua comissão</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
