import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { renderDocumentHtml, TEMPLATES } from './render'
import { TEMPLATE_FINGERPRINTS } from './template-fingerprints'
import type {
  DocumentPayload,
  FormResponseDocumentBody,
  RegisteredProvenance,
} from './types'

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
/**
 * ⚠ Extracted and typed as {@link RegisteredProvenance}, NOT inlined — and the
 * reason is the design working. `{ ...payload.provenance, watermark: 'final' }`
 * spreads a UNION, so TypeScript produces `previa & watermark:'final'` as one
 * arm of the result and REFUSES it: ADR 0125 D5's fourth cell is a compile error,
 * exactly as intended. Spreading a narrowed registered value is legal because it
 * cannot land in the previa arm.
 */
const CANONICAL_PROVENANCE: RegisteredProvenance = {
  kind: 'registered',
  watermark: 'draft',
  qr: {
    token: 'FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
    shortCode: 'ABCDEF2345',
    url: 'https://example.invalid/verificar/FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
  },
  emission: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'João Emissor' },
}

const CANONICAL: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: 'Rua Fixa, 100 — Belo Horizonte/MG',
    logoDataUri: null,
    commissionName: 'Comissão de Controle de Infecção Hospitalar',
  },
  provenance: CANONICAL_PROVENANCE,
  signatures: [
    {
      name: 'Maria Fixa',
      title: 'Coordenação da comissão',
      scope: 'Seção assinada',
      timestamp: '2026-01-02T13:45:00.000Z',
      method: 'platform_signoff',
    },
  ],
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
 * the canonical fixture cannot: the FINAL chip (`provenance.watermark: 'final'` — the
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
  provenance: { ...CANONICAL_PROVENANCE, watermark: 'final' },
  containsPhi: true,
  body: {
    // P2 widened DocumentBody to a union; this fixture is the form_response
    // member by construction (CANONICAL declares it literally above).
    ...(CANONICAL.body as FormResponseDocumentBody),
    responseStatus: 'submitted',
    submittedAt: '2026-01-02T13:50:00.000Z',
  },
}

/**
 * ADR 0125 D2/D4/D5 — the EPHEMERAL prévia variant. FROZEN like the others.
 *
 * D2 requires this pin by name: *"an ephemeral page is still rendered by the same
 * templates and is still read by a human, so its look stays pinned even though
 * its bytes are never stored."* It sits in `form_response.variants` because it IS
 * the form_response template — the prévia footer is a branch of it, not a
 * template of its own, so it shares the same `TEMPLATE_VERSION`.
 *
 * ⚠ Every display name here is deliberately free of the reserved verb (no
 * "Emissor"), because the whole-document sweep below runs a plain `/emit|emiss/i`
 * over the rendered output. A fixture whose PAYLOAD contains the verb would make
 * that sweep fail for a reason that is not a defect — the mistake this suite's
 * sibling (`primitives/previa-footer.test.ts`) already made once and now
 * documents.
 */
const PREVIA: DocumentPayload = {
  ...CANONICAL,
  provenance: {
    kind: 'previa',
    watermark: 'draft',
    generation: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'Maria Fixa' },
  },
  body: {
    ...(CANONICAL.body as FormResponseDocumentBody),
    respondentDisplay: 'Maria Fixa',
  },
}

/** PDF·P2 — the meeting (ata) canonical fixture. FROZEN like {@link CANONICAL}:
 * RASCUNHO, no signatures (the "— não assinado —" footer branch), minutes +
 * agenda (all three field kinds) + attendance + action items populated. */
const MEETING_PROVENANCE: RegisteredProvenance = {
  kind: 'registered',
  watermark: 'draft',
  qr: {
    token: 'FIXTURETOKENMEETINGAAAABBBBCCCCD',
    shortCode: 'BCDEFG2345',
    url: 'https://example.invalid/verificar/FIXTURETOKENMEETINGAAAABBBBCCCCD',
  },
  emission: { at: '2026-01-03T14:00:00.000Z', byDisplay: 'João Emissor' },
}

const MEETING_CANONICAL: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: null,
    logoDataUri: null,
    commissionName: 'Comissão de Controle de Infecção Hospitalar',
  },
  provenance: MEETING_PROVENANCE,
  signatures: [],
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
  provenance: { ...MEETING_PROVENANCE, watermark: 'final' },
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

