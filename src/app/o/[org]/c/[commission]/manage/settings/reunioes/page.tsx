import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getMeetingSettings, listMeetingTypes } from "@/lib/queries/meetings";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { phaseResultsEnabled } from "@/lib/queries/phase-results";
import { SettingsTabs } from "@/components/cases/settings-tabs";
import { MeetingSettingsView } from "@/components/meetings/meeting-settings-view";

export const metadata: Metadata = {
  title: "Configurações de reuniões",
};

/**
 * Meetings settings, now a tab of the commission Configurações hub (F8) — the
 * per-commission meeting-type vocabulary + the quorum rule. Moved here from the
 * standalone `/manage/meetings` route (which now redirects here). Coordinator-gated
 * (mirrors the sibling settings pages); the CRUD actions are themselves
 * staff_admin-gated (RLS is the authority).
 *
 * Gated behind the `meetings` flag (404 when off) — both this route AND the tab
 * that links to it.
 */
export default async function MeetingsSettingsTabPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;

  // The flag check doesn't depend on `access`, so run them concurrently.
  const [meetingsOn, access, phaseResultsOn] = await Promise.all([
    meetingsEnabled(),
    getCommissionAccessByOrg(org, commission),
    phaseResultsEnabled(),
  ]);

  if (!meetingsOn) {
    notFound();
  }
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const [meetingTypes, settings] = await Promise.all([
    listMeetingTypes(access.commission.id),
    getMeetingSettings(access.commission.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Configurações</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Gerencie os tipos de reunião e a regra de quórum usados nas reuniões
          desta comissão.
        </p>
      </header>

      <SettingsTabs
        org={org} slug={slug}
        phaseResultsEnabled={phaseResultsOn}
        meetingsEnabled={meetingsOn}
      />

      <MeetingSettingsView
        commissionId={access.commission.id}
        meetingTypes={meetingTypes}
        settings={settings}
      />
    </div>
  );
}
