import { Mic2, User } from "lucide-react";

import type { MinutesDraftSpeaker } from "@/lib/minutes-jobs/types";
import { displaySpeakerLabel, MINUTES_UI } from "../minutes-labels";

/**
 * F3 — the D12 speakers panel: read-only, display-only. It never writes attendance —
 * a member who sat silently is indistinguishable from one who never arrived, and the
 * audio cannot prove presence either way — so this is presentational only and carries
 * no `onChange`. No client interaction, no `"use client"` needed.
 */
export function SpeakersPanel({ speakers }: { speakers: MinutesDraftSpeaker[] }) {
  return (
    <section
      aria-labelledby="revisao-ata-speakers-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <Mic2 aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="revisao-ata-speakers-heading" className="text-base font-semibold">
          {MINUTES_UI.speakersHeading}
        </h2>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">{MINUTES_UI.speakersNote}</p>

      {speakers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{MINUTES_UI.speakersNone}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {speakers.map((s, i) => (
            <li
              key={`${s.attendee_ref ?? "voice"}-${i}`}
              className="flex items-center gap-2 text-sm"
            >
              <User aria-hidden="true" className="size-3.5 text-muted-foreground" />
              {/* N5: `normalize.ts` falls back to the raw attendee-ref UUID when its name
                  lookup misses — `displaySpeakerLabel` never lets that machine identifier
                  reach the screen. */}
              <span className={s.attendee_ref ? "text-foreground" : "text-muted-foreground italic"}>
                {s.attendee_ref
                  ? displaySpeakerLabel(s.label)
                  : s.label || MINUTES_UI.speakersUnidentified}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
