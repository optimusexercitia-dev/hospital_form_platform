import { cn } from "@/lib/utils";

/**
 * Initials avatar for a person, shared by the directory row (34px) and the profile
 * identity band (54px) — AFF2 F1/F2, handoff §Screen 1 and §Screen 2.
 *
 * ⚠ SHARED ON PURPOSE, rather than a six-line helper copied into each screen. The
 * initials RULE (first word + last word) is a display fact about a person, and two
 * copies of it drift into showing the same person different initials on two screens of
 * the same feature. One rule, one place.
 *
 * Presentational and Server-Component-safe. Always `aria-hidden`: the initials are a
 * lossy restatement of the person's name, which is always rendered beside it, so
 * announcing them would just make a screen reader spell two letters before reading the
 * name properly.
 */

/** First + last word of the name, else the e-mail's first letter, else "?". */
export function personInitials(
  fullName: string | null,
  email: string | null,
): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const first = words[0]!.charAt(0);
    const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
    return (first + last).toUpperCase();
  }
  return (email ?? "").trim().charAt(0).toUpperCase() || "?";
}

export function PersonAvatar({
  fullName,
  email,
  size = "sm",
  className,
}: {
  fullName: string | null;
  email: string | null;
  /** `sm` = the 34px directory row; `lg` = the 54px identity band. */
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground",
        size === "lg" ? "size-13.5 text-lg" : "size-8.5 text-xs",
        className,
      )}
    >
      {personInitials(fullName, email)}
    </span>
  );
}
