import {
  renderFormResponseBody,
  TEMPLATE_KEY as FORM_RESPONSE_TEMPLATE_KEY,
  TEMPLATE_VERSION as FORM_RESPONSE_TEMPLATE_VERSION,
} from './documents/form-response'
import {
  renderMeetingBody,
  TEMPLATE_KEY as MEETING_TEMPLATE_KEY,
  TEMPLATE_VERSION as MEETING_TEMPLATE_VERSION,
} from './documents/meeting'
import { EMBEDDED_FONT_FACES } from './fonts.generated'
import {
  renderLetterhead,
  renderPreviaFooter,
  renderQrFooter,
  renderWatermarks,
} from './primitives'
import type { DocumentPayload } from './types'

/**
 * Payload → complete, SELF-CONTAINED HTML document (PURE — ADR 0104 D14).
 * Everything ships inline: IBM Plex faces as data-URI @font-face (the
 * Gotenberg sidecar is private-network and must fetch nothing), print CSS,
 * the QR as inline SVG. Deterministic: same payload, same string — the
 * fingerprint test and the content-hash discipline both rely on it.
 */

/** Template registry metadata, per kind (grows one entry per rollout phase). */
export const TEMPLATES: Record<
  DocumentPayload['body']['kind'],
  { key: string; version: number }
> = {
  form_response: {
    key: FORM_RESPONSE_TEMPLATE_KEY,
    version: FORM_RESPONSE_TEMPLATE_VERSION,
  },
  meeting: {
    key: MEETING_TEMPLATE_KEY,
    version: MEETING_TEMPLATE_VERSION,
  },
}

function fontFaces(): string {
  return EMBEDDED_FONT_FACES.map(
    (f) => `@font-face {
  font-family: '${f.family}';
  font-style: normal;
  font-weight: ${f.weight};
  src: url('${f.dataUri}') format('woff2');
}`,
  ).join('\n')
}

