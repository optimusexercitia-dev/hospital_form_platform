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
/**
 * Why a control genuinely needs a DOM `name`.
 *
 * ⛔ CLOSED UNION, AND DELIBERATELY NO `"other"`. A fourth reason must be added as
 * a variant here, which forces the review. An escape hatch would simply collect
 * the sites nobody could classify — which is exactly where the next leak hides.
 *
 * · `formData`   — a server action or a `new FormData(form)` read consumes this
 *                  field by name. Without it the value never reaches the server.
 * · `radioGroup` — `name` is what makes a set of radios ONE group; strip it and
 *                  every radio becomes independently selectable, silently.
 * · `autofill`   — password managers and browser autofill key off `name`
 *                  (credentials, e-mail). Stripping it degrades a real user aid.
 *
 * ⚠ Only `formData` is about submission. `radioGroup` and `autofill` are not —
 * which is why this option is NOT called `submitsVia`: that name would be false
 * for two of its own three values, and a parameter whose name lies about its
 * content is a debt this codebase has already paid for once.
 */
type NameRequiredFor = "formData" | "radioGroup" | "autofill";

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
    /**
     * Declare that this control genuinely needs a DOM `name`, and say WHY.
     *
     * ⛔ OMITTED = NO `name` IS EMITTED. That is the safe default, and it is the
     * default precisely because the opposite shipped a measured MRN and CPF into
     * URLs (see the `name:` line below).
     *
     * ⛔ Do NOT set this because a control's FILE contains a server action. The
     * question is whether THIS control's value is read by name. When the 30 real
     * sites were identified, a file-level heuristic would have wrongly opted in
     * **10 more** — `add-participant-dialog`'s nine controlled fields (its action
     * never reads them) and `add-member-picker`'s search box (a client-side
     * filter; the action reads hidden inputs). A needless `name` is silent and,
     * once annotated, looks deliberate forever; a missing one is loud and fails
     * the first time someone submits. When genuinely unsure, leave it off and
     * exercise the form.
     */
    nameRequiredFor?: NameRequiredFor;
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
      // ⛔ `name` IS OPT-IN. A control gets one only when the caller DECLARED why
      // it needs one. Do not "restore" the unconditional `name` — read this first.
      //
      // WHY (measured, 2026-08-20): a <form> whose JS has not hydrated yet still
      // submits NATIVELY on Enter, and a native GET submit serialises every NAMED
      // input into the query string — address bar, browser history, and every
      // proxy/access log. `preventDefault()` cannot stop it: pre-hydration there is
      // no handler to run. While this hook emitted `name` unconditionally, EVERY
      // consumer inherited that exposure by default. A sweep of 8 surfaces found 4
      // leaking, including an MRN and a CPF (Brazilian national ID):
      //   /o/rede-a/nsp/pacientes?patient-mrn=…&patient-encounter=…
      //   /o/rede-a/manage/usuarios/novo?cpf=…
      // Nothing static caught any of it — tsc, all lint gates and 1447 unit tests
      // were green over the live leak. Only a rendered-DOM check found it.
      //
      // The inversion makes the SAFE case free and the DANGEROUS case declared,
      // reviewable and greppable. Measured blast radius at the flip: 133 spreads
      // across 43 files, of which exactly 30 genuinely needed a name (verified
      // against each server action's own `formData.get()` read set, not by
      // guessing from the file's contents).
      //
      // ⚠ THIS IS NOT A LEAK DETECTOR. It only governs names this hook emits. A
      // hand-written `name=` attribute, or a form nothing enumerated, is still
      // exposed. Treat a green tree as "the declared opt-ins are honest", never as
      // "the app has no leaks".
      name: options.nameRequiredFor ? name : undefined,
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
