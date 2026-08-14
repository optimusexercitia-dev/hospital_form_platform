import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarClock } from "lucide-react";

import { getTechnicalDirectionAccessByOrg } from "@/lib/queries/session";
import {
  getReferralAttachmentUrl,
  getReferralDetail,
  getReferralDocumentUrl,
  listReplyOutcomes,
  referralsEnabled,
} from "@/lib/queries/referrals";
import { getFeatureFlags } from "@/lib/queries/feature-flags";
import { RESOLVED_REFERRAL_STATUSES } from "@/lib/referrals/types";
import { synthesizeThreadEvents } from "@/lib/referrals/thread-events";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { SafetyMotion } from "@/components/safety/safety-motion";
import {
  ReferralOverdueChip,
  ReferralPriorityChip,
  ReferralRequestedActionChip,
  ReferralStatusChip,
  ReferralTypeChip,
  ResponseExpectedChip,
} from "@/components/referrals/referral-chips";
import { ReferralSnapshot } from "@/components/referrals/referral-snapshot";
import { ReferralReplyView } from "@/components/referrals/referral-reply-view";
import { ReferralThread } from "@/components/referrals/referral-thread";
import { ReferralComposer } from "@/components/referrals/referral-composer";
import { ReferralActions } from "@/components/referrals/referral-actions";
import { ReferralResolutions } from "@/components/referrals/referral-resolutions";
import { formatDateTime, formatReferralCode } from "@/components/referrals/format";

export const metadata: Metadata = {
  title: "Encaminhamento — Direção técnica",
};

/**
 * One referral, read and acted on by the Diretor Técnico (ADR 0094 W4 / FUP-MEM-3b).
 *
 * ⚠ This is NOT a fork of the commission detail page, and the difference is the
 * domain's, not a simplification. The DT holds no committee, so four of that page's
 * panels are unreachable for them BY GATE, not by choice:
 *   - internal notes — `can_read_referral_internal_note` requires membership of the
 *     note's own committee;
 *   - assignments — `referral_assignments` is commission-scoped;
 *   - related-case links / "encaminhar adiante" — both need a case board and a source
 *     commission the office does not have;
 *   - the draft affordances — a DT can never author a referral, since
 *     `create_referral_draft` gates the send on coordinating the SOURCE commission.
 * Rendering any of them would be an affordance that can only fail. What remains — the
 * snapshot, the dialogue, the reply, the resolutions, and the target-side lifecycle —
 * is the whole of the office's job.
 *
 * Authority: the DT is always the TARGET side, never the source. `295` §4 proves the
 * titular AND the deputy drive the full target lifecycle (receive → accept →
 * start_review → request_information → reply) on the same status machine, which is why
 * `canManageTarget` is true for both and nothing here branches on `role`.
 *
 * Gating is defence-in-depth and the LAST line is the database: this page checks the
 * caller holds the direction of the referral's target hospital, but `get_referral_detail`
 * re-derives the same thing server-side (its `can_compose_as_target` carries an
 * `is_technical_director_of_for` arm) and RLS re-gates every read underneath.
 */
