import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { renderDocumentHtml, TEMPLATES } from './render'
import { TEMPLATE_FINGERPRINTS } from './template-fingerprints'
import type { DocumentPayload, FormResponseDocumentBody } from './types'

/**
 * ADR 0104 D4 — the template-staleness guard. A template that changes without
 * a version bump is silent metadata corruption (the registry would record
 * version 1 for two different layouts). This suite REDS on exactly that.
 *
 * Includes the proven-detecting case (memory: a detector that finds nothing
 * must be proven able to find something): a representative template-style
 * mutation is shown to MOVE the fingerprint.
 */

/** Canonical fixture — FROZEN. Changing it changes every fingerprint, which is
 * indistinguishable from a template change; extend templates with NEW fixtures
 * instead of editing this one. */
const CANONICAL: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: 'Rua Fixa, 100 — Belo Horizonte/MG',
    logoDataUri: null,
    commissionName: 'Comissão de Controle de Infecção Hospitalar',
  },
  watermarks: ['draft'],
  signatures: [
    {
      name: 'Maria Fixa',
      title: 'Coordenação da comissão',
      scope: 'Seção assinada',
      timestamp: '2026-01-02T13:45:00.000Z',
      method: 'platform_signoff',
    },
  ],
  qr: {
    token: 'FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
    shortCode: 'ABCDEF2345',
    url: 'https://example.invalid/verificar/FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
  },
  emission: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'João Emissor' },
  containsPhi: false,
  body: {
    kind: 'form_response',
    formTitle: 'Checklist Canônico',
    versionNumber: 3,
    respondentDisplay: 'João Emissor',
    responseStatus: 'in_progress',
    startedAt: '2026-01-02T12:00:00.000Z',
    submittedAt: null,
    sections: [
      {
        title: null,
        description: null,
        requiresSignoff: false,
        signature: null,
        items: [
          { kind: 'question', label: 'Pergunta respondida', value: 'Sim' },
          { kind: 'question', label: 'Pergunta aberta', value: null },
          { kind: 'display_text', label: 'Texto explicativo do formulário.', value: null },
        ],
      },
      {
        title: 'Seção assinada',
        description: 'Descrição da seção.',
        requiresSignoff: true,
        signature: {
          name: 'Maria Fixa',
          title: 'Coordenação da comissão',
          scope: 'Seção assinada',
          timestamp: '2026-01-02T13:45:00.000Z',
          method: 'platform_signoff',
        },
        items: [{ kind: 'question', label: 'Confirmação', value: 'Confirmado' }],
      },
      {
        title: 'Seção pendente',
        description: null,
        requiresSignoff: true,
        signature: null,
        items: [{ kind: 'question', label: 'Nota', value: null }],
      },
    ],
  },
}

/**
 * QA MAJOR-2 variant — FROZEN like {@link CANONICAL}. Exercises the branches
 * the canonical fixture cannot: the FINAL chip (`watermarks: ['final']` — the
 * branch every submitted response renders), the non-suppressible
 * confidentiality band (`containsPhi: true` — the FIRST thing P3's PHI delta
 * touches, pinned BEFORE it lands), and the letterhead logo `<img>`.
 */
const FINAL_PHI_LOGO: DocumentPayload = {
  ...CANONICAL,
  letterhead: {
    ...CANONICAL.letterhead,
    logoDataUri:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  },
  watermarks: ['final'],
  containsPhi: true,
  body: {
    // P2 widened DocumentBody to a union; this fixture is the form_response
    // member by construction (CANONICAL declares it literally above).
    ...(CANONICAL.body as FormResponseDocumentBody),
    responseStatus: 'submitted',
    submittedAt: '2026-01-02T13:50:00.000Z',
  },
}

/** PDF·P2 — the meeting (ata) canonical fixture. FROZEN like {@link CANONICAL}:
 * RASCUNHO, no signatures (the "— não assinado —" footer branch), minutes +
 * agenda (all three field kinds) + attendance + action items populated. */
