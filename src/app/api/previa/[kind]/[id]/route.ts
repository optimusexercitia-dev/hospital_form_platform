import { buildCasePayload } from '@/lib/cases/pdf-payload'
import { buildFormResponsePayload } from '@/lib/forms/pdf-payload'
import { buildMeetingPayload } from '@/lib/meetings/pdf-payload'
import { renderPreviaPdf, PREVIA_BUSY_MESSAGE } from '@/lib/pdf-mint/previa'
import type { MintRenderContext } from '@/lib/pdf/provenance'
import { templateFor } from '@/lib/pdf/render'
import { getViewerDisplayName } from '@/lib/queries/printed-documents'
import { createClient } from '@/lib/supabase/server'

/**
 * The EPHEMERAL PRÉVIA route (ADR 0125 D3/D4/D6/D9).
 *
 * HTML → Gotenberg → buffer → **this response stream**. `.upload()` and
 * `mint_printed_document` are simply not called, and `renderPreviaPdf` imports no
 * Supabase client at all — which is what makes "no bytes at rest" STRUCTURAL
 * rather than a promise.
 *
 * ⛔ **NO TEMPORARY OBJECT AT ANY POINT.** ADR 0125 D4 rejects a "temp upload,
 * delete after" variant BY NAME: it re-creates the class the split removes —
 * bytes at rest, a deletion depending on a cleanup step, PHI-tier objects living
 * in a bucket for a window. *Any "temporary" object is a permanent object with an
 * intention attached.*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY GET, WHEN IT WRITES AN AUDIT ROW
 * ═══════════════════════════════════════════════════════════════════════════
 * The sibling serving route (`/api/documents/[id]`) is also a GET that emits
 * `document.downloaded` through `open_printed_document`. Rule 11 puts a row on
 * *reads*, so an audited GET is the established shape here, not an exception.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ORDER: resolve → render → **LOG** → stream. The log is a PRECONDITION of
 * delivery, not a side effect of it.
 * ═══════════════════════════════════════════════════════════════════════════
 * ADR 0125 D3 makes the audit row the ONE half that cannot be added
 * retroactively: unstored bytes can be re-rendered from the source, but an
 * unlogged event is gone. So `log_document_previa` runs BEFORE the bytes leave,
 * and a refusal there refuses the download. Logging *after* streaming would make
 * the trail best-effort; logging *before* rendering would log prévias that never
 * rendered.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTHORIZATION IS DOUBLE, AND THE FIRST ONE IS THE REAL BOUNDARY
 * ═══════════════════════════════════════════════════════════════════════════
 *  1. The PROVIDERS read the source through `src/lib/queries/` under the
 *     CALLER'S SESSION (Rule 9), so a caller who cannot read the source cannot
 *     build a payload — the prévia fails closed on RLS with or without any door.
 *     This is D6's protection and it is genuine.
 *  2. `log_document_previa` re-gates on `app.can_view_printed_document`, the same
 *     gate `mint_printed_document` uses (D11).
 *
 * ⚠ (2) exists because (1) is TRANSITIVE: an app-layer route with no `prosecdef`
 * gate is in no ADR 0079 arm's domain (the Amendment 7 shape), so nothing would
 * go red if a future edit swapped one of those queries to the admin client. The
 * door converts that into a gate an arm can see. It is strictly more refusal than
 * D6 specified, never less. ⛔ It does NOT replace (1) — deleting the
 * caller-session reads and leaning on the door would hand the payload builder
 * service-role sight.
 */

