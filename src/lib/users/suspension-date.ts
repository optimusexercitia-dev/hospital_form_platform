/**
 * BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY — the read and the write of
 * `profiles.suspended_until` must agree about what "suspenso até D" MEANS, so
 * both halves live here rather than in the two components that need them.
 *
 * ⭐ PO RULING 2026-08-26: **"suspended until D" = until 23:59:59 of D in
 * `America/Sao_Paulo`.**
 *
 * The defect this closes had two halves, in two files, and each was individually
 * defensible:
 *  - the dialog wrote a bare `YYYY-MM-DD` as `${date}T00:00:00.000Z` — MIDNIGHT
 *    UTC, i.e. 21:00 of the PREVIOUS day in São Paulo;
 *  - the banner formatted with `Intl.DateTimeFormat("pt-BR")` and **no
 *    `timeZone`**, so it rendered whatever zone the runtime happened to be in.
 * Together they showed a suspended user that their suspension had already ended.
 *
 * ⚠ STATED, NOT HIDDEN: this pins ONE zone application-wide, and Brazil spans
 * four. A hospital outside UTC−3 makes this a per-tenant setting. That is a
 * disclosed consequence of the ruling, not an oversight — when it becomes real,
 * `SUSPENSION_TIME_ZONE` is the single place it changes.
 */

/** The one zone the product currently reasons about. See the ⚠ above. */
export const SUSPENSION_TIME_ZONE = "America/Sao_Paulo";

/**
 * How far `timeZone`'s wall clock is from UTC at a given instant, in ms.
 *
 * Derived through `Intl` rather than hard-coded to −03:00 on purpose: Brazil
 * abolished DST in 2019, so a constant offset is correct TODAY and would fail
 * silently on the day that is reversed. A wrong offset here is invisible — it
 * shifts a date by hours, which only shows up at a day boundary.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const at = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const wallAsUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    // `hour12: false` emits hour 24 for midnight in some engines; fold it to 0.
    at("hour") % 24,
    at("minute"),
    at("second"),
  );

  // ⛔ ROUND TO THE MINUTE. `formatToParts` has no millisecond part, so
  // `wallAsUtc` is truncated to the second while `instant` is not — the raw
  // difference carries up to 999ms of pure artifact, and `endOfSuspensionDay`
  // applies this twice, compounding it. Measured: it returned
  // `…T03:00:00.997Z` instead of `…T02:59:59.999Z`. Every real UTC offset is a
  // whole number of minutes, so rounding cannot discard signal.
  return Math.round((wallAsUtc - instant.getTime()) / 60_000) * 60_000;
}

/**
 * Turn the date picker's bare `YYYY-MM-DD` into the instant the suspension
 * actually ends: 23:59:59.999 of that day, in {@link SUSPENSION_TIME_ZONE}.
 *
 * Returns an ISO string suitable for a `timestamptz` column. Invalid input is
 * returned untouched so a malformed value fails loudly at the database rather
 * than being silently coerced to some other day.
 */
export function endOfSuspensionDay(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;

  const [, year, month, day] = match;
  const wallAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
    999,
  );

  // Two passes: the first guesses the offset from the naive instant, the second
  // re-reads it at the corrected instant. That second pass is what keeps this
  // right when the guess and the answer straddle a DST transition.
  const firstGuess = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), SUSPENSION_TIME_ZONE);
  const corrected = wallAsUtc - zoneOffsetMs(new Date(firstGuess), SUSPENSION_TIME_ZONE);

  return new Date(corrected).toISOString();
}

/**
 * Render a stored `suspended_until` instant as the day the user was told.
 *
 * A suspension end is a TIMESTAMP, not a bare date, so it is safe to parse as an
 * instant — unlike `started_on` / `date_of_birth`, which are DATE columns and
 * shift a day west of UTC when read that way. The `timeZone` is what makes the
 * rendered day match {@link endOfSuspensionDay}'s intent.
 */
export function formatSuspensionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SUSPENSION_TIME_ZONE,
  }).format(date);
}
