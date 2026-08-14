import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * QA r1 MAJOR-3 pins — `finalizeDocumentUpload`'s failure contract.
 *
 * The defect: after a byte-verification failure the file is `failed` — a
 * state the D9 machine has NO outbound arc from (catalog:
 * `app.guard_file_object_transition` — `failed` appears only as a target),
 * over bytes that are immutable (Rule 6, `x-upsert: 'false'`). Retrying
 * finalize therefore CANNOT succeed; pre-fix, every retry click re-entered
 * the verify branch anyway — a service-role download of the WHOLE object,
 * unaudited, ending in HC0D9 → the same "tente novamente" banner, forever.
 *
 * T1 is THE keystone: on the idempotent `failed` return the action must
 * short-circuit — no storage download, no verification RPC, a terminal
 * error. T2 pins that the FIRST failure is already terminal. T3 is the
 * non-over-terminal twin (a PUT that left no object stays retryable —
 * ADR 0118 §8, 329 U11/U12's layer). T4 guards the `verifying` re-entry
 * (the stuck-verification recovery) from being eaten by the short-circuit.
 *
 * RED-FIRST: T1/T2 authored and observed red against the pre-fix action
 * (T1: download WAS called and `terminal` was undefined; T2: `terminal`
 * undefined) — output quoted in the DM2 phase record.
 */

const userRpcMock = vi.fn()
const adminRpcMock = vi.fn()
const downloadMock = vi.fn()
const singleMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc: userRpcMock }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: adminRpcMock,
    from: () => ({
      select: () => ({
        eq: () => ({ single: singleMock }),
      }),
    }),
    storage: { from: () => ({ download: downloadMock }) },
  }),
}))
vi.mock('@/lib/queries/feature-flags', () => ({
  featureEnabled: vi.fn(async () => true),
}))

import { finalizeDocumentUpload } from './actions'

const IDS = {
  document_id: 'doc-1',
  document_version_id: 'ver-1',
  file_object_id: 'file-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  singleMock.mockResolvedValue({
    data: { storage_bucket: 'documents-phi', storage_path: 'org/file-1/1' },
    error: null,
  })
  downloadMock.mockResolvedValue({
    data: { arrayBuffer: async () => new ArrayBuffer(8) },
    error: null,
  })
})

describe('finalizeDocumentUpload — MAJOR-3 terminal-failure contract', () => {
  it('T1 KEYSTONE: an already-failed file short-circuits — no download, no verify RPC, terminal error', async () => {
    userRpcMock.mockResolvedValue({
      data: { ...IDS, upload_state: 'failed' },
      error: null,
    })

    const result = await finalizeDocumentUpload('sess-1')

    expect(result).toEqual({ ok: false, error: 'upload_incomplete', terminal: true })
    // The MAJOR-3 loop's sharp half: the retry click must NOT re-drive a
    // service-role download of the whole object.
    expect(downloadMock).not.toHaveBeenCalled()
    expect(adminRpcMock).not.toHaveBeenCalled()
  })

  it('T2 the FIRST verification failure is already terminal', async () => {
    userRpcMock.mockResolvedValue({
      data: { ...IDS, upload_state: 'verifying' },
      error: null,
    })
    adminRpcMock.mockResolvedValue({
      data: { ...IDS, upload_state: 'failed' },
      error: null,
    })

    const result = await finalizeDocumentUpload('sess-1')

    expect(result).toEqual({ ok: false, error: 'upload_incomplete', terminal: true })
  })

  it('T3 TWIN: a PUT that left no object stays retryable — NOT terminal', async () => {
    // The door refuses finalize with HC0D9 when no object landed (ADR 0118
    // §8): the reservation is still usable, so the failure must carry no
    // terminal marker.
    userRpcMock.mockResolvedValue({ data: null, error: { code: 'HC0D9' } })

    const result = await finalizeDocumentUpload('sess-1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('upload_incomplete')
      expect(result.terminal).toBeUndefined()
    }
    expect(downloadMock).not.toHaveBeenCalled()
  })

  it('T4 the `verifying` re-entry (stuck-verification recovery) still verifies and succeeds', async () => {
    userRpcMock.mockResolvedValue({
      data: { ...IDS, upload_state: 'verifying' },
      error: null,
    })
    adminRpcMock.mockResolvedValue({
      data: { ...IDS, upload_state: 'unscanned_accepted' },
      error: null,
    })

    const result = await finalizeDocumentUpload('sess-1')

    expect(result).toEqual({
      ok: true,
      documentId: 'doc-1',
      documentVersionId: 'ver-1',
      availability: 'available',
    })
    expect(downloadMock).toHaveBeenCalledTimes(1)
    expect(adminRpcMock).toHaveBeenCalledWith(
      'complete_document_upload_verification',
      expect.objectContaining({ p_verified: true }),
    )
  })
})
