"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImageUp } from "lucide-react";

import { uploadFormAsset } from "@/lib/forms/actions";
import { Button } from "@/components/ui/button";
import { ImagePreview } from "@/components/forms/image-preview";

/** Mirrors the bucket's allowed image mime types (server enforces too). */
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * Image upload UI for the `image` display block (F5). Picks a file, uploads it to
 * `form-assets` via {@link uploadFormAsset} (RLS-scoped, staff_admin policy — no
 * service role), and reports the resulting IMMUTABLE storage path up to the item
 * editor. A re-upload always lands at a new path (Architecture Rule 6), so older
 * versions keep rendering their original object.
 *
 * Preview uses an in-browser object URL of the just-picked file (no signed-URL
 * round trip needed to show what was selected); for an already-saved image the
 * parent passes the server-resolved signed `previewUrl`. The author-provided alt
 * text is edited in a separate field by the parent.
 */
export function ImageItemEditor({
  commissionId,
  storagePath,
  previewUrl,
  onUploaded,
  onUploadingChange,
}: {
  commissionId: string;
  storagePath: string;
  previewUrl: string | null;
  onUploaded: (storagePath: string, previewUrl: string | null) => void;
  /** Reports upload progress so the parent can block submit mid-upload (which
   *  would otherwise persist the previous/stale path). */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onUploadingChange?.(isPending);
  }, [isPending, onUploadingChange]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    setError(null);

    const localUrl = URL.createObjectURL(file);
    startTransition(async () => {
      const result = await uploadFormAsset(commissionId, file);
      if (!result.ok || !result.storagePath) {
        URL.revokeObjectURL(localUrl);
        setError(result.error ?? "Não foi possível enviar a imagem.");
        return;
      }
      onUploaded(result.storagePath, localUrl);
    });
  }

  const hasImage = Boolean(storagePath);

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={handleFile}
        tabIndex={-1}
        aria-hidden="true"
      />
      <ImagePreview url={previewUrl} alt="" caption={null} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
        >
          <ImageUp aria-hidden="true" />
          {isPending
            ? "Enviando…"
            : hasImage
              ? "Trocar imagem"
              : "Enviar imagem"}
        </Button>
        <span className="text-xs text-muted-foreground">
          PNG, JPG, WEBP ou GIF, até 5 MB.
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
