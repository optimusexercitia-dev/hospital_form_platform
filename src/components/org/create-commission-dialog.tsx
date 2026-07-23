"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  OrgCommissionCreateForm,
  type HospitalOption,
} from "@/components/org/org-commission-create-form";

/**
 * "Criar comissão" trigger + modal for the org-admin Comissões page. Owns its
 * own open state (trigger-owns-state, mirrors `CreateFormDialog`); the form's
 * `onSuccess` closes the dialog and refreshes the route so the new commission
 * appears in the list below.
 */
export function CreateCommissionDialog({
  hospitals,
}: {
  hospitals: HospitalOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus aria-hidden="true" />
          Criar comissão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar comissão</DialogTitle>
          <DialogDescription>
            Escolha o hospital ao qual a comissão pertence. O identificador é
            único dentro da organização.
          </DialogDescription>
        </DialogHeader>
        <OrgCommissionCreateForm
          hospitals={hospitals}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
