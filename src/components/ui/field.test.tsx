/**
 * FUP-A11Y-1 — `useFieldIds` generates the DOM id; `name` is only the form key.
 *
 * BUG-A11Y-001 was fixed by breaking three ties BY HAND on `/admin`. This file
 * pins the systemic replacement, because every layer that could have caught the
 * original defect was blind to it: a duplicate DOM id typechecks, lints, builds
 * and renders. Only a test that puts two same-named fields on ONE page and looks
 * at where each label RESOLVES can fail.
 *
 * Five separable claims, each with its own failure mode:
 *   1. two instances of the same field name get DIFFERENT ids   (the class);
 *   2. a DECLARED `name` is UNCHANGED and shared                 (the form-key
 *      contract — `formData.get(name)`; a fix that renamed the key would break
 *      every server action while claim 1 stayed green);
 *   3. each label resolves to its OWN control                   (the actual
 *      user-visible defect: focus and the screen-reader announcement);
 *   4. the id survives `document.querySelector('#' + id)`       (the seam —
 *      `required-marker.test.tsx` and `e2e/ff3-validations.spec.ts` both split
 *      `aria-describedby` and string-build a selector from it);
 *   5. NO `name` is emitted unless the caller declared why      (the inversion,
 *      2026-08-20 — pinned in BOTH directions in one test so neither arm can go
 *      vacuous. While `name` was unconditional it put a measured MRN and CPF into
 *      URLs via pre-hydration native form submits, invisible to every static gate).
 *
 * ⚠ Claims 1–3 are mutation-proven: reverting the hook to `options.id ?? name`
 * reds 1 and 3. Claim 4 is NOT pinned to the hook's `replace()` — React 19.2.4's
 * own `useId()` format (`_r_0_`) already satisfies it, so deleting that line
 * leaves this green. It binds the EMITTED shape, which is the thing that matters:
 * React 18 emitted `:r0:`, and `:` is not a legal CSS ident. This is the test that
 * fails if an upgrade brings a hostile format back.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Field, FieldLabel, FieldDescription, FieldError, useFieldIds } from "./field";

/**
 * A minimal field, rendered twice below with the SAME form key.
 *
 * `nameRequiredFor` is threaded through so the tests can exercise BOTH arms of
 * the opt-in: declared → a `name` is emitted; omitted → none is.
 */
function NamedField({
  label,
  error,
  id,
  nameRequiredFor,
}: {
  label: string;
  error?: string;
  id?: string;
  nameRequiredFor?: "formData";
}) {
  const { descriptionId, errorId, controlProps } = useFieldIds("organizationId", {
    hasError: Boolean(error),
    hasDescription: true,
    id,
    nameRequiredFor,
  });
  return (
    <Field>
      <FieldLabel htmlFor={controlProps.id}>{label}</FieldLabel>
      <input {...controlProps} />
      <FieldDescription id={descriptionId}>Ajuda</FieldDescription>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

describe("useFieldIds — the DOM id is generated, the form key is not", () => {
  it("gives two same-named fields on one page DIFFERENT ids but the SAME name", () => {
    const { container } = render(
      <>
        <section aria-label="Hospital">
          <NamedField label="Organização (hospital)" nameRequiredFor="formData" />
        </section>
        <section aria-label="Admin">
          <NamedField label="Organização (admin)" nameRequiredFor="formData" />
        </section>
      </>,
    );

    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs).toHaveLength(2);

    // 1 — the class. Before FUP-A11Y-1 both ids were the literal "organizationId".
    expect(inputs[0].id).not.toBe(inputs[1].id);
    // ...and no id is duplicated anywhere in the tree.
    const ids = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    // 2 — the form key is what the server action reads; it must NOT have moved.
    // Both instances DECLARED `nameRequiredFor`, so both carry the shared key.
    expect(inputs[0].name).toBe("organizationId");
    expect(inputs[1].name).toBe("organizationId");
  });

  it("resolves each label to its OWN control", () => {
    render(
      <>
        <section aria-label="Hospital">
          <NamedField label="Organização (hospital)" />
        </section>
        <section aria-label="Admin">
          <NamedField label="Organização (admin)" />
        </section>
      </>,
    );

    // 3 — the user-visible defect. With duplicate ids `htmlFor` resolved to the
    // FIRST match in document order, so the second section's label pointed at the
    // first section's input and this scoped lookup found nothing of its own.
    const hospital = within(screen.getByRole("region", { name: "Hospital" }));
    const admin = within(screen.getByRole("region", { name: "Admin" }));
    const hospitalInput = hospital.getByLabelText("Organização (hospital)");
    const adminInput = admin.getByLabelText("Organização (admin)");
    expect(hospitalInput).not.toBe(adminInput);
    expect(hospital.queryByLabelText("Organização (admin)")).toBeNull();
  });

  it("emits ids that a string-built `#id` selector can still resolve", () => {
    const { container } = render(<NamedField label="Organização" error="Obrigatório" />);
    const input = container.querySelector("input")!;

    // 4 — the seam. `useId()` returns `«r0»` on React 19; the delimiters are legal
    // CSS idents but hostile to hand-built selectors, so the hook strips them.
    expect(input.id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(container.querySelector(`#${input.id}`)).toBe(input);

    // And every id in `aria-describedby` resolves to a real node — the exact walk
    // `e2e/ff3-validations.spec.ts` performs against a field in error.
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const targets = describedBy.split(/\s+/).filter(Boolean);
    expect(targets.length).toBe(2);
    for (const id of targets) {
      expect(container.querySelector(`#${id}`), `#${id} must resolve`).not.toBeNull();
    }
    expect(
      targets
        .map((id) => container.querySelector(`#${id}`)?.textContent)
        .join(" "),
    ).toContain("Obrigatório");
  });

  it("emits NO `name` unless the caller declared why one is needed", () => {
    // 5 — THE INVERSION (2026-08-20). `name` is opt-in. This is the claim that
    // reds if the hook ever goes back to naming every control by default.
    //
    // WHY IT MATTERS, measured: a <form> whose JS has not hydrated yet still
    // submits NATIVELY on Enter, and a native GET submit serialises every NAMED
    // input into the query string — address bar, browser history, proxy and access
    // logs. `preventDefault()` cannot stop it; pre-hydration there is no handler.
    // While `name` was unconditional, that put a real MRN and a real CPF (Brazilian
    // national ID) into URLs on four surfaces. Nothing static saw it.
    const { container } = render(<NamedField label="Organização" />);
    const bare = container.querySelector("input")!;
    expect(bare.hasAttribute("name")).toBe(false);

    // The OTHER direction, in the same test, so neither arm can go vacuous: the
    // identical fixture WITH the declaration does carry the key. If the hook were
    // hard-wired to omit `name`, this half fails; if hard-wired to emit it, the
    // half above fails. Only the real conditional satisfies both.
    const { container: declared } = render(
      <NamedField label="Organização" nameRequiredFor="formData" />,
    );
    expect(declared.querySelector("input")!.name).toBe("organizationId");

    // And the a11y wiring is untouched by the opt-in either way — `name` is only
    // ever the form key, never the id or the description link.
    expect(bare.id).toBeTruthy();
    expect(bare.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("honours an explicit `id` verbatim, for controls something addresses", () => {
    const { container } = render(
      <NamedField label="Organização" id="pinned-org" nameRequiredFor="formData" />,
    );
    const input = container.querySelector("input")!;
    expect(input.id).toBe("pinned-org");
    expect(input.name).toBe("organizationId");
    expect(container.querySelector("#pinned-org-description")).not.toBeNull();
  });
});
