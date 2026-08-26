import type { AffiliationStatus } from "@/lib/users/types";
import { StatusPill } from "@/components/users/profile-cards";

/**
 * The three-tense affiliation status (ADR 0151 D6/D7), rendered once so no consumer
 * re-derives the precedence rule.
 *
 * F2 (the per-user affiliations panel) is the first consumer. F6's directory row picks
 * this up unchanged the moment `OrgUserListItem`/`OrgUserPage` gain an org-affiliation
 * status field from backend's B6b — this component does not need to change for that,
 * only its call site does.
 */

const LABEL: Record<AffiliationStatus, string> = {
  ativo: "Ativo",
  encerrado: "Encerrado",
  anulado: "Anulado",
};

const TONE: Record<AffiliationStatus, "success" | "muted" | "destructive"> = {
  ativo: "success",
  encerrado: "muted",
  anulado: "destructive",
};

/**
 * Derive the rendered status from the raw tense fields.
 *
 * ⛔ VOID TAKES PRECEDENCE (D7). A row may be both ended and voided; the badge shows
 * only the more severe of the two, never both.
 *
 * `!= null`, not `!== null` — mirrors the established convention in
 * `affiliations-panel.tsx`: a value built anywhere that omits the key arrives
 * `undefined`, and `undefined !== null` would misclassify it.
 */
export function affiliationStatusOf(a: {
  endedOn: string | null;
  voidedAt: string | null;
}): AffiliationStatus {
  if (a.voidedAt != null) return "anulado";
  if (a.endedOn != null) return "encerrado";
  return "ativo";
}

export function AffiliationStatusBadge({
  status,
  uppercase = true,
}: {
  status: AffiliationStatus;
  uppercase?: boolean;
}) {
  return (
    <StatusPill tone={TONE[status]} uppercase={uppercase}>
      {LABEL[status]}
    </StatusPill>
  );
}
