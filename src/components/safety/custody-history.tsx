import { ArrowLeftRight } from "lucide-react";

import {
  OWNER_KIND_LABELS,
  type EventCustodyEntry,
} from "@/lib/safety/types";
import { formatDateTime } from "./format";

/**
 * The append-only custody ledger (F3) on the event detail: the hand-off history,
 * oldest-first. Each row names the holder (NSP or a commission), the window it
 * held the event (`heldFrom` → `heldUntil`, the current holder open-ended), who
 * assigned it, and the transfer note. Read-only — the ledger is append-only
 * (no UPDATE/DELETE); transfers happen through the lifecycle action, not here.
 */
export function CustodyHistory({ entries }: { entries: EventCustodyEntry[] }) {
  return (
    <section
      aria-labelledby="custody-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <ArrowLeftRight
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <h2 id="custody-heading" className="text-base font-semibold">
          Histórico de custódia
        </h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum registro de custódia.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => {
            const holder =
              entry.ownerKind === "commission" && entry.ownerCommissionName
                ? entry.ownerCommissionName
                : OWNER_KIND_LABELS[entry.ownerKind];
            const isCurrent = entry.heldUntil === null;
            return (
              <li
                key={entry.id}
                className="relative flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-3"
              >
                <span
                  aria-hidden="true"
                  className={
                    "mt-1 size-2 shrink-0 rounded-full " +
                    (isCurrent ? "bg-primary" : "bg-muted-foreground/40")
                  }
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {holder}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[0.65rem] font-medium text-accent-foreground">
                        Custódia atual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    De {formatDateTime(entry.heldFrom)}
                    {entry.heldUntil
                      ? ` até ${formatDateTime(entry.heldUntil)}`
                      : " · em curso"}
                    {entry.assignedByName ? ` · ${entry.assignedByName}` : ""}
                  </p>
                  {entry.note && (
                    <p className="text-sm text-foreground/90 text-pretty">
                      {entry.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
