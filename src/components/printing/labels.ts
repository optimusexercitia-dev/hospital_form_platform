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
 * Only kinds that actually render a mint surface are listed. `interview`
 * deliberately falls through to the generic phrase rather than being enumerated
 * ahead of the phase that builds it (P4) — a label written now for a screen that
 * does not exist is a claim nothing can check, and it would go stale silently.
 * `case` earns its entry in P3, when its surface actually ships.
 */
const KIND_SOURCE_PHRASE: Partial<Record<PrintedDocumentSourceKind, string>> = {
  form_response: "desta resposta",
  meeting: "desta reunião",
  case: "deste caso",
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

/**
 * The mint dialog's one-line summary of what is about to be produced.
 *
 * The `case` kind states the SCOPE outright — the print is the complete dossier,
 * not a selection. ADR 0144 D1 rejected a "tick the sections you want" mint (it
 * would make the artifact non-deterministic for a template key+version, which is
 * what the fingerprint exists to pin), so there is no picker on the screen to
 * tell the user that. Saying it here is the only place the fixed scope is
 * announced before they commit — and it sets the expectation for a long PDF,
 * which D1 accepts as "length is not a defect here".
 */
export function mintDialogDescriptionCopy(
  kind: PrintedDocumentSourceKind,
): string {
  if (kind === "case") {
    return "Gera um PDF definitivo com o dossiê completo deste caso e o registra na plataforma.";
  }

  return `Gera um PDF definitivo ${documentSourcePhrase(kind)} e o registra na plataforma.`;
}

/**
 * WHY this mint will carry the mark it carries (ADR 0104 D7).
 *
 * Kind-aware SENTENCES, not a noun substitution: the condition that makes a
 * document final differs per kind — a form response is final once *submitted*, a
 * meeting once its ata is *signed*. Swapping only the noun would have produced
 * "A reunião já foi enviada", which is not a thing that happens to a meeting.
 *
 * ⚠ The `case` arms are ASYMMETRIC on purpose (ADR 0144 D3). Its condition is a
 * CONJUNCTION — `status IN ('completed','cancelled')` **AND** patient data not
 * discarded — so:
 *
 * - `final` may state both conjuncts outright: both are known to hold.
 * - `draft` may state NEITHER, because the negation is a DISJUNCTION. A case can
 *   fail to register because it is still open, **or** because its patient data
 *   was disposed under LGPD Art. 18 — and a disposed case IS terminal, so the
 *   generic "ainda não está em estado final" fallback would be a flat lie about
 *   it. The draft arm therefore names the REQUIREMENT, never the failure. This
 *   is the same discipline {@link PREVIA_HELPER_COPY} carries, for the same
 *   reason.
 *
 * ⚠ "não foram descartados" is deliberately negative rather than "mantém os
 * dados do paciente": the predicate is `phi_disposed_at IS NULL`, which is
 * equally true of a case that never held patient data at all. The positive
 * phrasing would assert PHI exists on every terminal case.
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

  if (kind === "case") {
    return isFinal
      ? "O caso já está concluído ou cancelado e seus dados de paciente não foram descartados, então o documento sai como via final."
      : "A via final exige um caso concluído ou cancelado cujos dados de paciente não tenham sido descartados. Enquanto isso não valer, o documento sai marcado como rascunho.";
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
 * Reason classes the SYSTEM assigns — never offered in the revoke dialog.
 *
 * ⛔ **Deliberately a SECOND map rather than three more entries in
 * {@link REVOKE_REASON_CLASSES}.** That tuple is the dialog's option list: every
 * value in it is something a human may pick as their reason for annulling a
 * document. `phi_disposed` is not a choice anyone makes about a *document* — it
 * is the trace left on the registry by an LGPD Art. 18 erasure of the underlying
 * CASE (`dispose_case_phi`; ADR 0144 D10). Adding it to the tuple would put
 * "descartar os dados do paciente" in a dropdown that does nothing of the sort,
 * and would widen `RevokeReasonClass` — the dialog's own state type — with a
 * value the dialog must never submit.
 *
 * ⚠ The wording carries D10's split and is the whole point of the entry: the
 * registry row, its hash, its audit trail and its verification token **survive**;
 * only the stored bytes are destroyed. A reader who reaches `/verificar` on this
 * document is looking at one that was legitimately emptied, NOT one withdrawn as
 * wrong — so the label says what happened to the file, never "por engano".
 */
const SYSTEM_REVOKE_REASON_CLASSES: Record<string, string> = {
  phi_disposed: "Arquivo destruído — dados do paciente descartados (LGPD)",
};

/**
 * The pt-BR label for a stored reason class — the ONLY sanctioned way to render
 * one, so no surface can reintroduce the raw value.
 *
 * Resolves against the user-selectable vocabulary FIRST, then the
 * system-assigned one ({@link SYSTEM_REVOKE_REASON_CLASSES}). Both are looked up
 * here so no surface has to know which kind of class it holds — a stored value is
 * just a value, and the panel that renders it cannot tell how it got there.
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
  const chosen = REVOKE_REASON_CLASSES.find(
    (option) => option.value === value,
  )?.label;
  if (chosen) return chosen;

  // `value` may be null/undefined; an index lookup on those is a runtime error,
  // so guard before reaching for the system map.
  if (value && SYSTEM_REVOKE_REASON_CLASSES[value]) {
    return SYSTEM_REVOKE_REASON_CLASSES[value];
  }

  return "Outro motivo";
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

/**
 * The ephemeral render route for one source (ADR 0125 D4) — streamed, never
 * stored.
 *
 * ⚠ `includePhi` appends `?phi=1` **verbatim** — the canonical form agreed with
 * the route that parses it. This is ADR 0144 D9: a prévia gets the same PHI fork
 * a mint does, through the same door, and it emits the Rule 11 PHI-read row. It
 * is NOT a lighter-weight path to identified content. Defaults to the
 * de-identified variant, matching the mint's default-OFF choice.
 */
export function previaHref(
  kind: PrintedDocumentSourceKind,
  sourceId: string,
  includePhi = false,
): string {
  const path = `/api/previa/${kind}/${sourceId}`;
  return includePhi ? `${path}?phi=1` : path;
}

// ---------------------------------------------------------------------------
// The PHI fork (ADR 0104 D9 · ADR 0144 D5/D6/D9) — the per-print patient choice
// ---------------------------------------------------------------------------

/**
 * The control's label, worded around what ticking it ADDS.
 *
 * ⛔ Never phrase the unchecked state as a promise ("sem identificação do
 * paciente", "versão anônima"). Both would be FALSE: the de-identified variant
 * still prints age, sex and unit, and — far more importantly — the free-text
 * clinical content it carries may itself name a patient (D6). A control that
 * promises absence is the single most dangerous string on this screen, because a
 * user who believes it will hand the PDF to someone they would not otherwise
 * have handed it to.
 */
export const PHI_CHOICE_LABEL = "Incluir identificação do paciente";

/** Exactly what ticking the box adds, and what prints either way (D5). Naming
 * both halves stops the unchecked variant from reading as "a dossier about
 * nobody" — age/sex/unit is the de-identification floor an ONA tracer needs. */
export const PHI_CHOICE_HINT =
  "Acrescenta nome, número do prontuário, data de nascimento, profissional responsável e referência do atendimento. Idade, sexo e unidade saem nas duas versões.";

/**
 * ⭐ **ADR 0144 D6 as amended (Amendment 5), stated before the user commits —
 * the highest-value copy on this surface.**
 *
 * `contains_phi` is **CONSTITUTIVE for a case dossier, not derived**:
 * `containsPhi := !caseDisposed`. Every live case dossier carries the
 * confidentiality band — including the de-identified one — and the band lifts
 * only once the case's patient data has been discarded.
 *
 * ⛔ **This string used to name a CAUSE, and that cause is what shipped finding
 * C-1.** It said the band was *"acionada pela presença de texto clínico livre"*,
 * mirroring the old derived rule. That rule counted narratives and answers and
 * counted NOT the masked-class fields `dispose_case_phi` actually redacts
 * (`cases.label`, `case_events.title`, `documents.title`), so a case whose
 * patient name sat in its title derived `false`, landed in the standard bucket,
 * and was skipped by the erasure. The copy is now worded on the RULE, not on a
 * content inventory — a sentence that enumerates what the band tracks is a
 * sentence that goes false the moment the classifier's term set moves.
 *
 * ⚠ The condition is stated NEGATIVELY ("não tiverem sido descartados"), on the
 * same discipline as {@link watermarkReasonCopy}'s conjunct and for the same
 * reason: the predicate is `phi_disposed_at IS NULL`, which is equally true of a
 * case that never held patient data at all. "Enquanto o caso mantiver seus dados
 * de paciente" would assert PHI exists on every live case.
 *
 * ⚠ **Deliberately ONE constant rather than a kind-aware function, and the test
 * pins why.** The notice renders under the provider's `phiCapable` declaration
 * (never a kind test — ADR 0104 D9's v2-readiness seam), and `case` is the only
 * kind that declares it. Writing a second arm now for a kind that cannot reach
 * the string is the {@link KIND_SOURCE_PHRASE} mistake — copy for a screen that
 * does not exist, which nothing can check and which goes stale silently. A
 * second PHI-capable kind must come back here and split it.
 *
 * Without this sentence, a user who ticks nothing and then sees
 * "DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE" on the page has exactly two
 * available readings, and both are wrong and both are reasonable: that the
 * platform ignored their choice, or that the de-identified variant leaks
 * identifiers. The first makes the product look broken; the second could make
 * someone withhold a document they were entitled to produce — or, inverted, make
 * them treat an identified print as safe because they "didn't tick anything".
 */
export const PHI_BAND_NOTICE =
  "Enquanto os dados de paciente do caso não tiverem sido descartados, o dossiê sai sempre com a tarja “DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE” — nas duas versões, e não por esta opção. Esta escolha altera apenas os campos estruturados de identificação acima.";

/** The identified prévia's link label. Says "identificada" outright: the two
 * links sit side by side and the difference between them must be legible from
 * the label alone, not from their order. */
export const PREVIA_PHI_BUTTON_LABEL = "Imprimir prévia identificada";

/**
 * Why the identified prévia is a second, deliberate act rather than a toggle.
 *
 * ⚠ States the audit consequence plainly (D9): a prévia is ephemeral but its PHI
 * read is NOT. Reasoning "prévias are ephemeral, so they don't audit" is exactly
 * what would turn this link into an unaudited PHI export path, and a user who
 * assumes the same thing is being told otherwise here.
 *
 * ⚠ **"Como toda leitura" is load-bearing, not filler.** Both dossier variants
 * read through the audited door — `age_years` / `sex` / `unit` live on the same
 * Class-1 table as `name` / `mrn`, so there is no de-identified demographics
 * source and a de-identified print by a PHI-capable minter logs a PHI read too
 * (lead ruling, 2026-08-25). An audit sentence attached to the identified link
 * ALONE says nothing false on its own terms, but sits opposite a de-identified
 * link that carries no such sentence — and the contrast asserts, by implicature,
 * that the other one is unaudited. Generalising the clause removes the
 * implicature without putting a second audit line on a link whose helper is
 * already about something else.
 *
 * ⛔ **Two words this string may not use, both nearly shipped in it.**
 * `emissão` — the RESERVED noun for the registered act (ADR 0125 D5): a draft
 * read "mesmo sem emissão", which denies the act but still puts the reserved word
 * on a prévia surface, where the standing sweep looks for exactly that token.
 * `registrado` — it sits directly beneath {@link PREVIA_HELPER_COPY}'s "não é
 * registrada", and the two would appear to contradict each other; the subjects
 * differ (the DOCUMENT is not registered, the ACCESS is) but nobody reads a
 * helper line twice to work that out. "Trilha de auditoria" collides with
 * neither.
 */
export const PREVIA_PHI_HELPER_COPY =
  "Abre a mesma prévia com a identificação do paciente. Como toda leitura de dados de paciente, este acesso entra na trilha de auditoria — mesmo sem gerar documento.";

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
