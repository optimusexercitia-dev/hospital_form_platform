import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A native `<select>` styled to match the platform's `Input` component —
 * `appearance-none` strips the OS-native arrow so a uniform `ChevronDown`
 * icon is positioned on the right. Pass `className` to override just the
 * `<select>` element (e.g. `className="h-10"` for a compact dialog field).
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "flex h-11 w-full min-w-0 appearance-none rounded-lg border border-input bg-card px-3.5 py-2 pr-9 text-base text-foreground shadow-xs transition-[color,box-shadow,border-color] outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
          "md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
