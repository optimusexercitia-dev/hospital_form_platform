"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Chip input for a free-text tag set. `Enter` or `,` commits the draft; `Backspace`
 * on an empty draft removes the last chip; each chip has a keyboard-reachable ×.
 * Controlled — the parent owns `value` and serializes it (the wizard posts a JSON
 * `tags` field). Case-insensitive de-dupe, capped at `maxTags`. Token-driven, and
 * the whole surface reads as one focusable input (clicking anywhere focuses the
 * draft field).
 */
export function TagField({
  value,
  onChange,
  id,
  placeholder = "Adicionar etiqueta…",
  disabled = false,
  describedBy,
  invalid = false,
  maxTags = 12,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
  maxTags?: number;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    if (value.length >= maxTags) return;
    onChange([...value, tag]);
    setDraft("");
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      removeTag(value.length - 1);
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow,border-color]",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
        invalid && "border-destructive ring-[3px] ring-destructive/20",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            aria-label={`Remover etiqueta ${tag}`}
            className="rounded-full outline-none hover:text-foreground focus-visible:ring-[2px] focus-visible:ring-ring/50"
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={draft}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        placeholder={value.length === 0 ? placeholder : ""}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(draft)}
        className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
      />
    </div>
  );
}
