"use client";

import { useCallback, useId, useState } from "react";
import { ChevronDown, Loader2, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  loadActionItemSatellites,
  type ActionItemSatelliteData,
} from "./satellite-loader";
import { ReminderSection } from "./reminder-section";
import { UpdatesSection } from "./updates-section";
import { ChecklistSection } from "./checklist-section";

type LoadStatus = "idle" | "loading" | "ready" | "error";

/**
 * The per-item SATELLITE detail surface: a disclosure that reveals the reminder,
 * updates and checklist sub-panels for one action item. Reused by the case and
 * meeting action-item panels (both render items as rows — there is no standalone
 * item detail page), so the three satellites live wherever the item already
 * lives.
 *
 * Data is fetched LAZILY on first expand (via the `loadActionItemSatellites`
 * server action) rather than eagerly for every row of every panel, and re-fetched
 * after each mutation. The reveal animates with the design system's CSS motion
 * (reduced-motion is honored globally). Gated by the `action_items` flag: the
 * host renders this only when the flag is on.
 *
 * Capabilities are passed in by the host:
 *  - `canManageReminders` — staff_admin/org_admin of the item's commission (the
 *    reminder write authority; HC0I0 otherwise);
 *  - `canContribute` — the viewer has a stake (assignee or coordinator), gating
 *    the updates composer and checklist writes (HC0I1/HC0I2 otherwise). The RPCs
 *    are the real boundary; these flags just avoid showing controls that would
 *    always be refused.
 */
export function ActionItemSatellites({
  actionItemId,
  itemTitle,
  canManageReminders,
  canContribute,
}: {
  actionItemId: string;
  itemTitle: string;
  canManageReminders: boolean;
  canContribute: boolean;
}) {
  const regionId = useId();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ActionItemSatelliteData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("idle");

  const initialLoad = useCallback(async () => {
    setStatus("loading");
    try {
      setData(await loadActionItemSatellites(actionItemId));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [actionItemId]);

  // Re-fetch after a mutation WITHOUT flashing the loading placeholder (the stale
  // lists stay visible until the fresh ones arrive). A refresh failure keeps the
  // current data; the mutation's own error is surfaced by the section.
  const refresh = useCallback(async () => {
    try {
      setData(await loadActionItemSatellites(actionItemId));
      setStatus("ready");
    } catch {
      // keep existing data
    }
  }, [actionItemId]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && data === null && status !== "loading") {
      void initialLoad();
    }
  }

  return (
    <div className="border-t border-border/60 pt-2">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={regionId}
        aria-label={`Acompanhamento de ${itemTitle}`}
        className="group flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
        Acompanhamento
        <span className="text-muted-foreground/70">
          — lembretes, atualizações e checklist
        </span>
      </button>

      {open && (
        <div
          id={regionId}
          className="animate-fade-in mt-2 flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/10 p-3"
        >
          {status === "loading" && data === null ? (
            <p className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Carregando acompanhamento…
            </p>
          ) : status === "error" && data === null ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Não foi possível carregar o acompanhamento.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void initialLoad()}
              >
                <RotateCcw aria-hidden="true" />
                Tentar novamente
              </Button>
            </div>
          ) : data ? (
            <>
              <div
                className="animate-rise-in"
                style={{ "--rise-delay": "0ms" } as React.CSSProperties}
              >
                <ReminderSection
                  actionItemId={actionItemId}
                  itemTitle={itemTitle}
                  reminders={data.reminders}
                  canManage={canManageReminders}
                  onMutated={refresh}
                />
              </div>
              <div
                className="animate-rise-in"
                style={{ "--rise-delay": "60ms" } as React.CSSProperties}
              >
                <UpdatesSection
                  actionItemId={actionItemId}
                  updates={data.updates}
                  canContribute={canContribute}
                  onMutated={refresh}
                />
              </div>
              <div
                className="animate-rise-in"
                style={{ "--rise-delay": "120ms" } as React.CSSProperties}
              >
                <ChecklistSection
                  actionItemId={actionItemId}
                  itemTitle={itemTitle}
                  checklist={data.checklist}
                  canContribute={canContribute}
                  onMutated={refresh}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
