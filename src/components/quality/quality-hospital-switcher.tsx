"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Hospital } from "lucide-react";

import type { QualityReviewMembership } from "@/lib/queries/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Hospital scope for the Escritório da Qualidade console (`/o/[org]/qualidade/**`,
 * ADR 0100). The selection is carried as `?hospital=` on the CURRENT path —
 * hospital stays UN-ROUTED (ADR 0041 Decision 8, restated by ADR 0100 D10) — so
 * deep links to either console surface survive the switch.
 *
 * Rendered ONLY when the reviewer covers more than one hospital in this org.
 *
 * ⚠ TWO DELIBERATE DIFFERENCES from the two existing switchers, both load-bearing:
 *
 *  1. It reads `?hospital=` CLIENT-SIDE rather than taking `currentHospitalId` as
 *     a prop (the `/manage` {@link HospitalSwitcher} shape). This switcher mounts
 *     in a LAYOUT, and layouts receive no `searchParams` in the App Router — a
 *     prop-driven variant would have no way to know the current selection. Same
 *     resolution as {@link NspHospitalSwitcher}, for the same reason.
 *  2. Unlike the NSP switcher it DOES offer "Todos os hospitais". The NSP scopes
 *     to exactly one hospital because that is a PHI boundary; this console holds
 *     no PHI whatsoever (ADR 0100 D5 — zero PHI bits on the reviewer arm), so a
 *     cross-hospital view is a legitimate — and for most reviewers the useful —
 *     default rather than a leak.
 *
 * An absent/unknown `?hospital=` collapses to "all", which is also what the
 * server pages treat as the unfiltered case.
 */
export function QualityHospitalSwitcher({
  hospitals,
}: {
  hospitals: QualityReviewMembership[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get("hospital");
  const current =
    hospitals.find((h) => h.hospital.id === requested)?.hospital ?? null;
  const currentLabel = current?.name ?? "Todos os hospitais";

  function selectHospital(hospitalId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (hospitalId) {
      params.set("hospital", hospitalId);
    } else {
      params.delete("hospital");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex max-w-[16rem] items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        aria-label="Filtrar por hospital"
      >
        <Hospital
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[16rem]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Hospitais sob supervisão
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => selectHospital(null)}>
          <Check
            className={current === null ? "opacity-100" : "opacity-0"}
            aria-hidden="true"
          />
          <span className="flex-1">Todos os hospitais</span>
          {current === null ? <span className="sr-only">(atual)</span> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {hospitals.map(({ hospital }) => {
          const isCurrent = hospital.id === current?.id;
          return (
            <DropdownMenuItem
              key={hospital.id}
              onSelect={() => selectHospital(hospital.id)}
            >
              <Check
                className={isCurrent ? "opacity-100" : "opacity-0"}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{hospital.name}</span>
              {isCurrent ? <span className="sr-only">(atual)</span> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
