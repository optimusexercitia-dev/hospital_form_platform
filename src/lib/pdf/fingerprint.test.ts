import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { renderDocumentHtml, TEMPLATES } from './render'
import { TEMPLATE_FINGERPRINTS } from './template-fingerprints'
import type { DocumentPayload } from './types'

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

  it('the detector DETECTS: a representative template mutation moves the fingerprint', () => {
    // Simulate the class of change the guard exists for — a structural/CSS-class
    // edit anywhere in the rendered document.
    const html = renderDocumentHtml(CANONICAL)
    const mutated = html.replace('class="section-table"', 'class="section-tbl"')
    expect(mutated).not.toBe(html) // the mutation landed (§7.15 — no vacuous drill)
    expect(sha256(mutated)).not.toBe(sha256(html))
  })
})
