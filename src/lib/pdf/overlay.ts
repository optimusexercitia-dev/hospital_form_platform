import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'

import type { PrintedDocumentStatus } from './types'

/**
 * Download-time status overlay (ADR 0104 D8). Stored bytes are immutable and
 * hash-pinned, so `SUBSTITUÍDO`/`ANULADO` cannot be baked — the serving route
 * lays a deterministic, minimal stamp over the canonical bytes on the fly
 * (pdf-lib, no Chromium). This closes the real hole: re-downloading an old PDF
 * and printing it fresh, bypassing the QR entirely.
 *
 * Verification semantics (stated once, in the ADR): the registry hash pins the
 * CANONICAL mint bytes; overlaid copies are derived and will not hash-match.
 *
 * PURE per D14's terms (no supabase, no queries, no server-only) — pdf-lib is
 * plain JS, Vitest-safe.
 */

const STAMP_TEXT: Record<Exclude<PrintedDocumentStatus, 'active'>, string> = {
  superseded: 'SUBSTITUÍDO',
  revoked: 'ANULADO',
}

/**
 * `active` → the canonical bytes, UNTOUCHED (same reference — served bytes
 * hash-match the registry). Any other status → every page stamped diagonally.
 */
export async function applyStatusOverlay(
  bytes: Uint8Array,
  status: PrintedDocumentStatus,
): Promise<Uint8Array> {
  if (status === 'active') return bytes

  const text = STAMP_TEXT[status]
  const doc = await PDFDocument.load(bytes)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const size = Math.min(width, height) / 6.5
    const textWidth = font.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: width / 2 - textWidth / 2.6,
      y: height / 2 - size / 2,
      size,
      font,
      color: rgb(0.72, 0.16, 0.16),
      opacity: 0.28,
      rotate: degrees(30),
    })
  }
  return doc.save()
}
