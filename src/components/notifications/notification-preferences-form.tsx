"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { setNotificationPreference } from "@/lib/notifications/actions";
// Type-only — see notification-bell-client.tsx for why (server-only module).
import type {
  NotificationSurface,
  NotificationPreferenceRow,
} from "@/lib/queries/notifications";

const SURFACE_COPY: Record<
  NotificationSurface,
  { title: string; reminder: string; always: string }
> = {
  capa: {
    title: "Ações de CAPA",
    reminder:
      "Avisos de prazo: a caminho do vencimento, atrasada, ou ainda em aberto.",
    always: "Atribuir uma ação a você sempre notifica, mesmo desativado.",
  },
  signoff: {
    title: "Assinaturas de seção",
    reminder: "Avisos de assinatura pendente há alguns dias.",
    always: "Um pedido de assinatura sempre notifica, mesmo desativado.",
  },
  meeting: {
    title: "Reuniões",
    reminder: "Aviso na véspera de uma reunião marcada.",
    always: "Ser convocado para uma reunião sempre notifica, mesmo desativado.",
  },
};

const ORDER: NotificationSurface[] = ["capa", "signoff", "meeting"];

/**
 * S1·N (Phase 20; ADR 0076) reminder-preference toggles — 3 surfaces (CAPA /
 * sign-off / meeting), each independently on/off. Copy makes explicit that
 * only the *reminder* stream is suppressible; event-driven assignments always
 * deliver (ADR 0076 decision 6 — accountability). Optimistic per-row state
 * with rollback on failure; each row's pt-BR error is the mapped string the
 * server action already returns (`mapNotificationsError`) — never raw
 * Postgres text (Rule 10 / CLAUDE.md §8).
 */
export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: NotificationPreferenceRow[];
}) {
  const [enabledBySurface, setEnabledBySurface] = useState<
    Record<NotificationSurface, boolean>
  >(() =>
    Object.fromEntries(
      preferences.map((p) => [p.surface, p.remindersEnabled]),
    ) as Record<NotificationSurface, boolean>,
  );
  const [errorBySurface, setErrorBySurface] = useState<
    Partial<Record<NotificationSurface, string>>
  >({});
  // Per-surface in-flight guard. NOT a native `disabled` on the fieldset: the
  // browser auto-blurs a focused control the instant it becomes disabled, so a
  // keyboard user who toggled a switch would lose focus to <body> during the
  // server round-trip and have to Tab in from the top again (BUG-N-003). The
  // toggled switch stays enabled and keeps focus; this set only prevents
  // duplicate requests for the SAME surface until its round-trip settles.
  const [pendingSurfaces, setPendingSurfaces] = useState<
    ReadonlySet<NotificationSurface>
  >(() => new Set());
  const [, startTransition] = useTransition();

  function toggle(surface: NotificationSurface, next: boolean) {
    // Ignore a repeat toggle for a surface whose request is still in flight
    // (re-entrancy guard) — never by disabling the control, so focus is kept.
    if (pendingSurfaces.has(surface)) return;

    const previous = enabledBySurface[surface];
    setEnabledBySurface((prev) => ({ ...prev, [surface]: next }));
    setErrorBySurface((prev) => ({ ...prev, [surface]: undefined }));
    setPendingSurfaces((prev) => new Set(prev).add(surface));

    startTransition(() => {
      void (async () => {
        const result = await setNotificationPreference(surface, next);
        if (!result.ok) {
          // Roll back on failure so the toggle reflects reality, not the
          // optimistic guess.
          setEnabledBySurface((prev) => ({ ...prev, [surface]: previous }));
          setErrorBySurface((prev) => ({
            ...prev,
            [surface]: result.error ?? "Não foi possível concluir. Tente novamente.",
          }));
        }
        setPendingSurfaces((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(surface);
          return nextSet;
        });
      })();
    });
  }

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Lembretes de notificação por tipo</legend>
      {ORDER.map((surface) => {
        const copy = SURFACE_COPY[surface];
        const checked = enabledBySurface[surface] ?? true;
        const error = errorBySurface[surface];
        const switchId = `notif-pref-${surface}`;
        const descId = `${switchId}-desc`;
        return (
          <div
            key={surface}
            className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={switchId} className="text-sm font-medium text-foreground">
                {copy.title}
              </label>
              <p id={descId} className="text-sm text-muted-foreground">
                {copy.reminder}
              </p>
              <p className="text-xs text-muted-foreground">{copy.always}</p>
              {error ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
            <Switch
              id={switchId}
              checked={checked}
              aria-describedby={descId}
              aria-busy={pendingSurfaces.has(surface)}
              onCheckedChange={(next) => toggle(surface, next === true)}
              className={cn("mt-0.5 shrink-0")}
            />
          </div>
        );
      })}
    </fieldset>
  );
}
