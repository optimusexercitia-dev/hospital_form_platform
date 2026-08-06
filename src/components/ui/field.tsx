import { useId } from "react";

import { cn } from "@/lib/utils";

import { Label } from "./label";

/**
 * Vertical stack wrapper for a labeled control plus its help/error text.
 * Pair with `useFieldIds` so the label, control, help text and error are wired
 * with matching `htmlFor` / `id` / `aria-describedby` / `aria-invalid`.
 */
function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

/** The field label. Thin re-export so callers import everything from one place. */
function FieldLabel(props: React.ComponentProps<typeof Label>) {
  return <Label {...props} />;
}

/** Muted helper text below a control (e.g. `question_explanation`). */
function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Inline field-level error. Announced politely; rendered only when there is a
 * message so it never reserves dead space or announces emptiness.
 */
function FieldError({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Derives the ids that wire a field together for assistive tech.
 *
 * Returns the control's `id`, plus `aria-describedby` (pointing at whichever of
 * help/error exist), `aria-invalid` and `aria-required`. Spread `controlProps`
 * onto the input.
 *
 * The DOM id is UNIQUE PER RENDERED INSTANCE, from React's `useId()`; `name` is
 * only the form key. Until 2026-08-05 `name` doubled as the id, so two forms on
 * one page sharing a field name silently emitted DUPLICATE ids — `htmlFor` then
 * resolves to whichever element comes FIRST in document order, i.e. the other
 * form's control. `/admin` had three such collisions (BUG-A11Y-001): clicking
 * the org-admin section's "Organização" label moved focus into the hospital
 * form and a screen reader announced the wrong field. Nothing in typecheck,
 * lint, build or E2E sees a duplicate id, so the class had to be removed at the
 * primitive rather than tie-broken per site (FUP-A11Y-1).
 *
 * `required` is the EFFECTIVE required-ness at render time, not a static schema
 * flag: FF-3's `required_if` makes an item mandatory only while its condition
 * holds, and an input the server will reject as missing must not be announced as
 * optional. Omitted → the attribute is absent, so nothing changes for callers
 * that do not pass it.
 */
function useFieldIds(
  name: string,
  options: {
    hasError?: boolean;
    hasDescription?: boolean;
    required?: boolean;
    /**
     * Pin the DOM id instead of generating one — for a control something
     * ADDRESSES by id (a spec selector, a hand-built `aria-describedby`, a
     * `document.getElementById`). Uniqueness then becomes the caller's
     * contract, so pass a value that is already unique per instance.
     *
     * Prefer omitting it: a generated id cannot collide.
     */
    id?: string;
  } = {},
) {
  const { hasError = false, hasDescription = false, required = false } = options;
  // `useId()` wraps its value in delimiters whose SHAPE HAS CHANGED ACROSS REACT
  // VERSIONS — `:r0:` on 18, `_r_0_` on the installed 19.2.4 — and `:` is not a
  // legal CSS ident. This codebase resolves ids by string-building a selector
  // (`required-marker.test.tsx` and `e2e/ff3-validations.spec.ts` both split
  // `aria-describedby` and query `#${id}`), so reduce to the plain token instead
  // of depending on today's format. The delimiters are constant within a version,
  // so this stays injective: two different `useId()` values still differ after it.
  // Removing it is a NO-OP on 19.2.4 — it is forward-defense, and `field.test.tsx`
  // asserts the emitted shape so a React upgrade that reintroduces `:` fails there.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const controlId = options.id ?? `${name}-${uid}`;
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;
  const describedBy =
    [hasDescription ? descriptionId : null, hasError ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return {
    descriptionId,
    errorId,
    controlProps: {
      // The DOM id — unique per instance, and NOT the form key. `name` below is
      // the form key and never changes with it.
      id: controlId,
      name,
      "aria-describedby": describedBy,
      "aria-invalid": hasError || undefined,
      "aria-required": required || undefined,
    },
  };
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  useFieldIds,
};
