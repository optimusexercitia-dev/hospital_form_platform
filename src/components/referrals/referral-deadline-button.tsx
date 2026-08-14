"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { setReferralDeadline } from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
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
 * The "Definir prazo" / "Alterar prazo" control — the button AND its dialog, as one
 * self-contained client island so it can sit wherever the deadline is *read* rather
 * than in a distant action panel. The commission-side detail renders it inside the
 * "Detalhes" card next to the "Prazo de resposta" value; the technical-direction page
 * keeps it in "Ações", which is its only control surface.
 *
 * The caller decides WHETHER to render it — with `canSetReferralDeadline` from
 * `./deadline-gate`, which is a plain module precisely so a Server Component may ask.
 */
export function ReferralDeadlineButton({
  referralId,
  responseDueAt,
  size = "sm",
}: {
  referralId: string;
  /** The current SLA deadline (ISO) or `null` — drives the label + initial value. */
  responseDueAt: string | null;
  /** `xs` for the compact in-card placement; `sm` for the action panel. */
  size?: "xs" | "sm";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
      >
        <CalendarClock aria-hidden="true" />
        {responseDueAt ? "Alterar prazo" : "Definir prazo"}
      </Button>
      <DeadlineDialog
        open={open}
        onOpenChange={setOpen}
        referralId={referralId}
        current={responseDueAt}
      />
    </>
  );
}

/** ISO timestamp → a `datetime-local` value (`YYYY-MM-DDTHH:mm`, local wall-clock);
 * `null`/unparseable → `""` (empty input). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** The current local wall-clock as a `datetime-local` value, for the input's `min`. */
function nowLocalInput(): string {
  return isoToLocalInput(new Date().toISOString());
}

/**
 * Deadline dialog (RV2 R2): either coordinator sets/updates/clears the SLA response
 * deadline while the referral is in flight. A past date is rejected by the RPC
 * (HC0A4); an empty value clears the deadline.
 */
function DeadlineDialog({
  open,
  onOpenChange,
  referralId,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(isoToLocalInput(current));
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const iso = value.trim() ? new Date(value).toISOString() : null;
    startTransition(async () => {
      const result = await setReferralDeadline({
        referralId,
        responseDueAt: iso,
      });
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prazo de resposta</DialogTitle>
          <DialogDescription>
            Defina a data-limite para a comissão de destino responder. Deixe em
            branco para remover o prazo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Prazo</span>
            <input
              type="datetime-local"
              value={value}
              min={nowLocalInput()}
              onChange={(e) => setValue(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              <CalendarClock aria-hidden="true" />
              {isPending ? "Salvando…" : "Salvar prazo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
