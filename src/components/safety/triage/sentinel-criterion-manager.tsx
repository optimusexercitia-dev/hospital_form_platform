"use client";

import type { SentinelCriterion } from "@/lib/safety/triage-types";
import {
  archiveSentinelCriterion,
  createSentinelCriterion,
  reorderSentinelCriteria,
  updateSentinelCriterion,
} from "@/lib/safety/triage-actions";
import { VocabManager } from "./vocab-manager";

/**
 * Sentinel-criterion checklist manager — binds {@link VocabManager} to the
 * sentinel-criterion CRUD actions. The list (incl. inactive) is loaded by the
 * config Server page; any active criterion auto-qualifies an event as sentinel.
 */
export function SentinelCriterionManager({
  criteria,
}: {
  criteria: SentinelCriterion[];
}) {
  return (
    <VocabManager
      kind="criterion"
      entries={criteria}
      actions={{
        create: createSentinelCriterion,
        update: updateSentinelCriterion,
        reorder: reorderSentinelCriteria,
        archive: archiveSentinelCriterion,
      }}
    />
  );
}
