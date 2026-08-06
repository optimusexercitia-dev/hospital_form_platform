import { describe, expect, it } from 'vitest'

import type { Minutes } from '@/lib/audio-jobs/types'
import {
  defaultMakeKey,
  foldVerbatimIntoDescription,
  normalizeMinutes,
  type NormalizeContext,
} from './normalize'
import type { MinutesDraftActionItem } from './types'

/**
 * T2 — the draft normalizer (ADR 0099 D5/D6/D7/D12).
 *
 * Every case here corresponds to a real mismatch between the service's `Minutes` (its
 * `app/schemas.py`, `schema_version` 2.1) and the review shape `apply_minutes_review`
 * reads. They are not hypotheticals — each was found by reading the service contract.
 */

const ctx: NormalizeContext = {
  resolveOwnerUserId: (ref) => (ref === 'att-member' ? 'user-1' : null),
  resolveAttendeeName: (ref) => (ref === 'att-member' ? 'Dra. Ana' : null),
  makeKey: defaultMakeKey,
}

function minutes(partial: Partial<Minutes> = {}): Minutes {
  return {
    committee: 'CCIH',
    attendees: [],
    unidentified_speakers: [],
    agenda_items: [],
    resolutions: [],
    action_items: [],
    ...partial,
  }
}

describe('minutes_md is OPTIONAL service-side', () => {
  it('falls back to `summary` when the narrative is missing', () => {
    const draft = normalizeMinutes(minutes({ minutes_md: null, summary: 'Resumo curto.' }), ctx)
    expect(draft.minutes_md).toBe('Resumo curto.')
  })

  it('falls back to EMPTY when both are missing — never the string "undefined"', () => {
    // A missing narrative must not fail an hour of transcription, so the service sends
    // null. `String(minutes.minutes_md)` would write "undefined" into the ata.
    const draft = normalizeMinutes(minutes(), ctx)
    expect(draft.minutes_md).toBe('')
    expect(draft.minutes_md).not.toContain('undefined')
  })

  it('prefers minutes_md over summary when both are present', () => {
    const draft = normalizeMinutes(minutes({ minutes_md: '# Ata', summary: 'ignore me' }), ctx)
    expect(draft.minutes_md).toBe('# Ata')
  })
})

describe('resolutions fold onto agenda items BY INDEX', () => {
  const source = minutes({
    agenda_items: [
      { ref: 'ai-1', title: 'Primeiro', discussion: 'discutido' },
      { ref: null, title: 'Surgiu no dia', discussion: '' },
    ],
    resolutions: [
      { text: 'Aprovado por unanimidade', agenda_item_index: 0 },
      { text: 'Adiado', agenda_item_index: 1 },
    ],
  })

  it('places each resolution on the agenda item its INDEX names', () => {
    // `agenda_item_index` is a positional index into `agenda_items` — NOT a ref and NOT
    // our `meeting_agenda_items.id`. Treating it as either silently mis-files decisions.
    const draft = normalizeMinutes(source, ctx)
    expect(draft.agenda[0].resolution).toBe('Aprovado por unanimidade')
    expect(draft.agenda[1].resolution).toBe('Adiado')
  })

  it('JOINS several resolutions onto one item instead of last-write-wins', () => {
    const draft = normalizeMinutes(
      minutes({
        agenda_items: [{ ref: 'ai-1', title: 'T', discussion: '' }],
        resolutions: [
          { text: 'Primeira decisão', agenda_item_index: 0 },
          { text: 'Segunda decisão', agenda_item_index: 0 },
        ],
      }),
      ctx,
    )
    // Losing a recorded decision is the worst outcome available here.
    expect(draft.agenda[0].resolution).toBe('Primeira decisão\n\nSegunda decisão')
  })

  it('carries an INDEX-LESS resolution instead of dropping it (D6)', () => {
    const draft = normalizeMinutes(
      minutes({
        agenda_items: [{ ref: 'ai-1', title: 'T', discussion: '' }],
        resolutions: [{ text: 'Decisão solta', agenda_item_index: null }],
      }),
      ctx,
    )
    expect(draft.agenda[0].resolution).toBeNull()
    expect(draft.unassigned_resolutions.map((r) => r.text)).toEqual(['Decisão solta'])
  })

  it('treats an OUT-OF-RANGE index as index-less rather than crashing', () => {
    const draft = normalizeMinutes(
      minutes({
        agenda_items: [{ ref: 'ai-1', title: 'T', discussion: '' }],
        resolutions: [{ text: 'Fora de alcance', agenda_item_index: 99 }],
      }),
      ctx,
    )
    expect(draft.unassigned_resolutions).toHaveLength(1)
  })
})

