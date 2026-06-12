import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Pulses under normal motion; the global
 * `prefers-reduced-motion` guard freezes it for users who opt out.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
