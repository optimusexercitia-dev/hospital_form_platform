import {
  renderFormResponseBody,
  TEMPLATE_KEY as FORM_RESPONSE_TEMPLATE_KEY,
  TEMPLATE_VERSION as FORM_RESPONSE_TEMPLATE_VERSION,
} from './documents/form-response'
import {
  renderCaseBody,
  TEMPLATE_KEY as CASE_TEMPLATE_KEY,
  TEMPLATE_KEY_IDENTIFIED as CASE_IDENTIFIED_TEMPLATE_KEY,
  TEMPLATE_VERSION as CASE_TEMPLATE_VERSION,
} from './documents/case'
import {
  renderMeetingBody,
  TEMPLATE_KEY as MEETING_TEMPLATE_KEY,
  TEMPLATE_VERSION as MEETING_TEMPLATE_VERSION,
} from './documents/meeting'
import { esc } from './escape'
import { EMBEDDED_FONT_FACES } from './fonts.generated'
import {
  renderLetterhead,
  renderPreviaFooter,
  renderQrFooter,
  renderWatermarks,
} from './primitives'
import type { DocumentBody, DocumentPayload } from './types'

/**
 * Payload → complete, SELF-CONTAINED HTML document (PURE — ADR 0104 D14).
 * Everything ships inline: IBM Plex faces as data-URI @font-face (the
 * Gotenberg sidecar is private-network and must fetch nothing), print CSS,
 * the QR as inline SVG. Deterministic: same payload, same string — the
 * fingerprint test and the content-hash discipline both rely on it.
 */

/**
 * Every registered template key.
 *
 * ⚠ **NOT one per body kind any more** — `case` contributes TWO (ADR 0144 D5/D7
 * as amended): the de-identified dossier and the identified one are the same
 * body kind rendered with different patient content, and the KEY is what carries
 * the variant through the registry. `printed_documents_one_active` is
 * `(source_kind, source_series_id, template_key)`, so the two keys supersede
 * INDEPENDENTLY over one series — which is exactly what D7 needed and why the
 * mint door required no new parameter.
 */
export type PdfTemplateKey =
  | 'form_response'
  | 'meeting'
  | 'case'
  | 'case_identified'

/** Template registry metadata, per KEY (grows with each rollout phase). */
export const TEMPLATES: Record<
  PdfTemplateKey,
  { key: PdfTemplateKey; version: number }
> = {
  form_response: {
    key: FORM_RESPONSE_TEMPLATE_KEY as PdfTemplateKey,
    version: FORM_RESPONSE_TEMPLATE_VERSION,
  },
  meeting: {
    key: MEETING_TEMPLATE_KEY as PdfTemplateKey,
    version: MEETING_TEMPLATE_VERSION,
  },
  case: {
    key: CASE_TEMPLATE_KEY as PdfTemplateKey,
    version: CASE_TEMPLATE_VERSION,
  },
  case_identified: {
    key: CASE_IDENTIFIED_TEMPLATE_KEY as PdfTemplateKey,
    // Deliberately the SAME version as `case`: one module, one layout, one
    // fingerprint-bump decision. They are two KEYS of one template, not two
    // templates — so a structural edit bumps both, and each key's committed
    // fingerprint pins its own variant of that structure.
    version: CASE_TEMPLATE_VERSION,
  },
}