const PRINT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4; margin: 18mm 16mm 22mm 16mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 10pt; line-height: 1.45; color: #1c1c1c;
}
.letterhead { display: flex; gap: 6mm; align-items: center;
  border-bottom: 1.2pt solid #1c1c1c; padding-bottom: 4mm; margin-bottom: 6mm; }
.lh-logo { max-height: 16mm; max-width: 34mm; }
.lh-hospital { font-family: 'IBM Plex Serif', serif; font-weight: 600; font-size: 14pt; }
.lh-address { font-size: 8.5pt; color: #444; }
.lh-commission { font-size: 10pt; margin-top: 1mm; }
.doc-title { font-family: 'IBM Plex Serif', serif; font-weight: 600; font-size: 15pt; margin: 0 0 3mm; }
.doc-meta { font-size: 8.5pt; color: #444; margin-bottom: 6mm; }
.doc-meta .meta-item { margin-right: 6mm; }
.doc-section { margin-bottom: 7mm; break-inside: avoid-page; }
.section-title { font-family: 'IBM Plex Serif', serif; font-weight: 600; font-size: 11.5pt;
  border-bottom: 0.6pt solid #999; padding-bottom: 1mm; margin-bottom: 2.5mm; }
.section-description { font-size: 9pt; color: #444; margin-bottom: 2.5mm; }
.section-table { width: 100%; border-collapse: collapse; }
.section-table td { border: 0.5pt solid #bbb; padding: 1.8mm 2.5mm; vertical-align: top; }
.cell-label { width: 42%; color: #333; }
.cell-value { font-weight: 600; white-space: pre-line; }
.row-display td { background: #f4f4f4; font-size: 9pt; color: #333; }
.unanswered { color: #767676; font-weight: 400; font-style: italic; }
.section-empty { font-size: 9pt; color: #767676; font-style: italic; }
.signature-block { margin-top: 3mm; padding: 2.5mm 3mm; border: 0.5pt solid #999;
  background: #fafafa; break-inside: avoid; }
.sig-line { font-size: 9.5pt; }
.sig-caption { font-size: 7.5pt; color: #666; margin-top: 1mm; }
.signature-missing { color: #767676; font-style: italic; }
.qr-footer { display: flex; gap: 5mm; align-items: center; margin-top: 10mm;
  border-top: 0.6pt solid #999; padding-top: 4mm; break-inside: avoid; }
.qr-code svg { width: 24mm; height: 24mm; }
.qr-meta { font-size: 8pt; color: #333; }
.qr-url { font-family: 'IBM Plex Mono', monospace; font-size: 8pt; }
.qr-short { margin-top: 1mm; }
.qr-short-code { font-family: 'IBM Plex Mono', monospace; font-weight: 600; letter-spacing: 0.08em; }
.qr-emission { margin-top: 1mm; color: #555; }
.wm-diagonal { position: fixed; top: 42%; left: 6%; right: 6%; text-align: center;
  transform: rotate(-28deg); font-family: 'IBM Plex Serif', serif; font-weight: 600;
  font-size: 64pt; letter-spacing: 0.2em; color: rgba(120, 120, 120, 0.16); z-index: 0; }
.wm-chip { position: fixed; top: 0; right: 0; font-size: 8.5pt; font-weight: 600;
  letter-spacing: 0.12em; padding: 1mm 3mm; border: 1pt solid; }
.wm-chip-draft { color: #8a5a00; border-color: #8a5a00; }
.wm-chip-final { color: #1c5c34; border-color: #1c5c34; }
.phi-band { position: fixed; left: 0; right: 0; text-align: center;
  font-size: 8pt; font-weight: 600; letter-spacing: 0.08em;
  color: #7a1f1f; border-color: #7a1f1f; }
.phi-band-top { top: -12mm; border-bottom: 0.6pt solid; padding-bottom: 0.8mm; }
.phi-band-bottom { bottom: -16mm; border-top: 0.6pt solid; padding-top: 0.8mm; }
.doc-content { position: relative; z-index: 1; }
`

function renderBody(payload: DocumentPayload): string {
  switch (payload.body.kind) {
    case 'form_response':
      return renderFormResponseBody(payload.body)
    case 'meeting':
      // The ata's multi-signature footer renders from the ENVELOPE (D13).
      return renderMeetingBody(payload.body, payload.signatures)
    // No default: the switch is EXHAUSTIVE over DocumentBody — a new kind that
    // forgets its template is a compile error here, mirroring the SQL
    // dispatch's fail-closed ELSE (ADR 0104 D3).
  }
}

/**
 * The provenance footer (ADR 0125 D5): the QR block for a REGISTERED emission,
 * the prévia block for an EPHEMERAL page.
 *
 * ⚠ The prévia footer carries its own scoped `<style>` rather than extending
 * {@link PRINT_CSS}, which is deliberate: PRINT_CSS is part of every document's
 * content hash, so styling the ephemeral page through it would move both
 * committed template fingerprints and force `TEMPLATE_VERSION` bumps on two
 * templates whose layout did not change. Registered output is therefore
 * BYTE-IDENTICAL to what this function produced before the prévia existed —
 * proven by the four fingerprint assertions, not asserted here.
 */
function renderProvenanceFooter(payload: DocumentPayload): string {
  switch (payload.provenance.kind) {
    case 'registered':
      return renderQrFooter(payload.provenance.qr, payload.provenance.emission)
    case 'previa':
      return renderPreviaFooter(payload.provenance.generation)
    // No default: EXHAUSTIVE over DocumentProvenance — a third provenance that
    // forgets its footer is a compile error here, like renderBody's switch.
  }
}

/** The one entry point: payload → full HTML document string. */
export function renderDocumentHtml(payload: DocumentPayload): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
${fontFaces()}
${PRINT_CSS}
</style>
</head>
<body>
${renderWatermarks([payload.provenance.watermark], payload.containsPhi)}
<div class="doc-content">
${renderLetterhead(payload.letterhead)}
${renderBody(payload)}
${renderProvenanceFooter(payload)}
</div>
</body>
</html>`
}
