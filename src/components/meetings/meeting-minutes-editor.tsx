"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock } from "lucide-react";

import { updateMeetingMinutes } from "@/lib/meetings/actions";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * The meeting MINUTES (ata) narrative (F2): a free-form sanitized-Markdown body
 * (Architecture Rule 7) rendered through the platform's one renderer.
 *
 * Editable only while the meeting is unlocked (`agendada`/`realizada`); once the
 * meeting is concluded it is shown read-only (the server also rejects writes).
 * `canEdit` is decided by the parent from the meeting status.
 */
export function MeetingMinutesEditor({
  meetingId,
  minutesMd,
  canEdit,
}: {
  meetingId: string;
  minutesMd: string | null;
  canEdit: boolean;
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
