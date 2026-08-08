import type { WatermarkFlag } from '../types'

/**
 * Mint-time watermarks (ADR 0104 D7) — DERIVED-ONLY, one primitive, no free
 * text ever. `draft` prints the diagonal `RASCUNHO` overlay (position: fixed
 * repeats it on every printed page in Chromium) plus a header chip; `final`
 * prints the discreet `FINAL` chip — every document declares its state, so an
 * unmarked page is evidence of tampering, not the normal case.
 *
 * `SUBSTITUÍDO`/`ANULADO` are deliberately NOT here: they are the serving
 * route's pdf-lib overlay over the immutable canonical bytes (D8).
 *
 * The confidentiality band (`containsPhi`) is part of this primitive because it
 * is a derived, non-suppressible mark of the same family (D7).
 */
export function renderWatermarks(
  watermarks: WatermarkFlag[],
  containsPhi: boolean,
): string {
  const parts: string[] = []
  if (watermarks.includes('draft')) {
    parts.push(
      '<div class="wm-diagonal" aria-hidden="true">RASCUNHO</div>',
      '<div class="wm-chip wm-chip-draft">RASCUNHO</div>',
    )
  } else if (watermarks.includes('final')) {
    parts.push('<div class="wm-chip wm-chip-final">FINAL</div>')
  }
  if (containsPhi) {
    // Header/footer band, not suppressible (D7).
    parts.push(
      '<div class="phi-band phi-band-top">DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE</div>',
      '<div class="phi-band phi-band-bottom">DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE</div>',
    )
  }
  return parts.join('\n')
}
