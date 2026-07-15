"use client";

import { useCallback, useState } from "react";

import {
  loadActionItemSatellites,
  type ActionItemSatelliteData,
} from "./satellite-loader";
import { ActionItemSatelliteSections } from "./action-item-satellites";

/**
 * The PAGE-level satellite surface: reminders / updates / checklist for one
 * action item, always visible.
 *
 * The sibling {@link ActionItemSatellites} exists for ROW hosts, where the
 * satellites are incidental to a list — hence its disclosure + lazy fetch +
 * retry. On the Action Item detail page the satellites ARE the content, so none
 * of that machinery earns its place: the server page already loaded the data and
 * seeds `initialData`, so the sections paint with the first frame — no spinner,
 * no expand click, no error state to design (a failed read is the page's
 * `error.tsx`, not a per-panel retry).
 *
 * It stays a Client Component only because the three sections mutate and need a
 * refresh callback: `onMutated` re-fetches through the same
 * `loadActionItemSatellites` server action, swapping the lists in place without
 * a full route refresh. A refresh failure keeps the current data — the mutation's
 * own error is surfaced by the section that raised it.
 *
 * Capabilities mirror the row hosts (the RPCs are the real boundary; these only
 * avoid showing controls that would always be refused):
 *  - `canManageReminders` — staff_admin/org_admin of the item's commission;
 *  - `canContribute` — the viewer has a stake (assignee or coordinator).
 */
export function ActionItemSatellitesPanel({
  actionItemId,
  itemTitle,
  initialData,
  canManageReminders,
  canContribute,
}: {
  actionItemId: string;
  itemTitle: string;
  /** Server-loaded satellite lists — the panel paints with the first frame. */
  initialData: ActionItemSatelliteData;
  canManageReminders: boolean;
  canContribute: boolean;
}) {
  const [data, setData] = useState<ActionItemSatelliteData>(initialData);

  const refresh = useCallback(async () => {
    try {
      setData(await loadActionItemSatellites(actionItemId));
    } catch {
      // Keep the current data; the section surfaces its own mutation error.
    }
  }, [actionItemId]);

  return (
    <div className="flex flex-col gap-4">
      <ActionItemSatelliteSections
        actionItemId={actionItemId}
        itemTitle={itemTitle}
        data={data}
        canManageReminders={canManageReminders}
        canContribute={canContribute}
        onMutated={refresh}
      />
    </div>
  );
}
