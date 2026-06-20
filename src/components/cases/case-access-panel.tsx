"use client";

import { useMemo } from "react";
import { Eye, PenLine, UserPlus, X } from "lucide-react";

import type { CaseDetail } from "@/lib/queries/cases";
import type { MemberListItem } from "@/lib/queries/members";
import {
  grantCaseAccess,
  revokeCaseAccess,
} from "@/lib/case-access/actions";
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

/**
 * Coordinator-only ACCESS roster (Case Access Control increment, ADR 0033 D6/D7;
 * FE-5). The per-member read/write grant control over a case's access surface — grant
 * any commission member read or write access (`grantCaseAccess`) or remove an explicit
 * grant (`revokeCaseAccess`). Each row shows whether the member is ATTRIBUTED (a
 * phase/narrative assignee) — which auto-grants full-case read that a revoke CANNOT
 * remove (D6: unassign to remove it). Attribution is derived here from the loaded
 * phases + narratives.
 *
 * This is the BODY of the "Acesso ao caso" dialog opened from {@link CaseAccessButton}
 * in the coordinator `(detail)` layout header; it no longer renders its own card
 * chrome (the Dialog provides the frame). Narrative ASSIGNMENT moved onto each
 * narrative card ({@link import('./case-narrative-card').CaseNarrativeCard}).
 *
 * Only NON-coordinator members are listed: a `staff_admin` already holds full-case
 * access by role, so a grant/revoke control on them (including the viewing coordinator
 * on themselves) is meaningless/misleading. This inherently removes the current viewer.
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
  /**
   * Whether the case is non-terminal. Read grants are allowed on terminal cases
   * (ADR 0033 D6); only WRITE grants require an open case, so on a terminal case the
   * "Conceder edição" item is disabled (the server enforces this regardless).
   */
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

  // Coordinators (`staff_admin`) already hold full-case access by role, so a
  // grant/revoke control on them is meaningless — and revoking your OWN access is
  // misleading. List only non-coordinator members (this also drops the viewer).
  const grantableMembers = members.filter((m) => m.role !== "staff_admin");

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground text-pretty">
        Conceda leitura ou edição a qualquer membro. Quem tem uma fase ou narrativa
        atribuída já enxerga o caso inteiro (remova a atribuição para retirar esse
        acesso).
      </p>
      {grantableMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-pretty">
          Nenhum outro membro para conceder acesso.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {grantableMembers.map((m) => {
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
                      Membro
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
                  caseOpen={caseOpen}
                  onGrant={(level) =>
                    run(() => grantCaseAccess(caseId, m.userId, level))
                  }
                  onRevoke={() => run(() => revokeCaseAccess(caseId, m.userId))}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Per-member grant/revoke dropdown (read / write / remove). "Conceder edição" is
 * disabled on a terminal case (write grants require an open case, ADR 0033 D6);
 * read + remove stay available.
 */
function GrantMenu({
  disabled,
  caseOpen,
  onGrant,
  onRevoke,
}: {
  disabled: boolean;
  caseOpen: boolean;
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
        <DropdownMenuItem
          className="gap-2"
          disabled={!caseOpen}
          onSelect={() => onGrant("write")}
        >
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
