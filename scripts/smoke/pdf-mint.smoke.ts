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
import {
  printedRenditionStorageBucket,
  printedRenditionStoragePath,
} from '@/lib/pdf-mint/storage-coordinates'
import { lookupPrintedDocumentVerification } from '@/lib/queries/printed-documents'
import { createAdminClient } from '@/lib/supabase/admin'

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

/** Every print minted by this file, so cleanup can remove exactly what it made.
 *  IDS ONLY -- never coordinates. The coordinate is resolved from the substrate at
 *  cleanup time (see `resolvePrintCoordinate`), so this file holds no second copy
 *  of a path that could go stale the next time the coordinate moves. */
const mintedPrintIds: string[] = []
let smokeMeetingId: string | null = null

/**
 * Where a print's bytes actually are, ASKED OF THE SUBSTRATE (the ADR 0120 D11
 * chain: printed_documents -> document_version_id -> the `printed_pdf` binding ->
 * file_objects). Never a restated literal, never a re-derivation.
 *
 * This exists because of a real defect in this file. FOUR sites read or removed a
 * print's coordinate; DM5 S3 moved it, and only the site being edited was updated
 * -- the enumeration was bounded by the TEST rather than by the PROPERTY, which is
 * "reads or removes a print's storage coordinate". Same class as the `.find(` vs
 * `.eq(` fifth site, now inside a single file. Resolving instead of restating makes
 * the class unrepresentable: there is one place to change, and it is the one place
 * that asks.
 */
