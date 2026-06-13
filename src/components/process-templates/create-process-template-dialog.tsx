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
import { CreateProcessTemplateForm } from "@/components/process-templates/create-process-template-form";

/**
 * "Novo processo" button that opens a modal with the create form. Keeps the
 * template list the primary view; on success the inner form navigates into the
 * builder (so the dialog unmounts with the page). Mirrors {@link CreateFormDialog}.
 */
export function CreateProcessTemplateDialog({
  commissionId,
}: {
  commissionId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus aria-hidden="true" />
          Novo processo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo processo</DialogTitle>
          <DialogDescription>
            Crie um processo multifásico. Ele começa como um rascunho que você
            poderá estruturar e publicar quando estiver pronto.
          </DialogDescription>
        </DialogHeader>
        <CreateProcessTemplateForm commissionId={commissionId} />
      </DialogContent>
    </Dialog>
  );
}
