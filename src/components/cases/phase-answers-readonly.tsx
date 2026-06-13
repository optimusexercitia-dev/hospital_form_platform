import type { ResponseForFill } from "@/lib/queries/responses";
import { AnswerSummary } from "@/components/responses/wizard/answer-summary";

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

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => {
        const inputItems = section.items.filter(
          (it) => it.questionKey != null,
        );
        if (inputItems.length === 0) return null;

        const headingId = `phase-answers-section-${section.id}`;
        const heading = section.isDefault
          ? "Respostas"
          : section.title || "Seção sem título";

        return (
          <section
            key={section.id}
            aria-labelledby={headingId}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <h2 id={headingId} className="text-lg font-semibold">
              {heading}
            </h2>
            <dl className="flex flex-col">
              {inputItems.map((item) => (
                <AnswerSummary
                  key={item.id}
                  item={item}
                  value={response.answersByItemId[item.id]}
                />
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
