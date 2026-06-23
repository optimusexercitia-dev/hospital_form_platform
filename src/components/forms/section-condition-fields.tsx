import type { Visibility } from "@/lib/queries/forms";

/**
 * Serializes an existing section condition into the hidden `visibleWhen` JSON
 * field that `updateSection` reads, so a form that isn't editing the condition
 * (e.g. the rename dialog) round-trips it unchanged. An absent condition emits
 * nothing → `updateSection` clears it, which is correct for "no condition".
 *
 * form-builder-enhancements (decision #8): the condition is now a
 * {@link Visibility} (legacy single OR AND/OR group), serialized whole as the
 * `visibleWhen` field — the SAME field the shared {@link import('./condition-builder').ConditionBuilder}
 * editor emits. This is the pass-through serializer for dialogs that preserve,
 * not edit, the condition.
 */
export function SectionConditionFields({
  visibleWhen,
}: {
  visibleWhen: Visibility | null;
}) {
  if (!visibleWhen) return null;
  return (
    <input
      type="hidden"
      name="visibleWhen"
      value={JSON.stringify(visibleWhen)}
    />
  );
}
