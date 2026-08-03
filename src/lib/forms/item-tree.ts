import type { InputItemType, Item, ItemType, Section } from '@/lib/queries/forms'

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

/**
 * FF-2 (ADR 0089) — the two MATRIX types. They are answerable items with a
 * `question_key`, but their payload lives in `answer_matrix_cells` /
 * `answer_risk_matrix` rather than in `answers.value`, so every "does this item
 * have an answer?" check must dispatch on type rather than read `value`.
 */
export const MATRIX_ITEM_TYPES: readonly ItemType[] = ['matrix', 'risk_matrix']

// ---------------------------------------------------------------------------
// The item-type SETS — one definition, imported everywhere (BUG-FF5-001)
// ---------------------------------------------------------------------------
//
// ⚠ THESE LIVE HERE BECAUSE RE-SPELLING THEM IS THE DEFECT. `src/lib/forms/
// actions.ts` kept its own hand-written `INPUT_TYPES` / `ALL_ITEM_TYPES` /
// `ANSWERABLE_TYPES`, and they drifted twice: `matrix` fell out when FF-2 landed
// its writers, `reference` fell out when FF-5 landed its own. Both failed CLOSED
// (the builder refused to create the type), both were invisible to lint,
// typecheck, the unit suite and pgTAP, and both surfaced only when a human
// clicked the builder. That file's own comment states the rule — "imported, not
// re-spelled" — for `MATRIX_ITEM_TYPES`, and then re-spelled the two beside it.
//
// This module is the right home rather than `queries/forms.ts` because it is
// PURE: `queries/forms.ts` value-imports the server Supabase client, so a client
// component reaching these through it would abort `next build` while tsc, lint
// and vitest all stayed green (BUG-FBE-005). `queries/forms.ts` re-exports them,
// so every existing `@/lib/queries/forms` importer is unaffected.

/** The eight types whose answer is a SCALAR in `answers.value`. */
export const INPUT_ITEM_TYPES: readonly InputItemType[] = [
  'multiple_choice',
  'dropdown',
  'checkbox',
  'free_text',
  'short_text',
  'number',
  'date',
  'time',
]

/** Render-only types: the CHECK requires `content`, forbids `question_key`. */
export const DISPLAY_ITEM_TYPES: readonly ItemType[] = ['section_text', 'image']

/**
 * FF-5 (ADR 0091) — the ENTITY REFERENCE type. Defined HERE beside
 * {@link MATRIX_ITEM_TYPES} rather than in `reference-constants.ts`, for two
 * reasons: this is the module that owns item-type sets, and typing it
 * `readonly ItemType[]` there would have forced `reference-constants.ts` to
 * import from `@/lib/queries/forms`, creating an import cycle with this file and
 * costing that module its zero-import property.
 *
 * ANSWERABLE but NOT an input type: it carries a `question_key` and feeds
 * `dashboard_entity_references`, while its answer lives in `answer_references`
 * rather than `answers.value`.
 */
export const REFERENCE_ITEM_TYPES: readonly ItemType[] = ['reference']

/**
 * Every type that PRODUCES AN ANSWER — i.e. everything a dashboard may
 * aggregate, and everything `form_items_input_vs_display` requires a
 * `question_key` for.
 *
 * Deliberately NOT a widened {@link INPUT_ITEM_TYPES}: that set means "answer is
 * a scalar in `answers.value`", and a dozen call sites depend on exactly that. A
 * matrix answers in `answer_matrix_cells`, a reference in `answer_references`.
 *
 * ⚠ The mirror hazard of that split: a walk shaped
 * `if (isMatrixItem(t)) … else if (!isInput(t)) continue` silently SKIPS
 * `reference`. Dispatch on this set, or name `reference` explicitly.
 */
export const ANSWERABLE_ITEM_TYPES: readonly ItemType[] = [
  ...INPUT_ITEM_TYPES,
  ...MATRIX_ITEM_TYPES,
  ...REFERENCE_ITEM_TYPES,
]

/**
 * Every type an author may create. ⚠ A type missing here is REJECTED by
 * `addItem` with `itemTypeInvalid` — see the tombstones above.
 */
export const ALL_ITEM_TYPES: readonly string[] = [
  ...INPUT_ITEM_TYPES,
  ...DISPLAY_ITEM_TYPES,
  ...CONTAINER_ITEM_TYPES,
  ...MATRIX_ITEM_TYPES,
  ...REFERENCE_ITEM_TYPES,
]

/**
 * THE AUTHORITY MIRROR — every value `form_items_item_type_check` admits, as a
 * LITERAL tuple.
 *
 * ⚠ Written out by hand rather than derived from the sets above, deliberately.
 * Those sets are widened (`readonly ItemType[]` / `readonly string[]`) so that
 * `.includes(someString)` compiles at the call sites — which means
 * `(typeof ALL_ITEM_TYPES)[number]` is just `string`, and an exhaustiveness
 * check against `string` collapses to `never` and passes for ANY union. My first
 * attempt at this guard did exactly that: it compiled, read like a safeguard,
 * and could not have failed — the same could-not-fail shape as the three vacuous
 * keystones this phase already produced.
 *
 * As a literal tuple, BOTH directions are compile-enforced:
 *   · `satisfies readonly ItemType[]` — a typo'd member is an error;
 *   · the `Exclude` below — an `ItemType` missing here is an error.
 *
 * So widening the DB CHECK forces a widening of `ItemType` (nothing can name the
 * new type otherwise), which turns this file red in the editor.
 * `item-type-sets.test.ts` ties the runtime sets back to this tuple.
 */
