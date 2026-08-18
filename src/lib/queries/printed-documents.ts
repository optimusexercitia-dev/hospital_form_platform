import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  PrintedDocumentSourceKind,
  PrintedDocumentStatus,
} from '@/lib/pdf/types'

/**
 * Printed-documents READ data-access (PDF·P1; ADR 0104; Architecture Rule 9 —
 * all reads through `src/lib/queries/`).
 *
 * Access model (ADR 0104 D3/D11): `printed_documents` rows are RLS-scoped
 * through the per-kind dispatch door `app.can_view_printed_document` — the
 * module never grants sight of anything; a caller who cannot view the SOURCE
 * artifact gets `[]`, evaluated at read time. Downloads NEVER surface a
 * Storage URL (D8): the only byte path is `/api/documents/[id]`.
 */

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

/** One registry row as listed on a source artifact's "Documentos emitidos" panel.
 * Zero PHI by construction (D3): pointers + metadata only, no titles, no free text. */
export interface PrintedDocumentSummary {
  id: string
  sourceKind: PrintedDocumentSourceKind
  sourceId: string
  templateKey: string
  templateVersion: number
  status: PrintedDocumentStatus
  containsPhi: boolean
  /** ISO-8601 mint timestamp. */
  mintedAt: string
  /** Minter display name (resolved from the profile; pt-BR fallback when the
   * viewer's RLS cannot see that profile). */
  mintedByDisplay: string
  /** Human-typable verification fallback code (printed beside the QR). */
  verificationShortCode: string
  /** Set only when `status = 'revoked'`. */
  revokedAt: string | null
  /** Constrained reason class (never free text here). */
  revokedReasonClass: string | null
  /** The ONLY sanctioned byte path: the serving route (D8). Never a Storage URL. */
  downloadPath: string
  /**
   * ADR 0126 D2/D3/D4 — is this print of the CURRENT REVISION of its source?
   *
   * Derived at read time and NEVER stamped: `status` records deliberate acts only
   * (re-mint supersession, revocation), so a print may legally be
   * `status = 'active'` AND NOT current — the new combination the panel must express.
   *
   * ⛔ `null` means NOT EVALUATED, and it arises for exactly one reason:
   * `status = 'revoked'`. That is a different fact from `false` (evaluated, and
   * stale) — collapsing them would tell a paper-holder a revoked page is "not
   * current" when the honest answer is ANULADO. ⛔ Never coerce `null` to `false`.
   *
   * ⚠ The BOUND: this answers "current REVISION", not "a re-render would be
   * byte-identical". For meetings the two differ by construction.
   */
  isCurrent: boolean | null
}

/**
 * The deliberately anemic public verification answer (ADR 0104 D10): authentic
 * yes/no · status · mint date · document kind · hospital name. NEVER patient
 * anything, case numbers, actor names, or bytes.
 */
export interface PrintedDocumentVerification {
  status: PrintedDocumentStatus
  /** ISO-8601 mint timestamp. */
  mintedAt: string
  sourceKind: PrintedDocumentSourceKind
  hospitalName: string
  /** Registry id — non-null ONLY when the caller is authenticated AND passes the
   * source-visibility door (server-enforced in the lookup RPC via `p_viewer`).
   * Anonymous callers ALWAYS receive null (D10: no anonymous download, no oracle).
   * Feeds the logged-in-viewer link to `/api/documents/<id>`. */
  documentId: string | null
  /**
   * ADR 0126 D2/D4/D12 — the currency verdict on the ANONYMOUS verification page.
   * PO-blessed: currency is the page's product purpose, it names no content,
   * actor or reason, and refusing it to anonymous callers would blind exactly the
   * paper-holding surveyor it exists for.
   *
   * ⛔ `null` means NOT EVALUATED, arising ONLY for `status = 'revoked'` — where
   * the door deliberately performs NO source join at all (`312` t76), which is
   * what lets a paper-holder verify a document whose source was later discarded.
   * `null` is NOT "stale": an `active` print with `null` here is a contract
   * violation, not a currency answer. ⛔ Never coerce `null` to `false`.
   *
   * ⚠ The BOUND: "current REVISION", never "byte-identical re-render".
   */
  isCurrent: boolean | null
}

/** Lookup key for a verification: the QR token or the typed short code. */
export type VerificationLookupKey =
  | { token: string }
  | { shortCode: string }

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

