"use client";

import { useState } from "react";
import { CalendarDays, Lock, MessageSquarePlus, Pencil } from "lucide-react";

import type { CaseEvent } from "@/lib/queries/case-documents";
import { deleteCaseEvent } from "@/lib/cases/documents-actions";
import { Button } from "@/components/ui/button";
import { CaseEventForm } from "./case-event-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { EVENT_KIND_LABEL } from "./case-extras-labels";
import { formatDate, formatDueDate } from "./format";

/**
 * Case EVENTS timeline (R1): manual free-text working notes (note / meeting /
 * decision), newest-first, with add / edit / delete (staff_admin). A client
 * component — it owns the add + per-row edit dialog state — fed plain `events`
 * props by the server page. Events are hard-deletable (working notes, not
 * immutable artifacts).
 */
export function CaseEventsTimeline({
  caseId,
  events,
  canWrite = true,
  canSetVisibility = false,
}: {
  caseId: string;
  events: CaseEvent[];
  /**
   * Whether the viewer may add/edit/delete working notes (`canWriteContent`; ADR
   * 0033). Default `true`; a read-only viewer sees the notes without affordances.
   */
  canWrite?: boolean;
  /**
   * Whether the viewer is a coordinator (`canManageLifecycle`) and so may set a
   * record's visibility to "coordinator_only" (ETH·E3a). Default `false` — a
   * non-coordinator writer's form omits the field and the record stays the default
   * `case_readers` visibility (server-side default).
   */
  canSetVisibility?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CaseEvent | null>(null);

  return (
    <section
      aria-labelledby="case-events-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id="case-events-heading" className="text-base font-semibold">
            Registros
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {events.length}
          </span>
        </div>
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <MessageSquarePlus aria-hidden="true" />
            Adicionar registro
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canWrite
            ? "Nenhum registro ainda. Anote reuniões, decisões e notas de acompanhamento deste caso."
            : "Nenhum registro ainda."}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="relative flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-3"
            >
              <span
                aria-hidden="true"
                className="mt-1 size-2 shrink-0 rounded-full bg-primary"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-secondary-foreground uppercase">
                    {EVENT_KIND_LABEL[ev.kind]}
                  </span>
                  {/* ETH·E3a: an informational "coordinator only" marker. RLS never
                      delivers a coordinator_only row to a non-coordinator, so the badge
                      is a visibility cue for coordinators, not a second gate. */}
                  {ev.visibility === "coordinator_only" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-warning uppercase">
                      <Lock aria-hidden="true" className="size-3" />
                      Somente coordenação
                    </span>
                  )}
                  {ev.title && (
                    <span className="text-sm font-medium text-foreground">
                      {ev.title}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/90 text-pretty whitespace-pre-wrap">
                  {ev.body}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {ev.occurredAt
                    ? `${formatDueDate(ev.occurredAt)}${
                        ev.occurredTime ? ` · ${ev.occurredTime}` : ""
                      }`
                    : formatDate(ev.createdAt)}
                  {ev.createdByName ? ` · ${ev.createdByName}` : ""}
                </p>
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-start gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing(ev)}
                    aria-label={`Editar registro${ev.title ? ` ${ev.title}` : ""}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <ConfirmDeleteButton
                    action={() => deleteCaseEvent(ev.id)}
                    label={`Remover registro${ev.title ? ` ${ev.title}` : ""}`}
                    title="Remover este registro?"
                    description="O registro será removido permanentemente. Esta ação não pode ser desfeita."
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {canWrite && (
        <CaseEventForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          caseId={caseId}
          canSetVisibility={canSetVisibility}
        />
      )}
      {canWrite && editing && (
        <CaseEventForm
          mode="edit"
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          caseId={caseId}
          event={editing}
          canSetVisibility={canSetVisibility}
        />
      )}
    </section>
  );
}
