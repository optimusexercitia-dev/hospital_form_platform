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
import {
  CONTAINER_TYPES,
  ITEM_TYPE_META,
  MATRIX_TYPES,
} from "@/components/forms/item-type-meta";
import { ItemEditorDialog } from "@/components/forms/item-editor-dialog";
import { useBuilderFlags } from "@/components/forms/builder-flags";

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
 * types under "Estrutura", and — behind the `matrix_fields` flag (FF-2, ADR
 * 0089) — the 2 MATRIX types under "Matrizes". Selecting a type opens
 * {@link ItemEditorDialog} in "add" mode for that type.
 *
 * Two modes, one component:
 *   - SECTION mode (`parentItem` omitted) — adds a top-level block to the
 *     section; offers containers when the flag is on.
 *   - CHILD mode (`parentItem` set) — adds a block INSIDE that container. It
 *     never offers a container, because depth is capped at 1 (ruling 1,
 *     enforced by `form_items_no_nested_container`): offering a nesting the
 *     database refuses would be a trap, not a feature. A MATRIX is offered in
 *     both modes — it is an answerable item, not a container, so it may live
 *     inside a repeating group and answer per instance.
 */
export function AddBlockMenu({
  sectionId,
  sections,
  commissionId,
  parentItem,
}: {
  sectionId: string;
  sections: Section[];
  commissionId: string;
  /** The container this menu adds INTO; omitted for a top-level "Adicionar bloco". */
  parentItem?: { id: string; label: string | null };
}) {
  const [pendingType, setPendingType] = useState<ItemType | null>(null);
  // FF-2: the flags come from the builder root's provider rather than from a
  // boolean threaded through five components that have no opinion about them.
  const flags = useBuilderFlags();

  const isChildMode = parentItem != null;
  // Depth cap: a container may never be offered inside a container.
  const showContainers = flags.containers && !isChildMode;
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
          // BUG-FF2-003 — the cap MUST keep the explicit var() call.
          //
          // It was previously written with Tailwind 3.4's shorthand, where a
          // bare custom property inside square brackets was auto-wrapped in
          // var(). Tailwind v4 removed that shorthand, so the utility emitted a
          // max-height whose value was the raw property NAME rather than its
          // value — invalid CSS, dropped by the parser, leaving max-height:none.
          // The class read correct and did nothing: at 1280x720 the menu grew to
          // 909px, 7 of 14 items sat off-screen (both matrix types among them),
          // and overflow-y-auto could not scroll because there was no cap to
          // overflow against. The (--x) form is the equivalent v4 shorthand and
          // is what the ui/ primitives use; either works, var() is explicit.
          //
          // Deliberately prose, not a code sample: v4 scans raw source TEXT,
          // comments included, so spelling the broken class here would mint it
          // as a real (dead) selector in the bundle — which is exactly what the
          // first draft of this comment did.
          className="max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-64 overflow-y-auto"
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
          {flags.matrix ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Matrizes</DropdownMenuLabel>
              {MATRIX_TYPES.map((type) => (
                <BlockTypeItem
                  key={type}
                  type={type}
                  onSelect={() => setPendingType(type)}
                />
              ))}
            </>
          ) : null}
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
