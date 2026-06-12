import { cn } from "@/lib/utils";

/**
 * Multi-line text input matching the platform's `Input` styling (focus ring,
 * `aria-invalid` treatment). A thin wrapper over the native `<textarea>` so it
 * stays fully keyboard- and screen-reader-operable. Used for section
 * descriptions, the `section_text` Markdown editor, and `question_explanation`
 * ("Texto de apoio").
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-2.5 text-base text-foreground shadow-xs transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-muted-foreground/70",
        "selection:bg-primary selection:text-primary-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        "field-sizing-content resize-y",
        "md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