const MEETING_CANONICAL: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: null,
    logoDataUri: null,
    commissionName: 'Comissão de Controle de Infecção Hospitalar',
  },
  watermarks: ['draft'],
  signatures: [],
  qr: {
    token: 'FIXTURETOKENMEETINGAAAABBBBCCCCD',
    shortCode: 'BCDEFG2345',
    url: 'https://example.invalid/verificar/FIXTURETOKENMEETINGAAAABBBBCCCCD',
  },
  emission: { at: '2026-01-03T14:00:00.000Z', byDisplay: 'João Emissor' },
  containsPhi: false,
  body: {
    kind: 'meeting',
    meetingNumber: 42,
    title: 'Reunião ordinária de janeiro',
    meetingTypeDisplay: 'Ordinária',
    statusDisplay: 'Em assinatura',
    scheduledStart: '2026-01-03T12:00:00.000Z',
    heldAt: '2026-01-03T12:05:00.000Z',
    heldEnd: '2026-01-03T13:30:00.000Z',
    modalityDisplay: 'Presencial',
    locationDisplay: 'Sala de reuniões 2',
    quorum: { met: true, presentCount: 5, eligibleCount: 7 },
    minutesMd: 'Ata canônica da reunião.\nSegundo parágrafo.',
    agenda: [
      {
        title: 'Aprovação da ata anterior',
        description: 'Leitura e aprovação.',
        discussionNotes: 'Sem ressalvas.',
        resolution: 'Aprovada por unanimidade.',
      },
      {
        title: 'Item sem deliberação',
        description: null,
        discussionNotes: null,
        resolution: null,
      },
    ],
    attendance: [
      { name: 'Maria Fixa', roleDisplay: 'Presidente', attendanceDisplay: 'Presente' },
      { name: 'João Emissor', roleDisplay: 'Membro', attendanceDisplay: 'Ausente' },
      {
        name: 'Convidada Externa (Org Externa)',
        roleDisplay: 'Convidado(a)',
        attendanceDisplay: 'Convocado(a)',
      },
    ],
    actionItems: [
      {
        title: 'Revisar protocolo de higienização',
        statusDisplay: 'Aberto',
        assigneeDisplay: 'Maria Fixa',
        dueDisplay: '15/01/2026',
      },
    ],
  },
}

/** The FINAL + signed + DEGENERATE-STATE variant (QA MINOR-6): two attestation
 * footer blocks, null minutes, EMPTY agenda, EMPTY attendance, null quorum,
 * absent "Encaminhamentos" — every branch the populated canonical cannot pin. */
