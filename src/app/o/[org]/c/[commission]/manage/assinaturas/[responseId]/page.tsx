import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getSignedAssetUrl } from "@/lib/queries/forms";
import { getResponseForSignoff } from "@/lib/queries/signoffs";
import { SignRunner } from "@/components/signoffs/sign-runner";
import type { ImageContent } from "@/lib/queries/forms";
import type { ResponseForSignoff } from "@/lib/queries/signoffs";
import {
  toClientResponseForSignoff,
  type ClientResponseForSignoff,
} from "@/components/signoffs/adapt";

export const metadata: Metadata = {
  title: "Revisar e assinar",
};

/**
 * Review-and-sign screen (F2). Loads one in_progress response that has a pending
 * `staff_admin` sign-off (B2's `getResponseForSignoff` — a narrow,
 * `is_staff_admin_of`-gated SECURITY DEFINER read composed with the
 * member-readable version tree). Renders the FULL response read-only and lets
 * the coordinator sign the `staff_admin`-role section(s).
 *
 * Gated like the queue: only a `staff_admin` of this commission OR a global
 * admin may reach it. A response the caller may not sign returns null → 404, and
 * a path whose commission doesn't match the row is rejected — never trust the
 * path over the row.
 */
export default async function ReviewAndSignPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; responseId: string }>;
}) {
  const { org, commission, responseId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const data: ResponseForSignoff | null =
    await getResponseForSignoff(responseId);
  // null = not found OR the caller may not sign it (definer guard). Either way: 404.
  if (!data) notFound();

  // Defend against a tampered URL where the path's commission doesn't match.
  if (data.commissionId !== access.commission.id) notFound();

  const imageUrls = await resolveImageUrls(data);

  // Adapter point: B2's `ResponseForSignoff` → the review screen's client props
  // (`signoffs[]` → map, nullable names → pt-BR fallbacks).
  const clientData: ClientResponseForSignoff = toClientResponseForSignoff(data);

  // The signer is always a `staff_admin` coordinator (member, or org_admin
  // resolved to that role) — the gate above guarantees it. A platform_admin is
  // walled off and 404'd before reaching here, so there is no admin-observer mode
  // in a tenant area (BUG-MT-005): this is always a real signer.
  const isAdminViewer = false;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={commissionHref(org, commission, "manage", "assinaturas")}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Assinaturas pendentes
        </Link>
        <h1 className="text-3xl text-balance">{data.formTitle}</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Revise as respostas abaixo e assine as seções sob sua
          responsabilidade.
        </p>
      </header>

      <SignRunner
        data={clientData}
        imageUrls={imageUrls}
        isAdminViewer={isAdminViewer}
      />
    </div>
  );
}

/**
 * Resolve a `{ storage_path → signed URL }` map for every image block in the
 * response's version tree (server-side). Mirrors the wizard's resolver so image
 * previews render immediately in the read-only review.
 */
async function resolveImageUrls(
  data: ResponseForSignoff,
): Promise<Record<string, string>> {
  const paths = new Set<string>();
  for (const section of data.tree.sections) {
    for (const item of section.items) {
      if (item.itemType === "image" && item.content) {
        const path = (item.content as ImageContent).storage_path;
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
