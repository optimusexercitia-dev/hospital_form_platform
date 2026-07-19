import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftRight, CalendarClock, FolderOpen } from "lucide-react";

import {
  listMyReferralAssignments,
  referralsEnabled,
  REFERRAL_ASSIGNMENT_ROLE_LABELS,
  REFERRAL_ASSIGNMENT_STATUS_LABELS,
  REFERRAL_ASSIGNMENT_STATUS_TOKENS,
} from "@/lib/queries/referrals";
import type { ReferralAssignmentStatus } from "@/lib/referrals/types";
import { cn } from "@/lib/utils";
import {
  ReferralPriorityChip,
  ReferralStatusChip,
} from "@/components/referrals/referral-chips";
import {
  formatDateTime,
  formatReferralCode,
  referralStatusChipClass,
} from "@/components/referrals/format";

export const metadata: Metadata = {
  title: "Minhas atribuições de encaminhamento",
};

/** Whether an assignment's own due date is past while it is still actionable. */
function isAssignmentOverdue(
  dueAt: string | null,
  status: ReferralAssignmentStatus,
): boolean {
  if (!dueAt) return false;
  if (status === "completed" || status === "cancelled") return false;
  const ms = Date.parse(dueAt);
  if (Number.isNaN(ms)) return false;
  return ms < Date.now();
}

/**
 * The caller's own referral assignments (RV2 R4) — the "Minhas atribuições de
 * encaminhamento" personal surface. A self-scoped task list: PHI-FREE by
 * construction (the `list_my_referral_assignments` door joins only referral pointer
 * metadata — code, subject, status, priority, due — never a body or patient
 * identifier). Rendered inside the global `/conta` shell.
 *
 * Flag-gated (`case_referrals`) → 404 when off. Read-only: the assignment lifecycle
 * is driven from the referral detail's responsibility panel (the assigning
 * coordinator's surface); this list is the assignee's at-a-glance view of what they
 * are responsible for across every referral.
 */
export default async function MyReferralAssignmentsPage() {
  if (!(await referralsEnabled())) {
    notFound();
  }

  const assignments = await listMyReferralAssignments();

  return (
    <section
      aria-labelledby="my-referral-assignments-title"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1.5">
        <h1
          id="my-referral-assignments-title"
          className="font-display text-2xl font-semibold tracking-tight text-balance"
        >
          Minhas atribuições de encaminhamento
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Encaminhamentos entre comissões pelos quais você é responsável.
          Acompanhe o papel, o estado e o prazo de cada atribuição.
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
          <ArrowLeftRight
            aria-hidden="true"
            className="size-7 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            Você não tem atribuições de encaminhamento.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {assignments.map((a, index) => {
            const overdue = isAssignmentOverdue(a.dueAt, a.status);
            return (
              <li
                key={a.id}
                className="animate-rise-in"
                style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
              >
                <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatReferralCode(a.referralCode)}
                      </span>
                      <h2 className="text-base leading-snug font-medium text-pretty">
                        {a.referralSubject}
                      </h2>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        referralStatusChipClass(
                          REFERRAL_ASSIGNMENT_STATUS_TOKENS[a.status],
                        ),
                      )}
                    >
                      {REFERRAL_ASSIGNMENT_STATUS_LABELS[a.status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ReferralStatusChip status={a.referralStatus} />
                    {a.referralPriority !== "routine" && (
                      <ReferralPriorityChip priority={a.referralPriority} />
                    )}
                  </div>

                  <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-1.5">
                      <dt className="sr-only">Papel</dt>
                      <FolderOpen aria-hidden="true" className="size-4" />
                      <dd>{REFERRAL_ASSIGNMENT_ROLE_LABELS[a.assignmentRole]}</dd>
                    </div>
                    {a.dueAt && (
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 tabular-nums",
                          overdue && "font-medium text-destructive",
                        )}
                      >
                        <dt className="sr-only">Prazo</dt>
                        <CalendarClock aria-hidden="true" className="size-4" />
                        <dd>
                          {formatDateTime(a.dueAt)}
                          {overdue ? " · atrasada" : ""}
                        </dd>
                      </div>
                    )}
                  </dl>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
