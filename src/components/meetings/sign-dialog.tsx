"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";

import { signMeeting } from "@/lib/meetings/actions";
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

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The "Assinar" action for the current user's own present-attendee row (F4).
 * Opens a confirmation that states exactly what is being attested ("declaro que
 * participei desta reunião e aprovo esta ata"), then calls the SECURITY DEFINER
 * `signMeeting` RPC. An optional note can be recorded. This is NOT a staff_admin
 * action — any present member signs their OWN row.
 */
export function SignButton({
  attendeeId,
  meetingNumber,
}: {
  attendeeId: string;
  /** Shown in the confirmation copy for clarity. */
  meetingNumber: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setNote("");
    }
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await signMeeting(attendeeId, note.trim() || undefined);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível assinar. Tente novamente.");
        return;
      }
      // Close + refresh on success directly in the transition (no effect).
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <PenLine aria-hidden="true" />
        Assinar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinar a ata</DialogTitle>
            <DialogDescription>
              Ao assinar, você declara que participou da reunião nº{" "}
              {String(meetingNumber).padStart(4, "0")} e que aprova esta ata. A
              assinatura é eletrônica, vinculada à sua autenticação na
              plataforma, e registra o conteúdo da ata no momento da assinatura.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {error && <FormBanner tone="error">{error}</FormBanner>}

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Observação{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={FIELD_CLASS}
                placeholder="Ressalva ou comentário, se houver"
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Assinando…" : "Assinar ata"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
