"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Tags } from "lucide-react";

import {
  archiveReferralNoteType,
  createReferralNoteType,
  reorderReferralNoteTypes,
  updateReferralNoteType,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type {
  ReferralActionState,
  ReferralNoteType,
} from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { Textarea } from "@/components/ui/textarea";
import { useFlipReorder } from "@/components/forms/use-flip-reorder";

const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The registro-type VOCABULARY manager (`referral_note_types`; RDR / ADR 0109) —
 * the referral mirror of {@link import('@/components/cases/narrative-type-manager').NarrativeTypeManager}:
 * create / rename / re-describe / reorder / archive the types this commission's
 * registros can be filed under. Coordinator-only; the parent gates the trigger.
 *
 * Writes are DIRECT, RLS-GATED table writes (plan amendment A6) — only the reorder
 * is an RPC, and even that is SECURITY INVOKER (ADR 0109 D2), so RLS stays the
 * boundary. Archive-only: a registro that snapshotted a `type_label` must keep
 * rendering it, so a type is retired, never deleted.
 *
 * Editing and archive confirmation happen INLINE inside the one dialog rather than
 * in nested dialogs — a nested Radix dialog steals the focus trap from its parent
 * and leaves the keyboard path ambiguous.
 */
export function ReferralNoteTypeManager({
  commissionId,
  noteTypes,
}: {
  commissionId: string;
  /** The commission's NON-archived vocabulary, ordered by `position`. */
  noteTypes: ReferralNoteType[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Tags aria-hidden="true" />
        Tipos de registro
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tipos de registro</DialogTitle>
            <DialogDescription>
              Defina como sua comissão classifica os registros internos deste
              módulo — por exemplo Análise interna, Contato com o setor, ou
              Pendência. Arquivar um tipo o retira do seletor; registros que já o
              utilizam continuam exibindo-o.
            </DialogDescription>
          </DialogHeader>
          <NoteTypeManagerBody
            commissionId={commissionId}
            noteTypes={noteTypes}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NoteTypeManagerBody({
  commissionId,
  noteTypes,
}: {
  commissionId: string;
  noteTypes: ReferralNoteType[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLUListElement>();

  function run(
    thunk: () => Promise<ReferralActionState>,
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await thunk();
      if (!result.ok) {
        setError(
          result.fieldErrors?.label ?? result.error ?? REFERRAL_MESSAGES.generic,
        );
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError(REFERRAL_MESSAGES.noteTypeLabelRequired);
      return;
    }
    run(
      () =>
        createReferralNoteType(commissionId, {
          label: label.trim(),
          description: description.trim() || null,
        }),
      () => {
        setLabel("");
        setDescription("");
      },
    );
  }

  // Reorder by swapping a row with its neighbour and persisting the full order —
  // the action expects EVERY non-archived id in its new order.
  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= noteTypes.length) return;
    const next = [...noteTypes];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() =>
      reorderReferralNoteTypes(
        commissionId,
        next.map((t) => t.id),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {noteTypes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground text-pretty">
          Nenhum tipo definido ainda. Crie o primeiro abaixo.
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {noteTypes.map((noteType, index) => (
            <NoteTypeRow
              key={noteType.id}
              noteType={noteType}
              isFirst={index === 0}
              isLast={index === noteTypes.length - 1}
              disabled={isPending}
              onMoveUp={() => move(index, "up")}
              onMoveDown={() => move(index, "down")}
              onSave={(input, done) =>
                run(() => updateReferralNoteType(noteType.id, input), done)
              }
              onArchive={() => run(() => archiveReferralNoteType(noteType.id))}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={create}
        noValidate
        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3"
      >
        <h3 className="text-sm font-semibold">Novo tipo</h3>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Nome</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={FIELD_CLASS}
            placeholder="Ex.: Análise interna"
            disabled={isPending}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Descrição <span className="font-normal">(opcional)</span>
          </span>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-16 text-sm"
            placeholder="Explique brevemente quando este tipo deve ser usado."
            disabled={isPending}
          />
        </label>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending}>
            <Plus aria-hidden="true" />
            {isPending ? "Salvando…" : "Criar tipo"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** One vocabulary row: reorder handles, inline rename, inline archive confirm. */
function NoteTypeRow({
  noteType,
  isFirst,
  isLast,
  disabled,
  onMoveUp,
  onMoveDown,
  onSave,
  onArchive,
}: {
  noteType: ReferralNoteType;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSave: (
    input: { label: string; description: string | null },
    done: () => void,
  ) => void;
  onArchive: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [label, setLabel] = useState(noteType.label);
  const [description, setDescription] = useState(noteType.description ?? "");

  return (
    <li
      data-flip-id={`referral-note-type-${noteType.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs"
    >
      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="sr-only">Nome do tipo {noteType.label}</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={FIELD_CLASS}
              disabled={disabled}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="sr-only">
              Descrição do tipo {noteType.label}
            </span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-14 text-sm"
              placeholder="Descrição (opcional)"
              disabled={disabled}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setLabel(noteType.label);
                setDescription(noteType.description ?? "");
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() =>
                onSave(
                  {
                    label: label.trim(),
                    description: description.trim() || null,
                  },
                  () => setEditing(false),
                )
              }
            >
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onMoveUp}
              disabled={isFirst || disabled}
              aria-label={`Mover ${noteType.label} para cima`}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onMoveDown}
              disabled={isLast || disabled}
              aria-label={`Mover ${noteType.label} para baixo`}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          </div>

          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {noteType.label}
            </span>
            {noteType.description ? (
              <span className="truncate text-xs text-muted-foreground">
                {noteType.description}
              </span>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(true)}
              disabled={disabled}
              aria-label={`Editar o tipo ${noteType.label}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setConfirmArchive(true)}
              disabled={disabled}
              aria-label={`Arquivar o tipo ${noteType.label}`}
            >
              Arquivar
            </Button>
          </div>
        </div>
      )}

      {confirmArchive ? (
        <div
          role="group"
          aria-label={`Confirmar o arquivamento de ${noteType.label}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
        >
          <p className="text-xs text-muted-foreground text-pretty">
            Arquivar “{noteType.label}”? Ele sai do seletor; registros existentes
            continuam exibindo-o.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setConfirmArchive(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setConfirmArchive(false);
                onArchive();
              }}
            >
              Arquivar
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
