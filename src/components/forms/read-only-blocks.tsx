import type { ImageContent, SectionTextContent } from "@/lib/queries/forms";
import { ImagePreview } from "@/components/forms/image-preview";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

/**
 * Small, reusable read-only renderers for the two display-block types
 * (`section_text`, `image`), extracted so both the version-faithful structure
 * view (`read-only-tree.tsx`) and the sign-off review-and-sign screen render
 * display blocks identically. Markdown goes ONLY through the sanitizing
 * `MarkdownRenderer` (ARCHITECTURE Rule 7 — never raw HTML).
 *
 * Both accept the item's raw `content` jsonb (narrowed here) so callers don't
 * each repeat the cast.
 */

export function SectionTextRenderer({
  content,
  className,
}: {
  content: SectionTextContent | ImageContent;
  className?: string;
}) {
  const markdown = (content as SectionTextContent).markdown;
  return (
    <div
      className={
        className ?? "rounded-xl border border-border bg-background/60 p-4"
      }
    >
      <MarkdownRenderer content={markdown} />
    </div>
  );
}

export function ImageContentRenderer({
  content,
  imageUrls,
  className,
}: {
  content: SectionTextContent | ImageContent;
  imageUrls: Record<string, string>;
  className?: string;
}) {
  const image = content as ImageContent;
  return (
    <div
      className={
        className ?? "rounded-xl border border-border bg-background/60 p-4"
      }
    >
      <ImagePreview
        url={imageUrls[image.storage_path] ?? null}
        alt={image.alt}
        caption={image.caption ?? null}
      />
    </div>
  );
}
