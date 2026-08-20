/**
 * Component tests for {@link ReferralDisposeDialog} — the LGPD-erasure confirmation
 * for a referral's PHI.
 *
 * ⭐ WHY THIS FILE EXISTS. Until now this dialog had NO executable coverage of any
 * kind. `e2e/` never opens it: AC-7's mutating spec POSTs straight to the
 * `dispose_referral_phi` RPC, and per that spec's own comments no seeded persona can
 * both reach the referral route and pass the disposal gate (`FUP-ACT-DISPOSE-UI`,
 * referral lane undischarged). That gap is almost certainly why the ADR 0056
 * Consequence (b) over-claim sat in the shipped copy unnoticed: the copy on a
 * PHI-erasure confirmation was the one thing nothing could execute.
 *
 * A component test needs no persona, no seed row and no database, so it is the only
 * executable proof available here.
 *
 * Four separable claims, each with its own failure mode:
 *   1. all of {@link DSR_RESIDUE_NOTICE} renders INSIDE the dialog — asserted against
 *      the imported constant, never against copy-pasted pt-BR. A test that hardcoded
 *      the strings would stay green while the constant drifted, which is this exact
 *      defect one level up;
 *   2. the erasure claim is never made UNQUALIFIED (the over-claim, as a property);
 *   3. the destructive path is reachable and correctly gated on BOTH inputs;
 *   4. the `subject_request` note is conditional, pinned in BOTH arms.
 *
 * ⚠ WHAT CLAIM 2 DOES AND DOES NOT COVER, stated so the test does not over-claim
 * about itself. It pins the SCOPE-TOTALITY class — a universal quantifier over what
 * gets erased ("all fields", "everything") — plus the invariant that an erasure claim
 * never appears without the residue qualification. It deliberately does NOT ban
 * permanence adverbs outright: the confirm helper still says "exclusão definitiva"
 * and the destructive button is still "Apagar definitivamente", which claim finality
 * OF THE ACTION (true — the platform offers no undo) rather than completeness of the
 * ERASURE (the thing ADR 0056 narrowed). Those two strings are known and deliberate;
 * if they are ever judged to be over-claims too, tighten the property here.
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const disposeReferralPhi = vi.fn();
const refresh = vi.fn();

// The `'use server'` actions module pulls `next/headers`; stub it and assert on the spy.
vi.mock("@/lib/referrals/actions", () => ({
  disposeReferralPhi: (...args: unknown[]) => disposeReferralPhi(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

import { DSR_RESIDUE_NOTICE } from "@/lib/dsr/messages";
import { ReferralDisposeDialog } from "./referral-dispose-dialog";

const REFERRAL_ID = "11111111-1111-4111-8111-111111111111";

/**
 * The CLASS the over-claim belonged to: a universal quantifier over the erased set.
 * The shipped defect paired a permanence adverb with a universal quantifier over the
 * sensitive fields, and the load-bearing half was the quantifier, not the adverb —
 * which is why this pattern targets quantifiers and leaves permanence alone.
 *
 * ⭕ THE pt-BR WORDING IS STILL NOT REPRODUCED HERE — but the REASON changed on
 * 2026-08-20 and the prohibition is GONE. It used to be load-bearing: the over-claim
 * was policed by a grep over `src/`, so a comment quoting it to warn the next reader
 * was indistinguishable from the defect itself. That happened four times in one day,
 * in four files, to authors who knew the rule — describing a defect by quoting it is
 * simply how the comment wants to be written.
 *
 * THIS FILE REPLACED THAT GREP as the closure instrument for
 * `FUP-DISPOSE-DIALOG-OVERCLAIM`, and it reads RENDERED OUTPUT, where comments do not
 * exist. Quoting the string here is now harmless. It stays omitted only because
 * English describes the CLASS better than one literal does — never reinstate the
 * prohibition without reinstating an instrument that can enforce it.
 */
const TOTALITY_QUANTIFIER =
  /\b(todos?|todas?|tudo|quaisquer|qualquer|integral(mente)?|completa(mente)?|por completo)\b/i;

/** Proof-of-life for claim 2: the dialog really does make an erasure claim. */
const ERASURE_CLAIM = /\b(apaga|apagar|apagad|remove|remover|exclus|excluir|descart)/i;

