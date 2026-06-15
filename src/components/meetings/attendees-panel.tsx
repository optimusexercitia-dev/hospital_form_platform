"use client";

import { useState } from "react";
import { Pencil, UserPlus, Users, UsersRound } from "lucide-react";

import type {
  CommissionMeetingSettings,
  MeetingAttendee,
  MeetingDetail,
} from "@/lib/queries/meetings";
import {
  removeMeetingAttendee,
  seedExpectedAttendees,
  setMeetingQuorumMet,
} from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/cases/assignee-avatar";
import { AttendanceBadge } from "./meeting-badges";
import {
  ATTENDEE_ROLE_LABEL,
  describeQuorumRule,
} from "./meeting-labels";
import { AttendeeForm, type AttendeeMemberOption } from "./attendee-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { useMeetingAction } from "./use-meeting-action";

function AttendeeRow({
  attendee,
  members,
  canEdit,
}: {
  attendee: MeetingAttendee;
  members: AttendeeMemberOption[];
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const name = attendee.displayName ?? "Participante";
  const isGuest = attendee.userId == null;

  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <AssigneeAvatar name={name} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">
            {name}
            {isGuest && (
              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase">
                Convidado
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {ATTENDEE_ROLE_LABEL[attendee.role]}
            {isGuest && attendee.externalOrg
              ? ` · ${attendee.externalOrg}`
              : ""}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <AttendanceBadge attendance={attendee.attendance} />
        {canEdit && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label={`Editar ${name}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <ConfirmDeleteButton
              action={() => removeMeetingAttendee(attendee.id)}
              label={`Remover ${name}`}
              title="Remover este participante?"
              description={`${name} será removido da lista de participantes.`}
            />
          </>
        )}
      </div>

      {canEdit && (
        <AttendeeForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          meetingId={attendee.meetingId}
          attendee={attendee}
          members={members}
        />
      )}
    </li>
  );
}

/** The quorum summary: live present/total + the rule + the verdict + override. */
function QuorumSummary({
  meeting,
  settings,
  presentCount,
  totalMembers,
  canEdit,
}: {
  meeting: MeetingDetail;
  settings: CommissionMeetingSettings | null;
  presentCount: number;
  totalMembers: number;
  canEdit: boolean;
}) {
  const { run, isPending, error } = useMeetingAction();

  // Before conclusion, show the LIVE rule from settings; after, the SNAPSHOT.
  const ruleType = meeting.quorumRuleType ?? settings?.quorumRuleType ?? null;
  const ruleValue =
    meeting.quorumRuleType != null ? meeting.quorumValue : settings?.quorumValue ?? null;
  const quorumMet = meeting.quorumMet;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Users aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="font-medium">Quórum</span>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {presentCount} {presentCount === 1 ? "presente" : "presentes"} ·{" "}
          {totalMembers} {totalMembers === 1 ? "membro" : "membros"}
        </span>
      </div>

      {ruleType && (
        <p className="text-xs text-muted-foreground text-pretty">
          {describeQuorumRule(ruleType, ruleValue)}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
            (quorumMet === true
              ? "bg-success/12 text-success dark:bg-success/15"
              : quorumMet === false
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground")
          }
        >
          {quorumMet === true
            ? "Quórum atingido"
            : quorumMet === false
              ? "Quórum não atingido"
              : "Quórum não definido"}
        </span>

        {canEdit && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || quorumMet === true}
              onClick={() => run(() => setMeetingQuorumMet(meeting.id, true))}
            >
              Marcar atingido
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || quorumMet === false}
              onClick={() => run(() => setMeetingQuorumMet(meeting.id, false))}
            >
              Marcar não atingido
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Attendees & quorum manager (F3). Lists attendees (members + external guests)
 * with role + attendance; staff_admin adds/edits/removes, can "Preencher com
 * membros" (seed), and sees a live quorum summary with a `quorum_met` override.
 * Read-only for members and once the meeting is locked.
 */
export function AttendeesPanel({
  meeting,
  attendees,
  members,
  settings,
  totalMembers,
  canEdit,
}: {
  meeting: MeetingDetail;
  attendees: MeetingAttendee[];
  /** Commission roster for the member picker. */
  members: AttendeeMemberOption[];
  settings: CommissionMeetingSettings | null;
  /** count(commission_members) — the quorum denominator for the live display. */
  totalMembers: number;
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const seed = useMeetingAction();

  // Quorum counts PLATFORM members only — external guests are never counted
  // (ADR 0025; QA Phase 10 MINOR-2). Mirrors the DB conclusion snapshot.
  const presentCount = attendees.filter(
    (a) => a.attendance === "presente" && a.userId !== null,
  ).length;

  // Exclude already-attending members from the "add member" picker.
  const attendingUserIds = new Set(
    attendees.map((a) => a.userId).filter((id): id is string => id != null),
  );
  const availableMembers = members.filter(
    (m) => !attendingUserIds.has(m.userId),
  );

  return (
    <section
      aria-labelledby="meeting-attendees-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersRound
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="meeting-attendees-heading"
            className="text-base font-semibold"
          >
            Participantes e quórum
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {attendees.length}
          </span>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={seed.isPending}
              onClick={() => seed.run(() => seedExpectedAttendees(meeting.id))}
            >
              <Users aria-hidden="true" />
              Preencher com membros
            </Button>
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus aria-hidden="true" />
              Adicionar
            </Button>
          </div>
        )}
      </div>

      {seed.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {seed.error}
        </p>
      )}

      <QuorumSummary
        meeting={meeting}
        settings={settings}
        presentCount={presentCount}
        totalMembers={totalMembers}
        canEdit={canEdit}
      />

      {attendees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhum participante. Adicione membros ou convidados, ou use “Preencher com membros”."
            : "Nenhum participante registrado."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {attendees.map((a) => (
            <AttendeeRow
              key={a.id}
              attendee={a}
              members={availableMembers}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <AttendeeForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          meetingId={meeting.id}
          members={availableMembers}
        />
      )}
    </section>
  );
}
