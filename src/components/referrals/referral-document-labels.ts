import type { ReferralDocumentErrorCode } from "@/lib/referrals/types";
import { DOCUMENT_MAX_SIZE_BYTES } from "@/lib/documents/types";

/**
 * DM4 (ADR 0114 Wave C) — pt-BR vocabulary for the referral-document surface.
 *
 * Pure module: type-only + constant imports from the client-safe contracts, no
 * server imports, so both Server and Client components may consume it.
 *
 * ## Why this file exists rather than reusing `document-labels.ts`
 *
 * The DM4 surface has its OWN machine-readable failure union
 * ({@link ReferralDocumentErrorCode}) — it carries three codes Wave A has no
 * concept of (`referral_wrong_state`, `not_target_coordinator`,
 * `snapshot_unavailable`) and drops four of Wave A's. A `Record` keyed on the
 * DM4 union is what makes a future code addition a COMPILE error here instead
 * of a silent fallback to "algo deu errado" in production.
 *
 * ## The rule the wording obeys (CLAUDE.md §8 / Rule 10)
 *
 * The server maps SQLSTATEs to codes ON CODE ALONE — never message text — and
 * this file owns the wording. A raw Postgres/Supabase string reaching the UI is
 * a phase-blocking bug, so every path through the two upload actions and the
 * two byte doors ends in one of the strings below (including a THROWN action,
 * which the client islands catch and render as `unknown`).
 */

/** Last-resort pt-BR message. Anything not in {@link REFERRAL_DOCUMENT_ERROR_MESSAGE}
 * renders this rather than a raw server string. */
export const REFERRAL_DOCUMENT_ERROR_FALLBACK =
  "Não foi possível concluir a operação. Tente novamente em instantes.";

/**
 * pt-BR wording for every {@link ReferralDocumentErrorCode}.
 *
 * Three of these carry information the Wave-A map cannot express, and each is
 * worded to tell the reader what to DO next rather than what the database said:
 *
 * - `not_target_coordinator` — reply attachments are a B-side act. The message
 *   names WHO may perform it, because the most likely reader is a source-side
 *   coordinator who reasonably expected to be able to.
 * - `referral_wrong_state` — the referral moved on (typically concluded in
 *   another tab). "Atualize a página" is the actual recovery.
 * - `snapshot_unavailable` — the frozen snapshot is a GOVERNANCE record whose
 *   bytes are gone (tombstoned, disposed, or never bound). It is deliberately
 *   NOT worded as an error the reader can retry out of; the record surviving
 *   without its bytes is the designed outcome (plan R5).
 *
 * `forbidden` keeps Wave A's neutral wording on purpose: it is returned both to
 * an unauthorized writer AND to a metadata-tier reader denied bytes, and the
 * difference between those two is exactly what a denied caller must not learn.
 */
export const REFERRAL_DOCUMENT_ERROR_MESSAGE: Record<
  ReferralDocumentErrorCode,
  string
> = {
  module_disabled:
    "Os anexos deste encaminhamento ainda não estão disponíveis nesta comissão.",
  not_found: "Documento não encontrado.",
  forbidden: "Você não tem autorização para esta ação.",
  referral_wrong_state:
    "A situação atual do encaminhamento não permite esta ação. Atualize a página.",
  not_target_coordinator:
    "Apenas a coordenação da comissão de destino pode anexar arquivos à resposta.",
  snapshot_unavailable:
    "O arquivo deste documento compartilhado não está mais disponível. O registro permanece para auditoria.",
  upload_expired:
    "O tempo para enviar o arquivo expirou. Comece o envio novamente.",
  upload_incomplete: "O arquivo não chegou por completo. Tente enviar novamente.",
  file_too_large: `O arquivo excede o tamanho máximo de ${Math.round(
    DOCUMENT_MAX_SIZE_BYTES / (1024 * 1024),
  )} MB.`,
  file_type_not_allowed: "Este tipo de arquivo não é aceito.",
  invalid_input: "Verifique os dados informados e tente novamente.",
  unavailable: "Este arquivo não está disponível para abertura no momento.",
  disposed:
    "O arquivo foi eliminado definitivamente e não pode mais ser aberto.",
  unknown: REFERRAL_DOCUMENT_ERROR_FALLBACK,
};

