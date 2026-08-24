/**
 * The review step's advance MRN warning (`FUP-REFERRAL-REVIEW-STEP-MRN-WARNING`;
 * ADR 0137 **D4**).
 *
 * ⛔ THE PROPERTY IS NOT "the warning appears". It is that the warning appears
 * **only where the client's PHI buffer is AUTHORITATIVE**. `send_referral` refuses an
 * MRN-less draft with `HC0T4` unconditionally (measured from the live catalog), so a
 * blank buffer is a perfectly good reason to warn — unless this session never managed
 * to read what the server already holds, in which case the same warning tells a
 * coordinator their referral has no MRN when it does, and pushes them to re-enter PHI.
 *
 * ⭐ So every test here pairs a VISIBLE case with an ABSENT one. A file that only
 * asserted the warning renders would go green on an always-on banner, which is the
 * defect the follow-up's binding constraint exists to prevent — and it is the version
 * that "works" in every manual click-through, because the majority path is the fresh
 * draft.
 *
 * ⚠ SCOPE, stated because a reader will otherwise assume more coverage than exists:
 * `resumePatientState === "idle"` at the review step is NOT reachable today — the only
 * route to `review` runs through the patient step, and reaching it fires the load. The
 * reachable suppressed state is `error` (§3), and that is the one driven here. The
 * guard is still written over the state rather than over the routing; see the
 * component's docblock.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReferralSendWizard } from "./referral-send-wizard";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";

const setReferralPatient = vi.fn();
const updateReferralDraft = vi.fn();
const createReferralDraft = vi.fn();
const addReferralSharedItem = vi.fn();
const removeReferralSharedItem = vi.fn();
const sendReferral = vi.fn();

vi.mock("@/lib/referrals/actions", () => ({
  setReferralPatient: (...a: unknown[]) => setReferralPatient(...a),
  updateReferralDraft: (...a: unknown[]) => updateReferralDraft(...a),
  createReferralDraft: (...a: unknown[]) => createReferralDraft(...a),
  addReferralSharedItem: (...a: unknown[]) => addReferralSharedItem(...a),
  removeReferralSharedItem: (...a: unknown[]) => removeReferralSharedItem(...a),
  sendReferral: (...a: unknown[]) => sendReferral(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const REFERRAL_ID = "11111111-1111-4111-8111-111111111111";
const TYPE_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_ID = "33333333-3333-4333-8333-333333333333";

const draftDetail = {
  id: REFERRAL_ID,
  status: "draft",
  referralTypeId: TYPE_ID,
  subject: "Parecer sobre o caso",
  descriptionMd: "Descricao suficiente.",
  responseExpected: true,
  priority: "routine",
  requestedActionId: null,
  responseDueAt: null,
  targetCommissionId: TARGET_ID,
  sharedItems: [],
} as never;

/** What the server already holds for a resumed draft — including a real MRN. */
const storedPatient = {
  name: "Paciente Guardado",
  mrn: "MRN-STORED-1",
  dateOfBirth: "1970-03-04",
  ageYears: null,
  sex: "unknown",
  encounterRef: null,
  unit: null,
  attending: null,
} as never;

function renderWizard(opts: {
  resume?: boolean;
  onLoadPatient?: () => Promise<unknown>;
} = {}) {
  return render(
    <ReferralSendWizard
      open
      onOpenChange={vi.fn()}
      sourceCaseId="44444444-4444-4444-8444-444444444444"
      sourceCaseNumber={12}
      referralTypes={[
        {
          id: TYPE_ID,
          key: "parecer",
          label: "Parecer",
          defaultResponseExpected: true,
        } as never,
      ]}
      requestedActions={[]}
      targetCommissions={[{ id: TARGET_ID, name: "Comissão de Destino" } as never]}
      narratives={[]}
      documents={[]}
      // `onLoadDraft` is a REQUIRED prop, so it is always supplied; what makes a
      // render "fresh" is the absence of `resumeReferralId`, which is what gates
      // every resume path in the component.
      onLoadDraft={vi.fn().mockResolvedValue(draftDetail)}
      onLoadPatient={
        (opts.onLoadPatient ?? vi.fn().mockResolvedValue(null)) as never
      }
      {...(opts.resume ? { resumeReferralId: REFERRAL_ID } : {})}
      onLoadSafetyPrefill={vi.fn().mockResolvedValue(null)}
    />,
  );
}

const next = () => screen.getByRole("button", { name: /continuar|avançar/i });

/** Details → Conteúdo → Paciente → Revisão, by ROLE + accessible name only. */
async function walkToReview(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(next()).toBeEnabled());
  await user.click(next()); // details → snapshot
  await user.click(next()); // snapshot → patient (fires the audited prefill)
  await waitFor(() => expect(next()).toBeEnabled());
  await user.click(next()); // patient → review
  await screen.findByRole("button", { name: /enviar encaminhamento/i });
}

