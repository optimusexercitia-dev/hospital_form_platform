import { documentFooterHtml, renderDocumentHtml } from '@/lib/pdf/render'
import type { DocumentPayload } from '@/lib/pdf/types'

import { renderPdfViaGotenberg } from './gotenberg'
import { mintSemaphore } from './semaphore'

/**
 * The EPHEMERAL prévia render path (ADR 0125 D3/D4/D9).
 *
 * HTML → Gotenberg → buffer → the caller's response stream. `.upload()` and the
 * `mint_printed_document` RPC are simply NOT CALLED — this module imports no
 * Supabase client at all, which is what makes "no bytes at rest" structural
 * rather than a promise. `previa.test.ts` pins that with a differential against
 * `actions.ts`, the sibling that DOES upload.
 *
 * ⛔ **NO TEMPORARY OBJECT AT ANY POINT.** A "temp upload, delete after" variant
 * is rejected BY NAME in ADR 0125 D4: it re-creates the exact class the split
 * removes — bytes at rest, a deletion that depends on a cleanup step, and
 * PHI-tier objects living in a bucket for a window. `FUP-DM5-DISPOSAL-JOB` is
 * open because a cleanup job that was written down did not exist, and S4 found
 * real bytes surviving a count-based check. **Any "temporary" object is a
 * permanent object with an intention attached.**
 *
 * ⚠ **Same render pipeline, deliberately.** A prévia that does not match the
 * document it previews is not one, and a second rendering path (browser
 * `window.print()`) would give the platform two ways a document can look, pinned
 * by one fingerprint suite.
 *
 * ⚠ **The Rule 11 audit row is NOT written here** — it belongs to the route
 * handler, with the session that knows the actor. ADR 0125 D3 makes it the one
 * half that CANNOT be added retroactively: unstored bytes can be re-rendered
 * from the source, but an unlogged event is gone.
 */

/**
 * ADR 0125 D9 — the prévia SHARES `mintSemaphore` (3 permits, unchanged) but
 * acquires with a materially shorter wait, so under load it is the one that
 * fails `tente novamente`.
 *
 * ⚠ Separate pools were rejected: they would protect emissions by REMOVING the
 * protection on the Gotenberg sidecar, which is what the permit count exists for
 * (ADR 0104 D5). A prévia is the frequent, retryable convenience; an emission is
 * the rare, deliberate act often performed in front of a committee. The common
 * case must not displace the consequential one.
 */
export const PREVIA_ACQUIRE_TIMEOUT_MS = 1_000

/**
 * pt-BR busy message for the prévia path.
 *
 * ⛔ It must NOT reuse `MINT_BUSY_MESSAGE` — that string reads *"O serviço de
 * **emissão** está ocupado"*, and `Emitido`/`emissão` is a RESERVED VERB naming
 * the registered act only (ADR 0125 D5 + Consequences). Surfacing it on a
 * still-editable source is exactly the defect the reserved verb rule names.
 */
export const PREVIA_BUSY_MESSAGE =
  'A geração de prévias está ocupada no momento. Tente novamente em instantes.'

/**
 * Render an ephemeral prévia to PDF bytes. Returns the buffer; storing it
 * anywhere is a defect.
 *
 * @throws pt-BR {@link PREVIA_BUSY_MESSAGE} when no permit frees up in time.
 */
export async function renderPreviaPdf(payload: DocumentPayload): Promise<Buffer> {
  if (payload.provenance.kind !== 'previa') {
    // Fail LOUD rather than silently emitting a registered-looking page down a
    // path that stores nothing and audits differently. Unreachable through the
    // providers (the seam in `@/lib/pdf/provenance` composes the discriminant),
    // so this is a backstop against a future direct caller.
    throw new Error('Não foi possível gerar a prévia: estado de impressão inconsistente.')
  }
  const html = renderDocumentHtml(payload)
  // ⚠ THE SAME FOOTER THE EMISSION GETS (ADR 0144 D13). A prévia that does not
  // match the document it previews is not one — and a dossier previewed without
  // its page numbers would paginate differently from the emission a coordinator
  // is deciding whether to produce. `null` for every non-case kind, so no other
  // prévia's bytes change.
  const footer = documentFooterHtml(payload)
  return mintSemaphore.run(
    () => renderPdfViaGotenberg(html, footer),
    PREVIA_ACQUIRE_TIMEOUT_MS,
    PREVIA_BUSY_MESSAGE,
  )
}
