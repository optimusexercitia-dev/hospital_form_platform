"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, X } from "lucide-react";

import type { AuditFilterActor } from "@/lib/queries/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { AuditIntegrityCheck } from "./audit-integrity-check";

/** A commission option for the admin cross-commission view's commission filter. */
export interface AuditCommissionOption {
  id: string;
  name: string;
}

/** A `[slug, pt-BR label]` option for the action / entity dropdowns. Passed from
 * the Server Component (derived from the frozen label maps) as plain data — a
 * client component must not value-import `@/lib/queries/audit` (server-only). */
export type AuditLabelOption = readonly [slug: string, label: string];

/**
 * F3 — audit-trail filter bar: actor, action type, entity type, date range; URL-
 * driven (`?actor=&action=&entity=&from=&to=`) so the Server Component re-queries
 * (the pagination resets to page 1 on any filter change). Every control has an
 * associated `<label>` and the project focus ring, so the whole bar is keyboard-
 * operable.
 *
 * The action/entity dropdowns are driven by `actionOptions`/`entityOptions` —
 * the FROZEN label-map ENTRIES, passed from the server (`Object.entries(
 * AUDIT_ACTION_LABELS)` etc.), never a hard-coded list — so a slug the backend
 * adds additively (e.g. `audit.exported`) appears automatically once its label
 * ships. (They are passed as props, not value-imported, because this is a client
 * component and `@/lib/queries/audit` is server-only.)
 *
 * Also hosts the CSV export link (a real `<a download>` to the backend-owned
 * export route carrying the active filters — exactly like the dashboard export)
 * and the "Verificar integridade" control.
 *
 * `commissions` (admin view only) adds a commission filter (`?commission=`);
 * `exportBasePath` is the route path the CSV link points at (`…/audit/export`).
 */
export function AuditFilters({
  actors,
  actionOptions,
  entityOptions,
  actor,
  action,
  entity,
  from,
  to,
  exportBasePath,
  commissionId,
  commissions,
  commission,
}: {
  actors: AuditFilterActor[];
  /** `[slug, label]` entries for the action dropdown (from the server). */
  actionOptions: AuditLabelOption[];
  /** `[slug, label]` entries for the entity-type dropdown (from the server). */
  entityOptions: AuditLabelOption[];
  actor: string | null;
  action: string | null;
  entity: string | null;
  from: string | null;
  to: string | null;
  /** The CSV export route path (e.g. `/c/[slug]/manage/audit/export`). null hides it. */
  exportBasePath: string | null;
  /** The commission to verify (own commission); undefined = whole trail (admin). */
  commissionId?: string;
  /** Admin cross-commission view: the commission-filter options. */
  commissions?: AuditCommissionOption[];
  /** The selected commission (admin view). */
  commission?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const actorId = useId();
  const actionId = useId();
  const entityId = useId();
  const fromId = useId();
  const toId = useId();
  const commissionFieldId = useId();

  // Any filter change resets pagination to page 1 (the old page may not exist
  // under the new, smaller result set).
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const hasAnyFilter = Boolean(
    actor || action || entity || from || to || commission,
  );

  // The export URL mirrors the active filters so the CSV matches what's on screen.
  const exportHref = (() => {
    if (!exportBasePath) return null;
    const p = new URLSearchParams();
    if (actor) p.set("actor", actor);
    if (action) p.set("action", action);
    if (entity) p.set("entity", entity);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (commission) p.set("commission", commission);
    const qs = p.toString();
    return qs ? `${exportBasePath}?${qs}` : exportBasePath;
  })();

  const selectClasses = cn(
    "h-11 w-full min-w-44 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color]",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={actorId}>Autor</Label>
          <select
            id={actorId}
            value={actor ?? ""}
            onChange={(e) => setParam("actor", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todos os autores</option>
            {actors.map((a) => (
              <option
                key={a.actorId ?? "system"}
                value={a.actorId ?? "system"}
              >
                {a.actorId === null ? "Sistema" : (a.name ?? "Usuário removido")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={actionId}>Ação</Label>
          <select
            id={actionId}
            value={action ?? ""}
            onChange={(e) => setParam("action", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todas as ações</option>
            {actionOptions.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={entityId}>Tipo de entidade</Label>
          <select
            id={entityId}
            value={entity ?? ""}
            onChange={(e) => setParam("entity", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todos os tipos</option>
            {entityOptions.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {commissions ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={commissionFieldId}>Comissão</Label>
            <select
              id={commissionFieldId}
              value={commission ?? ""}
              onChange={(e) => setParam("commission", e.target.value)}
              className={selectClasses}
            >
              <option value="">Todas as comissões</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fromId}>De</Label>
          <Input
            id={fromId}
            type="date"
            value={from ?? ""}
            max={to ?? undefined}
            onChange={(e) => setParam("from", e.target.value)}
            className="w-auto"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={toId}>Até</Label>
          <Input
            id={toId}
            type="date"
            value={to ?? ""}
            min={from ?? undefined}
            onChange={(e) => setParam("to", e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <AuditIntegrityCheck commissionId={commissionId} />

        <div className="flex flex-wrap items-center gap-2">
          {hasAnyFilter && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <X aria-hidden="true" />
              Limpar filtros
            </Button>
          )}
          {exportHref ? (
            <Button asChild variant="outline" size="sm">
              <a href={exportHref} download>
                <Download aria-hidden="true" />
                Exportar CSV
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
