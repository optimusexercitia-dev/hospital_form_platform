import { describe, expect, it } from 'vitest'

import {
  ALL_ITEM_TYPES,
  ANSWERABLE_ITEM_TYPES,
  CONTAINER_ITEM_TYPES,
  DISPLAY_ITEM_TYPES,
  INPUT_ITEM_TYPES,
  ITEM_TYPE_AUTHORITY,
  MATRIX_ITEM_TYPES,
  REFERENCE_ITEM_TYPES,
} from '@/lib/forms/item-tree'

/**
 * BUG-FF5-001 — the regression guard for a defect class that has now shipped
 * TWICE for the same reason.
 *
 * `src/lib/forms/actions.ts` kept hand-written copies of the item-type sets. The
 * copy lost `matrix` when FF-2 landed its writers (so `upsert_matrix_axes` was
 * unreachable in the product while every one of its own tests passed), and lost
 * `reference` when FF-5 landed its own (so the builder offered "Referência" and
 * refused to create it). Both failed CLOSED, so no bad data — and both were
 * invisible to lint, typecheck, the unit suite AND pgTAP, because not one of
 * those gates crosses the seam between the allowlist and the database.
 *
 * ⚠ THE REAL FIX IS NOT THIS FILE — it is that the sets now live once, in the
 * pure `item-tree`, and `actions.ts` imports them. This file is the belt to that
 * braces: it fails if the sets stop covering the DB CHECK.
 *
 * ⚠ WHAT THE AUTHORITY IS. `form_items_item_type_check` defines which types
 * exist; `form_items_input_vs_display` defines what each must carry.
 * {@link ITEM_TYPE_AUTHORITY} mirrors the former as a literal tuple, and is
 * compile-checked against `ItemType` in BOTH directions (see its definition).
 * The chain that makes a future widening visible:
 *
 *   DB CHECK gains a type
 *     -> `ItemType` must gain it (nothing can name the type otherwise)
 *       -> `ITEM_TYPE_AUTHORITY` reds AT COMPILE TIME (the Exclude guard)
 *         -> these tests red until the sets cover it.
 *
 * The residual gap, stated honestly: nothing here reads the live database, so a
 * CHECK widened WITHOUT touching `ItemType` is invisible to this file. That
 * combination is not reachable in practice — an item type no TypeScript can name
 * cannot be authored, rendered, or answered — but it is the limit of the claim.
 */

/** Every type the DB CHECK admits that an author may CREATE in the builder. */
const EXPECTED_ALL = [...ITEM_TYPE_AUTHORITY].sort()

/**
 * The types `form_items_input_vs_display` REQUIRES a `question_key` for: the
 * eight scalar inputs, the matrix pair, and `reference`. Containers and display
 * items are excluded by that same CHECK (`question_key IS NULL`).
 */
const EXPECTED_ANSWERABLE = [
  'multiple_choice',
  'dropdown',
  'checkbox',
  'free_text',
  'short_text',
  'number',
  'date',
  'time',
  'matrix',
  'risk_matrix',
  'reference',
].sort()

describe('item-type sets — the builder allowlist mirrors the DB CHECK', () => {
  it('ALL_ITEM_TYPES covers every type form_items_item_type_check admits', () => {
    // The assertion that would have caught BOTH shipped defects. Set-equality,
    // not a subset test: a type the builder offers but the DB rejects is just as
    // broken as one the DB admits and the builder refuses.
    expect([...ALL_ITEM_TYPES].sort()).toEqual(EXPECTED_ALL)
  })

  it('ANSWERABLE_ITEM_TYPES is exactly the question_key-bearing set', () => {
    // Missing `reference` here does NOT fail closed — it mints `question_key =
    // null` against a CHECK that forbids it, so the insert dies with a raw 23514
    // instead of pt-BR copy. That is why the two lists are asserted separately:
    // fixing only the allowlist swaps one failure for a worse one.
    expect([...ANSWERABLE_ITEM_TYPES].sort()).toEqual(EXPECTED_ANSWERABLE)
  })

  it('every answerable type is also creatable', () => {
    // Cross-tie: the two lists cannot drift apart in the one direction the
    // set-equality tests above would each individually tolerate.
    // FUP-VACUOUS-AUDIT-1: an emptied ANSWERABLE_ITEM_TYPES would satisfy "every
    // answerable type is creatable" vacuously — the strongest-sounding claim in
    // this file is the one an empty set makes true. Pin the population first.
    expect(ANSWERABLE_ITEM_TYPES.length).toBeGreaterThan(0)
    for (const type of ANSWERABLE_ITEM_TYPES) {
      expect(ALL_ITEM_TYPES).toContain(type)
    }
  })

  it('the constituent sets partition ALL_ITEM_TYPES with no overlap', () => {
    // Guards the composition itself. A type appearing in two sets would be
    // duplicated in ALL_ITEM_TYPES, and a `.includes()` gate elsewhere could
    // then dispatch it down the wrong arm — e.g. a `reference` that also read as
    // a matrix would be sent looking for axes it does not have.
    const parts = [
      ...INPUT_ITEM_TYPES,
      ...DISPLAY_ITEM_TYPES,
      ...CONTAINER_ITEM_TYPES,
      ...MATRIX_ITEM_TYPES,
      ...REFERENCE_ITEM_TYPES,
    ]
    expect(new Set(parts).size).toBe(parts.length)
    expect(parts.sort()).toEqual(EXPECTED_ALL)
  })

  it('reference is answerable but NOT an input type', () => {
    // The specific distinction FF-5 rests on, pinned so a future "tidy-up" that
    // folds `reference` into INPUT_ITEM_TYPES reds here. Its `answers.value` is
    // always null; the eight input types' plumbing reads exactly that column.
    expect(ANSWERABLE_ITEM_TYPES).toContain('reference')
    expect(INPUT_ITEM_TYPES).not.toContain('reference')
    expect(ALL_ITEM_TYPES).toContain('reference')
  })
})
