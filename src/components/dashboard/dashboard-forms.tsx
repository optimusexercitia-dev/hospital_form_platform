"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { FormDashboard } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

import { DashboardCharts } from "./dashboard-charts";
import { DashboardFilters } from "./dashboard-filters";

/**
 * Client shell for the per-form dashboard (F1–F3): the URL-driven form picker,
 * the date-range filter + CSV export (F3), and the section-grouped charts (F2).
 * The Server Component (`dashboard/page.tsx`) loads the data and passes it as
 * plain props; this component manages the `?form=` selection by pushing to the
 * URL so the server re-queries — no client data fetching, no value-import of the
 * server-only query module.
 */
export function DashboardForms({
  slug,
  forms,
  selectedFormId,
  range,
  dashboard,
}: {
  slug: string;
  forms: { formId: string; title: string; totalSubmitted: number }[];
  selectedFormId: string | null;
  range: { from: string | null; to: string | null };
  dashboard: FormDashboard | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Preserve any existing range params when switching forms.
  function selectForm(formId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("form", formId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-8">
      <FormPicker
        forms={forms}
        selectedFormId={selectedFormId}
        onSelect={selectForm}
      />

      <DashboardFilters
        slug={slug}
        selectedFormId={selectedFormId}
        from={range.from}
        to={range.to}
      />

      {dashboard ? (
        <DashboardBody dashboard={dashboard} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Selecione um formulário para ver as estatísticas.
        </p>
      )}
    </div>
  );
}

/**
 * Form selector — a horizontal, keyboard-operable tab list. Each form shows its
 * submitted-response count. URL-driven (`?form=`).
 */
function FormPicker({
  forms,
  selectedFormId,
  onSelect,
}: {
  forms: { formId: string; title: string; totalSubmitted: number }[];
  selectedFormId: string | null;
  onSelect: (formId: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Formulários"
      className="flex flex-wrap gap-2"
    >
      {forms.map((form) => {
        const isActive = form.formId === selectedFormId;
        return (
          <button
            key={form.formId}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(form.formId)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              isActive
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-card text-foreground/80 hover:bg-muted hover:text-foreground",
            )}
          >
            {form.title}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {form.totalSubmitted}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The dashboard body for one form: the headline count plus the section-grouped
 * charts and free-text samples (F2).
 */
function DashboardBody({ dashboard }: { dashboard: FormDashboard }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl tabular-nums">
          {dashboard.totalSubmitted}
        </span>
        <span className="text-sm text-muted-foreground">
          {dashboard.totalSubmitted === 1
            ? "resposta enviada"
            : "respostas enviadas"}
        </span>
      </div>

      <DashboardCharts dashboard={dashboard} />
    </div>
  );
}
