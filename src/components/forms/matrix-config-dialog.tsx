"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import type { Item, MatrixAxisEntry } from "@/lib/queries/forms";
import {
  type AxisDraft,
  toAxisDrafts,
  toAxisPayload,
  validateAxes,
} from "@/lib/forms/matrix";
import { upsertMatrixAxes } from "@/lib/forms/actions";
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
import { MatrixAxesEditor } from "@/components/forms/matrix-axes-editor";
import { useBuilderAction } from "@/components/forms/use-builder-action";
import { MatrixGrid } from "@/components/responses/wizard/matrix-grid";
import { RiskMatrixPicker } from "@/components/responses/wizard/risk-matrix-picker";

/**
 * FF-2 (ADR 0089) — the "linhas e colunas" editor for a `matrix` /
 * `risk_matrix`, and the ONLY place the axes are written.
 *
 * Separate from {@link ItemEditorDialog} on purpose, for two reasons that are
 * about the contract rather than about layout:
 *
 *  1. The axes are persisted by `upsertMatrixAxes`, an object-argument action
 *     keyed on an EXISTING `form_items.id`. In the item editor's "add" mode that
 *     id does not exist yet, so the axes could not ride the same submit even if
 *     the fields lived there.
 *  2. `upsertMatrixAxes` is **REPLACE, keyed on `code`, per axis**: an entry
 *     whose code is absent from the payload is DELETED. That only stays safe if
 *     the dialog always sends the COMPLETE desired axis, which it can only
 *     guarantee by owning the whole axis in one piece of state — a
 *     partial/patch-shaped send would silently delete the entries it omitted.
 *
 * The item's own fields (enunciado, obrigatória, condição and — for a
 * `risk_matrix` — `config.riskBands`) stay in the item editor, where every other
 * `form_items` column is authored. Weights live on the AXES because a weight is
 * a property of a severity/likelihood level, so they are here.
 *
 * A live, read-only preview renders through the SAME components the wizard uses,
 * so what the author sees is what the filler gets — including the derived score
 * grid of a risk matrix, which is the only way to sanity-check a set of weights.
 */
