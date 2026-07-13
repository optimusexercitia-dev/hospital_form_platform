import { notFound } from "next/navigation";
import { CalendarClock, ClipboardCheck, UserRound } from "lucide-react";

import { notificationsEnabled } from "@/lib/queries/feature-flags";
import { listMyAssignedCapaActions } from "@/lib/queries/capa";
import type { CapaActionStatus } from "@/lib/safety/capa-types";
import {
  CapaActionStatusChip,
  CapaStrengthPill,
} from "@/components/safety/capa/capa-badges";
import { formatDate } from "@/components/safety/format";
import { MyCapaActionControls } from "@/components/notifications/my-capa-action-controls";
import { cn } from "@/lib/utils";

/** Local date as `YYYY-MM-DD` for a lexical, timezone-safe overdue comparison. */
function localTodayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** An action past its due date that is still actionable (not terminal). */
function isOverdue(
  dueDate: string | null,
  status: CapaActionStatus,
  today: string,
): boolean {
  if (!dueDate) return false;
  if (status === "completed" || status === "cancelled") return false;
  return dueDate.slice(0, 10) < today;
}

/**
 * S1·N BUG-N-001 (ADR 0076) — "Ações de CAPA" personal surface. The deep-link
 * target for `capa/assigned` notifications: a non-gated page where any assignee
 * (PQS or not) sees and advances their assigned corrective actions, without the
 * PQS-gated CAPA workspace.
 *
 * Flag-gated like the sibling `/conta/notificacoes`: `notFound()` when the
 * `notifications` flag is off (an N-increment surface — flag-OFF preserves the
 * pre-N route map). The list is self-scoped to the caller (assignee = me) and
 * PHI-free by construction (the `list_my_assigned_capa_actions` DEFINER RPC
 * returns config-level columns only; Rule 12), ordered soonest-due-first.
 */
export default async function MyCapaActionsPage() {
  const enabled = await notificationsEnabled();
  if (!enabled) {
    notFound();
  }

  const actions = await listMyAssignedCapaActions();
  const today = localTodayYmd();

  return (
    <section aria-labelledby="capa-actions-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1
          id="capa-actions-title"
          className="font-display text-2xl font-semibold tracking-tight text-balance"
        >
          Ações de CAPA
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Ações corretivas atribuídas a você. Acompanhe cada uma e avance quando
          concluir a sua parte.
        </p>
      </div>

      {actions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
          <ClipboardCheck
            aria-hidden="true"
            className="size-7 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            Você não tem ações de CAPA atribuídas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {actions.map((action, index) => {
            const overdue = isOverdue(action.dueDate, action.status, today);
            return (
              <li
                key={action.id}
                className="animate-rise-in"
                style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
              >
                <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="min-w-0 flex-1 text-base leading-snug font-medium text-pretty">
                      {action.title}
                    </h2>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <CapaStrengthPill strength={action.actionStrength} />
                      <CapaActionStatusChip status={action.status} />
                    </div>
                  </div>

                  <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    {action.owner ? (
                      <div className="inline-flex items-center gap-1.5">
                        <dt className="sr-only">Responsável</dt>
                        <UserRound aria-hidden="true" className="size-4" />
                        <dd>{action.owner}</dd>
                      </div>
                    ) : null}
                    {action.dueDate ? (
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 tabular-nums",
                          overdue && "font-medium text-destructive",
                        )}
                      >
                        <dt className="sr-only">Prazo</dt>
                        <CalendarClock aria-hidden="true" className="size-4" />
                        <dd>
                          {formatDate(action.dueDate)}
                          {overdue ? " · Atrasada" : ""}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <MyCapaActionControls
                    actionId={action.id}
                    status={action.status}
                  />
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
