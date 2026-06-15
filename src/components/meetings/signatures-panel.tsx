import { CircleDashed, PenLine } from "lucide-react";

import type {
  MeetingAttendee,
  MeetingDetail,
  MeetingSignature,
} from "@/lib/queries/meetings";
import { AssigneeAvatar } from "@/components/cases/assignee-avatar";
import { SignatureBadge } from "./meeting-badges";
import { SignButton } from "./sign-dialog";
import { formatDateTime } from "./format";

/** One roster row: a present platform attendee + their (possibly absent) signature. */
interface RosterEntry {
  attendee: MeetingAttendee;
  signature: MeetingSignature | null;
}

/**
 * Signatures panel (F4): a roster of the PRESENT platform attendees with their
 * signature status (assinada / pendente / revogada). The current user, if they
 * are a present attendee of an `em_assinatura` meeting and have not yet signed,
 * gets an "Assinar" action. Guests and absentees never sign and are not listed.
 *
 * Server-Component shell — the data arrives as props; only the sign action is a
 * client island.
 */
export function SignaturesPanel({
  meeting,
  attendees,
  signatures,
  currentUserId,
}: {
  meeting: MeetingDetail;
  attendees: MeetingAttendee[];
  signatures: MeetingSignature[];
  /** The viewer's user id, or null — gates the "Assinar" action to their own row. */
  currentUserId: string | null;
}) {
  // The signing roster = present PLATFORM attendees (have a userId).
  const roster: RosterEntry[] = attendees
    .filter((a) => a.userId != null && a.attendance === "presente")
    .map((a) => ({
      attendee: a,
      signature:
        signatures.find(
          (s) => s.attendeeId === a.id && s.status !== "revoked",
        ) ??
        signatures.find((s) => s.attendeeId === a.id) ??
        null,
    }));

  const signedCount = roster.filter(
    (e) => e.signature?.status === "signed",
  ).length;
  const isSigning = meeting.status === "em_assinatura";

  // Only meetings that reached the signature stage show this panel meaningfully.
  const reachedSignatureStage =
    meeting.status === "em_assinatura" ||
    meeting.status === "assinada" ||
    meeting.status === "distribuida";

  return (
    <section
      aria-labelledby="meeting-signatures-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PenLine aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id="meeting-signatures-heading"
            className="text-base font-semibold"
          >
            Assinaturas
          </h2>
          {roster.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
              {signedCount} / {roster.length}
            </span>
          )}
        </div>
      </div>

      {!reachedSignatureStage ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          As assinaturas ficam disponíveis após a reunião ser concluída.
        </p>
      ) : roster.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum participante presente da plataforma para assinar.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {roster.map(({ attendee, signature }) => {
            const name = attendee.displayName ?? "Participante";
            const isMine =
              currentUserId != null && attendee.userId === currentUserId;
            const hasSigned = signature?.status === "signed";
            const canSign = isMine && isSigning && !hasSigned;

            return (
              <li
                key={attendee.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AssigneeAvatar name={name} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {name}
                      {isMine && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </span>
                    {signature?.status === "signed" && signature.signedAt ? (
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        Assinada em {formatDateTime(signature.signedAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CircleDashed aria-hidden="true" className="size-3" />
                        Aguardando assinatura
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {signature ? (
                    <SignatureBadge status={signature.status} />
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                      Pendente
                    </span>
                  )}
                  {canSign && (
                    <SignButton
                      attendeeId={attendee.id}
                      meetingNumber={meeting.meetingNumber}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
