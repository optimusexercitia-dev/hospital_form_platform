import { describe, expect, it } from 'vitest'

import { coerceDraft } from './queries'
import { sanitizeDraft } from './sanitize'
import { defaultMakeKey, normalizeMinutes } from './normalize'
import type { Minutes } from '@/lib/audio-jobs/types'
import type { MinutesDraft } from './types'

/**
 * REGRESSION — the draft round trip must be LOSSLESS.
 *
 * The bug this pins was not a display gap, it was silent data loss:
 *
 *   1. the normalizer produced `unassigned_resolutions` (real committee decisions whose
 *      positional `agenda_item_index` matched nothing) and the row stored them;
 *   2. `coerceDraft` rebuilt the draft FIELD BY FIELD and did not enumerate that key, so
 *      the review page never received it;
 *   3. `save_minutes_draft` is a whole-column OVERWRITE (`update … set draft = p_draft`,
 *      verified in the catalog), so the FIRST AUTOSAVE — a few seconds after the reviewer
 *      opened the page — wrote the truncated object back and destroyed them permanently.
 *
 * ⭐ The specific field matters less than the SHAPE: any field-by-field rebuilder drops
 * whatever the author forgot, and it typechecks perfectly, because the compiler cannot
 * see an omission in a value it was asked to construct. A test that lists today's keys
 * would not catch tomorrow's field either — so the key set below is derived from a
 * COMPILE-ENFORCED record instead of a hand-written array. Add a field to `MinutesDraft`
 * and this file stops compiling until the fixture covers it; the round-trip assertions
 * then protect the new field for free.
 */

/**
 * Every key of `MinutesDraft`, enforced by the type system.
 *
 * `Record<keyof MinutesDraft, true>` fails to compile the moment a field is added to the
 * interface and not listed here ("Property 'x' is missing"). That is the whole mechanism:
 * it converts "someone must remember to update a test" into "the build stops".
 */
const DRAFT_KEYS: Record<keyof MinutesDraft, true> = {
  minutes_md: true,
  agenda: true,
  action_items: true,
  next_meeting: true,
  speakers: true,
  unassigned_resolutions: true,
}

const ALL_DRAFT_KEYS = Object.keys(DRAFT_KEYS).sort()

/** A draft with EVERY field populated with something distinguishable. */
function fullDraft(): MinutesDraft {
  return {
    minutes_md: '# Ata\n\nQuórum 3 < 5.',
    agenda: [
      {
        key: 'agenda-0',
        ref: 'ai-1',
        title: 'Pauta',
        existing_discussion_notes: 'antigo',
        existing_resolution: null,
        discussion_notes: 'novo',
        resolution: 'aprovado',
        include: true,
      },
    ],
    action_items: [
      {
        key: 'action-0',
        title: 'Ação',
        description: 'desc',
        assigned_to: 'user-1',
        owner_ref: 'att-1',
        owner_text: 'a Ana',
        due_date: '2026-12-01',
        deadline_text: 'dezembro',
        agenda_ref: 'ai-1',
        include: true,
      },
    ],
    next_meeting: { suggested_date: '2026-12-15', location_text: 'Sala 2', note: 'dia 15' },
    speakers: [{ label: 'Dra. Ana', attendee_ref: 'att-1', utterance_count: 3, spoke: true }],
    unassigned_resolutions: [
      { key: 'res-0', text: 'Decisão sem item de pauta' },
      { key: 'res-1', text: 'Outra decisão solta' },
    ],
  }
}

describe('the draft round trip preserves the WHOLE key set', () => {
  it('coerceDraft returns every key of MinutesDraft', () => {
    // Not "the five fields someone remembered" — the compile-enforced set.
    expect(Object.keys(coerceDraft(fullDraft())).sort()).toEqual(ALL_DRAFT_KEYS)
  })

  it('coerceDraft → sanitizeDraft (the F3 open→autosave path) preserves the key set', () => {
    const stored = fullDraft()
    const loaded = coerceDraft(stored)
    const written = sanitizeDraft(loaded)
    expect(Object.keys(written).sort()).toEqual(ALL_DRAFT_KEYS)
  })

  it('the EMPTY draft also carries every key', () => {
    // The degenerate branch is a second field-by-field constructor, and it drifts the
    // same way. `coerceDraft(null)` must not hand F3 a draft missing an array it renders.
    for (const value of [null, undefined, 'nope', 42, []]) {
      expect(Object.keys(coerceDraft(value)).sort()).toEqual(ALL_DRAFT_KEYS)
    }
  })

  it('round-trips the VALUES, not merely the keys', () => {
    const stored = fullDraft()
    const written = sanitizeDraft(coerceDraft(stored))
    // minutes_md is deliberately the one field allowed to change (sanitization).
    expect(written).toEqual({ ...stored, minutes_md: written.minutes_md })
    expect(written.minutes_md).toContain('3 < 5')
  })
})

