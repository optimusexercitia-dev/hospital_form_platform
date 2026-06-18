"use client";

import type { EventType } from "@/lib/safety/triage-types";
import {
  archiveEventType,
  createEventType,
  reorderEventTypes,
  updateEventType,
} from "@/lib/safety/triage-actions";
import { VocabManager } from "./vocab-manager";

/**
 * Event-type vocabulary manager — binds {@link VocabManager} to the event-type
 * CRUD actions. The list (incl. inactive) is loaded by the config Server page.
 */
export function EventTypeManager({ eventTypes }: { eventTypes: EventType[] }) {
  return (
    <VocabManager
      kind="eventType"
      entries={eventTypes}
      actions={{
        create: createEventType,
        update: updateEventType,
        reorder: reorderEventTypes,
        archive: archiveEventType,
      }}
    />
  );
}