beforeAll(() => {
  // Radix needs ResizeObserver; jsdom lacks it.
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

beforeEach(() => {
  disposeReferralPhi.mockReset();
  refresh.mockReset();
  disposeReferralPhi.mockResolvedValue({ ok: true });
});

/** Render and open the confirmation dialog. Returns the `alertdialog` element. */
function openDialog(): HTMLElement {
  render(<ReferralDisposeDialog referralId={REFERRAL_ID} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Apagar dados do paciente" }),
  );
  return screen.getByRole("alertdialog");
}

function reasonSelect(dialog: HTMLElement): HTMLSelectElement {
  return within(dialog).getByLabelText("Motivo da exclusão") as HTMLSelectElement;
}

function confirmInput(dialog: HTMLElement): HTMLInputElement {
  return within(dialog).getByLabelText(
    /Digite\s+APAGAR\s+para confirmar/,
  ) as HTMLInputElement;
}

function destructiveButton(dialog: HTMLElement): HTMLButtonElement {
  return within(dialog).getByRole("button", {
    name: "Apagar definitivamente",
  }) as HTMLButtonElement;
}

describe("ReferralDisposeDialog — the residue notice (claim 1)", () => {
  it("renders EVERY line of the shared DSR_RESIDUE_NOTICE inside the dialog", () => {
    const dialog = openDialog();

    // Anti-vacuity: iterating an empty array would assert nothing at all, so the
    // set's size is pinned first. Four is the ADR 0130 Q12a decision (Decision 9);
    // a change to the legally load-bearing residue language SHOULD trip a test
    // rather than ship on someone's say-so.
    expect(DSR_RESIDUE_NOTICE).toHaveLength(4);

    for (const line of DSR_RESIDUE_NOTICE) {
      expect(
        within(dialog).getByText(line),
        `residue line must render: ${line.slice(0, 40)}…`,
      ).toBeInTheDocument();
    }
  });

  it("keeps the notice in the SAME dialog as the destructive control", () => {
    // A residue notice rendered somewhere the operator is not looking at the moment
    // they arm the erasure is not a disclosure. Both must live in one alertdialog.
    const dialog = openDialog();
    for (const line of DSR_RESIDUE_NOTICE) {
      expect(dialog).toContainElement(within(dialog).getByText(line));
    }
    expect(dialog).toContainElement(destructiveButton(dialog));
  });

  it("names the three residue classes ADR 0056's narrowed closure requires", () => {
    // The constant is the source of language, but this pins WHAT it has to cover, so
    // a future rewrite that keeps four lines while dropping a class still reds:
    // retained encrypted bytes, the PITR window, and distributed copies.
    const text = openDialog().textContent ?? "";
    expect(text).toMatch(/cifrad/i); // retained encrypted attachments
    expect(text).toMatch(/PITR|recupera/i); // the point-in-time-recovery window
    expect(text).toMatch(/impressas|distribuídas/i); // copies beyond the platform
  });
});

describe("ReferralDisposeDialog — the over-claim is absent (claim 2)", () => {
  it("makes no UNQUALIFIED erasure claim: totality quantifiers are absent", () => {
    const text = openDialog().textContent ?? "";

    // Proof-of-life FIRST. Without this the assertion below would pass just as
    // happily on a dialog that says nothing about erasing anything.
    expect(text).toMatch(ERASURE_CLAIM);

    const offending = text.match(TOTALITY_QUANTIFIER);
    expect(
      offending,
      `dialog must not quantify the erased set universally, found: ${offending?.[0]}`,
    ).toBeNull();
  });

  it("never states the erasure without the residue qualification beside it", () => {
    // THE property, and the one that survives any future rewrite of the copy: the
    // claim and its qualification are inseparable. The shipped defect satisfied the
    // first half and not the second.
    const dialog = openDialog();
    const text = dialog.textContent ?? "";
    expect(text).toMatch(ERASURE_CLAIM);
    for (const line of DSR_RESIDUE_NOTICE) {
      expect(text).toContain(line);
    }
  });

  it("also holds for the summary copy shown before the dialog is opened", () => {
    // The section paragraph carried its own copy of the over-claim. It is outside
    // the alertdialog, so every assertion above would have missed it.
    render(<ReferralDisposeDialog referralId={REFERRAL_ID} />);
    const summary = screen.getByRole("region", {
      name: "Apagar dados do paciente",
    });
    const text = summary.textContent ?? "";
    expect(text).toMatch(ERASURE_CLAIM);
    expect(text.match(TOTALITY_QUANTIFIER)).toBeNull();
  });
});

describe("ReferralDisposeDialog — the destructive path (claim 3)", () => {
  it("labels the confirm field and accepts input", () => {
    const dialog = openDialog();
    const input = confirmInput(dialog);
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "APAGAR" } });
    expect(input.value).toBe("APAGAR");
  });

  it("arms ONLY when a reason AND the confirm phrase are both given", () => {
    const dialog = openDialog();
    const button = destructiveButton(dialog);

    // Neither input.
    expect(button).toBeDisabled();

    // Reason alone is not enough.
    fireEvent.change(reasonSelect(dialog), {
      target: { value: "retention_expired" },
    });
    expect(button).toBeDisabled();

    // Phrase alone is not enough either — reset the reason to prove this arm
    // independently, so a collapse to a single condition cannot pass both halves.
    fireEvent.change(reasonSelect(dialog), { target: { value: "" } });
    fireEvent.change(confirmInput(dialog), { target: { value: "APAGAR" } });
    expect(button).toBeDisabled();

    // Both together arm it.
    fireEvent.change(reasonSelect(dialog), {
      target: { value: "retention_expired" },
    });
    expect(button).toBeEnabled();
  });

  it("rejects a near-miss confirm phrase", () => {
    const dialog = openDialog();
    fireEvent.change(reasonSelect(dialog), {
      target: { value: "retention_expired" },
    });
    fireEvent.change(confirmInput(dialog), { target: { value: "APAGA" } });
    expect(destructiveButton(dialog)).toBeDisabled();
  });

  it("calls the action with the referral id and the chosen reason", async () => {
    const dialog = openDialog();
    fireEvent.change(reasonSelect(dialog), {
      target: { value: "subject_request" },
    });
    fireEvent.change(confirmInput(dialog), { target: { value: "APAGAR" } });
    fireEvent.click(destructiveButton(dialog));

    await waitFor(() =>
      expect(disposeReferralPhi).toHaveBeenCalledWith(
        REFERRAL_ID,
        "subject_request",
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("surfaces a pt-BR failure message and does NOT close on error", async () => {
    // CLAUDE.md §8: a raw Postgres error must never reach the UI.
    disposeReferralPhi.mockResolvedValue({
      ok: false,
      error: "Você não tem permissão para esta ação.",
    });
    const dialog = openDialog();
    fireEvent.change(reasonSelect(dialog), {
      target: { value: "retention_expired" },
    });
    fireEvent.change(confirmInput(dialog), { target: { value: "APAGAR" } });
    fireEvent.click(destructiveButton(dialog));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Você não tem permissão para esta ação.");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("ReferralDisposeDialog — the subject_request note (claim 4)", () => {
  const NOTE = /pressupõe uma solicitação já decidida/i;

  it("is ABSENT before a reason is chosen, and the select has no dangling describedby", () => {
    const dialog = openDialog();
    expect(within(dialog).queryByText(NOTE)).toBeNull();
    // The `undefined` arm: no attribute at all, rather than one pointing nowhere.
    expect(reasonSelect(dialog).hasAttribute("aria-describedby")).toBe(false);
  });

  it("is ABSENT under a reason that does not presuppose a DSR", () => {
    const dialog = openDialog();
    fireEvent.change(reasonSelect(dialog), {
      target: { value: "retention_expired" },
    });
    expect(within(dialog).queryByText(NOTE)).toBeNull();
    expect(reasonSelect(dialog).hasAttribute("aria-describedby")).toBe(false);
  });

  it("APPEARS for subject_request, wired to a describedby that resolves", () => {
    const dialog = openDialog();
    fireEvent.change(reasonSelect(dialog), {
      target: { value: "subject_request" },
    });

    const note = within(dialog).getByText(NOTE);
    expect(note).toBeInTheDocument();

    // The a11y seam: the id must resolve to a REAL node, and to THIS note.
    const describedBy = reasonSelect(dialog).getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const target = dialog.querySelector(`#${describedBy}`);
    expect(target, `#${describedBy} must resolve`).not.toBeNull();
    expect(target).toBe(note);
  });

  it("disappears again when the reason moves away from subject_request", () => {
    // Both arms in one test so neither can go vacuous: a component hard-wired to
    // always show the note passes the "appears" test and fails here; one hard-wired
    // to never show it fails "appears". Only the real conditional satisfies both.
    const dialog = openDialog();
    fireEvent.change(reasonSelect(dialog), {
      target: { value: "subject_request" },
    });
    expect(within(dialog).getByText(NOTE)).toBeInTheDocument();

    fireEvent.change(reasonSelect(dialog), { target: { value: "duplicate" } });
    expect(within(dialog).queryByText(NOTE)).toBeNull();
    expect(reasonSelect(dialog).hasAttribute("aria-describedby")).toBe(false);
  });
});
