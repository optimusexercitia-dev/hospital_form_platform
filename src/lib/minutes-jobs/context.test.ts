import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types/database'
import { AGENDA_TITLE_COLUMNS, buildAgendaRefs, composeMeetingMinutesContext } from './context'

/**
 * T2 — the D14 KEYSTONE.
 *
 * D14 is a minimum-necessary boundary: agenda **titles** may leave the platform, agenda
 * **descriptions / discussion notes / resolutions** may not. The substance tier stays
 * home. A regression here is a silent PHI-adjacent data leak to a third-party ASR/LLM
 * pipeline — it produces no error, no failing page, and nothing a reviewer would notice.
 *
 * So this asserts the boundary TWICE, at two different layers, because the first is a
 * STRING and strings rot silently:
 *   1. the query asks PostgREST for `id, title` only (the wire never carries substance);
 *   2. the composer builds each ref field-by-field (a future `select('*')` still cannot
 *      put a description into the payload).
 * A third layer — `ServiceAgendaRef.description: never` — fails the build.
 */

type Client = SupabaseClient<Database>

const MEETING_ID = 'meeting-1'

interface Recorded {
  agendaSelect: string | null
  rpcName: string | null
}

/**
 * A hand-rolled supabase double.
 *
 * The agenda RPC deliberately returns rows POLLUTED with substance columns — exactly
 * what `get_meeting_agenda_items` returns when nobody narrows the projection. If the
 * composer ever stops narrowing, or starts copying fields wholesale, these fixtures are
 * what leaks.
 */
function makeClient(recorded: Recorded): Client {
  const meetingRow = {
    id: MEETING_ID,
    commission_id: 'comm-1',
    held_at: '2026-08-01T13:00:00Z',
    scheduled_start: '2026-08-01T12:00:00Z',
    commissions: { name: 'CCIH' },
  }
  const attendeeRows = [
    {
      id: 'att-1',
      user_id: 'user-1',
      external_name: null,
      role: 'membro',
      profiles: { full_name: 'Dra. Ana' },
    },
    {
      id: 'att-2',
      user_id: null,
      external_name: 'Convidado Externo',
      role: 'convidado',
      profiles: null,
    },
    { id: 'att-3', user_id: null, external_name: '   ', role: null, profiles: null },
  ]
  const pollutedAgenda = [
    {
      id: 'ai-1',
      title: 'Surto na UTI',
      description: 'PACIENTE JOÃO, PRONTUÁRIO 12345 — NUNCA DEVE SAIR',
      discussion_notes: 'SUBSTÂNCIA CONFIDENCIAL',
      resolution: 'DECISÃO CONFIDENCIAL',
      position: 1,
    },
    { id: 'ai-2', title: '   ', description: 'sem título', discussion_notes: null, resolution: null },
  ]

  return {
    from(table: string) {
      if (table === 'meetings') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: meetingRow, error: null }) }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({ returns: async () => ({ data: attendeeRows, error: null }) }),
        }),
      }
    },
    rpc(name: string) {
      recorded.rpcName = name
      return {
        select: (columns: string) => {
          recorded.agendaSelect = columns
          return { returns: async () => ({ data: pollutedAgenda, error: null }) }
        },
      }
    },
  } as unknown as Client
}

