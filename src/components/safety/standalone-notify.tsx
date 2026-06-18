"use client";

import { useRouter } from "next/navigation";

import { EventNotifyForm } from "./event-notify-form";

/**
 * Client wrapper for the stand-alone (case-less) notify page
 * (`c/[slug]/eventos/novo`): hosts the shared {@link EventNotifyForm} with
 * `caseId = null` and, on success, navigates back to the commission read-back
 * list. The server page does the gating + supplies the commission id.
 */
export function StandaloneNotify({
  slug,
  commissionId,
}: {
  slug: string;
  commissionId: string;
}) {
  const router = useRouter();
  return (
    <EventNotifyForm
      reportingCommissionId={commissionId}
      caseId={null}
      idPrefix="standalone-notify"
      submitLabel="Notificar evento"
      onCancel={() => router.push(`/c/${slug}/eventos`)}
      onSuccess={() => {
        router.push(`/c/${slug}/eventos`);
        router.refresh();
      }}
    />
  );
}