async function resolvePrintCoordinate(
  admin: ReturnType<typeof createAdminClient>,
  printedDocumentId: string,
): Promise<{ bucket: string; path: string } | null> {
  const { data: pd } = await admin
    .from('printed_documents')
    .select('document_version_id')
    .eq('id', printedDocumentId)
    .maybeSingle<{ document_version_id: string }>()
  if (!pd) return null
  const { data: binding } = await admin
    .from('document_version_files')
    .select('file_objects ( storage_bucket, storage_path )')
    .eq('document_version_id', pd.document_version_id)
    .eq('rendition_kind', 'printed_pdf')
    .maybeSingle<{
      file_objects: { storage_bucket: string; storage_path: string } | null
    }>()
  const f = binding?.file_objects
  return f ? { bucket: f.storage_bucket, path: f.storage_path } : null
}

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
  const admin = createAdminClient()
  // THE OLD CLEANUP REMOVED FROM `printed-documents`, WHICH DM5 S3 EMPTIES -- so it
  // deleted nothing while the mint wrote real bytes into `documents-phi` /
  // `documents-standard`. Every hand-run leaked orphaned PHI-TIER objects into the
  // new buckets: exactly the class FUP-DM5-STORAGE-ORPHANS tracks, and that ADR 0120
  // D17 orders deleted-by-manifest BEFORE any reset. A cleanup that silently no-ops
  // is worse than one that throws.
  //
  // AND THE REGISTRY ROW IS NOW DELIBERATELY LEFT BEHIND. Deleting it used to be
  // tidy; under ADR 0120 D13 it is harmful. A print's `documents` row is excluded
  // from the content projections *because* `printed_documents` references it (the
  // D18 anti-join), and its READ AUTHORITY is routed to `can_view_printed_document`
  // by that same relational fact (the M3 print arm). Delete the registry row and the
  // orphaned `documents` row starts appearing in the source's Documentos panel AND
  // falls back to the WIDER home-type arm. The rest of the chain cannot be deleted
  // either: `guard_document_version_immutable` refuses DELETE on document_versions
  // and document_version_files by design. So: remove the bytes (the actual harm),
  // leave the rows, and let `printed_documents_one_active` supersede on the next run.
  for (const id of mintedPrintIds) {
    const coord = await resolvePrintCoordinate(admin, id)
    if (coord) await admin.storage.from(coord.bucket).remove([coord.path])
  }
  if (smokeMeetingId) {
    await userClient.from('meetings').delete().eq('id', smokeMeetingId)
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
    mintedPrintIds.push(doc.id)
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
    // ⭐ THE SPANNING ASSERTION (DM5 S3). This is the one place in the repo
    // where the SQL-derived coordinate and the TS-derived coordinate are
    // compared IN ONE ASSERTION: `opened[0]` is what the SQL door resolved,
    // the right-hand side is what `src/lib/pdf-mint/storage-coordinates.ts`
    // derives for the same id. Two separate green tests about two separate
    // constants would have proven nothing about their equality.
    // ⚠ NOT GATE-RESIDENT: `grep -n smoke package.json` has no hits, so this
    // file runs only when invoked by hand. The load-bearing pins are the
    // production-path ones — `mint_printed_document`'s HC0D3 (which fires iff
    // the two derivations disagree) and `trg_guard_printed_document_binding`.
    // This is corroboration, and it is labelled as such on purpose.
    expect(opened?.[0]?.storage_bucket).toBe(printedRenditionStorageBucket(false))
    expect(opened?.[0]?.storage_path).toBe(printedRenditionStoragePath(doc.id))

    // ── Bytes: canonical download hash-matches the registry pin ─────────────
    const admin = createAdminClient()
    const { data: blob, error: dlError } = await admin.storage
      .from(opened![0].storage_bucket)
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

  it('PDF·P2: mints a meeting ATA end-to-end (real provider → Gotenberg → doors → hash → lookup)', async () => {
    // chefe.ccih is staff_admin of CCIH — create a real meeting via the RPC.
    const { data: membership } = await userClient
      .from('memberships')
      .select('commission_id')
      .eq('role', 'staff_admin')
      .not('commission_id', 'is', null)
      .limit(1)
    const commissionId = membership?.[0]?.commission_id
    expect(commissionId, 'chefe.ccih staff_admin membership').toBeTruthy()

    const { data: meeting, error: createError } = await userClient.rpc(
      'create_meeting',
      {
        p_commission_id: commissionId!,
        p_title: 'Reunião smoke PDF·P2',
      },
    )
    expect(createError).toBeNull()
    const meetingId = (meeting as unknown as { id: string }).id
    smokeMeetingId = meetingId

    // ── The REAL mint pipeline through the meeting kind ─────────────────────
    const mint = await mintPrintedDocument({
      sourceKind: 'meeting',
      sourceId: meetingId,
    })
    expect(mint.error).toBeUndefined()
    expect(mint.ok).toBe(true)
    const doc = mint.document!
    mintedPrintIds.push(doc.id)
    expect(doc.sourceKind).toBe('meeting')
    expect(doc.status).toBe('active')

    // ── Bytes hash-match the registry pin ───────────────────────────────────
    const admin = createAdminClient()
    // Coordinate RESOLVED from the substrate, not restated -- this was one of the
    // three sites the S3 coordinate move missed.
    const coord = await resolvePrintCoordinate(admin, doc.id)
    expect(coord).not.toBeNull()
    const { data: blob } = await admin.storage
      .from(coord!.bucket)
      .download(coord!.path)
    const bytes = new Uint8Array(await blob!.arrayBuffer())
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    const { data: row } = await admin
      .from('printed_documents')
      .select('content_hash, verification_token')
      .eq('id', doc.id)
      .single()
    expect(sha256(bytes)).toBe(row!.content_hash)

    // ── Lookup reports kind=meeting + the viewer id ─────────────────────────
    const verification = await lookupPrintedDocumentVerification({
      token: row!.verification_token,
    })
    expect(verification?.sourceKind).toBe('meeting')
    expect(verification?.status).toBe('active')
    expect(verification?.documentId).toBe(doc.id)
  })

  it('PDF·P2 fix wave (A7/A8): masked-content ata mints complete+PHI-labeled for the coordinator; a RESPONDENT can neither mint nor open', async () => {
    const admin = createAdminClient()
    // PromiseLike: supabase-js builders are thenables, not Promises.
    const cleanup: Array<() => PromiseLike<unknown>> = []
    try {
      // ── Coordinator half: a case-linked, gated-text agenda item ───────────
      const { data: cases } = await userClient
        .from('cases')
        .select('id, commission_id')
        .limit(1)
      const caseId = cases?.[0]?.id
      const commissionId = cases?.[0]?.commission_id
      expect(caseId, 'a seeded case chefe.ccih can read').toBeTruthy()

      const { data: meeting, error: createError } = await userClient.rpc(
        'create_meeting',
        { p_commission_id: commissionId!, p_title: 'Ata sigilosa smoke A7/A8' },
      )
      expect(createError).toBeNull()
      const meetingId = (meeting as unknown as { id: string }).id
      cleanup.push(() => userClient.from('meetings').delete().eq('id', meetingId))

      const { data: agendaItemId, error: agendaError } = await userClient.rpc(
        'create_meeting_agenda_item',
        {
          p_meeting_id: meetingId,
          p_title: 'Processo em deliberação',
          p_description: 'Substância deliberativa presente.',
        },
      )
      expect(agendaError).toBeNull()
      const { error: linkError } = await userClient.rpc('link_meeting_case', {
        p_meeting_id: meetingId,
        p_case_id: caseId!,
        p_agenda_item_id: agendaItemId as unknown as string,
      })
      expect(linkError).toBeNull()

      const mint = await mintPrintedDocument({
        sourceKind: 'meeting',
        sourceId: meetingId,
      })
      expect(mint.error).toBeUndefined()
      const doc = mint.document!
      // PHI-TIER BYTES: resolve, then remove. Same reasoning as afterAll -- the old
      // form removed `printed-documents/phi/<id>.pdf`, which no longer exists, so it
      // leaked a PHI-tier object on every run. The registry row is left behind
      // deliberately (deleting it orphans the print's documents row into the content
      // projections and widens its read authority -- see afterAll).
      cleanup.push(async () => {
        const c = await resolvePrintCoordinate(admin, doc.id)
        if (c) await admin.storage.from(c.bucket).remove([c.path])
      })
      // A8: presence-derived PHI label + phi/ bifurcation, bytes hash-faithful.
      expect(doc.containsPhi).toBe(true)
      // Resolved from the substrate AND cross-checked against the TS derivation --
      // the PHI-arm twin of the spanning assertion in the first test.
      const phiCoord = await resolvePrintCoordinate(admin, doc.id)
      expect(phiCoord?.bucket).toBe(printedRenditionStorageBucket(true))
      expect(phiCoord?.path).toBe(printedRenditionStoragePath(doc.id))
      const { data: blob, error: dlError } = await admin.storage
        .from(phiCoord!.bucket)
        .download(phiCoord!.path)
      expect(dlError).toBeNull()
      const bytes = new Uint8Array(await blob!.arrayBuffer())
      expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
      const { data: row } = await admin
        .from('printed_documents')
        .select('content_hash, contains_phi, document_id, document_version_id')
        .eq('id', doc.id)
        .single()
      expect(row!.contains_phi).toBe(true)
      // D7: `storage_path` is retired from the registry row; the coordinate is
      // reached through the D11 chain, which these two columns anchor.
      expect(row!.document_id).toBeTruthy()
      expect(row!.document_version_id).toBeTruthy()
      expect(sha256(bytes)).toBe(row!.content_hash)

      // ── Respondent half (A7): staff1.ccih becomes the case's respondent ───
      const { data: comm } = await admin
        .from('commissions')
        .select('organization_id')
        .eq('id', commissionId!)
        .single()
      const orgId = comm!.organization_id
      const staff1 = createSupabaseJsClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
      const { data: signIn, error: signInError } =
        await staff1.auth.signInWithPassword({
          email: 'staff1.ccih@test.local',
          password: 'Test1234!',
        })
      expect(signInError).toBeNull()
      const staff1Uid = signIn!.user!.id
      cleanup.push(() => staff1.auth.signOut())

      const { data: roleRows } = await admin
        .from('case_participant_roles')
        .select('id')
        .eq('key', 'respondent_doctor')
        .eq('organization_id', orgId)
        .limit(1)
      let roleId = roleRows?.[0]?.id
      if (!roleId) {
        const { data: newRole } = await admin
          .from('case_participant_roles')
          .insert({
            organization_id: orgId,
            key: 'respondent_doctor',
            display_name: 'Médico respondente',
            allowed_participant_types: ['professional'],
          })
          .select('id')
          .single()
        roleId = newRole!.id
        cleanup.push(() =>
          admin.from('case_participant_roles').delete().eq('id', roleId!),
        )
      }
      const { data: participant } = await admin
        .from('participants')
        .insert({
          organization_id: orgId,
          participant_type: 'professional',
          sensitivity_class: 'professional_identity',
          display_name: 'Dr. Smoke Respondente',
        })
        .select('id')
        .single()
      cleanup.push(() =>
        admin.from('participants').delete().eq('id', participant!.id),
      )
      const { data: profile } = await admin
        .from('professional_profiles')
        .insert({
          organization_id: orgId,
          user_id: staff1Uid,
          full_name: 'Dr. Smoke Respondente',
        })
        .select('id')
        .single()
      cleanup.push(() =>
        admin.from('professional_profiles').delete().eq('id', profile!.id),
      )
      await admin.from('professional_participants').insert({
        participant_id: participant!.id,
        professional_profile_id: profile!.id,
      })
      const { data: cp, error: cpError } = await admin
        .from('case_participants')
        .insert({
          case_id: caseId!,
          participant_id: participant!.id,
          role_id: roleId!,
        })
        .select('id')
        .single()
      expect(cpError).toBeNull()
      cleanup.push(() =>
        admin.from('case_participants').delete().eq('id', cp!.id),
      )

      // Swap the mocked cookie client to the respondent and probe A7.
      const coordinator = userClient
      userClient = staff1
      try {
        const denied = await mintPrintedDocument({
          sourceKind: 'meeting',
          sourceId: meetingId,
        })
        expect(denied.ok).toBe(false)
        expect(denied.error).toContain('sem autorização') // the door's 42501 pt-BR
      } finally {
        userClient = coordinator
      }
      const { data: opened } = await staff1.rpc('open_printed_document', {
        p_id: doc.id,
      })
      expect(opened ?? []).toHaveLength(0) // A7 download side: no row for the respondent
    } finally {
      for (const fn of cleanup.reverse()) {
        try {
          await fn()
        } catch {
          /* best-effort cleanup */
        }
      }
    }
  })
})
