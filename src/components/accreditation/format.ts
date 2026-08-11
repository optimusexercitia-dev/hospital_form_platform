/**
 * Shared display helpers for the accreditation UI (Phase 16, QA INFO —
 * mirrors the Phase-14/17/22 per-domain `format.ts` convention).
 */

/**
 * Re-exported from `@/lib/text` (FUP-P16-4), where it now lives so that
 * notifications, safety, documents and cases can reach it without importing an
 * accreditation module. Kept here so this module's existing importers — and
 * `format.test.ts` — are unaffected; the rationale for the literal-pair design
 * travels with the definition.
 */
export { plural } from "@/lib/text";
