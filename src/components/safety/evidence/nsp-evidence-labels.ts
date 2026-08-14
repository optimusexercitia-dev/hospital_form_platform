import { DOCUMENT_MAX_SIZE_BYTES } from "@/lib/documents/types";
import type {
  NspEvidenceAvailability,
  NspEvidenceErrorCode,
} from "@/lib/safety/evidence-contract";
import {
  AVAILABILITY_PRESENTATION,
  type AvailabilityPresentation,
} from "@/components/documents/document-labels";

/**
 * NSP evidence UI vocabulary (DM5·S2) — the pt-BR wording for RCA and CAPA
 * evidence once it rides the core document substrate (ADR 0120, under ADR 0114
 * D8/D9).
 *
 * Pure module: type-only + constant imports from client-safe contracts
 * (`@/lib/safety/evidence-contract`, `@/lib/documents/types`), no server
 * imports, so both Server and Client components may consume it. This is the
 * `lint:client-server-imports` gate's shape, and the reason BUG-FBE-005 cannot
 * recur through this file.
 *
 * ## Why the badge vocabulary is REUSED, not rewritten
 *
 * `availability` is not an NSP concept — it is the core file-object state
 * machine projected for a reader, and a Wave-D evidence row and a Wave-A
 * document row in the same state are in the SAME state. The contract makes the
 * same argument for the error codes ("a divergent vocabulary would be two names
 * for one failure"), and it applies at least as strongly to words a clinician
 * reads. So the pill's label/tone/icon come from
 * {@link AVAILABILITY_PRESENTATION} verbatim and the badge component itself is
 * reused; only the explanatory SENTENCE is restated here, because the recovery
 * differs — an evidence row lives inside a governance record, so "remove and
 * re-send" and "the record survives the bytes" are the sentences that matter.
 */

// ---------------------------------------------------------------------------
// Availability — the states a caller-minted path could never produce
// ---------------------------------------------------------------------------

/** The non-servable states an NSP evidence row can reach. */
export type NspEvidenceNonServable = Exclude<NspEvidenceAvailability, "available">;

/**
 * Presentation per non-servable state — FOUR members, matching the document
 * twin.
 *
 * ⚠ `unavailable` was ABSENT here until S2 was reopened, on the ruling that
 * both NSP projections filter `.is('deleted_at', null)` so the state could
 * never occur. **That reasoning was wrong, and the way it was wrong is worth
 * keeping:** the filter is on the EVIDENCE row, while `unavailable` derives
 * from the backing DOCUMENT's status, which `soft_delete_document` reaches
 * independently. Two different rows, two different lifecycles — the filter was
 * real, it just never bounded the thing it was cited for. A predicate quoted at
 * the wrong GRAIN reads exactly like a proof.
 *
 * ⚠⚠ The state was not merely missing, it was COLLAPSING TO `failed` — worse
 * than absent. A deliberately removed document was telling the reader the
 * upload had broken and to send the file again: a false diagnosis prescribing a
 * recovery that cannot work, since re-uploading meets the same wall. That is
 * why the two must never share wording.
 *
 * `unavailable` ALSO appears in {@link NSP_EVIDENCE_ERROR_MESSAGE} as the
 * `HC0D8` open-door refusal, and the two are deliberately worded differently:
 * this one is "this row's document is gone", that one is "you clicked and it
 * was gone by the time the door answered".
 */
export const NSP_EVIDENCE_AVAILABILITY: Record<
  NspEvidenceNonServable,
  AvailabilityPresentation
