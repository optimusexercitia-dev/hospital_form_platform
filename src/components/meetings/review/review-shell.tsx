"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ListChecks } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { saveMinutesDraft } from "@/lib/minutes-jobs/actions";
import type {
  MinutesApplyCounts,
  MinutesDraft,
  MinutesDraftActionItem,
  MinutesDraftAgendaItem,
  MinutesDraftLooseResolution,
} from "@/lib/minutes-jobs/types";
import type { CommissionMeetingType } from "@/lib/queries/meetings";
import type { MemberListItem } from "@/lib/queries/members";
import type { AssigneeOption } from "../action-item-form";
import { Button } from "@/components/ui/button";
import { RiseInGroup } from "@/components/motion/rise-in-group";
import { formatMeetingNumber } from "../format";
import { MINUTES_UI } from "../minutes-labels";
import { AtaEditor } from "./ata-editor";
import { AgendaReviewCard } from "./agenda-review-card";
import { ActionsReview } from "./actions-review";
import { SpeakersPanel } from "./speakers-panel";
import { TranscriptPanel } from "./transcript-panel";
import { ConcludeBar } from "./conclude-bar";
import { NextMeetingCard } from "./next-meeting-card";

const AUTOSAVE_DEBOUNCE_MS = 1_200;

/**
 * F3 — the review page's client orchestrator (ADR 0099 D12).
 *
 * Owns the whole `MinutesDraft` working copy and passes typed slices + setters down
 * (design brief §2.1: no context — every child owns one disjoint slice, there is exactly
 * one instance of this tree per page, so plain props are the simplest correct API).
 * Debounces `saveMinutesDraft` on every edit; on a successful "Concluir revisão" it
 * switches to an inline success view rather than navigating away itself — the
 * "Voltar à reunião" link is the one and only way back, carrying `?ata_aplicada=1` for
 * the meeting page's banner (design brief §7.5 / lead §9.5).
 */