export const ITEM_TYPE_AUTHORITY = [
  'multiple_choice',
  'dropdown',
  'checkbox',
  'free_text',
  'short_text',
  'number',
  'date',
  'time',
  'section_text',
  'image',
  'group',
  'repeating_group',
  'matrix',
  'risk_matrix',
  'reference',
] as const satisfies readonly ItemType[]

/** Compile error if any `ItemType` is absent from {@link ITEM_TYPE_AUTHORITY}.
 *  The `_` prefix is the project's intentionally-unused convention; the type
 *  ANNOTATION is the assertion, so the binding is never read. */
type UncoveredItemType = Exclude<ItemType, (typeof ITEM_TYPE_AUTHORITY)[number]>
const _everyItemTypeIsListed: UncoveredItemType extends never ? true : never = true

// ---------------------------------------------------------------------------
// FF-4 (ADR 0092) — the dynamic-default vocabulary
// ---------------------------------------------------------------------------

/**
 * FF-4 (ADR 0092 ruling 5) — the five PHI-free dynamic-default tokens.
 * `form_items.default_source` (BE-3) resolves ONE of these server-side at
 * draft start, seeding an unanswered item's first-shown value — idempotent,
 * never overwriting an already-answered or since-cleared item (same contract
 * `default_value` already has). A CLOSED set with a CHECK, not an open string
 * (ruling 6): a sixth token is one arm in both the DB CHECK and this tuple,
 * never a bare string comparison. `today`/`now` resolve from wall-clock time;
 * the other three from the filling user's session plus the version's owning
 * commission — no PHI, no new read path (ruling 5).
 */
export const DEFAULT_SOURCE_TOKENS = [
  'today',
  'now',
  'current_user_name',
  'current_user_email',
  'commission_name',
] as const

export type DefaultSource = (typeof DEFAULT_SOURCE_TOKENS)[number]

/** pt-BR labels for the dynamic-default picker (Architecture Rule 10). */
export const DEFAULT_SOURCE_LABELS: Readonly<Record<DefaultSource, string>> = {
  today: 'Data de hoje',
  now: 'Hora atual',
  current_user_name: 'Nome de quem preenche',
  current_user_email: 'E-mail de quem preenche',
  commission_name: 'Nome da comissão',
}

/**
 * Token → the `InputItemType`s it may seed (ADR 0092 rulings 5 + 6). One
 * definition, both directions: {@link isDefaultSourceEligible} type-gates the
 * builder's picker (FE-3) so it never OFFERS a pairing the database's
 * companion CHECK (BE-3) would reject, and the same map drives the
 * draft-start resolver (BE-6) that decides whether a saved `default_source`
 * still applies to its item's current type.
 *
 * `today`/`now` are single-type — the one scalar shape each token can seed.
 * The three text tokens share both free-text-shaped inputs: a `short_text`
 * one-liner and a `free_text` block are equally valid destinations for a
 * name, an e-mail, or a commission name.
 *
 * This is STRICTLY NARROWER than {@link INPUT_ITEM_TYPES} — the eligible set
 * for any one token is never the full eight — so, unlike
 * {@link ANSWERABLE_ITEM_TYPES}, it is not DERIVED from that set: it is its
 * own hand-authored table, mirrored by the DB CHECK rather than by another TS
 * set.
 */
export const DEFAULT_SOURCE_ELIGIBLE_TYPES: Readonly<
  Record<DefaultSource, readonly InputItemType[]>
> = {
  today: ['date'],
  now: ['time'],
  current_user_name: ['short_text', 'free_text'],
  current_user_email: ['short_text', 'free_text'],
  commission_name: ['short_text', 'free_text'],
}

/**
 * True when `source` may be assigned to an item of `itemType` (ADR 0092
 * rulings 5/6) — the predicate `save_block_to_library` / the item editor's
 * picker both gate on. Takes `string` (not {@link ItemType}) so a raw DB or
 * payload value narrows here directly, without needing its own cast first.
 */
export function isDefaultSourceEligible(
  source: DefaultSource,
  itemType: string,
): boolean {
  return (DEFAULT_SOURCE_ELIGIBLE_TYPES[source] as readonly string[]).includes(
    itemType,
  )
}

/**
 * Narrow an unknown `form_items.default_source` value to a
 * {@link DefaultSource}, else `null` — the same fallback shape as
 * `toReferenceKind` in `reference-constants.ts`.
 */
export function toDefaultSource(value: unknown): DefaultSource | null {
  return typeof value === 'string' &&
    (DEFAULT_SOURCE_TOKENS as readonly string[]).includes(value)
    ? (value as DefaultSource)
    : null
}

/** True for `matrix` / `risk_matrix`. */
export function isMatrixItem(itemType: string): boolean {
  return itemType === 'matrix' || itemType === 'risk_matrix'
}

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
