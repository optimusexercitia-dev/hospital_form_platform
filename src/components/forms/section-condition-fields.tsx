import type { VisibleWhen } from "@/lib/queries/forms";

/**
 * Serializes an existing section condition into the hidden form fields that
 * `updateSection` reads (`conditionKey` / `conditionOp` / `conditionValue`), so
 * a form that isn't editing the condition (e.g. the rename dialog) round-trips
 * it unchanged. An absent condition emits nothing → `updateSection` clears it,
 * which is correct for "no condition".
 *
 * The interactive condition EDITOR (F4) emits the same field names; this is just
 * the pass-through serializer.
 */
export function SectionConditionFields({
  visibleWhen,
}: {
  visibleWhen: VisibleWhen | null;
}) {
  if (!visibleWhen) return null;
  // `in` carries an array → JSON-encode; equals/not_equals carry a scalar string.
  const value = Array.isArray(visibleWhen.value)
    ? JSON.stringify(visibleWhen.value)
    : String(visibleWhen.value ?? "");
  return (
    <>
      <input type="hidden" name="conditionKey" value={visibleWhen.question_key} />
      <input type="hidden" name="conditionOp" value={visibleWhen.op} />
      <input type="hidden" name="conditionValue" value={value} />
    </>
  );
}
