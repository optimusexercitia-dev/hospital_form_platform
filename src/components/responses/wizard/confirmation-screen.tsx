"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Post-submission confirmation (F5). Shown after `submit_response` succeeds.
 * Reassures the user the response was recorded and offers the two natural next
 * steps: back to the form list, or to "minhas respostas" to review what was
 * sent. A live region announces the success to assistive tech.
 */
export function ConfirmationScreen({
  slug,
  formTitle,
}: {
  slug: string;
  formTitle: string;
}) {
  return (
    <div
      className="animate-rise-in flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-xs"
      role="status"
      aria-live="polite"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 aria-hidden="true" className="size-8" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl text-balance">Resposta enviada</h2>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Suas respostas para <strong className="text-foreground">{formTitle}</strong>{" "}
          foram registradas com sucesso. Obrigado por contribuir.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="outline" size="lg">
          <Link href={`/c/${slug}/forms`}>Voltar aos formulários</Link>
        </Button>
        <Button asChild size="lg">
          <Link href={`/c/${slug}/respostas`}>Ver minhas respostas</Link>
        </Button>
      </div>
    </div>
  );
}
