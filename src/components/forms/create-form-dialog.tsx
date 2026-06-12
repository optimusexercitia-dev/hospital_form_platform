"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateFormForm } from "@/components/forms/create-form-form";

/**
 * "Novo formulário" button that opens a modal with the create form. Keeps the
 * form list the primary view; on success {@link CreateFormForm} navigates into
 * the builder (so the dialog unmounts with the page).
 */
export function CreateFormDialog({ commissionId }: { commissionId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus aria-hidden="true" />
          Novo formulário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo formulário</DialogTitle>
          <DialogDescription>
            Crie um formulário. Ele começa como um rascunho que você poderá
            estruturar e publicar quando estiver pronto.
          </DialogDescription>
        </DialogHeader>
        <CreateFormForm commissionId={commissionId} />
      </DialogContent>
    </Dialog>
  );
}
