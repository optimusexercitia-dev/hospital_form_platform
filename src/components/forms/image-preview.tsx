import { ImageOff } from "lucide-react";

/**
 * Renders an `image` display block's preview from a (pre-resolved, signed) URL,
 * with its caption. Falls back to a neutral placeholder when the URL is null
 * (object missing, no access, or not yet uploaded) so the builder never shows a
 * broken image. `alt` is the author-provided alternative text (always required
 * on save). Uses a plain <img> (not next/image) because the source is a
 * short-lived signed Supabase Storage URL, not a statically known asset.
 */
export function ImagePreview({
  url,
  alt,
  caption,
}: {
  url: string | null;
  alt: string;
  caption: string | null;
}) {
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-5" />
        <span className="text-xs">Pré-visualização indisponível</span>
      </div>
    );
  }
  return (
    <figure className="flex flex-col gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL, not a static asset */}
      <img
        src={url}
        alt={alt}
        className="max-h-64 w-auto rounded-lg border border-border object-contain"
      />
      {caption && (
        <figcaption className="text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
