import {
  buildFormResponsePayload,
  type MintRenderContext,
} from '@/lib/forms/pdf-payload'
import { TEMPLATES } from '@/lib/pdf/render'
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
export interface PdfDataProvider {
  templateKey: string
  templateVersion: number
  /** false for every P1/P2 kind; the PHI delta lands in P3 (cases). */
  phiCapable: boolean
  build(sourceId: string, ctx: MintRenderContext): Promise<DocumentPayload>
}

export const PDF_PROVIDERS: Partial<
  Record<PrintedDocumentSourceKind, PdfDataProvider>
> = {
  form_response: {
    templateKey: TEMPLATES.form_response.key,
    templateVersion: TEMPLATES.form_response.version,
    phiCapable: false,
    build: buildFormResponsePayload,
  },
}
