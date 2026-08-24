"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronDown,
  Filter,
  X,
} from "lucide-react";

import type { CaseBoardRow, ResolvedCaseOutcome } from "@/lib/queries/cases";
import { CASE_STATUSES, CASE_STATUS_META } from "@/lib/cases/case-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CaseStatusBadge, TOKEN_COLOR_VAR } from "./case-status-badge";
import {
  BUILTIN_CASE_VIEWS,
  CASE_PERIOD_PRESETS,
  CASE_PROGRESS_OPTIONS,
  DEFAULT_CASE_FILTERS,
  isPeriodRange,
  panelFilterCount,
  periodLabel,
  sameFilters,
  statusFilterLabel,
  type CaseFilterState,
  type CasePeriodRange,
  type CaseSavedView,
} from "./case-filters";

// ---------------------------------------------------------------------------
// Shared chip styling
// ---------------------------------------------------------------------------

/** The base pill: h-[30px], full radius, card surface, muted label. */
const CHIP_BASE =
  "inline-flex h-[1.875rem] shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none";

/** A drop-chip in its SET state — accent tint, so "this is filtering" reads at a glance. */
const CHIP_SET =
  "border-accent-foreground/25 bg-accent font-semibold text-accent-foreground";

/** One popover menu item. */
const POP_ITEM =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none";

const POP_ITEM_ON = "bg-accent font-medium text-accent-foreground";

const POP_CONTENT =
  "w-auto min-w-[15rem] gap-0 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-lg ring-0";

function Tick() {
  return (
    <Check
      aria-hidden="true"
      className="ml-auto size-3.5 shrink-0 text-accent-foreground"
    />
  );
}

/**
 * A chip that opens a single-select popover. `value` is the chosen value's label — its
 * presence is what switches the chip to its accent SET state and appends
 * "Nome: valor", so the row reads as a sentence of what is currently filtered.
 */
function DropChip({
  label,
  value,
  children,
  contentClassName,
}: {
  label: string;
  value: string | null;
  children: (close: () => void) => React.ReactNode;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(CHIP_BASE, value !== null && CHIP_SET)}
        aria-label={value === null ? label : `${label}: ${value}`}
      >
        {value === null ? label : `${label}: ${value}`}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(POP_CONTENT, contentClassName)}
      >
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------

/**
 * The saved-view tab strip: four built-ins plus the user's own. The ACTIVE tab is
 * resolved by deep-comparing the live filter state against each view (ignoring the
 * search query — {@link sameFilters}), never by remembering which tab was clicked: a
 * chip change must knock the tab off, and re-creating a view's filters by hand must
 * light it up again.
 *
 * When nothing matches, a "Salvar visão" tab appears in its place — the only moment
 * saving is meaningful is exactly when the current filters are not already a view.
 */
