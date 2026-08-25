import type { PersonAccountEvent } from "@/lib/queries/audit";

import { ProfileCard } from "@/components/users/profile-cards";

/**
 * The profile's "Histórico da conta" timeline (redesign 2a).
 *
 * Reads the org's audit trail scoped to this person, newest first — who was added to
 * what, whose role changed, when the invitation was accepted, when a registration was
 * verified. On a governance platform this is not a nicety: an accreditation review asks
 * *when* someone became a coordinator and *who* made them one, and the answer has to be
 * readable by the admin looking at the person, not only by whoever can query the trail.
 *
 * ⚠ SERVER COMPONENT, AND PRESENTATIONAL ONLY. The pt-BR sentence for each event is
 * composed once server-side by `listPersonAccountHistory` (title / detail / tone), so
 * this file never maps an audit action name to Portuguese. Two places composing the same
 * sentence is how one surface starts describing an event differently from another — and
 * the trail's vocabulary widens every phase.
 *
 * ⚠ TONE IS A CLASS OF EVENT, NOT A JUDGEMENT: `primary` for membership and lifecycle,
 * `success` for a verification, `muted` for the creation of the record. The dot is
 * decoration on top of text that already says what happened, so nothing is carried by
 * colour alone.
 *
 * ⛔ AN EMPTY LIST IS A LEGIBLE STATE AND THE CARD STAYS. A person can be registered
 * before the audit trail covered a surface, and a card that disappears reads as "this
 * failed to load" or, worse, "you are not allowed to see it".
 */
export function AccountHistoryCard({ events }: { events: PersonAccountEvent[] }) {
  return (
    <ProfileCard
      titleId="historico-heading"
      title="Histórico da conta"
      caption="O que aconteceu com este cadastro, do mais recente ao mais antigo."
      riseDelay="120ms"
    >
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-xs text-muted-foreground text-pretty">
          Nenhum evento registrado para esta conta ainda.
        </p>
      ) : (
        <ol className="flex flex-col">
          {events.map((event, index) => {
            const last = index === events.length - 1;
            return (
              <li
                key={event.id}
                className="grid grid-cols-[0.875rem_1fr] gap-3"
              >
                <div
                  aria-hidden="true"
                  className="flex flex-col items-center"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT_TONE[event.tone]}`}
                  />
                  {/* The connector is omitted after the last event: a line running into
                      nothing reads as a truncated list. */}
                  {last ? null : (
                    <span className="my-0.5 w-px flex-1 bg-border/60" />
                  )}
                </div>
                <div className={last ? "" : "pb-3.5"}>
                  <p className="text-[0.78rem] text-pretty">
                    <strong className="font-semibold">{event.title}</strong>
                    {event.detail ? (
                      <span className="text-muted-foreground">
                        {" "}
                        {event.detail}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.68rem] text-muted-foreground">
                    {formatTimestamp(event.occurredAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </ProfileCard>
  );
}

const DOT_TONE: Record<PersonAccountEvent["tone"], string> = {
  primary: "bg-primary",
  success: "bg-success",
  muted: "bg-muted-foreground",
};

/** `03/02/2025 14:12` — an audit instant, so parsed as one. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