/** pt-BR message for a DM4 referral-document failure — never a raw server string. */
export function referralDocumentErrorMessage(
  code: ReferralDocumentErrorCode,
): string {
  return (
    REFERRAL_DOCUMENT_ERROR_MESSAGE[code] ?? REFERRAL_DOCUMENT_ERROR_FALLBACK
  );
}

/**
 * The one upload failure with NO retry — the DM2 MAJOR-3 contract, carried over
 * verbatim in meaning. The bytes LANDED and failed verification, so the version
 * is `failed` over immutable bytes (Rule 6): re-running finalize can never
 * succeed and a "successful retry" would definitionally be a new upload. The
 * control must offer removal-and-reupload, never "Tentar novamente".
 *
 * Discriminated on the RESULT's `terminal` marker, never on the error code —
 * `upload_incomplete` is returned for BOTH the retryable and the terminal
 * outcome.
 */
export const REFERRAL_UPLOAD_TERMINAL_MESSAGE =
  "A verificação do arquivo falhou. Envie o arquivo novamente.";

/**
 * Why a referral FILE is listed but cannot be opened by THIS reader — the
 * two-tier asymmetry made visible (plan §3.2). Row visibility is
 * `can_read_referral_metadata` (broad); byte access is
 * `can_read_referral_phi` (narrow). A metadata-tier reader legitimately sees
 * the row with `canOpen: false`, and the row must stay VISIBLE — hiding it
 * would misrepresent the referral's contents to someone entitled to know the
 * file exists. The sentences explain the gap rather than implying a transient
 * failure.
 *
 * Both lanes use the SAME badge; only the noun differs, because "anexo" and
 * "documento compartilhado" are different objects to the reader.
 */
export const REFERRAL_ATTACHMENT_NO_ACCESS_DETAIL =
  "Você pode ver que este anexo existe, mas não tem autorização para abrir arquivos com dados de paciente deste encaminhamento.";

/** The snapshot lane's twin of {@link REFERRAL_ATTACHMENT_NO_ACCESS_DETAIL}. */
export const REFERRAL_SNAPSHOT_NO_ACCESS_DETAIL =
  "Você pode ver que este documento foi compartilhado, mas não tem autorização para abrir arquivos com dados de paciente deste encaminhamento.";

/** Short badge text paired with either no-access sentence (icon + text + shape
 * — never colour alone). Named for the FILE, not the attachment: both lanes
 * render it, and a constant whose name claims one lane while two consume it is
 * the stale-assertion class. */
export const REFERRAL_FILE_NO_ACCESS_LABEL = "Sem permissão para abrir";

/**
 * Why a frozen snapshot DOCUMENT cannot be opened, for the two causes that are
 * NOT "this reader may not".
 *
 * ⚠ There is deliberately no `unbound` entry any more. A `document` row with a
 * null `frozenDocumentVersionId` used to render "não está disponível", which
 * was WRONG once the projection began PHI-gating that field: for a
 * metadata-tier reader it is null even when a binding exists, so the copy
 * reported a missing file to a reader whose only real problem was tier. The
 * field is no longer an affordance input at all — `canOpen` is — and the copy
 * that read it is removed rather than parked, because dead copy nobody can
 * reach is how the last one survived long enough to be believed.
 */
export const SNAPSHOT_UNAVAILABLE_DETAIL = {
  /** `frozenTombstonedAt` set — reconciled away or its PHI disposed (plan R5).
   * Metadata-visible governance state BY DESIGN, so it is stated to every
   * reader, including one the byte door would refuse anyway. */
  tombstoned:
    "O arquivo deste documento foi eliminado. O registro do compartilhamento permanece para auditoria.",
  /** The `documents_wave_c` flag is off for this tenant. Distinct from
   * `canOpen: false` — the flag is not in `canOpen`'s definition, so with it
   * off a `canOpen: true` item still has no working door. */
  moduleOff:
    "A abertura de documentos compartilhados ainda não está disponível nesta comissão.",
} as const;

/** D12, referral wording: the TITLE is metadata every metadata-tier reader can
 * read — including readers the byte door refuses — so it must never carry
 * patient data even though the FILE may. Same reason as the Wave-A dialog's
 * guidance; restated for the referral corridor because the audience here spans
 * two committees. */
export const REFERRAL_ATTACHMENT_TITLE_GUIDANCE =
  "Não escreva dados de paciente no título. Ele fica visível para as duas comissões, inclusive para quem não pode abrir o arquivo.";
