"use client";

import { useState } from "react";
import { AlertTriangle, Check, Lock, Plus, ShieldCheck } from "lucide-react";

import { openReservedSession } from "@/lib/meetings/actions";
import type {
  ClosedSession,
  ReservedSessionItem,
} from "@/lib/queries/meetings";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { RiseInGroup } from "@/components/motion/rise-in-group";
import { useMeetingAction } from "./use-meeting-action";
import { ReservedItemForm, type ReaderOption } from "./reserved-item-form";
import type { LinkableCase } from "./case-linker";

/** Time-only (HH:MM) in pt-BR — reserved items sit within a single meeting's day. */
function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** The reserved item's time window, or null when the RPC withheld both timestamps. */
function itemWindow(item: ReservedSessionItem): string | null {
  if (item.startedAt && item.endedAt) {
    return `${formatTime(item.startedAt)}–${formatTime(item.endedAt)}`;
  }
  if (item.startedAt) return `A partir de ${formatTime(item.startedAt)}`;
  return null;
}

/**
 * One reserved item, rendered at whatever tier the server projected it to
 * (ADR 0078 C5). The base line is the NON-IDENTIFYING stub — position, that it
 * was reserved, whether quorum held, and the time window — and carries no case
 * number, name, or substance. Each higher-tier field is revealed ONLY when the
 * projection returned it non-null; a null field is simply not rendered (never a
 * blank row, never a client-side attempt to resolve it).
 */
function ReservedItemRow({
  item,
  ordinal,
}: {
  item: ReservedSessionItem;
  ordinal: number;
}) {
  const timeWindow = itemWindow(item);
  return (
    <li
      data-rise
      className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground tabular-nums"
        >
          {ordinal}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Lock aria-hidden="true" className="size-3.5 text-muted-foreground" />
          Item reservado
        </span>
        <span
          className={
            item.quorumMet
              ? "inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[0.7rem] font-medium text-success dark:bg-success/15"
              : "inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[0.7rem] font-medium text-warning"
          }
        >
          {item.quorumMet ? (
            <Check aria-hidden="true" className="size-3" />
          ) : (
            <AlertTriangle aria-hidden="true" className="size-3" />
          )}
          {item.quorumMet ? "Quórum mantido" : "Quórum não atingido"}
        </span>
        {timeWindow && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {timeWindow}
          </span>
        )}
      </div>

      {/* Propriety tier: the case's process number, revealed only above the stub. */}
      {item.processNumber != null && (
        <p className="text-xs">
          <span className="font-medium text-foreground">Processo: </span>
          <span className="font-mono text-muted-foreground">
            nº {item.processNumber}
          </span>
        </p>
      )}
      {item.withdrawals && (
        <p className="text-xs text-pretty">
          <span className="font-medium text-foreground">Impedimentos: </span>
          <span className="text-muted-foreground">{item.withdrawals}</span>
        </p>
      )}
      {item.substance && (
        <p className="text-xs text-pretty">
          <span className="font-medium text-foreground">Substância: </span>
          <span className="text-muted-foreground">{item.substance}</span>
        </p>
      )}
      {item.decision && (
        <p className="text-xs text-pretty">
          <span className="font-medium text-foreground">Decisão: </span>
          <span className="text-muted-foreground">{item.decision}</span>
        </p>
      )}
    </li>
  );
}

/**
 * Composed-ata reserved-session block (ADR 0078 Stage C). Woven into the meeting
 * detail beside the regular agenda/cases, it shows each closed session and its
 * items at the tier the server projected for the caller — full substance/decision
 * where authorized, else the non-identifying stub.
 *
 * A COORDINATOR (while the meeting is unlocked, `canEdit`) may open a reserved
 * session and add items to it. Opening a reserved session is an access-granting
 * act, so the authoring copy is explicit about who will be able to read each item;
 * the RPCs remain the real gate and their pt-BR errors surface here cleanly.
 */
export function ReservedSessionsPanel({
  meetingId,
  sessions,
  items,
  canEdit,
  cases,
  members,
}: {
  meetingId: string;
  sessions: ClosedSession[];
  items: ReservedSessionItem[];
  canEdit: boolean;
  /** Linkable cases for the authoring form (`[]` for non-coordinators). */
  cases: LinkableCase[];
  /** Commission roster for the case-less reader list (`[]` for non-coordinators). */
  members: ReaderOption[];
}) {
  const { run, isPending, error, clearError } = useMeetingAction();
  const [addForSession, setAddForSession] = useState<string | null>(null);

  const orderedSessions = [...sessions].sort((a, b) =>
    a.openedAt.localeCompare(b.openedAt),
  );
  const itemsBySession = new Map<string, ReservedSessionItem[]>();
  for (const item of items) {
    const list = itemsBySession.get(item.closedSessionId) ?? [];
    list.push(item);
    itemsBySession.set(item.closedSessionId, list);
  }

  function handleOpenSession() {
    clearError();
    run(() => openReservedSession(meetingId));
  }

  return (
    <section
      aria-labelledby="reserved-sessions-heading"
      className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
          <h2 id="reserved-sessions-heading" className="text-base font-semibold">
            Sessão reservada
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {items.length}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/60 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-primary uppercase">
            <Lock aria-hidden="true" className="size-3" />
            Confidencial
          </span>
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleOpenSession}
            disabled={isPending}
          >
            <Plus aria-hidden="true" />
            {isPending ? "Abrindo…" : "Abrir sessão reservada"}
          </Button>
        )}
      </div>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      <p className="text-xs text-muted-foreground text-pretty">
        Parte fechada da reunião para casos sensíveis. Cada item só é revelado a
        quem tem autorização — itens vinculados a um caso seguem quem já pode
        lê-lo; itens sem caso, apenas os leitores indicados e a coordenação. Os
        demais veem que houve deliberação reservada, sem seu conteúdo.
      </p>

      {orderedSessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhuma sessão reservada. Abra uma para registrar deliberações fechadas."
            : "Nenhuma sessão reservada registrada."}
        </p>
      ) : (
        <RiseInGroup
          runKey={`${orderedSessions.length}:${items.length}`}
          className="flex flex-col gap-4"
        >
          {orderedSessions.map((session, sIndex) => {
            const sessionItems = (itemsBySession.get(session.id) ?? []).sort(
              (a, b) => a.position - b.position,
            );
            return (
              <div
                key={session.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Lock
                      aria-hidden="true"
                      className="size-3.5 text-primary"
                    />
                    {session.label?.trim()
                      ? session.label
                      : `Sessão reservada ${sIndex + 1}`}
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatTime(session.openedAt)}
                    {session.closedAt
                      ? `–${formatTime(session.closedAt)}`
                      : " · em andamento"}
                  </span>
                </div>

                {sessionItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                    {canEdit
                      ? "Nenhum item nesta sessão ainda."
                      : "Sessão reservada sem itens visíveis."}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {sessionItems.map((item, i) => (
                      <ReservedItemRow
                        key={item.id}
                        item={item}
                        ordinal={i + 1}
                      />
                    ))}
                  </ul>
                )}

                {canEdit && (
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddForSession(session.id)}
                    >
                      <Plus aria-hidden="true" />
                      Adicionar item
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </RiseInGroup>
      )}

      {canEdit && (
        <ReservedItemForm
          key={addForSession ?? "none"}
          open={addForSession !== null}
          onOpenChange={(o) => {
            if (!o) setAddForSession(null);
          }}
          sessionId={addForSession ?? ""}
          cases={cases}
          members={members}
        />
      )}
    </section>
  );
}
