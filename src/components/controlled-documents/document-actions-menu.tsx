"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, MoreHorizontal, Replace } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionState, AddVersionState } from "@/lib/controlled-documents/actions";

type SupersedeAction = (
  prev: AddVersionState | undefined,
  formData: FormData,
) => Promise<AddVersionState>;

type ObsoleteAction = (documentId: string) => Promise<ActionState>;

/**
 * "Mais ações" overflow menu for the controlled-document identity card
 * (doc-detail redesign, approved mockup). Renders ONLY in the effective-no-draft
 * state — the two actions here don't apply mid-revision. Two items:
 *
 * - "Substituir por rascunho em branco" — the `supersedeDocument` action contract:
 *   a plain FormData post with a `documentId` field; on `ok` the page refreshes
 *   into the fresh `rascunho`.
 * - "Marcar como obsoleto" (destructive) — confirms via `AlertDialog`, then calls
 *   `markDocumentObsolete(documentId)`; on `ok` the page refreshes.
 *
 * (Two standalone predecessors, `SupersedeDocumentButton` and
 * `ObsoleteDocumentButton`, were superseded by this menu and deleted in DM3·S2
 * after a repo-wide check found zero importers — the `{@link}`s that used to sit
 * on the two bullets above pointed at files that no longer exist.)
 *
 * Both actions are passed in as props (never value-imported — Rule 9/ARCHITECTURE
 * client-boundary discipline).
 */
export function DocumentActionsMenu({
  documentId,
  supersedeAction,
  obsoleteAction,
}: {
  documentId: string;
  supersedeAction: SupersedeAction;
  obsoleteAction: ObsoleteAction;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [supersedeError, setSupersedeError] = useState<string | null>(null);
  const [obsoleteError, setObsoleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSupersede() {
    setSupersedeError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("documentId", documentId);
      const result = await supersedeAction(undefined, formData);
      if (!result.ok) {
        setSupersedeError(
          result.error ?? "Não foi possível criar o rascunho.",
        );
        return;
      }
      router.refresh();
    });
  }

  function handleObsoleteConfirm() {
    setObsoleteError(null);
    startTransition(async () => {
      const result = await obsoleteAction(documentId);
      if (!result.ok) {
        setObsoleteError(
          result.error ?? "Não foi possível tornar o documento obsoleto.",
        );
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="lg">
            <MoreHorizontal aria-hidden="true" className="size-4" />
            Mais ações
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => handleSupersede()}
          >
            <Replace aria-hidden="true" className="size-4" />
            Substituir por rascunho em branco
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Archive aria-hidden="true" className="size-4" />
            Marcar como obsoleto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {supersedeError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {supersedeError}
        </p>
      ) : null}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setObsoleteError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tornar o documento obsoleto?</AlertDialogTitle>
            <AlertDialogDescription>
              A versão vigente deixa de valer e o documento passa a obsoleto. O
              arquivo continua disponível para consulta. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {obsoleteError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {obsoleteError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={handleObsoleteConfirm}
              disabled={pending}
            >
              {pending ? "Processando…" : "Tornar obsoleto"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
