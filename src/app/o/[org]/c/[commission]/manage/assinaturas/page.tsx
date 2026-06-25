import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listSignoffQueue } from "@/lib/queries/signoffs";
import { SignoffQueueList } from "@/components/signoffs/signoff-queue-list";
import type { SignoffQueueRow } from "@/components/signoffs/types";

export const metadata: Metadata = {
  title: "Assinaturas pendentes",
};

/**
 * The staff_admin "pendentes de assinatura" queue (F1): in_progress responses
 * of this commission that have a VISIBLE, unsigned, `staff_admin`-role sign-off
 * section awaiting the coordinator's signature.
 *
 * Access is gated HERE on the server in addition to RLS: only a `staff_admin` of
 * this commission OR a global admin may reach it. Everyone else (staff of this
 * commission, members of another commission, unknown slug) gets `notFound()` — a
 * 404 that reveals nothing, mirroring `manage/members`. The queue data itself is
 * served by a narrow, `is_staff_admin_of`-gated SECURITY DEFINER read (B1/B2),
 * so RLS remains the boundary for the rows.
 */
export default async function SignoffQueuePage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  // Unknown/inaccessible slug, or a caller who is neither coordinator nor admin.
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  // Adapter point: map B2's `SignoffQueueItem[]` to the client list's prop shape
  // (this is the single place that absorbs the queue contract). pt-BR fallbacks
  // for nullable display fields keep the UI clean.
  const queue = await listSignoffQueue(access.commission.id);
  const rows: SignoffQueueRow[] = queue.map((item) => ({
    responseId: item.responseId,
    formId: item.formId,
    formTitle: item.formTitle,
    versionNumber: item.versionNumber,
    respondentName: item.respondentName ?? "Responsável",
    sectionId: item.pendingSectionId,
    sectionTitle: item.pendingSectionTitle ?? "Seção sem título",
    pendingCount: item.pendingCount,
    startedAt: item.startedAt,
    updatedAt: item.updatedAt,
  }));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Assinaturas pendentes</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Respostas em andamento que aguardam a sua assinatura para que possam
          ser enviadas. Abra uma resposta para revisar o conteúdo e assinar as
          seções sob sua responsabilidade.
        </p>
      </header>

      <section aria-label="Respostas aguardando assinatura">
        <SignoffQueueList org={org} slug={slug} rows={rows} />
      </section>
    </div>
  );
}