> = {
  pending: {
    ...AVAILABILITY_PRESENTATION.pending,
    detail:
      "O arquivo ainda está sendo verificado. Atualize a página em instantes para abri-lo.",
  },
  failed: {
    ...AVAILABILITY_PRESENTATION.failed,
    detail:
      "O envio deste arquivo não foi concluído. Remova esta evidência e envie o arquivo novamente.",
  },
  /**
   * The backing DOCUMENT was removed through a governance action — not a
   * transfer that broke. Register is deliberately `disposed`'s (a completed,
   * legitimate outcome, calmly stated), never `failed`'s, and it must NOT
   * suggest sending the file again: that is precisely the action that cannot
   * work. It differs from `disposed` on CAUSE — removed by someone, versus
   * destroyed under the retention policy — which is the distinction a committee
   * reconstructing the analysis later actually needs.
   */
  unavailable: {
    ...AVAILABILITY_PRESENTATION.unavailable,
    detail:
      "O documento desta evidência foi removido e não pode mais ser aberto. A evidência permanece registrada na análise.",
  },
  disposed: {
    ...AVAILABILITY_PRESENTATION.disposed,
    detail:
      "O arquivo foi eliminado conforme a política de retenção. A evidência permanece registrada na análise, sem o arquivo.",
  },
};

/**
 * Whether a state can ever offer an open control. Only `available` can — and
 * even then the decision is the SERVER's (`canOpen`), never this table's.
 * `pending` renders a DISABLED control (bytes are genuinely on the way, so the
 * affordance is a promise); the rest render none, because there is nothing to
 * open. Mirrors `DOCUMENT_AVAILABILITY_ALLOWS_OPEN` over the narrower union.
 */
export const NSP_EVIDENCE_ALLOWS_OPEN: Record<NspEvidenceAvailability, boolean> = {
  available: true,
  pending: false,
  failed: false,
  // The document behind it is gone; there is nothing to open, and no disabled
  // "promise" control either — unlike `pending`, no bytes are on the way.
  unavailable: false,
  disposed: false,
};

/**
 * Whether write affordances (remove) may appear at all. A disposed row is
 * terminal — offering "Remover" on it would be offering to delete a tombstone.
 */
export const NSP_EVIDENCE_ALLOWS_WRITE: Record<NspEvidenceAvailability, boolean> = {
  available: true,
  pending: true,
  failed: true,
  // TRUE, unlike `disposed`, and the asymmetry is the point: the EVIDENCE row
  // is still live here — only the document behind it went away — so removing a
  // row that can no longer show anything is a legitimate tidy-up. A disposed
  // row is itself the tombstone, and offering to delete a tombstone is not.
  // Matches `DOCUMENT_AVAILABILITY_ALLOWS_WRITE`, which rules the same way.
  unavailable: true,
  disposed: false,
};

// ---------------------------------------------------------------------------
// Upload guidance
// ---------------------------------------------------------------------------

/**
 * The TITLE rule, shared by both NSP evidence homes.
 *
 * Mirrors the document dialog's D12 guidance and, like it, gives the actual
 * REASON — titles stay readable to the whole analysis team, including people who
 * cannot open the file — because guidance without a reason is guidance
 * clinicians learn to skip. The FILE sentence is per-home and lives with each
 * wrapper, since what an RCA file may contain and what a CAPA file may contain
 * are separate statements.
 */
export const NSP_EVIDENCE_TITLE_GUIDANCE =
  "Não escreva dados de paciente no título. Ele fica visível para toda a equipe da análise, inclusive para quem não pode abrir o arquivo.";

// ---------------------------------------------------------------------------
// Errors — pt-BR wording for the contract's SQLSTATE-keyed codes
// ---------------------------------------------------------------------------

/** Last-resort pt-BR message. Raw Supabase/Postgres text must never reach the
 *  UI (CLAUDE.md §8), so any unmapped code renders this. */
export const NSP_EVIDENCE_ERROR_FALLBACK =
  "Não foi possível concluir a operação. Tente novamente em instantes.";

/** The size cap, stated once from the enforced constant so the sentence cannot
 *  drift from the limit the substrate actually applies. */
const MAX_SIZE_MB = Math.round(DOCUMENT_MAX_SIZE_BYTES / (1024 * 1024));

