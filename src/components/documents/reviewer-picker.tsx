"use client";

import { Check } from "lucide-react";

import type { ApproverCandidate } from "@/lib/queries/documents";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

/** A chosen approver — the candidate id plus an editable per-document title. */
export interface ChosenApprover {
  approverId: string;
  approverTitle: string;
}

/** Two-letter initials from a display name (single word → first two letters). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Multi-select grid of candidate approvers (any active same-hospital user, from
 * `listApproverCandidates`). Each card is a toggle (`role="checkbox"`); a selected
 * card expands an editable "Cargo" input so the author can override the title
 * recorded on the signature. Controlled — the parent owns `value` and serializes
 * it (the wizard posts a JSON `approvers` field). Fully keyboard-operable with a
 * visible focus ring; token-driven.
 */
export function ReviewerPicker({
  candidates,
  value,
  onChange,
  disabled = false,
  describedBy,
  invalid = false,
}: {
  candidates: ApproverCandidate[];
  value: ChosenApprover[];
  onChange: (approvers: ChosenApprover[]) => void;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const chosenById = new Map(value.map((c) => [c.approverId, c]));

  function toggle(candidate: ApproverCandidate) {
    if (chosenById.has(candidate.id)) {
      onChange(value.filter((c) => c.approverId !== candidate.id));
    } else {
      onChange([
        ...value,
        { approverId: candidate.id, approverTitle: candidate.title ?? "" },
      ]);
    }
  }

  function setTitle(approverId: string, title: string) {
    onChange(
      value.map((c) =>
        c.approverId === approverId ? { ...c, approverTitle: title } : c,
      ),
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhum usuário do hospital está disponível como aprovador.
      </p>
    );
  }

  return (
    <ul
      aria-describedby={describedBy}
      className={cn(
        "grid grid-cols-1 gap-2.5 sm:grid-cols-2",
        invalid && "rounded-xl ring-[3px] ring-destructive/20",
      )}
    >
      {candidates.map((candidate) => {
        const chosen = chosenById.get(candidate.id);
        const selected = chosen != null;
        return (
          <li
            key={candidate.id}
            className={cn(
              "overflow-hidden rounded-xl border bg-card transition-colors",
              selected ? "border-primary/60 bg-accent/25" : "border-border",
            )}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => toggle(candidate)}
              className="flex w-full items-center gap-3 p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
            >
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">
                  {initials(candidate.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {candidate.name}
                </span>
                {candidate.title ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {candidate.title}
                  </span>
                ) : null}
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                )}
              >
                {selected ? <Check className="size-3.5" /> : null}
              </span>
            </button>
            {selected ? (
              <div className="border-t border-border/70 px-3 py-2.5">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Cargo neste documento
                  <Input
                    value={chosen.approverTitle}
                    onChange={(e) => setTitle(candidate.id, e.target.value)}
                    placeholder="Cargo (opcional)"
                    aria-label={`Cargo de ${candidate.name}`}
                    disabled={disabled}
                    className="h-9"
                  />
                </label>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
