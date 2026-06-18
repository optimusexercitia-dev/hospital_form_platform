"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Flag, X } from "lucide-react";

import type { CapaPlan } from "@/lib/safety/capa-types";
import { closeCapaPlan } from "@/lib/safety/capa-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatDateTime } from "../format";
import type { ConcludeGate } from "./capa-derive";

/**
 * The closure panel: the lessons-learned editor + the conclude-gate. The "Concluir
 * plano" button is DISABLED until the gate is satisfied (all actions settled + an
 * effectiveness verdict), with an explicit ✓/✗ checklist; the server re-enforces
 * (HC051/HC052 surfaced inline). A concluded plan renders the lessons read-only.
 */
export function CapaClosurePanel({
  plan,
  gate,
  canManage,
}: {
  plan: CapaPlan;
  gate: ConcludeGate;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState(plan.lessonsLearnedMd ?? "");

  const isClosed = plan.status === "concluido";

  function handleConclude(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await closeCapaPlan(plan.id, lessons.trim());
      if (!result.ok) {
        setError(result.error ?? "Não foi possível concluir o plano.");
        return;
      }
      router.refresh();
    });
  }

  if (isClosed) {
    return (
      <section
        aria-labelledby="capa-closure-heading"
        className="flex flex-col gap-3 rounded-2xl border border-success/30 bg-success/8 p-5"
      >
        <div className="flex items-center gap-2">
          <Flag aria-hidden="true" className="size-4 text-success" />
          <h2 id="capa-closure-heading" className="text-lg">
            Plano concluído
          </h2>
        </div>
        {plan.closedAt && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Encerrado em {formatDateTime(plan.closedAt)}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Lições aprendidas</span>
          {plan.lessonsLearnedMd?.trim() ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <MarkdownRenderer content={plan.lessonsLearnedMd} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Sem lições aprendidas registradas.
            </p>
          )}
        </div>
      </section>
    );
  }

  if (!canManage) return null;

  return (
    <section
      aria-labelledby="capa-closure-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <Flag aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="capa-closure-heading" className="text-lg">
          Encerramento
        </h2>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm">
        <GateRow
          ok={gate.allActionsSettled}
          label="Todas as ações concluídas ou canceladas"
        />
        <GateRow
          ok={gate.hasEffectiveness}
          label="Verificação de eficácia registrada"
        />
        <GateRow
          ok={gate.inVerification}
          label="Plano em verificação"
        />
      </ul>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      <form onSubmit={handleConclude} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Lições aprendidas</span>
          <SectionTextEditor
            value={lessons}
            onChange={setLessons}
            textareaId={`capa-lessons-${plan.id}`}
            placeholder="O que foi aprendido e o que se recomenda para o futuro…"
          />
        </div>
        <Button
          type="submit"
          disabled={!gate.canConclude || isPending}
          title={
            gate.canConclude
              ? undefined
              : "Conclua as ações e registre a verificação de eficácia primeiro."
          }
          className="w-fit"
        >
          <Check aria-hidden="true" />
          {isPending ? "Concluindo…" : "Concluir plano"}
        </Button>
      </form>
    </section>
  );
}

function GateRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 place-items-center rounded-full",
          ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {ok ? <Check className="size-3" /> : <X className="size-3" />}
      </span>
      <span className={cn(ok ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span className="sr-only">{ok ? "(atendido)" : "(pendente)"}</span>
    </li>
  );
}
