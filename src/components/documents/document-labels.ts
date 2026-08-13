import type {
  DocumentActionErrorCode,
  DocumentAvailability,
  DocumentConfidentialityLevel,
  DocumentHomeResourceType,
} from "@/lib/documents/types";
import {
  DOCUMENT_KINDS,
  DOCUMENT_MAX_SIZE_BYTES,
  ENFORCING_CONFIDENTIALITY_LEVELS,
  ENFORCING_LABEL_HOMES,
} from "@/lib/documents/types";

/**
 * Wave-A document UI vocabulary (DM2·S3) — pt-BR labels, tones and per-home copy
 * for the core document model (ADR 0114). Pure module: type-only + constant
 * imports from the client-safe contract (`@/lib/documents/types`), no server
 * imports, so both Server and Client components may consume it.
 *
 * ⚠ Not to be confused with `@/components/controlled-documents/*`, which is the
 * Phase-17 CONTROLLED-document surface (Wave B / DM3).
 */

// ---------------------------------------------------------------------------
// Availability (the 5-member union — ADR 0114 D9/D10)
// ---------------------------------------------------------------------------

/**
 * How each availability state presents. `available` is deliberately absent from
 * the badge map: a servable document needs no badge, the enabled download control
 * IS the signal, and a badge on every healthy row is noise.
 *
 * `failed` and `disposed` are separated on FOUR axes — icon, tone, copy and
 * affordance set (see {@link DOCUMENT_AVAILABILITY_ALLOWS_OPEN} and the row's
 * write-affordance gate). "My upload broke, let me retry" and "this was destroyed
 * on purpose, forever" are the two states a user must never confuse.
 */
export interface AvailabilityPresentation {
  /** Short pt-BR badge text. */
  label: string;
  /** Longer pt-BR explanation rendered under the row title. */
  detail: string;
  /** Badge classes — semantic tokens only; always paired with the label text. */
  style: string;
  /** `lucide-react` icon name resolved by the badge component. */
  icon: "clock" | "alert-triangle" | "eye-off" | "trash";
}

export const AVAILABILITY_PRESENTATION: Record<
  Exclude<DocumentAvailability, "available">,
  AvailabilityPresentation
> = {
  pending: {
    label: "Processando envio",
    detail: "O arquivo ainda está sendo verificado. Atualize a página em instantes.",
    style: "bg-muted text-muted-foreground",
    icon: "clock",
  },
  failed: {
    label: "Falha no envio",
    detail: "O envio não foi concluído. Remova este item e envie o arquivo novamente.",
    style: "bg-destructive/10 text-destructive",
    icon: "alert-triangle",
  },
  unavailable: {
    label: "Indisponível",
    detail: "Este documento não está disponível para abertura no momento.",
    style: "bg-muted text-muted-foreground",
    icon: "eye-off",
  },
  disposed: {
    label: "Eliminado",
    detail:
      "O arquivo foi eliminado definitivamente conforme a política de retenção. O registro permanece para auditoria.",
    style: "border border-dashed border-border bg-muted/40 text-muted-foreground",
    icon: "trash",
  },
};

/**
 * Whether a state can ever offer a download control. Only `available` can — and
 * even then the decision is the SERVER's (`DocumentVersionSummary.canOpen`), never
 * this table's. `pending` is the one state that renders a DISABLED control (bytes
 * are coming); the rest render none at all, because there is nothing to open.
 */
export const DOCUMENT_AVAILABILITY_ALLOWS_OPEN: Record<DocumentAvailability, boolean> = {
  available: true,
  pending: false,
  failed: false,
  unavailable: false,
  disposed: false,
};

/**
 * Whether write affordances (remove / reclassify) may appear at all. A disposed
 * document is terminal — offering "Remover" on it would be offering to delete a
 * tombstone.
 */
export const DOCUMENT_AVAILABILITY_ALLOWS_WRITE: Record<DocumentAvailability, boolean> = {
  available: true,
  pending: true,
  failed: true,
  unavailable: true,
  disposed: false,
};

/** Copy for the orthogonal "servable, but not to YOU" axis — the ADR 0114
 * Amendment 1 (D15) ceiling denying this caller. NOT a sixth availability
 * member: availability describes the FILE, `canOpen` describes the CALLER. */
export const DOCUMENT_RESTRICTED = {
  label: "Restrito",
  detail:
    "Você não tem autorização para abrir este documento. Fale com a coordenação da comissão.",
  style: "bg-warning/15 text-warning",
} as const;

/** A document row whose version does not exist yet. The contract permits
 * `latestVersion: null`; this is how it reads until it is named upstream. */
