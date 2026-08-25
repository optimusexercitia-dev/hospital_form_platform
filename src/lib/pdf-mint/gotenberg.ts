/**
 * Gotenberg sidecar client (ADR 0104 D14): the ONLY consumer of
 * `PDF_RENDERER_URL`. The sidecar is a pinned, private-network Chromium
 * container; the HTML we send is fully self-contained (fonts, QR, CSS all
 * inline), so the renderer stays generic and fetches nothing.
 */

/** The D5 render budget — the whole mint is synchronous and bounded. */
export const RENDER_TIMEOUT_MS = 30_000

export const RENDERER_UNAVAILABLE_MESSAGE =
  'O serviço de geração de PDF está indisponível no momento. Tente novamente em instantes.'

/**
 * html → PDF bytes via `POST /forms/chromium/convert/html`.
 *
 * `footerHtml` is Gotenberg's OPTIONAL `footer.html` part (ADR 0144 D13 — the
 * dossier's "página X de Y"). ⚠ It is a SEPARATE DOCUMENT from `index.html`: it
 * inherits none of the page CSS, needs inline styles, and is where Chromium
 * substitutes `.pageNumber` / `.totalPages` — the only route to a real page
 * number, since Chromium ignores CSS `@page` margin boxes entirely.
 *
 * ⛔ **Pass it only for kinds that declare one.** Sending a footer
 * unconditionally would change the bytes of every form_response and meeting PDF,
 * moving two committed template fingerprints for no layout change. The decision
 * is payload-derived upstream (`documentFooterHtml` in `@/lib/pdf/render`), so
 * no caller branches on kind.
 */
export async function renderPdfViaGotenberg(
  html: string,
  footerHtml?: string | null,
): Promise<Buffer> {
  const base = process.env.PDF_RENDERER_URL
  if (!base) {
    // Config, not user error — but the user still needs a readable message.
    throw new Error(RENDERER_UNAVAILABLE_MESSAGE)
  }

  const form = new FormData()
  form.append(
    'files',
    new Blob([html], { type: 'text/html' }),
    'index.html',
  )
  if (footerHtml) {
    form.append(
      'files',
      new Blob([footerHtml], { type: 'text/html' }),
      'footer.html',
    )
    // ⚠ Chromium CLIPS the footer silently when the bottom margin does not
    // reserve room for it. `preferCssPageSize` hands margin authority to the
    // document's own `@page { margin: 18mm 16mm 22mm 16mm }`, whose 22mm bottom
    // is sized for this; `marginBottom` is asserted here as well so the footer
    // survives a future @page edit that forgets it. Verified against a real
    // multi-page render, not from this comment.
    form.append('marginBottom', '0.87')
  }
  // The document's @page rule is the authority on paper size/margins.
  form.append('preferCssPageSize', 'true')
  form.append('printBackground', 'true')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, '')}/forms/chromium/convert/html`,
      { method: 'POST', body: form, signal: controller.signal },
    )
    if (!res.ok) {
      throw new Error(RENDERER_UNAVAILABLE_MESSAGE)
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (error) {
    // Timeout (D5: on timeout NOTHING is minted), refused connection, non-2xx —
    // all one readable failure; the raw cause never reaches the UI.
    if (error instanceof Error && error.message === RENDERER_UNAVAILABLE_MESSAGE) {
      throw error
    }
    throw new Error(RENDERER_UNAVAILABLE_MESSAGE)
  } finally {
    clearTimeout(timer)
  }
}
