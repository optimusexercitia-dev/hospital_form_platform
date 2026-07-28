import { CalendarCheck } from "lucide-react";

import type { Json } from "@/lib/types/database";
import type { Item, Section, VersionTree } from "@/lib/queries/forms";
import type { SignoffRecord } from "@/lib/queries/signoffs";
import type {
  GroupInstance,
  ReferenceAnswer,
  RiskMatrixAnswer,
} from "@/lib/queries/responses";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import {
  ImageContentRenderer,
  SectionTextRenderer,
} from "@/components/forms/read-only-blocks";
import { AnswerSummary } from "@/components/responses/wizard/answer-summary";
import {
  InstanceAnswersReadonly,
  instancesByGroupItemId,
} from "@/components/responses/instance-answers-readonly";
import {
  computeEffectiveVisibility,
  isAnswerableItem,
  isMatrixItem,
} from "@/components/responses/wizard/effective-visibility";

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
 * after v2 publishes). Section AND item visibility is resolved by the SAME
 * document-order forward pass the wizard + submit RPC use
 * ({@link computeEffectiveVisibility} over `answersByKey`, group-safe): a hidden
 * SECTION renders "não aplicável" collecting nothing; a hidden ITEM is omitted
 * from its section body. Sign-off metadata (who/when/note) is shown per signed
 * section. Per-item observation notes (when provided) show as a muted line.
 *
 * Server-Component-safe: `AnswerSummary` is presentational, and all inputs are
 * plain props from the query layer.
 */
export function SubmissionDetailView({
  tree,
  answersByItemId,
  answersByKey,
  observationsByItemId,
  otherTextByItemId,
  matrixCellsByItemId,
  riskMatrixByItemId,
  referencesByItemId,
  instances,
  signoffs,
  imageUrls,
}: {
  /**
   * ⚠ BUG-FF5-002 — every answer-payload map below is REQUIRED, and none carries
   * a default. That is the fix, not a style preference.
   *
   * They were `?:` with `= {}` / `= []` defaults. The submissions page then
   * omitted `referencesByItemId`, which is not a type error for an optional
   * prop, so the default substituted an empty map and every top-level reference
   * on the permanent submitted record rendered "Sem resposta". tsc, lint, the
   * unit suite and `next build` are all structurally incapable of seeing that:
   * the omission is legal and the fallback is silent.
   *
   * The tell was the asymmetry — in-group references rendered fine, because they
   * ride `instances`, which WAS passed. One query object, two paths, one wired.
   *
   * So: an optional prop with a default is a type-system OPT-OUT. For data the
   * component cannot render correctly without, it must be required, so that
   * forgetting it fails the build instead of quietly blanking the screen. This
   * is the same reasoning already applied to `ClientResponseForSignoff`
   * (`signoffs/types.ts`) — applying it there and not here is what left the gap.
   *
   * A caller with genuinely nothing to pass writes `{}` / `[]` explicitly, which
   * is a deliberate statement rather than an oversight.
   */
  tree: VersionTree;
  answersByItemId: Record<string, Json>;
  answersByKey: Record<string, Json>;
  /** Per-item observation notes (form-builder-enhancements). */
  observationsByItemId: Record<string, string>;
  /** Per-item "Outros" free text ("Outros" open option); shown as
   *  "Outro: <valor>" beneath the answer where the reserved option was selected. */
  otherTextByItemId: Record<string, string>;
  /**
   * FF-2 (ADR 0089 - FUP-FF2-1) - the response TOP-LEVEL matrix grids and
   * risk answers. A matrix inside a repeating group is NOT here: it rides its
   * {@link GroupInstance}, exactly as scalar answers do.
   */
  matrixCellsByItemId: Record<string, Record<string, string>>;
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>;
  /**
   * FF-5 (ADR 0091) - the response's TOP-LEVEL entity references, labels
   * already resolved by live join (ruling 4). A reference inside a
   * repeating group is NOT here: it rides its {@link GroupInstance}.
   */
  referencesByItemId: Record<string, ReferenceAnswer>;
  /**
   * FF-1 (ADR 0087) — the response's repeating-group instances. Already
   * pruned by `submit_response` (a zero-answer repetition is deleted before
   * the status flips), so what appears here is exactly what was filled.
   * `[]` for every form without a repeating group.
   */
  instances: GroupInstance[];
  signoffs: SignoffRecord[];
  imageUrls: Record<string, string>;
}) {
  const sections = tree.sections;
  const isFlat = sections.length === 1 && sections[0].isDefault;
  const instancesByGroup = instancesByGroupItemId(instances);
  const signoffsBySection = new Map(signoffs.map((s) => [s.sectionId, s]));

  // One forward pass drives both section AND item visibility (mirror of submit).
  const { visibleSectionIds, visibleItemIds } = computeEffectiveVisibility(
    sections,
    answersByKey,
  );

  if (isFlat) {
    return (
      <div className="flex flex-col gap-4">
        <SectionBody
          instancesByGroup={instancesByGroup}
          section={sections[0]}
          answersByItemId={answersByItemId}
          observationsByItemId={observationsByItemId}
          otherTextByItemId={otherTextByItemId}
          matrixCellsByItemId={matrixCellsByItemId}
          riskMatrixByItemId={riskMatrixByItemId}
          referencesByItemId={referencesByItemId}
          visibleItemIds={visibleItemIds}
          imageUrls={imageUrls}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section, index) => (
        <DetailSection
          key={section.id}
          section={section}
          index={index}
          visible={visibleSectionIds.has(section.id)}
          answersByItemId={answersByItemId}
          observationsByItemId={observationsByItemId}
          otherTextByItemId={otherTextByItemId}
          matrixCellsByItemId={matrixCellsByItemId}
          riskMatrixByItemId={riskMatrixByItemId}
          referencesByItemId={referencesByItemId}
          instancesByGroup={instancesByGroup}
          visibleItemIds={visibleItemIds}
          signoff={signoffsBySection.get(section.id) ?? null}
          imageUrls={imageUrls}
        />
      ))}
    </div>
  );
}

