/**
 * `BUG-REGWIZARD-NO-ORG-STARTDATE-001` — the registration start date reaches the action.
 *
 * ⛔ WHY THIS SUITE EXISTS AT ALL, stated as the shape of the defect rather than as a
 * feature description. `RegisterUserInput.affiliationStartedOn` was documented, accepted
 * by the action, and forwarded to BOTH affiliation doors — and there was no control
 * anywhere in the product for a user to supply one. `d14-person-level.test.ts` was green
 * over the parameter the whole time, because a backend test supplies the value itself.
 * That is what let the surface read as delivered while acceptance criterion 5 —
 * "registration writes the start date THE USER TYPED" — was false. A backend-only proof
 * cannot see a missing input, so the proof has to start at the DOM.
 *
 * ⛔⛔ THE DATE IS PINNED TO 2019-03-15 AND THE ASSERTED VALUE IS 2019-03-04. Both halves
 * are load-bearing and neither is arbitrary:
 *
 *   Both doors take `coalesce(p_started_on, current_date)`. So an assertion whose
 *   expected value is TODAY passes identically whether the wiring works or is severed —
 *   wired, the door stores the typed date; severed, the door stores `current_date`, which
 *   is the same date. The test would go green over a completely disconnected control.
 *   That is not a hypothetical: it is the exact trap the parameter's existing coverage
 *   fell into.
 *
 *   Pinning the clock is what makes a NON-today date reachable at all. The picker opens on
 *   `new Date()` (react-day-picker's `defaultMonth` fallback, read at render), so without
 *   a pinned clock, reaching March 2019 means ~90 month-back clicks. With the clock at
 *   2019-03-15 the calendar opens on that month and day 4 is one click away — a real past
 *   date, eleven days before the default, produced by a real click on the real control.
 *
 * ⚠ THE CLOCK IS PINNED BEFORE `render`, NOT IN THE TEST BODY. `defaultMonth` is read
 * during the picker's render and never re-read; setting the system time afterwards would
 * leave the calendar on the real current month and the day-4 lookup would silently find
 * the WRONG March. `expectsCalendarIsOnMarch2019` below fails loudly if that ever drifts,
 * so this suite cannot go green having clicked a day in some other month.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const registerUser = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/users/actions", () => ({ registerUser }));

import {
  RegisterPersonWizard,
  buildRegisterUserInput,
  type RegisterPersonDraft,
} from "./register-person-wizard";

/** Radix Popover needs both — jsdom ships neither. The house pattern. */
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

/** The pinned "today". Every date below is relative to this, never to the real clock. */
const TODAY = new Date(2019, 2, 15);
/** The date the admin picks: eleven days BEFORE the default. Never equal to `TODAY`. */
const TYPED = "2019-03-04";

beforeEach(() => {
  registerUser.mockReset();
  registerUser.mockResolvedValue({ ok: true, userId: "new-person" });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

function renderWizard() {
  return render(
    <RegisterPersonWizard
      org="rede-a"
      organizationId="org-1"
      cpf="52998224725"
      categories={[{ id: "cat-1", labelPt: "Enfermagem" } as never]}
      commissions={[]}
      emailVerificationEnabled
      affiliableHospitals={[{ id: "hosp-1", name: "Hospital Central" }]}
    />,
  );
}

/** Step 1 is the only non-skippable step; fill exactly enough to leave it. */
async function completeIdentification(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nome completo/i), "Ana Ribeiro");
  await user.type(screen.getByLabelText(/e-mail/i), "ana@test.local");
  await user.selectOptions(screen.getByLabelText(/categoria profissional/i), "cat-1");
  await user.click(screen.getByRole("button", { name: /continuar/i }));
}

function startDateTrigger(): HTMLElement {
  return screen.getByRole("button", { name: /início do vínculo/i });
}

/**
 * The fixture guard. If the calendar is not on March 2019, the day-4 lookup below is
 * finding a day in a DIFFERENT month and the asserted value is a coincidence.
 */
function expectsCalendarIsOnMarch2019() {
  expect(document.querySelector('[data-day="2019-03-04"]')).not.toBeNull();
}

