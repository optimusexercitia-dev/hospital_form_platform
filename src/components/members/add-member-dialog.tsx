"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import type { AddableUser } from "@/lib/queries/members";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddMemberPicker } from "@/components/members/add-member-picker";

/**
 * "Adicionar membro" trigger that opens a wide modal wrapping {@link AddMemberPicker}.
 * Keeps the members list the page's primary view; the picker only appears on demand.
 *
 * The dialog stays open after a successful add so a coordinator can add several
 * people in a row — the picker shows its own success banner, clears its selection,
 * and the underlying list revalidates. The coordinator closes via X / Esc / overlay.
 * That is why no success callback is needed here (and the picker stays untouched).
 */
export function AddMemberDialog({
  commissionId,
  candidates,
}: {
  commissionId: string;
  candidates: AddableUser[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden="true" />
          Adicionar membro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar membro</DialogTitle>
          <DialogDescription>
            Escolha uma pessoa já cadastrada na organização. Membros podem
            preencher os formulários publicados da comissão.
          </DialogDescription>
        </DialogHeader>
        <AddMemberPicker commissionId={commissionId} candidates={candidates} />
      </DialogContent>
    </Dialog>
  );
}