describe('agenda entries', () => {
  it('maps `discussion` onto `discussion_notes` and keeps a null ref null', () => {
    const draft = normalizeMinutes(
      minutes({
        agenda_items: [
          { ref: 'ai-1', title: 'Matched', discussion: 'notas' },
          { ref: null, title: 'Novo', discussion: '' },
        ],
      }),
      ctx,
    )
    expect(draft.agenda[0]).toMatchObject({ ref: 'ai-1', discussion_notes: 'notas', include: true })
    expect(draft.agenda[1].ref).toBeNull()
  })

  it('leaves `existing_*` NULL — they are overlaid from the LIVE rows at read time', () => {
    // Freezing the meeting's current text at callback time would show the reviewer an
    // overwrite warning about text that may have changed hours ago.
    const draft = normalizeMinutes(
      minutes({ agenda_items: [{ ref: 'ai-1', title: 'T', discussion: 'd' }] }),
      ctx,
    )
    expect(draft.agenda[0].existing_discussion_notes).toBeNull()
    expect(draft.agenda[0].existing_resolution).toBeNull()
  })

  it('uses the key `agenda` — the key apply_minutes_review actually reads', () => {
    // The SQL reads `draft->'agenda'`. Naming it `agenda_items` (as the UI brief first
    // did) makes apply find nothing, write nothing, and report success.
    const draft = normalizeMinutes(
      minutes({ agenda_items: [{ ref: null, title: 'T', discussion: '' }] }),
      ctx,
    )
    expect(Object.keys(draft)).toContain('agenda')
    expect(Object.keys(draft)).not.toContain('agenda_items')
  })
})

describe('action items', () => {
  const source = minutes({
    action_items: [
      {
        title: 'Revisar protocolo',
        description: 'detalhe',
        owner_ref: 'att-member',
        owner_text: 'a Ana',
        due_date: '2026-12-01',
        deadline_text: 'até dezembro',
      },
      { title: 'Sem dono', owner_ref: 'att-guest', owner_text: 'o convidado' },
      { title: '   ', description: 'sem título' },
    ],
  })

  it('resolves an owner ref that maps to a commission member', () => {
    const draft = normalizeMinutes(source, ctx)
    expect(draft.action_items[0].assigned_to).toBe('user-1')
  })

  it('leaves a NON-member owner unassigned but keeps the verbatim text', () => {
    // The action-items door rejects a non-member with HC021; pre-assigning a guest would
    // show an owner that silently vanishes at apply.
    const draft = normalizeMinutes(source, ctx)
    expect(draft.action_items[1].assigned_to).toBeNull()
    expect(draft.action_items[1].owner_text).toBe('o convidado')
  })

  it('drops an action item with a blank title', () => {
    // `create_committee_action_item` rejects a blank title outright.
    const draft = normalizeMinutes(source, ctx)
    expect(draft.action_items).toHaveLength(2)
  })

  it('sets agenda_ref to null — the service carries no agenda back-reference', () => {
    const draft = normalizeMinutes(source, ctx)
    expect(draft.action_items[0].agenda_ref).toBeNull()
  })

  it.each([
    ['an unparseable date', 'dezembro'],
    ['an empty string', ''],
    ['a full timestamp', '2026-12-01T10:00:00Z'],
  ])('normalizes %s to null due_date', (_label, value) => {
    const draft = normalizeMinutes(
      minutes({ action_items: [{ title: 'T', due_date: value }] }),
      ctx,
    )
    expect(draft.action_items[0].due_date).toBeNull()
  })
})

