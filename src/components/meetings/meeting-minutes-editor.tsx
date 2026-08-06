"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock } from "lucide-react";

import { updateMeetingMinutes } from "@/lib/meetings/actions";
import type { MinutesJobSummary } from "@/lib/minutes-jobs/types";
import type { MeetingStatus } from "@/lib/queries/meetings";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { MinutesAudioSlot } from "./minutes-audio-slot";

/**
 * The meeting MINUTES (ata) narrative (F2): a free-form sanitized-Markdown body
 * (Architecture Rule 7) rendered through the platform's one renderer.
 *
 * Editable only while the meeting is unlocked (`agendada`/`realizada`); once the
 * meeting is concluded it is shown read-only (the server also rejects writes).
 * `canEdit` is decided by the parent from the meeting status.
 *
 * The header's right side also hosts MIN's audio-minutes slot (ADR 0099 F1) — the
 * `MinutesAudioSlot` child, fed the same `canEdit` this editor already receives (design
 * brief §1.4: it is exactly the audio feature's own canEdit predicate, nothing wider).
 */
export function MeetingMinutesEditor({
  meetingId,
  minutesMd,
  canEdit,
  meetingStatus,
  org,
  slug,
  audioMinutesEnabled,
  activeMinutesJob,
  attendees,
}: {
  meetingId: string;
  minutesMd: string | null;
  canEdit: boolean;
  meetingStatus: MeetingStatus;
  /** Org slug — a plain string; MIN's review-page/attendees hrefs are built downstream. */
  org: string;
  slug: string;
  audioMinutesEnabled: boolean;
  activeMinutesJob: MinutesJobSummary | null;
  attendees: { id: string; displayName: string | null }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(minutesMd ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = value !== (minutesMd ?? "");

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateMeetingMinutes(meetingId, value);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="meeting-minutes-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id="meeting-minutes-heading" className="text-base font-semibold">
            Ata
          </h2>
          {!canEdit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
              <Lock aria-hidden="true" className="size-3" />
              Bloqueada
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending || !dirty}
            >
              {isPending ? "Salvando…" : "Salvar ata"}
            </Button>
          )}
          <MinutesAudioSlot
            meetingId={meetingId}
            org={org}
            slug={slug}
            meetingStatus={meetingStatus}
            canEdit={canEdit}
            audioMinutesEnabled={audioMinutesEnabled}
            activeJob={activeMinutesJob}
            attendees={attendees}
          />
        </div>
      </div>

      {error && <FormBanner tone="error">{error}</FormBanner>}
      {saved && !dirty && (
        <FormBanner tone="success">Ata salva.</FormBanner>
      )}

      {canEdit ? (
        <SectionTextEditor
          value={value}
          onChange={(next) => {
            setValue(next);
            setSaved(false);
          }}
          disabled={isPending}
          textareaId={`minutes-${meetingId}`}
          placeholder="Escreva a ata da reunião em Markdown…"
        />
      ) : value.trim().length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <MarkdownRenderer content={value} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma ata registrada.
        </p>
      )}
    </section>
  );
}
