"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, CheckCircle2, CircleAlert, History } from "lucide-react";

import type { CarryForwardSuggestions } from "@/lib/charters/types";
// The existing agenda-create door (create_meeting_agenda_item) — reused, not
// re-implemented (ADR 0080 D7). Client components may value-import these `"use
// server"` actions directly (the `agenda-item-form.tsx` precedent).
import { createAgendaItem } from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ACTION_ITEM_STATUS_LABEL } from "@/components/meetings/meeting-labels";

/** pt-BR long date for a `YYYY-MM-DD` (no tz shift) or a full ISO timestamp. */
function formatDate(value: string): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return fmt.format(new Date(y, (m ?? 1) - 1, d ?? 1));
  }
  return fmt.format(new Date(value));
}

/** Resolve an action-item status key to pt-BR, falling back to the raw key. */
function statusLabel(status: string): string {
  return (
    (ACTION_ITEM_STATUS_LABEL as Record<string, string>)[status] ?? status
  );
}

/**
 * Carry-forward step for the schedule/plan-meeting flow (S4·CH, Phase 21 — ADR 0080
 * D7, plan §5). Rendered on the (newly created / upcoming) meeting's detail page,
 * beside the agenda, gated on `charters` + agenda-edit capability.
 *
 * Two lists, both a PURE, confidentiality-filtered read from `getCarryForwardSuggestions`:
 *  - Agenda items unresolved on the last held plenary — each with a checkbox; ticked
 *    items are COPIED onto THIS meeting via the existing `createAgendaItem` door (new
 *    rows; the originals stay untouched as history). No new backend door.
 *  - Open meeting-sourced action items — surfaced READ-ONLY ("ainda em aberto"); never
 *    copied, never re-linked.
 *
 * Accessible: a labelled checkbox group (fieldset/legend), keyboard-operable, visible
 * focus, polite success + assertive error regions. pt-BR (Rule 10); no PHI (Rule 12).
 */
export function CarryForwardPanel({
  meetingId,
  suggestions,
}: {
  meetingId: string;
  suggestions: CarryForwardSuggestions;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<
    { ok: true; added: number } | { ok: false; error: string } | null
  >(null);

  // Never suggest copying a meeting's own items into itself: the RPC returns the
  // most-recent HELD plenary's items, which is this meeting when a chair opens the
  // just-held source. Filter those out (action items carry no source meeting).
  const agendaItems = useMemo(
    () => suggestions.agendaItems.filter((a) => a.sourceMeetingId !== meetingId),
    [suggestions.agendaItems, meetingId],
  );
  const { actionItems } = suggestions;

  const isEmpty = agendaItems.length === 0 && actionItems.length === 0;
  const selectedCount = checked.size;

  function toggle(index: number, isChecked: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (isChecked) next.add(index);
      else next.delete(index);
      return next;
    });
    setResult(null);
  }

  function carryForward() {
    const picks = agendaItems.filter((_, i) => checked.has(i));
    if (picks.length === 0) return;
    startTransition(async () => {
      let added = 0;
      for (const item of picks) {
        const res = await createAgendaItem(meetingId, {
          title: item.title,
          description: item.description,
          discussionNotes: null,
          resolution: null,
        });
        if (!res.ok) {
          setResult({
            ok: false,
            error:
              added > 0
                ? `${added} ${added === 1 ? "item adicionado" : "itens adicionados"}, mas ocorreu um erro. ${res.error ?? ""}`.trim()
                : (res.error ?? "Não foi possível trazer os itens."),
          });
          if (added > 0) router.refresh();
          return;
        }
        added += 1;
      }
      setChecked(new Set());
      setResult({ ok: true, added });
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="carry-forward-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <History aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="carry-forward-heading" className="text-base font-semibold">
          Continuidade da última reunião
        </h2>
      </div>
      <p className="text-sm text-muted-foreground text-pretty">
        Itens em aberto da última reunião plenária desta comissão. Traga os pontos
        de pauta pendentes para esta reunião; os itens de ação seguem em aberto e são
        apenas informativos.
      </p>

      {result?.ok ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/12 px-4 py-3 text-sm font-medium text-success"
        >
          <CheckCircle2 aria-hidden="true" className="size-4" />
          {result.added}{" "}
          {result.added === 1
            ? "item de pauta trazido para esta reunião."
            : "itens de pauta trazidos para esta reunião."}
        </p>
      ) : null}
      {result && !result.ok ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          <CircleAlert aria-hidden="true" className="size-4" />
          {result.error}
        </p>
      ) : null}

      {isEmpty ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum item em aberto para trazer da última reunião.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {agendaItems.length > 0 && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="pb-1 text-sm font-medium">
                Pauta pendente ({agendaItems.length})
              </legend>
              <ul className="flex flex-col gap-2">
                {agendaItems.map((item, i) => {
                  const isChecked = checked.has(i);
                  return (
                    <li key={`${item.sourceMeetingId}-${i}`}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3 transition-colors hover:bg-accent/30">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(c) => toggle(i, c === true)}
                          disabled={isPending}
                          className="mt-0.5"
                        />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-medium text-foreground">
                            {item.title}
                          </span>
                          {item.description && (
                            <span className="text-xs text-muted-foreground text-pretty">
                              {item.description}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={carryForward}
                  disabled={isPending || selectedCount === 0}
                >
                  <ArrowDownToLine aria-hidden="true" />
                  {isPending
                    ? "Trazendo…"
                    : selectedCount > 0
                      ? `Trazer ${selectedCount} para a pauta`
                      : "Trazer selecionados para a pauta"}
                </Button>
              </div>
            </fieldset>
          )}

          {actionItems.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <p className="text-sm font-medium">
                Itens de ação em aberto ({actionItems.length})
              </p>
              <ul className="flex flex-col gap-2">
                {actionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/10 p-3"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground text-pretty">
                        {item.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {statusLabel(item.status)}
                        {item.dueDate
                          ? ` · vence em ${formatDate(item.dueDate)}`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
                      ainda em aberto
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
