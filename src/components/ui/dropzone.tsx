"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Human-readable byte size (pt-BR-safe: no localized separators needed). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Uppercase extension label for the file glyph (from the name, else "DOC"). */
function extLabel(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1) : "";
  return (ext || "doc").slice(0, 4).toUpperCase();
}

/**
 * Drag-and-drop file target layered over a REAL `<input type="file">`, so a
 * native `<form>` submit still serializes the file (the input's `.files` is kept
 * in sync via a `DataTransfer` on drop). Click or keyboard (Enter/Space on the
 * focusable button) opens the OS picker; the filled state shows a file card with
 * a glyph, mono name, size and a Remove control. Controlled for DISPLAY only —
 * the parent gets `onFileChange` to gate its own validation; the input remains
 * the source of truth for form serialization. Token-driven; reduced-motion safe.
 */
export function Dropzone({
  file,
  onFileChange,
  id,
  name,
  accept,
  disabled = false,
  describedBy,
  invalid = false,
  hint,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  id?: string;
  /** The field name posted in a native form submit (e.g. `"file"`). */
  name?: string;
  accept?: string;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  /** Mirror a dropped/cleared file into the real input so form submit serializes it. */
  function syncInput(next: File | null) {
    if (!inputRef.current) return;
    if (!next) {
      inputRef.current.value = "";
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(next);
    inputRef.current.files = dt.files;
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) {
      syncInput(dropped);
      onFileChange(dropped);
    }
  }

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function clearFile() {
    syncInput(null);
    onFileChange(null);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Real input — visually hidden but present for native form serialization. */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        className="sr-only"
      />

      {file ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs",
            invalid && "border-destructive",
          )}
        >
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FileText aria-hidden="true" className="size-5" />
            <span className="absolute -bottom-1 rounded bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {extLabel(file.name)}
            </span>
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-mono text-sm text-foreground">
              {file.name}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatBytes(file.size)} · Anexado
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              Trocar
            </button>
            <button
              type="button"
              onClick={clearFile}
              disabled={disabled}
              aria-label="Remover arquivo"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <X aria-hidden="true" className="size-4" />
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-describedby={describedBy}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center outline-none transition-colors",
            "focus-visible:ring-[3px] focus-visible:ring-ring/40",
            dragging
              ? "border-primary bg-accent/40"
              : "border-border bg-muted/20 hover:border-primary/40 hover:bg-accent/20",
            invalid && "border-destructive",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <UploadCloud aria-hidden="true" className="size-5" />
          </span>
          <span className="text-sm font-medium text-foreground">
            Arraste o arquivo aqui ou clique para selecionar
          </span>
          {hint ? (
            <span className="text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </button>
      )}
    </div>
  );
}
