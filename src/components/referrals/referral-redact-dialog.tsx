"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type { ReferralActionState } from "@/lib/referrals/types";
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
 * The shared redaction dialog (RV2 R5) for both a thread MESSAGE and an internal
 * NOTE. Redaction is APPEND-ONLY + audited: the real body is retained server-side
 * (distinct from disposal, which purges) and rendered `[redigido]` to every reader.
 * A coordinator-only action (the RPC re-checks: 42501 for a non-coordinator of the
 * owning side, HC0A9 for an already-redacted target). A PHI-free governance reason
 * is required.
 *
 * The concrete action is injected as `onRedact(reason)` so the same dialog drives
 * `redactReferralMessage` and `redactReferralNote`.
 */
export function ReferralRedactDialog({
  open,
  onOpenChange,
  kind,
  onRedact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being redacted — drives the copy. */
  kind: "message" | "note";
  onRedact: (reason: string) => Promise<ReferralActionState>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setFieldError(null);
      setError(null);
    }
  }

  const label = kind === "message" ? "mensagem" : "nota interna";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (!reason.trim()) {
      setFieldError(REFERRAL_MESSAGES.redactReasonRequired);
      return;
    }
    startTransition(async () => {
      const result = await onRedact(reason.trim());
      if (!result.ok) {
        if (result.fieldErrors?.reason) setFieldError(result.fieldErrors.reason);
        else setError(result.error ?? REFERRAL_MESSAGES.generic);
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
          <DialogTitle>Tarjar {label}</DialogTitle>
          <DialogDescription>
            O conteúdo passa a exibir &ldquo;[redigido]&rdquo; para todos os
            leitores. O texto original é mantido em registro auditado — esta ação é
            distinta do descarte, que apaga os dados. Informe o motivo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Motivo da tarja</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className={FIELD_CLASS}
              placeholder="Por que o conteúdo está sendo tarjado…"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "referral-redact-error" : undefined}
            />
            {fieldError && (
              <span
                id="referral-redact-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {fieldError}
              </span>
            )}
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
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Tarjando…" : "Tarjar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
