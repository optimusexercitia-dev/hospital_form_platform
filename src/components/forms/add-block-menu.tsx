"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type { ItemType, Section } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONTAINER_TYPES, ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import { ItemEditorDialog } from "@/components/forms/item-editor-dialog";

const INPUT_TYPES: ItemType[] = [
  "multiple_choice",
  "dropdown",
  "checkbox",
  "short_text",
  "free_text",
  "number",
  "date",
  "time",
];
const DISPLAY_TYPES: ItemType[] = ["section_text", "image"];

/**
 * "Adicionar bloco" type picker: the 8 input types and 2 display types, grouped,
 * plus — behind the `repeating_groups` flag (FF-1, ADR 0087) — the 2 CONTAINER
 * types under "Estrutura". Selecting a type opens {@link ItemEditorDialog} in
 * "add" mode for that type.
 *
 * Two modes, one component:
 *   - SECTION mode (`parentItem` omitted) — adds a top-level block to the
 *     section; offers containers when the flag is on.
 *   - CHILD mode (`parentItem` set) — adds a block INSIDE that container. It
 *     never offers a container, because depth is capped at 1 (ruling 1,
 *     enforced by `form_items_no_nested_container`): offering a nesting the
 *     database refuses would be a trap, not a feature.
 */
export function AddBlockMenu({
  sectionId,
  sections,
  commissionId,
  containersEnabled = false,
  parentItem,
}: {
  sectionId: string;
  sections: Section[];
  commissionId: string;
  /** The `repeating_groups` feature flag. Containers are offered only when ON. */
  containersEnabled?: boolean;
  /** The container this menu adds INTO; omitted for a top-level "Adicionar bloco". */
  parentItem?: { id: string; label: string | null };
}) {
  const [pendingType, setPendingType] = useState<ItemType | null>(null);

  const isChildMode = parentItem != null;
  // Depth cap: a container may never be offered inside a container.
  const showContainers = containersEnabled && !isChildMode;
  const triggerLabel = isChildMode ? "Adicionar pergunta ao grupo" : "Adicionar bloco";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-fit">
            <Plus aria-hidden="true" />
            {triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          collisionPadding={8}
          className="max-h-[--radix-dropdown-menu-content-available-height] min-w-64 overflow-y-auto"
        >
          <DropdownMenuLabel>Perguntas</DropdownMenuLabel>
          {INPUT_TYPES.map((type) => (
            <BlockTypeItem
              key={type}
              type={type}
              onSelect={() => setPendingType(type)}
            />
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Conteúdo</DropdownMenuLabel>
          {DISPLAY_TYPES.map((type) => (
            <BlockTypeItem
              key={type}
              type={type}
              onSelect={() => setPendingType(type)}
            />
          ))}
          {showContainers ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Estrutura</DropdownMenuLabel>
              {CONTAINER_TYPES.map((type) => (
                <BlockTypeItem
                  key={type}
                  type={type}
                  onSelect={() => setPendingType(type)}
                />
              ))}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {pendingType && (
        <ItemEditorDialog
          open={pendingType != null}
          onOpenChange={(open) => {
            if (!open) setPendingType(null);
          }}
          mode="add"
          itemType={pendingType}
          sectionId={sectionId}
          sections={sections}
          commissionId={commissionId}
          imageUrl={null}
          parentItem={parentItem}
        />
      )}
    </>
  );
}

function BlockTypeItem({
  type,
  onSelect,
}: {
  type: ItemType;
  onSelect: () => void;
}) {
  const meta = ITEM_TYPE_META[type];
  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start gap-2.5">
      <meta.Icon aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
      <span className="flex flex-col">
        <span className="font-medium">{meta.label}</span>
        <span className="text-xs text-muted-foreground">{meta.description}</span>
      </span>
    </DropdownMenuItem>
  );
}
