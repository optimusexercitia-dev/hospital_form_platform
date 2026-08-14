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
 * Why a reply attachment is listed but cannot be opened by THIS reader.
 *
 * This is the two-tier referral asymmetry made visible (plan §3.2): row
 * visibility is `can_read_referral_metadata` (broad), byte access is
 * `can_read_referral_phi` (narrow). A metadata-tier reader legitimately sees
 * the row with `canOpen: false`, and the row must stay VISIBLE — hiding it
 * would misrepresent the referral's contents to someone entitled to know an
 * attachment exists. The sentence explains the gap instead of implying a
 * transient failure.
 */
export const REFERRAL_ATTACHMENT_NO_ACCESS_DETAIL =
  "Você pode ver que este anexo existe, mas não tem autorização para abrir arquivos com dados de paciente deste encaminhamento.";

/** Short badge text paired with {@link REFERRAL_ATTACHMENT_NO_ACCESS_DETAIL}
 * (icon + text + shape — never colour alone). */
export const REFERRAL_ATTACHMENT_NO_ACCESS_LABEL = "Sem permissão para abrir";

/**
 * Why a frozen snapshot DOCUMENT cannot be opened, per cause. Snapshot rows
 * carry no server-computed `canOpen` (see `referral-snapshot.tsx`), so these
 * three are the only non-servable states the projection lets the UI state
 * truthfully before a click.
 */
export const SNAPSHOT_UNAVAILABLE_DETAIL = {
  /** `frozenTombstonedAt` set — reconciled away or its PHI disposed (plan R5). */
  tombstoned:
    "O arquivo deste documento foi eliminado. O registro do compartilhamento permanece para auditoria.",
  /** A `document` row with no `frozenDocumentVersionId` — legacy/never bound. */
  unbound: "Este documento não está disponível para abertura.",
  /** The `documents_wave_c` flag is off for this tenant. */
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
