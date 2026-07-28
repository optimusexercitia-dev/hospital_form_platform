import type { ResponseForFill } from "@/lib/queries/responses";
import { AnswerSummary } from "@/components/responses/wizard/answer-summary";
import {
  InstanceAnswersReadonly,
  instancesByGroupItemId,
} from "@/components/responses/instance-answers-readonly";

/**
 * Read-only rendering of a SUBMITTED phase's answers (guardrail 1, decision ii):
 * the version-faithful section/item tree with each input's saved value, reusing
 * the wizard's presentational {@link AnswerSummary} so the read never drifts from
 * the wizard's own review render. This is NOT the Phase-8 version-faithful
 * submissions browser — it is the minimal coordinator review of one completed
 * phase, sourced from a submitted response a staff_admin may read via RLS.
 *
 * Server-Component-safe: `AnswerSummary` is presentational (no hooks/actions),
 * and `ResponseForFill` is imported type-only from the query layer.
 */
export function PhaseAnswersReadonly({
  response,
}: {
  response: ResponseForFill;
}) {
  const sections = response.tree.sections;
  // FF-1: the response's repeating-group instances, indexed by container.
  const instancesByGroup = instancesByGroupItemId(response.instances);

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => {
        // FF-1: walk THROUGH containers. A plain `group`'s children answer at
        // TOP LEVEL (ADR 0087 ruling 6) and belong in this list; a
        // `repeating_group`'s children hold no top-level answer, so they are
        // rendered per instance below instead of here.
        const inputItems = section.items
          .flatMap((it) => (it.itemType === "group" ? it.children : [it]))
          .filter((it) => it.questionKey != null);
        const repeatingGroups = section.items.filter(
          (it) => it.itemType === "repeating_group",
        );
        if (inputItems.length === 0 && repeatingGroups.length === 0) return null;

        const headingId = `phase-answers-section-${section.id}`;
        const heading =
          section.title || (section.isDefault ? "Respostas" : "Seção sem título");

        return (
          <section
            key={section.id}
            aria-labelledby={headingId}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <h2 id={headingId} className="text-lg font-semibold">
              {heading}
            </h2>
            {inputItems.length > 0 ? (
              <dl className="flex flex-col">
                {inputItems.map((item) => (
                  <AnswerSummary
                    key={item.id}
                    item={item}
                    value={response.answersByItemId[item.id]}
                    observation={response.observationsByItemId[item.id]}
                    otherText={response.otherTextByItemId[item.id]}
                    matrixCells={response.matrixCellsByItemId?.[item.id]}
                    riskSelection={response.riskMatrixByItemId?.[item.id]}
                    // FF-5 (ADR 0091) — a reference answers in
                    // `answer_references` with `answers.value` NULL, so omitting
                    // this renders an ANSWERED question as "Sem resposta" in the
                    // coordinator's phase review. Not a crash — a lie.
                    reference={response.referencesByItemId?.[item.id]}
                  />
                ))}
              </dl>
            ) : null}

            {repeatingGroups.map((container) => (
              <InstanceAnswersReadonly
                key={container.id}
                container={container}
                instances={instancesByGroup[container.id] ?? []}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
