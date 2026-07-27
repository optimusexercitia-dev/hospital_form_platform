import type { Item, ItemType, Section } from '@/lib/queries/forms'

/**
 * FF-1 (ADR 0087) — the CLIENT-SAFE container-tree walkers.
 *
 * `src/lib/queries/forms.ts` owns the canonical {@link flattenItem} and
 * `CONTAINER_ITEM_TYPES`, but it value-imports the server Supabase client at
 * module top, so a Client Component that value-imports ANYTHING from it drags
 * `next/headers` into the browser bundle and aborts `next build` (BUG-FBE-005).
 * This module is the pure mirror the wizard + builder consume, exactly like
 * `option-constants.ts` mirrors the reserved "Outros" code. Type-only imports
 * from the query layer are safe and keep the shapes from drifting.
 *
 * Depth is capped at 1 (ADR 0087 ruling 1, enforced by
 * `form_items_no_nested_container`), so every walk here is a single pass — a
 * child never owns children of its own.
 */

/** The two CONTAINER types (mirror of `CONTAINER_ITEM_TYPES`). */
export const CONTAINER_ITEM_TYPES: readonly ItemType[] = [
  'group',
  'repeating_group',
]

/** True for `group` / `repeating_group` — items that collect no answer of their
 *  own and instead own child items via `form_items.parent_item_id`. */
export function isContainerItem(itemType: string): boolean {
  return itemType === 'group' || itemType === 'repeating_group'
}

/**
 * True only for `repeating_group` — the container that owns INSTANCE rows
 * (`response_group_instances`). A plain `group` is a purely visual sub-section
 * (ruling 6): no instances, children answer at TOP LEVEL, and their
 * `question_key`s stay ordinary condition targets everywhere.
 */
export function isRepeatingGroup(itemType: string): boolean {
  return itemType === 'repeating_group'
}

/**
 * One item followed by its children, in render order — the pure mirror of
 * `flattenItem`. The single helper every "walk every item" caller must use now
 * that `Section.items` holds only TOP-LEVEL items; forgetting it silently skips
 * every container child (the exact bug class BE-0 made `children` required to
 * prevent).
 */
export function flattenItem(item: Item): Item[] {
  return item.children.length === 0 ? [item] : [item, ...item.children]
}

/** Every item of a section in document order — top-level items with each
 *  container's children spliced in immediately after it. */
export function sectionItems(section: Section): Item[] {
  return section.items.flatMap(flattenItem)
}

/** Every item of the whole tree in document order (sections in order, then
 *  {@link sectionItems} within each). */
export function allItems(sections: Section[]): Item[] {
  return sections.flatMap(sectionItems)
}

/**
 * `childId → its container Item`, for every child in the tree. The lookup that
 * answers "is this item inside a repeating group?" — the question ADR 0087
 * ruling 2's condition scoping and the wizard's instance routing both turn on.
 */
export function containerByChildId(sections: Section[]): Map<string, Item> {
  const map = new Map<string, Item>()
  for (const section of sections) {
    for (const item of section.items) {
      for (const child of item.children) map.set(child.id, item)
    }
  }
  return map
}

/**
 * The `repeating_group` an item lives inside, or `null` when it is top-level or
 * a child of a plain `group`. Under the depth-1 cap this is just "my parent, if
 * my parent repeats" — no ancestor chain to walk.
 */
export function repeatingGroupOf(
  item: Item,
  containers: Map<string, Item>,
): Item | null {
  const parent = containers.get(item.id)
  if (!parent) return null
  return isRepeatingGroup(parent.itemType) ? parent : null
}

/**
 * Every `repeating_group` of a section, in document order. Drives the wizard's
 * per-group instance rendering and the builder's cardinality summary.
 */
export function repeatingGroupsOf(section: Section): Item[] {
  return section.items.filter((item) => isRepeatingGroup(item.itemType))
}
