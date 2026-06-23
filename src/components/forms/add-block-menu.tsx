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
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
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
 * "Adicionar bloco" type picker: the 4 input types and 2 display types, grouped.
 * Selecting a type opens {@link ItemEditorDialog} in "add" mode for that type.
 */
export function AddBlockMenu({
  sectionId,
  sections,
  commissionId,
}: {
  sectionId: string;
  sections: Section[];
  commissionId: string;
}) {
  const [pendingType, setPendingType] = useState<ItemType | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-fit">
            <Plus aria-hidden="true" />
            Adicionar bloco
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-64">
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
