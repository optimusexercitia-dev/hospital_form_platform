import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  canDisposeReferralPhi,
  getReferralCaseAccessSummary,
  getReferralDetail,
  listReferralInternalNotes,
  listReferralReplyDocuments,
  listReplyOutcomes,
  referralsEnabled,
} from "@/lib/queries/referrals";
import { featureEnabled } from "@/lib/queries/feature-flags";
import { revealReferralPatient } from "@/lib/referrals/actions";
import { synthesizeThreadEvents } from "@/lib/referrals/thread-events";
import { patientXrefCount } from "@/lib/queries/patient-index";
import { listCasesBoard } from "@/lib/queries/cases";
import { listMembers } from "@/lib/queries/members";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { SafetyMotion } from "@/components/safety/safety-motion";
import {
  ReferralStatusChip,
  ReferralTypeChip,
} from "@/components/referrals/referral-chips";
import { ReferralSnapshot } from "@/components/referrals/referral-snapshot";
import { ReferralReplyView } from "@/components/referrals/referral-reply-view";
import { ReferralResolutions } from "@/components/referrals/referral-resolutions";
import { ReferralLineageCard } from "@/components/referrals/referral-lineage";
import { ReferralThread } from "@/components/referrals/referral-thread";
import { ReferralComposer } from "@/components/referrals/referral-composer";
import { ReferralActions } from "@/components/referrals/referral-actions";
import { canSetReferralDeadline } from "@/components/referrals/deadline-gate";
import type { LinkableTargetCase } from "@/components/referrals/referral-link-case-button";
import { ReferralPatientPanel } from "@/components/referrals/referral-patient-panel";
import { ReferralAssignmentPanel } from "@/components/referrals/referral-assignment-panel";
import { ReferralRelatedCasesPanel } from "@/components/referrals/referral-related-cases-panel";
import { ReferralInternalNotesPanel } from "@/components/referrals/referral-internal-notes-panel";
import { ReferralDetailsCard } from "@/components/referrals/referral-details-card";
import { ReferralCaseCard } from "@/components/referrals/referral-case-card";
import { ReferralDisposeDialog } from "@/components/referrals/referral-dispose-dialog";
import { ReferralDraftDelete } from "@/components/referrals/referral-draft-delete";
import { formatReferralCode } from "@/components/referrals/format";
import { RESOLVED_REFERRAL_STATUSES } from "@/lib/referrals/types";

export const metadata: Metadata = {
  title: "Encaminhamento",
};

