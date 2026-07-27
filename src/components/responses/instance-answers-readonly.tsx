import type { Item } from "@/lib/queries/forms";
import type { GroupInstance } from "@/lib/queries/responses";
import { AnswerSummary } from "@/components/responses/wizard/answer-summary";

/**
 * FF-1 (ADR 0087) — read-only rendering of a `repeating_group`'s answered
 * repetitions, shared by every view that shows a submitted response so they can
 * never disagree about what was filled.
 *
 * Server-Component-safe: purely presentational (no hooks, no actions), and every
 * query-layer import is type-only.
 *
 * Instances arrive already pruned: `submit_response` deletes fully-empty ones
 * before evaluating (ruling 3), so a submitted response carries exactly the
 * repetitions the respondent meant — this renderer never has to filter blanks.
 */
export function InstanceAnswersReadonly({
  container,
  instances,
}: {
  container: Item;
  /** The response's instances, ALREADY filtered to this container. */
  instances: GroupInstance[];
}) {
  const label = container.label ?? "Grupo repetível";
  const ordered = [...instances].sort((a, b) => a.position - b.position);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{label}</h3>
      {container.questionExplanation ? (
        <p className="text-sm text-muted-foreground text-pretty">
          {container.questionExplanation}
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Nenhuma repetição preenchida.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((instance, index) => (
            <fieldset
              key={instance.id}
              className="rounded-xl border border-border bg-background/60 p-4"
            >
              <legend className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label} {index + 1} de {ordered.length}
              </legend>
              <dl className="flex flex-col">
                {container.children
                  .filter((child) => child.questionKey != null)
                  .map((child) => (
                    <AnswerSummary
                      key={child.id}
                      item={child}
                      value={instance.answersByItemId[child.id]}
                      observation={instance.observationsByItemId[child.id]}
                      otherText={instance.otherTextByItemId[child.id]}
                    />
                  ))}
              </dl>
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}

/** Group a response's flat instance list by container item id. */
export function instancesByGroupItemId(
  instances: GroupInstance[],
): Record<string, GroupInstance[]> {
  const byGroup: Record<string, GroupInstance[]> = {};
  for (const instance of instances) {
    (byGroup[instance.groupItemId] ??= []).push(instance);
  }
  return byGroup;
}
