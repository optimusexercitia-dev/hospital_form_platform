"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Hospital } from "lucide-react";

import type { HospitalRef } from "@/lib/queries/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Hospital switcher for the `/o/[org]/manage` area (ADR 0051 Decision 7).
 * Mirrors {@link CommissionSwitcher}'s shape/behavior exactly, but the hospital
 * is carried as a `?hospital=` search param rather than a route segment —
 * hospital stays UN-ROUTED (ADR 0041 Decision 8 upheld; ADR 0051 Decision 19).
 *
 * Rendered ONLY when the caller administers more than one hospital in this org
 * (an `org_admin` sees the org-wide "Todos os hospitais" option too; a
 * `hospital_admin` of exactly one hospital never sees this at all — its scope is
 * implicit). Selecting an entry updates `?hospital=` on the CURRENT path so deep
 * links to a specific manage sub-page keep working across the switch.
 */
export function HospitalSwitcher({
  hospitals,
  currentHospitalId,
  /** Whether "Todos os hospitais" (no `?hospital=` filter) is an offerable choice
   * — true for an org_admin (org-wide view), false for a hospital_admin (must
   * pick one of its hospitals; there is no cross-hospital view for them). */
  allowAll = true,
}: {
  hospitals: HospitalRef[];
  currentHospitalId: string | null;
  allowAll?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = hospitals.find((h) => h.id === currentHospitalId) ?? null;
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
        aria-label="Trocar de hospital"
      >
        <Hospital className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[16rem]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Hospitais
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allowAll ? (
          <DropdownMenuItem onSelect={() => selectHospital(null)}>
            <Check
              className={currentHospitalId === null ? "opacity-100" : "opacity-0"}
              aria-hidden="true"
            />
            <span className="flex-1">Todos os hospitais</span>
            {currentHospitalId === null ? (
              <span className="sr-only">(atual)</span>
            ) : null}
          </DropdownMenuItem>
        ) : null}
        {hospitals.map((hospital) => (
          <DropdownMenuItem
            key={hospital.id}
            onSelect={() => selectHospital(hospital.id)}
          >
            <Check
              className={hospital.id === currentHospitalId ? "opacity-100" : "opacity-0"}
              aria-hidden="true"
            />
            <span className="truncate flex-1">{hospital.name}</span>
            {hospital.id === currentHospitalId ? (
              <span className="sr-only">(atual)</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
