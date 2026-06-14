import { CalendarCheck } from "lucide-react";

import type { Json } from "@/lib/types/database";
import type { Item, Section, VersionTree } from "@/lib/queries/forms";
import type { SignoffRecord } from "@/lib/queries/signoffs";
import { evalCondition } from "@/lib/queries/conditions";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import {
  ImageContentRenderer,
  SectionTextRenderer,
} from "@/components/forms/read-only-blocks";
import { AnswerSummary } from "@/components/responses/wizard/answer-summary";

/** pt-BR date + time for sign-off metadata. */
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

/**
 * Version-faithful, read-only render of ONE submitted response (F5).
 *
 * It composes the existing read-only renderers so the view never drifts from
 * the wizard / builder:
 *  - display blocks (`section_text`, `image`) via `read-only-blocks`;
 *  - input items with their SAVED value via the wizard's `AnswerSummary`
 *    (unanswered optionals render "Sem resposta" — blank);
 *  - `question_explanation` shown as muted helper text under the question.
 *
 * Version-faithfulness: the `tree` is the response's OWN version (v1 stays v1
 * after v2 publishes). Sections hidden by a condition under THIS response's own
 * answers (`evalCondition` over `answersByKey` — the same TS evaluator the
 * wizard uses) render as "não aplicável", collecting nothing. Sign-off metadata
 * (who/when/note) is shown per signed section.
 *
 * Server-Component-safe: `AnswerSummary` is presentational, and all inputs are
 * plain props from the query layer.
 */
export function SubmissionDetailView({
  tree,
  answersByItemId,
  answersByKey,
  signoffs,
  imageUrls,
}: {
  tree: VersionTree;
  answersByItemId: Record<string, Json>;
  answersByKey: Record<string, Json>;
  signoffs: SignoffRecord[];
  imageUrls: Record<string, string>;
}) {
  const sections = tree.sections;
  const isFlat = sections.length === 1 && sections[0].isDefault;
  const signoffsBySection = new Map(signoffs.map((s) => [s.sectionId, s]));

  if (isFlat) {
    return (
      <div className="flex flex-col gap-4">
        <SectionBody
          section={sections[0]}
          answersByItemId={answersByItemId}
          imageUrls={imageUrls}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section, index) => {
        const visible = evalCondition(section.visibleWhen, answersByKey);
        return (
          <DetailSection
            key={section.id}
            section={section}
            index={index}
            visible={visible}
            answersByItemId={answersByItemId}
            signoff={signoffsBySection.get(section.id) ?? null}
            imageUrls={imageUrls}
          />
        );
      })}
    </div>
  );
}

function DetailSection({
  section,
  index,
  visible,
  answersByItemId,
  signoff,
  imageUrls,
}: {
  section: Section;
  index: number;
  visible: boolean;
  answersByItemId: Record<string, Json>;
  signoff: SignoffRecord | null;
  imageUrls: Record<string, string>;
}) {
  const headingId = `submission-section-${section.id}`;
  const heading =
    section.title || (section.isDefault ? "Respostas" : "Seção sem título");

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Seção {index + 1}
          </span>
          {section.visibleWhen && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              condicional
            </span>
          )}
          {section.requiresSignoff && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
              assinatura
            </span>
          )}
          {!visible && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              não aplicável
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

      {visible ? (
        <>
          <SectionBody
            section={section}
            answersByItemId={answersByItemId}
            imageUrls={imageUrls}
          />
          {section.requiresSignoff && <SignoffMeta signoff={signoff} />}
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
          Esta seção não se aplicava às respostas e não foi preenchida.
        </p>
      )}
    </section>
  );
}

/**
 * One visible section's body: its ordered blocks. Display blocks render their
 * content; input items render their label + saved value (blank where
 * unanswered) + explanation.
 */
function SectionBody({
  section,
  answersByItemId,
  imageUrls,
}: {
  section: Section;
  answersByItemId: Record<string, Json>;
  imageUrls: Record<string, string>;
}) {
  if (section.items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
        Seção sem blocos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {section.items.map((item) => (
        <DetailBlock
          key={item.id}
          item={item}
          value={answersByItemId[item.id]}
          imageUrls={imageUrls}
        />
      ))}
    </div>
  );
}

/** One block rendered read-only, faithful to its type, with its saved answer. */
function DetailBlock({
  item,
  value,
  imageUrls,
}: {
  item: Item;
  value: Json | undefined;
  imageUrls: Record<string, string>;
}) {
  if (item.itemType === "section_text" && item.content) {
    return <SectionTextRenderer content={item.content} />;
  }
  if (item.itemType === "image" && item.content) {
    return <ImageContentRenderer content={item.content} imageUrls={imageUrls} />;
  }

  // Input item: label + type tag + explanation + the saved value.
  const meta = ITEM_TYPE_META[item.itemType];
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4">
      <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {meta.label}
      </span>
      {item.questionExplanation && (
        <p className="text-sm text-muted-foreground">
          {item.questionExplanation}
        </p>
      )}
      <dl>
        <AnswerSummary item={item} value={value} />
      </dl>
    </article>
  );
}

/** Per-section sign-off metadata (who/when/note), read-only. */
function SignoffMeta({ signoff }: { signoff: SignoffRecord | null }) {
  if (!signoff) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Sem assinatura registrada.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-accent/30 px-4 py-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <CalendarCheck aria-hidden="true" className="size-4 text-primary" />
        Assinada por {signoff.signedByName ?? "membro"}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatDateTime(signoff.signedAt)}
      </p>
      {signoff.note && (
        <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/90">
          {signoff.note}
        </p>
      )}
    </div>
  );
}
