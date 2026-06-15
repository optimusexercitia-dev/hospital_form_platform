"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import type { CommissionMeetingType } from "@/lib/queries/meetings";
import { archiveMeetingType } from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
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
import { MeetingTypeChip } from "./meeting-badges";
import { MeetingTypeDefDialog } from "./meeting-type-def-dialog";
import { useMeetingAction } from "./use-meeting-action";

/**
 * Meeting-type vocabulary manager (F5, staff_admin): create / rename / recolour /
 * archive the commission's meeting types. Shows the NON-archived set (what
 * `listMeetingTypes` returns); archiving hides a type from the picker while
 * existing meetings keep their reference. Mirrors the cases `TagManager`.
 */
export function MeetingTypeManager({
  commissionId,
  types,
}: {
  commissionId: string;
  types: CommissionMeetingType[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Mantenha um vocabulário controlado de tipos de reunião para que os
          relatórios permaneçam consistentes. As comissões já vêm com “Ordinária”
          e “Extraordinária”.
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Novo tipo
        </Button>
      </div>

      {types.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum tipo de reunião ainda. Crie o primeiro tipo deste vocabulário.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {types.map((type) => (
            <li
              key={type.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <MeetingTypeChip name={type.name} colorToken={type.colorToken} />
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <TypeEditButton commissionId={commissionId} type={type} />
                <ArchiveTypeButton type={type} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <MeetingTypeDefDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        commissionId={commissionId}
      />
    </div>
  );
}

function TypeEditButton({
  commissionId,
  type,
}: {
  commissionId: string;
  type: CommissionMeetingType;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar o tipo ${type.name}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <MeetingTypeDefDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        commissionId={commissionId}
        type={type}
      />
    </>
  );
}

function ArchiveTypeButton({ type }: { type: CommissionMeetingType }) {
  const { run, isPending, error } = useMeetingAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`Arquivar o tipo ${type.name}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Arquivar o tipo “{type.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            O tipo deixará de aparecer no seletor. Reuniões que já o utilizam
            continuam exibindo-o.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              run(() => archiveMeetingType(type.id));
            }}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
