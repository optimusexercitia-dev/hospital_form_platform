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
import { OrgHospitalCreateForm } from "@/components/org/org-hospital-create-form";

/**
 * "Criar hospital" trigger + modal for the org-admin Hospitais page. Owns its
 * own open state (trigger-owns-state, mirrors `CreateFormDialog`); the form's
 * `onSuccess` closes the dialog and refreshes the route so the new hospital
 * appears in the list below.
 */
export function CreateHospitalDialog({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus aria-hidden="true" />
          Criar hospital
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar hospital</DialogTitle>
          <DialogDescription>
            O identificador é único dentro da organização.
          </DialogDescription>
        </DialogHeader>
        <OrgHospitalCreateForm
          organizationId={organizationId}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