/**
 * Fill step 1 for a FRESH draft, which starts empty.
 *
 * ⚠ `detailsComplete` needs the TYPE and the TARGET too, not just the subject — the
 * first draft of this helper typed only the text fields and every fresh-draft test
 * failed on "Selecione o tipo de encaminhamento", i.e. on the fixture rather than on
 * the behaviour under test.
 */
async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    screen.getByRole("combobox", { name: /tipo de encaminhamento/i }),
    TYPE_ID,
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: /comissão de destino|destino/i }),
    TARGET_ID,
  );
  await user.type(
    screen.getByRole("textbox", { name: /assunto/i }),
    "Parecer sobre o caso",
  );
  await user.type(
    screen.getByRole("textbox", { name: /descrição/i }),
    "Descricao suficiente para enviar.",
  );
}

const warning = () => screen.queryByText(REFERRAL_MESSAGES.sendRequiresMrn);

describe("referral wizard — the review step's advance MRN warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setReferralPatient.mockResolvedValue({ ok: true });
    updateReferralDraft.mockResolvedValue({ ok: true });
    createReferralDraft.mockResolvedValue({ ok: true, id: REFERRAL_ID });
    sendReferral.mockResolvedValue({ ok: true });
  });

  it("1 warns on a FRESH draft with no prontuário — the majority path", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);
    await walkToReview(user);

    expect(warning()).toBeInTheDocument();
  });

  it("2 stays silent on a FRESH draft once a prontuário is typed", async () => {
    // The POSITIVE CONTROL for §1: without it, an always-on banner passes §1.
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);

    await waitFor(() => expect(next()).toBeEnabled());
    await user.click(next()); // details → snapshot
    await user.click(next()); // snapshot → patient
    const mrn = await screen.findByRole("textbox", { name: /prontuário/i });
    // ⛔ TWO PRECONDITIONS, and neither is decoration — this test flaked ~1 run in 5
    // under full-suite load without them, and it flaked as "the warning is always on",
    // i.e. it looked like a component defect.
    //
    // The MECHANISM: reaching the patient step ALSO starts the safety-event prefill
    // transition, and `ReferralPatientFields` is `disabled={isPending || …}`. Typing
    // into a disabled input types NOTHING, silently. On a fast machine the transition
    // settles first and the test passes; under load it does not.
    await waitFor(() => expect(mrn).toBeEnabled());
    await user.type(mrn, "MRN-TYPED-7");
    // …and the value really landed. This is what makes a red self-diagnosing: here it
    // says "the fixture never got the MRN in", below it says "the warning is wrong".
    await waitFor(() => expect(mrn).toHaveValue("MRN-TYPED-7"));

    await user.click(next()); // patient → review
    await screen.findByRole("button", { name: /enviar encaminhamento/i });

    expect(warning()).toBeNull();
  });

  it("3 stays silent on a RESUMED draft whose prefill read FAILED", async () => {
    // ⛔ THE ONE THAT MATTERS. The buffer is empty here — but only because this
    // session could not read the stored PHI, not because there is none. Warning
    // would be a confident statement about something the client cannot see.
    const user = userEvent.setup();
    renderWizard({
      resume: true,
      onLoadPatient: vi.fn().mockRejectedValue(new Error("transient read failure")),
    });
    await walkToReview(user);

    expect(warning()).toBeNull();
  });

  it("4 warns on a RESUMED draft whose prefill LOADED and holds no prontuário", async () => {
    // The buffer is authoritative — the read succeeded and returned nothing — so the
    // warning is a true statement and this is where resume earns it.
    const user = userEvent.setup();
    renderWizard({ resume: true, onLoadPatient: vi.fn().mockResolvedValue(null) });
    await walkToReview(user);

    expect(warning()).toBeInTheDocument();
  });

  it("5 stays silent on a RESUMED draft whose stored prontuário loaded", async () => {
    const user = userEvent.setup();
    renderWizard({
      resume: true,
      onLoadPatient: vi.fn().mockResolvedValue(storedPatient),
    });
    await walkToReview(user);

    expect(warning()).toBeNull();
  });

  it("6 never renders BEFORE the review step, even when the MRN is missing", async () => {
    // It is advance notice at the point of decision, not a nag on every step — and a
    // banner that follows the coordinator through the wizard is how people learn to
    // stop reading them.
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);

    expect(warning()).toBeNull();
    await waitFor(() => expect(next()).toBeEnabled());
    await user.click(next()); // snapshot
    expect(warning()).toBeNull();
    await user.click(next()); // patient
    expect(warning()).toBeNull();

    // …and it DOES appear one step later, so the absences above are about the step
    // and not about the fixture failing to reach a warnable state.
    await user.click(next()); // review
    await screen.findByRole("button", { name: /enviar encaminhamento/i });
    expect(warning()).toBeInTheDocument();
  });
});
