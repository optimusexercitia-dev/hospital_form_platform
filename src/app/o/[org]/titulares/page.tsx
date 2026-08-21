import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  listDsrRequests,
  listMyDsrHospitals,
  listMyDsrTasks,
} from "@/lib/queries/dsr";
import { DsrConsole } from "@/components/dsr/dsr-console";

export const metadata: Metadata = {
  title: "Direitos do Titular",
};

/**
 * The DSR console — one page, two lanes (ADR 0130 Slice 2).
 *
 * ⭐ WHY BOTH LANES LIVE ON ONE SCREEN. The executor lane is what discharges
 * pilot-gate item 0 (`FUP-ACT-DISPOSE-UI`): before this page there was no surface
 * anywhere from which a persona could both REACH a dispose affordance and PASS
 * its gate — the referral dialog existed, the case/event actions had no caller at
 * all. The Encarregado lane is what makes the work exist. Splitting them into two
 * routes would have doubled the shell for no gain at this slice's size.
 *
 * Adjudication (outcome capture between opening and closing), the patient search
 * door, and the attested-tier task generation are Slice 3. What ships here is the
 * shortest honest corridor: open a request → the fan-out routes disposal work to
 * the people who already hold each door → they execute under their own session →
 * the Encarregado closes with an outcome and its legal basis.
 */
export default async function DsrConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ hospital?: string }>;
}) {
  const [{ org }, sp] = await Promise.all([params, searchParams]);

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", org)
    .maybeSingle<{ id: string }>();
  if (!organization) notFound();

  const hospitals = (await listMyDsrHospitals()).filter(
    (h) => h.orgId === organization.id,
  );
  // The layout already established there is at least one; `?hospital=` selects
  // among them and falls back to the first rather than 404ing on a stale link.
  const hospital =
    hospitals.find((h) => h.hospitalId === sp.hospital) ?? hospitals[0];
  if (!hospital) notFound();

  // Both reads are RLS-scoped. A non-DPO executor gets `[]` requests without an
  // error — the read boundary is the policy, not a branch in this file.
  const [tasks, requests] = await Promise.all([
    listMyDsrTasks(hospital.hospitalId),
    hospital.isDpo ? listDsrRequests(hospital.hospitalId) : Promise.resolve([]),
  ]);

  return (
    <DsrConsole
      org={org}
      hospitals={hospitals}
      selectedHospitalId={hospital.hospitalId}
      isDpo={hospital.isDpo}
      tasks={tasks}
      requests={requests}
    />
  );
}
