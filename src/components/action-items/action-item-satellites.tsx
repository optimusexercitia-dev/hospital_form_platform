"use client";

import type { ActionItemSatelliteData } from "./satellite-loader";
import { ReminderSection } from "./reminder-section";
import { UpdatesSection } from "./updates-section";
import { ChecklistSection } from "./checklist-section";

/**
 * The three satellite sub-panels (reminders / updates / checklist) for one action
 * item, rendered from data the CALLER owns. Purely presentational — it holds no
 * data lifecycle of its own, so the host decides how the data arrives. Its host,
 * `ActionItemSatellitesPanel` (the Action Item DETAIL page), seeds the data
 * server-side and renders these expanded, where the satellites ARE the page
 * content.
 *
 * `onMutated` re-fetches after any section's write.
 */
export function ActionItemSatelliteSections({
  actionItemId,
  itemTitle,
  data,
  canManageReminders,
  canContribute,
  onMutated,
}: {
  actionItemId: string;
  itemTitle: string;
  data: ActionItemSatelliteData;
  canManageReminders: boolean;
  canContribute: boolean;
  onMutated: () => void | Promise<void>;
}) {
  return (
    <>
      <div
        className="animate-rise-in"
        style={{ "--rise-delay": "0ms" } as React.CSSProperties}
      >
        <ReminderSection
          actionItemId={actionItemId}
          itemTitle={itemTitle}
          reminders={data.reminders}
          canManage={canManageReminders}
          onMutated={onMutated}
        />
      </div>
      <div
        className="animate-rise-in"
        style={{ "--rise-delay": "60ms" } as React.CSSProperties}
      >
        <UpdatesSection
          actionItemId={actionItemId}
          updates={data.updates}
          canContribute={canContribute}
          onMutated={onMutated}
        />
      </div>
      <div
        className="animate-rise-in"
        style={{ "--rise-delay": "120ms" } as React.CSSProperties}
      >
        <ChecklistSection
          actionItemId={actionItemId}
          itemTitle={itemTitle}
          checklist={data.checklist}
          canContribute={canContribute}
          onMutated={onMutated}
        />
      </div>
    </>
  );
}
