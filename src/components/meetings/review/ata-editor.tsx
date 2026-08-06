"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import { MINUTES_UI } from "../minutes-labels";

/**
 * F3 — the `minutes_md` slice of the review draft (ADR 0099 D5/D12).
 *
 * Wraps the existing `SectionTextEditor`/`MarkdownRenderer` pair verbatim (the house
 * sanitizing renderer, Architecture Rule 7) and adds the overwrite-warning banner: when
 * the meeting already carries non-empty `minutes_md`, concluding the review replaces
 * it, so the collapsible "Ver ata atual" lets the reviewer see exactly what is about to
 * be overwritten before they commit to it.
 */
export function AtaEditor({
  value,
  onChange,
  currentMinutesMd,
}: {
  value: string;
  onChange: (next: string) => void;
  currentMinutesMd: string | null;
}) {
  const [showCurrent, setShowCurrent] = useState(false);
  const hasCurrent = (currentMinutesMd ?? "").trim().length > 0;

  return (
    <section
      aria-labelledby="revisao-ata-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="revisao-ata-heading" className="text-base font-semibold">
          Ata
        </h2>
      </div>

      {hasCurrent && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3.5 text-sm">
          <p className="font-medium text-warning">{MINUTES_UI.overwriteWarningTitle}</p>
          <p className="mt-1 text-muted-foreground text-pretty">
            {MINUTES_UI.overwriteWarningBody}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-7 px-2"
            aria-expanded={showCurrent}
            aria-controls="revisao-ata-current-minutes"
            onClick={() => setShowCurrent((s) => !s)}
          >
            {showCurrent ? MINUTES_UI.overwriteHideCurrent : MINUTES_UI.overwriteShowCurrent}
          </Button>
          {/* I6: always rendered (never conditionally mounted) so `aria-controls` above
              always resolves to a real element, whether expanded or not. */}
          <div
            id="revisao-ata-current-minutes"
            hidden={!showCurrent}
            className="mt-2 rounded-lg border border-border bg-card p-3"
          >
            <MarkdownRenderer content={currentMinutesMd ?? ""} />
          </div>
        </div>
      )}

      {value.trim().length === 0 && (
        <p className="text-sm text-muted-foreground text-pretty">{MINUTES_UI.ataEmpty}</p>
      )}

      <SectionTextEditor
        value={value}
        onChange={onChange}
        textareaId="revisao-ata-minutes-md"
        placeholder="Escreva a ata da reunião em Markdown…"
      />
    </section>
  );
}
