"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Lock, Pencil, User, UserPlus, X } from "lucide-react";

import {
  saveNarrativeBody,
  upsertNarrativeBody,
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
import { CaseNarrativeDelete } from "@/components/cases/case-narrative-delete";
import { NarrativeCorrectionPanel } from "@/components/cases/narrative-correction-panel";
import { FileCorrectionControl } from "@/components/cases/file-correction-control";
import { CaseCorrectionsList } from "@/components/cases/case-corrections-panel";
import type { CorrectionCaps } from "@/components/cases/correction-labels";
import type {
  CorrectionRequest,
  NarrativeRevision,
} from "@/lib/queries/corrections";
import { isAssignedTo } from "@/components/cases/assigned-work-access";
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
 *   button that freezes the body. A concluded narrative is no longer reopened in
 *   place — it is amended through the Case Correction Lifecycle (ADR 0085).
 * - A `concluida` narrative renders read-only with a "Concluída" pill; the body is
 *   frozen (the server also rejects writes — HC055).
 */
export function CaseNarrativeCard({
  narrative,
  canEdit,
  canConclude = false,
  canDelete = false,
  assignees = [],
  canAssign = false,
  showLifecycle = true,
  correctionCaps = null,
  openCorrection = null,
  corrections = [],
  memberNames = {},
  narrativeRevisions = [],
  viewerId = null,
}: {
  narrative: CaseNarrative;
  /** Whether the viewer may edit the body now (Q14 + `aberta` + case open). */
  canEdit: boolean;
  /**
   * Whether the viewer may REMOVE this narrative — the parent passes
   * `narrative.isAdHoc && caps.canManageLifecycle`. Only ad-hoc ("adicional")
   * narratives are removable: a template-derived slot belongs to the case type,
   * so it gets no affordance (the backend refuses it too). Default `false`.
   */
  canDelete?: boolean;
  /** Whether the viewer may conclude it (assignee/coordinator + `aberta`). */
  canConclude?: boolean;
  /** The commission roster for the attribution control (only used when `canAssign`). */
  assignees?: AssigneeOption[];
  /**
   * Whether to show the coordinator ATTRIBUTION control (ADR 0033 D5) — assign /
   * change / clear the narrative's author. Gated by the parent to coordinator +
   * `aberta` + case open; `false` (default, and the flag-OFF legacy branch) hides it.
   */
  canAssign?: boolean;
  /**
   * Whether to show the narrative LIFECYCLE chrome (status pill, assignee, Concluir)
   * — the Case Access Control surface (ADR 0033). `false` (flag `case_access`
   * OFF) renders the card exactly as before the increment: just the body + Editar, so
   * the flag-OFF invariant (today's behavior) holds.
   */
  showLifecycle?: boolean;
  /**
   * The viewer's Case Correction Lifecycle capabilities (ADR 0085), or `null` when
   * the `case_corrections` flag is off (no correction surface). Threaded from the
   * host page → detail → list; when non-null, the {@link NarrativeCorrectionPanel}
   * mounts beneath the body (file a correction / draft editor / revision history).
   */
  correctionCaps?: CorrectionCaps | null;
  /**
   * The OPEN correction request targeting THIS narrative (if any), pre-derived by
   * the list. `null` = no open request → the "Corrigir…" menu may show on a
   * concluded narrative. Drives the corrector's draft editor + the status chip.
   */
  openCorrection?: CorrectionRequest | null;
  /**
   * EVERY correction request targeting THIS narrative (newest-first), pre-filtered by
   * the list. Rendered as the {@link CaseCorrectionsList} at the BOTTOM of this card —
   * the replacement for the case-wide "Solicitações de correção" cockpit card.
   */
  corrections?: CorrectionRequest[];
  /** userId → display name, for the request list's requester / corrector lines. */
  memberNames?: Record<string, string>;
  /**
   * This narrative's append-only revision history (superseded bodies, newest-first)
   * from `case_narrative_revisions`. `[]` = none. Rendered collapsed by the panel.
   */
  narrativeRevisions?: NarrativeRevision[];
  /**
   * The viewer's user id from the SESSION. Used for exactly one thing (ADR 0137 D8):
   * whether THIS narrative is the viewer's own attributed work, which PROMOTES
   * "Editar" from a ghost affordance to the card's primary action.
   *
   * ⛔ Identity, never authority. `canEdit` already decides WHETHER the control
   * renders (via `canEditNarrative`, which mirrors `app.can_write_case_narrative`);
   * this only decides how loudly. Gating the promotion on a capability would let
   * `narrowToReadingSurface` take it away on `/casos`, which is the defect D8 closes.
   * `null` (the default) simply means no promotion.
   */
  viewerId?: string | null;
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
  // lands (or a correction / external edit changes it), drop the optimistic override so the
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

  // ADR 0137 D10 — the per-case snapshot column `case_narratives.type_label` was
  // renamed to `display_label`, so `CaseNarrative.typeLabel` is now `displayLabel`.
  const heading = narrative.title || narrative.displayLabel;
  const hasBody = effectiveBody.trim().length > 0;
  const headingId = `narrative-${narrative.id}-heading`;
  const isConcluded = narrative.status === "completed";
  // Case Correction Lifecycle (ADR 0085): "Corrigir…" sits in the header's top-right
  // cluster (it used to live under the body, inside NarrativeCorrectionPanel). Filing
  // needs the flag, an open case, a CONCLUDED narrative and no open request yet —
  // one open request per target.
  const showFileCorrection =
    (correctionCaps?.enabled ?? false) &&
    (correctionCaps?.canFile ?? false) &&
    isConcluded &&
    openCorrection == null;
  // ADR 0137 D8 — attributed work is ACTIONABLE, and it must LOOK it. For the
  // narrative's own assignee this is the card's primary act, so "Editar" drops the
  // `ghost` variant and reads as the phase article's "Preencher" does. Everyone else
  // who may edit (a coordinator, an un-attributed write-grantee) keeps the quiet
  // treatment: for them this card is one of many, not their assignment.
  const isAssignee = isAssignedTo(narrative.assignedTo, viewerId);

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
  if (!showLifecycle && !canEdit && !hasBody) return null;

  // Legacy (flag OFF): a non-editable card shows the old "Bloqueado" pill (case
  // terminal). With the lifecycle on, "Bloqueada" tracks the narrative status instead.
  const showLegacyLocked = !showLifecycle && !canEdit;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <FileText aria-hidden="true" className="size-3.5" />
              Narrativa
            </span>
            {narrative.isAdHoc && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                adicional
              </span>
            )}
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

        {/* Top-right action cluster — ONE flex child, so "Editar" stays pinned to the
            right edge beside the delete. (As three siblings of a `justify-between`
            row, "Editar" was pushed to the card's top CENTRE whenever an ad-hoc
            narrative also rendered the delete button.) "Corrigir…" and "Editar" are
            mutually exclusive in practice — filing needs a CONCLUDED narrative, which
            is no longer editable. */}
        {!editing && (canEdit || showFileCorrection || canDelete) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {canEdit && (
              <Button
                type="button"
                variant={isAssignee ? "default" : "ghost"}
                size="sm"
                onClick={handleEdit}
              >
                <Pencil aria-hidden="true" />
                Editar
              </Button>
            )}
            {showFileCorrection && correctionCaps && (
              <FileCorrectionControl
                target={{ kind: "narrative", caseNarrativeId: narrative.id }}
                targetLabel={heading}
                assignees={assignees}
                caps={correctionCaps}
                defaultCorrectorId={narrative.assignedTo}
              />
            )}
            {canDelete && (
              <CaseNarrativeDelete
                narrativeId={narrative.id}
                narrativeLabel={heading}
              />
            )}
          </div>
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

      {/* Case Correction Lifecycle (ADR 0085): the draft-editor / history surface for
          this narrative, when the flag is on. The panel self-gates each part
          (corrector + open draft → editor; any revisions → collapsed history) and
          renders nothing when there is nothing to show, so mounting it unconditionally
          is safe. Filing moved to the header cluster above. Hidden while the body is
          being edited in place, to avoid two editors at once. */}
      {correctionCaps && !editing && (
        <NarrativeCorrectionPanel
          narrative={narrative}
          caps={correctionCaps}
          openCorrection={openCorrection}
          revisions={narrativeRevisions}
        />
      )}

      {/* This narrative's correction requests, at the bottom of its own card (each
          item carries its own status chip + the approve/reject/withdraw decisions).
          This replaced the case-wide "Solicitações de correção" cockpit card. */}
      {correctionCaps && !editing && (
        <CaseCorrectionsList
          requests={corrections}
          caps={correctionCaps}
          targetLabel={heading}
          memberNames={memberNames}
        />
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
