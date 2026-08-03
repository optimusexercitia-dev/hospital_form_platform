/**
 * Case Correction Lifecycle — pt-BR labels + pure view helpers (ADR 0085).
 *
 * A PURE module (no server-only imports) shared by the file dialog, the request
 * panel, the phase article and the narrative card, so client components import the
 * labels + derivations without dragging `next/headers` into the bundle (the
 * design-system client/server boundary rule). The domain types are imported
 * TYPE-ONLY from the server-only query module (`@/lib/queries/corrections`), which
 * never reaches the client bundle.
 *
 * pt-BR labels (Rule 10); the descriptive `classification` is never a gate — it
 * only tells the approver what KIND of change to expect when reviewing the diff.
 */

import {
  Ban,
  CheckCircle2,
  CircleSlash,
  Clock,
  Eye,
  FilePlus2,
  PenLine,
  PencilLine,
  Send,
  Undo2,
} from "lucide-react";

import type { Json } from "@/lib/types/database";
import type {
  CorrectionClassification,
  CorrectionKind,
  CorrectionRequest,
  CorrectionStatus,
} from "@/lib/queries/corrections";

// ---------------------------------------------------------------------------
// Capability descriptor (threaded from the host page → detail → rows)
// ---------------------------------------------------------------------------

/**
 * The viewer's correction capabilities for ONE case, resolved server-side and
 * threaded down. A CAPABILITY signal, NOT the security boundary (RLS + the DEFINER
 * doors are — Rule 1).
 *
 *  - `enabled`    — the `case_corrections` flag is on (the whole surface is gated).
 *  - `canFile`    — the viewer may OPEN a request: `enabled` AND the case is OPEN
 *                   (a completed target on a closed case must reopen the case
 *                   first). Filing itself is open to any case-content reader.
 *  - `canApprove` — the viewer may APPROVE / REJECT / move to review: `staff_admin`
 *                   /admin only (mirrors `canManageLifecycle`).
 *  - `viewerId`   — the current viewer's user id (for the corrector-slot checks).
 */
export interface CorrectionCaps {
  enabled: boolean;
  canFile: boolean;
  canApprove: boolean;
  viewerId: string | null;
}

// ---------------------------------------------------------------------------
// Label + presentation metadata
// ---------------------------------------------------------------------------

interface KindMeta {
  /** Noun label ("Correção"). */
  label: string;
  /** Verb-phrase menu label ("Solicitar correção"). */
  action: string;
  icon: typeof CheckCircle2;
  className: string;
}

/** What a request does to its target. `void` = "Anulação". */
export const CORRECTION_KIND_META: Record<CorrectionKind, KindMeta> = {
  correction: {
    label: "Correção",
    action: "Solicitar correção",
    icon: PencilLine,
    className: "bg-accent text-accent-foreground",
  },
  addendum: {
    label: "Adendo",
    action: "Solicitar adendo",
    icon: FilePlus2,
    className: "bg-primary/10 text-primary dark:bg-primary/15",
  },
  void: {
    label: "Anulação",
    action: "Solicitar anulação",
    icon: Ban,
    className: "bg-destructive/10 text-destructive",
  },
};

interface StatusMeta {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
}

/**
 * The workflow state. `rejected` is a RESTING state (the corrector's next edit
 * flips it back to `in_progress`); `approved` / `withdrawn` are terminal. Conveys
 * state by ICON + TEXT + SHAPE (never colour alone — a11y).
 */
export const CORRECTION_STATUS_META: Record<CorrectionStatus, StatusMeta> = {
  requested: {
    label: "Solicitada",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "Em edição",
    icon: PenLine,
    className: "bg-warning/15 text-warning",
  },
  resubmitted: {
    label: "Reenviada",
    icon: Send,
    className: "bg-accent text-accent-foreground",
  },
  under_review: {
    label: "Em revisão",
    icon: Eye,
    className: "bg-accent text-accent-foreground",
  },
  rejected: {
    label: "Reprovada",
    icon: Undo2,
    className: "bg-destructive/10 text-destructive",
  },
  approved: {
    label: "Aprovada",
    icon: CheckCircle2,
    className: "bg-success/12 text-success dark:bg-success/15",
  },
  withdrawn: {
    label: "Retirada",
    icon: CircleSlash,
    className: "bg-muted/60 text-muted-foreground/80",
  },
};

/** The descriptive classification (pt-BR). Never gates — advisory to the approver. */
export const CORRECTION_CLASSIFICATION_META: Record<
  CorrectionClassification,
  { label: string; hint: string }
> = {
  clerical: {
    label: "Correção material",
    hint: "Erro de digitação ou formatação, sem mudança de conteúdo.",
  },
  factual: {
    label: "Correção factual",
    hint: "Um dado registrado estava incorreto.",
  },
  interpretative: {
    label: "Reinterpretação",
    hint: "Nova leitura dos mesmos fatos.",
  },
  substantive: {
    label: "Alteração substantiva",
    hint: "Mudança relevante de conteúdo ou conclusão.",
  },
  compliance_related: {
    label: "Conformidade regulatória",
    hint: "Ajuste exigido por norma ou auditoria.",
  },
};