interface PrintedDocumentRow {
  id: string
  source_kind: string
  source_id: string
  template_key: string
  template_version: number
  status: string
  contains_phi: boolean
  minted_at: string
  verification_short_code: string
  revoked_at: string | null
  revoked_reason_class: string | null
  /** FK-HINTED embed (two FKs to profiles exist: minted_by + revoked_by — an
   * un-hinted embed answers PGRST201). Null when the viewer's profiles RLS
   * cannot see the minter. */
  minter: { full_name: string | null } | null
}

/**
 * List every printed document minted from one source artifact, newest first,
 * under the caller's session (RLS delegates to source visibility — D11).
 * Callers who cannot view the source receive `[]`.
 */
export async function listPrintedDocuments(
  sourceKind: PrintedDocumentSourceKind,
  sourceId: string,
): Promise<PrintedDocumentSummary[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('printed_documents')
    .select(
      'id, source_kind, source_id, template_key, template_version, status, ' +
        'contains_phi, minted_at, verification_short_code, revoked_at, ' +
        'revoked_reason_class, ' +
        'minter:profiles!printed_documents_minted_by_fkey(full_name)',
    )
    .eq('source_kind', sourceKind)
    .eq('source_id', sourceId)
    .order('minted_at', { ascending: false })
    .returns<PrintedDocumentRow[]>()

  const rows = data ?? []

  // ADR 0126 D2/D3 — currency is DERIVED AT READ TIME and never stamped, so it
  // cannot come from the row above. One BATCH call rather than N: the door
  // re-gates per row on `can_view_printed_document`, and an id the caller cannot
  // see is simply ABSENT from the result rather than null — absent and
  // not-evaluated are different answers and must not be conflated.
  const currency = new Map<string, boolean | null>()
  if (rows.length > 0) {
    const { data: cur } = await supabase.rpc('printed_document_currency', {
      p_ids: rows.map((r) => r.id),
    })
    for (const c of (cur ?? []) as { id: string; is_current: boolean | null }[]) {
      currency.set(c.id, c.is_current)
    }
  }

  return rows.map((row) => ({
    id: row.id,
    sourceKind: row.source_kind as PrintedDocumentSourceKind,
    sourceId: row.source_id,
    templateKey: row.template_key,
    templateVersion: row.template_version,
    status: row.status as PrintedDocumentStatus,
    containsPhi: row.contains_phi,
    mintedAt: row.minted_at,
    mintedByDisplay: row.minter?.full_name ?? 'Membro da comissão',
    verificationShortCode: row.verification_short_code,
    revokedAt: row.revoked_at,
    revokedReasonClass: row.revoked_reason_class,
    downloadPath: `/api/documents/${row.id}`,
    // ⛔ `?? null` is the ABSENT case (the door did not return this id), which is
    // the same answer as not-evaluated: unknown. It is NOT coerced to `false`.
    isCurrent: currency.get(row.id) ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Verification lookup (public /verificar surface — D10)
// ---------------------------------------------------------------------------

/**
 * App-layer rate limit fronting EVERY call path to the lookup RPC (lead
 * requirement 4b): the RPC's EXECUTE is service_role-only, this module is the
 * RPC's only caller, and this limiter guards this function — the chain is
 * closed by construction. In-memory sliding windows: per credential (blunt
 * brute-force of one code) and global per process (scrape).
 * `verification_lookups` in the DB is the durable record, not the limiter.
 *
 * ⚠ KNOWN LIMIT — the global arm is an AVAILABILITY LEVER, still open
 * (FUP-PDF-4). Both windows live in module-level process memory, so:
 *  - they are per-PROCESS, not shared: N app instances mean N× every budget;
 *  - the 60/min global cap is exhaustible by ONE visitor using many distinct
 *    credentials (12 codes × 5 each), which then throttles EVERY anonymous
 *    visitor on the public `/verificar` surface until the window slides.
 * The per-credential arm does not address this — it bounds brute-forcing one
 * code, a different attack. Closing it needs per-CLIENT granularity, which
 * needs a trusted client identity (`x-forwarded-for` is only as trustworthy as
 * the proxy in front of it — a Coolify deploy decision, ADR 0059) plus shared
 * cross-process state. That is a deliberate open item, not an oversight: both
 * halves are decisions, and neither is guessable from here.
 */
const WINDOW_MS = 60_000
const PER_CREDENTIAL_LIMIT = 5
const GLOBAL_LIMIT = 60
const perCredentialHits = new Map<string, number[]>()
let globalHits: number[] = []

/**
 * pt-BR message thrown when the limiter refuses.
 *
 * ⚠ It is NOT rendered. The comment here used to claim "the page shows it
 * verbatim" (QA P1 MINOR-3, corrected 2026-08-10): `/verificar/[token]/page.tsx`
 * wraps the lookup in a `catch` that logs and returns `{ state: "unavailable" }`,
 * so a throttled visitor sees the generic unavailable state and this string
 * reaches only the server log. Left in place deliberately — it is the thrown
 * Error's identity, asserted by `printed-documents.test.ts` — but do not treat it
 * as user-facing copy until a caller actually surfaces it.
 */
export const VERIFICATION_RATE_LIMIT_MESSAGE =
  'Muitas consultas de verificação. Aguarde um minuto e tente novamente.'

function consumeLookupBudget(credential: string): void {
  const now = Date.now()
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS)
  const own = (perCredentialHits.get(credential) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  )
  if (globalHits.length >= GLOBAL_LIMIT || own.length >= PER_CREDENTIAL_LIMIT) {
    throw new Error(VERIFICATION_RATE_LIMIT_MESSAGE)
  }
  globalHits.push(now)
  own.push(now)
  perCredentialHits.set(credential, own)
}

/** Test hook: reset the in-memory limiter windows. */
export function __resetVerificationLookupRateLimit(): void {
  perCredentialHits.clear()
  globalHits = []
}

interface LookupRpcRow {
  matched: boolean
  status: string | null
  minted_at: string | null
  source_kind: string | null
  hospital_name: string | null
  document_id: string | null
  /** ADR 0126 D12. null = NOT EVALUATED, which the door returns only for `revoked`. */
  is_current: boolean | null
}

/**
 * Resolve a verification token or short code to the anemic public tuple (D10),
 * or `null` when nothing matches (the page renders "documento não
 * reconhecido" — indistinguishable from never-existed, deliberately).
 *
 * SERVER-ONLY path: the `/verificar` pages call this from the server. The RPC
 * is service_role-only (an anon-executable PostgREST RPC would bypass this
 * limiter), so it goes through the admin client — AFTER the rate limit. When a
 * verified session exists, its uid is passed as `p_viewer` so the RPC can
 * return the registry id to a source-visible viewer (never to anonymous).
 * Throws {@link VERIFICATION_RATE_LIMIT_MESSAGE} when the limiter refuses.
 */
export async function lookupPrintedDocumentVerification(
  key: VerificationLookupKey,
): Promise<PrintedDocumentVerification | null> {
  const credential = ('token' in key ? key.token : key.shortCode).trim()
  if (credential === '' || credential.length > 200) return null
  consumeLookupBudget(credential)

  // Server-verified session, if any (local JWT verification — the ADR 0009
  // idiom). The uid is passed EXPLICITLY: a service-role call carries no
  // auth.uid(), and this is the RPC's one caller, so the declared param is
  // exercised on every authenticated page view (the declared-param rule;
  // pinned by printed-documents.test.ts).
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const viewerId = (claimsData?.claims?.sub as string | undefined) ?? null

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('lookup_printed_document', {
    p_credential: credential,
    ...(viewerId ? { p_viewer: viewerId } : {}),
  })
  if (error) return null

  const row = (data as LookupRpcRow[] | null)?.[0]
  if (!row || !row.matched) return null

  return {
    status: row.status as PrintedDocumentStatus,
    mintedAt: row.minted_at as string,
    sourceKind: row.source_kind as PrintedDocumentSourceKind,
    hospitalName: row.hospital_name ?? '—',
    documentId: row.document_id,
    // ADR 0126 D4 — stated as its OWN fact, never inferred from `status`.
    // null ONLY for `revoked` (the no-join arm); never coerced to false.
    isCurrent: row.is_current ?? null,
  }
}

// ---------------------------------------------------------------------------
// Provider/mint support reads (Rule 9 — the pdf-payload provider and the mint
// action read through HERE, never inline)
// ---------------------------------------------------------------------------

/** Supplemental print context of a response: the fields `getResponseForFill`
 * does not carry, needed by the letterhead + emission + status line. */
export interface ResponsePrintContext {
  submittedAt: string | null
  respondentDisplay: string
  commissionName: string
  hospitalName: string
  /**
   * ADR 0126 D10 — an open, still-rejectable correction request exists whose
   * `draft_response_id` is this response (`case_correction_requests.status in
   * ('resubmitted','under_review')`, the exact set `reject_correction` accepts).
   */
  correctionOpen: boolean
  /** ADR 0126 D10 — the attached `case_phase` has status `voided`. */
  phaseVoided: boolean
}

interface PrintContextRow {
  submitted_at: string | null
  commission_id: string
  respondent: { full_name: string | null } | null
}

/**
 * Letterhead/meta context for a response the CALLER can already read.
 *
 * Two-step by necessity, not convenience: `hospitals_select` carries NO
 * member arm (catalog-verified 2026-08-07 — org/hospital-admin, NSP and
 * quality tiers only), and a TARGETED respondent may not even be a commission
 * member, so an RLS `!inner` embed on commissions/hospitals empties the row
 * for exactly the people D11 entitles to mint. Step 1 proves source
 * visibility under the caller's OWN RLS on `responses` (the authority);
 * step 2 then resolves the two DISPLAY NAMES via the service role —
 * a caller-pre-authorized read of letterhead labels only (the ADR 0075
 * pre-authorized-service-role shape, read-side; nothing else crosses).
 */
export async function getResponsePrintContext(
  responseId: string,
): Promise<ResponsePrintContext | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('responses')
    .select(
      'submitted_at, commission_id, ' +
        'respondent:profiles!responses_created_by_fkey(full_name)',
    )
    .eq('id', responseId)
    .maybeSingle<PrintContextRow>()
  if (!data) return null // not source-visible → the mint fails closed upstream

  // ADR 0125 Amendment 2 + ADR 0126 D5/D10 — the two refinement conjuncts the
  // watermark and the registration predicate both read.
  //
  // ⭐ SOURCED FROM THE DEFINER DOOR, NOT FROM AN INLINE JOIN, AND THE DIRECTION
  // IS THE REASON. Read under the caller's own RLS, a correction request or a
  // voided phase the caller cannot SEE would come back absent — so the flags
  // would default false, the page would stamp FINAL, and the failure would be in
  // the FAIL-OPEN direction: exactly 0125 D5's fourth cell, reached by a
  // permissions accident rather than a logic error. `public.print_source_state`
  // resolves them with DEFINER truth *after* gating on
  // `app.can_view_printed_document`, so the answer is either correct or absent.
  const { data: derivation } = await supabase
    .rpc('print_source_state', {
      p_source_kind: 'form_response',
      p_source_id: responseId,
    })
    .maybeSingle<{ correction_open: boolean; phase_voided: boolean }>()
  // Absent ⇒ the door refused. Fail closed, exactly as the RLS miss above does:
  // the mint and the prévia both fail closed upstream on a null context.
  if (!derivation) return null

  const admin = createAdminClient()
  const { data: names } = await admin
    .from('commissions')
    // hospitals is FK-HINTED: commissions carries TWO FKs to hospitals (plain
    // + the composite tenant FK) — un-hinted answers PGRST201.
    .select('name, hospitals!commissions_hospital_id_fkey(name)')
    .eq('id', data.commission_id)
    .maybeSingle<{ name: string; hospitals: { name: string } | null }>()

  return {
    submittedAt: data.submitted_at,
    respondentDisplay: data.respondent?.full_name ?? 'Membro da comissão',
    commissionName: names?.name ?? '—',
    hospitalName: names?.hospitals?.name ?? '—',
    correctionOpen: derivation.correction_open,
    phaseVoided: derivation.phase_voided,
  }
}

/** Letterhead context of a meeting the CALLER can already reach. Same two-step
 * shape (and rationale) as {@link getResponsePrintContext}: step 1 proves
 * visibility under the caller's OWN RLS on `meetings` (the authority — routes
 * `can_reach_meeting`); step 2 resolves the two DISPLAY NAMES via the service
 * role (`hospitals_select` still has no member arm — nothing else crosses). */
export async function getMeetingPrintContext(
  meetingId: string,
): Promise<{ commissionName: string; hospitalName: string } | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('meetings')
    .select('id, commission_id')
    .eq('id', meetingId)
    .maybeSingle<{ id: string; commission_id: string }>()
  if (!data) return null // not reachable → the mint fails closed upstream

  const admin = createAdminClient()
  const { data: names } = await admin
    .from('commissions')
    // hospitals FK-HINTED (two FKs exist — un-hinted answers PGRST201).
    .select('name, hospitals!commissions_hospital_id_fkey(name)')
    .eq('id', data.commission_id)
    .maybeSingle<{ name: string; hospitals: { name: string } | null }>()

  return {
    commissionName: names?.name ?? '—',
    hospitalName: names?.hospitals?.name ?? '—',
  }
}

/** The current session's display name (emission line). Self-read via RLS. */
export async function getViewerDisplayName(): Promise<string> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const uid = (claimsData?.claims?.sub as string | undefined) ?? null
  if (!uid) return 'Usuário da plataforma'
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', uid)
    .maybeSingle<{ full_name: string | null }>()
  return data?.full_name ?? 'Usuário da plataforma'
}
