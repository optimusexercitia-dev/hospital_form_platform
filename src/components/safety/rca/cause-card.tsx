"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";

import type { FishboneCategory, RcaFactor } from "@/lib/safety/rca-types";
import {
  removeRcaFactor,
  setRcaFactorKey,
  updateRcaFactor,
} from "@/lib/safety/rca-actions";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useSafetyAction } from "../use-safety-action";
import { RcaConfirmDelete } from "./rca-confirm-delete";
import { CATEGORY_VISUAL } from "./rca-visuals";

const SAVE_DEBOUNCE_MS = 700;

/**
 * One contributing-factor card on a fishbone rib (README_rca §5.1). Inline-editable
 * text (debounced `updateRcaFactor`), a target-icon **key toggle** (`setRcaFactorKey`
 * — flagged factors feed the 5-Whys), and a remove. A `key` factor shows a 3px inset
 * left strip in the category color.
 */
export function CauseCard({
  factor,
  category,
  canEdit,
}: {
  factor: RcaFactor;
  category: FishboneCategory;
  canEdit: boolean;
}) {
  const router = useRouter();
  const visual = CATEGORY_VISUAL[category];
  const { run, isPending } = useSafetyAction();
  const [text, setText] = useState(factor.text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sig, setSig] = useState(factor.text);
  if (sig !== factor.text) {
    setSig(factor.text);
    setText(factor.text);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onChangeText(value: string) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void updateRcaFactor(factor.id, value).then((result) => {
        if (result.ok) router.refresh();
      });
    }, SAVE_DEBOUNCE_MS);
  }

  return (
    <div
      className={cn(
        "relative flex items-start gap-2 overflow-hidden rounded-lg border border-border bg-card p-2.5 shadow-xs",
        factor.isKey && "pl-3",
      )}
    >
      {factor.isKey && (
        <span
          aria-hidden="true"
          className={cn("absolute inset-y-0 left-0 w-[3px]", visual.strip)}
        />
      )}

      {canEdit ? (
        <Textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          aria-label="Fator contribuinte"
          rows={2}
          className="min-h-0 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      ) : (
        <p className="flex-1 text-sm text-foreground text-pretty">
          {factor.text || "—"}
        </p>
      )}

      {canEdit && (
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            aria-pressed={factor.isKey}
            aria-label={
              factor.isKey
                ? "Desmarcar como fator-chave"
                : "Marcar como fator-chave (5 porquês)"
            }
            onClick={() => run(() => setRcaFactorKey(factor.id, !factor.isKey))}
            className={cn(factor.isKey ? visual.iconText : "text-muted-foreground")}
          >
            <Target aria-hidden="true" />
          </Button>
          <RcaConfirmDelete
            action={() => removeRcaFactor(factor.id)}
            label="Remover fator"
            title="Remover este fator?"
            description="O fator será removido da análise. Se for um fator-chave, sua cadeia de 5 porquês também deixa de aparecer."
          />
        </div>
      )}
    </div>
  );
}
