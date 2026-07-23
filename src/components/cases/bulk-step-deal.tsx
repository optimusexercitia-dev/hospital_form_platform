"use client";

import { useMemo } from "react";
import { CalendarClock, Layers, Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { AssigneeAvatar } from "@/components/cases/assignee-avatar";
import { tallyByMember } from "@/lib/cases/distribute";
import { resolveLabel, type BulkGridRow } from "@/lib/cases/bulk-grid-model";
import {
  memberName,
  type BulkMember,
  type PhaseScope,
} from "@/components/cases/bulk-create-types";

/**
 * Step 4 — the balanced deal preview. The wizard computed the owner map
 * client-side; here each member's share is shown with counts, a re-shuffle button
 * re-deals, and a per-case `NativeSelect` overrides any single owner. The wizard
 * footer holds the final commit (which submits this exact owner map — the server
 * never randomizes).
 */
export function BulkStepDeal({
  headingRef,
  rows,
  labelPrefix,
  owners,
  members,
  onReshuffle,
  onOverride,
  deadline,
  phaseScope,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  rows: BulkGridRow[];
  labelPrefix: string;
  owners: string[];
  members: BulkMember[];
  onReshuffle: () => void;
  onOverride: (rowIndex: number, userId: string) => void;
  deadline: string | null;
  phaseScope: PhaseScope;
}) {
  const nameById = useMemo(
    () => new Map(members.map((m) => [m.userId, memberName(m)])),
    [members],
  );

  const counts = useMemo(() => {
    const tally = tallyByMember(owners);
    // Seed 0 for every selected member so people with no case still show.
    return members.map((m) => ({
      member: m,
      count: tally.get(m.userId) ?? 0,
    }));
  }, [owners, members]);

  const deadlineLabel = deadline ? formatDateOnly(deadline) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          Distribuição e confirmação
        </h2>
        <p className="text-sm text-muted-foreground">
          Revise o rateio antes de criar. Você pode redistribuir ou ajustar o
          responsável de um caso específico.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">
            {rows.length}
          </span>{" "}
          casos
        </span>
        <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">
            {members.length}
          </span>{" "}
          responsáveis
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
          <Layers aria-hidden="true" className="size-3.5" />
          {phaseScope === "all_phases" ? "Todas as fases" : "Primeira fase"}
        </span>
        {deadlineLabel ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {deadlineLabel}
          </span>
        ) : null}
      </div>

      <section aria-labelledby="deal-per-member" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="deal-per-member" className="text-sm font-semibold">
            Carga por responsável
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={onReshuffle}>
            <Shuffle aria-hidden="true" className="size-4" />
            Redistribuir
          </Button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {counts.map(({ member, count }) => (
            <li
              key={member.userId}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <AssigneeAvatar name={memberName(member)} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {memberName(member)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {count} caso{count === 1 ? "" : "s"}
                </span>
              </span>
              <span className="font-mono text-lg tabular-nums text-primary">
                {count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="deal-per-case" className="flex flex-col gap-3">
        <h3 id="deal-per-case" className="text-sm font-semibold">
          Ajustar por caso
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th className="w-12 border-b border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                  #
                </th>
                <th className="border-b border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                  Caso
                </th>
                <th className="border-b border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                  Responsável
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="px-3 py-1.5 text-center font-mono text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="line-clamp-1">
                      {resolveLabel(row, labelPrefix, index + 1)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <NativeSelect
                      value={owners[index] ?? ""}
                      onChange={(e) => onOverride(index, e.target.value)}
                      aria-label={`Responsável do caso ${index + 1}`}
                      className="h-9 min-w-[12rem] px-2.5 text-sm"
                    >
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {nameById.get(m.userId) ?? memberName(m)}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** pt-BR date-only formatter (Rule 10) for a `YYYY-MM-DD` string. */
function formatDateOnly(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
