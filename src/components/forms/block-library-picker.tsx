"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";

import {
  deleteBlockLibraryEntry,
  insertBlockFromLibrary,
  type InsertBlockFromLibraryState,
} from "@/lib/forms/actions";
import type { BlockLibraryEntry } from "@/lib/queries/block-library";
import { useBlockLibraryEntries } from "@/components/forms/block-library-context";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { EditLibraryEntryDialog } from "@/components/forms/edit-library-entry-dialog";
import { useBuilderAction } from "@/components/forms/use-builder-action";

/**
 * FF-4 (ADR 0092 rulings 1, 4, 7, 8) — the commission's block library, opened
 * from {@link AddBlockMenu}'s "Da biblioteca…" entry (SECTION mode only — the
 * frozen `InsertBlockFromLibraryInput` takes no `parentItemId`, so a library
 * block is always inserted TOP-LEVEL; offering this from inside a container
 * would be a trap the door refuses).
 *
 * Two views in one dialog, never both at once:
 *   - BROWSE (default) — every saved entry with enough to tell them apart
 *     WITHOUT opening one (name, description, provenance, the `summary`);
 *     `entries.length === 0` renders one honest empty state, not a spinner.
 *     FF-5 (ADR 0092 ruling 2, BE-7) adds rename/re-describe and delete per
 *     entry — see {@link LibraryEntryCard}.
 *   - RESULT (after a successful insert) — the ruling-4 rename review.
 *     `renamedKeys` is READ-ONLY here (confirmed with the lead: `question_key`
 *     has no rename door anywhere in the app — `updateItem` never touches it,
 *     and a fresh `addItem` already mints a random-suffixed key, so a
 *     collision only happens when the SAME library entry is inserted into the
 *     SAME version twice; the copy below says so, so an author who reads it
 *     needs no edit affordance). `[]` renders nothing — no empty "0 chaves
 *     renomeadas" panel.
 */
