"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createAgendaItem,
  updateAgendaItem,
  type ActionState,
  type AgendaItemInput,
  type CreateAgendaItemState,
} from "@/lib/meetings/actions";
import type { MeetingAgendaItem } from "@/lib/queries/meetings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / edit an agenda item (F2). An agenda item has a planned `description`
 * (set when scheduling), `discussionNotes` (filled during/after), and a
 * `resolution` (the decision). Arg-based actions run inside a transition; on
 * success the dialog closes and the route refreshes.
 */
export function AgendaItemForm({
  mode,
  open,
  onOpenChange,
  meetingId,
  item,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  /** Required for `edit`. */
  item?: MeetingAgendaItem;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<
    (CreateAgendaItemState & ActionState) | null
  >(null);

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [discussionNotes, setDiscussionNotes] = useState(
    item?.discussionNotes ?? "",
  );
  const [resolution, setResolution] = useState(item?.resolution ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setTitle(item?.title ?? "");
      setDescription(item?.description ?? "");
      setDiscussionNotes(item?.discussionNotes ?? "");
      setResolution(item?.resolution ?? "");
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
    const input: AgendaItemInput = {
      title: title.trim(),
      description: description.trim() || null,
      discussionNotes: discussionNotes.trim() || null,
      resolution: resolution.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createAgendaItem(meetingId, input)
          : await updateAgendaItem(item!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo item de pauta" : "Editar item de pauta"}
          </DialogTitle>
          <DialogDescription>
            Registre um ponto de pauta, o que foi discutido e a resolução tomada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.title && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Título</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder="Ex.: Aprovação da ata anterior"
              aria-invalid={state?.fieldErrors?.title ? true : undefined}
            />
            {state?.fieldErrors?.title && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.title}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Descrição planejada{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={FIELD_CLASS}
              placeholder="O que será tratado neste ponto…"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Discussão{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={discussionNotes}
              onChange={(e) => setDiscussionNotes(e.target.value)}
              rows={3}
              className={FIELD_CLASS}
              placeholder="O que foi discutido…"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Resolução{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={2}
              className={FIELD_CLASS}
              placeholder="A decisão ou encaminhamento…"
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Adicionar item"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
