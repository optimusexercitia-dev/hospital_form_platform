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

/** html → PDF bytes via `POST /forms/chromium/convert/html`. */
export async function renderPdfViaGotenberg(html: string): Promise<Buffer> {
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
