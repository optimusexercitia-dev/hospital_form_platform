import type {
  PrintedDocumentSourceKind,
  PrintedDocumentStatus,
  WatermarkFlag,
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

/**
 * How a document's SOURCE is referred to in running pt-BR copy ("os documentos
 * emitidos ___"). BUG-PDF2-001: the printing components shipped in P1 with
 * "desta resposta" hardcoded, which read wrong the moment a second kind arrived.
 *
 * Only kinds that actually render a mint surface are listed. `case` and
 * `interview` deliberately fall through to the generic phrase rather than being
 * enumerated ahead of the phases that build them — a label written now for a
 * screen that does not exist is a claim nothing can check, and it would go stale
 * silently.
 */
const KIND_SOURCE_PHRASE: Partial<Record<PrintedDocumentSourceKind, string>> = {
  form_response: "desta resposta",
  meeting: "desta reunião",
};

/** Kind-neutral fallback. "Registro" is the honest generic here — ADR 0104 D1's
 * whole premise is that a mint produces a RECORD. */
const GENERIC_SOURCE_PHRASE = "deste registro";

/** The source phrase for one kind, e.g. "desta reunião". */
export function documentSourcePhrase(kind: PrintedDocumentSourceKind): string {
  return KIND_SOURCE_PHRASE[kind] ?? GENERIC_SOURCE_PHRASE;
}

/** Empty state for the "Documentos emitidos" panel. */
export function noPrintedDocumentsCopy(kind: PrintedDocumentSourceKind): string {
  return `Nenhum documento emitido a partir ${documentSourcePhrase(kind)} ainda.`;
}

/** Failed-registry-read notice for the panel. */
export function printedDocumentsLoadErrorCopy(
  kind: PrintedDocumentSourceKind,
): string {
  return `Não foi possível carregar os documentos emitidos ${documentSourcePhrase(kind)}. Atualize a página em alguns instantes.`;
}

/** The mint dialog's one-line summary of what is about to be produced. */
export function mintDialogDescriptionCopy(
  kind: PrintedDocumentSourceKind,
): string {
  return `Gera um PDF definitivo ${documentSourcePhrase(kind)} e o registra na plataforma.`;
}

/**
 * WHY this mint will carry the mark it carries (ADR 0104 D7).
 *
 * Kind-aware SENTENCES, not a noun substitution: the condition that makes a
 * document final differs per kind — a form response is final once *submitted*, a
 * meeting once its ata is *signed*. Swapping only the noun would have produced
 * "A reunião já foi enviada", which is not a thing that happens to a meeting.
 */
export function watermarkReasonCopy(
  kind: PrintedDocumentSourceKind,
  watermark: WatermarkFlag,
): string {
  const isFinal = watermark === "final";

  if (kind === "form_response") {
    return isFinal
      ? "A resposta já foi enviada, então o documento sai como via final."
      : "A resposta ainda está em andamento, então o documento sai marcado como rascunho.";
  }

  if (kind === "meeting") {
    return isFinal
      ? "A ata já foi assinada, então o documento sai como via final."
      : "A ata ainda não foi assinada, então o documento sai marcado como rascunho.";
  }

  return isFinal
    ? "A origem já está em estado final, então o documento sai como via final."
    : "A origem ainda não está em estado final, então o documento sai marcado como rascunho.";
}

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

/**
 * The pt-BR label for a stored reason class — the ONLY sanctioned way to render
 * one, so no surface can reintroduce the raw value.
 *
 * An unknown class falls back to "Outro motivo", never to the identifier itself.
 * The vocabulary is a server-side enum that can grow before this build knows
 * about it, and echoing the raw value would put an English snake_case token
 * (`wrong_data`) in front of a hospital user — breaking Rule 10 and leaking
 * internal vocabulary into the UI at the same time.
 *
 * "Outro motivo" is the honest fallback rather than a blank or a guess: it is
 * the closed vocabulary's own catch-all, so it still says truthfully that the
 * annulment WAS classified, while claiming nothing about which class it was.
 * The specific class remains intact in the audit ledger, which is where the
 * precise value belongs.
 */
export function revokeReasonClassLabel(
  value: string | null | undefined,
): string {
  return (
    REVOKE_REASON_CLASSES.find((option) => option.value === value)?.label ??
    "Outro motivo"
  );
}

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
