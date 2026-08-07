"use client";

import { useMemo, useState } from "react";

import type { CaseBoardRow } from "@/lib/queries/cases";
import {
  QualityCommissionFilter,
  type QualityFilterCommission,
} from "./quality-commission-filter";
import { QualityCaseBoard } from "./quality-case-board";

/**
 * Client orchestrator for the oversight board — the commission chips plus the
 * cross-committee table, filtering the already-loaded rows. Mirrors the
 * `CasesView` → `CasesTable` split: the Server Component loads, this owns the
 * selection, the table renders.
 *
 * No data fetching here. The rows arrive server-loaded through
 * `listCasesBoard` per visible commission, each row already filtered by
 * `app.can_read_case`, so a chip press can only ever narrow what the DB already
 * decided the reviewer may see.
 */
export function QualityBoardView({
  rows,
  org,
  commissions,
  commissionSlugById,
  commissionNameById,
  initialCommissionId,
}: {
  rows: CaseBoardRow[];
  org: string;
  commissions: QualityFilterCommission[];
  commissionSlugById: Record<string, string>;
  commissionNameById: Record<string, string>;
  /** From `?comissao=`, resolved server-side against the visible set. */
  initialCommissionId: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(initialCommissionId);

  const visible = useMemo(
    () =>
      selected === null
        ? rows
        : rows.filter((r) => r.case.commissionId === selected),
    [rows, selected],
  );

  return (
    <div className="flex flex-col gap-4">
      {commissions.length > 1 ? (
        <QualityCommissionFilter
          commissions={commissions}
          selected={selected}
          onSelect={setSelected}
        />
      ) : null}
      <QualityCaseBoard
        rows={visible}
        org={org}
        commissionSlugById={commissionSlugById}
        commissionNameById={commissionNameById}
      />
    </div>
  );
}
