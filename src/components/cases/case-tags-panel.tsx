"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, Settings2, Tag, X } from "lucide-react";

import type { CaseTag } from "@/lib/queries/case-tags";
import { assignCaseTag, unassignCaseTag } from "@/lib/cases/tags-actions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TOKEN_STYLES, TOKEN_COLOR_VAR } from "./case-status-badge";
import { useCaseAction } from "./use-case-action";

/**
 * Case TAGS panel (R3): the tags assigned to this case as removable chips, plus
 * an "add" menu listing the commission's NON-assigned vocabulary. Assign /
 * unassign funnel through the staff_admin-gated actions; the vocabulary itself is
 * managed under Configurações (linked here). Client component fed plain props.
 */
export function CaseTagsPanel({
  slug,
  caseId,
  assigned,
  vocabulary,
  variant = "default",
}: {
  slug: string;
  caseId: string;
  assigned: CaseTag[];
  /** The commission's NON-archived tag vocabulary (the picker source). */
  vocabulary: CaseTag[];
  /** "rail" = compact, flatter treatment for the case-detail side rail. */
  variant?: "default" | "rail";
}) {
  const { run, isPending, error } = useCaseAction();

  // Available = vocabulary not already assigned to this case.
  const assignedIds = useMemo(
    () => new Set(assigned.map((t) => t.id)),
    [assigned],
  );
  const available = vocabulary.filter((t) => !assignedIds.has(t.id));

  return (
    <section
      aria-labelledby="case-tags-heading"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card",
        variant === "rail"
          ? "border-border/70 p-4 shadow-none"
          : "border-border p-5 shadow-xs",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id="case-tags-heading"
            className={cn(
              "font-semibold",
              variant === "rail" ? "text-sm" : "text-base",
            )}
          >
            Etiquetas
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || available.length === 0}
              >
                <Plus aria-hidden="true" />
                Adicionar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Etiquetas disponíveis</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {available.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  className="gap-2"
                  onSelect={() => run(() => assignCaseTag(caseId, t.id))}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TOKEN_COLOR_VAR[t.colorToken] }}
                  />
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild type="button" variant="ghost" size="sm">
            <Link href={`/c/${slug}/manage/settings/etiquetas`}>
              <Settings2 aria-hidden="true" />
              Gerenciar
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {vocabulary.length === 0
            ? "Esta comissão ainda não tem etiquetas. Crie-as em Gerenciar."
            : "Nenhuma etiqueta atribuída a este caso."}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {assigned.map((t) => (
            <li key={t.id}>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium",
                  TOKEN_STYLES[t.colorToken] ?? TOKEN_STYLES.muted,
                )}
              >
                {t.name}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => unassignCaseTag(caseId, t.id))}
                  aria-label={`Remover a etiqueta ${t.name}`}
                  className="grid size-4 place-items-center rounded-full transition-colors hover:bg-foreground/10 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
