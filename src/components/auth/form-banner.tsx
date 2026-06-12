import { cn } from "@/lib/utils";

type BannerTone = "error" | "info" | "success";

const toneStyles: Record<BannerTone, string> = {
  error: "border-destructive/30 bg-destructive/8 text-destructive",
  info: "border-primary/25 bg-accent/60 text-accent-foreground",
  success: "border-primary/25 bg-accent/60 text-accent-foreground",
};

/**
 * Form-level status banner for the auth screens (failed sign-in, neutral
 * reset-sent notice, invalid-link notice). Announced via `aria-live` so screen
 * readers hear it when it appears after a submit. Renders nothing without a
 * message.
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
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-sm font-medium",
        toneStyles[tone],
      )}
    >
      {children}
    </div>
  );
}