export function MatrixConfigDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item;
}) {
  const isRisk = item.itemType === "risk_matrix";
  const { run, isPending, error: actionError, clearError } = useBuilderAction();

  // Seeded from the persisted axes each time the dialog is (re)opened — keyed on
  // the item's current axes so a refresh after a save re-seeds cleanly.
  const [rows, setRows] = useState<AxisDraft[]>(() =>
    toAxisDrafts(item.matrixRows),
  );
  const [columns, setColumns] = useState<AxisDraft[]>(() =>
    toAxisDrafts(item.matrixColumns),
  );
  const [validation, setValidation] = useState<string | null>(null);

  // Persisted codes that this edit would DELETE. Surfaced explicitly because
  // removal is the one axis edit that is not reversible in effect: the code is
  // the cross-version aggregation key, so a removed row stops appearing in the
  // dashboard's series from this version onward.
  const removed = useMemo(() => {
    const kept = new Set([...rows, ...columns].map((entry) => entry.code));
    return [...(item.matrixRows ?? []), ...(item.matrixColumns ?? [])]
      .filter((entry) => !kept.has(entry.code))
      .map((entry) => entry.label);
  }, [rows, columns, item.matrixRows, item.matrixColumns]);

  // The preview item: the DRAFT axes, so the grid reflects what is on screen
  // rather than what is saved. Ids are the client row keys — the preview never
  // addresses a row by id, only by code.
  const previewItem = useMemo<Item>(
    () => ({
      ...item,
      matrixRows: toPreviewEntries(rows),
      matrixColumns: toPreviewEntries(columns),
    }),
    [item, rows, columns],
  );

  function handleSave() {
    clearError();
    const problem = validateAxes(rows, columns, isRisk);
    setValidation(problem);
    if (problem) return;
    run(
      () =>
        upsertMatrixAxes({
          itemId: item.id,
          // The COMPLETE desired axis, every time — never a patch.
          rows: toAxisPayload(rows, isRisk),
          columns: toAxisPayload(columns, isRisk),
        }),
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>
            {isRisk ? "Severidade e probabilidade" : "Linhas e colunas"}
          </DialogTitle>
          <DialogDescription>
            {isRisk
              ? "Defina os níveis de severidade e de probabilidade e o peso de cada um. A pontuação de risco é o produto dos dois pesos."
              : "Defina os critérios avaliados (linhas) e a escala de resposta (colunas). Cada linha recebe uma única coluna."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {actionError ? <FormBanner tone="error">{actionError}</FormBanner> : null}
          {validation ? <FormBanner tone="error">{validation}</FormBanner> : null}

          <div className="grid gap-6 md:grid-cols-2">
            <MatrixAxesEditor
              legend={isRisk ? "Severidade (linhas)" : "Linhas (critérios)"}
              description={
                isRisk
                  ? "Do menos ao mais grave. O peso não precisa ser 1, 2, 3 — escalas 1/3/9 são comuns."
                  : "Cada linha é um critério avaliado."
              }
              entries={rows}
              onChange={setRows}
              weighted={isRisk}
              addLabel={isRisk ? "Adicionar severidade" : "Adicionar linha"}
              singular="linha"
              placeholder={isRisk ? "Ex.: Grave" : "Ex.: Higienização das mãos"}
              disabled={isPending}
            />
            <MatrixAxesEditor
              legend={isRisk ? "Probabilidade (colunas)" : "Colunas (escala)"}
              description={
                isRisk
                  ? "Da menos à mais provável, com o peso de cada nível."
                  : "A mesma escala vale para todas as linhas."
              }
              entries={columns}
              onChange={setColumns}
              weighted={isRisk}
              addLabel={isRisk ? "Adicionar probabilidade" : "Adicionar coluna"}
              singular="coluna"
              placeholder={isRisk ? "Ex.: Provável" : "Ex.: Conforme"}
              disabled={isPending}
            />
          </div>

          {/* Codes are immutable (ruling 4): relabelling is always free, and the
              only way to fix a wrong code is to remove the entry and add it
              again — which this dialog does in a single call. */}
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-pretty">
            Renomear um rótulo é sempre seguro: o código de cada linha e coluna é
            fixo e é ele que liga as respostas aos painéis. Para corrigir um
            código, remova a entrada e adicione outra.
          </p>

          {removed.length > 0 ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2 text-sm text-warning"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="text-pretty">
                Ao salvar, {removed.length === 1 ? "a entrada" : "as entradas"}{" "}
                <strong>{removed.join(", ")}</strong>{" "}
                {removed.length === 1 ? "será removida" : "serão removidas"}{" "}
                desta versão e {removed.length === 1 ? "deixará" : "deixarão"} de
                aparecer nos painéis a partir dela.
              </span>
            </p>
          ) : null}

          <section aria-label="Pré-visualização" className="flex flex-col gap-2">
            <span className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
              Pré-visualização
            </span>
            {isRisk ? (
              <RiskMatrixPicker
                item={previewItem}
                selection={undefined}
                onChange={NO_OP_RISK}
                readOnly
              />
            ) : (
              <MatrixGrid
                item={previewItem}
                cells={undefined}
                onChange={NO_OP_CELL}
                readOnly
              />
            )}
          </section>
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
            {isPending ? "Salvando…" : "Salvar matriz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Draft entries as the preview's read-only axis rows (positions by index). */
function toPreviewEntries(entries: AxisDraft[]): MatrixAxisEntry[] {
  return entries
    .filter((entry) => entry.label.trim() !== "")
    .map((entry, index) => ({
      id: entry.key,
      code: entry.code || entry.key,
      label: entry.label.trim(),
      weight: entry.weight,
      position: index,
    }));
}

// Stable no-ops for the read-only preview (the grids require the handler prop).
const NO_OP_CELL: (rowCode: string, colCode: string) => void = () => {};
const NO_OP_RISK: (next: { severity: string; likelihood: string }) => void =
  () => {};
