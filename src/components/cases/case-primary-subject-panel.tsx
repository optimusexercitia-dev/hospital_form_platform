import { UserRound } from "lucide-react";

import type { CaseParticipant } from "@/lib/queries/cases";

/**
 * The case's PRIMARY-SUBJECT rail card (ETH·E3a; ADR 0064 D4). For a
 * non-patient-subject case type — e.g. an Ethics case whose
 * `primary_subject_kind = 'professional'` — the patient panel is omitted and this
 * card takes its place, labeled with the case type's terminology
 * (`terminology.primarySubject.singular` → "Médico denunciado") and showing the
 * primary-subject participant's org-scoped display label + role.
 *
 * Read-only + presentational (Server-Component-safe). `displayName` is the
 * registry SURROGATE label, never raw patient identity (Rule 12) — and for a
 * professional it is the case-scoped Class-2 identity a case reader may see. The
 * full participants roster (add/remove/set-role) is a separate, larger surface,
 * not built here.
 */
export function CasePrimarySubjectPanel({
  label,
  subject,
}: {
  /** The case-type primary-subject term (e.g. "Médico denunciado"). */
  label: string;
  /** The case's primary-subject participant, or `null` when none is set yet. */
  subject: CaseParticipant | null;
}) {
  return (
    <section
      aria-labelledby="case-primary-subject-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <UserRound aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2
          id="case-primary-subject-heading"
          className="text-base font-semibold"
        >
          {label}
        </h2>
      </div>

      {subject ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">
            {subject.displayName || "Sem identificação"}
          </p>
          {subject.roleLabel && (
            <p className="text-xs text-muted-foreground">{subject.roleLabel}</p>
          )}
          {subject.involvementSummary && (
            <p className="mt-1 text-sm text-foreground/90 text-pretty whitespace-pre-wrap">
              {subject.involvementSummary}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground text-pretty">
          Ainda não há {label.toLowerCase()} registrado neste caso.
        </p>
      )}
    </section>
  );
}