/** The three kinds in menu order. */
export const CORRECTION_KINDS: readonly CorrectionKind[] = [
  "correction",
  "addendum",
  "void",
] as const;

/** The five classifications in picker order. */
export const CORRECTION_CLASSIFICATIONS: readonly CorrectionClassification[] = [
  "clerical",
  "factual",
  "interpretative",
  "substantive",
  "compliance_related",
] as const;

// ---------------------------------------------------------------------------
// Pure view derivations
// ---------------------------------------------------------------------------

/** The non-terminal ("open slot") statuses — one per target at a time. */
const OPEN_STATUSES: ReadonlySet<CorrectionStatus> = new Set<CorrectionStatus>([
  "requested",
  "in_progress",
  "resubmitted",
  "under_review",
  "rejected",
]);

/** Whether a request still occupies its target's open slot. */
export function isOpenCorrection(status: CorrectionStatus): boolean {
  return OPEN_STATUSES.has(status);
}

/** The OPEN request targeting a phase, or `null`. */
export function findOpenRequestForPhase(
  requests: CorrectionRequest[],
  phaseId: string,
): CorrectionRequest | null {
  return (
    requests.find(
      (r) => r.casePhaseId === phaseId && isOpenCorrection(r.status),
    ) ?? null
  );
}

/** The OPEN request targeting a narrative, or `null`. */
export function findOpenRequestForNarrative(
  requests: CorrectionRequest[],
  narrativeId: string,
): CorrectionRequest | null {
  return (
    requests.find(
      (r) => r.caseNarrativeId === narrativeId && isOpenCorrection(r.status),
    ) ?? null
  );
}

/**
 * EVERY request targeting a phase — open and terminal alike, preserving the caller's
 * order (newest-first from the query). Feeds the per-card
 * {@link import('./case-corrections-panel').CaseCorrectionsList} at the bottom of the
 * phase article, which replaced the case-wide cockpit card.
 */
export function requestsForPhase(
  requests: CorrectionRequest[],
  phaseId: string,
): CorrectionRequest[] {
  return requests.filter((r) => r.casePhaseId === phaseId);
}

/** EVERY request targeting a narrative (see {@link requestsForPhase}). */
export function requestsForNarrative(
  requests: CorrectionRequest[],
  narrativeId: string,
): CorrectionRequest[] {
  return requests.filter((r) => r.caseNarrativeId === narrativeId);
}

/**
 * Whether the viewer may CONTINUE editing a draft-bearing (correction/addendum)
 * request now: they hold the corrector slot and the request is in a resting/editing
 * state (`requested` → create the draft; `in_progress`/`rejected` → resume). A
 * `void` request has no draft, and `resubmitted`/`under_review` await the approver.
 */
export function canContinueCorrection(
  request: CorrectionRequest,
  viewerId: string | null,
): boolean {
  if (request.kind === "void") return false;
  if (viewerId == null || request.permittedCorrector !== viewerId) return false;
  return (
    request.status === "requested" ||
    request.status === "in_progress" ||
    request.status === "rejected"
  );
}

/**
 * Whether the viewer may WITHDRAW the request now: the requester, the corrector, or
 * an approver (admin/staff_admin), and only from `requested` / `in_progress` /
 * `rejected` (a `resubmitted` request must be rejected first — HC0M7).
 */
export function canWithdrawCorrection(
  request: CorrectionRequest,
  viewerId: string | null,
  canApprove: boolean,
): boolean {
  const isOwner =
    viewerId != null &&
    (request.requestedBy === viewerId ||
      request.permittedCorrector === viewerId);
  if (!isOwner && !canApprove) return false;
  return (
    request.status === "requested" ||
    request.status === "in_progress" ||
    request.status === "rejected"
  );
}

/** Whether an approver may act (approve/reject) on the request right now. */
export function canDecideCorrection(request: CorrectionRequest): boolean {
  // `void` is decided directly from `requested`; draft kinds once `resubmitted`
  // or moved to `under_review`.
  if (request.kind === "void") return request.status === "requested";
  return request.status === "resubmitted" || request.status === "under_review";
}

// ---------------------------------------------------------------------------
// impact_snapshot rendering
// ---------------------------------------------------------------------------

/** One downstream phase captured in an approved request's `impact_snapshot`. */
export interface ImpactPhase {
  position: number | null;
  title: string | null;
  status: string;
}

/**
 * Defensively parse the approved request's `impact_snapshot` jsonb — a
 * `[{ id, position, title, status, result_id }]` array of downstream phases that
 * were already `active`/`completed` at approval (see `approve_correction`). Returns
 * `[]` for a null/empty/unexpected payload so a display never throws.
 */
export function describeImpactSnapshot(snapshot: Json | null): ImpactPhase[] {
  if (!Array.isArray(snapshot)) return [];
  const out: ImpactPhase[] = [];
  for (const entry of snapshot) {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const position =
      typeof row.position === "number" ? row.position : null;
    const title = typeof row.title === "string" ? row.title : null;
    const status = typeof row.status === "string" ? row.status : "";
    out.push({ position, title, status });
  }
  return out;
}

/** pt-BR label for a downstream phase status inside the impact snapshot. */
export function impactPhaseStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "ativa";
    case "completed":
      return "concluída";
    default:
      return status;
  }
}
