"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import type { Json } from "@/lib/types/database";
import type { Item } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";

import { BlockRenderer } from "./block-renderer";
import {
  buildItemHandlers,
  NO_OP,
  type ItemCallbacks,
} from "./item-handlers";
import {
  canAddInstance,
  describeInstanceShortfall,
  type InstanceState,
} from "./instances";
import { isAnswerableItem, isInputItem } from "./use-wizard";

/**
 * FF-1 (ADR 0087) — a `repeating_group` rendered as N INSTANCES with the
 * add / remove / reorder chrome.
 *
 * Each instance is an independent answer scope: its children's answers carry
 * `answers.group_instance_id`, and a child's visibility is evaluated against the
 * 2-tier overlay (top-level ⊕ THIS instance), so the same question can be shown
 * in one repetition and hidden in another.
 *
 * Cardinality copy is deliberately about REPETITIONS, not fields: an unmet
 * `minInstances` reads "adicione ao menos N", never "campo obrigatório" pointing
 * into a blank row the user never meant to create (ruling 3's rationale).
 * `maxInstances` disables the add affordance rather than letting the RPC refuse.
 *
 * ACCESSIBILITY (FE-5): every control carries an explicit, POSITION-NAMING
 * pt-BR label ("Remover repetição 2 de 3"), because three identical icon buttons
 * per row are indistinguishable to a screen reader otherwise. The instance list
 * is an `<ol>` of real `<li>`s so the count and position are conveyed
 * structurally, and each instance is a `<section>` labelled by its own heading.
 * Reorder + remove announce through the parent's `role="status"` region.
 */
