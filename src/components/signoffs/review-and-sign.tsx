"use client";

import { useMemo } from "react";
import { User } from "lucide-react";

import type { Json } from "@/lib/types/database";
import type { Item, Section } from "@/lib/queries/forms";
import type { AnswerMap } from "@/lib/queries/conditions";
import {
  ImageContentRenderer,
  SectionTextRenderer,
} from "@/components/forms/read-only-blocks";
import { AnswerSummary } from "@/components/responses/wizard/answer-summary";
import {
  computeEffectiveVisibility,
  isInputItem,
} from "@/components/responses/wizard/effective-visibility";

import type { ClientResponseForSignoff, SectionSignoff } from "./types";
import { SignoffStatus } from "./signoff-status";
import { SignSectionPanel } from "./sign-section-panel";

/**
 * Review-and-sign screen (F2). Renders the FULL response read-only — every
 * VISIBLE section with the respondent's saved answers, so the coordinator can
 * review context before counter-signing — and attaches the sign affordance to
 * the `staff_admin`-role sign-off section(s). The signature is recorded
 * per-section via `signSection` (injected as a prop, route-page adapter).
 *
 * Visibility is computed from saved answers with the SAME `evalCondition` the
 * wizard uses (Rule 3 — one mirrored evaluator); hidden sections are not shown
 * (and the server never read their answers anyway).
 */