export const DOCUMENT_NO_VERSION = {
  label: "Sem arquivo",
  detail: "Nenhum arquivo foi enviado para este documento.",
  style: "bg-muted text-muted-foreground",
} as const;

// ---------------------------------------------------------------------------
// Confidentiality (ADR 0072 taxonomy; D15 ceiling)
// ---------------------------------------------------------------------------

/**
 * pt-BR labels for the platform's single 7-value confidentiality vocabulary.
 * Mirrors `@/components/interviews/interview-labels` (same taxonomy, ADR 0072)
 * re-keyed onto the document contract's `DocumentConfidentialityLevel`.
 */
export const CONFIDENTIALITY_LABEL: Record<DocumentConfidentialityLevel, string> = {
  non_phi_internal: "Padrão",
  phi_standard: "Dados de paciente",
  phi_restricted: "Dados sensíveis",
  peer_review_confidential: "Revisão por pares",
  legal_privileged: "Sigilo jurídico",
  ethics_investigation: "Investigação ética",
  credentialing_sensitive: "Credenciamento",
};

/**
 * Badge styling per level (semantic tokens; always paired with the label text —
 * never colour alone). Four tiers of increasing prominence: neutral → noted →
 * elevated → gated (`warning`, the two ENFORCING levels; amber signals
 * "attention/clearance", not an error).
 */
export const CONFIDENTIALITY_STYLE: Record<DocumentConfidentialityLevel, string> = {
  non_phi_internal: "bg-muted text-muted-foreground",
  phi_standard: "bg-secondary text-secondary-foreground",
  phi_restricted: "bg-accent text-accent-foreground",
  peer_review_confidential: "bg-secondary text-secondary-foreground",
  legal_privileged: "bg-warning/15 text-warning",
  ethics_investigation: "bg-accent text-accent-foreground",
  credentialing_sensitive: "bg-warning/15 text-warning",
};

/**
 * DISPLAY order for the picker — mirrors the declaration order of the contract's
 * union.
 *
 * ⚠ This is NOT a sensitivity ranking and NOT the enforcing set. The rank
 * authority is backend's `app.confidentiality_rank()`, which ranks
 * `ethics_investigation` BELOW `legal_privileged` — the reverse of their order
 * here. Consume this ONLY to order options for display: never derive access,
 * rank, or a "levels at or above X" set from it, and never reorder it to "match"
 * a rank (they are independent). Same standing scar as
 * `interview-labels.CONFIDENTIALITY_ORDER`.
 */
export const CONFIDENTIALITY_ORDER: DocumentConfidentialityLevel[] = [
  "non_phi_internal",
  "phi_standard",
  "phi_restricted",
  "peer_review_confidential",
  "legal_privileged",
  "ethics_investigation",
  "credentialing_sensitive",
];

/**
 * Whether a level is ENFORCING (gates ABOVE ordinary home-resource read).
 *
 * ⚠ Reads the exported contract constant and nothing else. There is deliberately
 * no literal level list in this file and no index into
 * {@link CONFIDENTIALITY_ORDER}: if backend adds a third enforcing level, every
 * picker below follows with zero edits here.
 */
export function isEnforcingLevel(level: DocumentConfidentialityLevel): boolean {
  return ENFORCING_CONFIDENTIALITY_LEVELS.includes(level);
}

/**
 * The levels a picker may offer for a given home, in display order.
 *
 * Both inputs come from the CONTRACT, never from a literal here: the enforcing
 * SET from `ENFORCING_CONFIDENTIALITY_LEVELS`, and the homes that can carry one
 * from `ENFORCING_LABEL_HOMES`. A UI-side restatement of either would be an
 * assertion that goes stale silently — this file previously carried its own
 * `['case','interview']` and it is gone.
 *
 * Affordance aid only. The DB guard (`HC0D6`) is the authority, and its refusal
 * still maps to a pt-BR message (`confidentiality_home_rejected`), so the
 * backstop holds even if this filter is ever wrong.
 */
export function confidentialityOptionsForHome(
  home: DocumentHomeResourceType,
): DocumentConfidentialityLevel[] {
  const enforcingAllowed = ENFORCING_LABEL_HOMES.includes(home);
  return CONFIDENTIALITY_ORDER.filter(
    (level) => enforcingAllowed || !isEnforcingLevel(level),
  );
}

/**
 * Helper copy for the confidentiality picker/badge. Must neither oversell (it is
 * not a blanket access control) nor understate (it must not claim it never
 * restricts access).
 */
export const CONFIDENTIALITY_HELPER_TEXT =
  "Classificação de sensibilidade. A maioria dos níveis é apenas informativa; conteúdo de sigilo jurídico ou de credenciamento exige autorização adicional para ser aberto.";

