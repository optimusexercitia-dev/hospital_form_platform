import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, FolderOpen } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getReferralAttachmentUrl,
  getReferralDetail,
  getReferralDocumentUrl,
  listReplyOutcomes,
  referralsEnabled,
} from "@/lib/queries/referrals";
import { revealReferralPatient } from "@/lib/referrals/actions";
import { patientXrefCount } from "@/lib/queries/patient-index";
import { listCasesBoard } from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { SafetyMotion } from "@/components/safety/safety-motion";
import {
  ReferralDirectionChip,
  ReferralStatusChip,
  ReferralTypeChip,
  ResponseExpectedChip,
} from "@/components/referrals/referral-chips";
import { ReferralSnapshot } from "@/components/referrals/referral-snapshot";
import { ReferralReplyView } from "@/components/referrals/referral-reply-view";
import {
  ReferralActions,
  type LinkableTargetCase,
} from "@/components/referrals/referral-actions";
import { ReferralPatientPanel } from "@/components/referrals/referral-patient-panel";
import {
  formatCaseNumber,
  formatDateTime,
  formatReferralCode,
} from "@/components/referrals/format";
import { RESOLVED_REFERRAL_STATUSES } from "@/lib/referrals/types";

export const metadata: Metadata = {
  title: "Encaminhamento",
};

/**
 * The referral detail (Decisions 1, 3, 4, 10, 16) — the working view for BOTH the
 * source (A) and the target (B), opened from the hub or the case-detail card. Renders:
 *  - the PHI-free header (code/subject/type/status/direction/commissions/case);
 *  - A's free-text description (sanitized Markdown, Rule 7);
 *  - the frozen SNAPSHOT (narratives + documents — documents via signed URLs minted
 *    server-side through the DEFINER `getReferralDocumentUrl` door);
 *  - the entitled coordinator's ACTIONS (receive/accept/decline/start-review/link-case/
 *    reply, or source withdraw), gated by RLS-backed coordinator booleans;
 *  - the delivered reply once `concluida`;
 *  - the LAZY, audited isolated-PHI panel.
 *
 * Gating: `referralsEnabled` flag → 404; `getCommissionAccessByOrg(org, commission)` → 404 for a
 * foreign/unknown commission; `getReferralDetail` re-gates `can_read_referral` and
 * returns `null` out of scope → 404 (RLS is the boundary, not UI hiding).
 *
 * Authority is computed from the viewer's role in the commission whose `[slug]`
 * this is, intersected with the referral's two ends: a `staff_admin` of the target
 * commission is the target coordinator; a `staff_admin` of the source commission is
 * the source coordinator; an admin manages either end. The component gating is a
 * convenience — the RPCs re-check and raise HC071/HC072.
 */
