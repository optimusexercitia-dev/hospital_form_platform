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
 * Derives the stable ids that wire a field together for assistive tech.
 *
 * Returns the control's `id`, plus `aria-describedby` (pointing at whichever of
 * help/error exist), `aria-invalid` and `aria-required`. Spread `controlProps`
 * onto the input.
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
  } = {},
) {
  const { hasError = false, hasDescription = false, required = false } = options;
  const descriptionId = `${name}-description`;
  const errorId = `${name}-error`;
  const describedBy =
    [hasDescription ? descriptionId : null, hasError ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return {
    descriptionId,
    errorId,
    controlProps: {
      id: name,
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
