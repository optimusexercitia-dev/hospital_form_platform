/**
 * Shared display helpers for the controlled-documents UI (Phase 17 — Gestão de
 * Documentos Controlados). Pure + client/server-safe: only string formatting (no
 * data access — that goes through `@/lib/queries/controlled-documents`, Rule 9). All
 * user-facing text is pt-BR (Rule 10); storage slugs map to labels via the frozen
 * `*_LABELS` maps in the contract (`@/lib/controlled-documents/types`).
 *
 * Mirrors the Phase-14 safety / Phase-22 referrals `format.ts` convention.
 */

import type { DocumentAvailability } from "@/lib/documents/types";

/**
 * Format a DATE-ONLY value (`YYYY-MM-DD`, e.g. `effective_date`/`review_due_date`)
 * as pt-BR `dd/MM/yyyy` WITHOUT a timezone shift. `new Date("2026-07-01")` is
 * parsed as UTC midnight, which renders the previous day in Brazil (UTC-3); we
 * split the parts instead so a stored review-due date never reads one day early.
 * `null`/invalid → "—".
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Format an ISO TIMESTAMP (e.g. `submittedAt`/`decidedAt`/`createdAt`) as a pt-BR
 * date + time. Timestamps carry a zone, so `Intl` is safe here. `null` → "—".
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** A version number as the platform reads it ("v3"). `null` → "—". */
export function formatVersionNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return `v${n}`;
}

/**
 * How a version's file reads when there is no download control to speak for it
 * (DM3·S2) — the compare table's "Arquivo" row, and the version card's
 * no-download state.
 *
 * DESCRIPTION ONLY. It says what a coordinator is looking at; it decides nothing.
 * The affordance gate is `availability === "available"` and the authority is
 * `open_document_version` — do not read a label from here and branch on it.
 *
 * The two inputs are both needed because `pending` is overloaded: the shared
 * predicate returns it BOTH for a version with no file bound at all and for one
 * whose bytes are mid-verification. Those look identical in `availability` and
 * mean opposite things to the person deciding whether to upload something, so
 * the unbound case is split out on `coreDocumentVersionId` first.
 *
 * Wording is deliberately borrowed from Wave A's `AVAILABILITY_PRESENTATION`
 * rather than reinvented: the same state must not have two names in one product.
 */
export function versionFileLabel(version: {
  coreDocumentVersionId: string | null;
  availability: DocumentAvailability;
}): string {
  if (version.coreDocumentVersionId == null) return "Sem arquivo";
  switch (version.availability) {
    case "available":
      return "Anexado";
    case "pending":
      return "Processando envio";
    case "failed":
      return "Falha no envio";
    case "unavailable":
      return "Indisponível";
    case "disposed":
      return "Eliminado";
  }
}
