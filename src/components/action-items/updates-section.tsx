"use client";

import { useId, useState } from "react";
import { MessageSquareText, Send } from "lucide-react";

import type {
  ActionItemUpdate,
  ActionItemUpdateType,
} from "@/lib/queries/action-item-updates";
import { createActionItemUpdate } from "@/lib/action-items/satellite-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { UPDATE_TYPE_META, UPDATE_TYPE_ORDER } from "./satellite-labels";
import { SatelliteSection, SatelliteEmpty } from "./satellite-section";
import { useSatelliteAction } from "./use-satellite-action";
import { formatDateTime } from "./format";

/**
 * Narrative UPDATES feed — the append-only "what a human typed" timeline (notes,
 * progress, blockers, deadline changes), distinct from the system-authored
 * status history. There is no edit/delete by design (a correction is a new
 * note). Posting is stakeholder-gated (assignee / active assignment /
 * staff_admin·org_admin → HC0I1 otherwise), so the composer renders only for
 * `canContribute`; everyone who can read the item can read the feed.
 */
export function UpdatesSection({
  actionItemId,
  updates,
  canContribute,
  onMutated,
}: {
  actionItemId: string;
  updates: ActionItemUpdate[];
  canContribute: boolean;
  onMutated: () => void | Promise<void>;
}) {
  const { run, isPending, error } = useSatelliteAction();
  const typeFieldId = useId();
  const bodyFieldId = useId();

  const [type, setType] = useState<ActionItemUpdateType>("progress");
  const [body, setBody] = useState("");

  const canSubmit = body.trim().length > 0 && !isPending;

  function handlePost() {
    if (!canSubmit) return;
    run(() => createActionItemUpdate(actionItemId, type, body), {
      onSuccess: () => {
        setBody("");
        setType("progress");
        return onMutated();
      },
    });
  }

  return (
    <SatelliteSection
      icon={MessageSquareText}
      title="Atualizações"
      count={updates.length}
    >
      {updates.length === 0 ? (
        <SatelliteEmpty>
          {canContribute
            ? "Nenhuma atualização ainda. Registre o andamento ou um impedimento."
            : "Nenhuma atualização registrada."}
        </SatelliteEmpty>
      ) : (
        <ol className="flex flex-col gap-2">
          {updates.map((update) => {
            const meta = UPDATE_TYPE_META[update.updateType];
            return (
              <li
                key={update.id}
                className="flex flex-col gap-1 rounded-lg border border-border/70 bg-card px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
                      meta.chipClassName,
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {update.authorName ?? "Autor desconhecido"}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(update.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-pretty text-foreground">
                  {update.body}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {canContribute && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border/70 bg-muted/10 p-2.5">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={typeFieldId}
              className="text-[0.7rem] font-medium text-muted-foreground"
            >
              Tipo de atualização
            </label>
            <NativeSelect
              id={typeFieldId}
              className="h-8 py-1 text-sm"
              value={type}
              disabled={isPending}
              onChange={(e) => setType(e.target.value as ActionItemUpdateType)}
            >
              {UPDATE_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {UPDATE_TYPE_META[t].label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={bodyFieldId}
              className="text-[0.7rem] font-medium text-muted-foreground"
            >
              Mensagem
            </label>
            <Textarea
              id={bodyFieldId}
              rows={2}
              className="min-h-16 text-sm"
              placeholder="Descreva o andamento, um impedimento ou uma mudança de prazo…"
              value={body}
              disabled={isPending}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canSubmit}
              onClick={handlePost}
            >
              <Send aria-hidden="true" />
              Registrar atualização
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </SatelliteSection>
  );
}