export default async function TechnicalDirectionReferralPage({
  params,
}: {
  params: Promise<{ org: string; referralId: string }>;
}) {
  const [{ org, referralId }, flagOn, flags] = await Promise.all([
    params,
    referralsEnabled(),
    getFeatureFlags(),
  ]);

  if (!flagOn || flags.technical_director !== true) {
    notFound();
  }

  const access = await getTechnicalDirectionAccessByOrg(org);
  if (!access) {
    notFound();
  }

  // `null` is correct and deliberate here, not an omission: a técnica-direção referral
  // has no target COMMISSION to align a viewer against, and this page never renders
  // `detail.direction`. Passed explicitly because the parameter is required — see the
  // A9 note on `getReferralDetail`.
  const detail = await getReferralDetail(referralId, null);
  if (!detail) {
    notFound();
  }

  // The referral must be addressed to the technical direction OF A HOSPITAL THIS CALLER
  // HOLDS. Without the second half, any DT could open any other hospital's DT referral
  // by id — RLS would still refuse the underlying reads, but the page would render a
  // shell that implies otherwise.
  const holdsTargetHospital = access.hospitals.some(
    (h) => h.hospital.id === detail.targetHospitalId,
  );
  if (detail.targetType !== "technical_director" || !holdsTargetHospital) {
    notFound();
  }

  const [replyOutcomes, documentUrlEntries, attachmentUrlEntries] =
    await Promise.all([
      listReplyOutcomes(),
      Promise.all(
        detail.sharedItems
          .filter((i) => i.kind === "document")
          .map(async (i) => [i.id, await getReferralDocumentUrl(i.id)] as const),
      ),
      Promise.all(
        (detail.reply?.attachments ?? []).map(
          async (a) => [a.id, await getReferralAttachmentUrl(a.id)] as const,
        ),
      ),
    ]);
  const documentUrls = Object.fromEntries(documentUrlEntries);
  const attachmentUrls = Object.fromEntries(attachmentUrlEntries);

  const inFlight = !RESOLVED_REFERRAL_STATUSES.has(detail.status);
  const backHref = `/o/${org}/direcao-tecnica`;

  // D9: on a DT referral the waiting party is a HOSPITAL, not a committee — the
  // commission page's committee-only label would read "nobody is waiting" here, which
  // is exactly the ambiguity `waiting_on_hospital_id` was added to remove.
  const waitingOnLabel =
    detail.status === "awaiting_information"
      ? detail.waitingOnHospitalId
        ? "Aguardando a direção técnica."
        : `Aguardando informações da comissão de origem (${detail.sourceCommissionName ?? "origem"}).`
      : null;

  return (
    <SafetyMotion runKey={detail.id} className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header data-rise className="flex flex-col gap-4">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Encaminhamentos à direção técnica
        </Link>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {formatReferralCode(detail.code)}
          </span>
          <h1 className="text-3xl text-balance">{detail.subject}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReferralStatusChip status={detail.status} />
          <ReferralTypeChip
            label={detail.typeLabel}
            colorToken={detail.typeColorToken}
          />
          <ReferralPriorityChip priority={detail.priority} />
          {detail.requestedActionLabel && (
            <ReferralRequestedActionChip label={detail.requestedActionLabel} />
          )}
          {detail.responseExpected && inFlight && <ResponseExpectedChip />}
          {detail.overdue && <ReferralOverdueChip />}
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Building2 aria-hidden="true" className="size-4" />
            <dt className="sr-only">Comissão de origem</dt>
            <dd>{detail.sourceCommissionName ?? "Comissão de origem"}</dd>
          </div>
          {detail.responseDueAt && (
            <div className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden="true" className="size-4" />
              <dt className="sr-only">Prazo de resposta</dt>
              <dd>{formatDateTime(detail.responseDueAt)}</dd>
            </div>
          )}
        </dl>
      </header>

      {detail.descriptionMd && (
        <section
          data-rise
          aria-labelledby="dt-referral-description"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-xs"
        >
          <h2 id="dt-referral-description" className="text-lg font-semibold">
            Descrição
          </h2>
          <MarkdownRenderer content={detail.descriptionMd} />
        </section>
      )}

      <div data-rise>
        <ReferralSnapshot
          sharedItems={detail.sharedItems}
          documentUrls={documentUrls}
        />
      </div>

      <div data-rise>
        <ReferralThread
          messages={detail.messages}
          // RDR D7: the same synthesized lifecycle rows the commission-side detail
          // interleaves — derived from fields this door already returned.
          events={synthesizeThreadEvents(detail)}
          readReceipts={detail.readReceipts}
          viewerUserId={access.context.userId}
          // A technical-direction referral has NO target commission
          // (`target_commission_id IS NULL`, ADR 0094 W4), and the Diretor Técnico
          // reads it as a hospital officer rather than as a committee. There is no
          // "my side" to align bubbles to, so every message renders as incoming —
          // the sender committee's name still labels each one.
          viewerCommissionId={null}
          canRedact={false}
          waitingOnLabel={waitingOnLabel}
          composer={
            inFlight && detail.canComposeAsTarget ? (
              <ReferralComposer
                referralId={detail.id}
                status={detail.status}
                canComposeAsTarget={detail.canComposeAsTarget}
                canComposeAsSource={false}
              />
            ) : null
          }
        />
      </div>

      {detail.reply && (
        <div data-rise>
          <ReferralReplyView
            reply={detail.reply}
            attachmentUrls={attachmentUrls}
          />
        </div>
      )}

      {detail.resolutions.length > 0 && (
        <div data-rise>
          <ReferralResolutions resolutions={detail.resolutions} />
        </div>
      )}

      <div data-rise>
        {/* This page has no Detalhes / case card to host them, so "Ações" stays this
            referral's only control surface and keeps the deadline control (the
            default). "Vincular caso" is NOT missing: a technical-direction referral
            has no target commission (ADR 0094 W4), so `link_referral_case` could
            never accept one — the control was always dead here. */}
        <ReferralActions
          referralId={detail.id}
          status={detail.status}
          responseExpected={detail.responseExpected}
          responseDueAt={detail.responseDueAt}
          canManageTarget
          canManageSource={false}
          replyOutcomes={replyOutcomes}
        />
      </div>
    </SafetyMotion>
  );
}
