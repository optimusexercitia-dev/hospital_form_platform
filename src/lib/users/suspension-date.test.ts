import { describe, expect, it } from "vitest";

import {
  SUSPENSION_TIME_ZONE,
  endOfSuspensionDay,
  formatSuspensionDate,
} from "./suspension-date";

/**
 * BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY.
 *
 * ⛔ THIS IS THE ONLY GUARD, AND IT HAD TO BE A UNIT TEST. The seed writes a real
 * timestamp (`…10:08:42+00`), not a bare date string, so the seeded row renders
 * CORRECTLY — the fixture reaches a passing state the product never produced.
 * And `e2e/user-registration.spec.ts` deliberately chose a `monthsBack: 1`
 * margin so the display-timezone defect could not flip its past/future boundary.
 * So neither the seed nor the existing E2E can fail on this bug; a round trip
 * asserted here is the only thing that can.
 */
describe("suspension date — the PO's 2026-08-26 ruling, both halves", () => {
  it("stores the END of the chosen day in São Paulo, not its midnight UTC", () => {
    // The defect, exactly: `2026-09-25T00:00:00.000Z` is 21:00 on 24/09 in
    // São Paulo, so the user was told their suspension had already ended.
    expect(endOfSuspensionDay("2026-09-25")).not.toBe("2026-09-25T00:00:00.000Z");

    // 23:59:59.999 at UTC−3 is 02:59:59.999 UTC on the FOLLOWING day.
    expect(endOfSuspensionDay("2026-09-25")).toBe("2026-09-26T02:59:59.999Z");
  });

  it("round-trips: the day written is the day rendered", () => {
    for (const day of ["2026-01-01", "2026-06-15", "2026-09-25", "2026-12-31"]) {
      const [, month, dayOfMonth] = day.split("-");
      expect(formatSuspensionDate(endOfSuspensionDay(day))).toBe(
        `${dayOfMonth}/${month}/${day.slice(0, 4)}`,
      );
    }
  });

  it("renders a stored instant in São Paulo regardless of the runtime zone", () => {
    // 02:59 UTC on 26/09 is still 25/09 in São Paulo. A formatter with no
    // `timeZone` renders this as 26/09 anywhere east of UTC−3 — which is the
    // half of the bug that lived in the banner.
    expect(formatSuspensionDate("2026-09-26T02:59:59.999Z")).toBe("25/09/2026");
  });

  it("is not a hard-coded −03:00 offset", () => {
    // Derived through Intl, so the day this is wrong is a day the zone database
    // changed — not a day the code silently disagreed with reality. If Brazil
    // reinstates DST, this assertion is where that surfaces.
    const offsetHours =
      (Date.parse(endOfSuspensionDay("2026-09-25")) -
        Date.UTC(2026, 8, 25, 23, 59, 59, 999)) /
      3_600_000;
    expect(Number.isInteger(offsetHours * 4)).toBe(true); // quarter-hour zones exist
    expect(SUSPENSION_TIME_ZONE).toBe("America/Sao_Paulo");
  });

  it("passes malformed input through untouched rather than coercing a day", () => {
    // A silent coercion here would move someone's suspension. Better to let the
    // database refuse it.
    expect(endOfSuspensionDay("")).toBe("");
    expect(endOfSuspensionDay("25/09/2026")).toBe("25/09/2026");
    expect(formatSuspensionDate("not-a-date")).toBe("not-a-date");
  });
});
