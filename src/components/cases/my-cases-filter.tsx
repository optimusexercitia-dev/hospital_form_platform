"use client";

import { useMemo, useState } from "react";
import { Briefcase } from "lucide-react";

import type { MyCase } from "@/lib/queries/cases";
import { cn } from "@/lib/utils";
import { MyCaseCard } from "@/components/cases/my-case-card";

/**
 * Client-side filter for "Meus Casos" (F4). Two INDEPENDENTLY toggleable chips
 * over the caller's own accessible cases:
 *
 *  - "Abertos" — hide terminal cases (`concluido` / `cancelado`).
 *  - "Minhas atribuições em aberto" — keep only cases with ≥1 personally
 *    attributed item still open (a phase that is neither `concluida` nor
 *    `nao_necessaria`, or a narrative that is not `concluida`). `items[]` already
 *    holds ONLY the viewer's attributed phases/narratives (query-scoped), so this
 *    is a pure client predicate — no extra data.
 *
 * Both OFF by default (all cases shown). When both ON a case must satisfy BOTH.
 * Chips are `aria-pressed` toggle buttons — keyboard-operable with a visible
 * focus ring, per the design system.
 */

/** A case is "open" when it is not in a terminal status. */
function isOpenCase(myCase: MyCase): boolean {
  return myCase.status !== "concluido" && myCase.status !== "cancelado";
}

/** True when the viewer has ≥1 attributed item that is still open. */
function hasOpenAssignment(myCase: MyCase): boolean {
  return myCase.items.some((item) =>
    item.kind === "phase"
      ? item.status !== "concluida" && item.status !== "nao_necessaria"
      : item.status !== "concluida",
  );
}

export function MyCasesFilter({
  org,
  slug,
  cases,
}: {
  org: string;
  slug: string;
  cases: MyCase[];
}) {
  const [openOnly, setOpenOnly] = useState(false);
  const [myAssignmentsOnly, setMyAssignmentsOnly] = useState(false);

  const filtered = useMemo(
    () =>
      cases.filter(
        (myCase) =>
          (!openOnly || isOpenCase(myCase)) &&
          (!myAssignmentsOnly || hasOpenAssignment(myCase)),
      ),
    [cases, openOnly, myAssignmentsOnly],
  );

  return (
    <section aria-label="Casos acessíveis" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filtrar casos"
          className="flex flex-wrap items-center gap-2"
        >
          <FilterChip
            pressed={openOnly}
            onToggle={() => setOpenOnly((v) => !v)}
          >
            Abertos
          </FilterChip>
          <FilterChip
            pressed={myAssignmentsOnly}
            onToggle={() => setMyAssignmentsOnly((v) => !v)}
          >
            Minhas atribuições em aberto
          </FilterChip>
        </div>
        <p
          aria-live="polite"
          className="text-sm text-muted-foreground tabular-nums"
        >
          {filtered.length}{" "}
          {filtered.length === 1 ? "caso" : "casos"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyFilterState />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((myCase, index) => (
            <MyCaseCard
              key={myCase.caseId}
              org={org}
              slug={slug}
              myCase={myCase}
              index={index}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FilterChip({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        pressed
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyFilterState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent/60 text-accent-foreground">
        <Briefcase aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Nenhum caso corresponde ao filtro</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Ajuste ou remova os filtros para ver seus casos novamente.
      </p>
    </div>
  );
}
