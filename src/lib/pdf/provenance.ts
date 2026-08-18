import type {
  DocumentEmission,
  DocumentGeneration,
  DocumentProvenance,
  DocumentQr,
  WatermarkFlag,
} from './types'

/**
 * The seam between the ORCHESTRATION layer and the domain DATA PROVIDERS
 * (ADR 0125 D1/D4/D5).
 *
 * Neither side can build {@link DocumentProvenance} alone, and that split is the
 * design, not an accident:
 *
 *   - the ORCHESTRATOR (`src/lib/pdf-mint/`) knows the verification credentials
 *     and the actor — but not the source's lifecycle state;
 *   - the PROVIDER (`src/lib/<domain>/pdf-payload.ts`) reads the source under the
 *     caller's session and derives the watermark — but must never invent whether
 *     the page is a record.
 *
 * ⚠ **`MintRenderContext` used to live in `@/lib/forms/pdf-payload`**, which meant
 * the MEETINGS provider imported a type from the FORMS domain to describe
 * something neither owns. It moves here with this change — pure, kind-agnostic,
 * and importable by both without a cross-domain edge.
 */

/**
 * What the orchestration supplies that the domain cannot know. Discriminated so
 * the two paths cannot be confused: a prévia has no verification credentials
 * because they are minted WITH the registry row, and there is no registry row.
 */
export type MintRenderContext =
  | { kind: 'registered'; qr: DocumentQr; emission: DocumentEmission }
  | { kind: 'previa'; generation: DocumentGeneration }

/**
 * pt-BR, because `mintPrintedDocument` surfaces a thrown `error.message` straight
 * to the user (raw internals never reach the UI — CLAUDE.md §8). This should be
 * unreachable; it is a fail-LOUD guard, not an expected error path.
 */
const INCOHERENT_PROVENANCE =
  'Não foi possível gerar o documento: estado de impressão inconsistente.'

/**
 * Compose the two halves into the payload's provenance.
 *
 * ⛔ **THE FOURTH-CELL GUARD LIVES HERE** (ADR 0125 D5). `PreviaProvenance.watermark`
 * is typed as the literal `'draft'`, so an ephemeral page CANNOT carry a FINAL
 * mark — but the providers derive the watermark from source state as a
 * `WatermarkFlag`, so the narrowing has to happen somewhere. This is that one
 * place, and it REFUSES rather than coercing.
 *
 * ⚠ Coercing (silently stamping RASCUNHO on a FINAL prévia) was the tempting
 * shape and is wrong: it would make an incoherent derivation *look* fine on
 * paper, which is precisely the failure the keystone exists to catch. If this
 * ever throws, `printSourceRegisters` and `printSourceWatermark` have diverged —
 * a phase-blocking defect, not a rendering hiccup.
 *
 * ⚠ This guard is NOT the coverage. It fires only on inputs someone actually
 * builds; the 220-probe sweep in `src/lib/pdf-mint/print-source-vectors.test.ts`
 * is what proves the pair can never produce this state in the first place.
 */
export function documentProvenance(
  ctx: MintRenderContext,
  watermark: WatermarkFlag,
): DocumentProvenance {
  if (ctx.kind === 'registered') {
    // Both marks are legal on a registered page — RASCUNHO is D1's separating
    // case (the `in_signature` ata), not a degraded FINAL.
    return { kind: 'registered', watermark, qr: ctx.qr, emission: ctx.emission }
  }
  if (watermark !== 'draft') {
    throw new Error(INCOHERENT_PROVENANCE)
  }
  return { kind: 'previa', watermark: 'draft', generation: ctx.generation }
}
