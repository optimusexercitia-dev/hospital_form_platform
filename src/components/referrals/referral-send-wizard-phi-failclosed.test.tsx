/**
 * The referral wizard's PHI fail-closed guarantee
 * (`FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE`).
 *
 * ⛔ THE PROPERTY THIS PROTECTS: `set_referral_patient` FULL-REPLACES every column
 * (`on conflict do update set name = excluded.name, mrn = excluded.mrn, …`, read from
 * the live catalog). So the wizard's client-side PHI buffer is not a patch — it is the
 * whole row. If the audited prefill read fails on a resumed draft, the buffer does not
 * hold what is stored, and flushing it overwrites the stored `mrn` / `name` /
 * `date_of_birth`.
 *
 * ⚠ WHY THE SEND GATE DOES NOT COVER THIS. ADR 0137 D4 puts an MRN floor at *send*
 * (`HC0T4`), so a blanked MRN is caught there — but `name` and `date_of_birth` are not
 * in that gate, and `Salvar rascunho` never reaches it at all. The floor bounds entry,
 * not persistence.
 *
 * ⭐ AND THE POST-SEND HALF IS A DIFFERENT STORY, MEASURED SEPARATELY. The sibling
 * follow-up (`FUP-0137-MRN-BLANKABLE-AFTER-SEND`) predicted the same blanking on a
 * `sent` referral; driven through a fixture it does NOT happen, because
 * `app.guard_referral_status` refuses the door's trailing `case_referral` update
 * outside `app.in_referral_rpc`. That closure is incidental and is pinned in
 * `supabase/tests/365_referral_mrn_persistence_floor.sql`. THIS file covers the DRAFT,
 * the one place the write really lands — which is why the wizard (drafts only, per D6)
 * is where the guard has to live.
 *
 * =====================================================================
 * ⛔ READ THIS BEFORE EDITING: THE FIRST VERSION OF THIS FILE WAS VACUOUS.
 *
 * It asserted `setReferralPatient` was not called after a failed prefill read, and it
 * passed with the guard REMOVED — because it never populated the buffer. With an empty
 * buffer the flush's own `referralPatientDraftHasData(patient)` test short-circuits the
 * write anyway, so the assertion measured that pre-existing condition and not the fix.
 * Exactly the "green because the fixture cannot reach the failing state" shape.
 *
 * ⭐ WHAT MAKES IT REACHABLE — and it is not typing. On `error` the PHI inputs are
 * DISABLED, so the coordinator cannot type the buffer full. The path that survives is
 * `applyPrefill`: the SAFETY-EVENT prefill is a SEPARATE load with its own state, and
 * its button is gated only on `isPending`. Clicking it fills the buffer with the
 * EVENT's identifiers, which the flush would then write over the draft's stored PHI.
 * That is the construction §1 uses, and it is why the write-level guard is not
 * redundant with the disabled inputs.
 *
 * ⭐ NEUTRALIZATION RECORD — RUN 2026-08-24, each applied alone and reverted. Every
 *   mutation reds EXACTLY its intended assertion and nothing else, which is what makes
 *   the four independent rather than four views of one check:
 *  · remove the `resumePatientState === "error"` early return from `flush`
 *    → §1 REDS, on `expected "vi.fn()" to not be called at all, but actually been
 *      called 1 times`, the received payload carrying `"mrn": "MRN-EVENT-9"` — the
 *      overwrite itself, in the assertion output. (This is the mutation the FIRST
 *      version of this file failed to catch, which is why it is named explicitly.)
 *  · drop `resumePatientState === "error"` from the inputs' `disabled` → §2 REDS.
 *  · re-latch: `setResumePatientState("loaded")` BEFORE the await *and* the `catch`
 *    stops setting `error` → §1 + §2 RED.
 *    ⛔ THE RECORD FOR THIS ONE WAS WRONG TWICE AND BOTH ERRORS ARE WORTH KEEPING.
 *    (a) Moving the pre-await set ALONE changes nothing — the `catch` still assigns
 *        `error`, so the whole file stayed GREEN and the "mutation" was cosmetic. A
 *        re-latch is TWO edits; applying one and reading green would have certified
 *        coverage this file does not have.
 *    (b) This record first claimed §4 also reds. It does NOT: the success path never
 *        enters the `catch`, so a swallowed failure cannot affect it. Predicted, not
 *        measured, and wrong in the flattering direction.
 *  · widen the flush guard to `resumePatientState !== "loaded"`
 *    → §3 REDS (the never-visited step stops saving), which is the over-tightening
 *      the narrow scope exists to prevent.
 * =====================================================================
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

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const REFERRAL_ID = "11111111-1111-4111-8111-111111111111";
const TYPE_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_ID = "33333333-3333-4333-8333-333333333333";

/** A resumed draft whose header is complete, so `Salvar rascunho` is enabled and the
 *  flush is actually reachable — the state in which the overwrite happens. */
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

/** The SAFETY-EVENT prefill — a different load from the draft's own PHI, and the one
 *  that can fill the buffer while `resumePatientState` is `error`. Its MRN is a canary:
 *  if it reaches `setReferralPatient`, the overwrite happened. */
const eventPrefill = {
  source: "case",
  eventId: "55555555-5555-4555-8555-555555555555",
  patient: {
    name: "Paciente Do Evento",
    mrn: "MRN-EVENT-9",
    dateOfBirth: "1975-01-02",
    ageYears: null,
    sex: "unknown",
    encounterRef: null,
    unit: null,
    attending: null,
  },
} as never;

