import type { SignoffRole } from "@/lib/queries/forms";

/**
 * Serializes an existing section sign-off setting into the hidden form fields
 * that `updateSection` reads (`requiresSignoff` = 'on' + `signoffRole`), so a
 * form that isn't editing sign-off (e.g. the rename dialog) round-trips it
 * unchanged. When sign-off is off, emits nothing → `updateSection` leaves it off.
 *
 * The interactive sign-off EDITOR (F4) emits the same field names; this is the
 * pass-through serializer.
 */
export function SectionSignoffFields({
  requiresSignoff,
  signoffRole,
}: {
  requiresSignoff: boolean;
  signoffRole: SignoffRole | null;
}) {
  if (!requiresSignoff || !signoffRole) return null;
  return (
    <>
      <input type="hidden" name="requiresSignoff" value="on" />
      <input type="hidden" name="signoffRole" value={signoffRole} />
    </>
  );
}
