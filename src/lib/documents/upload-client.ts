import type { DocumentUploadCredential } from '@/lib/documents/types'

/**
 * Client-safe upload helper (contract amendment 5) — the ONE way Wave-A
 * islands move bytes to a reservation. Pure fetch; no Supabase browser client.
 *
 * Failure semantics: any non-200 (or a thrown network error, surfaced as
 * `{ ok: false, status: 0 }`) leaves NO object behind the reservation —
 * Storage only materializes complete uploads — so `finalizeDocumentUpload`
 * reports `upload_incomplete` and the PUT may be retried until the
 * reservation expires.
 */
export async function uploadDocumentFile(
  credential: DocumentUploadCredential,
  file: File | Blob,
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(credential.url, {
      method: credential.method,
      headers: {
        ...credential.headers,
        'Content-Type':
          file instanceof File && file.type ? file.type : 'application/octet-stream',
      },
      body: file,
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}