describe('ADR 0125 D5 — REGISTERED documents are untouched by the prévia split', () => {
  /**
   * The prévia footer (`primitives/previa-footer.ts`) emits TEMPLATE-SCOPED CSS
   * rather than extending this module's shared `PRINT_CSS`, and that is
   * load-bearing: `PRINT_CSS` is part of every document's hash, so styling the
   * ephemeral page through it would move BOTH committed fingerprints and force a
   * `TEMPLATE_VERSION` bump on two templates whose layout did not change —
   * corrupting registry metadata to style a page that is never stored. Same
   * reason `documents/meeting.ts` scopes its own styles (its header comment:
   * adding that template moved NO form_response fingerprint).
   *
   * The four fingerprint assertions above already RED if that discipline slips.
   * These add the readable half: what a reviewer would actually check.
   *
   * ⚠ The full-document PRÉVIA variant is NOT pinned here yet — `renderDocumentHtml`
   * cannot yet produce one (its footer call is unconditional and `DocumentPayload.qr`
   * is required). That variant lands WITH the render path (F2 / ADR 0125 D4), and
   * ADR 0125 D2 requires it: an ephemeral page is still rendered by these templates
   * and still read by a human, so its look stays pinned even though its bytes are
   * never stored.
   */
  const registered = [
    ['form_response canonical', CANONICAL],
    ['form_response final/phi/logo', FINAL_PHI_LOGO],
    ['meeting canonical', MEETING_CANONICAL],
    ['meeting final/signed', MEETING_FINAL_SIGNED],
  ] as const

  for (const [name, payload] of registered) {
    it(`${name}: carries the QR footer and NOT the prévia footer`, () => {
      const html = renderDocumentHtml(payload)
      // Positive half first — without it, the absence checks below are satisfied
      // by a renderer that emits no footer at all.
      expect(html).toContain('<footer class="qr-footer">')
      expect(html).toContain('Emitido em ')
      expect(html).not.toContain('previa-footer')
      expect(html).not.toContain('PRÉVIA — sem valor de registro')
    })
  }

  it('form_response/previa: the EPHEMERAL branch is version-pinned too (D2)', () => {
    const computed = sha256(renderDocumentHtml(PREVIA))
    expect(
      computed,
      `Prévia variant output changed (computed ${computed}). Same rule as every ` +
        `other variant: a deliberate template change bumps TEMPLATE_VERSION and ` +
        `updates template-fingerprints.ts in the same commit.`,
    ).toBe(TEMPLATE_FINGERPRINTS.form_response.variants.previa)
  })

  it('the prévia variant genuinely renders the EPHEMERAL branch (no vacuous fixture)', () => {
    const html = renderDocumentHtml(PREVIA)
    expect(html).toContain('<footer class="previa-footer">')
    expect(html).toContain('PRÉVIA — sem valor de registro, não verificável.')
    expect(html).toContain('Gerada em 02/01/2026 11:00 por Maria Fixa.')
    // ...and it carries NONE of the registered page's verification apparatus.
    expect(html).not.toContain('<footer class="qr-footer">')
    expect(html).not.toContain('Código de verificação:')
    expect(html).not.toContain('/verificar/')
    // The disjoint half: the registered canonical is the exact mirror.
    const registeredHtml = renderDocumentHtml(CANONICAL)
    expect(registeredHtml).toContain('<footer class="qr-footer">')
    expect(registeredHtml).not.toContain('previa-footer')
  })

  /**
   * ⛔ **Sweep the RENDERED PROSE, not the raw document.**
   *
   * The first version of the check below swept `renderDocumentHtml(...)` whole
   * and went red — not because the verb reached the page, but because
   * `fonts.generated.ts` inlines ~136 KB of base64 `@font-face` payloads, and a
   * blob that size contains the letters "emit" by chance. A needle applied to
   * machine-encoded bytes measures entropy, not vocabulary.
   *
   * Stripping `<style>` blocks and `data:` URIs leaves exactly what a human
   * reads, which is what ADR 0125 D5 actually governs.
   */
  const renderedProse = (payload: DocumentPayload) =>
    renderDocumentHtml(payload)
      .replace(/<style>[\s\S]*?<\/style>/g, '')
      .replace(/data:[^"')\s]+/g, '')

  it('⛔ the RESERVED VERB appears NOWHERE in a rendered prévia (ADR 0125 D5)', () => {
    // The whole document, not just the footer fragment: the verb could re-enter
    // through the letterhead, a body label, or a future template edit. The
    // fixture's payload is deliberately verb-free (see PREVIA's note).
    const prose = renderedProse(PREVIA)
    expect(prose.length, 'the stripper gutted the document').toBeGreaterThan(200)
    expect(prose).toContain('PRÉVIA — sem valor de registro') // real content survived
    expect(/emit|emiss/i.test(prose), 'reserved verb reached an unregistered page').toBe(false)
  })

  it('⭐ POSITIVE CONTROL: the same sweep over a REGISTERED page HITS the verb', () => {
    // Without this the check above is satisfied by a stripper that returns prose
    // no footer could ever contain. CANONICAL's payload also contains "João
    // Emissor", so the template's own wording is asserted explicitly too.
    const prose = renderedProse(CANONICAL)
    expect(/emit|emiss/i.test(prose)).toBe(true)
    expect(prose).toContain('Emitido em ')
  })

  it('the RASCUNHO variants stay pinned — an ephemeral page uses these same templates (D2)', () => {
    // ADR 0125 D2 names these by requirement. Both draft-watermarked fixtures
    // must keep rendering the RASCUNHO marks; the prévia reuses them verbatim.
    for (const payload of [CANONICAL, MEETING_CANONICAL]) {
      const html = renderDocumentHtml(payload)
      expect(html).toContain('<div class="wm-diagonal" aria-hidden="true">RASCUNHO</div>')
      expect(html).toContain('<div class="wm-chip wm-chip-draft">RASCUNHO</div>')
    }
  })
})
