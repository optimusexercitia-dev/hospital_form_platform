"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Lock, Pencil, RotateCcw, User, UserPlus, X } from "lucide-react";

import {
  saveNarrativeBody,
  upsertNarrativeBody,
  reopenNarrative,
  assignNarrative,
  unassignNarrative,
} from "@/lib/case-narratives/actions";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormBanner } from "@/components/auth/form-banner";
import { NarrativeStatusPill } from "@/components/cases/narrative-status-pill";
import { ConcludeNarrativeButton } from "@/components/cases/conclude-narrative-button";
import type { AssigneeOption } from "@/components/cases/case-phase-list";
import type { CaseNarrative } from "@/lib/queries/cases";
import { cn } from "@/lib/utils";

/**
 * One per-case NARRATIVE (`case_narratives`; ADR 0032/0033) on the case-detail left
 * column — a free-form sanitized-Markdown body (Architecture Rule 7) rendered
 * through the platform's one renderer, interleaved with the phase articles by
 * {@link import('@/lib/queries/case-narratives').mergeCaseLayout}.
 *
 * As of Case Access Control (ADR 0033 D5) a narrative carries a single ASSIGNEE +
 * an `aberta → concluida` lifecycle:
 * - `canEdit` (decided by the parent via {@link import('./narrative-access').canEditNarrative},
 *   Q14) gates the EXPAND-TO-EDIT affordance: coordinator/admin, the narrative's
 *   assignee, or a write-grantee on an un-attributed narrative may edit while the
 *   narrative is `aberta` and the case is open. Saving routes through
 *   `saveNarrativeBody` (the broadened RPC re-checks `can_write_case_narrative`).
 * - `canConclude` (assignee or coordinator, narrative `aberta`) shows a "Concluir"
 *   button that freezes the body; `canReopen` (coordinator, narrative `concluida`)
 *   shows "Reabrir".
 * - A `concluida` narrative renders read-only with a "Concluída" pill; the body is
 *   frozen (the server also rejects writes — HC055).
 */