export function RepeatingGroupBlock({
  item,
  instances,
  imageUrls,
  errors,
  warnings,
  requiredNow,
  visibleItemIdsByInstance,
  saving,
  onAddInstance,
  onRemoveInstance,
  onMoveInstance,
  onInstanceChange,
  onInstanceObservationChange,
  onInstanceOtherTextChange,
  onInstanceClear,
  onInstanceMatrixCellChange,
  onInstanceMatrixClear,
  onInstanceRiskChange,
  onInstanceRiskClear,
}: {
  item: Item;
  instances: InstanceState[];
  imageUrls: Record<string, string>;
  /** Validation errors keyed by `${instanceId}:${itemId}`. */
  errors: Record<string, string>;
  /** FF-3 — failing `warn` rules, keyed the same way. Advisory; never blocks. */
  warnings?: Record<string, string>;
  /** FF-3 — keys required RIGHT NOW, keyed `${instanceId}:${itemId}`. */
  requiredNow?: Set<string>;
  visibleItemIdsByInstance: Map<string, Set<string>>;
  /** True while any instance action is in flight — disables the controls. */
  saving: boolean;
  onAddInstance: (groupItemId: string) => void;
  onRemoveInstance: (instanceId: string) => void;
  onMoveInstance: (instanceId: string, direction: "up" | "down") => void;
  onInstanceChange: (
    instanceId: string,
    child: { id: string; questionKey: string },
    value: Json,
  ) => void;
  onInstanceObservationChange: (
    instanceId: string,
    itemId: string,
    value: string,
  ) => void;
  onInstanceOtherTextChange: (
    instanceId: string,
    child: { id: string; questionKey: string },
    value: string,
  ) => void;
  onInstanceClear: (
    instanceId: string,
    child: { id: string; questionKey: string },
  ) => void;
  /**
   * FF-2 — the per-instance matrix verbs. A matrix inside a repeating group
   * answers per instance like any other child, so its writes are addressed by
   * `(instanceId, itemId)` and never touch the top-level slices.
   */
  onInstanceMatrixCellChange: (
    instanceId: string,
    itemId: string,
    rowCode: string,
    colCode: string,
  ) => void;
  onInstanceMatrixClear: (instanceId: string, itemId: string) => void;
  onInstanceRiskChange: (
    instanceId: string,
    itemId: string,
    selection: { severity: string; likelihood: string },
  ) => void;
  onInstanceRiskClear: (instanceId: string, itemId: string) => void;
}) {
  const headingId = `group-${item.id}-heading`;
  const descriptionId = item.questionExplanation
    ? `group-${item.id}-description`
    : undefined;

  const shortfall = describeInstanceShortfall(item, instances);
  const canAdd = canAddInstance(item, instances);
  const max = item.config?.maxInstances ?? null;

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <header className="flex flex-col gap-1">
        <h3 id={headingId} className="text-lg font-medium text-balance">
          {item.label}
        </h3>
        {item.questionExplanation ? (
          <p
            id={descriptionId}
            className="max-w-prose text-sm text-muted-foreground text-pretty"
          >
            {item.questionExplanation}
          </p>
        ) : null}
      </header>

      {instances.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground text-pretty">
          Nenhuma repetição adicionada. Use “Adicionar repetição” para começar.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {instances.map((instance, index) => (
            <li key={instance.id}>
              <InstanceCard
                container={item}
                instance={instance}
                index={index}
                total={instances.length}
                imageUrls={imageUrls}
                errors={errors}
                warnings={warnings}
                requiredNow={requiredNow}
                visibleItemIds={
                  visibleItemIdsByInstance.get(instance.id) ?? EMPTY_SET
                }
                saving={saving}
                onRemove={() => onRemoveInstance(instance.id)}
                onMove={(direction) => onMoveInstance(instance.id, direction)}
                onChange={onInstanceChange}
                onObservationChange={onInstanceObservationChange}
                onOtherTextChange={onInstanceOtherTextChange}
                onClear={onInstanceClear}
                onMatrixCellChange={onInstanceMatrixCellChange}
                onMatrixClear={onInstanceMatrixClear}
                onRiskChange={onInstanceRiskChange}
                onRiskClear={onInstanceRiskClear}
              />
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAdd || saving}
          onClick={() => onAddInstance(item.id)}
        >
          <Plus aria-hidden="true" />
          Adicionar repetição
        </Button>
        {!canAdd && max !== null ? (
          <p className="text-xs text-muted-foreground">
            Limite de {max} {max === 1 ? "repetição" : "repetições"} atingido.
          </p>
        ) : null}
      </div>

      {shortfall ? (
        // A shortfall is a live hint, not a field error: announce it politely
        // rather than asserting over whatever the user is typing.
        <p
          role="status"
          className="rounded-lg border border-warning/30 bg-warning/12 px-3 py-2 text-sm font-medium text-warning"
        >
          {shortfall}
        </p>
      ) : null}
    </section>
  );
}

const EMPTY_SET: Set<string> = new Set();

/** One instance: a labelled card with its own reorder/remove controls and the
 *  container's children rendered against THIS instance's answers. */
function InstanceCard({
  container,
  instance,
  index,
  total,
  imageUrls,
  errors,
  warnings,
  requiredNow,
  visibleItemIds,
  saving,
  onRemove,
  onMove,
  onChange,
  onObservationChange,
  onOtherTextChange,
  onClear,
  onMatrixCellChange,
  onMatrixClear,
  onRiskChange,
  onRiskClear,
}: {
  container: Item;
  instance: InstanceState;
  index: number;
  total: number;
  imageUrls: Record<string, string>;
  errors: Record<string, string>;
  /** FF-3 — failing `warn` rules for this instance's fields. */
  warnings?: Record<string, string>;
  /** FF-3 — keys required RIGHT NOW, keyed `${instanceId}:${itemId}`. */
  requiredNow?: Set<string>;
  visibleItemIds: Set<string>;
  saving: boolean;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  onChange: (
    instanceId: string,
    child: { id: string; questionKey: string },
    value: Json,
  ) => void;
  onObservationChange: (
    instanceId: string,
    itemId: string,
    value: string,
  ) => void;
  onOtherTextChange: (
    instanceId: string,
    child: { id: string; questionKey: string },
    value: string,
  ) => void;
  onClear: (
    instanceId: string,
    child: { id: string; questionKey: string },
  ) => void;
  onMatrixCellChange: (
    instanceId: string,
    itemId: string,
    rowCode: string,
    colCode: string,
  ) => void;
  onMatrixClear: (instanceId: string, itemId: string) => void;
  onRiskChange: (
    instanceId: string,
    itemId: string,
    selection: { severity: string; likelihood: string },
  ) => void;
  onRiskClear: (instanceId: string, itemId: string) => void;
}) {
  const headingId = `instance-${instance.id}-heading`;
  const ordinal = `${index + 1} de ${total}`;

  // One stable handler set per instance, bound to its id. Rebuilt only when the
  // container's children or a parent callback changes — never on a keystroke.
  const callbacks = useMemo<ItemCallbacks>(
    () => ({
      onChange: (child, value) => onChange(instance.id, child, value),
      onObservationChange: (itemId, value) =>
        onObservationChange(instance.id, itemId, value),
      onOtherTextChange: (child, value) =>
        onOtherTextChange(instance.id, child, value),
      onClear: (child) => onClear(instance.id, child),
      // FF-2 — bound to THIS instance's id, so a matrix in repetition 2 can
      // never write into repetition 1's grid.
      onMatrixCellChange: (itemId, rowCode, colCode) =>
        onMatrixCellChange(instance.id, itemId, rowCode, colCode),
      onMatrixClear: (itemId) => onMatrixClear(instance.id, itemId),
      onRiskChange: (itemId, selection) =>
        onRiskChange(instance.id, itemId, selection),
      onRiskClear: (itemId) => onRiskClear(instance.id, itemId),
    }),
    [
      instance.id,
      onChange,
      onObservationChange,
      onOtherTextChange,
      onClear,
      onMatrixCellChange,
      onMatrixClear,
      onRiskChange,
      onRiskClear,
    ],
  );
  const handlers = useMemo(
    () => buildItemHandlers(container.children, callbacks),
    [container.children, callbacks],
  );

  const visibleChildren = container.children.filter((child) =>
    isAnswerableItem(child.itemType) ? visibleItemIds.has(child.id) : true,
  );

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h4
          id={headingId}
          className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {container.label} {ordinal}
        </h4>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === 0 || saving}
            onClick={() => onMove("up")}
            aria-label={`Mover a repetição ${ordinal} para cima`}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === total - 1 || saving}
            onClick={() => onMove("down")}
            aria-label={`Mover a repetição ${ordinal} para baixo`}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={saving}
            onClick={onRemove}
            aria-label={`Remover a repetição ${ordinal}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {visibleChildren.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma pergunta a responder nesta repetição.
          </p>
        ) : (
          visibleChildren.map((child) => {
            const answerable = isAnswerableItem(child.itemType);
            const scalar = isInputItem(child.itemType);
            const childHandlers = handlers.get(child.id);
            const record = instance.answers[child.id];
            return (
              <BlockRenderer
                key={child.id}
                item={child}
                instanceId={instance.id}
                imageUrls={imageUrls}
                value={scalar ? record?.value : undefined}
                // Errors are keyed by instance so the SAME child can be invalid
                // in one repetition and fine in another.
                error={
                  answerable
                    ? errors[`${instance.id}:${child.id}`]
                    : undefined
                }
                warning={
                  answerable
                    ? warnings?.[`${instance.id}:${child.id}`]
                    : undefined
                }
                requiredNow={requiredNow?.has(`${instance.id}:${child.id}`)}
                onChange={childHandlers?.onChange ?? NO_OP}
                observation={scalar ? record?.observation : undefined}
                onObservationChange={childHandlers?.onObservationChange}
                otherText={scalar ? record?.otherText : undefined}
                onOtherTextChange={childHandlers?.onOtherTextChange}
                onClear={childHandlers?.onClear}
                matrixCells={instance.matrixCells?.[child.id]}
                onMatrixCellChange={childHandlers?.onMatrixCellChange}
                riskSelection={instance.riskMatrix?.[child.id]}
                onRiskChange={childHandlers?.onRiskChange}
              />
            );
          })
        )}
      </div>
    </section>
  );
}
