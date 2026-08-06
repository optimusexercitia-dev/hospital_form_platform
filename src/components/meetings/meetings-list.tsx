"use client";

import { commissionHref } from "@/lib/routing";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  MapPin,
  Video,
} from "lucide-react";

import type {
  CommissionMeetingType,
  MeetingListItem,
  MeetingStatus,
} from "@/lib/queries/meetings";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/native-select";
import { MeetingStatusBadge, MeetingTypeChip } from "./meeting-badges";
import { MinutesListBadge } from "./minutes-list-badge";
import { MEETING_STATUS_LABEL, MODALITY_LABEL } from "./meeting-labels";
import { formatMeetingNumber, formatSchedule } from "./format";

/** Status filter options, in lifecycle order, plus an "all" sentinel. */
const STATUS_FILTER_ORDER: MeetingStatus[] = [
  "scheduled",
  "held",
  "in_signature",
  "signed",
  "distributed",
  "cancelled",
];

type SortKey = "numero" | "data" | "status";
type SortDir = "asc" | "desc";

// Status sort rank = the lifecycle order above; every status is present.
const STATUS_RANK: Record<MeetingStatus, number> = Object.fromEntries(
  STATUS_FILTER_ORDER.map((s, i) => [s, i]),
) as Record<MeetingStatus, number>;

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {label}
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3",
            active ? "text-foreground" : "text-muted-foreground/60",
          )}
        />
      </button>
    </th>
  );
}

/** A plain (non-sortable) column header, matching the cases table. */
function PlainHeader({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {label}
    </th>
  );
}

/**
 * Client-side meetings registry as a sortable, scannable table (mirrors the cases
 * table). Status + type filters narrow the rows; the table sorts by number, date,
 * or status. Fed plain props from the Server page (no value-import of server query
 * modules). Filtering/sorting is purely presentational; RLS already scoped the data.
 *
 * Columns: Reunião № · Título · Data/hora · Tipo · Modalidade · Status · Ações
 * pendentes · Assinaturas pendentes. "Assinaturas pendentes" renders `—` unless the
 * meeting is `em_assinatura` (the count is `null` otherwise — backend contract).
 */
export function MeetingsList({
  meetings,
  meetingTypes,
  org,
  slug,
}: {
  meetings: MeetingListItem[];
  meetingTypes: CommissionMeetingType[];
  /** Org slug for hrefs. */
  org: string;
  slug: string;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | "all">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "numero",
    dir: "desc",
  });

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (typeFilter !== "all" && m.meetingTypeId !== typeFilter) return false;
      return true;
    });
  }, [meetings, statusFilter, typeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "numero") cmp = a.meetingNumber - b.meetingNumber;
      else if (sort.key === "data")
        cmp = a.scheduledStart.localeCompare(b.scheduledStart);
      else cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  const onlyDefaultType =
    meetingTypes.length === 0 ||
    meetings.every((m) => m.meetingTypeId == null);

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 p-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Estado</span>
          <NativeSelect
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as MeetingStatus | "all")
            }
            className="h-9"
            aria-label="Filtrar por estado"
          >
            <option value="all">Todos</option>
            {STATUS_FILTER_ORDER.map((s) => (
              <option key={s} value={s}>
                {MEETING_STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </label>

        {!onlyDefaultType && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-muted-foreground">Tipo</span>
            <NativeSelect
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9"
              aria-label="Filtrar por tipo"
            >
              <option value="all">Todos</option>
              {meetingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}

        <span
          className={cn(
            "ml-auto text-sm text-muted-foreground tabular-nums",
            filtered.length === 0 && "text-muted-foreground/70",
          )}
        >
          {filtered.length} {filtered.length === 1 ? "reunião" : "reuniões"}
        </span>
      </div>

      <div className="animate-fade-in overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <SortHeader
                label="Reunião №"
                active={sort.key === "numero"}
                dir={sort.dir}
                onClick={() => toggle("numero")}
              />
              <PlainHeader label="Título" />
              <SortHeader
                label="Data/hora"
                active={sort.key === "data"}
                dir={sort.dir}
                onClick={() => toggle("data")}
              />
              <PlainHeader label="Tipo" />
              <PlainHeader label="Modalidade" />
              <SortHeader
                label="Status"
                active={sort.key === "status"}
                dir={sort.dir}
                onClick={() => toggle("status")}
              />
              <PlainHeader label="Ações pendentes" className="text-right" />
              <PlainHeader
                label="Assinaturas pendentes"
                className="text-right"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma reunião corresponde aos filtros.
                </td>
              </tr>
            ) : (
              sorted.map((m) => {
                const href = commissionHref(org, slug, "meetings", m.id);
                const remote =
                  m.modality === "remoto" || m.modality === "hibrido";
                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push(href)}
                    className="cursor-pointer border-b border-border/70 odd:bg-card even:bg-muted/20 transition-colors hover:bg-accent/40"
                  >
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[0.8rem] font-semibold text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        {formatMeetingNumber(m.meetingNumber)}
                      </Link>
                    </td>
                    <td className="max-w-[18rem] px-3 py-2.5 align-middle">
                      <span className="block truncate font-medium text-foreground">
                        {m.title}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatSchedule(m.scheduledStart, m.scheduledEnd)}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      {m.meetingTypeName ? (
                        <MeetingTypeChip
                          name={m.meetingTypeName}
                          colorToken={m.meetingTypeColorToken}
                        />
                      ) : (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
                        {remote ? (
                          <Video aria-hidden="true" className="size-4" />
                        ) : (
                          <MapPin aria-hidden="true" className="size-4" />
                        )}
                        {MODALITY_LABEL[m.modality]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MeetingStatusBadge status={m.status} />
                        {m.minutesJobStatus && (
                          <MinutesListBadge status={m.minutesJobStatus} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-right tabular-nums">
                      {m.pendingActionItems > 0 ? (
                        <span className="font-medium text-foreground">
                          {m.pendingActionItems}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-right tabular-nums">
                      {m.pendingSignatures == null ? (
                        <span className="text-muted-foreground/70">—</span>
                      ) : (
                        <span
                          className={cn(
                            "font-medium",
                            m.pendingSignatures > 0
                              ? "text-warning"
                              : "text-success",
                          )}
                        >
                          {m.pendingSignatures}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
