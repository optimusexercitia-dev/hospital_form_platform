"use client";

import { Send } from "lucide-react";

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
}: {
  saving: boolean;
  banner: string | null;
  onSubmit: () => void;
}) {
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Ao enviar, suas respostas não poderão mais ser alteradas.
        </p>
        <Button
          type="button"
          size="lg"
          onClick={onSubmit}
          disabled={saving}
          aria-busy={saving || undefined}
        >
          <Send aria-hidden="true" />
          {saving ? "Enviando…" : "Enviar respostas"}
        </Button>
      </div>
    </div>
  );
}
