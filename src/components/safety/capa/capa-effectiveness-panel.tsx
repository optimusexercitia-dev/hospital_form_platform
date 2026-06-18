"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import {
  CAPA_EFFECTIVENESS_VERDICT_LABELS,
  type CapaEffectiveness,
  type CapaEffectivenessInput,
  type CapaEffectivenessVerdict,
} from "@/lib/safety/capa-types";
import { recordCapaEffectiveness } from "@/lib/safety/capa-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatDateTime } from "../format";
import { CapaVerdictChip } from "./capa-badges";

const VERDICT_ORDER: CapaEffectivenessVerdict[] = [
  "eficaz",
  "parcial",
  "ineficaz",
];

/**
 * The effectiveness panel — the close precondition. Records (or replaces) the plan's
 * 1:1 verdict + a sanitized-Markdown method narrative (`recordCapaEffectiveness`,
 * which moves `em_execucao → em_verificacao`). Read-only for non-managers and once
 * the plan is concluded.
 */
export function CapaEffectivenessPanel({
  capaId,
  effectiveness,
  canManage,
  isClosed,
}: {
  capaId: string;
  effectiveness: CapaEffectiveness | null;
  canManage: boolean;
  isClosed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [verdict, setVerdict] = useState<CapaEffectivenessVerdict>(
    effectiveness?.verdict ?? "eficaz",
  );
  const [methodMd, setMethodMd] = useState(effectiveness?.methodMd ?? "");

  const readOnly = !canManage || isClosed;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: CapaEffectivenessInput = {
      verdict,
      methodMd: methodMd.trim() || null,
    };
    startTransition(async () => {
      const result = await recordCapaEffectiveness(capaId, input);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível registrar a verificação.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const showForm = !readOnly && (editing || effectiveness == null);

  return (
    <section
      aria-labelledby="capa-effectiveness-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="capa-effectiveness-heading" className="text-lg">
            Verificação de eficácia
          </h2>
        </div>
        {effectiveness && (
          <CapaVerdictChip verdict={effectiveness.verdict} />
        )}
      </div>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {showForm ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium">Veredito</legend>
            <div
              role="radiogroup"
              aria-label="Veredito de eficácia"
              className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5"
            >
              {VERDICT_ORDER.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={verdict === v}
                  onClick={() => setVerdict(v)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                    verdict === v
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {CAPA_EFFECTIVENESS_VERDICT_LABELS[v]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Método de verificação</span>
            <SectionTextEditor
              value={methodMd}
              onChange={setMethodMd}
              textareaId={`capa-method-${capaId}`}
              placeholder="Como a eficácia foi verificada (dados, auditoria, período)…"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : "Registrar verificação"}
            </Button>
            {effectiveness && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      ) : effectiveness ? (
        <div className="flex flex-col gap-3">
          {effectiveness.methodMd?.trim() ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <MarkdownRenderer content={effectiveness.methodMd} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Sem método registrado.
            </p>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            Verificado em {formatDateTime(effectiveness.verifiedAt)}
            {effectiveness.verifiedByName
              ? ` por ${effectiveness.verifiedByName}`
              : ""}
          </p>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setEditing(true)}
            >
              Atualizar verificação
            </Button>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          A verificação de eficácia ainda não foi registrada. Ela é obrigatória antes
          de concluir o plano.
        </p>
      )}
    </section>
  );
}
