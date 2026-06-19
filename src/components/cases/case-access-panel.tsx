"use client";

import { useMemo } from "react";
import { Eye, KeyRound, PenLine, UserPlus, Users, X } from "lucide-react";

import type { CaseDetail } from "@/lib/queries/cases";
import type { MemberListItem } from "@/lib/queries/members";
import {
  grantCaseAccess,
  revokeCaseAccess,
} from "@/lib/case-access/actions";
import {
  assignNarrative,
  unassignNarrative,
} from "@/lib/case-narratives/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCaseAction } from "@/components/cases/use-case-action";
import { initials } from "@/components/cases/format";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Coordinator-only ACCESS panel on the case detail (Case Access Control increment,
 * ADR 0033 D6/D7; FE-5). Two controls over the case's access surface:
 *
 *  1. **Member roster + grants** — grant any commission member read or write access
 *     (`grantCaseAccess`) or remove an explicit grant (`revokeCaseAccess`). Each row
 *     shows whether the member is ATTRIBUTED (a phase/narrative assignee) — which
 *     auto-grants full-case read that a revoke CANNOT remove (D6: unassign to remove
 *     it). Attribution is derived here from the loaded phases + narratives.
 *
 *  2. **Narrative assignment** — assign each narrative to a member
 *     (`assignNarrative`) or clear it (`unassignNarrative`); the assignee then fills
 *     + concludes it and gains full-case read.
 *
 * NOTE (contract): no read currently returns the stored `case_access` grant ROWS, so
 * the roster shows DERIVED attribution + grant ACTIONS rather than a live "currently
 * granted: read/write" state. When backend adds a grants read, the row can show the
 * live level. Authorization is the DB's (coordinator/admin; `HC021` member check);
 * each action surfaces a pt-BR error inline. Rendered only when the viewer holds
 * `canManageLifecycle` and the `case_access` flag is on (the parent gates this).
 */
export function CaseAccessPanel({
  caseId,
  members,
  detail,
  caseOpen,
}: {
  caseId: string;
  /** The commission roster (already sorted by the parent). */
  members: MemberListItem[];
  detail: CaseDetail;
  /** Whether the case is non-terminal (narrative assignment requires an open case). */
  caseOpen: boolean;
}) {
  const { run, isPending, error } = useCaseAction();

  // Members attributed on at least one phase or narrative (derived) → auto full read.
  const attributedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of detail.phases) if (p.assignedTo) ids.add(p.assignedTo);
    for (const n of detail.narratives) if (n.assignedTo) ids.add(n.assignedTo);
    return ids;
  }, [detail.phases, detail.narratives]);

  const narratives = detail.narratives;

  return (
    <section
      aria-labelledby="case-access-heading"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <KeyRound aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="case-access-heading" className="text-base font-semibold">
          Acesso ao caso
        </h2>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {/* 1. Member roster + grants */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Membros</h3>
        </div>
        <p className="text-xs text-muted-foreground text-pretty">
          Conceda leitura ou edição a qualquer membro. Quem tem uma fase ou narrativa
          atribuída já enxerga o caso inteiro (remova a atribuição para retirar esse
          acesso).
        </p>
        <ul className="flex flex-col divide-y divide-border/70">
          {members.map((m) => {
            const name = m.fullName ?? m.email ?? "Membro";
            const attributed = attributedIds.has(m.userId);
            return (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                  >
                    {initials(name)}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {name}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {m.role === "staff_admin" ? "Coordenação" : "Membro"}
                      {attributed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
                          Atribuído
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <GrantMenu
                  disabled={isPending}
                  onGrant={(level) =>
                    run(() => grantCaseAccess(caseId, m.userId, level))
                  }
                  onRevoke={() => run(() => revokeCaseAccess(caseId, m.userId))}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* 2. Narrative assignment */}
      {narratives.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border/70 pt-5">
          <div className="flex items-center gap-2">
            <PenLine
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            <h3 className="text-sm font-medium text-foreground">
              Responsáveis pelas narrativas
            </h3>
          </div>
          <ul className="flex flex-col gap-2.5">
            {narratives.map((n) => {
              const heading = n.title || n.typeLabel;
              const selectId = `narrative-assignee-${n.id}`;
              return (
                <li
                  key={n.id}
                  className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/20 p-3"
                >
                  <label
                    htmlFor={selectId}
                    className="text-sm font-medium text-foreground"
                  >
                    {heading}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id={selectId}
                      className={SELECT_CLASS}
                      value={n.assignedTo ?? ""}
                      disabled={isPending || !caseOpen || n.status !== "aberta"}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!next) {
                          run(() => unassignNarrative(n.id));
                        } else {
                          run(() => assignNarrative(n.id, next));
                        }
                      }}
                    >
                      <option value="">Sem responsável</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.fullName ?? m.email ?? "Membro"}
                        </option>
                      ))}
                    </select>
                    {n.assignedTo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending || !caseOpen}
                        onClick={() => run(() => unassignNarrative(n.id))}
                        aria-label={`Remover responsável de ${heading}`}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  {n.status !== "aberta" && (
                    <p className="text-xs text-muted-foreground">
                      Narrativa concluída — reabra para reatribuir.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Per-member grant/revoke dropdown (read / write / remove). */
function GrantMenu({
  disabled,
  onGrant,
  onRevoke,
}: {
  disabled: boolean;
  onGrant: (level: "read" | "write") => void;
  onRevoke: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("shrink-0")}
        >
          <UserPlus aria-hidden="true" />
          Acesso
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Conceder acesso</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => onGrant("read")}>
          <Eye aria-hidden="true" className="size-4" />
          Conceder leitura
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => onGrant("write")}>
          <PenLine aria-hidden="true" className="size-4" />
          Conceder edição
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={onRevoke}
        >
          <X aria-hidden="true" className="size-4" />
          Remover acesso
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
