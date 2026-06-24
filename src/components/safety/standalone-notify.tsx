"use client";

import { commissionHref } from "@/lib/routing";
import { useRouter } from "next/navigation";

import { EventNotifyForm } from "./event-notify-form";

/**
 * Client wrapper for the stand-alone (case-less) notify page
 * (`c/[slug]/eventos/novo`): hosts the shared {@link EventNotifyForm} with
 * `caseId = null` and, on success, navigates back to the commission read-back
 * list. The server page does the gating + supplies the commission id.
 */
export function StandaloneNotify({
  org,
  slug,
  commissionId,
}: {
  /** Org slug for hrefs. */
  org: string;
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
      onCancel={() => router.push(commissionHref(org, slug, "eventos"))}
      onSuccess={() => {
        router.push(commissionHref(org, slug, "eventos"));
        router.refresh();
      }}
    />
  );
}