const MEETING_FINAL_SIGNED: DocumentPayload = {
  ...MEETING_CANONICAL,
  watermarks: ['final'],
  signatures: [
    {
      name: 'Maria Fixa',
      title: 'Presidente',
      scope: null,
      timestamp: '2026-01-04T10:00:00.000Z',
      method: 'platform_signoff',
    },
    {
      name: 'Carlos Secretário',
      title: 'Secretário(a)',
      scope: null,
      timestamp: '2026-01-04T11:00:00.000Z',
      method: 'platform_signoff',
    },
  ],
  body: {
    ...(MEETING_CANONICAL.body as import('./types').MeetingDocumentBody),
    statusDisplay: 'Assinada',
    minutesMd: null,
    quorum: null,
    agenda: [],
    attendance: [],
    actionItems: [],
  },
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

describe('template fingerprints (ADR 0104 D4)', () => {
  it('renders deterministically (same payload, same bytes)', () => {
    expect(renderDocumentHtml(CANONICAL)).toBe(renderDocumentHtml(CANONICAL))
  })

  it('form_response: registry version matches the committed record', () => {
    expect(TEMPLATES.form_response.version).toBe(
      TEMPLATE_FINGERPRINTS.form_response.version,
    )
  })

  it('form_response: structural fingerprint matches — a template change REQUIRES a version bump', () => {
    const computed = sha256(renderDocumentHtml(CANONICAL))
    const recorded = TEMPLATE_FINGERPRINTS.form_response.fingerprint
    expect(
      computed,
      `Template output changed (computed ${computed}). If this was a deliberate ` +
        `template change: bump TEMPLATE_VERSION in documents/form-response.ts AND ` +
        `update template-fingerprints.ts (version + fingerprint) in the same commit. ` +
        `Never update the fingerprint without the version decision.`,
    ).toBe(recorded)
  })

  it('form_response/final_phi_logo: the FINAL-chip + PHI-band + logo branches are version-pinned too (QA MAJOR-2)', () => {
    const computed = sha256(renderDocumentHtml(FINAL_PHI_LOGO))
    const recorded = TEMPLATE_FINGERPRINTS.form_response.variants.final_phi_logo
    expect(
      computed,
      `Variant output changed (computed ${computed}). A deliberate template change ` +
        `requires the TEMPLATE_VERSION bump + BOTH fingerprint fields updated together.`,
    ).toBe(recorded)
  })

  it('the variant genuinely renders the pinned branches (no vacuous fixture)', () => {
    // MARKUP forms, not bare class tokens — the CSS block defines the
    // selectors in EVERY document, so a token-contains would be vacuous.
    const html = renderDocumentHtml(FINAL_PHI_LOGO)
    expect(html).toContain('class="wm-chip wm-chip-final"')
    expect(html).toContain('DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE</div>')
    expect(html).toContain('<img class="lh-logo"')
    // ...and the canonical fixture does NOT — the two pins cover disjoint branches.
    const canonicalHtml = renderDocumentHtml(CANONICAL)
    expect(canonicalHtml).not.toContain('class="wm-chip wm-chip-final"')
    expect(canonicalHtml).not.toContain('DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE</div>')
    expect(canonicalHtml).not.toContain('<img class="lh-logo"')
  })

  it('meeting: registry version matches the committed record', () => {
    expect(TEMPLATES.meeting.version).toBe(TEMPLATE_FINGERPRINTS.meeting.version)
  })

  it('meeting: structural fingerprint matches — a template change REQUIRES a version bump', () => {
    const computed = sha256(renderDocumentHtml(MEETING_CANONICAL))
    expect(
      computed,
      `Meeting template output changed (computed ${computed}). Deliberate change: bump ` +
        `TEMPLATE_VERSION in documents/meeting.ts AND update template-fingerprints.ts together.`,
    ).toBe(TEMPLATE_FINGERPRINTS.meeting.fingerprint)
  })

  it('meeting/final_signed: the FINAL + attestation-footer + null-minutes branches are pinned', () => {
    const computed = sha256(renderDocumentHtml(MEETING_FINAL_SIGNED))
    expect(
      computed,
      `Meeting variant output changed (computed ${computed}). Same rule: version + both fields together.`,
    ).toBe(TEMPLATE_FINGERPRINTS.meeting.variants.final_signed)
  })

  it('the meeting variant genuinely renders its pinned branches (no vacuous fixture)', () => {
    const html = renderDocumentHtml(MEETING_FINAL_SIGNED)
    expect(html).toContain('class="wm-chip wm-chip-final"')
    expect(html).toContain('Assinado eletronicamente por <strong>Carlos Secretário</strong>')
    // Markup form, not the bare token — the shared shell CSS defines
    // .signature-missing in EVERY document (the P1 FIX-2 lesson).
    expect(html).not.toContain('class="signature-block signature-missing"')
    // Degenerate-state branches (QA MINOR-6) — variant-only:
    expect(html).toContain('— pauta sem itens registrados —')
    expect(html).toContain('— sem participantes registrados —')
    expect(html).not.toContain('Encaminhamentos')
    expect(html).not.toContain('Quórum:')
    const canonicalHtml = renderDocumentHtml(MEETING_CANONICAL)
    expect(canonicalHtml).toContain('class="signature-block signature-missing"') // unsigned-footer branch
    expect(canonicalHtml).not.toContain('class="wm-chip wm-chip-final"')
    expect(canonicalHtml).toContain('class="ata-minutes"') // minutes branch canonical-only
    expect(html).not.toContain('class="ata-minutes"')
    expect(canonicalHtml).toContain('Encaminhamentos')
    expect(canonicalHtml).toContain('Quórum: atingido (5 de 7)')
    expect(canonicalHtml).not.toContain('— pauta sem itens registrados —')
    expect(canonicalHtml).not.toContain('— sem participantes registrados —')
  })

  it('the detector DETECTS: a representative template mutation moves the fingerprint', () => {
    // Simulate the class of change the guard exists for — a structural/CSS-class
    // edit anywhere in the rendered document.
    const html = renderDocumentHtml(CANONICAL)
    const mutated = html.replace('class="section-table"', 'class="section-tbl"')
    expect(mutated).not.toBe(html) // the mutation landed (§7.15 — no vacuous drill)
    expect(sha256(mutated)).not.toBe(sha256(html))
  })
})
