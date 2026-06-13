import type {
  ResponseForSignoff,
  SignoffRecord,
} from "@/lib/queries/signoffs";

import type { ClientResponseForSignoff, SectionSignoff } from "./types";

export type { ClientResponseForSignoff } from "./types";

/**
 * Adapters from B2's server query types (`src/lib/queries/signoffs.ts`) to the
 * client prop shapes the sign-off UI renders against. Called only from the
 * server route pages (the client tree never imports `src/lib/queries/*`). This
 * is the single place that absorbs the B2 contract: `SignoffRecord[]` →
 * `signoffsBySectionId`, nullable display names → pt-BR fallbacks.
 */

/** Default display name when a profile's `full_name` is null. */
const UNKNOWN_SIGNER = "Usuário";

/** Map one B2 `SignoffRecord` to the F4 badge's `SectionSignoff` shape. */
export function toSectionSignoff(record: SignoffRecord): SectionSignoff {
  return {
    sectionId: record.sectionId,
    signedByName: record.signedByName ?? UNKNOWN_SIGNER,
    signedAt: record.signedAt,
    note: record.note,
  };
}

/** Reduce a `SignoffRecord[]` to a `section_id → SectionSignoff` map. */
export function signoffRecordsToMap(
  records: SignoffRecord[],
): Record<string, SectionSignoff> {
  const map: Record<string, SectionSignoff> = {};
  for (const record of records) {
    map[record.sectionId] = toSectionSignoff(record);
  }
  return map;
}

/** Adapt B2's `ResponseForSignoff` to the review-and-sign screen's props. */
export function toClientResponseForSignoff(
  data: ResponseForSignoff,
): ClientResponseForSignoff {
  return {
    responseId: data.responseId,
    formId: data.formId,
    commissionId: data.commissionId,
    formTitle: data.formTitle,
    respondentName: data.respondentName ?? "Responsável",
    startedAt: data.startedAt,
    updatedAt: data.updatedAt,
    tree: data.tree,
    answersByItemId: data.answersByItemId,
    signoffsBySectionId: signoffRecordsToMap(data.signoffs),
  };
}
