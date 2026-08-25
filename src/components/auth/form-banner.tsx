import { cn } from "@/lib/utils";

type BannerTone = "error" | "info" | "success";

const toneStyles: Record<BannerTone, string> = {
  error: "border-destructive/30 bg-destructive/8 text-destructive",
  info: "border-primary/25 bg-accent/60 text-accent-foreground",
  success: "border-primary/25 bg-accent/60 text-accent-foreground",
};

/** The box itself. Shared so {@link FormBanner} and {@link LiveBanner} cannot drift. */
const bannerBox = "rounded-lg border px-3.5 py-2.5 text-sm font-medium";

/**
 * Form-level status banner for text that is present at FIRST PAINT — a neutral
 * notice the server rendered, a `useActionState` error that arrives with the page.
 * Renders nothing without a message.
 *
 * ⛔ DO NOT USE THIS FOR A MESSAGE THAT APPEARS IN RESPONSE TO AN ACTION, i.e. do not
 * write `{error ? <FormBanner tone="error">{error}</FormBanner> : null}`. The ternary
 * puts the live region and its text in the SAME React commit, and a live region that
 * mounts together with its content is announced unreliably — the message is painted
 * and never spoken. That is `BUG-AFF2-PROFILE-SAVE-BANNER-UNMOUNTS` arriving by a
 * second route: there the banner unmounted before it painted, here it mounts too
 * late to be observed. Both end with a real outcome the admin is never told about,
 * and both leave every functional assertion green. Reach for {@link LiveBanner}.
 */
export function FormBanner({
  tone = "error",
  children,
}: {
  tone?: BannerTone;
  children?: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(bannerBox, toneStyles[tone])}
    >
      {children}
    </div>
  );
}

/**
 * The same banner, PERMANENTLY MOUNTED and empty until there is something to say —
 * the shape `PersonalDataCard` and `AccessCard` document inline for their success
 * text, extracted so the error paths cannot silently diverge from it again.
 *
 * The region exists in the DOM from first paint; only its CONTENT changes when the
 * action resolves, which is the change assistive tech is watching for. While empty it
 * is `sr-only` — out of flow (`position: absolute`), so it reserves no space and adds
 * no flex/grid gap — and it announces nothing, because there is nothing in it.
 *
 * ⚠ `role="status"` (polite), deliberately, not `role="alert"`. It keeps
 * {@link FormBanner}'s existing semantics so swapping one for the other changes the
 * MOUNTING and nothing else; several suites address these surfaces with a scoped
 * `getByRole('alert')` that expects exactly one match. Whether form-level failures
 * should escalate to assertive is a real question, and a separate one from this.
 */
export function LiveBanner({
  tone = "error",
  className,
  children,
}: {
  tone?: BannerTone;
  className?: string;
  /** Falsy — `null`, `undefined`, `""` — means "nothing to say", not "render an empty box". */
  children?: React.ReactNode;
}) {
  const hasMessage = Boolean(children);
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        hasMessage ? cn(bannerBox, toneStyles[tone], className) : "sr-only"
      }
    >
      {children}
    </div>
  );
}
