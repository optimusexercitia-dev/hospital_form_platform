import { notFound } from "next/navigation";

import { notificationsEnabled } from "@/lib/queries/feature-flags";
import { getPreferences } from "@/lib/queries/notifications";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";

/**
 * S1·N (Phase 20; ADR 0076) — "Preferências de notificação". `notFound()`
 * when the `notifications` flag is off, mirroring every other flag-gated
 * page in the app (e.g. `documentos-pendentes`); the bell that links here is
 * already flag-gated, but a direct hit on this URL must 404 too, not render
 * a broken/empty page.
 */
export default async function NotificationPreferencesPage() {
  const enabled = await notificationsEnabled();
  if (!enabled) {
    notFound();
  }

  const preferences = await getPreferences();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
          Preferências de notificação
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Escolha quais lembretes você quer receber. Atribuições — uma ação de
          CAPA atribuída a você, um pedido de assinatura, uma convocação de
          reunião — sempre chegam, independente destas preferências.
        </p>
      </div>
      <NotificationPreferencesForm preferences={preferences} />
    </div>
  );
}
