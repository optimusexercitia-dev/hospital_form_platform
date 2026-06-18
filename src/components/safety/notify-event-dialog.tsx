"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventNotifyForm } from "./event-notify-form";

/**
 * The case-detail "Notificar evento ao NSP" entry (F1): a button that opens a
 * dialog hosting the shared {@link EventNotifyForm}, pre-bound to THIS case +
 * commission. On success the dialog closes and the route refreshes so the new
 * event surfaces on the case timeline (`kind='safety_event'`) and the read-back
 * list. The success toast carries the minted code (e.g. "EV-0001").
 *
 * ANY commission member may file (just-culture) — the trigger is rendered on the
 * coordinator-gated case page, but the RPC, not the UI, is the authority.
 */
export function NotifyEventDialog({
  commissionId,
  caseId,
}: {
  commissionId: string;
  caseId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="lg" onClick={() => setOpen(true)}>
        <ShieldPlus aria-hidden="true" />
        Notificar evento ao NSP
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notificar evento ao NSP</DialogTitle>
            <DialogDescription>
              Encaminhe um evento de segurança do paciente ao Núcleo de Segurança
              do Paciente. Qualquer membro da comissão pode notificar.
            </DialogDescription>
          </DialogHeader>

          {/* `key={open}` resets the form's internal state each time the dialog
              re-opens, mirroring the meetings dialog's open-transition reset. */}
          <EventNotifyForm
            key={open ? "open" : "closed"}
            reportingCommissionId={commissionId}
            caseId={caseId}
            idPrefix="case-notify"
            submitLabel="Notificar evento"
            onCancel={() => setOpen(false)}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
