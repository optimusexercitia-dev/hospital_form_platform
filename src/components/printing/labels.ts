import type {
  PrintedDocumentSourceKind,
  PrintedDocumentStatus,
} from "@/lib/pdf/types";

/**
 * Shared pt-BR vocabulary for the printed-documents surfaces (PDF·P1; ADR 0104).
 *
 * ONE source for every user-facing string the module repeats, because the same
 * words appear on two sides of a trust boundary: the in-app panel (F2) and the
 * PUBLIC verification page (F1). If "substituído" ever read as an error in one
 * place and as recency in the other, the public page would be the one telling a
 * hospital's auditor that valid paper is wrong (ADR 0104 D6 forbids exactly
 * that).
 *
 * PURE module by construction — types only, no `@/lib/supabase`, no queries — so
 * both Server and Client Components may import it (design system §7: a client
 * value-import of a server module aborts the build).
 */

/** Document kind, as printed and as reported by verification (ADR 0104 D3/D10).
 * All four kinds exist from day one; only `form_response` mints in P1. */
export const DOCUMENT_KIND_LABELS: Record<PrintedDocumentSourceKind, string> = {
  form_response: "Formulário preenchido",
  case: "Caso",
  meeting: "Ata de reunião",
  interview: "Entrevista",
};

/** Short status word for chips and inline mentions (ADR 0104 D6). */
export const DOCUMENT_STATUS_LABELS: Record<PrintedDocumentStatus, string> = {
  active: "Ativo",
  superseded: "Substituído",
  revoked: "Anulado",
};

/**
 * The revocation reason vocabulary (ADR 0104 D6/D12 — a CLOSED class, never free
 * text alone; the free-text reason accompanies it and is audited).
 *
 * Values mirror `RevokePrintedDocumentInput.reasonClass`. Kept as a `const`
 * tuple so the union below is derived from the rendered options rather than
 * declared twice — a second declaration is the thing that goes stale silently.
 */
export const REVOKE_REASON_CLASSES = [
  {
    value: "wrong_data",
    label: "Dados incorretos",
    hint: "O documento foi emitido a partir de informações que estavam erradas.",
  },
  {
    value: "minted_in_error",
    label: "Emitido por engano",
    hint: "A emissão não deveria ter acontecido (fonte errada, duplicidade).",
  },
  {
    value: "other",
    label: "Outro motivo",
    hint: "Descreva o motivo no campo abaixo.",
  },
] as const;

/** A revocation reason class, derived from the rendered options. */
export type RevokeReasonClass = (typeof REVOKE_REASON_CLASSES)[number]["value"];

/** pt-BR date + time, matching the submissions surfaces. Falls back to the raw
 * value rather than throwing — a malformed timestamp must not blank a page. */
export function formatDateTimePtBr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** pt-BR long date, for the public verification page where a single emission
 * date is the headline fact and deserves to read as prose. */
export function formatDatePtBrLong(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
