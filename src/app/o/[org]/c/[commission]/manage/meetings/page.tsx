import { notFound, redirect } from "next/navigation";

import { commissionHref } from "@/lib/routing";
import { meetingsEnabled } from "@/lib/meetings/actions";

/**
 * Legacy meetings-settings route. The meeting-type vocabulary + quorum rule moved
 * into the Configurações hub as a "Reuniões" tab (F8); this route now redirects
 * there as a safety net for old bookmarks/links. Nav links point DIRECTLY at the
 * new location.
 *
 * Preserves the `meetings`-flag gate (404 when off) before redirecting; the
 * destination page enforces the coordinator (staff_admin) gate itself.
 */
export default async function LegacyMeetingsSettingsPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;

  if (!(await meetingsEnabled())) {
    notFound();
  }

  redirect(commissionHref(org, commission, "manage", "settings", "reunioes"));
}
