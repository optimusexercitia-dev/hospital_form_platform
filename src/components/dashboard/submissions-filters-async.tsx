import {
  listSubmissionFilterMembers,
  listSubmissionFilterForms,
} from "@/lib/queries/submissions";

import { SubmissionsFilters } from "./submissions-filters";

/**
 * Suspense boundary for {@link SubmissionsFilters}: the member/form dropdown
 * population is a secondary read that must not block the submissions list's
 * first paint (frontend-audit-2026-07 #2). Owns both awaits (run in
 * parallel — mutually independent) so the page can stream this bar
 * independently of the primary row list.
 */
export async function SubmissionsFiltersAsync({
  commissionId,
  member,
  form,
  from,
  to,
  includeInProgress,
}: {
  commissionId: string;
  member: string | null;
  form: string | null;
  from: string | null;
  to: string | null;
  includeInProgress: boolean;
}) {
  const [members, forms] = await Promise.all([
    listSubmissionFilterMembers(commissionId),
    listSubmissionFilterForms(commissionId),
  ]);

  return (
    <SubmissionsFilters
      members={members}
      forms={forms}
      member={member}
      form={form}
      from={from}
      to={to}
      includeInProgress={includeInProgress}
    />
  );
}
