"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarClock, Pencil, Plus } from "lucide-react";

import type {
  RcaTimelineEntry,
  RcaTimelineEntryInput,
} from "@/lib/safety/rca-types";
import type { ActionState } from "@/lib/safety/types";
import {
  addRcaTimelineEntry,
  removeRcaTimelineEntry,
  reorderRcaTimeline,
  updateRcaTimelineEntry,
} from "@/lib/safety/rca-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { useFlipReorder } from "@/components/forms/use-flip-reorder";
import { useSafetyAction } from "../use-safety-action";
import { RcaConfirmDelete } from "./rca-confirm-delete";
import { formatDateTime } from "../format";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * The incident-TIMELINE panel (track-doc deliverable): a chronology of what happened
 * and when, ordered by `position` (the team's reconstruction, not the clock). Add /
 * edit / remove entries; up/down reorder with GSAP Flip (`reorderRcaTimeline`).
 */
export function RcaTimelinePanel({
  rcaId,
  entries,
  canEdit,
}: {
  rcaId: string;
  entries: RcaTimelineEntry[];
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { run, isPending, error } = useSafetyAction();
  const { containerRef, captureBeforeReorder } = useFlipReorder<HTMLOListElement>();

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() => reorderRcaTimeline(rcaId, next.map((e) => e.id)));
  }

  return (
    <section
      aria-labelledby="rca-timeline-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="rca-timeline-heading" className="text-base font-semibold">
            Linha do tempo do incidente
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {entries.length}
          </span>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" />
            Adicionar
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhum evento na linha do tempo. Reconstrua a cronologia do incidente."
            : "Nenhum evento registrado."}
        </p>
      ) : (
        <ol ref={containerRef} className="flex flex-col gap-2">
          {entries.map((entry, index) => (
            <TimelineRow
              key={entry.id}
              entry={entry}
              index={index}
              total={entries.length}
              isPending={isPending}
              canEdit={canEdit}
              onMove={move}
            />
          ))}
        </ol>
      )}

      {canEdit && (
        <TimelineEntryDialog
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          rcaId={rcaId}
        />
      )}
    </section>
  );
}

function TimelineRow({
  entry,
  index,
  total,
  isPending,
  canEdit,
  onMove,
}: {
  entry: RcaTimelineEntry;
  index: number;
  total: number;
  isPending: boolean;
  canEdit: boolean;
  onMove: (index: number, direction: "up" | "down") => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <li
      data-flip-id={`timeline-${entry.id}`}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
    >
      {canEdit && (
        <div className="flex shrink-0 flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onMove(index, "up")}
            disabled={index === 0 || isPending}
            aria-label="Mover para cima"
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onMove(index, "down")}
            disabled={index === total - 1 || isPending}
            aria-label="Mover para baixo"
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatDateTime(entry.occurredAt)}
        </span>
        <p className="text-sm text-foreground text-pretty">{entry.description}</p>
      </div>

      {canEdit && (
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditOpen(true)}
            aria-label="Editar evento"
          >
            <Pencil aria-hidden="true" />
          </Button>
          <RcaConfirmDelete
            action={() => removeRcaTimelineEntry(entry.id)}
            label="Remover evento"
            title="Remover este evento da linha do tempo?"
            description="O evento será removido da cronologia."
          />
          <TimelineEntryDialog
            mode="edit"
            open={editOpen}
            onOpenChange={setEditOpen}
            entry={entry}
          />
        </div>
      )}
    </li>
  );
}

function TimelineEntryDialog({
  mode,
  open,
  onOpenChange,
  rcaId,
  entry,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rcaId?: string;
  entry?: RcaTimelineEntry;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);
  const [occurredAt, setOccurredAt] = useState(toLocalInput(entry?.occurredAt));
  const [description, setDescription] = useState(entry?.description ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setOccurredAt(toLocalInput(entry?.occurredAt));
      setDescription(entry?.description ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: RcaTimelineEntryInput = {
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : "",
      description: description.trim(),
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await addRcaTimelineEntry(rcaId!, input)
          : await updateRcaTimelineEntry(entry!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Adicionar evento" : "Editar evento"}
          </DialogTitle>
          <DialogDescription>
            Registre o que ocorreu e quando, para reconstruir a cronologia do
            incidente. Nunca inclua dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Data e hora</span>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Descrição</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="text-sm"
              placeholder="Ex.: Hipotensão reconhecida na SRPA; monitorização mantida."
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Salvando…" : mode === "create" ? "Adicionar" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** ISO → `datetime-local` value (local time, no seconds). Empty for missing. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