describe('D14 — agenda descriptions never leave the platform', () => {
  it('asks PostgREST for `id, title` ONLY (layer 1: the wire)', async () => {
    const recorded: Recorded = { agendaSelect: null, rpcName: null }
    await composeMeetingMinutesContext(makeClient(recorded), MEETING_ID)

    expect(recorded.agendaSelect).toBe(AGENDA_TITLE_COLUMNS)
    expect(recorded.agendaSelect).toBe('id, title')
    // Named explicitly so a widened projection fails HERE rather than silently shipping.
    for (const forbidden of ['description', 'discussion_notes', 'resolution']) {
      expect(recorded.agendaSelect).not.toContain(forbidden)
    }
  })

  it('reads the agenda through the DEFINER door, not the table', async () => {
    // `meeting_agenda_items` does not grant `title` to `authenticated` at all, so a
    // direct table select is not merely off-pattern — it is a 42501. It also skips
    // `app._project_meeting_agenda_item`'s masking.
    const recorded: Recorded = { agendaSelect: null, rpcName: null }
    await composeMeetingMinutesContext(makeClient(recorded), MEETING_ID)
    expect(recorded.rpcName).toBe('get_meeting_agenda_items')
  })

  it('emits agenda refs carrying ONLY ref+title, even from polluted rows (layer 2)', async () => {
    const recorded: Recorded = { agendaSelect: null, rpcName: null }
    const composed = await composeMeetingMinutesContext(makeClient(recorded), MEETING_ID)

    expect(composed).not.toBeNull()
    for (const item of composed!.context.agenda) {
      expect(Object.keys(item).sort()).toEqual(['ref', 'title'])
    }
  })

  it('the SERIALIZED payload contains no substance string anywhere', async () => {
    // The end-to-end assertion: whatever the shape, these bytes must not be in the POST.
    const recorded: Recorded = { agendaSelect: null, rpcName: null }
    const composed = await composeMeetingMinutesContext(makeClient(recorded), MEETING_ID)
    const wire = JSON.stringify(composed!.context)

    expect(wire).toContain('Surto na UTI')
    expect(wire).not.toContain('PRONTUÁRIO')
    expect(wire).not.toContain('SUBSTÂNCIA CONFIDENCIAL')
    expect(wire).not.toContain('DECISÃO CONFIDENCIAL')
    expect(wire).not.toContain('description')
  })

  it('buildAgendaRefs drops a description even when handed one directly', () => {
    const refs = buildAgendaRefs([
      { id: 'a', title: 'Título', description: 'VAZAMENTO' } as never,
    ])
    expect(refs).toEqual([{ ref: 'a', title: 'Título' }])
    expect(JSON.stringify(refs)).not.toContain('VAZAMENTO')
  })

  it('drops agenda items whose title is blank or masked away', () => {
    // `app._project_meeting_agenda_item` NULLS the title for a case respondent. The
    // uploader is never one, but a null title must not become an empty ref either way.
    expect(buildAgendaRefs([{ id: 'a', title: null }, { id: 'b', title: '  ' }])).toEqual([])
  })
})

describe('the rest of the D14 context', () => {
  it('uses held_at as the meeting date, falling back to scheduled_start', async () => {
    const recorded: Recorded = { agendaSelect: null, rpcName: null }
    const composed = await composeMeetingMinutesContext(makeClient(recorded), MEETING_ID)
    expect(composed!.context.meeting_date).toBe('2026-08-01T13:00:00Z')
    expect(composed!.context.committee_name).toBe('CCIH')
  })

  it('includes guests as attendees and drops nameless rows', async () => {
    const recorded: Recorded = { agendaSelect: null, rpcName: null }
    const composed = await composeMeetingMinutesContext(makeClient(recorded), MEETING_ID)
    expect(composed!.context.attendees).toEqual([
      { ref: 'att-1', name: 'Dra. Ana', role: 'membro' },
      { ref: 'att-2', name: 'Convidado Externo', role: 'convidado' },
    ])
  })

  it('returns the attendee maps the callback normalizer needs', async () => {
    const recorded: Recorded = { agendaSelect: null, rpcName: null }
    const composed = await composeMeetingMinutesContext(makeClient(recorded), MEETING_ID)
    expect(composed!.attendeeUserIds.get('att-1')).toBe('user-1')
    expect(composed!.attendeeUserIds.has('att-2')).toBe(false)
    expect(composed!.attendeeNames.get('att-2')).toBe('Convidado Externo')
  })

  it('returns null (never throws) when the meeting cannot be read', async () => {
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
      rpc: vi.fn(),
    } as unknown as Client
    expect(await composeMeetingMinutesContext(client, MEETING_ID)).toBeNull()
  })
})
