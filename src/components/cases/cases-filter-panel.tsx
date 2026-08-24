"use client";

import { useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Check, X } from "lucide-react";

import type { CaseBoardRow } from "@/lib/queries/cases";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/text";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CASE_PROGRESS_OPTIONS,
  DEFAULT_CASE_FILTERS,
  matchesCaseFilters,
  type CaseFilterContext,
  type CaseFilterState,
} from "./case-filters";

/** One option of a multi-select section: a stable value + its display label. */
export interface FilterOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Section primitives
// ---------------------------------------------------------------------------

function Section({
  title,
  onClear,
  children,
}: {
  title: string;
  /** Rendered as a "Limpar" micro-link; omit when the section has no selection. */
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-b border-border/70 py-3.5 last:border-b-0">
      <legend className="sr-only">{title}</legend>
      <div className="mb-2 flex items-center justify-between">
        <span
          aria-hidden="true"
          className="text-[0.68rem] font-semibold tracking-[0.07em] text-muted-foreground uppercase"
        >
          {title}
        </span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded text-[0.68rem] font-medium text-primary transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            Limpar
          </button>
        )}
      </div>
      {children}
    </fieldset>
  );
}

/**
 * A multi-select checkbox list with a per-option count of MATCHING CASES.
 *
 * The count is computed over the UNFILTERED rows for that option alone — it answers
 * "how many cases would this option reach", which is what makes it useful for picking.
 * It deliberately does NOT respond to the rest of the draft (a count that collapsed to
 * 0 as you selected siblings would read as "this option is empty" when the truth is
 * "no case matches both"), and the footer's live preview is what reports the
 * intersection.
 *
 * Hand-rolled from a native `<input type="checkbox">` rather than the Radix `Checkbox`:
 * the whole row (checkbox + label + count) is one click target, and a native input
 * inside a `<label>` gives that for free with correct keyboard + AT semantics.
 */
function CheckboxList({
  title,
  options,
  selected,
  onChange,
  countOf,
}: {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  countOf: (value: string) => number;
}) {
  if (options.length === 0) return null;
  return (
    <Section
      title={title}
      onClear={selected.length > 0 ? () => onChange([]) : undefined}
    >
      <div className="flex flex-col">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((v) => v !== o.value)
                      : [...selected, o.value],
                  )
                }
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-transparent",
                )}
              >
                <Check className="size-2.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <span className="shrink-0 text-[0.72rem] text-muted-foreground tabular-nums">
                {countOf(o.value)}
              </span>
            </label>
          );
        })}
      </div>
    </Section>
  );
}

/** A toggle chip used by the Etiquetas (multi) and Progresso (single) sections. */
function ToggleChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        on
          ? "border-accent-foreground/30 bg-accent font-semibold text-accent-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** A row whose whole surface toggles a boolean, with the switch as its affordance. */
function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40">
      <span className="min-w-0 flex-1">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

/**
 * The advanced filter panel — a right-hand sheet over the board.
 *
 * It edits a DRAFT copy and commits only on "Aplicar filtros". Six sections at once is
 * too much to apply live: each intermediate state would re-render the board and, worse,
 * would leave the user filtered by a half-built selection if they closed the sheet. The
 * footer's live preview count is what replaces the immediate feedback.
 *
 * Built on Radix Dialog rather than a hand-rolled overlay so focus trapping, Esc,
 * outside-click dismissal, scroll lock and focus RESTORATION all come from the same
 * primitive the app's other modals use.
 *
 * Option lists are derived from the LOADED BOARD ROWS (not from the full vocabulary):
 * the panel filters what is on the board, so an option matching zero rows could only
 * ever produce an empty board. Every option shown therefore has a count ≥ 1.
 */