export function BlockLibraryPicker({
  open,
  onOpenChange,
  sectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
}) {
  const entries = useBlockLibraryEntries();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InsertBlockFromLibraryState | null>(null);
  // FF-5 — the result of a rename/delete, announced HERE rather than on the
  // card: a delete UNMOUNTS its card on the next refresh, so a per-card
  // `aria-live` region would disappear along with its own announcement
  // before assistive tech finishes reading it. This region outlives every
  // card, and is both visible (a banner) and announced (`role="status"` via
  // `FormBanner`).
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const router = useRouter();

  function reset() {
    setError(null);
    setResult(null);
    setPendingId(null);
    setAnnouncement(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleInsert(entry: BlockLibraryEntry) {
    setError(null);
    setPendingId(entry.id);
    startTransition(async () => {
      const res = await insertBlockFromLibrary({
        libraryEntryId: entry.id,
        sectionId,
      });
      setPendingId(null);
      if (!res.ok) {
        setError(
          res.error ?? "Não foi possível inserir este bloco. Tente novamente.",
        );
        return;
      }
      // Refresh NOW (not on dialog close): the result view the author is
      // about to see must describe the tree the server actually persisted,
      // and a later "Concluir" click should not carry a second, surprising
      // route refresh.
      router.refresh();
      setResult(res);
    });
  }

  const renames = result?.renamedKeys ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {result ? (
          <>
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle>Bloco inserido</DialogTitle>
              <DialogDescription>
                O bloco foi adicionado ao final desta seção.
              </DialogDescription>
            </DialogHeader>
            {renames.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
                <p className="text-sm font-medium text-foreground">
                  {renames.length === 1
                    ? "1 chave renomeada"
                    : `${renames.length} chaves renomeadas`}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {renames.map((r) => (
                    <li
                      key={r.oldKey}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-muted-foreground">
                        {r.oldKey}
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="font-mono text-foreground">
                        {r.newKey}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground text-pretty">
                  Este bloco já fazia parte desta versão, então a cópia
                  recebeu identificações próprias para as perguntas repetidas
                  — os painéis continuam contando cada uma separadamente.
                </p>
              </div>
            ) : null}
            <DialogFooter className="border-t border-border px-6 py-4">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Concluir
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle>Biblioteca de blocos</DialogTitle>
              <DialogDescription>
                Insira um bloco salvo desta comissão ao final desta seção.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
              {error ? <FormBanner tone="error">{error}</FormBanner> : null}
              {/* Visible + announced confirmation for rename/delete — see the
                  `announcement` state's doc comment for why it lives here and
                  not on the card. */}
              {announcement ? (
                <FormBanner tone="success">{announcement}</FormBanner>
              ) : null}
              {entries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground text-pretty">
                  Nenhum bloco salvo ainda nesta comissão. Use “Salvar na
                  biblioteca” em um bloco existente para começar.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <LibraryEntryCard
                        entry={entry}
                        pending={pendingId === entry.id && isPending}
                        disabled={isPending}
                        onInsert={() => handleInsert(entry)}
                        onEdited={(name) =>
                          setAnnouncement(`“${name}” atualizado.`)
                        }
                        onDeleted={(name) =>
                          setAnnouncement(`“${name}” excluído da biblioteca.`)
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DialogFooter className="border-t border-border px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const SAVED_AT_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function LibraryEntryCard({
  entry,
  pending,
  disabled,
  onInsert,
  onEdited,
  onDeleted,
}: {
  entry: BlockLibraryEntry;
  pending: boolean;
  disabled: boolean;
  onInsert: () => void;
  /** Metadata-only rename/re-describe succeeded (FF-5, BE-7). */
  onEdited: (name: string) => void;
  /** The entry was deleted (FF-5, BE-7). Deleting never touches any form
   *  already built from it — inserts materialize copies, never links
   *  (ADR 0092 ruling 2). */
  onDeleted: (name: string) => void;
}) {
  const { summary, provenance } = entry;
  const otherTypes = summary.itemTypes.filter((t) => t !== summary.rootItemType);
  const [editOpen, setEditOpen] = useState(false);
  const {
    run: runDelete,
    isPending: isDeleting,
    error: deleteError,
  } = useBuilderAction();

  function handleDelete() {
    runDelete(() => deleteBlockLibraryEntry({ libraryEntryId: entry.id }), {
      onSuccess: () => onDeleted(entry.name),
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-foreground">{entry.name}</span>
          {entry.description ? (
            <p className="text-sm text-muted-foreground text-pretty">
              {entry.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || isDeleting}
            onClick={() => setEditOpen(true)}
            aria-label={`Editar “${entry.name}”`}
            title="Editar nome e descrição"
          >
            <Pencil aria-hidden="true" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled || isDeleting}
                aria-label={`Excluir “${entry.name}”`}
                title="Excluir da biblioteca"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Excluir “{entry.name}” da biblioteca?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Isso não afeta nenhum formulário que já usa este bloco —
                  inserir sempre copia o conteúdo, nunca vincula a esta
                  entrada. Apenas a entrada da biblioteca é removida; esta
                  ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  {isDeleting ? "Excluindo…" : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            type="button"
            size="sm"
            disabled={disabled || isDeleting}
            onClick={onInsert}
            aria-label={`Inserir “${entry.name}”`}
          >
            {pending ? "Inserindo…" : "Inserir"}
          </Button>
        </div>
      </div>

      {deleteError ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {deleteError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
          {ITEM_TYPE_META[summary.rootItemType].label}
        </span>
        {summary.itemCount > 1 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {summary.itemCount} itens
          </span>
        ) : null}
        {otherTypes.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            + {otherTypes.map((t) => ITEM_TYPE_META[t].label).join(", ")}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Salvo por {provenance.savedByName} em{" "}
        {SAVED_AT_FORMAT.format(new Date(provenance.savedAt))} · de “
        {provenance.sourceFormTitle}” v{provenance.sourceVersionNumber}
      </p>

      {editOpen ? (
        <EditLibraryEntryDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          entry={entry}
          onSaved={onEdited}
        />
      ) : null}
    </div>
  );
}