const KINDS = new Set(['form_response', 'meeting', 'case'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Not-found and not-authorized are ONE answer, deliberately — no existence oracle. */
const NOT_FOUND = 'Registro não encontrado'

/**
 * The D9 identified-prévia flag.
 *
 * ⛔ **EXACTLY ONE RECOGNISED SPELLING, AND EVERYTHING ELSE IS DE-IDENTIFIED.**
 * `?phi=1` and nothing else. Not `phi=true`, not `phi`, not `phi=yes` — a second
 * accepted spelling is a second thing a future edit can get wrong, and the
 * failure direction here is a **PHI export**. An unrecognised flag defaulting to
 * "include PHI" would make a typo in a URL into a disclosure, so the default is
 * the safe variant and the recognised value is the narrow one. Pinned by a
 * vector asserting `?phi=true` yields the DE-IDENTIFIED variant.
 */
function wantsPhi(req: Request): boolean {
  return new URL(req.url).searchParams.get('phi') === '1'
}

export async function GET(
  req: Request,
  ctx: RouteContext<'/api/previa/[kind]/[id]'>,
) {
  const { kind, id } = await ctx.params

  if (!KINDS.has(kind) || !UUID.test(id)) {
    return new Response(NOT_FOUND, { status: 404 })
  }

  const supabase = await createClient()

  // The actor line for the prévia footer. ⛔ The verb `Emitido` must not appear
  // on an unregistered page (ADR 0125 D5) — the footer primitive states
  // "PRÉVIA — sem valor de registro" and uses `generation`, never `emission`.
  const byDisplay = await getViewerDisplayName()
  const renderCtx: MintRenderContext = {
    kind: 'previa',
    generation: { at: new Date().toISOString(), byDisplay },
  }

  let pdf: Buffer
  // The template key the RENDER actually produced. ⛔ Derived from the payload,
  // never from `wantsPhi(req)`: for a case the key encodes the D5 variant, and
  // `buildCasePayload` sets `variant` from what `get_case_patients` RETURNED.
  // Retyping the request here would put `case_identified` on an audit row for a
  // page that carries no identifiers.
  let templateKey: string
  try {
    // Under the CALLER'S session. Every provider throws a pt-BR error when the
    // source is unreachable — indistinguishable from nonexistent, by design.
    //
    // ⚠ For `case`, an UNENTITLED identified request dies HERE, in the provider
    // (`get_case_patients` → null → throw), which is what makes the door below
    // unreachable for it: no bytes, no audit row, no mislabel. See the note in
    // `log_document_previa`'s body — that guarantee depends on this ordering
    // (build → render → log → stream) and would be lost if the log moved first.
    const payload =
      kind === 'form_response'
        ? await buildFormResponsePayload(id, renderCtx)
        : kind === 'meeting'
          ? await buildMeetingPayload(id, renderCtx)
          : await buildCasePayload(id, renderCtx, { includePhi: wantsPhi(req) })

    templateKey = templateFor(payload.body).key

    // ⚠ `documentProvenance` has already refused a FINAL+prévia payload by the
    // time we get here (ADR 0125 D5's fourth cell). If that ever throws it is a
    // divergence between printSourceRegisters and printSourceWatermark — a
    // phase-blocking defect, not a rendering hiccup — so it surfaces as a 500
    // rather than being swallowed into a 404.
    pdf = await renderPreviaPdf(payload)
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    if (message === PREVIA_BUSY_MESSAGE) {
      // ADR 0125 D9: the prévia is the one that yields under load. 503 + Retry-After
      // so the client can say "tente novamente" rather than reporting a failure.
      return new Response(PREVIA_BUSY_MESSAGE, {
        status: 503,
        headers: { 'Retry-After': '5' },
      })
    }
    // Source unreachable, or a genuinely broken payload. Both become 404: the
    // caller learns nothing about which.
    return new Response(NOT_FOUND, { status: 404 })
  }

  // ── The Rule 11 row — a PRECONDITION of delivery (D3) ─────────────────────
  // Records THAT + WHO + which source + which template. No answers, no minutes,
  // no free text, no patient anything.
  // ⭐ ADR 0144 D9 — for a case this records WHICH VARIANT was previewed
  // (`case` vs `case_identified`), which is the ONLY registry-side trace an
  // identified prévia leaves, since D9 gives it no `document.minted` row. It is
  // the key `templateFor` derived from the rendered payload, not the URL flag.
  const { error: auditError } = await supabase.rpc('log_document_previa', {
    p_source_kind: kind,
    p_source_id: id,
    p_template_key: templateKey,
  })
  if (auditError) {
    // ⛔ FAIL CLOSED. No bytes leave without a log row — that is the whole point
    // of ordering the call here. A 42501 from the door means the re-gate refused
    // a caller the providers admitted, which should be unreachable (the gate is
    // the union of the responses read policies for form_response) and is worth a
    // hard refusal rather than a silent, unlogged download.
    return new Response(NOT_FOUND, { status: 404 })
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      // `inline` — a prévia is meant to be looked at, not filed.
      'Content-Disposition': `inline; filename="previa-${kind}-${id.slice(0, 8)}.pdf"`,
      // ⛔ NEVER cached. The source is still editable by definition, so a cached
      // prévia is a stale page the platform cannot invalidate — and since P3 it
      // may carry PATIENT IDENTIFIERS (a `case_identified` prévia, ADR 0144 D9),
      // where the meeting kind only ever carried incidental PHI. A cached copy
      // would also survive `dispose_case_phi`, outliving the erasure it is
      // supposed to be subject to.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  })
}
