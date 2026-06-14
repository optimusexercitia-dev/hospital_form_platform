import { type NextRequest } from 'next/server'

import { getFormExport } from '@/lib/queries/dashboard'
import { getCommissionAccess } from '@/lib/queries/session'

/**
 * CSV export of a form's raw standalone-submitted responses (Phase 8 B4). This
 * is backend logic (CSV assembly + a definer-RPC read) under `src/app`, owned by
 * backend per CLAUDE.md §4.
 *
 *   GET /c/{slug}/dashboard/export?form={formId}
 *
 * Gating: staff_admin of the commission (or global admin). A plain staff /
 * non-member / unknown slug gets 404 (no data leak). The form must belong to the
 * commission and have a published version; the row set comes from the
 * `dashboard_export_rows` definer RPC (also internally gated), so the count
 * matches the dashboard's standalone `totalSubmitted` (case-phase responses
 * excluded — ADR 0020). pt-BR headers; a UTF-8 BOM so Excel detects the encoding.
 */

// One CSV field: quote when it contains a comma, quote, or newline; escape inner
// quotes by doubling (RFC 4180).
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((cells) => cells.map(csvField).join(','))
  // CRLF line endings (RFC 4180) + a leading UTF-8 BOM for Excel.
  return `﻿${lines.join('\r\n')}\r\n`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const formId = request.nextUrl.searchParams.get('form')

  if (!formId) {
    return new Response('Parâmetro "form" ausente.', { status: 400 })
  }

  // Coarse gate: must be a staff_admin of this commission (or admin). RLS +
  // the RPC's internal gate are the real authority; this returns a friendly 404.
  const access = await getCommissionAccess(slug)
  if (!access) {
    return new Response('Não encontrado.', { status: 404 })
  }
  const isAdmin = access.context.isAdmin
  if (!isAdmin && access.role !== 'staff_admin') {
    return new Response('Não encontrado.', { status: 404 })
  }

  const exportData = await getFormExport(formId)
  if (!exportData) {
    // Form not found / not published / not entitled → 404, no detail leak.
    return new Response('Não encontrado.', { status: 404 })
  }

  const csv = toCsv(exportData.headers, exportData.rows)

  // A safe ASCII filename derived from the form title.
  const safeTitle = exportData.formTitle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  const filename = `respostas_${safeTitle || 'formulario'}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
