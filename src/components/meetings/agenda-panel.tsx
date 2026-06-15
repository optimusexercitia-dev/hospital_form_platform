"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ListOrdered, Pencil, Plus } from "lucide-react";

import type { MeetingAgendaItem } from "@/lib/queries/meetings";
import {
  deleteAgendaItem,
  reorderMeetingAgendaItem,
} from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
import { AgendaItemForm } from "./agenda-item-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { useMeetingAction } from "./use-meeting-action";

function AgendaRow({
  item,
  position,
  total,
  canEdit,
}: {
  item: MeetingAgendaItem;
  position: number;
  total: number;
  canEdit: boolean;
}) {
  const { run, isPending } = useMeetingAction();
  const [editOpen, setEditOpen] = useState(false);
  const isFirst = position === 0;
  const isLast = position === total - 1;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground tabular-nums"
          >
            {position + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {item.title}
            </span>
            {item.description && (
              <p className="text-xs text-muted-foreground text-pretty">
                {item.description}
              </p>
            )}
            {item.discussionNotes && (
              <p className="text-xs text-pretty">
                <span className="font-medium text-foreground">Discussão: </span>
                <span className="text-muted-foreground">
                  {item.discussionNotes}
                </span>
              </p>
            )}
            {item.resolution && (
              <p className="text-xs text-pretty">
                <span className="font-medium text-foreground">Resolução: </span>
                <span className="text-muted-foreground">{item.resolution}</span>
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending || isFirst}
              onClick={() => run(() => reorderMeetingAgendaItem(item.id, "up"))}
              aria-label={`Mover “${item.title}” para cima`}
            >
              <ChevronUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending || isLast}
              onClick={() =>
                run(() => reorderMeetingAgendaItem(item.id, "down"))
              }
              aria-label={`Mover “${item.title}” para baixo`}
            >
              <ChevronDown aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label={`Editar “${item.title}”`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <ConfirmDeleteButton
              action={() => deleteAgendaItem(item.id)}
              label={`Remover “${item.title}”`}
              title="Remover este item de pauta?"
              description={`O item “${item.title}” será removido permanentemente.`}
            />
          </div>
        )}
      </div>

      {canEdit && (
        <AgendaItemForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          meetingId={item.meetingId}
          item={item}
        />
      )}
    </li>
  );
}

/**
 * The meeting AGENDA panel (F2): an ordered list of agenda items (planned
 * description + discussion + resolution). staff_admin adds / edits / reorders
 * (swap idiom via `reorderMeetingAgendaItem`) while the meeting is unlocked;
 * read-only once concluded. Members always see it read-only.
 */
export function AgendaPanel({
  meetingId,
  items,
  canEdit,
}: {
  meetingId: string;
  items: MeetingAgendaItem[];
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const ordered = [...items].sort((a, b) => a.position - b.position);

  return (
    <section
      aria-labelledby="meeting-agenda-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListOrdered
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id="meeting-agenda-heading" className="text-base font-semibold">
            Pauta
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {ordered.length}
          </span>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" />
            Novo item
          </Button>
        )}
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhum item de pauta. Adicione os pontos a serem tratados."
            : "Nenhum item de pauta registrado."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((item, i) => (
            <AgendaRow
              key={item.id}
              item={item}
              position={i}
              total={ordered.length}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <AgendaItemForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          meetingId={meetingId}
        />
      )}
    </section>
  );
}
