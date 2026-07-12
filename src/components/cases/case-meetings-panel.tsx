import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { CalendarClock, Users } from "lucide-react";

import type { CaseMeetingLink } from "@/lib/queries/case-timeline";
import { cn } from "@/lib/utils";
import { MeetingStatusBadge } from "@/components/meetings/meeting-badges";
import { formatMeetingNumber, formatSchedule } from "@/components/meetings/format";

/**
 * The "Reuniões" panel on the case-detail rail — the REVERSE of the meeting's
 * "Casos discutidos" panel ({@link import('@/components/meetings/case-linker').CaseLinker}):
 * every meeting this case was discussed in, newest-scheduled-first. READ-ONLY —
 * linking/unlinking stays solely on the meeting side; this panel only lists +
 * links out. Shows all linked meetings regardless of status. Server-Component
 * shell — the data arrives as props, no client interaction.
 */
export function CaseMeetingsPanel({
  org,
  slug,
  meetings,
  variant = "default",
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  meetings: CaseMeetingLink[];
  /** "rail" = compact, flatter treatment for the case-detail side rail. */
  variant?: "default" | "rail";
}) {
  // Newest scheduled first (mirrors InterviewsPanel's ordering).
  const ordered = [...meetings].sort((a, b) =>
    b.meeting.scheduledStart.localeCompare(a.meeting.scheduledStart),
  );

  return (
    <section
      aria-labelledby="case-meetings-heading"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card",
        variant === "rail"
          ? "border-border/70 p-4 shadow-none"
          : "border-border p-5 shadow-xs",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id="case-meetings-heading"
            className={cn(
              "font-semibold",
              variant === "rail" ? "text-sm" : "text-base",
            )}
          >
            Reuniões
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {meetings.length}
          </span>
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Este caso ainda não foi discutido em nenhuma reunião.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((link, i) => (
            <li
              key={link.linkId}
              className="animate-rise-in"
              style={
                { "--rise-delay": `${i * 60}ms` } as React.CSSProperties
              }
            >
              <Link
                href={commissionHref(org, slug, "meetings", link.meeting.id)}
                className="group flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-border hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatMeetingNumber(link.meeting.meetingNumber)}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">
                      {link.meeting.title}
                    </span>
                  </div>
                  <MeetingStatusBadge status={link.meeting.status} />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <CalendarClock aria-hidden="true" className="size-3.5" />
                    {formatSchedule(
                      link.meeting.scheduledStart,
                      link.meeting.scheduledEnd,
                    )}
                  </span>
                </div>

                {link.summary && (
                  <p className="text-xs text-pretty">
                    <span className="font-medium text-foreground">
                      Resumo:{" "}
                    </span>
                    <span className="text-muted-foreground">
                      {link.summary}
                    </span>
                  </p>
                )}
                {link.decision && (
                  <p className="text-xs text-pretty">
                    <span className="font-medium text-foreground">
                      Decisão:{" "}
                    </span>
                    <span className="text-muted-foreground">
                      {link.decision}
                    </span>
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
