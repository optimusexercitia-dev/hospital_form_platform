import { Sliders, Tags } from "lucide-react";

import type {
  CommissionMeetingSettings,
  CommissionMeetingType,
} from "@/lib/queries/meetings";
import { MeetingTypeManager } from "./meeting-type-manager";
import { QuorumSettingsForm } from "./quorum-settings-form";

/**
 * Meetings settings view (F5, staff_admin): the per-commission meeting-type
 * vocabulary (create / rename / recolour / archive) and the quorum rule editor.
 * Server-Component shell composing the client islands. Mirrors the cases tag +
 * outcome settings UI. The actions are themselves staff_admin-gated (RLS is the
 * authority).
 */
export function MeetingSettingsView({
  commissionId,
  meetingTypes,
  settings,
}: {
  commissionId: string;
  meetingTypes: CommissionMeetingType[];
  settings: CommissionMeetingSettings | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* Meeting types */}
      <section
        aria-labelledby="meeting-types-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Tags aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="meeting-types-heading" className="text-base font-semibold">
            Tipos de reunião
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {meetingTypes.length}
          </span>
        </div>

        <MeetingTypeManager
          commissionId={commissionId}
          types={meetingTypes}
        />
      </section>

      {/* Quorum rule */}
      <section
        aria-labelledby="meeting-quorum-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Sliders aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="meeting-quorum-heading" className="text-base font-semibold">
            Regra de quórum
          </h2>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Define como o quórum é calculado ao concluir uma reunião. A regra e os
          valores são registrados (snapshot) na conclusão, preservando o
          histórico.
        </p>

        <QuorumSettingsForm commissionId={commissionId} settings={settings} />
      </section>
    </div>
  );
}