/**
 * The referral detail (Decisions 1, 3, 4, 10, 16; redesigned by RDR) — the working
 * view for BOTH the source (A) and the target (B), opened from the hub or the
 * case-detail card.
 *
 * LAYOUT (RDR D1–D8). A MINIMAL header — back link, code, subject, Status + Type
 * chips — over a two-column body:
 *  - main column: A's description (sanitized Markdown, Rule 7) → the frozen SNAPSHOT
 *    → the messenger-style Diálogo with its gated composer and interleaved system
 *    events → the resolution history → "Registros internos" → the delivered reply;
 *  - rail: Ações → discard-draft → Detalhes → the lazy audited PHI panel →
 *    Responsáveis → the side's case card → Casos relacionados → lineage → LGPD
 *    disposal.
 * Every referral FACT the old header crammed into a `dl` now lives in the Detalhes
 * card; the direction chip is gone entirely.
 *
 * Two orderings are deliberate and easy to "fix" wrongly:
 *  - the PHI panel sits DIRECTLY under Detalhes, because "who is this about" is read
 *    together with "what is this" — not at the bottom of a long rail;
 *  - "Resposta da análise" sits LAST, under "Registros internos". It only exists once
 *    the referral is concluded, and by then it is the outcome the reader scrolls to,
 *    not an interruption between the dialogue and the working notes.
 * On mobile both column wrappers collapse to `contents` and the `order-N` classes
 * interleave the two columns into one sequence, so an order change here is a change
 * to BOTH layouts.
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

  const myCommissionId = access.commission.id;

  // RDR / plan amendment A9 — the LIVE DIRECTION BUG. `getReferralDetail`'s second
  // parameter is the viewer's commission and defaults to `null`; omitting it made
  // `direction` resolve `'outgoing'` for EVERY reader, so the receiving committee
  // was told its incoming referral was outbound. The hub list pages always passed
  // it; only this page did not.
  const detail = await getReferralDetail(referralId, myCommissionId);
  if (!detail) {
    notFound();
  }

  // Coordinator authority, RLS-backed (the RPCs re-check). A `staff_admin`
  // (member coordinator, or org_admin resolved to that role) manages only the end
  // that is THIS commission. A platform_admin is not a referral actor and was
  // already denied above.
  const canManageTarget =
    access.role === "staff_admin" &&
    detail.targetCommissionId === myCommissionId;
  const canManageSource =
    access.role === "staff_admin" &&
    detail.sourceCommissionId === myCommissionId;

  // DM4 (ADR 0114 Wave C) — the document lane.
  //
  // ⚠ This page used to PRE-SIGN here, at render: one signed URL per shared
  // document and one per reply attachment, handed down as `href` maps. Both are
  // gone (F-14). A PHI signature lives 120 s (ADR 0114 O4), so a URL minted
  // while the page streams is dead before the reader reaches it — and signing on
  // render hands out bytes for files nobody asked for, with no audited open to
  // show for it. Both corridors are now CLICK-time actions inside their own
  // client islands; no storage coordinate leaves the server.
  //
  // `documents_wave_c` gates the CORRIDOR, not its last step:
  //
  //   | affordance                        | flag OFF                    |
  //   | shared-document rows              | rendered, inert + explained |
  //   | audited snapshot open             | ABSENT                      |
  //   | `listReferralReplyDocuments` call | NOT MADE                    |
  //   | reply-attachment list             | empty                       |
  //   | upload control (begin → PUT)      | ABSENT — no trigger exists  |
  //
  // The query is skipped rather than called-and-ignored: with the flag off there
  // is no reply-document lane to read, and asking anyway would be a read whose
  // every row the byte door would then refuse.
  const documentsWaveC = await featureEnabled("documents_wave_c");
  const replyDocuments = documentsWaveC
    ? await listReferralReplyDocuments(detail.id)
    : [];

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

  // RV2 R5 private "Registros internos" (side-private; the K-R5-1 keystone). The
  // viewer's OWN committee side is the referral's source OR target commission that
  // equals the route's commission; a viewer of neither side (e.g. a QPS drill-in) has
  // `null` and the door already returns `[]` for them. The audited door returns only
  // the caller's-side registros, so passing them to the panel never crosses the wall.
  const myNoteCommitteeId =
    myCommissionId === detail.sourceCommissionId ||
    myCommissionId === detail.targetCommissionId
      ? myCommissionId
      : null;

  // RDR D3: the case THIS side is working from — the source's originating case
  // (always present) or the target's linked case (null until "Vincular caso").
  const isSourceSide = myCommissionId === detail.sourceCommissionId;
  const sideCaseId = myNoteCommitteeId
    ? isSourceSide
      ? detail.sourceCaseId
      : detail.targetCaseId
    : null;
  const sideCaseNumber = isSourceSide
    ? detail.sourceCaseNumber
    : detail.targetCaseNumber;

  const [internalNotes, caseAccessSummary] = await Promise.all([
    myNoteCommitteeId
      ? listReferralInternalNotes(detail.id)
      : Promise.resolve([]),
    // The audited access door is asked ONLY when this side actually has a case —
    // it emits `referral.case_access_summary_viewed`, so an unnecessary call would
    // be unnecessary audit noise (and it returns null anyway).
    myNoteCommitteeId && sideCaseId
      ? getReferralCaseAccessSummary(detail.id, myNoteCommitteeId)
      : Promise.resolve(null),
  ]);

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

  // The two coordinator controls that live on the card they act on rather than in
  // "Ações". Both mirror an RPC gate exactly — `link_referral_case` accepts only the
  // target coordinator while accepted/in-review (the same predicate that decided
  // whether `linkableCases` was loaded at all), and the deadline gate is the shared
  // `canSetReferralDeadline`, never a second hand-copied status list.
  const canLinkCase = canManageTarget && inReview;
  const canSetDeadline = canSetReferralDeadline({
    status: detail.status,
    canManageTarget,
    canManageSource,
  });

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

  // RDR D3: the non-coordinator case route. A pre-built STRING — never a builder
  // function handed to a client component (that is a server reference crossing the
  // RSC boundary, a recurring crash in this repo).
  const sideCaseHref = sideCaseId
    ? commissionHref(org, commission, "casos", sideCaseId)
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

  // RDR D7: the system rows interleaved into the Diálogo. Pure derivation from
  // fields the audited detail door already returned — no new table, no extra read.
  const threadEvents = synthesizeThreadEvents(detail);

  return (
    <SafetyMotion runKey={detail.id} className="flex flex-col gap-8">
      {/* RDR D1 — the MINIMAL header. Everything the old `dl` carried (origin →
          destination, case numbers, SLA, created/sent line, the decline banner) now
          lives in the rail's Detalhes card; the direction chip is gone. */}
      <header data-rise className="flex flex-col gap-4">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Encaminhamentos
        </Link>
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
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        {/* MAIN — the narrative surfaces. On mobile both wrappers collapse to
            `contents` so the two columns INTERLEAVE by `order-N` into one calm
            sequence (the case-detail pattern); on `lg` each becomes its own flex
            column again and `order-none` restores source order. */}
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          {/* A's free-text description (sanitized Markdown — Rule 7). */}
          {detail.descriptionMd?.trim() ? (
            <section
              data-rise
              aria-labelledby="referral-description-heading"
              className="order-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs lg:order-none"
            >
              <h2
                id="referral-description-heading"
                className="text-base font-semibold"
              >
                Descrição
              </h2>
              <MarkdownRenderer content={detail.descriptionMd} />
            </section>
          ) : null}

          {/* The frozen snapshot B reads. */}
          <div data-rise className="order-6 lg:order-none">
            <ReferralSnapshot
              sharedItems={detail.sharedItems}
              canOpenDocuments={documentsWaveC}
            />
          </div>

          {/* RV2 R1 + RDR D7: the two-way dialogue as a messenger timeline —
              committee-aligned bubbles with the synthesized lifecycle events
              interleaved — plus the side/status-gated composer. The read thread is
              server-rendered (PHI-safe: a restricted body shows a placeholder, never
              the text); the composer is a client island shown only to an authorized
              side while the referral is non-terminal. */}
          <div data-rise className="order-9 lg:order-none">
            <ReferralThread
              messages={detail.messages}
              events={threadEvents}
              readReceipts={detail.readReceipts}
              viewerUserId={access.context.userId}
              viewerCommissionId={myNoteCommitteeId}
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

          {/* RV2 R3: the append-only resolution history (renders nothing until the
              source first resolves). */}
          {detail.resolutions.length > 0 ? (
            <div data-rise className="order-10 lg:order-none">
              <ReferralResolutions resolutions={detail.resolutions} />
            </div>
          ) : null}

          {/* RV2 R5 / RDR D6: the PRIVATE per-committee "Registros internos"
              (K-R5-1) — visible only to the viewer's own side; renders nothing for a
              QPS/neither-side reader. */}
          {myNoteCommitteeId ? (
            <div data-rise className="order-12 lg:order-none">
              <ReferralInternalNotesPanel
                referralId={detail.id}
                committeeId={myNoteCommitteeId}
                notes={internalNotes}
                members={assignMembers}
                viewerUserId={access.context.userId}
                canCreate={true}
                canManage={canManageEitherSide}
                canRedact={canManageEitherSide}
              />
            </div>
          ) : null}

          {/* "Resposta da análise" — the delivered reply, once concluded. LAST, below
              the registros: it is the outcome the reader ends on, not an interruption
              between the dialogue and this side's working notes. */}
          {detail.reply ? (
            <div data-rise className="order-12 lg:order-none">
              <ReferralReplyView
                reply={detail.reply}
                replyDocuments={replyDocuments}
              />
            </div>
          ) : null}
        </div>

        {/* RAIL — the fact + control surfaces (RDR D1–D4). */}
        <div className="contents lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-8">
          {/* Entitled coordinator actions — wrapper omitted when null to avoid a
              phantom flex gap that misaligns the right column with the left.
              Rendered while in flight AND when `resolved` (so the source may
              REOPEN — RV2 R3; `resolved` is otherwise terminal). The component
              itself no-ops to null when nothing is actionable for this viewer. */}
          {(canManageTarget || canManageSource) &&
          (inFlight || detail.status === "resolved") ? (
            <div data-rise className="order-1 lg:order-none">
              <ReferralActions
                referralId={detail.id}
                status={detail.status}
                responseExpected={detail.responseExpected}
                responseDueAt={detail.responseDueAt}
                canManageTarget={canManageTarget}
                canManageSource={canManageSource}
                replyOutcomes={replyOutcomes}
                // DM4 (R1): the reply dialog's upload control. `enabled` is the
                // flag as the SERVER resolved it — with it false the control is
                // not rendered, so `begin` has no trigger and no bytes can land.
                replyAttachments={{
                  enabled: documentsWaveC,
                  documents: replyDocuments,
                }}
                // The Detalhes card below carries the deadline control, beside the
                // deadline it changes — rendering it here too would double it.
                showDeadlineControl={false}
              />
            </div>
          ) : null}

          {/* Discard an UNSENT draft. Source-commission coordinator only — the
              same authority that sends/withdraws — and only while `draft`, which
              is also pinned server-side by the delete. A draft has no recipient
              yet, so this is the one referral state that can be removed outright
              rather than withdrawn. */}
          {detail.status === "draft" && canManageSource ? (
            <div data-rise className="order-2 lg:order-none">
              <ReferralDraftDelete
                referralId={detail.id}
                org={org}
                commission={commission}
                sourceCaseId={detail.sourceCaseId}
                referralCode={formatReferralCode(detail.code)}
              />
            </div>
          ) : null}

          {/* RDR D1: the referral's core facts, plus the deadline control. */}
          <div data-rise className="order-3 lg:order-none">
            <ReferralDetailsCard
              detail={detail}
              canSetDeadline={canSetDeadline}
            />
          </div>

          {/* Lazy, audited isolated-PHI panel — directly under Detalhes: "who is this
              about" belongs beside "what is this". The reveal is still a click, and
              still the audited door. */}
          <div data-rise className="order-4 lg:order-none">
            <ReferralPatientPanel
              hasPatient={detail.hasPatient}
              onReveal={revealPatient}
              appearsInCount={appearsInCount}
            />
          </div>

          {/* RV2 R4 / RDR D2: WHO is responsible. PHI-free governance metadata
              visible to any reader; the coordinator of the viewer's side gets the
              write controls. */}
          <div data-rise className="order-7 lg:order-none">
            <ReferralAssignmentPanel
              referralId={detail.id}
              assignments={detail.assignments}
              canManage={canManageEitherSide}
              myCommissionId={myCommissionId}
              members={assignMembers}
            />
          </div>

          {/* RDR D3: the case THIS side is working from. A pointer only — the card
              opens it when `can_read_case` is true and otherwise names who can. Not
              rendered for a neither-side (QPS) reader, who has no "own" case here. */}
          {myNoteCommitteeId ? (
            <div data-rise className="order-8 lg:order-none">
              <ReferralCaseCard
                heading={isSourceSide ? "Caso de origem" : "Caso em análise"}
                headingId="referral-side-case-heading"
                caseId={sideCaseId}
                caseNumber={sideCaseNumber}
                caseHref={sideCaseHref}
                summary={caseAccessSummary}
                emptyHint={
                  canLinkCase
                    ? 'Use "Vincular caso" para associar um caso desta comissão.'
                    : undefined
                }
                linkCase={
                  canLinkCase
                    ? { referralId: detail.id, cases: linkableCases }
                    : undefined
                }
              />
            </div>
          ) : null}

          {/* RV2 R4 / RDR D4: TYPED related-case pointers (kept, moved to the rail). */}
          <div data-rise className="order-11 lg:order-none">
            <ReferralRelatedCasesPanel
              referralId={detail.id}
              links={detail.links}
              canManage={canManageEitherSide}
              myCommissionId={myCommissionId}
              relatableCases={relatableCases}
            />
          </div>

          {/* RV2 R3: lineage — parent back-link + "Encaminhar adiante" forward
              affordance. Renders nothing when neither applies. */}
          {parentHref || forwardHref ? (
            <div data-rise className="order-12 lg:order-none">
              <ReferralLineageCard
                parentHref={parentHref}
                forwardHref={forwardHref}
              />
            </div>
          ) : null}

          {/* LGPD-erasure control (ADR 0052 §6). Rendered only when the
              `canDisposeReferralPhi` probe (which mirrors the RPC gate exactly:
              admin / source commission-admin / PQS operator of either endpoint
              hospital) returns true — so the destructive affordance never dangles
              for a caller the RPC would reject (BUG-NPH-002). The RPC stays the
              authoritative control. */}
          {canDisposePhi ? (
            <div data-rise className="order-12 lg:order-none">
              <ReferralDisposeDialog referralId={detail.id} />
            </div>
          ) : null}
        </div>
      </div>
    </SafetyMotion>
  );
}
