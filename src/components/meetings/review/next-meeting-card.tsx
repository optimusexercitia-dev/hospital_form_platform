"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import type { MinutesDraftNextMeeting } from "@/lib/minutes-jobs/types";
import type { CommissionMeetingType } from "@/lib/queries/meetings";
import type { MemberListItem } from "@/lib/queries/members";
import { Button } from "@/components/ui/button";
import { MeetingFormDialog } from "../meeting-form-dialog";
import { MINUTES_UI } from "../minutes-labels";

/** `YYYY-MM-DD` or a full ISO timestamp → a `datetime-local`-ready ISO string, or undefined if unparseable. */
function toIsoOrUndefined(value: string | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * F3's post-apply success state (ADR 0099 D7): the service's advisory next-meeting
 * suggestion, and "Agendar próxima reunião" — which opens the EXISTING
 * `MeetingFormDialog` in create mode, prefilled. The suggestion is never auto-scheduled;
 * this is the one and only entry point, and it is a plain suggestion the reviewer can
 * freely edit or ignore in the dialog.
 */
export function NextMeetingCard({
  suggestion,
  org,
  slug,
  commissionId,
  meetingTypes,
  members,
}: {
  suggestion: MinutesDraftNextMeeting | null;
  org: string;
  slug: string;
  commissionId: string;
  meetingTypes: CommissionMeetingType[];
  members: MemberListItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-labelledby="revisao-ata-next-meeting-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <CalendarPlus aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="revisao-ata-next-meeting-heading" className="text-base font-semibold">
          {MINUTES_UI.nextMeetingHeading}
        </h2>
      </div>

      {suggestion ? (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            {MINUTES_UI.nextMeetingSuggested}
          </p>
          {suggestion.note && <p className="mt-1 text-pretty">{suggestion.note}</p>}
          {suggestion.location_text && (
            <p className="mt-1 text-muted-foreground">{suggestion.location_text}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{MINUTES_UI.nextMeetingNoSuggestion}</p>
      )}

      <Button type="button" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <CalendarPlus aria-hidden="true" />
        {MINUTES_UI.nextMeetingCta}
      </Button>

      <MeetingFormDialog
        mode="create"
        open={open}
        onOpenChange={setOpen}
        org={org}
        slug={slug}
        commissionId={commissionId}
        meetingTypes={meetingTypes}
        members={members}
        initialValues={{
          scheduledStart: toIsoOrUndefined(suggestion?.suggested_date ?? null),
          locationText: suggestion?.location_text ?? undefined,
        }}
      />
    </section>
  );
}
