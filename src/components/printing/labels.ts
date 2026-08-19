import type {
  PrintedDocumentSourceKind,
  PrintedDocumentStatus,
  WatermarkFlag,
} from "@/lib/pdf/types";

import type { PrintCurrency } from "./currency";

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

// ---------------------------------------------------------------------------
// Currency statements (ADR 0126 D2/D4) — the THIRD fact the page states
// ---------------------------------------------------------------------------

/**
 * The pt-BR statement for a document's CURRENCY, or `null` when the page must
 * say nothing about it.
 *
 * ⛔ Currency is stated SEPARATELY from authenticity and from registry status
 * (ADR 0126 D4: *"The page states authenticity and currency as two separate
 * facts, because they are."*). These strings therefore never assert
 * authenticity — that is the status row's job — and never reuse `Substituído`,
 * which would claim a newer print EXISTS when none does. An auditor who then
 * asked for the superseding document would be asking for one that was never
 * emitted.
 *
 * ⚠ `notApplicable` returns **`null`, not a sentence**. A `revoked` document
 * says `Anulado` and says NOTHING about currency (D3 — the revoked arm performs
 * no join, so there is genuinely nothing to report). Rendering "currency not
 * assessed" there would invent a fact the door never established.
 *
 * ⚠ `Emitido` in the `outdated` string is CORRECT and deliberate: this arm only
 * ever describes a REGISTERED emission, which is the one act ADR 0125 D5
 * reserves the verb for.
 */
export function printCurrencyStatement(currency: PrintCurrency): string | null {
  switch (currency.kind) {
    case "current":
      return "Esta é a revisão atual do documento.";
    case "outdated":
      return "Documento autêntico — emitido de uma revisão que não é mais a atual.";
    case "notApplicable":
      return null;
    case "indeterminate":
      return "Não foi possível apurar se esta é a revisão atual.";
    // No default: EXHAUSTIVE over PrintCurrency — a new arm that forgets its
    // wording is a compile error here, not a blank line on a public page.
  }
}

/**
 * Short chip word for the in-app panel, or `null` when nothing should be shown.
 *
 * Only the NON-current states earn a chip. A current document is the ordinary
 * case and the panel already states its status; adding "atual" to every row
 * would make the one row that matters harder to find, not easier.
 */
export function printCurrencyChipLabel(currency: PrintCurrency): string | null {
  switch (currency.kind) {
    case "current":
      return null;
    case "outdated":
      return "Revisão anterior";
    case "notApplicable":
      return null;
    case "indeterminate":
      return "Atualidade não apurada";
  }
}

// ---------------------------------------------------------------------------
// Prévia vocabulary (ADR 0125 D1/D2/D5) — the EPHEMERAL half of the split
// ---------------------------------------------------------------------------

/**
 * The trigger label for a source that does NOT register (ADR 0125 D1).
 *
 * ⛔ `Emitir` is a RESERVED VERB naming the registered act only (D5 +
 * Consequences), so it must not appear on a still-editable source. ⚠ The
 * boundary is **lock, not finality**: "Emitir documento" stays CORRECT on an
 * `in_signature` ata, which is non-final and registers.
 */
export const PREVIA_BUTTON_LABEL = "Imprimir prévia";

/**
 * What a prévia is, in one sentence.
 *
 * ⛔ **Deliberately states the CONSEQUENCE, never the CAUSE.** The tempting
 * shape — "a resposta ainda não foi enviada" / "a ata ainda não entrou em
 * assinatura" — invents a reason the predicate does not guarantee: a source can
 * fail to register because it is a draft, because an open correction can still
 * be rejected, because its phase was voided, because the ata was cancelled, or
 * because its minutes were disposed. Naming one of them would be right for some
 * sources and a lie for the rest.
 *
 * That is the §K class exactly — copy asserting a cause from an adjacent fact
 * that used to imply it — so this string asserts only what is true of EVERY
 * non-registering source.
 */
export const PREVIA_HELPER_COPY =
  "A prévia não é registrada, não recebe código de verificação e não vale como via de registro. Ela sai marcada como RASCUNHO.";

/** The ephemeral render route for one source (ADR 0125 D4) — streamed, never stored. */
export function previaHref(
  kind: PrintedDocumentSourceKind,
  sourceId: string,
): string {
  return `/api/previa/${kind}/${sourceId}`;
}

/**
 * The registry panel's intro sentence — **conditional on whether the source
 * registers** (ADR 0125 D1/D5).
 *
 * ⛔ **This was a live reserved-verb leak.** The panel used to state
 * unconditionally that *"cada emissão gera um PDF permanente, verificável pelo
 * QR code impresso"* — directly above the prévia control, which produces exactly
 * the opposite. Four reserved-verb sweeps missed it because every one of them
 * reads a RENDERED PRIMITIVE (the footer, the template, the document) and none
 * reads the composed panel: **the verb was never in the thing being printed, it
 * was in the furniture around the button.**
 *
 * ⚠ The non-registering sentence names **no cause**, on the same discipline as
 * {@link PREVIA_HELPER_COPY}: a source can stop registering because it is a
 * draft, because a correction is still rejectable, because its phase was voided,
 * because the ata was cancelled, or because its minutes were disposed. It also
 * avoids "ainda" — for a disposed ata the state is not a waypoint.
 *
 * ⚠ The HEADING stays "Documentos emitidos" in both branches, and that is
 * correct rather than an oversight: it labels the LIST of registered emissions,
 * which can be non-empty for a source that no longer registers — a reopened or
 * disposed ata keeps the prints it minted while it was locked.
 */
export function printedDocumentsIntroCopy(registers: boolean): string {
  return registers
    ? "Cada emissão gera um PDF permanente, verificável pelo QR code impresso."
    : "No estado atual, este registro não gera emissões. As anteriores continuam válidas e verificáveis pelo QR code impresso.";
}