/**
 * pt-BR wording for every {@link NspEvidenceErrorCode}.
 *
 * The contract maps SQLSTATEs to these codes on CODE ALONE, never message text;
 * the wording stays here per Rule 10. Where a code is shared with the document
 * command layer the sentence is deliberately the same one
 * (`@/components/documents/document-labels`) — one failure, one wording.
 *
 * `rca_not_writable` (HC048) is the only genuinely NSP-specific code, and its
 * copy names the recovery rather than the refusal: a completed analysis is a
 * normal lifecycle state, and reopening it is a real affordance the reader has.
 */
export const NSP_EVIDENCE_ERROR_MESSAGE: Record<NspEvidenceErrorCode, string> = {
  module_disabled: "O envio de evidências ainda não está disponível.",
  not_found: "Evidência não encontrada.",
  forbidden: "Você não tem autorização para esta ação.",
  rca_not_writable:
    "Esta análise já foi concluída e não aceita novas evidências. Reabra a análise para editá-la.",
  under_legal_hold:
    "Esta evidência está sob retenção legal e não pode ser removida.",
  upload_expired:
    "O tempo para enviar o arquivo expirou. Feche e comece o envio novamente.",
  upload_incomplete: "O arquivo não chegou por completo. Tente enviar novamente.",
  file_too_large: `O arquivo excede o tamanho máximo de ${MAX_SIZE_MB} MB.`,
  file_type_not_allowed: "Este tipo de arquivo não é aceito.",
  invalid_input: "Verifique os dados informados e tente novamente.",
  unavailable: "Esta evidência não está disponível para abertura no momento.",
  disposed: "O arquivo foi eliminado definitivamente e não pode mais ser aberto.",
  retention_blocked:
    "A política de retenção deste arquivo ainda não permite a eliminação.",
  unknown: NSP_EVIDENCE_ERROR_FALLBACK,
};

/** pt-BR message for a command failure — never renders a raw server string. */
export function nspEvidenceErrorMessage(code: NspEvidenceErrorCode): string {
  return NSP_EVIDENCE_ERROR_MESSAGE[code] ?? NSP_EVIDENCE_ERROR_FALLBACK;
}

/**
 * The two denial-class codes, collapsed to one sentence for the OPEN control.
 *
 * `not_found` and `forbidden` are separate CODES because the contract needs
 * them separate; they must not be separate SENTENCES at the byte door, because
 * "não encontrada" vs "não autorizada" is exactly the distinction a denied
 * caller must not be handed (the contract's own "absence ≡ denial, deliberately
 * indistinguishable"). Every other code is state the reader can already see in
 * the row's badge, so wording it plainly discloses nothing new — and a disposed
 * file is a governance outcome the reader deserves stated, not a fault to hide
 * behind a generic failure.
 */
const OPEN_DENIAL_MESSAGE = "Não foi possível abrir esta evidência.";

/** pt-BR message for a failed open through the audited door. */
export function nspEvidenceOpenMessage(code: NspEvidenceErrorCode): string {
  if (code === "not_found" || code === "forbidden") return OPEN_DENIAL_MESSAGE;
  return nspEvidenceErrorMessage(code);
}

/**
 * The one upload failure with NO retry.
 *
 * ⚠ Inherited from DM2 QA r1 MAJOR-3: when the bytes REACHED storage and failed
 * verification, `file_objects` is `failed` — a state the D9 machine has no
 * outbound arc from, over bytes that are immutable (Rule 6). Re-running
 * finalize can never succeed, so a "Tentar novamente" button re-enters the same
 * dead end forever.
 *
 * ⚠ Discriminated on `NspEvidenceActionState.terminal`, NEVER on the error code
 * — `upload_incomplete` is returned for both outcomes, which is the whole reason
 * the marker exists (contract amendment 1). The copy says the same thing
 * {@link NSP_EVIDENCE_AVAILABILITY}`.failed.detail` says, rather than inventing
 * a second vocabulary for one recovery.
 */
export const NSP_EVIDENCE_UPLOAD_TERMINAL_MESSAGE =
  "A verificação do arquivo falhou. Remova esta evidência e envie o arquivo novamente.";
