"use client";

import { Clock, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The submit affordance shown at the foot of the review screen (F5). Submission
 * goes through `submit_response` — the server is the authority — so a rejection
 * (e.g. a required answer removed in another tab → P0011) is surfaced here as a
 * clear pt-BR message rather than a silent failure. The button is disabled while
 * the request is in flight.
 */
export function SubmitPanel({
  saving,
  banner,
  onSubmit,
  blockReason,
}: {
  saving: boolean;
  banner: string | null;
  onSubmit: () => void;
  /**
   * When set, submission is gated client-side (e.g. pending sign-offs, F3): the
   * button is disabled and this pt-BR reason is shown. The server stays the
   * authority — this is UX only.
   */
  blockReason?: string | null;
}) {
  const blocked = Boolean(blockReason);
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      {banner && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
        >
          {banner}
        </p>
      )}
      {blockReason && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          {blockReason}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Ao enviar, suas respostas não poderão mais ser alteradas.
        </p>
        <Button
          type="button"
          size="lg"
          onClick={onSubmit}
          disabled={saving || blocked}
          aria-busy={saving || undefined}
          title={blockReason ?? undefined}
        >
          <Send aria-hidden="true" />
          {saving ? "Enviando…" : "Enviar respostas"}
        </Button>
      </div>
    </div>
  );
}
