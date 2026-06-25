import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Layers } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getSubmissionDetail } from "@/lib/queries/submissions";
import { getSignedAssetUrl, type VersionTree } from "@/lib/queries/forms";
import { SubmissionDetailView } from "@/components/dashboard/submission-detail-view";

export const metadata: Metadata = {
  title: "Resposta enviada",
};

/**
 * Version-faithful, read-only detail of one submitted response (F5).
 *
 * Security: the page is staff_admin-gated, AND `getSubmissionDetail` returns
 * `null` for anything the caller may not read — a foreign-commission response, a
 * foreign member's in_progress response (the Phase-7 invariant), or a missing
 * id. We ALSO defensively confirm the detail's commission matches the slug. Any
 * of these → the friendly in-shell 404 with no data leakage (mirrors
 * `PhaseAnswersPage`).
 */
export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; responseId: string }>;
}) {
  const { org, commission, responseId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const detail = await getSubmissionDetail(responseId);
  if (!detail || detail.commissionId !== access.commission.id) {
    notFound();
  }

  const imageUrls = await resolveImageUrls(detail.tree);
  const member = detail.memberName ?? "Membro removido";
  const isSubmitted = detail.status === "submitted";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={commissionHref(org, commission, "dashboard", "submissions")}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Respostas enviadas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl text-balance">{detail.formTitle}</h1>
          <span className="text-sm text-muted-foreground">
            v{detail.versionNumber}
          </span>
          {detail.isCasePhase && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
              <Layers aria-hidden="true" className="size-3" />
              Fase de caso
            </span>
          )}
          {!isSubmitted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              <Clock aria-hidden="true" className="size-3" />
              Em andamento
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {member}
          {detail.submittedAt
            ? ` · Enviada em ${formatDateTime(detail.submittedAt)}`
            : ""}
        </p>
      </header>

      <SubmissionDetailView
        tree={detail.tree}
        answersByItemId={detail.answersByItemId}
        answersByKey={detail.answersByKey}
        observationsByItemId={detail.observationsByItemId}
        signoffs={detail.signoffs}
        imageUrls={imageUrls}
      />
    </div>
  );
}

/** pt-BR date + time. */
function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Resolve a `{ storage_path → signed URL }` map for the version's image blocks
 * (mirrors the version-history page's helper). */
async function resolveImageUrls(
  tree: VersionTree,
): Promise<Record<string, string>> {
  const paths = new Set<string>();
  for (const section of tree.sections) {
    for (const item of section.items) {
      if (item.itemType === "image" && item.content) {
        const path = (item.content as { storage_path?: string }).storage_path;
        if (path) paths.add(path);
      }
    }
  }
  const entries = await Promise.all(
    [...paths].map(
      async (path) => [path, await getSignedAssetUrl(path)] as const,
    ),
  );
  const map: Record<string, string> = {};
  for (const [path, url] of entries) {
    if (url) map[path] = url;
  }
  return map;
}
