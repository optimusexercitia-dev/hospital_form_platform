import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { applyStatusOverlay } from './overlay'

/**
 * D8 overlay contract: bytes-in/bytes-out, both stamps, and the ACTIVE no-op —
 * an active document's served bytes are the canonical bytes (same reference),
 * so the registry hash still matches what the client receives.
 */

async function makeTestPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page1 = doc.addPage([595, 842])
  page1.drawText('Documento de teste — página 1', { x: 50, y: 780, size: 14 })
  const page2 = doc.addPage([595, 842])
  page2.drawText('página 2', { x: 50, y: 780, size: 14 })
  return doc.save()
}

describe('applyStatusOverlay (ADR 0104 D8)', () => {
  it('active: returns the CANONICAL bytes untouched — same reference, hash still matches', async () => {
    const canonical = await makeTestPdf()
    const served = await applyStatusOverlay(canonical, 'active')
    expect(served).toBe(canonical)
  })

  it('superseded: stamps every page and changes the bytes', async () => {
    const canonical = await makeTestPdf()
    const served = await applyStatusOverlay(canonical, 'superseded')
    expect(served).not.toBe(canonical)
    expect(Buffer.from(served).equals(Buffer.from(canonical))).toBe(false)
    // Still a loadable PDF with the same page count (a stamp, not surgery).
    const reloaded = await PDFDocument.load(served)
    expect(reloaded.getPageCount()).toBe(2)
  })

  it('revoked: stamps too, and differs from the superseded stamp (different text)', async () => {
    const canonical = await makeTestPdf()
    const revoked = await applyStatusOverlay(canonical, 'revoked')
    const superseded = await applyStatusOverlay(canonical, 'superseded')
    expect(Buffer.from(revoked).equals(Buffer.from(canonical))).toBe(false)
    expect(Buffer.from(revoked).equals(Buffer.from(superseded))).toBe(false)
    const reloaded = await PDFDocument.load(revoked)
    expect(reloaded.getPageCount()).toBe(2)
  })
})
