"use client";

import { useRef, useState } from "react";
import { ChevronDown, FileAudio, Loader2 } from "lucide-react";

import { readMinutesTranscript } from "@/lib/minutes-jobs/actions";
import { cn } from "@/lib/utils";
import { MINUTES_UI } from "../minutes-labels";

/**
 * F3 — the transcript panel (ADR 0099 D8/D15): collapsed by default, since the audited
 * door records a read the instant it's called. A `useRef` latch (not `useState`) makes
 * sure a re-render never re-fires the call — the door is called exactly ONCE per page
 * visit, on first expand, and never again on subsequent collapse/expand toggles; the
 * fetched text is cached in local state thereafter.
 */
export function TranscriptPanel({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (!next || fetched.current) return;
    fetched.current = true;
    setLoading(true);
    setError(null);
    const result = await readMinutesTranscript(jobId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setText(result.transcript);
  }

  return (
    <section
      aria-labelledby="revisao-ata-transcript-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <button
        type="button"
        id="revisao-ata-transcript-heading"
        aria-expanded={open}
        aria-controls="revisao-ata-transcript-body"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 text-left focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <span className="flex items-center gap-2 text-base font-semibold">
          <FileAudio aria-hidden="true" className="size-4 text-muted-foreground" />
          {MINUTES_UI.transcriptHeading}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {/* I6: always rendered (never conditionally mounted) so the trigger's
          `aria-controls="revisao-ata-transcript-body"` always resolves to a real
          element, whether expanded or not. */}
      <div
        id="revisao-ata-transcript-body"
        role="region"
        aria-labelledby="revisao-ata-transcript-heading"
        hidden={!open}
      >
        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {MINUTES_UI.transcriptLoading}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {!loading && !error && text !== null && (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
            {text.trim().length > 0 ? text : MINUTES_UI.transcriptEmpty}
          </div>
        )}
      </div>
    </section>
  );
}
