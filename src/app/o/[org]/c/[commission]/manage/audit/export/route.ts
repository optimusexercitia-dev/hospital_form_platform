import { type NextRequest } from 'next/server'

import { getCommissionAccessByOrg } from '@/lib/queries/session'
import {
  listAudit,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  type AuditAction,
  type AuditEntityType,
  type AuditFilters,
} from '@/lib/queries/audit'
import { logAuditAccess } from '@/lib/audit/access'

/**
 * CSV export of a commission's audit trail (Phase 13 — Audit Trail). This is
 * backend logic (CSV assembly + an RLS-scoped read) under `src/app`, owned by
 * backend per CLAUDE.md §4, mirroring the Phase-8 dashboard export route
 * (`/c/[slug]/dashboard/export/route.ts`): cookie client, NO service role.
 *
 *   GET /c/{slug}/manage/audit/export?[actor=…&action=…&entity=…&from=…&to=…]
 *
 * The export is ITSELF AUDITED: after the read, it emits an explicit
 * `audit.exported` row (via `logAuditAccess` → `public.log_audit_access`), the
 * same "sensitive export" instrumentation the dashboard CSV export uses — the
 * triggers can't see a read/export, so the route layer logs it. The row set comes
 * from the same RLS-scoped `listAudit` read the UI uses, so the CSV count matches
 * the on-screen, filter-applied count.
 *
 * Gating: staff_admin of the commission (or global admin). A plain staff /
 * non-member / unknown slug gets 404 (no data leak), exactly like the dashboard
 * export. pt-BR headers; a UTF-8 BOM so Excel detects the encoding.
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

// The audit export caps at a large page so a single CSV captures the filtered set
// (the UI paginates at 50; the export takes the full filtered window).
const EXPORT_PAGE_SIZE = 5000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ org: string; commission: string }> },
) {
  const { org, commission } = await params
  const { searchParams } = request.nextUrl

  // Coarse gate: must be a staff_admin of this commission (or admin). RLS is the
  // real authority; this returns a friendly 404 with no detail leak.
  const access = await getCommissionAccessByOrg(org, commission)
  if (!access) {
    return new Response('Não encontrado.', { status: 404 })
  }
  const isAdmin = access.context.isAdmin
  if (!isAdmin && access.role !== 'staff_admin') {
    return new Response('Não encontrado.', { status: 404 })
  }

  const commissionId = access.commission.id

  // Parse the same filters the on-screen list uses, so the CSV matches.
  const filters: AuditFilters = {
    actorId: searchParams.get('actor') ?? undefined,
    action: (searchParams.get('action') as AuditAction | null) ?? undefined,
    entityType: (searchParams.get('entity') as AuditEntityType | null) ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    page: 1,
    pageSize: EXPORT_PAGE_SIZE,
  }

  const { entries } = await listAudit(commissionId, filters)

  // Sensitive-EXPORT audit (ADR 0029 §6): the audit export is itself audited.
  await logAuditAccess({
    action: 'audit.exported',
    entityType: 'audit',
    entityId: commissionId,
    commissionId,
    summary: 'Trilha de auditoria exportada (CSV)',
    metadata: {
      row_count: entries.length,
      actor: filters.actorId ?? null,
      action: filters.action ?? null,
      entity: filters.entityType ?? null,
      from: filters.from ?? null,
      to: filters.to ?? null,
    },
  })

  const headers = [
    'Data/hora',
    'Ator',
    'Admin',
    'Ação',
    'Tipo de entidade',
    'Resumo',
    'Sequência',
  ]
  const rows: string[][] = entries.map((e) => [
    e.occurredAt,
    e.actorName ?? '(sistema)',
    e.actorIsAdmin ? 'sim' : 'não',
    AUDIT_ACTION_LABELS[e.action] ?? e.action,
    AUDIT_ENTITY_LABELS[e.entityType] ?? e.entityType,
    e.summary,
    String(e.seq),
  ])

  const csv = toCsv(headers, rows)
  const filename = `trilha_auditoria_${access.commission.slug || 'comissao'}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