// ---------------------------------------------------------------------------
// Per-home configuration (kills the copy-prop proliferation)
// ---------------------------------------------------------------------------

/**
 * Everything that varies between the three Wave-A homes, resolved from
 * `homeResourceType` instead of passed as a dozen copy props. Adding a home is a
 * row here, not a new prop on every component in the tree.
 */
export interface DocumentHomeConfig {
  /** Panel heading (pt-BR). */
  heading: string;
  /** DOM id stem for the heading + aria wiring. */
  domId: string;
  /** Upload trigger label. */
  uploadLabel: string;
  /** Upload dialog title. */
  dialogTitle: string;
  /**
   * D12 — the FILE sentence. Says plainly whether patient data may be in the
   * bytes. The case and interview modules are Class-1 under Rule 12, so theirs
   * says it MAY; meetings are not a patient-data module, so theirs says it must
   * not. The TITLE rule is separate and shared ({@link D12_TITLE_GUIDANCE}).
   */
  fileGuidance: string;
  /** Empty state for a viewer who may upload. */
  emptyWritable: string;
  /** Empty state for a read-only viewer. */
  emptyReadOnly: string;
  /** Título field placeholder — a concrete, deliberately non-PHI shape. */
  titlePlaceholder: string;
}

/**
 * pt-BR wording for every `kind` slug across all homes (the F2 vocabulary).
 *
 * ⚠ This map carries WORDING ONLY. The vocabulary itself — which slugs exist per
 * home, and their exact spelling — is the contract's `DOCUMENT_KINDS`, and the
 * option lists below are derived from it. That split is deliberate: an earlier
 * draft of this file hand-wrote case's fourth slug as `outro` where the platform
 * stores `other`, which would have written rows no badge could resolve. A
 * vocabulary duplicated in two places drifts; a vocabulary derived cannot.
 */
export const DOCUMENT_KIND_LABEL: Record<string, string> = {
  // case
  ata: "Ata",
  digitalizacao: "Digitalização",
  registro: "Registro",
  other: "Outro",
  // meeting
  pauta: "Pauta",
  apresentacao: "Apresentação",
  literatura: "Literatura",
  lista_presenca: "Lista de presença",
  ata_assinada: "Ata assinada",
  // interview
  gravacao_audio: "Gravação de áudio",
  transcricao_assinada: "Transcrição assinada",
  evidencia: "Evidência",
  // shared
  outro: "Outro",
};

/** The kind options a given home offers, in contract order. */
export function kindOptionsForHome(
  home: DocumentHomeResourceType,
): { value: string; label: string }[] {
  return DOCUMENT_KINDS[home].map((value) => ({
    value,
    label: DOCUMENT_KIND_LABEL[value] ?? value,
  }));
}

/**
 * D12 — the TITLE rule, shared by all three homes and the load-bearing sentence
 * of the whole dialog. It gives the actual REASON (titles stay member-readable,
 * including to people who cannot open the file), because guidance without a
 * reason is guidance clinicians learn to skip.
 */
export const D12_TITLE_GUIDANCE =
  "Não escreva dados de paciente no título nem na descrição. Eles ficam visíveis para toda a comissão, inclusive para quem não pode abrir o arquivo.";

export const DOCUMENT_HOME_CONFIG: Record<DocumentHomeResourceType, DocumentHomeConfig> = {
  case: {
    heading: "Documentos",
    domId: "case-docs",
    uploadLabel: "Anexar documento",
    dialogTitle: "Enviar documento",
    fileGuidance:
      "Anexe uma ata, digitalização ou registro deste caso. O arquivo pode conter dados de paciente — ele fica guardado com a proteção reforçada do módulo de casos.",
    emptyWritable:
      "Nenhum documento anexado. Envie atas, digitalizações ou registros deste caso.",
    emptyReadOnly: "Nenhum documento anexado.",
    titlePlaceholder: "Ex.: Digitalização do prontuário — internação de março",
  },
  meeting: {
    heading: "Anexos",
    domId: "meeting-attachments",
    uploadLabel: "Enviar anexo",
    dialogTitle: "Enviar anexo",
    fileGuidance:
      "Anexe a pauta, apresentação, literatura, lista de presença ou a ata assinada. Não anexe arquivos com dados de paciente: reuniões não são um módulo de dados de paciente.",
    emptyWritable: "Nenhum anexo. Envie a pauta, apresentações ou a ata assinada.",
    emptyReadOnly: "Nenhum anexo.",
    titlePlaceholder: "Ex.: Ata da reunião de revisão",
  },
  interview: {
    heading: "Anexos e gravações",
    domId: "interview-attachments",
    uploadLabel: "Enviar anexo",
    dialogTitle: "Enviar anexo",
    fileGuidance:
      "Anexe a transcrição assinada, uma evidência ou outro documento desta entrevista. O arquivo pode conter dados de paciente — ele fica guardado com a proteção reforçada do módulo de casos.",
    emptyWritable:
      "Nenhum anexo. Envie a transcrição assinada ou vincule a gravação de áudio.",
    emptyReadOnly: "Nenhum anexo.",
    titlePlaceholder: "Ex.: Transcrição assinada",
  },
  /**
   * No product flow exists for action-item documents and none is added here
   * (plan §DM2 item 3 — "stays substrate-only until a product flow exists,
   * matching today"). Present so the record is exhaustive and a future flow has
   * a defined starting point; no panel renders it.
   */
  action_item: {
    heading: "Anexos",
    domId: "action-item-attachments",
    uploadLabel: "Enviar anexo",
    dialogTitle: "Enviar anexo",
    fileGuidance:
      "Anexe a evidência da ação. Não anexe arquivos com dados de paciente: ações não são um módulo de dados de paciente.",
    emptyWritable: "Nenhum anexo.",
    emptyReadOnly: "Nenhum anexo.",
    titlePlaceholder: "Ex.: Evidência da ação concluída",
  },
};