export function CasesFilterPanel({
  open,
  onOpenChange,
  filters,
  onApply,
  rows,
  filterContext,
  caseTypeNameById,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CaseFilterState;
  onApply: (next: CaseFilterState) => void;
  /** The UNFILTERED board rows — option lists, per-option counts and the preview. */
  rows: CaseBoardRow[];
  filterContext: CaseFilterContext;
  /** Case-type id → display name, for the "Tipo de caso" labels. */
  caseTypeNameById: Map<string, string>;
}) {
  const [draft, setDraft] = useState<CaseFilterState>(filters);

  // Re-seed the draft each time the sheet opens, so it always starts from what is
  // actually applied — a cancelled edit must not linger into the next open.
  const [seededFor, setSeededFor] = useState(open);
  if (open !== seededFor) {
    setSeededFor(open);
    if (open) setDraft(filters);
  }

  const options = useMemo(() => {
    const resp = new Set<string>();
    const types = new Map<string, string>();
    const tags = new Map<string, string>();
    const depts = new Set<string>();
    for (const row of rows) {
      for (const p of row.phases) if (p.assigneeName) resp.add(p.assigneeName);
      const typeId = row.case.caseTypeId;
      if (typeId && caseTypeNameById.has(typeId)) {
        types.set(typeId, caseTypeNameById.get(typeId)!);
      }
      for (const t of row.tags) tags.set(t.id, t.name);
      if (row.case.departmentName) depts.add(row.case.departmentName);
    }
    const byLabel = (a: FilterOption, b: FilterOption) =>
      a.label.localeCompare(b.label, "pt-BR");
    return {
      resp: [...resp].map((v) => ({ value: v, label: v })).sort(byLabel),
      types: [...types].map(([value, label]) => ({ value, label })).sort(byLabel),
      tags: [...tags].map(([value, label]) => ({ value, label })).sort(byLabel),
      depts: [...depts].map((v) => ({ value: v, label: v })).sort(byLabel),
    };
  }, [rows, caseTypeNameById]);

  const countWhere = (predicate: (row: CaseBoardRow) => boolean) =>
    rows.reduce((n, row) => (predicate(row) ? n + 1 : n), 0);

  const preview = rows.filter((r) =>
    matchesCaseFilters(r, draft, filterContext),
  ).length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[23.75rem] max-w-[92vw] flex-col border-l border-border bg-card text-card-foreground shadow-xl",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="flex-1 font-display text-base font-semibold">
              Filtros avançados
            </DialogPrimitive.Title>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setDraft({
                  // "Limpar" resets only what THIS panel owns; the chip-row filters
                  // (status/desfecho/período/atrasada) stay, because clearing a
                  // control the user cannot see from here is not a clear, it is a loss.
                  ...draft,
                  resp: [],
                  types: [],
                  tags: [],
                  depts: [],
                  semResp: false,
                  adverseOnly: false,
                  progress: DEFAULT_CASE_FILTERS.progress,
                })
              }
            >
              Limpar
            </Button>
            <DialogPrimitive.Close
              aria-label="Fechar"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <X aria-hidden="true" className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pt-1 pb-5">
            <CheckboxList
              title="Responsável"
              options={options.resp}
              selected={draft.resp}
              onChange={(resp) => setDraft({ ...draft, resp })}
              countOf={(name) =>
                countWhere((r) => r.phases.some((p) => p.assigneeName === name))
              }
            />

            <CheckboxList
              title="Tipo de caso"
              options={options.types}
              selected={draft.types}
              onChange={(types) => setDraft({ ...draft, types })}
              countOf={(id) => countWhere((r) => r.case.caseTypeId === id)}
            />

            {options.tags.length > 0 && (
              <Section
                title="Etiquetas"
                onClear={
                  draft.tags.length > 0
                    ? () => setDraft({ ...draft, tags: [] })
                    : undefined
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  {options.tags.map((t) => {
                    const on = draft.tags.includes(t.value);
                    return (
                      <ToggleChip
                        key={t.value}
                        on={on}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            tags: on
                              ? draft.tags.filter((x) => x !== t.value)
                              : [...draft.tags, t.value],
                          })
                        }
                      >
                        {t.label}
                      </ToggleChip>
                    );
                  })}
                </div>
              </Section>
            )}

            <CheckboxList
              title="Unidade / setor"
              options={options.depts}
              selected={draft.depts}
              onChange={(depts) => setDraft({ ...draft, depts })}
              countOf={(name) =>
                countWhere((r) => r.case.departmentName === name)
              }
            />

            <Section title="Progresso das fases">
              <div className="flex flex-wrap gap-1.5">
                {CASE_PROGRESS_OPTIONS.map((o) => (
                  <ToggleChip
                    key={o.value}
                    on={draft.progress === o.value}
                    onClick={() => setDraft({ ...draft, progress: o.value })}
                  >
                    {o.label}
                  </ToggleChip>
                ))}
              </div>
            </Section>

            <Section title="Outros">
              <div className="flex flex-col">
                <SwitchRow
                  label="Sem responsável"
                  checked={draft.semResp}
                  onChange={(semResp) => setDraft({ ...draft, semResp })}
                />
                <SwitchRow
                  label="Apenas desfechos adversos"
                  checked={draft.adverseOnly}
                  onChange={(adverseOnly) => setDraft({ ...draft, adverseOnly })}
                />
              </div>
            </Section>
          </div>

          <div className="flex items-center gap-2.5 border-t border-border px-5 py-3.5">
            {/* `aria-live` WITHOUT `role="status"` on purpose: the board's own count
                line is the page's single `status` landmark, and a second one would
                make "the count" ambiguous to both AT and the specs that query it. */}
            <span
              aria-live="polite"
              className="flex-1 text-xs text-muted-foreground tabular-nums"
            >
              {preview} {plural(preview, "caso", "casos")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              onClick={() => {
                onApply(draft);
                onOpenChange(false);
              }}
            >
              Aplicar filtros
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