export function ReviewShell({
  jobId,
  meetingId,
  org,
  slug,
  commissionId,
  meetingTitle,
  meetingNumber,
  currentMinutesMd,
  initialDraft,
  assignees,
  meetingTypes,
  members,
}: {
  jobId: string;
  meetingId: string;
  org: string;
  slug: string;
  commissionId: string;
  meetingTitle: string;
  meetingNumber: number;
  currentMinutesMd: string | null;
  initialDraft: MinutesDraft;
  assignees: AssigneeOption[];
  meetingTypes: CommissionMeetingType[];
  members: MemberListItem[];
}) {
  // `unassigned_resolutions` lives ON `draft` (not a sibling state) BY DESIGN:
  // `saveMinutesDraft` is a whole-column overwrite (backend fix cadc5da), so anything
  // held outside this one object would be destroyed by the very first autosave a few
  // seconds after the page opens. `attachResolution` below mutates both the target
  // agenda item AND `unassigned_resolutions` inside the SAME `setDraft` call for
  // exactly that reason.
  const [draft, setDraft] = useState<MinutesDraft>(initialDraft);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [applied, setApplied] = useState<MinutesApplyCounts | null>(null);
  const isFirstRender = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus the page heading on mount — a `Link` navigation into this route doesn't reset
  // focus like a full page load would (design brief §6.1 step 5).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Debounced autosave. Skips the very first render (that "change" is just the initial
  // seed, not an edit) and re-arms on every subsequent draft change.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      const result = await saveMinutesDraft(jobId, draft);
      setSaveStatus(result.ok ? "saved" : "error");
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, jobId]);

  function updateAgendaItem(next: MinutesDraftAgendaItem) {
    setDraft((d) => ({ ...d, agenda: d.agenda.map((i) => (i.key === next.key ? next : i)) }));
  }

  function updateActionItem(next: MinutesDraftActionItem) {
    setDraft((d) => ({
      ...d,
      action_items: d.action_items.map((i) => (i.key === next.key ? next : i)),
    }));
  }

  function attachResolution(agendaKey: string, resolution: MinutesDraftLooseResolution) {
    setDraft((d) => ({
      ...d,
      agenda: d.agenda.map((item) =>
        item.key === agendaKey
          ? {
              ...item,
              resolution: [item.resolution?.trim(), resolution.text]
                .filter((t): t is string => Boolean(t))
                .join("\n\n"),
            }
          : item,
      ),
      // Same `setDraft` call as the agenda update above — both must land in the ONE
      // saved object (see the field's own doc comment on `MinutesDraft`).
      unassigned_resolutions: d.unassigned_resolutions.filter((r) => r.key !== resolution.key),
    }));
  }

  const meetingHref = commissionHref(org, slug, "meetings", meetingId);
  const agendaOptions = draft.agenda
    .filter((a): a is MinutesDraftAgendaItem & { ref: string } => a.ref !== null)
    .map((a) => ({ ref: a.ref, title: a.title }));

  if (applied) {
    return (
      <div className="animate-fade-in mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-2 rounded-2xl border border-success/30 bg-success/10 p-5"
        >
          <span className="inline-flex items-center gap-2 font-medium text-success">
            <CheckCircle2 aria-hidden="true" className="size-5" />
            {MINUTES_UI.concludeSuccessBanner}
          </span>
          <p className="text-sm text-muted-foreground">
            {(applied.agendaUpdated + applied.agendaCreated).toString()} itens de pauta ·{" "}
            {applied.actionsCreated} itens de ação
            {applied.actionsUnassigned > 0 && ` (${applied.actionsUnassigned} sem responsável)`}
          </p>
        </div>

        <NextMeetingCard
          suggestion={draft.next_meeting}
          org={org}
          slug={slug}
          commissionId={commissionId}
          meetingTypes={meetingTypes}
          members={members}
        />

        <Button asChild size="lg" className="w-fit">
          <Link href={`${meetingHref}?ata_aplicada=1`}>{MINUTES_UI.reviewBackToMeeting}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 pb-24">
      <header className="flex flex-col gap-2">
        <Link
          href={meetingHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          {MINUTES_UI.reviewBackToMeeting}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold outline-none"
          >
            {MINUTES_UI.reviewHeading}
          </h1>
          <span
            role="status"
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {saveStatus === "saving" && MINUTES_UI.dirtySaving}
            {saveStatus === "saved" && MINUTES_UI.dirtySaved}
            {saveStatus === "error" && MINUTES_UI.dirtySaveFailed}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatMeetingNumber(meetingNumber)} — {meetingTitle}
        </p>
      </header>

      <RiseInGroup className="flex flex-col gap-6">
        <div data-rise>
          <AtaEditor
            value={draft.minutes_md}
            onChange={(minutes_md) => setDraft((d) => ({ ...d, minutes_md }))}
            currentMinutesMd={currentMinutesMd}
          />
        </div>

        <section
          data-rise
          aria-labelledby="revisao-ata-agenda-heading"
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <ListChecks aria-hidden="true" className="size-4 text-muted-foreground" />
            <h2 id="revisao-ata-agenda-heading" className="text-base font-semibold">
              {MINUTES_UI.agendaHeading}
            </h2>
          </div>

          {draft.unassigned_resolutions.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <p className="font-medium text-warning">{MINUTES_UI.looseResolutionsHeading}</p>
              <p className="mt-1 text-muted-foreground text-pretty">
                {MINUTES_UI.looseResolutionsBody}
              </p>
            </div>
          )}

          {draft.agenda.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              {MINUTES_UI.agendaNoItems}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {draft.agenda.map((item) => (
                <AgendaReviewCard
                  key={item.key}
                  item={item}
                  onChange={updateAgendaItem}
                  looseResolutions={draft.unassigned_resolutions}
                  onAttachResolution={(r) => attachResolution(item.key, r)}
                />
              ))}
            </ul>
          )}
        </section>

        <section
          data-rise
          aria-labelledby="revisao-ata-actions-heading"
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
        >
          <h2 id="revisao-ata-actions-heading" className="text-base font-semibold">
            {MINUTES_UI.actionsHeading}
          </h2>
          {draft.action_items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              {MINUTES_UI.actionsNoItems}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {draft.action_items.map((item) => (
                <ActionsReview
                  key={item.key}
                  item={item}
                  onChange={updateActionItem}
                  assignees={assignees}
                  agendaOptions={agendaOptions}
                />
              ))}
            </ul>
          )}
        </section>

        <div data-rise>
          <SpeakersPanel speakers={draft.speakers} />
        </div>

        <div data-rise>
          <TranscriptPanel jobId={jobId} />
        </div>
      </RiseInGroup>

      <ConcludeBar
        jobId={jobId}
        draft={draft}
        hasCurrentMinutes={(currentMinutesMd ?? "").trim().length > 0}
        onApplied={setApplied}
      />
    </div>
  );
}
