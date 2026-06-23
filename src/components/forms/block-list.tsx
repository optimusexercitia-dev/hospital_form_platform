"use client";

import type { Section } from "@/lib/queries/forms";
import { BlockCard } from "@/components/forms/block-card";
import { AddBlockMenu } from "@/components/forms/add-block-menu";
import { useFlipReorder } from "@/components/forms/use-flip-reorder";

/**
 * The ordered list of blocks (input + display items) inside one section, plus
 * the "Adicionar bloco" type picker. Reorder is animated (GSAP Flip) and
 * reduced-motion-safe; each op persists via its own action and the view
 * refreshes from the server.
 */
export function BlockList({
  section,
  sections,
  commissionId,
  imageUrls,
}: {
  section: Section;
  sections: Section[];
  commissionId: string;
  imageUrls: Record<string, string>;
}) {
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLDivElement>();

  const items = section.items;

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum bloco nesta seção ainda. Adicione uma pergunta, um texto ou uma
          imagem.
        </p>
      ) : (
        <div ref={containerRef} className="flex flex-col gap-3">
          {items.map((item, index) => (
            <BlockCard
              key={item.id}
              item={item}
              index={index}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              sections={sections}
              currentSectionId={section.id}
              commissionId={commissionId}
              imageUrl={
                item.itemType === "image" && item.content
                  ? (imageUrls[
                      (item.content as { storage_path?: string }).storage_path ??
                        ""
                    ] ?? null)
                  : null
              }
              onBeforeReorder={captureBeforeReorder}
            />
          ))}
        </div>
      )}

      <AddBlockMenu
        sectionId={section.id}
        sections={sections}
        commissionId={commissionId}
      />
    </div>
  );
}