/** Resolve a `kind` slug to its pt-BR badge label; unknown slugs fall back to the
 * raw value rather than disappearing (the DB stores `kind` as unchecked text, so
 * a row minted outside the product surface must still render). */
export function kindLabel(kind: string | null): string | null {
  if (!kind) return null;
  return DOCUMENT_KIND_LABEL[kind] ?? kind;
}

// ---------------------------------------------------------------------------
// Errors — pt-BR wording for the contract's machine-readable codes
// ---------------------------------------------------------------------------

/**
 * Last-resort pt-BR message. Raw Supabase/Postgres text must never reach the UI
 * (CLAUDE.md §8), so anything not in {@link DOCUMENT_ERROR_MESSAGE} renders this.
 */
export const DOCUMENT_ERROR_FALLBACK =
  "Não foi possível concluir a operação. Tente novamente em instantes.";

/**
 * pt-BR wording for every `DocumentActionErrorCode`.
 *
 * The contract maps SQLSTATEs to these codes on CODE ALONE, never message text;
 * the wording stays here per Rule 10. Two of these are the reason the mapping was
 * asked for: `confidentiality_home_rejected` is the HC0D6 backstop behind the
 * enforcing-label picker filter (the picker should make it unreachable, but the DB
 * is the authority, so the message must exist and be testable), and
 * `upload_incomplete` is the retry path — the session stays usable, so the copy
 * says "tente enviar novamente", not "comece de novo".
 */
export const DOCUMENT_ERROR_MESSAGE: Record<DocumentActionErrorCode, string> = {
  module_disabled: "O envio de documentos ainda não está disponível.",
  not_found: "Documento não encontrado.",
  forbidden: "Você não tem autorização para esta ação.",
  confidentiality_home_rejected:
    "Este nível de sigilo só pode ser aplicado a documentos de caso ou de entrevista.",
  under_legal_hold:
    "Este documento está sob retenção legal e não pode ser removido.",
  upload_expired:
    "O tempo para enviar o arquivo expirou. Feche e comece o envio novamente.",
  upload_incomplete:
    "O arquivo não chegou por completo. Tente enviar novamente.",
  file_too_large: "O arquivo excede o tamanho máximo de 25 MB.",
  file_type_not_allowed: "Este tipo de arquivo não é aceito.",
  invalid_input: "Verifique os dados informados e tente novamente.",
  unavailable: "Este documento não está disponível para abertura no momento.",
  disposed: "O arquivo foi eliminado definitivamente e não pode mais ser aberto.",
  retention_blocked:
    "A política de retenção deste documento ainda não permite a eliminação.",
  unknown: DOCUMENT_ERROR_FALLBACK,
};

/** pt-BR message for an action failure — never renders a raw server string. */
export function documentErrorMessage(code: DocumentActionErrorCode): string {
  return DOCUMENT_ERROR_MESSAGE[code] ?? DOCUMENT_ERROR_FALLBACK;
}

/** pt-BR upload/size hint shown under the file picker. Derived from the contract
 * cap so the stated limit cannot drift from the enforced one. */
export const DOCUMENT_FILE_HINT = `PDF, imagem, Word, Excel, PowerPoint, CSV ou texto, até ${Math.round(
  DOCUMENT_MAX_SIZE_BYTES / (1024 * 1024),
)} MB.`;
