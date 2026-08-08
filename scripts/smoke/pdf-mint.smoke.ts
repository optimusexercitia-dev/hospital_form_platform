import { createHash } from 'node:crypto'

import {
  createClient as createSupabaseJsClient,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/types/database'

/**
 * PDF·P1 END-TO-END MINT SMOKE (lead B7 brief). Runs the REAL pipeline against
 * the REAL substrate: seeded local Supabase + a running Gotenberg sidecar.
 *
 *   mint a seeded response (real provider → real render → real Gotenberg →
 *   real Storage upload → real mint door) → open door → download bytes →
 *   sha-256 === registry content_hash → verification lookup returns the tuple
 *   (+ the registry id for a source-visible viewer).
 *
 * PRECONDITIONS: `supabase start` + seeded DB; Gotenberg per
 * docs/deployment/pdf-renderer.md; PDF_RENDERER_URL + PDF_VERIFICATION_BASE_URL
 * in .env.local. Run: `npx vitest run --config vitest.smoke.config.ts`.
 *
 * The ONLY substitution: `@/lib/supabase/server`'s cookie-bound factory is
 * replaced by a password-authenticated supabase-js client for the seeded
 * `chefe.ccih` persona — the cookie PLUMBING is swapped, never the data path,
 * the doors, or the RLS the pipeline runs under.
 */

let userClient: SupabaseClient<Database>

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => userClient,
}))

// Imported AFTER the mock declaration (vitest hoists vi.mock above these).
import { mintPrintedDocument } from '@/lib/pdf-mint/actions'
import { lookupPrintedDocumentVerification } from '@/lib/queries/printed-documents'
import { createAdminClient } from '@/lib/supabase/admin'

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

let mintedId: string | null = null

beforeAll(async () => {
  userClient = createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error } = await userClient.auth.signInWithPassword({
    email: 'chefe.ccih@test.local',
    password: 'Test1234!',
  })
  if (error) throw new Error(`smoke login failed: ${error.message}`)
})

afterAll(async () => {
  // Tidy the shared local stack (the row/object are smoke artifacts; audit
  // rows stay — the ledger is append-only by design).
  if (mintedId) {
    const admin = createAdminClient()
    await admin.storage.from('printed-documents').remove([`std/${mintedId}.pdf`])
    await admin.from('printed_documents').delete().eq('id', mintedId)
  }
  await userClient.auth.signOut()
})

describe('PDF·P1 end-to-end mint smoke', () => {
  it('mints, serves hash-faithful bytes, and verifies', async () => {
    // A seeded SUBMITTED response chefe.ccih (staff_admin CCIH) can view.
    const { data: responses } = await userClient
      .from('responses')
      .select('id')
      .eq('status', 'submitted')
      .limit(1)
    const sourceId = responses?.[0]?.id
    expect(sourceId, 'seeded submitted response visible to chefe.ccih').toBeTruthy()

    // ── The REAL mint pipeline ──────────────────────────────────────────────
    const mint = await mintPrintedDocument({
      sourceKind: 'form_response',
      sourceId: sourceId!,
    })
    expect(mint.error).toBeUndefined()
    expect(mint.ok).toBe(true)
    const doc = mint.document!
    mintedId = doc.id
    expect(doc.status).toBe('active')
    expect(doc.verificationShortCode).toMatch(/^[A-HJ-NP-Z2-9]{10}$/)
    expect(doc.downloadPath).toBe(`/api/documents/${doc.id}`)

    // ── The open door (the serving route's authority+audit core) ────────────
    const { data: opened, error: openError } = await userClient.rpc(
      'open_printed_document',
      { p_id: doc.id },
    )
    expect(openError).toBeNull()
    expect(opened?.[0]?.status).toBe('active')
    expect(opened?.[0]?.storage_path).toBe(`std/${doc.id}.pdf`)

    // ── Bytes: canonical download hash-matches the registry pin ─────────────
    const admin = createAdminClient()
    const { data: blob, error: dlError } = await admin.storage
      .from('printed-documents')
      .download(opened![0].storage_path)
    expect(dlError).toBeNull()
    const bytes = new Uint8Array(await blob!.arrayBuffer())
    expect(bytes.byteLength).toBeGreaterThan(10_000) // a real PDF, not an error page
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')

    const { data: row } = await admin
      .from('printed_documents')
      .select('content_hash, verification_token, contains_phi')
      .eq('id', doc.id)
      .single()
    expect(row).toBeTruthy()
    expect(sha256(bytes)).toBe(row!.content_hash)
    expect(row!.contains_phi).toBe(false)

    // ── Verification lookup (real limiter → real service-role RPC) ──────────
    const verification = await lookupPrintedDocumentVerification({
      token: row!.verification_token,
    })
    expect(verification).toEqual({
      status: 'active',
      mintedAt: expect.any(String),
      sourceKind: 'form_response',
      hospitalName: expect.any(String),
      // chefe.ccih is source-visible → the registry id comes back (D10).
      documentId: doc.id,
    })
  })
})
