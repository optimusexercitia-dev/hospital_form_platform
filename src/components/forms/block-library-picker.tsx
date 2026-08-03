"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
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
import { FormBanner } from "@/components/auth/form-banner";

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
  const router = useRouter();

  function reset() {
    setError(null);
    setResult(null);
    setPendingId(null);
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
}: {
  entry: BlockLibraryEntry;
  pending: boolean;
  disabled: boolean;
  onInsert: () => void;
}) {
  const { summary, provenance } = entry;
  const otherTypes = summary.itemTypes.filter((t) => t !== summary.rootItemType);

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
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={disabled}
          onClick={onInsert}
          aria-label={`Inserir “${entry.name}”`}
        >
          {pending ? "Inserindo…" : "Inserir"}
        </Button>
      </div>

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
    </div>
  );
}