/**
 * ⭐ **THE TEMPLATE IDENTITY OF A RENDER, DERIVED FROM THE PAYLOAD THAT WAS
 * RENDERED.** This is the ONE authority on "which template key do we tell the
 * registry we produced", and it reads the bytes' own description rather than the
 * caller's request.
 *
 * ⛔ **The rejected design was a `templateKeyFor(options)` on the provider**,
 * computed from the same `{ includePhi }` flag that drives `build()`. That gives
 * one fact two authorities that agree only by care — and it has a live failure
 * mode, not a theoretical one: `public.get_case_patients` answers `null` for an
 * unentitled caller and `[]` for an entitled one with no patient on file, so a
 * `build` invoked with `includePhi: true` can legitimately produce a payload
 * with NO identifiers in it. A request-derived key would then label those bytes
 * `case_identified` and mint them into the identified series, SUPERSEDING a real
 * identified dossier with one that has no identifiers.
 *
 * The provider closes the other half by THROWING on both of those answers, so
 * `variant: 'identified'` is provably equivalent to *"the patient identification
 * section was rendered"*. Between the two rules, the registry's label cannot
 * disagree with the bytes.
 *
 * ⚠ This is the same argument {@link DocumentPayload.sourceRevision}'s docstring
 * already makes for the revision: a fact about the render must reach the door
 * FROM the render, never from a second read.
 *
 * ⛔ EXHAUSTIVE, with no `default` — mirroring `renderBody` below. A future body
 * kind that forgets its template is a COMPILE error here, not a runtime label.
 */
export function templateFor(body: DocumentBody): {
  key: PdfTemplateKey
  version: number
} {
  switch (body.kind) {
    case 'form_response':
      return TEMPLATES.form_response
    case 'meeting':
      return TEMPLATES.meeting
    case 'case':
      return body.variant === 'identified'
        ? TEMPLATES.case_identified
        : TEMPLATES.case
  }
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
    case 'case':
      // ⚠ ONE renderer for BOTH template keys — the variant changes what the
      // patient section contains, never which function runs. `templateFor`
      // above is what turns that into two registry keys.
      return renderCaseBody(payload.body)
    // No default: the switch is EXHAUSTIVE over DocumentBody — a new kind that
    // forgets its template is a compile error here, mirroring the SQL
    // dispatch's fail-closed ELSE (ADR 0104 D3).
  }
}

/**
 * The Gotenberg PAGE FOOTER for this payload, or `null` for kinds that have
 * none (ADR 0144 D13's "página X de Y").
 *
 * ⚠ **THIS IS A SEPARATE DOCUMENT FROM THE PAGE**, and that is forced, not
 * chosen: Chromium IGNORES CSS `@page` margin boxes, so `counter(page)` /
 * `counter(pages)` are unreachable from the HTML itself. The only route to a
 * real page number is Gotenberg's `footer.html` multipart file, where Chromium
 * substitutes `.pageNumber` / `.totalPages`. It therefore inherits none of the
 * document's CSS and must carry its own inline styles.
 *
 * ⛔ **PAGE NUMBERS SHIP FOR `case` ONLY, AND THAT ASYMMETRY IS DELIBERATE.**
 * Someone will later notice the inconsistency and "fix" it by returning a footer
 * for every kind. ⚠ That would change the BYTES of every form_response and
 * meeting PDF, moving two committed template fingerprints and forcing
 * `TEMPLATE_VERSION` bumps on two templates whose layout did not change — the
 * same hazard {@link renderProvenanceFooter}'s note describes for the shared
 * shell CSS. The dossier gets numbers because it is the only kind long enough to
 * need them: a 60-page record handed to an accreditation tracer cannot be shown
 * to be COMPLETE without them.
 *
 * ⚠ **Two guards cover this footer and they are not redundant.** The bytes are
 * inside `printed_documents.content_hash` (so tampering is detectable on a
 * MINTED document), while `fingerprint.test.ts` composes its input as
 * `html + (footer ?? '')` — the STRUCTURAL guard that stops US changing the
 * footer without a deliberate version decision. The hash protects the artifact;
 * the fingerprint protects the template.
 *
 * PURE, and payload-derived like {@link templateFor} — so the mint action needs
 * no branch on kind.
 */
export function documentFooterHtml(payload: DocumentPayload): string | null {
  if (payload.body.kind !== 'case') return null
  return `<div style="width:100%;font-family:sans-serif;font-size:7pt;color:#555;padding:0 16mm;display:flex;justify-content:space-between;">
<span>${esc(payload.body.caseDisplay)}</span>
<span>página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
</div>`
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
