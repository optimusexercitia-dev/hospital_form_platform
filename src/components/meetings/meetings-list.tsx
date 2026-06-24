"use client";

import { commissionHref } from "@/lib/routing";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarX2,
  MapPin,
  Video,
} from "lucide-react";

import type {
  CommissionMeetingType,
  MeetingListItem,
  MeetingStatus,
} from "@/lib/queries/meetings";
import { cn } from "@/lib/utils";
import { MeetingStatusBadge, MeetingTypeChip } from "./meeting-badges";
import {
  MEETING_STATUS_LABEL,
  MODALITY_LABEL,
  isUpcomingStatus,
} from "./meeting-labels";
import { formatMeetingNumber, formatSchedule } from "./format";

/** Status filter options, in lifecycle order, plus an "all" sentinel. */
const STATUS_FILTER_ORDER: MeetingStatus[] = [
  "agendada",
  "realizada",
  "em_assinatura",
  "assinada",
  "distribuida",
  "cancelada",
];

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

function MeetingCard({
  meeting,
  org,
  slug,
  index,
}: {
  meeting: MeetingListItem;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  index: number;
}) {
  const remote = meeting.modality === "remoto" || meeting.modality === "hibrido";
  return (
    <li
      className="animate-rise-in"
      style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
    >
      <Link
        href={commissionHref(org, slug, "meetings", meeting.id)}
        className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-border/80 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">
              {formatMeetingNumber(meeting.meetingNumber)}
            </span>
            <h3 className="text-lg leading-snug text-balance">
              {meeting.title}
            </h3>
          </div>
          <MeetingStatusBadge status={meeting.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarClock aria-hidden="true" className="size-4" />
            {formatSchedule(meeting.scheduledStart, meeting.scheduledEnd)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {remote ? (
              <Video aria-hidden="true" className="size-4" />
            ) : (
              <MapPin aria-hidden="true" className="size-4" />
            )}
            {MODALITY_LABEL[meeting.modality]}
            {meeting.locationText ? ` · ${meeting.locationText}` : ""}
          </span>
        </div>

        {meeting.meetingTypeName && (
          <div>
            <MeetingTypeChip
              name={meeting.meetingTypeName}
              colorToken={meeting.meetingTypeColorToken}
            />
          </div>
        )}
      </Link>
    </li>
  );
}

function MeetingGroup({
  heading,
  meetings,
  org,
  slug,
  emptyText,
  icon: Icon,
}: {
  heading: string;
  meetings: MeetingListItem[];
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  emptyText: string;
  icon: typeof CalendarClock;
}) {
  return (
    <section aria-label={heading} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">{heading}</h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
          {meetings.length}
        </span>
      </div>
      {meetings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {meetings.map((m, i) => (
            <MeetingCard key={m.id} meeting={m} org={org} slug={slug} index={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Client-side meetings list with status + type filters and an upcoming/past
 * split. Fed plain props from the Server page (no value-import of server query
 * modules). Filtering is purely presentational; RLS already scoped the data.
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
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | "all">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (typeFilter !== "all" && m.meetingTypeId !== typeFilter) return false;
      return true;
    });
  }, [meetings, statusFilter, typeFilter]);

  const upcoming = filtered
    .filter((m) => isUpcomingStatus(m.status))
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const past = filtered
    .filter((m) => !isUpcomingStatus(m.status))
    .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));

  const onlyDefaultType =
    meetingTypes.length === 0 ||
    meetings.every((m) => m.meetingTypeId == null);

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 p-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Estado</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as MeetingStatus | "all")
            }
            className={SELECT_CLASS}
            aria-label="Filtrar por estado"
          >
            <option value="all">Todos</option>
            {STATUS_FILTER_ORDER.map((s) => (
              <option key={s} value={s}>
                {MEETING_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        {!onlyDefaultType && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-muted-foreground">Tipo</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={SELECT_CLASS}
              aria-label="Filtrar por tipo"
            >
              <option value="all">Todos</option>
              {meetingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <span
          className={cn(
            "ml-auto text-sm text-muted-foreground tabular-nums",
            filtered.length === 0 && "text-muted-foreground/70",
          )}
        >
          {filtered.length}{" "}
          {filtered.length === 1 ? "reunião" : "reuniões"}
        </span>
      </div>

      <MeetingGroup
        heading="Próximas"
        meetings={upcoming}
        org={org} slug={slug}
        icon={CalendarClock}
        emptyText="Nenhuma reunião agendada."
      />
      <MeetingGroup
        heading="Anteriores"
        meetings={past}
        org={org} slug={slug}
        icon={CalendarX2}
        emptyText="Nenhuma reunião anterior."
      />
    </div>
  );
}
