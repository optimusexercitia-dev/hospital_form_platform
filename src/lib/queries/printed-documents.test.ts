import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PDF·P1 lookup contract pins (lead requirement, deviation 4a/4b):
 *
 *  1. THE DECLARED-PARAM RULE: `p_viewer` is a param the RPC declares and only
 *     THIS module can pass (service_role-only EXECUTE). A declared param no
 *     caller passes is a guarded branch nobody reaches — these cases prove the
 *     page path (which calls this function) passes it whenever a verified
 *     session exists, and omits it when none does.
 *  2. THE RATE LIMIT fronts EVERY call path: the limiter refuses BEFORE the
 *     RPC fires (this function is the RPC's only caller, so guarding it guards
 *     the chain).
 */

const rpcMock = vi.fn()
const getClaimsMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}))

import {
  __resetVerificationLookupRateLimit,
  lookupPrintedDocumentVerification,
  VERIFICATION_RATE_LIMIT_MESSAGE,
} from './printed-documents'

const MATCHED_ROW = {
  matched: true,
  status: 'active',
  minted_at: '2026-08-07T12:00:00.000Z',
  source_kind: 'form_response',
  hospital_name: 'Hospital Central',
  document_id: null as string | null,
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetVerificationLookupRateLimit()
  rpcMock.mockResolvedValue({ data: [MATCHED_ROW], error: null })
  getClaimsMock.mockResolvedValue({ data: null })
})

describe('lookupPrintedDocumentVerification', () => {
  it('passes p_viewer when a verified session exists (the declared-param pin)', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: 'uid-viewer-1' } },
    })
    rpcMock.mockResolvedValue({
      data: [{ ...MATCHED_ROW, document_id: 'doc-1' }],
      error: null,
    })

    const result = await lookupPrintedDocumentVerification({
      token: 'SOMETOKENAAAABBBBCCCCDDDDEEEEFFFF',
    })

    expect(rpcMock).toHaveBeenCalledWith('lookup_printed_document', {
      p_credential: 'SOMETOKENAAAABBBBCCCCDDDDEEEEFFFF',
      p_viewer: 'uid-viewer-1',
    })
    expect(result?.documentId).toBe('doc-1')
  })

  it('omits p_viewer for an anonymous caller — the RPC then NEVER returns a registry id (D10)', async () => {
    const result = await lookupPrintedDocumentVerification({
      shortCode: 'ABCDEF2345',
    })

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const args = rpcMock.mock.calls[0][1] as Record<string, unknown>
    expect(args.p_credential).toBe('ABCDEF2345')
    expect('p_viewer' in args).toBe(false)
    expect(result?.status).toBe('active')
    expect(result?.documentId).toBeNull()
  })

  it('maps the anemic tuple and nothing else', async () => {
    const result = await lookupPrintedDocumentVerification({
      shortCode: 'ABCDEF2345',
    })
    expect(result).toEqual({
      status: 'active',
      mintedAt: '2026-08-07T12:00:00.000Z',
      sourceKind: 'form_response',
      hospitalName: 'Hospital Central',
      documentId: null,
    })
  })

  it('answers null for an unmatched credential (indistinguishable from never-existed)', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          matched: false,
          status: null,
          minted_at: null,
          source_kind: null,
          hospital_name: null,
          document_id: null,
        },
      ],
      error: null,
    })
    await expect(
      lookupPrintedDocumentVerification({ shortCode: 'ZZZZZZ9999' }),
    ).resolves.toBeNull()
  })

  it('rejects empty / oversized credentials without calling the RPC', async () => {
    await expect(
      lookupPrintedDocumentVerification({ shortCode: '   ' }),
    ).resolves.toBeNull()
    await expect(
      lookupPrintedDocumentVerification({ token: 'x'.repeat(300) }),
    ).resolves.toBeNull()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rate-limits per credential BEFORE the RPC fires (requirement 4b)', async () => {
    for (let i = 0; i < 5; i++) {
      await lookupPrintedDocumentVerification({ shortCode: 'ABCDEF2345' })
    }
    expect(rpcMock).toHaveBeenCalledTimes(5)
    await expect(
      lookupPrintedDocumentVerification({ shortCode: 'ABCDEF2345' }),
    ).rejects.toThrow(VERIFICATION_RATE_LIMIT_MESSAGE)
    expect(rpcMock).toHaveBeenCalledTimes(5) // the refused call never reached the RPC
  })
})
