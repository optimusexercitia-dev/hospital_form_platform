"use client";

import type { Json } from "@/lib/types/database";
import type {
  ImageContent,
  Item,
  SectionTextContent,
} from "@/lib/queries/forms";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { ImagePreview } from "@/components/forms/image-preview";

import { InputItem } from "./input-item";

/**
 * Renders one block within a section (F3): display blocks (`section_text`,
 * `image`) render-only; input blocks collect an answer.
 *
 *  - `section_text` → the project's ONE sanitizing Markdown renderer (Rule 7);
 *    never `dangerouslySetInnerHTML`.
 *  - `image` → `ImagePreview` from a pre-resolved signed URL (the route page
 *    resolves `storage_path → signed URL` server-side, same as the builder).
 *  - input items → `InputItem` (state-managed, accessible).
 */
export function BlockRenderer({
  item,
  imageUrls,
  value,
  onChange,
  error,
}: {
  item: Item;
  imageUrls: Record<string, string>;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
}) {
  if (item.itemType === "section_text" && item.content) {
    return (
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <MarkdownRenderer
          content={(item.content as SectionTextContent).markdown}
        />
      </div>
    );
  }

  if (item.itemType === "image" && item.content) {
    const content = item.content as ImageContent;
    return (
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <ImagePreview
          url={imageUrls[content.storage_path] ?? null}
          alt={content.alt}
          caption={content.caption ?? null}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <InputItem item={item} value={value} onChange={onChange} error={error} />
    </div>
  );
}
