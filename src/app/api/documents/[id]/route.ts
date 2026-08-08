import { applyStatusOverlay } from '@/lib/pdf/overlay'
import type { PrintedDocumentStatus } from '@/lib/pdf/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * The printed-document SERVING ROUTE (PDF·P1; ADR 0104 D8) — the ONLY byte
 * path. A bare signed Storage URL for `printed_documents` objects is a defect
 * class from day one (ADR 0104 Consequences): every download flows through
 * here so the download-time authority check and the status overlay ALWAYS
 * apply.
 *
 * Flow: caller session → `open_printed_document` door (authorizes at CALL time
 * per D11 + emits the `document.downloaded` audit row, D12) → service-role
 * Storage download (the bucket has no client policies — M3) → pdf-lib
 * `SUBSTITUÍDO`/`ANULADO` overlay when non-active → stream. The storage path
 * never reaches the client; unauthenticated hits are bounced to /login by the
 * middleware before arriving here.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/documents/[id]'>,
) {
  const { id } = await ctx.params

  // UUID shape gate: the door takes a uuid; garbage becomes a clean 404
  // instead of a PostgREST cast error.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response('Documento não encontrado', { status: 404 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('open_printed_document', {
    p_id: id,
  })
  const row = data?.[0]
  if (error || !row) {
    // Not found and out-of-scope are indistinguishable (the door returns no
    // row for both — no oracle).
    return new Response('Documento não encontrado', { status: 404 })
  }

  const admin = createAdminClient()
  const { data: blob, error: downloadError } = await admin.storage
    .from('printed-documents')
    .download(row.storage_path)
  if (downloadError || !blob) {
    return new Response('Documento indisponível no momento', { status: 503 })
  }

  const canonical = new Uint8Array(await blob.arrayBuffer())
  const served = await applyStatusOverlay(
    canonical,
    row.status as PrintedDocumentStatus,
  )

  return new Response(new Uint8Array(served), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="documento-${id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
