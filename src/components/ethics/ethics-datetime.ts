/**
 * Convert a native `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`, in
 * the browser's local zone) to an ISO-8601 UTC string for a `timestamptz` RPC arg,
 * or `null` when empty/invalid. Client-only helper (uses the local `Date` parse).
 */
export function localDateTimeToIso(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
