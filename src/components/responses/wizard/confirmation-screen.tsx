"use client";

import { commissionHref } from "@/lib/routing";
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
  org,
  slug,
  formTitle,
  correction,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  formTitle: string;
  /**
   * Case Correction Lifecycle context (ADR 0085): when present, the draft was a
   * correction sent for approval (not a first-fill conclusion), so the copy + the
   * return link change. `doneHref` is a pre-built string route (never a closure —
   * BUG-QI-001) the corrector can reach.
   */
  correction?: { doneHref: string } | null;
}) {
  if (correction) {
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
          <h2 className="text-2xl text-balance">Correção enviada para revisão</h2>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Sua correção de{" "}
            <strong className="text-foreground">{formTitle}</strong> foi enviada. Um
            administrador da comissão vai avaliar antes de ela substituir o conteúdo
            registrado.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={correction.doneHref}>Voltar aos meus casos</Link>
        </Button>
      </div>
    );
  }

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
          <Link href={commissionHref(org, slug, "forms")}>Voltar aos formulários</Link>
        </Button>
        <Button asChild size="lg">
          <Link href={commissionHref(org, slug, "respostas")}>Ver minhas respostas</Link>
        </Button>
      </div>
    </div>
  );
}