describe("register wizard — the start date the admin picks reaches the action", () => {
  it("⭐ KEYSTONE: a picked past date arrives as `affiliationStartedOn`", async () => {
    const user = userEvent.setup();
    renderWizard();

    await completeIdentification(user);

    // Step 2 — the control this bug was filed about.
    await user.click(startDateTrigger());
    expectsCalendarIsOnMarch2019();
    const dayCell = document.querySelector<HTMLElement>('[data-day="2019-03-04"]');
    await user.click(within(dayCell!).getByRole("button"));

    await user.click(screen.getByRole("button", { name: /continuar/i }));
    await user.click(screen.getByRole("button", { name: /registrar/i }));

    expect(registerUser).toHaveBeenCalledTimes(1);
    // The whole point: the TYPED date, not the default. `2019-03-15` here would mean the
    // control is decorative and the door's `coalesce` is doing the work.
    expect(registerUser.mock.calls[0][0]).toMatchObject({
      affiliationStartedOn: TYPED,
    });
  });

  it("⭐ DIFFERENTIAL: touching nothing sends null, so the door's default applies", async () => {
    const user = userEvent.setup();
    renderWizard();

    await completeIdentification(user);
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    await user.click(screen.getByRole("button", { name: /registrar/i }));

    // ⚠ `null`, never `""` and never today's date computed client-side. The default
    // belongs to the door (`coalesce(p_started_on, current_date)`); a client-computed
    // "today" would be the browser's timezone-local today, which is not the database's.
    expect(registerUser.mock.calls[0][0]).toMatchObject({
      affiliationStartedOn: null,
    });
  });

  it("names the control for a screen reader, value included", async () => {
    const user = userEvent.setup();
    renderWizard();
    await completeIdentification(user);

    const trigger = startDateTrigger();
    // `labelId` self-reference: the trigger's name is built from the label PLUS its own
    // contents, so the selected date is part of the name rather than dropped from it
    // (FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME). Asserted as the mechanism —
    // the name STRING differential is only observable in Chromium, not this jsdom.
    expect(trigger).toHaveAttribute("aria-labelledby");
    expect(trigger.getAttribute("aria-labelledby")).toContain(trigger.id);
    // Keyboard-reachable: a real button, not a div with a click handler.
    expect(trigger.tagName).toBe("BUTTON");
  });
});

/**
 * The builder's own cases — the cheap, deterministic half.
 *
 * ⚠ THESE ARE NOT THE PROOF. `buildRegisterUserInput` can be perfectly correct while the
 * component stops handing it `startedOn`; the keystone above is what notices that. What
 * these add is the boundary behaviour the keystone cannot reach through the calendar
 * (blank, and whitespace-only) without asserting on a rendering of it.
 */
describe("buildRegisterUserInput — start date", () => {
  function draft(overrides: Partial<RegisterPersonDraft> = {}): RegisterPersonDraft {
    return {
      organizationId: "org-1",
      cpf: "52998224725",
      fullName: "Ana Ribeiro",
      email: "ana@test.local",
      professionalCategoryId: "cat-1",
      dateOfBirth: "",
      phone: "",
      hospitalId: "",
      employeeId: "",
      startedOn: "",
      password: "",
      emailVerificationEnabled: true,
      credentials: [],
      committees: [],
      ...overrides,
    };
  }

  it("carries a supplied ISO date through unchanged", () => {
    expect(buildRegisterUserInput(draft({ startedOn: TYPED })).affiliationStartedOn).toBe(
      TYPED,
    );
  });

  it('turns "" into null, never into "" or a client-computed today', () => {
    expect(buildRegisterUserInput(draft()).affiliationStartedOn).toBeNull();
  });

  it("⭐ the field is present on the payload even when blank — the key is never dropped", () => {
    // Absence and null are different facts to a caller reading the object, and the
    // original defect was the key being absent from the payload entirely.
    expect(buildRegisterUserInput(draft())).toHaveProperty("affiliationStartedOn");
  });
});