export function CaseSavedViewTabs({
  filters,
  onFiltersChange,
  userViews,
  onRemoveView,
  onRequestSave,
}: {
  filters: CaseFilterState;
  onFiltersChange: (next: CaseFilterState) => void;
  userViews: CaseSavedView[];
  onRemoveView: (id: string) => void;
  onRequestSave: () => void;
}) {
  const views = useMemo(
    () => [...BUILTIN_CASE_VIEWS, ...userViews],
    [userViews],
  );
  const activeId = views.find((v) => sameFilters(v.filters, filters))?.id ?? null;

  return (
    <div
      role="tablist"
      aria-label="Visões salvas"
      className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-muted p-[3px]"
    >
      {views.map((v) => {
        const active = activeId === v.id;
        const removable = v.id.startsWith("user:");
        return (
          <span key={v.id} className="group/tab relative inline-flex">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() =>
                onFiltersChange({ ...v.filters, q: filters.q })
              }
              className={cn(
                "inline-flex h-[1.875rem] items-center gap-1.5 rounded-lg px-3 text-xs transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                removable && "pr-6",
                active
                  ? "bg-card font-semibold text-foreground shadow-xs"
                  : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {v.name}
            </button>
            {removable && (
              <button
                type="button"
                onClick={() => onRemoveView(v.id)}
                aria-label={`Excluir visão ${v.name}`}
                /* Revealed on hover/focus, but never hidden from the keyboard: a
                   `display:none` affordance is unreachable by Tab, so it stays in the
                   tree at opacity 0 and appears on focus-visible. */
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/tab:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <X aria-hidden="true" className="size-3" strokeWidth={2.5} />
              </button>
            )}
          </span>
        );
      })}

      {activeId === null && (
        <button
          type="button"
          onClick={onRequestSave}
          className="inline-flex h-[1.875rem] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-primary transition-colors hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <Bookmark aria-hidden="true" className="size-3.5" />
          Salvar visão
        </button>
      )}
    </div>
  );
}

/** The "name this view" dialog. Enter submits; an all-whitespace name cannot save. */
export function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setName("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Salvar visão</DialogTitle>
          <DialogDescription>
            Os filtros atuais ficarão disponíveis como uma aba para acesso rápido.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="case-view-name"
            className="text-sm font-medium text-foreground"
          >
            Nome da visão
          </label>
          <Input
            id="case-view-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="ex.: Óbitos em análise"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="lg" disabled={!trimmed} onClick={submit}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Quick chip row
// ---------------------------------------------------------------------------

/**
 * The quick-filter chip row: Status, Desfecho and Período as drop-chips, the
 * "Fase atrasada" toggle, and the "Mais filtros" button that opens the advanced panel.
 *
 * Status is a DROP-CHIP (the handoff's Variant B). Its per-status counts are computed
 * over the UNFILTERED row set on purpose: the menu answers "how many cases are in each
 * status", which must not shrink as the user narrows other filters — a count that
 * changed under its own menu would make the board unnavigable.
 */
export function CaseChipRow({
  filters,
  onFiltersChange,
  rows,
  outcomes,
  onOpenPanel,
}: {
  filters: CaseFilterState;
  onFiltersChange: (next: CaseFilterState) => void;
  /** The UNFILTERED board rows — the denominator for the status counts. */
  rows: CaseBoardRow[];
  /** Distinct outcomes present on the loaded rows, label-ordered. */
  outcomes: ResolvedCaseOutcome[];
  onOpenPanel: () => void;
}) {
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.case.status, (counts.get(r.case.status) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const panelCount = panelFilterCount(filters);
  const outcomeValue =
    filters.outcome === null
      ? null
      : filters.outcome === "sem"
        ? "Sem desfecho"
        : (outcomes.find((o) => o.id === filters.outcome)?.label ?? null);

  const customRange: CasePeriodRange = isPeriodRange(filters.period)
    ? filters.period
    : {};

  return (
    <div
      role="group"
      aria-label="Filtros rápidos"
      className="flex flex-wrap items-center gap-1.5"
    >
      {/* Status */}
      <DropChip
        label="Status"
        value={filters.status === "todos" ? null : statusFilterLabel(filters.status)}
      >
        {(close) => (
          <>
            <button
              type="button"
              className={cn(POP_ITEM, filters.status === "todos" && POP_ITEM_ON)}
              onClick={() => {
                onFiltersChange({ ...filters, status: "todos" });
                close();
              }}
            >
              Todos os status
              <span
                className={cn(
                  "ml-auto text-xs tabular-nums",
                  filters.status === "todos"
                    ? "text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                {rows.length}
              </span>
              {filters.status === "todos" && <Tick />}
            </button>
            <div aria-hidden="true" className="my-1 h-px bg-border" />
            {CASE_STATUSES.map((s) => {
              const meta = CASE_STATUS_META[s];
              const on = filters.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  className={cn(POP_ITEM, on && POP_ITEM_ON)}
                  onClick={() => {
                    onFiltersChange({ ...filters, status: s });
                    close();
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="size-[7px] shrink-0 rounded-full"
                    style={{ backgroundColor: TOKEN_COLOR_VAR[meta.colorToken] }}
                  />
                  {meta.label}
                  <span
                    className={cn(
                      "ml-auto text-xs tabular-nums",
                      on ? "text-accent-foreground" : "text-muted-foreground",
                    )}
                  >
                    {statusCounts.get(s) ?? 0}
                  </span>
                  {on && <Tick />}
                </button>
              );
            })}
          </>
        )}
      </DropChip>

      {/* Desfecho — only when the commission's cases actually carry outcomes. */}
      {outcomes.length > 0 && (
        <DropChip label="Desfecho" value={outcomeValue}>
          {(close) => (
            <>
              <button
                type="button"
                className={cn(POP_ITEM, filters.outcome === null && POP_ITEM_ON)}
                onClick={() => {
                  onFiltersChange({ ...filters, outcome: null });
                  close();
                }}
              >
                Todos os desfechos
                {filters.outcome === null && <Tick />}
              </button>
              <button
                type="button"
                className={cn(POP_ITEM, filters.outcome === "sem" && POP_ITEM_ON)}
                onClick={() => {
                  onFiltersChange({ ...filters, outcome: "sem" });
                  close();
                }}
              >
                Sem desfecho
                {filters.outcome === "sem" && <Tick />}
              </button>
              <div aria-hidden="true" className="my-1 h-px bg-border" />
              {outcomes.map((o) => {
                const on = filters.outcome === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={cn(POP_ITEM, on && POP_ITEM_ON)}
                    onClick={() => {
                      onFiltersChange({ ...filters, outcome: o.id });
                      close();
                    }}
                  >
                    <CaseStatusBadge label={o.label} colorToken={o.colorToken} />
                    {on && <Tick />}
                  </button>
                );
              })}
            </>
          )}
        </DropChip>
      )}

      {/* Período */}
      <DropChip
        label="Período"
        value={periodLabel(filters.period)}
        contentClassName="min-w-[16rem]"
      >
        {(close) => (
          <>
            <button
              type="button"
              className={cn(POP_ITEM, filters.period === "all" && POP_ITEM_ON)}
              onClick={() => {
                onFiltersChange({ ...filters, period: "all" });
                close();
              }}
            >
              Qualquer data
              {filters.period === "all" && <Tick />}
            </button>
            {CASE_PERIOD_PRESETS.map((p) => {
              const on = filters.period === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  className={cn(POP_ITEM, on && POP_ITEM_ON)}
                  onClick={() => {
                    onFiltersChange({ ...filters, period: p.value });
                    close();
                  }}
                >
                  {p.label}
                  {on && <Tick />}
                </button>
              );
            })}
            <div aria-hidden="true" className="my-1 h-px bg-border" />
            <p className="px-2.5 pt-1.5 pb-1 text-[0.65rem] font-semibold tracking-[0.07em] text-muted-foreground uppercase">
              Intervalo personalizado
            </p>
            <div className="flex gap-1.5 px-2.5 pt-1 pb-1.5">
              <input
                type="date"
                aria-label="De"
                value={customRange.from ?? ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    period: { ...customRange, from: e.target.value || undefined },
                  })
                }
                className="h-8 w-full min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              />
              <input
                type="date"
                aria-label="Até"
                value={customRange.to ?? ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    period: { ...customRange, to: e.target.value || undefined },
                  })
                }
                className="h-8 w-full min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              />
            </div>
          </>
        )}
      </DropChip>

      {/* Fase atrasada */}
      <button
        type="button"
        aria-pressed={filters.overdue}
        onClick={() =>
          onFiltersChange({ ...filters, overdue: !filters.overdue })
        }
        className={cn(
          CHIP_BASE,
          filters.overdue &&
            "border-destructive/35 bg-destructive/8 font-semibold text-destructive hover:text-destructive",
        )}
      >
        <AlertTriangle aria-hidden="true" className="size-3.5" />
        Fase atrasada
      </button>

      {/* Mais filtros */}
      <button
        type="button"
        onClick={onOpenPanel}
        className={cn(
          CHIP_BASE,
          "ml-auto",
          panelCount > 0 && "border-primary/40 font-semibold text-primary",
        )}
      >
        <Filter aria-hidden="true" className="size-3.5" />
        Mais filtros
        {panelCount > 0 && (
          <span className="inline-grid h-[1.0625rem] min-w-[1.0625rem] place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground tabular-nums">
            {panelCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active-filters summary
// ---------------------------------------------------------------------------

/** One removable summary chip: a category, its value, and an × that clears just it. */
interface ActiveFilterChip {
  key: string;
  category: string;
  value: string | null;
  clear: () => void;
}

/**
 * The active-filters summary bar. Every constraint currently narrowing the board is
 * listed as its own removable chip — including each selected value of a multi group
 * separately, so "why am I seeing only 3 cases" is answerable by reading one row
 * rather than by opening the panel and three popovers.
 *
 * The search query is deliberately NOT listed: it is visible in its own box, and
 * "Limpar tudo" preserves it for the same reason.
 */
export function CaseActiveFilters({
  filters,
  onFiltersChange,
  outcomes,
  typeNameById,
  tagNameById,
}: {
  filters: CaseFilterState;
  onFiltersChange: (next: CaseFilterState) => void;
  outcomes: ResolvedCaseOutcome[];
  typeNameById: Map<string, string>;
  tagNameById: Map<string, string>;
}) {
  const set = (patch: Partial<CaseFilterState>) => () =>
    onFiltersChange({ ...filters, ...patch });

  const chips: ActiveFilterChip[] = [];

  if (filters.status !== "todos") {
    chips.push({
      key: "status",
      category: "Status",
      value: statusFilterLabel(filters.status),
      clear: set({ status: "todos" }),
    });
  }
  if (filters.outcome !== null) {
    chips.push({
      key: "outcome",
      category: "Desfecho",
      value:
        filters.outcome === "sem"
          ? "Sem desfecho"
          : (outcomes.find((o) => o.id === filters.outcome)?.label ??
            "Desconhecido"),
      clear: set({ outcome: null }),
    });
  }
  const period = periodLabel(filters.period);
  if (period !== null) {
    chips.push({
      key: "period",
      category: "Período",
      value: period,
      clear: set({ period: "all" }),
    });
  }
  if (filters.overdue) {
    chips.push({
      key: "overdue",
      category: "Fase atrasada",
      value: null,
      clear: set({ overdue: false }),
    });
  }
  for (const name of filters.resp) {
    chips.push({
      key: `resp:${name}`,
      category: "Resp.",
      value: name,
      clear: () =>
        onFiltersChange({
          ...filters,
          resp: filters.resp.filter((x) => x !== name),
        }),
    });
  }
  for (const id of filters.types) {
    chips.push({
      key: `type:${id}`,
      category: "Tipo",
      value: typeNameById.get(id) ?? "Desconhecido",
      clear: () =>
        onFiltersChange({
          ...filters,
          types: filters.types.filter((x) => x !== id),
        }),
    });
  }
  for (const id of filters.tags) {
    chips.push({
      key: `tag:${id}`,
      category: "Etiqueta",
      value: tagNameById.get(id) ?? "Desconhecida",
      clear: () =>
        onFiltersChange({
          ...filters,
          tags: filters.tags.filter((x) => x !== id),
        }),
    });
  }
  for (const name of filters.depts) {
    chips.push({
      key: `dept:${name}`,
      category: "Setor",
      value: name,
      clear: () =>
        onFiltersChange({
          ...filters,
          depts: filters.depts.filter((x) => x !== name),
        }),
    });
  }
  if (filters.semResp) {
    chips.push({
      key: "semResp",
      category: "Sem responsável",
      value: null,
      clear: set({ semResp: false }),
    });
  }
  if (filters.adverseOnly) {
    chips.push({
      key: "adverseOnly",
      category: "Apenas adversos",
      value: null,
      clear: set({ adverseOnly: false }),
    });
  }
  if (filters.progress !== "any") {
    chips.push({
      key: "progress",
      category: "Progresso",
      value:
        CASE_PROGRESS_OPTIONS.find((o) => o.value === filters.progress)?.label ??
        null,
      clear: set({ progress: "any" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="animate-rise-in flex flex-wrap items-center gap-1.5 rounded-xl border border-accent-foreground/14 bg-accent px-3 py-2.5">
      <span className="mr-0.5 text-[0.72rem] font-semibold text-accent-foreground">
        {chips.length === 1
          ? "1 filtro ativo"
          : `${chips.length} filtros ativos`}
      </span>
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex h-6 items-center gap-1.5 rounded-full border border-accent-foreground/18 bg-card py-0 pr-1 pl-2.5 text-[0.72rem] font-medium text-foreground"
        >
          <span>
            <b className="font-semibold text-accent-foreground">{c.category}</b>
            {c.value !== null && ` · ${c.value}`}
          </span>
          <button
            type="button"
            onClick={c.clear}
            aria-label={`Remover filtro ${c.category}${c.value !== null ? `: ${c.value}` : ""}`}
            className="grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-3" strokeWidth={2.4} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onFiltersChange({ ...DEFAULT_CASE_FILTERS, q: filters.q })}
        className="ml-auto rounded text-xs font-semibold text-accent-foreground transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        Limpar tudo
      </button>
    </div>
  );
}
