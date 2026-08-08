import { esc } from '../escape'
import { formatDateTime } from '../format'
import {
  renderSectionTable,
  renderSignatureBlock,
  renderUnsigned,
} from '../primitives'
import type { FormResponseDocumentBody } from '../types'

/**
 * The form_response document template (PDF·P1; ADR 0104 D4/D15 rollout step 1).
 *
 * TEMPLATE_VERSION is LOAD-BEARING metadata: it is recorded in the registry at
 * mint and reported by verification. ⛔ Any visual/structural change to this
 * template REQUIRES bumping it — `fingerprint.test.ts` reds when the rendered
 * structure changes under an unchanged version (D4's silent-staleness guard).
 */
export const TEMPLATE_KEY = 'form_response'
export const TEMPLATE_VERSION = 1

const STATUS_LABEL: Record<FormResponseDocumentBody['responseStatus'], string> = {
  in_progress: 'Em preenchimento',
  submitted: 'Enviado',
}

/** Renders the body (between letterhead and QR footer) of a form response. */
export function renderFormResponseBody(body: FormResponseDocumentBody): string {
  const meta = [
    `<span class="meta-item">Versão do formulário: ${body.versionNumber}</span>`,
    `<span class="meta-item">Preenchido por: ${esc(body.respondentDisplay)}</span>`,
    `<span class="meta-item">Situação: ${STATUS_LABEL[body.responseStatus]}</span>`,
    `<span class="meta-item">Iniciado em: ${formatDateTime(body.startedAt)}</span>`,
    body.submittedAt
      ? `<span class="meta-item">Enviado em: ${formatDateTime(body.submittedAt)}</span>`
      : '',
  ]
    .filter(Boolean)
    .join('\n    ')

  const sections = body.sections
    .map((section) => {
      const heading = section.title
        ? `<h2 class="section-title">${esc(section.title)}</h2>`
        : ''
      const description = section.description
        ? `<p class="section-description">${esc(section.description)}</p>`
        : ''
      const signature = section.requiresSignoff
        ? section.signature
          ? renderSignatureBlock(section.signature)
          : renderUnsigned()
        : ''
      return `<section class="doc-section">
  ${heading}
  ${description}
  ${renderSectionTable(section.items)}
  ${signature}
</section>`
    })
    .join('\n')

  return `<h1 class="doc-title">${esc(body.formTitle)}</h1>
<div class="doc-meta">
    ${meta}
</div>
${sections}`
}