describe('speakers (display-only, D12)', () => {
  it('merges the two service lists and never claims presence', () => {
    const draft = normalizeMinutes(
      minutes({
        attendees: [
          { ref: 'att-member', spoke: true },
          { ref: 'att-silent', spoke: false },
        ],
        unidentified_speakers: [{ label: 'Falante 2', utterances: 7 }],
      }),
      ctx,
    )
    expect(draft.speakers).toEqual([
      { label: 'Dra. Ana', attendee_ref: 'att-member', utterance_count: 0, spoke: true },
      { label: 'att-silent', attendee_ref: 'att-silent', utterance_count: 0, spoke: false },
      { label: 'Falante 2', attendee_ref: null, utterance_count: 7, spoke: true },
    ])
  })
})

describe('next_meeting', () => {
  it('maps the service field names onto the draft shape', () => {
    const draft = normalizeMinutes(
      minutes({
        next_meeting: { starts_at: '2026-12-15T14:00:00Z', location_text: 'Sala 2', raw: 'dia 15' },
      }),
      ctx,
    )
    expect(draft.next_meeting).toEqual({
      suggested_date: '2026-12-15T14:00:00Z',
      location_text: 'Sala 2',
      note: 'dia 15',
    })
  })

  it('is null when the service suggested nothing', () => {
    expect(normalizeMinutes(minutes(), ctx).next_meeting).toBeNull()
  })
})

describe('hostile / degenerate payloads', () => {
  it('survives arrays arriving as null or the wrong type', () => {
    const hostile = {
      committee: 'X',
      attendees: null,
      unidentified_speakers: 'nope',
      agenda_items: undefined,
      resolutions: {},
      action_items: null,
    } as unknown as Minutes
    const draft = normalizeMinutes(hostile, ctx)
    expect(draft.agenda).toEqual([])
    expect(draft.action_items).toEqual([])
    expect(draft.speakers).toEqual([])
    expect(draft.unassigned_resolutions).toEqual([])
  })
})

describe('foldVerbatimIntoDescription (D7)', () => {
  const base: MinutesDraftActionItem = {
    key: 'a-0',
    title: 'T',
    description: 'Descrição original.',
    assigned_to: null,
    owner_ref: null,
    owner_text: null,
    due_date: null,
    deadline_text: null,
    agenda_ref: null,
    include: true,
  }

  it('appends the verbatim owner when nobody was resolved', () => {
    expect(foldVerbatimIntoDescription({ ...base, owner_text: 'o Dr. Silva' })).toBe(
      'Descrição original.\n\nResponsável indicado em reunião: o Dr. Silva',
    )
  })

  it('does NOT append it once a real owner is assigned', () => {
    // The whole reason the fold runs at apply time and not on autosave: by then the
    // reviewer's choices are final and the hint is redundant.
    expect(
      foldVerbatimIntoDescription({ ...base, owner_text: 'o Dr. Silva', assigned_to: 'user-1' }),
    ).toBe('Descrição original.')
  })

  it('appends the verbatim deadline only while due_date is unset', () => {
    expect(foldVerbatimIntoDescription({ ...base, deadline_text: 'até a próxima' })).toContain(
      'Prazo indicado em reunião: até a próxima',
    )
    expect(
      foldVerbatimIntoDescription({ ...base, deadline_text: 'até a próxima', due_date: '2026-12-01' }),
    ).toBe('Descrição original.')
  })

  it('produces a clean string when the description was empty', () => {
    expect(foldVerbatimIntoDescription({ ...base, description: '', owner_text: 'a Ana' })).toBe(
      'Responsável indicado em reunião: a Ana',
    )
  })
})
