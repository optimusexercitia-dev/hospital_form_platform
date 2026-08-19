import { esc } from '../escape'
import { formatDateTime } from '../format'
import type { DocumentGeneration } from '../types'

/**
 * The PRÉVIA footer (ADR 0125 D5) — the ephemeral SIBLING of
 * {@link import('./qr-footer').renderQrFooter}.
 *
 * ⭐ **Why a sibling and not "the QR footer minus the QR".** `qr-footer.ts`
 * renders the QR, the `Código de verificação` **and** the `Emitido em … por …`
 * provenance line as ONE block — so simply dropping the QR would drop the
 * provenance with it. This replacement states the page's status IN WORDS and
 * KEEPS the provenance.
 *
 * ⛔ **The verb `Emitido` MUST NOT APPEAR here.** ADR 0125 D5 reserves it for the
 * registered act. Keeping it while dropping the QR would let the page claim in
 * words what the missing QR denies, and would preserve half the "controlled
 * copy" signal ADR 0104 D7 relied on when it rejected a `VIA NÃO CONTROLADA`
 * stamp. Hence `Gerada em …`, never `Emitido em …`.
 *
 * ⭐ **THE FOOTER — NOT THE WATERMARK — IS WHAT ANSWERS "IS THIS A RECORD?"**
 * (0125 D5). The two axes are read independently: the watermark states whether
 * the CONTENT is final; this footer states whether the PAGE is a record. An
 * earlier draft of the ADR argued "RASCUNHO ⇔ no QR", which is FALSE once
 * `in_signature` registers — a registered ata is stamped RASCUNHO **and** carries
 * a QR. Of the four combinations, three are legal and the fourth (FINAL content +
 * this footer) must never become reachable; that is pinned in
 * `../documents/print-source.test.ts`, not reasoned about.
 *
 * ⚠ **Template-SCOPED styles, and that is load-bearing, not stylistic.** The
 * shared `PRINT_CSS` in `../render.ts` is part of EVERY document's hash, so
 * adding these rules there would move both committed template fingerprints and
 * force a `TEMPLATE_VERSION` bump on two templates whose layout did not change —
 * corrupting registry metadata (`fingerprint.test.ts` / ADR 0104 D4) to style a
 * page that is never stored. Emitting a scoped block instead means REGISTERED
 * documents render byte-identically to before this primitive existed, which the
 * existing fingerprint suite already pins. Same reason, same shape as
 * `../documents/meeting.ts`.
 *
 * The automatic `contains_phi` confidentiality band is UNCHANGED and still not
 * suppressible: it is part of `renderWatermarks` (ADR 0104 D7), so a PHI prévia
 * carries it exactly like a PHI emission does.
 */

const STYLE = `<style>
.previa-footer { margin-top: 10mm; border-top: 0.6pt solid #999; padding-top: 4mm;
  break-inside: avoid; font-size: 8pt; color: #333; }
.previa-status { font-weight: 600; letter-spacing: 0.06em; color: #8a5a00; }
.previa-generation { margin-top: 1mm; color: #555; }
</style>`

/**
 * Renders the ephemeral page's footer: status in words, then provenance.
 *
 * Deterministic (same input, same bytes) like every primitive here — the prévia
 * is never hashed, but it shares the render pipeline with the emission and the
 * pipeline's determinism is what `fingerprint.test.ts` relies on.
 */
export function renderPreviaFooter(generation: DocumentGeneration): string {
  return `${STYLE}
<footer class="previa-footer">
  <div class="previa-status">PRÉVIA — sem valor de registro, não verificável.</div>
  <div class="previa-generation">Gerada em ${esc(formatDateTime(generation.at))} por ${esc(generation.byDisplay)}.</div>
</footer>`
}
