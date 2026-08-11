"use client";

import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { plural } from "@/lib/text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AssigneeAvatar } from "@/components/cases/assignee-avatar";
import { memberName, type BulkMember } from "@/components/cases/bulk-create-types";

/**
 * Step 2 — choose which commission members the cases are dealt across. Defaults to
 * ALL members (the wizard seeds the selection); at least one is required.
 */
export function BulkStepMembers({
  headingRef,
  members,
  selectedIds,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  members: BulkMember[];
  selectedIds: Set<string>;
  onToggle: (userId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  const selectedCount = members.filter((m) => selectedIds.has(m.userId)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          Responsáveis
        </h2>
        <p className="text-sm text-muted-foreground">
          Os casos serão distribuídos de forma equilibrada entre os responsáveis
          selecionados.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-accent/30 p-3.5 text-sm text-foreground">
        <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-pretty">
          Cada caso pertence inteiramente a um responsável. As cargas ficam
          equilibradas (diferença máxima de 1 caso entre pessoas).
        </p>
      </div>

      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Esta comissão ainda não tem membros para receber casos.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">
                {selectedCount}
              </span>{" "}
              de {members.length}{" "}
              {plural(members.length, "selecionado", "selecionados")}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                disabled={selectedCount === members.length}
              >
                Selecionar todos
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSelectNone}
                disabled={selectedCount === 0}
              >
                Limpar
              </Button>
            </div>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {members.map((member) => {
              const checked = selectedIds.has(member.userId);
              const name = memberName(member);
              return (
                <li key={member.userId}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                      checked
                        ? "border-primary/40 bg-accent/30"
                        : "border-border bg-card hover:border-primary/30",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(member.userId)}
                    />
                    <AssigneeAvatar name={name} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{name}</span>
                      {member.email ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {selectedCount === 0 ? (
            <p role="status" className="text-sm font-medium text-destructive">
              Selecione ao menos um responsável.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