function renderWizard(opts: {
  onLoadPatient: () => Promise<unknown>;
  onLoadSafetyPrefill?: () => Promise<unknown>;
}) {
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
      resumeReferralId={REFERRAL_ID}
      onLoadDraft={vi.fn().mockResolvedValue(draftDetail)}
      onLoadPatient={opts.onLoadPatient as never}
      onLoadSafetyPrefill={
        (opts.onLoadSafetyPrefill ?? vi.fn().mockResolvedValue(null)) as never
      }
    />,
  );
}

/** Walk from the resumed step 1 to the patient step — which is what fires the audited
 *  prefill read. Driven by ROLE + accessible NAME, never by text position. */
async function goToPatientStep(user: ReturnType<typeof userEvent.setup>) {
  const next = () => screen.getByRole("button", { name: /continuar|avançar/i });
  await waitFor(() => expect(next()).toBeEnabled());
  await user.click(next()); // details → snapshot
  await user.click(next()); // snapshot → patient
}

const saveDraft = () => screen.getByRole("button", { name: /salvar rascunho/i });

describe("referral wizard — PHI fail-closed on a resumed draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setReferralPatient.mockResolvedValue({ ok: true });
    updateReferralDraft.mockResolvedValue({ ok: true });
    sendReferral.mockResolvedValue({ ok: true });
  });

  it("1 refuses the flush when the prefill read failed, even though the buffer carries data from the safety-event prefill", async () => {
    const user = userEvent.setup();
    renderWizard({
      onLoadPatient: vi.fn().mockRejectedValue(new Error("transient read failure")),
      onLoadSafetyPrefill: vi.fn().mockResolvedValue(eventPrefill),
    });
    await goToPatientStep(user);

    // The failure is SURFACED, not swallowed — the coordinator learns it before acting.
    await waitFor(() =>
      expect(
        screen.getByText(REFERRAL_MESSAGES.patientFieldsLocked),
      ).toBeInTheDocument(),
    );

    // ⭐ FILL THE BUFFER by the one route still open on `error`. Without this the test
    // is vacuous — see the header.
    await user.click(screen.getByRole("button", { name: /pré-preencher/i }));

    await user.click(saveDraft());

    // The draft header still saves; only the PHI write is refused.
    await waitFor(() => expect(updateReferralDraft).toHaveBeenCalled());
    expect(setReferralPatient).not.toHaveBeenCalled();
    // And the refusal is stated, not silent — the flush sets the dialog-level banner,
    // which is a DIFFERENT string from the step's locked-fields notice on purpose.
    expect(
      screen.getByText(REFERRAL_MESSAGES.patientReloadFailed),
    ).toBeInTheDocument();
  });

  it("2 disables the PHI inputs after a failed prefill read, so the coordinator cannot type over data they cannot see", async () => {
    const user = userEvent.setup();
    renderWizard({
      onLoadPatient: vi.fn().mockRejectedValue(new Error("transient read failure")),
    });
    await goToPatientStep(user);

    await waitFor(() =>
      expect(
        screen.getByText(REFERRAL_MESSAGES.patientFieldsLocked),
      ).toBeInTheDocument(),
    );
    // Queried by accessible name — the MRN field is the erasure key ADR 0137 turns on.
    expect(screen.getByLabelText(/prontuário/i)).toBeDisabled();
    expect(screen.getByLabelText(/nome/i)).toBeDisabled();
  });

  it("3 a never-visited patient step still saves the draft — `idle` is not `error`", async () => {
    const user = userEvent.setup();
    const onLoadPatient = vi.fn().mockRejectedValue(new Error("must not be called"));
    renderWizard({ onLoadPatient });

    await waitFor(() => expect(saveDraft()).toBeEnabled());
    await user.click(saveDraft());

    await waitFor(() => expect(updateReferralDraft).toHaveBeenCalled());
    // ⚠ The guard is scoped to `error`, NOT to "anything but loaded". A coordinator who
    // never opened the PHI step must still be able to save — collapsing `idle` into the
    // refusal would break the ordinary path to protect a state it was never in.
    expect(onLoadPatient).not.toHaveBeenCalled();
    expect(setReferralPatient).not.toHaveBeenCalled();
    expect(
      screen.queryByText(REFERRAL_MESSAGES.patientReloadFailed),
    ).toBeNull();
    expect(screen.queryByText(REFERRAL_MESSAGES.patientFieldsLocked)).toBeNull();
  });

  it("4 writes normally when the prefill read succeeds — the guard is not a permanently closed door", async () => {
    const user = userEvent.setup();
    renderWizard({
      onLoadPatient: vi.fn().mockResolvedValue({
        name: "Paciente Original",
        mrn: "MRN-STORED-1",
        dateOfBirth: "1980-05-04",
        ageYears: null,
        sex: "unknown",
        encounterRef: null,
        unit: null,
        attending: null,
      }),
    });
    await goToPatientStep(user);

    await waitFor(() => expect(screen.getByLabelText(/prontuário/i)).toBeEnabled());
    expect(screen.queryByText(REFERRAL_MESSAGES.patientFieldsLocked)).toBeNull();

    await user.click(saveDraft());
    await waitFor(() => expect(setReferralPatient).toHaveBeenCalled());
    // The LOADED identifiers are what get written back — not blanks. Asserting the
    // call alone would pass on a flush that wrote an empty row.
    const payload = setReferralPatient.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.mrn).toBe("MRN-STORED-1");
  });
});
