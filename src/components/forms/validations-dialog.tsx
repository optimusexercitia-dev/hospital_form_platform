"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import type { Item, Section } from "@/lib/queries/forms";
import { setItemValidations } from "@/lib/forms/actions";
import {
  datetimeOrderTargets,
  toRuleDrafts,
  toRulePayload,
  validateRuleDrafts,
  type RuleDraft,
  type RuleDraftProblem,
} from "@/components/forms/validation-drafts";
import { ValidationRulesEditor } from "@/components/forms/validation-rules-editor";
import { useBuilderAction } from "@/components/forms/use-builder-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * FF-3 (ADR 0090) — the "Regras de validação" editor, and the ONLY place
 * `form_item_validations` is written.
 *
 * Separate from {@link ItemEditorDialog} for the same two contract reasons
 * {@link MatrixConfigDialog} is:
 *
 *  1. `setItemValidations` is an object-argument action keyed on an EXISTING
 *     `form_items.id`, which the item editor's "add" mode does not have yet.
 *  2. It is **REPLACE, wholesale**: the payload is the complete desired list and
 *     an omitted rule is DELETED. Unlike matrix axes there is not even a `code`
 *     to match on — a rule has no author-visible identity — so the only safe
 *     shape is one piece of state owning the entire list, which is what this
 *     dialog is. A patch-shaped send would silently drop every rule it omitted.
 *
 * That second point is also why the drafts are seeded from `item.validations`
 * and the dialog refuses to open against an item whose rules were never loaded:
 * saving a list you could not read back is data loss by construction.
 */
export function ValidationsDialog({
  open,
  onOpenChange,
  item,
  sections,
  parentItemType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item;
  sections: Section[];
  parentItemType: string | null;
}) {
  const { run, isPending, error: actionError, clearError } = useBuilderAction();

  const [drafts, setDrafts] = useState<RuleDraft[]>(() =>
    toRuleDrafts(item.validations),
  );
  // m-5b — the PROBLEM, not just its sentence: the index is what lets the editor
  // put the message inside the offending rule's card instead of leaving a screen-
  // reader user to hunt for "Regra 2".
  const [validation, setValidation] = useState<RuleDraftProblem | null>(null);

  const datetimeTargets = useMemo(
    () => datetimeOrderTargets(sections, item.id),
    [sections, item.id],
  );

  // How many persisted rules this save would delete. Surfaced because REPLACE
  // makes removal silent otherwise: the author sees a shorter list, not a
  // destructive operation.
  const persistedCount = item.validations?.length ?? 0;
  const removedCount = Math.max(0, persistedCount - drafts.length);

  function handleSave() {
    clearError();
    const problem = validateRuleDrafts(drafts);
    setValidation(problem);
    if (problem) return;
    run(
      () =>
        setItemValidations({
          itemId: item.id,
          // The COMPLETE desired list, every time — never a patch.
          rules: toRulePayload(drafts),
        }),
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>Regras de validação</DialogTitle>
          <DialogDescription>
            Conferem a resposta no envio. Um <strong>erro</strong> impede o
            envio; um <strong>aviso</strong> apenas sinaliza. A ordem das regras
            é a ordem em que as mensagens aparecem.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {actionError ? <FormBanner tone="error">{actionError}</FormBanner> : null}
          {validation ? (
            <FormBanner tone="error">{validation.message}</FormBanner>
          ) : null}

          <ValidationRulesEditor
            drafts={drafts}
            onChange={setDrafts}
            itemType={item.itemType}
            parentItemType={parentItemType}
            datetimeTargets={datetimeTargets}
            problem={validation}
            disabled={isPending}
          />

          {removedCount > 0 ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2 text-sm text-warning"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="text-pretty">
                Ao salvar,{" "}
                {removedCount === 1
                  ? "1 regra será removida"
                  : `${removedCount} regras serão removidas`}{" "}
                desta versão.
              </span>
            </p>
          ) : null}
        </div>

        <DialogFooter className="items-center gap-3 border-t border-border px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" size="lg" onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar regras"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
