import { buildCasePayload } from '@/lib/cases/pdf-payload'
import { buildFormResponsePayload } from '@/lib/forms/pdf-payload'
import { buildMeetingPayload } from '@/lib/meetings/pdf-payload'
import type { MintRenderContext } from '@/lib/pdf/provenance'
import type { DocumentPayload, PrintedDocumentSourceKind } from '@/lib/pdf/types'

/**
 * The per-kind data-provider registry (ADR 0104 D15: kinds ACTIVATE by
 * registering a provider here — no flag proliferation). The TS mirror of the
 * SQL dispatch's fail-closed ELSE: an unregistered kind has no provider and
 * the mint fails with a clear error before touching anything.
 *
 * P2–P4 each add one entry (meeting → case → interview). `phiCapable` is the
 * D9 v2-readiness seam: the mint dialog renders the PHI choice only for kinds
 * whose provider declares it (never hardcoded in UI), and the action refuses
 * `includePhi` for kinds that don't.
 */

/**
 * Per-mint build options (ADR 0104 D9 / ADR 0144 D5).
 *
 * ⚠ Optional on {@link PdfDataProvider.build} so the P1/P2 two-argument
 * providers satisfy the interface STRUCTURALLY, without being rewritten to
 * accept a parameter they ignore.
 */
export interface PdfBuildOptions {
  /**
   * The D9 per-mint patient-identifier choice: explicit, default OFF, no memory.
   * ⛔ NOT the same thing as `DocumentPayload.containsPhi`, which for the case
   * kind is CONSTITUTIVE and non-suppressible — `!caseDisposed`, ADR 0144
   * Amendment 5 — and so is TRUE for both case variants of any live case.
   * ⚠ It said "presence-derived (A8 / D6)" until 2026-08-25; that rule shipped
   * finding C-1, an Art. 18 hole, and A8's presence derivation now governs
   * MEETINGS only. The distinction this comment draws is unchanged and is the
   * point: `includePhi` chooses structured identifiers, never the band.
   */
  includePhi: boolean
}

/**
 * ⛔ **NO `templateKey` / `templateVersion` FIELDS, AND THAT IS THE DESIGN.**
 * They used to live here as static strings. `case` broke that — it has TWO keys
 * (`case` / `case_identified`, ADR 0144 D7 as amended) selected per mint — and
 * the obvious repair, a `templateKeyFor(options)` method, was REJECTED: it would
 * compute the key from the same `{ includePhi }` request that drives `build()`,
 * giving one fact two authorities that agree only by care.
 *
 * ⚠ That is not theoretical. `public.get_case_patients` answers `null`
 * (unentitled) and `[]` (entitled, none on file) as well as rows, so a `build`
 * called with `includePhi: true` can legitimately produce a payload containing
 * no identifiers — and a request-derived key would label those bytes
 * `case_identified`, minting them into the identified series and superseding a
 * real identified dossier.
 *
 * ⇒ The template identity is derived from the PAYLOAD instead, by
 * `templateFor(payload.body)` in `@/lib/pdf/render`, exactly as
 * `DocumentPayload.sourceRevision` is read from the payload rather than re-read
 * near the mint call, and for the same reason: a fact about the render must
 * reach the door FROM the render.
 */
export interface PdfDataProvider {
  /** false for every P1/P2 kind; the PHI delta lands in P3 (cases). */
  phiCapable: boolean
  build(
    sourceId: string,
    ctx: MintRenderContext,
    options?: PdfBuildOptions,
  ): Promise<DocumentPayload>
}

export const PDF_PROVIDERS: Partial<
  Record<PrintedDocumentSourceKind, PdfDataProvider>
> = {
  form_response: {
    phiCapable: false,
    build: buildFormResponsePayload,
  },
  meeting: {
    phiCapable: false, // meetings mint PHI-free only in v1 (ADR 0104 D9)
    build: buildMeetingPayload,
  },
  case: {
    // ⭐ THE FIRST PHI-CAPABLE KIND (ADR 0144 D5). This declaration is the ONLY
    // thing that makes the mint dialog offer the identified variant — ⛔ the UI
    // must never hardcode the kind (ADR 0104 D9's v2-readiness seam).
    phiCapable: true,
    build: buildCasePayload,
  },
}