function DetailSection({
  section,
  index,
  visible,
  answersByItemId,
  observationsByItemId,
  otherTextByItemId,
  matrixCellsByItemId,
  riskMatrixByItemId,
  referencesByItemId,
  instancesByGroup,
  visibleItemIds,
  signoff,
  imageUrls,
}: {
  section: Section;
  index: number;
  visible: boolean;
  answersByItemId: Record<string, Json>;
  observationsByItemId: Record<string, string>;
  otherTextByItemId: Record<string, string>;
  matrixCellsByItemId: Record<string, Record<string, string>>;
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>;
  referencesByItemId: Record<string, ReferenceAnswer>;
  instancesByGroup: Record<string, GroupInstance[]>;
  visibleItemIds: Set<string>;
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
            instancesByGroup={instancesByGroup}
            section={section}
            answersByItemId={answersByItemId}
            observationsByItemId={observationsByItemId}
            otherTextByItemId={otherTextByItemId}
            matrixCellsByItemId={matrixCellsByItemId}
            riskMatrixByItemId={riskMatrixByItemId}
            referencesByItemId={referencesByItemId}
            visibleItemIds={visibleItemIds}
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
  observationsByItemId,
  otherTextByItemId,
  matrixCellsByItemId,
  riskMatrixByItemId,
  referencesByItemId,
  instancesByGroup,
  visibleItemIds,
  imageUrls,
}: {
  section: Section;
  answersByItemId: Record<string, Json>;
  observationsByItemId: Record<string, string>;
  otherTextByItemId: Record<string, string>;
  matrixCellsByItemId: Record<string, Record<string, string>>;
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>;
  referencesByItemId: Record<string, ReferenceAnswer>;
  instancesByGroup: Record<string, GroupInstance[]>;
  visibleItemIds: Set<string>;
  imageUrls: Record<string, string>;
}) {
  // Display items always render; input items hidden by an item-level condition
  // are omitted (they collected no answer).
  //
  // FF-1: render THROUGH a plain `group` — its children answer at TOP LEVEL
  // (ADR 0087 ruling 6), so filtering `section.items` alone would silently drop
  // every one of them from the submitted record. `repeating_group` blocks are
  // rendered separately by {@link InstanceBlocks} from `SubmissionDetail.instances`.
  const items = section.items
    .flatMap((it) => (it.itemType === "group" ? it.children : [it]))
    .filter(
      (it) =>
        it.itemType !== "repeating_group" &&
        // FF-2: `isAnswerableItem`, not `isInputItem`. A matrix is answerable
        // but not a scalar input, so the old predicate both let a HIDDEN
        // matrix through and dropped a VISIBLE one from the submitted record.
        (!isAnswerableItem(it.itemType) || visibleItemIds.has(it.id)),
    );

  // FF-1: `repeating_group` blocks render per instance, in document order
  // alongside the flat blocks above them.
  const repeatingGroups = section.items.filter(
    (it) => it.itemType === "repeating_group",
  );

  if (items.length === 0 && repeatingGroups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
        Seção sem blocos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <DetailBlock
          key={item.id}
          item={item}
          value={answersByItemId[item.id]}
          observation={observationsByItemId[item.id]}
          otherText={otherTextByItemId[item.id]}
          matrixCells={matrixCellsByItemId[item.id]}
          riskSelection={riskMatrixByItemId[item.id]}
          reference={referencesByItemId[item.id]}
          imageUrls={imageUrls}
        />
      ))}
      {repeatingGroups.map((container) => (
        <InstanceAnswersReadonly
          key={container.id}
          container={container}
          instances={instancesByGroup[container.id] ?? []}
        />
      ))}
    </div>
  );
}

/** One block rendered read-only, faithful to its type, with its saved answer. */
function DetailBlock({
  item,
  value,
  observation,
  otherText,
  matrixCells,
  riskSelection,
  reference,
  imageUrls,
}: {
  item: Item;
  value: Json | undefined;
  observation?: string;
  otherText?: string;
  matrixCells?: Record<string, string>;
  riskSelection?: RiskMatrixAnswer;
  /** FF-5 - the saved entity reference, or absent when unanswered. */
  reference?: ReferenceAnswer;
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
      {/* FF-2: a matrix renders its OWN `question_explanation` (the grid needs
          it wired as the group's `aria-describedby`), so printing it here too
          duplicated the line on screen and announced it twice. Every other type
          relies on this block for it. */}
      {item.questionExplanation && !isMatrixItem(item.itemType) && (
        <p className="text-sm text-muted-foreground">
          {item.questionExplanation}
        </p>
      )}
      <dl>
        <AnswerSummary
          item={item}
          value={value}
          observation={observation}
          otherText={otherText}
          matrixCells={matrixCells}
          riskSelection={riskSelection}
          reference={reference}
        />
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
