import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared card chrome for an ethics-procedure section (Rule: reuse the platform's
 * `rounded-2xl border bg-card shadow-xs` card idiom). Pure/Server-safe. Each
 * section is a labelled landmark (`<section aria-labelledby>` + a real `<h2>`) for
 * a scannable, accessible procedure surface; `actions` is the top-right control
 * cluster, `badge` a status chip beside the title.
 */
export function EthicsSection({
  id,
  title,
  description,
  badge,
  actions,
  className,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "animate-rise-in rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${id}-title`} className="text-lg">
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p className="max-w-prose text-sm text-muted-foreground text-pretty">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A calm empty-state line inside a section (pt-BR, muted). */
export function EthicsEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
