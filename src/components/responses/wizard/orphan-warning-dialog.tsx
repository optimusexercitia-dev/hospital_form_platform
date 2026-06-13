"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { OrphanedSection } from "./use-wizard";

/**
 * Warn-and-clear dialog (F4). When changing a controlling answer would hide a
 * section that ALREADY holds answers, the change is held and this dialog asks
 * the user to confirm. On confirm, the parent commits the change AND clears the
 * orphaned answers (locally + via `saveSection(..., clearItemIds)`); on cancel,
 * the change is discarded and the prior answer stands.
 *
 * Built on the Radix AlertDialog primitive → focus trap, Esc-to-cancel, and the
 * `alertdialog` role come for free. Controlled by `open`.
 */
export function OrphanWarningDialog({
  open,
  sections,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  sections: OrphanedSection[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const names = sections.map((s) =>
    s.section.isDefault
      ? "Seção inicial"
      : s.section.title || "Seção sem título",
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Esta mudança ocultará uma seção</AlertDialogTitle>
          <AlertDialogDescription>
            Ao alterar esta resposta,{" "}
            {names.length === 1 ? "a seção" : "as seções"}{" "}
            <strong className="text-foreground">{names.join(", ")}</strong>{" "}
            {names.length === 1 ? "deixará" : "deixarão"} de ser{" "}
            {names.length === 1 ? "exibida" : "exibidas"} e as respostas já
            preenchidas nela{names.length === 1 ? "" : "s"} serão removidas. Deseja
            continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Manter respostas
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Alterar e remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
