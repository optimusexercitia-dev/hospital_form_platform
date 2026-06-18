"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Plus } from "lucide-react";

import {
  FISHBONE_CATEGORY_LABELS,
  ROOT_CAUSE_CLASSIFICATION_LABELS,
  type RcaRootCause,
  type RootCauseClassification,
  type RootCauseType,
} from "@/lib/safety/rca-types";
import {
  addRcaRootCause,
  removeRcaRootCause,
  setRcaRootCauseClassification,
  updateRcaRootCause,
} from "@/lib/safety/rca-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSafetyAction } from "../use-safety-action";
import { RcaConfirmDelete } from "./rca-confirm-delete";
import { RootCauseTypePill } from "./rca-badges";
import { CATEGORY_VISUAL, CLASSIFICATION_SELECTED } from "./rca-visuals";

const SAVE_DEBOUNCE_MS = 700;
const CLASSIFICATIONS: RootCauseClassification[] = [
  "system",
  "human",
  "environment",
  "external",
];

/**
 * Stage 3 — Root causes (README_rca §6). An "Adicionar causa raiz" primary action +
 * a list of {@link RootCard}s. Each distils the analysis into a classified causal
 * statement — the STABLE record Phase-14d CAPA actions FK into.
 */
export function RootsStage({
  rcaId,
  rootCauses,
  canEdit,
  capaActionCountByRootCause = {},
}: {
  rcaId: string;
  rootCauses: RcaRootCause[];
  canEdit: boolean;
  /** root cause id → count of CAPA actions addressing it (the 14d linkage). */
  capaActionCountByRootCause?: Record<string, number>;
}) {
  const { run, isPending, error } = useSafetyAction();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Destile a análise em declarações de causa objetivas e classificadas. Cada
          causa raiz orientará um plano de ação na próxima fase.
        </p>
        {canEdit && (
          <Button
            type="button"
            size="lg"
            disabled={isPending}
            onClick={() =>
              run(() =>
                addRcaRootCause(rcaId, {
                  text: "",
                  category: null,
                  classification: "system",
                  type: "root",
                }),
              )
            }
          >
            <Plus aria-hidden="true" />
            Adicionar causa raiz
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {rootCauses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhuma causa raiz registrada. {canEdit ? "Adicione a primeira." : ""}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rootCauses.map((rc, index) => (
            <RootCard
              key={rc.id}
              rootCause={rc}
              index={index}
              canEdit={canEdit}
              capaActionCount={capaActionCountByRootCause[rc.id] ?? 0}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function RootCard({
  rootCause,
  index,
  canEdit,
  capaActionCount,
}: {
  rootCause: RcaRootCause;
  index: number;
  canEdit: boolean;
  capaActionCount: number;
}) {
  const router = useRouter();
  const { run, isPending } = useSafetyAction();
  const [text, setText] = useState(rootCause.text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sig, setSig] = useState(rootCause.text);
  if (sig !== rootCause.text) {
    setSig(rootCause.text);
    setText(rootCause.text);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onChangeText(value: string) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void updateRcaRootCause(rootCause.id, {
        text: value,
        category: rootCause.category,
        classification: rootCause.classification,
        type: rootCause.type,
      }).then((r) => {
        if (r.ok) router.refresh();
      });
    }, SAVE_DEBOUNCE_MS);
  }

  function setClass(classification: RootCauseClassification) {
    run(() =>
      setRcaRootCauseClassification(
        rootCause.id,
        classification,
        rootCause.type,
      ),
    );
  }

  function setType(type: RootCauseType) {
    run(() =>
      setRcaRootCauseClassification(
        rootCause.id,
        rootCause.classification,
        type,
      ),
    );
  }

  const catVisual = rootCause.category
    ? CATEGORY_VISUAL[rootCause.category]
    : null;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        {rootCause.category && catVisual && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
              catVisual.chip,
            )}
          >
            <catVisual.icon
              aria-hidden="true"
              className={cn("size-3.5", catVisual.iconText)}
            />
            {FISHBONE_CATEGORY_LABELS[rootCause.category]}
          </span>
        )}
        {canEdit ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              setType(rootCause.type === "root" ? "contributing" : "root")
            }
            aria-label="Alternar entre causa raiz e fator contribuinte"
            className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <RootCauseTypePill type={rootCause.type} />
          </button>
        ) : (
          <RootCauseTypePill type={rootCause.type} />
        )}
        {canEdit && (
          <div className="ml-auto">
            <RcaConfirmDelete
              action={() => removeRcaRootCause(rootCause.id)}
              label="Remover causa raiz"
              title="Remover esta causa raiz?"
              description="A declaração de causa raiz será removida da análise."
            />
          </div>
        )}
      </div>

      {canEdit ? (
        <Textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          aria-label="Declaração de causa raiz"
          rows={2}
          className="min-h-0 resize-none text-sm"
          placeholder="Descreva a causa raiz de forma objetiva…"
        />
      ) : (
        <p className="text-sm text-foreground text-pretty">{text || "—"}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Classificação
        </span>
        <div
          role="radiogroup"
          aria-label="Classificação da causa raiz"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-0.5"
        >
          {CLASSIFICATIONS.map((c) => {
            const selected = rootCause.classification === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!canEdit || isPending}
                onClick={() => setClass(c)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed",
                  selected
                    ? CLASSIFICATION_SELECTED[c]
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {ROOT_CAUSE_CLASSIFICATION_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      {capaActionCount > 0 && (
        <p className="inline-flex items-center gap-1.5 text-xs text-primary">
          <GitBranch aria-hidden="true" className="size-3.5" />
          Ações corretivas: {capaActionCount}
        </p>
      )}
    </li>
  );
}