export function CaseNarrativeCard({
  narrative,
  canEdit,
  canConclude = false,
  canReopen = false,
  assignees = [],
  canAssign = false,
  showLifecycle = true,
}: {
  narrative: CaseNarrative;
  /** Whether the viewer may edit the body now (Q14 + `aberta` + case open). */
  canEdit: boolean;
  /** Whether the viewer may conclude it (assignee/coordinator + `aberta`). */
  canConclude?: boolean;
  /** Whether the viewer may reopen it (coordinator + `concluida`). */
  canReopen?: boolean;
  /** The commission roster for the attribution control (only used when `canAssign`). */
  assignees?: AssigneeOption[];
  /**
   * Whether to show the coordinator ATTRIBUTION control (ADR 0033 D5) — assign /
   * change / clear the narrative's author. Gated by the parent to coordinator +
   * `aberta` + case open; `false` (default, and the flag-OFF legacy branch) hides it.
   */
  canAssign?: boolean;
  /**
   * Whether to show the narrative LIFECYCLE chrome (status pill, assignee, Concluir/
   * Reabrir) — the Case Access Control surface (ADR 0033). `false` (flag `case_access`
   * OFF) renders the card exactly as before the increment: just the body + Editar, so
   * the flag-OFF invariant (today's behavior) holds.
   */
  showLifecycle?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  // Optimistic override of the just-saved body. On the prod standalone build,
  // `router.refresh()` / the action's `revalidatePath` may not re-render this server
  // component with the new `narrative.bodyMd` synchronously, so the card would fall
  // back to the empty placeholder right after a successful save (CN-APP-AC4). Holding
  // the saved body locally keeps it visible until the refreshed prop catches up.
  const [savedBody, setSavedBody] = useState<string | null>(null);
  // Reconcile during render (the React-recommended "adjust state when a prop changes"
  // pattern — avoids a setState-in-effect cascade): once the server-refreshed `bodyMd`
  // lands (or a reopen / external edit changes it), drop the optimistic override so the
  // PROP becomes authoritative again. This matters for a concluded/frozen or
  // externally-edited body, which must reflect the server, not a stale local copy.
  const [seenBodyMd, setSeenBodyMd] = useState(narrative.bodyMd);
  if (seenBodyMd !== narrative.bodyMd) {
    setSeenBodyMd(narrative.bodyMd);
    setSavedBody(null);
  }
  // The body to display/seed from: the optimistic override wins until reconciled above,
  // after which the prop is authoritative.
  const effectiveBody = savedBody ?? narrative.bodyMd ?? "";
  const [value, setValue] = useState(narrative.bodyMd ?? "");
  const [error, setError] = useState<string | null>(null);

  const heading = narrative.title || narrative.typeLabel;
  const hasBody = effectiveBody.trim().length > 0;
  const headingId = `narrative-${narrative.id}-heading`;
  const isConcluded = narrative.status === "concluida";

  function handleEdit() {
    setError(null);
    setValue(effectiveBody);
    setEditing(true);
  }

  function handleCancel() {
    setError(null);
    setValue(effectiveBody);
    setEditing(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      // Flag OFF → today's coordinator path (`update_case_narrative_body`); flag ON →
      // the Q14-broadened RPC (`save_narrative_body`) so assignees / un-attributed
      // write-grantees can also save. Both freeze on a terminal case (HC054).
      const result = showLifecycle
        ? await saveNarrativeBody(narrative.id, value)
        : await upsertNarrativeBody(narrative.id, value);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      // Show the saved body immediately from local state — the prop refresh below may
      // lag on the prod standalone build (CN-APP-AC4); the effect above reconciles to
      // the prop once it catches up.
      setSavedBody(value);
      setEditing(false);
      router.refresh();
    });
  }

  function handleReopen() {
    setError(null);
    startTransition(async () => {
      const result = await reopenNarrative(narrative.id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível reabrir. Tente novamente.");
        return;
      }
      router.refresh();
    });
  }

  function handleAssign(assigneeId: string) {
    setError(null);
    startTransition(async () => {
      const result = await assignNarrative(narrative.id, assigneeId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível atribuir. Tente novamente.");
        return;
      }
      router.refresh();
    });
  }

  function handleUnassign() {
    setError(null);
    startTransition(async () => {
      const result = await unassignNarrative(narrative.id);
      if (!result.ok) {
        setError(
          result.error ?? "Não foi possível remover o responsável. Tente novamente.",
        );
        return;
      }
      router.refresh();
    });
  }

  // Legacy (flag OFF, coordinator-only view): a non-editable narrative with no body
  // has nothing to show. With the lifecycle ON, the parent decides narrative
  // visibility by case state (open case → show the slot even when empty, so a case
  // reader sees the narrative exists; closed case → empties filtered upstream), so a
  // card that reaches here renders its slot.
  if (!showLifecycle && !canEdit && !canReopen && !hasBody) return null;

  // Legacy (flag OFF): a non-editable card shows the old "Bloqueado" pill (case
  // terminal). With the lifecycle on, "Bloqueada" tracks the narrative status instead.
  const showLegacyLocked = !showLifecycle && !canEdit;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <FileText aria-hidden="true" className="size-3.5" />
              Narrativa
            </span>
            {showLifecycle && <NarrativeStatusPill status={narrative.status} />}
            {((showLifecycle && isConcluded) || showLegacyLocked) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                <Lock aria-hidden="true" className="size-3" />
                Bloqueada
              </span>
            )}
          </div>
          <h2 id={headingId} className="text-base font-semibold">
            {heading}
          </h2>
          {showLifecycle && narrative.assigneeName && (
            <span className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground">
              <User aria-hidden="true" className="size-3.5" />
              {narrative.assigneeName}
            </span>
          )}
          {narrative.instructions && (
            <p className="max-w-prose text-xs text-muted-foreground text-pretty">
              {narrative.instructions}
            </p>
          )}
        </div>

        {canEdit && !editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="shrink-0"
          >
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        )}
        {showLifecycle && canReopen && !editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReopen}
            disabled={isPending}
            className="shrink-0"
          >
            <RotateCcw aria-hidden="true" />
            Reabrir
          </Button>
        )}
      </div>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {editing ? (
        <div className="flex flex-col gap-3">
          <SectionTextEditor
            value={value}
            onChange={setValue}
            disabled={isPending}
            textareaId={`narrative-body-${narrative.id}`}
            placeholder="Escreva esta narrativa em Markdown… Nunca inclua dados de paciente."
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : hasBody ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <MarkdownRenderer content={effectiveBody} />
        </div>
      ) : canEdit ? (
        // Editable + empty: prompt to fill.
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
          Nenhum conteúdo ainda. Clique em <span className="font-medium">Editar</span> para
          preencher.
        </p>
      ) : (
        // Read-only + empty: a case reader on an OPEN case sees that the narrative
        // slot exists, with no edit affordance (on a CLOSED case these are filtered
        // upstream and never reach the card).
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
          Nenhum conteúdo ainda.
        </p>
      )}

      {(canAssign || (showLifecycle && canConclude && !editing)) && (
        <div className="flex items-center justify-end gap-2">
          {canAssign && (
            <NarrativeAssignMenu
              heading={heading}
              assignees={assignees}
              assignedTo={narrative.assignedTo}
              assigneeName={narrative.assigneeName}
              disabled={isPending}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
            />
          )}
          {showLifecycle && canConclude && !editing && (
            <ConcludeNarrativeButton narrativeId={narrative.id} />
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Coordinator ATTRIBUTION control on a narrative card (ADR 0033 D5) — assign the
 * narrative's author, change them, or clear the assignment, from a `DropdownMenu`
 * (mirrors the access-roster `GrantMenu`). The trigger shows the current assignee, or
 * "Atribuir responsável" when none; the current assignee is marked in the list, and a
 * destructive "Remover responsável" item appears only when one is set.
 */
function NarrativeAssignMenu({
  heading,
  assignees,
  assignedTo,
  assigneeName,
  disabled,
  onAssign,
  onUnassign,
}: {
  heading: string;
  assignees: AssigneeOption[];
  assignedTo: string | null;
  assigneeName: string | null;
  disabled: boolean;
  onAssign: (assigneeId: string) => void;
  onUnassign: () => void;
}) {
  const assigned = assignedTo != null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="w-fit"
          aria-label={`Responsável pela narrativa ${heading}`}
        >
          {assigned ? (
            <>
              <User aria-hidden="true" />
              {assigneeName ?? "Responsável"}
            </>
          ) : (
            <>
              <UserPlus aria-hidden="true" />
              Atribuir responsável
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Responsável</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {assignees.map((a) => {
          const isCurrent = a.userId === assignedTo;
          return (
            <DropdownMenuItem
              key={a.userId}
              className="gap-2"
              onSelect={() => {
                if (!isCurrent) onAssign(a.userId);
              }}
            >
              <Check
                aria-hidden="true"
                className={cn("size-4", isCurrent ? "opacity-100" : "opacity-0")}
              />
              {a.name}
            </DropdownMenuItem>
          );
        })}
        {assigned && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onSelect={onUnassign}
            >
              <X aria-hidden="true" className="size-4" />
              Remover responsável
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
