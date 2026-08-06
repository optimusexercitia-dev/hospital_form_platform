/**
 * FUP-A11Y-1 — `useFieldIds` generates the DOM id; `name` is only the form key.
 *
 * BUG-A11Y-001 was fixed by breaking three ties BY HAND on `/admin`. This file
 * pins the systemic replacement, because every layer that could have caught the
 * original defect was blind to it: a duplicate DOM id typechecks, lints, builds
 * and renders. Only a test that puts two same-named fields on ONE page and looks
 * at where each label RESOLVES can fail.
 *
 * Four separable claims, each with its own failure mode:
 *   1. two instances of the same field name get DIFFERENT ids   (the class);
 *   2. `name` is UNCHANGED and shared                           (the form-key
 *      contract — `formData.get(name)`; a fix that renamed the key would break
 *      every server action while claim 1 stayed green);
 *   3. each label resolves to its OWN control                   (the actual
 *      user-visible defect: focus and the screen-reader announcement);
 *   4. the id survives `document.querySelector('#' + id)`       (the seam —
 *      `required-marker.test.tsx` and `e2e/ff3-validations.spec.ts` both split
 *      `aria-describedby` and string-build a selector from it).
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

/** A minimal field, rendered twice below with the SAME form key. */
function NamedField({
  label,
  error,
  id,
}: {
  label: string;
  error?: string;
  id?: string;
}) {
  const { descriptionId, errorId, controlProps } = useFieldIds("organizationId", {
    hasError: Boolean(error),
    hasDescription: true,
    id,
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
          <NamedField label="Organização (hospital)" />
        </section>
        <section aria-label="Admin">
          <NamedField label="Organização (admin)" />
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

  it("honours an explicit `id` verbatim, for controls something addresses", () => {
    const { container } = render(<NamedField label="Organização" id="pinned-org" />);
    const input = container.querySelector("input")!;
    expect(input.id).toBe("pinned-org");
    expect(input.name).toBe("organizationId");
    expect(container.querySelector("#pinned-org-description")).not.toBeNull();
  });
});
