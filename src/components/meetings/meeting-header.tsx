import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  MapPin,
  Video,
} from "lucide-react";

import type {
  CommissionMeetingType,
  MeetingDetail,
} from "@/lib/queries/meetings";
import { MeetingStatusBadge, MeetingTypeChip } from "./meeting-badges";
import { MeetingLifecycleActions } from "./meeting-lifecycle-actions";
import { MODALITY_LABEL } from "./meeting-labels";
import { formatMeetingNumber, formatSchedule } from "./format";

/**
 * The meeting detail header (F1): the back link, number + title + status, the
 * schedule / modality / location metadata, the type chip, and — for staff_admin
 * — the lifecycle action bar (Editar / Concluir / Reabrir / Distribuir /
 * Cancelar). Server-Component shell; only the action bar is a client island.
 */
export function MeetingHeader({
  meeting,
  slug,
  commissionId,
  meetingTypes,
  isCoordinator,
}: {
  meeting: MeetingDetail;
  slug: string;
  commissionId: string;
  meetingTypes: CommissionMeetingType[];
  isCoordinator: boolean;
}) {
  const remote =
    meeting.modality === "remoto" || meeting.modality === "hibrido";

  return (
    <header className="flex flex-col gap-4">
      <Link
        href={`/c/${slug}/meetings`}
        className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Reuniões
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {formatMeetingNumber(meeting.meetingNumber)}
            </span>
            <MeetingStatusBadge status={meeting.status} />
            {meeting.meetingTypeName && (
              <MeetingTypeChip
                name={meeting.meetingTypeName}
                colorToken={meeting.meetingTypeColorToken}
              />
            )}
          </div>
          <h1 className="text-3xl text-balance">{meeting.title}</h1>

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
            {meeting.meetingUrl && (
              <a
                href={meeting.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                Entrar na reunião
              </a>
            )}
          </div>
        </div>

        {isCoordinator && (
          <MeetingLifecycleActions
            meeting={meeting}
            slug={slug}
            commissionId={commissionId}
            meetingTypes={meetingTypes}
          />
        )}
      </div>
    </header>
  );
}
