"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { BarChart3, FolderOpen } from "lucide-react";

import { qualidadeHref } from "@/lib/routing";
import { cn } from "@/lib/utils";

/**
 * Nav for the Escritório da Qualidade console (ADR 0100 D10) — two read-only
 * surfaces: the cross-committee case board and the aggregate dashboards.
 *
 * Client Component only because it needs `usePathname` for the active state and
 * `useSearchParams` to CARRY the `?hospital=` filter across the two tabs — a
 * reviewer who scoped to one hospital on the board should stay scoped when they
 * open the dashboards. Hospital never becomes a segment (ADR 0041 D8).
 *
 * There is deliberately no third entry. The reviewer holds no write capability
 * (D7), so there is no configuration, no roster, and nothing to administer here.
 */
const ITEMS = [
  { label: "Casos", segment: "", icon: FolderOpen },
  { label: "Painéis", segment: "dashboards", icon: BarChart3 },
] as const;

export function QualityConsoleNav({ org }: { org: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Preserve only the hospital scope; per-surface filters (?comissao=, ?form=,
  // ?from=/?to=) are surface-specific and must not leak across the tabs.
  const hospital = searchParams.get("hospital");
  const suffix = hospital
    ? `?${new URLSearchParams({ hospital }).toString()}`
    : "";

  return (
    <nav aria-label="Escritório da Qualidade" className="ml-2">
      <ul className="flex items-center gap-1">
        {ITEMS.map((item) => {
          const base = qualidadeHref(
            org,
            ...(item.segment ? [item.segment] : []),
          );
          const isActive =
            item.segment === ""
              ? pathname === base
              : pathname === base || pathname.startsWith(`${base}/`);
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <Link
                href={`${base}${suffix}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                  isActive
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
