import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listMeetings, listMeetingTypes } from "@/lib/queries/meetings";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { MeetingsList } from "@/components/meetings/meetings-list";
import { NewMeetingButton } from "@/components/meetings/meeting-form-dialog";

export const metadata: Metadata = {
  title: "Reuniões",
};

/**
 * Per-commission meetings registry (F0): upcoming vs. past, filterable by status
 * and type. Every member of the commission reads the list (RLS-scoped); only
 * staff_admins see the "Nova reunião" action and author.
 *
 * Gated behind the `meetings` feature flag — when off, the route 404s (the nav
 * item is hidden too). A non-member of the commission already gets `notFound()`
 * from `getCommissionAccessByOrg`.
 */
export default async function MeetingsListPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;

  if (!(await meetingsEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) {
    notFound();
  }

  const isCoordinator =
    access.role === "staff_admin";

  const [meetings, meetingTypes] = await Promise.all([
    listMeetings(access.commission.id),
    listMeetingTypes(access.commission.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Reuniões</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Agende reuniões, registre atas, presenças e quórum, vincule casos e
            colete assinaturas eletrônicas. Nunca registre dados de paciente.
          </p>
        </div>
        {isCoordinator && (
          <NewMeetingButton
            org={org}
            slug={slug}
            commissionId={access.commission.id}
            meetingTypes={meetingTypes}
          />
        )}
      </header>

      {meetings.length === 0 ? (
        <section
          aria-label="Nenhuma reunião"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhuma reunião ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            {isCoordinator
              ? "Agende a primeira reunião desta comissão para começar a registrar atas e presenças."
              : "Quando a coordenação agendar reuniões, elas aparecerão aqui."}
          </p>
          {isCoordinator && (
            <div className="mt-2">
              <NewMeetingButton
                org={org}
                slug={slug}
                commissionId={access.commission.id}
                meetingTypes={meetingTypes}
              />
            </div>
          )}
        </section>
      ) : (
        <MeetingsList
          meetings={meetings}
          meetingTypes={meetingTypes}
          org={org}
          slug={slug}
        />
      )}
    </div>
  );
}
