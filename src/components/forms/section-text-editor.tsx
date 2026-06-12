"use client";

import { useId, useState } from "react";
import { Eye, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

type Mode = "edit" | "preview";

/**
 * Controlled Markdown editor for a `section_text` display block, with a live
 * SANITIZED preview rendered through the project's one renderer
 * ({@link MarkdownRenderer}) — so what the author previews is exactly what other
 * users will see, already stripped of any unsafe HTML (ARCHITECTURE.md Rule 7).
 *
 * Presentational + controlled: it owns no persistence. The parent supplies
 * `value`/`onChange` and decides when to persist (each builder block op persists
 * immediately via its own server action). A small "Editar / Pré-visualizar"
 * toggle keeps the card calm instead of showing two panes at once.
 */
export function SectionTextEditor({
  value,
  onChange,
  disabled = false,
  textareaId,
  describedById,
  placeholder = "Escreva o texto explicativo em Markdown…",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Wire the textarea to an external <label> for accessibility. */
  textareaId?: string;
  /** Optional id of helper text describing the field. */
  describedById?: string;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<Mode>("edit");
  const generatedId = useId();
  const id = textareaId ?? generatedId;
  const hasContent = value.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label="Modo de edição do texto"
        className="flex w-fit items-center gap-1 rounded-lg bg-muted p-0.5"
      >
        <ModeTab
          active={mode === "edit"}
          onClick={() => setMode("edit")}
          controls={`${id}-edit`}
          icon={<Pencil aria-hidden="true" className="size-3.5" />}
          label="Editar"
        />
        <ModeTab
          active={mode === "preview"}
          onClick={() => setMode("preview")}
          controls={`${id}-preview`}
          icon={<Eye aria-hidden="true" className="size-3.5" />}
          label="Pré-visualizar"
        />
      </div>

      {mode === "edit" ? (
        <div role="tabpanel" id={`${id}-edit`}>
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-describedby={describedById}
            placeholder={placeholder}
            className="min-h-32 font-mono text-sm"
          />
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${id}-preview`}
          className="min-h-32 rounded-lg border border-border bg-card p-4"
        >
          {hasContent ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nada para pré-visualizar ainda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  controls,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  controls: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