export default async function ReferralDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; referralId: string }>;
}) {
  const { org, commission, referralId } = await params;

  if (!(await referralsEnabled())) {
    notFound();
  }

  // Deny null-role callers: a platform_admin is walled off from tenant data and
  // from this PHI-bearing referral module (BUG-MT-005). The resolver maps an
  // org_admin to `staff_admin`, so legitimate referral managers are members with a
  // role; only a platform_admin resolves to `role === null` here.
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) {
    notFound();
  }

  const detail = await getReferralDetail(referralId);
  if (!detail) {
    notFound();
  }

  // Coordinator authority, RLS-backed (the RPCs re-check). A `staff_admin`
  // (member coordinator, or org_admin resolved to that role) manages only the end
  // that is THIS commission. A platform_admin is not a referral actor and was
  // already denied above.
  const myCommissionId = access.commission.id;
  const canManageTarget =
    access.role === "staff_admin" &&
    detail.targetCommissionId === myCommissionId;
  const canManageSource =
    access.role === "staff_admin" &&
    detail.sourceCommissionId === myCommissionId;

  // Snapshot document signed URLs — minted SERVER-SIDE via the DEFINER door (the
  // CaseDocumentWithUrl pattern; the plan's "Decided defaults"). Built as a map
  // keyed by shared-item id for the snapshot component.
  const documentItems = detail.sharedItems.filter((i) => i.kind === "document");
  const documentUrlEntries = await Promise.all(
    documentItems.map(
      async (i) => [i.id, await getReferralDocumentUrl(i.id)] as const,
    ),
  );
  const documentUrls = Object.fromEntries(documentUrlEntries);

  // Reply attachment signed URLs (same door pattern).
  const attachments = detail.reply?.attachments ?? [];
  const attachmentUrlEntries = await Promise.all(
    attachments.map(
      async (a) => [a.id, await getReferralAttachmentUrl(a.id)] as const,
    ),
  );
  const attachmentUrls = Object.fromEntries(attachmentUrlEntries);

  // Reply vocab + linkable target cases — only meaningful for the target
  // coordinator while the referral is in review; skipped otherwise (no leak, no
  // wasted reads). Excludes the already-linked case + terminal cases.
  const inReview = ["aceita", "em_analise"].includes(detail.status);
  const [replyOutcomes, board] = await Promise.all([
    canManageTarget && detail.status === "em_analise"
      ? listReplyOutcomes()
      : Promise.resolve([]),
    canManageTarget && inReview
      ? listCasesBoard(detail.targetCommissionId)
      : Promise.resolve([]),
  ]);
  const linkableCases: LinkableTargetCase[] = board
    .filter(
      (row) =>
        !isTerminalCaseStatus(row.case.status) &&
        row.case.id !== detail.targetCaseId,
    )
    .map((row) => ({
      id: row.case.id,
      caseNumber: row.case.caseNumber,
      label: row.case.label,
    }));

  // The audited PHI reveal door, bound to this referral. `revealReferralPatient` is
  // a `"use server"` action wrapping the `get_referral_patient` RPC (which emits the
  // `referral_patient.read` audit row server-side and returns NULL for an unentitled
  // reader); `.bind` yields a no-arg server reference safe to hand the client panel,
  // so the audited read fires only when the reader clicks "Exibir identificação".
  const revealPatient = revealReferralPatient.bind(null, detail.id);

  // Phase 23 cross-record hint: how many OTHER records share this patient across
  // the hospital. The `patient_xref_count` door is gated to referral-PHI-entitled
  // viewers server-side (returns 0 when out of scope / flag off / no patient key),
  // so it's safe to ask whenever an isolated PHI record exists — PHI-free count.
  const appearsInCount = detail.hasPatient
    ? await patientXrefCount("referral", detail.id)
    : 0;

  const inFlight = !RESOLVED_REFERRAL_STATUSES.has(detail.status);
  const backHref = commissionHref(org, commission, "encaminhamentos");

  return (
    <SafetyMotion runKey={detail.id} className="flex flex-col gap-8">
      <header data-rise className="flex flex-col gap-4">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Encaminhamentos
        </Link>
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">
              {formatReferralCode(detail.code)}
            </span>
            <h1 className="text-3xl text-balance">{detail.subject}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <ReferralStatusChip status={detail.status} />
              <ReferralTypeChip
                label={detail.typeLabel}
                colorToken={detail.typeColorToken}
              />
              <ReferralDirectionChip direction={detail.direction} />
              {detail.responseExpected && inFlight && <ResponseExpectedChip />}
            </div>
          </div>

          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="inline-flex items-center gap-1.5">
              <Building2 aria-hidden="true" className="size-4" />
              <span>
                {detail.sourceCommissionName ?? "Origem"}
                {" → "}
                {detail.targetCommissionName ?? "Destino"}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 tabular-nums">
              <FolderOpen aria-hidden="true" className="size-4" />
              <span>
                Origem: {formatCaseNumber(detail.sourceCaseNumber)}
                {detail.targetCaseNumber != null
                  ? ` · Vinculado: ${formatCaseNumber(detail.targetCaseNumber)}`
                  : ""}
              </span>
            </div>
          </dl>

          <p className="text-sm text-muted-foreground tabular-nums">
            {detail.sentAt
              ? `Enviado em ${formatDateTime(detail.sentAt)}`
              : `Criado em ${formatDateTime(detail.createdAt)}`}
            {detail.createdByName ? ` por ${detail.createdByName}` : ""}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          {/* A's free-text description (sanitized Markdown — Rule 7). */}
          {detail.descriptionMd?.trim() && (
            <section
              data-rise
              aria-labelledby="referral-description-heading"
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
            >
              <h2
                id="referral-description-heading"
                className="text-base font-semibold"
              >
                Descrição
              </h2>
              <MarkdownRenderer content={detail.descriptionMd} />
            </section>
          )}

          {/* The frozen snapshot B reads. */}
          <div data-rise>
            <ReferralSnapshot
              sharedItems={detail.sharedItems}
              documentUrls={documentUrls}
            />
          </div>

          {/* The delivered reply, once concluded. */}
          {detail.reply && (
            <div data-rise>
              <ReferralReplyView
                reply={detail.reply}
                attachmentUrls={attachmentUrls}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-8">
          {/* Entitled coordinator actions — wrapper omitted when null to avoid a
              phantom flex gap that misaligns the right column with the left. */}
          {(canManageTarget || canManageSource) && inFlight && (
            <div data-rise>
              <ReferralActions
                referralId={detail.id}
                status={detail.status}
                responseExpected={detail.responseExpected}
                canManageTarget={canManageTarget}
                canManageSource={canManageSource}
                replyOutcomes={replyOutcomes}
                linkableCases={linkableCases}
                linkedCaseNumber={detail.targetCaseNumber}
              />
            </div>
          )}

          {/* Lazy, audited isolated-PHI panel. */}
          <div data-rise>
            <ReferralPatientPanel
              hasPatient={detail.hasPatient}
              onReveal={revealPatient}
              appearsInCount={appearsInCount}
            />
          </div>
        </div>
      </div>
    </SafetyMotion>
  );
}
