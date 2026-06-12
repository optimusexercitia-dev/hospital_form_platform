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
 * help/error exist) and `aria-invalid`. Spread `controlProps` onto the input.
 */
function useFieldIds(
  name: string,
  options: { hasError?: boolean; hasDescription?: boolean } = {},
) {
  const { hasError = false, hasDescription = false } = options;
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