describe('unassigned_resolutions specifically (D6 — a lost decision is unrecoverable)', () => {
  it('survives the load→autosave sequence that used to destroy it', () => {
    const stored = fullDraft()
    const written = sanitizeDraft(coerceDraft(stored))
    expect(written.unassigned_resolutions).toEqual([
      { key: 'res-0', text: 'Decisão sem item de pauta' },
      { key: 'res-1', text: 'Outra decisão solta' },
    ])
  })

  it('reaches the draft straight from the normalizer, under the SAME field name', () => {
    // Closes the loop end to end: service payload → normalizer → (row) → coerce → save.
    // The name is the contract F3 builds `agenda-review-card.tsx` against.
    const minutes: Minutes = {
      committee: 'CCIH',
      attendees: [],
      unidentified_speakers: [],
      agenda_items: [{ ref: 'ai-1', title: 'Pauta', discussion: '' }],
      resolutions: [
        { text: 'Aprovado', agenda_item_index: 0 },
        { text: 'Decisão órfã', agenda_item_index: null },
        { text: 'Índice inválido', agenda_item_index: 42 },
      ],
      action_items: [],
    }
    const normalized = normalizeMinutes(minutes, {
      resolveOwnerUserId: () => null,
      resolveAttendeeName: () => null,
      makeKey: defaultMakeKey,
    })

    expect(normalized.unassigned_resolutions.map((r) => r.text)).toEqual([
      'Decisão órfã',
      'Índice inválido',
    ])
    // …and the same two survive a full store→load→save cycle.
    const written = sanitizeDraft(coerceDraft(JSON.parse(JSON.stringify(normalized))))
    expect(written.unassigned_resolutions.map((r) => r.text)).toEqual([
      'Decisão órfã',
      'Índice inválido',
    ])
  })

  it('degrades a non-array to [] rather than handing F3 something it cannot map', () => {
    const draft = coerceDraft({ ...fullDraft(), unassigned_resolutions: 'corrupted' })
    expect(draft.unassigned_resolutions).toEqual([])
  })
})

describe('preserve-by-default: the class of bug, not just the instance', () => {
  it('carries an UNKNOWN key through the round trip untouched', () => {
    // The generalization. A draft written by a NEWER deploy and read by an older one
    // mid-rollout must not be truncated by the older one's first autosave — and the next
    // field added to MinutesDraft is protected before anyone remembers to update
    // coerceDraft. This is what a field-by-field rebuilder cannot do.
    const stored = { ...fullDraft(), some_future_field: { nested: ['value'] } }
    // Double cast on purpose: `MinutesDraft` has no index signature, and the WHOLE POINT
    // is that a key outside the declared type survives. A single cast is a type error.
    const written = sanitizeDraft(coerceDraft(stored)) as unknown as Record<string, unknown>
    expect(written.some_future_field).toEqual({ nested: ['value'] })
  })

  it('still coerces the KNOWN fields even while preserving unknown ones', () => {
    // Preserve-by-default must not become trust-everything: F3 renders these.
    const draft = coerceDraft({
      minutes_md: 42,
      agenda: 'nope',
      action_items: null,
      next_meeting: 'nope',
      speakers: undefined,
      unassigned_resolutions: {},
      extra: 'kept',
    })
    expect(draft).toMatchObject({
      minutes_md: '',
      agenda: [],
      action_items: [],
      next_meeting: null,
      speakers: [],
      unassigned_resolutions: [],
    })
    expect((draft as unknown as Record<string, unknown>).extra).toBe('kept')
  })
})