export function ReviewAndSign({
  data,
  imageUrls,
  isAdminViewer,
  onSign,
}: {
  data: ClientResponseForSignoff;
  imageUrls: Record<string, string>;
  /** A global admin viewing the queue is not a "chefia" signer in the UI copy. */
  isAdminViewer?: boolean;
  onSign: (input: {
    responseId: string;
    sectionId: string;
    note: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const sections = data.tree.sections;
  const isFlat = sections.length === 1 && sections[0].isDefault;

  // Build the question_key → value map for condition evaluation from saved
  // answers (keyed by item id) joined to the tree's stable question_keys.
  const answerMap = useMemo<AnswerMap>(() => {
    const map: AnswerMap = {};
    for (const section of sections) {
      for (const item of section.items) {
        if (!item.questionKey) continue;
        const value = data.answersByItemId[item.id];
        if (value === undefined) continue;
        map[item.questionKey] = value as Json;
      }
    }
    return map;
  }, [sections, data.answersByItemId]);

  // One forward pass drives both section AND item visibility (mirror of submit).
  const { visibleSectionIds, visibleItemIds } = useMemo(
    () => computeEffectiveVisibility(sections, answerMap),
    [sections, answerMap],
  );
  const visibleSections = useMemo(
    () => sections.filter((s) => visibleSectionIds.has(s.id)),
    [sections, visibleSectionIds],
  );

  return (
    <div className="flex flex-col gap-6">
      <RespondentContext data={data} />

      <div className="flex flex-col gap-4">
        {visibleSections.map((section, index) => (
          <ReviewSection
            key={section.id}
            section={section}
            index={index}
            isFlat={isFlat}
            answersByItemId={data.answersByItemId}
            visibleItemIds={visibleItemIds}
            imageUrls={imageUrls}
            existingSignoff={data.signoffsBySectionId[section.id] ?? null}
            responseId={data.responseId}
            isAdminViewer={isAdminViewer}
            onSign={onSign}
          />
        ))}
      </div>
    </div>
  );
}

/** Per-respondent context banner — who filled this, and when. */
function RespondentContext({ data }: { data: ClientResponseForSignoff }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/30 p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <User aria-hidden="true" className="size-4 text-muted-foreground" />
        Resposta de {data.respondentName}
      </div>
      <p className="text-sm text-muted-foreground">
        Iniciada em {formatDate(data.startedAt)} · Atualizada em{" "}
        {formatDate(data.updatedAt)}
      </p>
    </div>
  );
}

function ReviewSection({
  section,
  index,
  isFlat,
  answersByItemId,
  visibleItemIds,
  imageUrls,
  existingSignoff,
  responseId,
  isAdminViewer,
  onSign,
}: {
  section: Section;
  index: number;
  isFlat: boolean;
  answersByItemId: Record<string, Json>;
  visibleItemIds: Set<string>;
  imageUrls: Record<string, string>;
  existingSignoff: SectionSignoff | null;
  responseId: string;
  isAdminViewer?: boolean;
  onSign: (input: {
    responseId: string;
    sectionId: string;
    note: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const headingId = `signoff-section-${section.id}`;
  // A named default section shows its title (lead refinement #2); an untitled
  // default keeps the neutral "Respostas" heading whether flat or sectioned.
  const heading =
    section.title || (section.isDefault ? "Respostas" : "Seção sem título");
  const showSectionNumber = !(section.isDefault && isFlat);

  const isStaffAdminSignoff =
    section.requiresSignoff && section.signoffRole === "staff_admin";
  const isRespondentSignoff =
    section.requiresSignoff && section.signoffRole === "respondent";

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {showSectionNumber && (
            <span className="text-xs font-medium text-muted-foreground">
              Seção {index + 1}
            </span>
          )}
          {section.requiresSignoff && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
              assinatura
            </span>
          )}
        </div>
        <h2 id={headingId} className="text-lg font-semibold">
          {heading}
        </h2>
        {section.description && (
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            {section.description}
          </p>
        )}
      </div>

      <SectionBody
        section={section}
        answersByItemId={answersByItemId}
        visibleItemIds={visibleItemIds}
        imageUrls={imageUrls}
      />

      {/* Respondent sign-off sections: show status only (signed via the wizard). */}
      {isRespondentSignoff && (
        <SignoffStatus
          signoff={existingSignoff}
          role="respondent"
          isRespondent={false}
        />
      )}

      {/* staff_admin sign-off sections: the sign affordance (or, for an admin
          viewer, the read-only status — admins observe, coordinators sign). */}
      {isStaffAdminSignoff &&
        (isAdminViewer ? (
          <SignoffStatus signoff={existingSignoff} role="staff_admin" />
        ) : (
          <SignSectionPanel
            responseId={responseId}
            sectionId={section.id}
            existing={existingSignoff}
            onSign={onSign}
          />
        ))}
    </section>
  );
}

/** The section's blocks: display blocks rendered faithfully, inputs as answers.
 *  Input items hidden by an item-level condition are omitted. */
function SectionBody({
  section,
  answersByItemId,
  visibleItemIds,
  imageUrls,
}: {
  section: Section;
  answersByItemId: Record<string, Json>;
  visibleItemIds: Set<string>;
  imageUrls: Record<string, string>;
}) {
  const items = section.items.filter(
    (it) => !isInputItem(it.itemType) || visibleItemIds.has(it.id),
  );

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Esta seção não tem conteúdo.
      </p>
    );
  }

  return (
    <dl className="flex flex-col gap-1">
      {items.map((item) =>
        isInputItem(item.itemType) ? (
          <AnswerSummary
            key={item.id}
            item={item}
            value={(answersByItemId[item.id] as Json | undefined) ?? undefined}
          />
        ) : (
          <DisplayBlock key={item.id} item={item} imageUrls={imageUrls} />
        ),
      )}
    </dl>
  );
}

/** A display block (section_text / image) rendered read-only. */
function DisplayBlock({
  item,
  imageUrls,
}: {
  item: Item;
  imageUrls: Record<string, string>;
}) {
  if (item.itemType === "section_text" && item.content) {
    return (
      <div className="py-2.5">
        <SectionTextRenderer content={item.content} />
      </div>
    );
  }
  if (item.itemType === "image" && item.content) {
    return (
      <div className="py-2.5">
        <ImageContentRenderer content={item.content} imageUrls={imageUrls} />
      </div>
    );
  }
  return null;
}

/** Format an ISO timestamp as a pt-BR date + time. */
function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
