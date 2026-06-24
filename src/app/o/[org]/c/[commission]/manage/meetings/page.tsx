import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getMeetingSettings, listMeetingTypes } from "@/lib/queries/meetings";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { MeetingSettingsView } from "@/components/meetings/meeting-settings-view";

export const metadata: Metadata = {
  title: "Configurações de reuniões",
};

/**
 * Meetings settings (F5, coordinator area): the per-commission meeting-type
 * vocabulary + the quorum rule. Coordinator-gated here (mirrors the cases
 * settings pages); the CRUD actions are themselves staff_admin-gated.
 *
 * Gated behind the `meetings` flag (404 when off).
 */
export default async function MeetingsSettingsPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;

  if (!(await meetingsEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
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
        <h1 className="text-3xl text-balance">Configurações de reuniões</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Gerencie os tipos de reunião e a regra de quórum usados nas reuniões
          desta comissão.
        </p>
      </header>

      <MeetingSettingsView
        commissionId={access.commission.id}
        meetingTypes={meetingTypes}
        settings={settings}
      />
    </div>
  );
}
