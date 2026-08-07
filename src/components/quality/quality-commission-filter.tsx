"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** One selectable commission, plus the two counts its chip shows. */
export interface QualityFilterCommission {
  commissionId: string;
  commissionName: string;
  totalCases: number;
  lockedCases: number;
}

/**
 * Commission scope chips for the oversight board. Selection is client-side over
 * already-loaded rows (the board never re-fetches on a chip press) and mirrored
 * into `?comissao=` with `history.replaceState` — the same idiom as `CasesView`'s
 * view toggle: shareable and refresh-surviving without a server round-trip.
 *
 * ⚠ THE `· N restritos` SUFFIX IS THE FULL EXTENT OF PER-COMMISSION LOCKED
 * AWARENESS (ADR 0100 D6). It is a count rendered as text — not a button, not a
 * separate chip, not a filter value. Selecting a commission never reveals a
 * locked row, because locked rows were never in `rows` to begin with: they are
 * invisible to the oversight arm at the DB, so this component could not surface
 * one even if it tried. The count comes from the DEFINER board door, which is
 * the only thing that can see them.
 */
export function QualityCommissionFilter({
  commissions,
  selected,
  onSelect,
}: {
  commissions: QualityFilterCommission[];
  /** The selected commission id, or `null` for "Todas". */
  selected: string | null;
  onSelect: (commissionId: string | null) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const total = commissions.reduce((n, c) => n + c.totalCases, 0);

  function select(commissionId: string | null) {
    onSelect(commissionId);
    const params = new URLSearchParams(searchParams.toString());
    if (commissionId) {
      params.set("comissao", commissionId);
    } else {
      params.delete("comissao");
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div
      role="group"
      aria-label="Filtrar casos por comissão"
      className="flex flex-wrap items-center gap-1.5"
    >
      <Chip
        label="Todas"
        count={total}
        active={selected === null}
        onClick={() => select(null)}
      />
      {commissions.map((c) => (
        <Chip
          key={c.commissionId}
          label={c.commissionName}
          count={c.totalCases}
          locked={c.lockedCases}
          active={selected === c.commissionId}
          onClick={() => select(c.commissionId)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  count,
  locked = 0,
  active,
  onClick,
}: {
  label: string;
  count: number;
  locked?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="ml-1.5 tabular-nums opacity-80">{count}</span>
      {locked > 0 ? (
        <span className="ml-1.5 tabular-nums opacity-70">
          · {locked} {locked === 1 ? "restrito" : "restritos"}
        </span>
      ) : null}
    </button>
  );
}
