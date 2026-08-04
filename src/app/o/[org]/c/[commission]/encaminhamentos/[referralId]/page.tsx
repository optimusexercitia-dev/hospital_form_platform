import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CircleSlash,
  FolderOpen,
} from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  canDisposeReferralPhi,
  getReferralAttachmentUrl,
  getReferralDetail,
  getReferralDocumentUrl,
  listReferralInternalNotes,
  listReplyOutcomes,
  referralsEnabled,
} from "@/lib/queries/referrals";
import { revealReferralPatient } from "@/lib/referrals/actions";
import { patientXrefCount } from "@/lib/queries/patient-index";
import { listCasesBoard } from "@/lib/queries/cases";
import { listMembers } from "@/lib/queries/members";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { SafetyMotion } from "@/components/safety/safety-motion";
import {
  ReferralDirectionChip,
  ReferralOverdueChip,
  ReferralPriorityChip,
  ReferralRequestedActionChip,
  ReferralStatusChip,
  ReferralTypeChip,
  ResponseExpectedChip,
} from "@/components/referrals/referral-chips";
import { ReferralSnapshot } from "@/components/referrals/referral-snapshot";
import { ReferralReplyView } from "@/components/referrals/referral-reply-view";
import { ReferralResolutions } from "@/components/referrals/referral-resolutions";
import { ReferralLineageCard } from "@/components/referrals/referral-lineage";
import { ReferralThread } from "@/components/referrals/referral-thread";
import { ReferralComposer } from "@/components/referrals/referral-composer";
import {
  ReferralActions,
  type LinkableTargetCase,
} from "@/components/referrals/referral-actions";
import { ReferralPatientPanel } from "@/components/referrals/referral-patient-panel";
import { ReferralAssignmentPanel } from "@/components/referrals/referral-assignment-panel";
import { ReferralRelatedCasesPanel } from "@/components/referrals/referral-related-cases-panel";
import { ReferralInternalNotesPanel } from "@/components/referrals/referral-internal-notes-panel";
import { ReferralDisposeDialog } from "@/components/referrals/referral-dispose-dialog";
import { ReferralDraftDelete } from "@/components/referrals/referral-draft-delete";
import {
  formatCaseNumber,
  formatDateTime,
  formatReferralCode,
} from "@/components/referrals/format";
import {
  REFERRAL_DECLINE_REASON_LABELS,
  RESOLVED_REFERRAL_STATUSES,
} from "@/lib/referrals/types";

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
  const inReview = ["accepted", "in_review"].includes(detail.status);
  const [replyOutcomes, { rows: board }] = await Promise.all([
    canManageTarget && detail.status === "in_review"
      ? listReplyOutcomes()
      : Promise.resolve([]),
    // ADR 0094 W4: `targetCommissionId` is null on a technical-direction referral, and
    // `canManageTarget` is already false there (it compares the null against this
    // route's commission id) — the explicit guard is what lets the compiler see it.
    canManageTarget && inReview && detail.targetCommissionId
      ? listCasesBoard(detail.targetCommissionId)
      : Promise.resolve({ rows: [], nextCursor: null }),
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

  // RV2 R4 responsibility & multi-linkage. The viewer coordinates AT MOST one side
  // (their route's commission is source XOR target); on that side they may assign
  // reviewers (from that commission's roster) and record typed related-case pointers
  // (from that commission's case board). Loaded only for a coordinator — a plain
  // member gets read-only panels (empty picker sources).
  const canManageEitherSide = canManageTarget || canManageSource;
  const [assignableMembers, { rows: relatableBoard }] = await Promise.all([
    canManageEitherSide
      ? listMembers(myCommissionId)
      : Promise.resolve([]),
    canManageEitherSide
      ? listCasesBoard(myCommissionId)
      : Promise.resolve({ rows: [], nextCursor: null }),
  ]);
  const assignMembers = assignableMembers.map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
  }));
  const relatableCases = relatableBoard.map((row) => ({
    id: row.case.id,
    caseNumber: row.case.caseNumber,
    label: row.case.label,
  }));

  // RV2 R5 private internal notes (side-private; the K-R5-1 keystone). The viewer's
  // OWN committee side is the referral's source OR target commission that equals the
  // route's commission; a viewer of neither side (e.g. a QPS drill-in) has `null` and
  // the door already returns `[]` for them. The audited door returns only the
  // caller's-side notes, so passing them to the panel never crosses the wall.
  const myNoteCommitteeId =
    myCommissionId === detail.sourceCommissionId ||
    myCommissionId === detail.targetCommissionId
      ? myCommissionId
      : null;
  const internalNotes = myNoteCommitteeId
    ? await listReferralInternalNotes(detail.id)
    : [];

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

  // LGPD-erasure affordance gate (BUG-NPH-002): the authoritative disposer probe,
  // mirroring the `dispose_referral_phi` RPC gate exactly (source commission-admin /
  // PQS operator of EITHER endpoint hospital; the platform_admin arm was removed by
  // ADR 0078 M2 — it could destroy referral PHI it cannot read). Only asked when a
  // PHI record exists (nothing to erase otherwise). PHI-free; safe-defaults false —
  // so the destructive control renders only for a caller the RPC would accept, never
  // dangling for e.g. a plain source-commission staff_admin.
  const canDisposePhi = detail.hasPatient
    ? await canDisposeReferralPhi(detail.id)
    : false;

  const inFlight = !RESOLVED_REFERRAL_STATUSES.has(detail.status);
  const backHref = commissionHref(org, commission, "encaminhamentos");

  // RV2 R3 lineage: a link back to the parent this referral was forwarded from
  // (RLS re-gates at the target), and — for the target coordinator who has linked a
  // case — an "Encaminhar adiante" deep-link that pre-opens the send wizard on that
  // linked case, seeding the new draft's `parent_referral_id`.
  const parentHref = detail.parentReferralId
    ? commissionHref(org, commission, "encaminhamentos", detail.parentReferralId)
    : null;
  const forwardHref =
    canManageTarget && detail.targetCaseId
      ? `${commissionHref(org, commission, "manage", "cases", detail.targetCaseId)}?encaminharDe=${detail.id}`
      : null;

  // RV2 R1: the dialogue thread + its gated composer. The waiting-on indicator is
  // shown only while `awaiting_information`, resolving the PHI-free
  // `waitingOnCommitteeId` to the source/target committee name (never a body). The
  // composer gates on the door's COMPOSE-AUTHORITY flags (byte-for-gate parity with
  // the R1 RPCs — so a target analyst, not just a coordinator, may compose), NOT
  // the `staff_admin`-scoped canManage* used by the coordinator-only ReferralActions.
  const canCompose = detail.canComposeAsSource || detail.canComposeAsTarget;
  const waitingOnLabel =
    detail.status === "awaiting_information" && detail.waitingOnCommitteeId
      ? detail.waitingOnCommitteeId === detail.sourceCommissionId
        ? `Aguardando informações da comissão de origem (${detail.sourceCommissionName ?? "origem"}).`
        : `Aguardando informações da comissão de destino (${detail.targetCommissionName ?? "destino"}).`
      : null;

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
              {detail.priority !== "routine" && (
                <ReferralPriorityChip priority={detail.priority} />
              )}
              {detail.requestedActionLabel && (
                <ReferralRequestedActionChip
                  label={detail.requestedActionLabel}
                />
              )}
              {detail.overdue && <ReferralOverdueChip />}
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
            {/* RV2 R2: the SLA deadline, read in a firm tone once overdue (the
                overdue chip above already flags it — icon + text carry it too). */}
            {detail.responseDueAt && (
              <div
                className={`inline-flex items-center gap-1.5 tabular-nums ${
                  detail.overdue ? "font-medium text-destructive" : ""
                }`}
              >
                <CalendarClock aria-hidden="true" className="size-4" />
                <span>
                  Prazo de resposta: {formatDateTime(detail.responseDueAt)}
                  {detail.overdue ? " · vencido" : ""}
                </span>
              </div>
            )}
          </dl>

          <p className="text-sm text-muted-foreground tabular-nums">
            {detail.sentAt
              ? `Enviado em ${formatDateTime(detail.sentAt)}`
              : `Criado em ${formatDateTime(detail.createdAt)}`}
            {detail.createdByName ? ` por ${detail.createdByName}` : ""}
          </p>

          {/* RV2 R2: the PHI-free structured decline reason on a rejected referral
              (distinct from the PHI-gated decline note). */}
          {detail.status === "rejected" && detail.declineReasonCode && (
            <p className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
              <CircleSlash aria-hidden="true" className="size-4" />
              Motivo da recusa:{" "}
              {REFERRAL_DECLINE_REASON_LABELS[detail.declineReasonCode]}
            </p>
          )}
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

          {/* RV2 R1: the two-way dialogue thread + the side/status-gated composer.
              The read thread is server-rendered (PHI-safe: a restricted body shows
              a placeholder, never the text); the composer is a client island shown
              only to a side coordinator while the referral is non-terminal. */}
          <div data-rise>
            <ReferralThread
              messages={detail.messages}
              readReceipts={detail.readReceipts}
              viewerUserId={access.context.userId}
              canRedact={canManageEitherSide}
              waitingOnLabel={waitingOnLabel}
              composer={
                inFlight && canCompose ? (
                  <ReferralComposer
                    referralId={detail.id}
                    status={detail.status}
                    canComposeAsTarget={detail.canComposeAsTarget}
                    canComposeAsSource={detail.canComposeAsSource}
                  />
                ) : null
              }
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

          {/* RV2 R3: the append-only resolution history (renders nothing until the
              source first resolves). */}
          {detail.resolutions.length > 0 && (
            <div data-rise>
              <ReferralResolutions resolutions={detail.resolutions} />
            </div>
          )}

          {/* RV2 R4: WHO is responsible (assignments) + typed related-case pointers.
              Both are PHI-free governance metadata visible to any reader; the
              coordinator of the viewer's side gets the write controls. */}
          <div data-rise>
            <ReferralAssignmentPanel
              referralId={detail.id}
              assignments={detail.assignments}
              canManage={canManageEitherSide}
              myCommissionId={myCommissionId}
              members={assignMembers}
            />
          </div>

          <div data-rise>
            <ReferralRelatedCasesPanel
              referralId={detail.id}
              links={detail.links}
              canManage={canManageEitherSide}
              myCommissionId={myCommissionId}
              relatableCases={relatableCases}
            />
          </div>

          {/* RV2 R5: the PRIVATE per-committee internal notes (K-R5-1) — visible only
              to the viewer's own side; renders nothing for a QPS/neither-side reader. */}
          {myNoteCommitteeId && (
            <div data-rise>
              <ReferralInternalNotesPanel
                referralId={detail.id}
                committeeId={myNoteCommitteeId}
                notes={internalNotes}
                canCreate={true}
                canRedact={canManageEitherSide}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-8">
          {/* RV2 R3: lineage — parent back-link + "Encaminhar adiante" forward
              affordance. Renders nothing when neither applies. */}
          {(parentHref || forwardHref) && (
            <div data-rise>
              <ReferralLineageCard
                parentHref={parentHref}
                forwardHref={forwardHref}
              />
            </div>
          )}

          {/* Entitled coordinator actions — wrapper omitted when null to avoid a
              phantom flex gap that misaligns the right column with the left.
              Rendered while in flight AND when `resolved` (so the source may
              REOPEN — RV2 R3; `resolved` is otherwise terminal). The component
              itself no-ops to null when nothing is actionable for this viewer. */}
          {(canManageTarget || canManageSource) &&
            (inFlight || detail.status === "resolved") && (
              <div data-rise>
                <ReferralActions
                  referralId={detail.id}
                  status={detail.status}
                  responseExpected={detail.responseExpected}
                  responseDueAt={detail.responseDueAt}
                  canManageTarget={canManageTarget}
                  canManageSource={canManageSource}
                  replyOutcomes={replyOutcomes}
                  linkableCases={linkableCases}
                  linkedCaseNumber={detail.targetCaseNumber}
                />
              </div>
            )}

          {/* Discard an UNSENT draft. Source-commission coordinator only — the
              same authority that sends/withdraws — and only while `draft`, which
              is also pinned server-side by the delete. A draft has no recipient
              yet, so this is the one referral state that can be removed outright
              rather than withdrawn. */}
          {detail.status === "draft" && canManageSource && (
            <div data-rise>
              <ReferralDraftDelete
                referralId={detail.id}
                org={org}
                commission={commission}
                sourceCaseId={detail.sourceCaseId}
                referralCode={formatReferralCode(detail.code)}
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

          {/* LGPD-erasure control (ADR 0052 §6). Rendered only when the
              `canDisposeReferralPhi` probe (which mirrors the RPC gate exactly:
              admin / source commission-admin / PQS operator of either endpoint
              hospital) returns true — so the destructive affordance never dangles
              for a caller the RPC would reject (BUG-NPH-002). The RPC stays the
              authoritative control. */}
          {canDisposePhi && (
            <div data-rise>
              <ReferralDisposeDialog referralId={detail.id} />
            </div>
          )}
        </div>
      </div>
    </SafetyMotion>
  );
}
