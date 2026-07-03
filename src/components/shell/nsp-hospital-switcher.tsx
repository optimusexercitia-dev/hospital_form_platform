"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Hospital } from "lucide-react";

import type { NspHospitalGrant } from "@/lib/pqs/roster-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** pt-BR label for the NSP grant a user holds in a hospital (decision 12). */
const ROLE_LABEL: Record<NspHospitalGrant["role"], string> = {
  coordinator: "Coordenação",
  member: "Equipe",
};

/**
 * Hospital switcher for the hospital-scoped NSP console (`/o/[org]/nsp/**`;
 * NSP-per-hospital, ADR 0052). Mirrors {@link HospitalSwitcher}'s shape/behavior:
 * the selected hospital is carried as a `?hospital=` search param on the CURRENT
 * path (hospital stays UN-ROUTED — ADR 0041 Decision 8), so deep links to a
 * specific NSP sub-page keep working across the switch.
 *
 * Rendered ONLY when the user operates the NSP of more than one hospital
 * (`grants.length > 1`). Unlike the manage-area switcher there is NO
 * "Todos os hospitais" option — the NSP is always scoped to exactly one hospital
 * at a time (a PHI boundary; the aggregate cross-hospital view is the separate,
 * PHI-free `/o/[org]/nsp-org` console for `nsp_org_admin`). Each entry shows the
 * caller's grant in that hospital (coordinator vs. member).
 *
 * The current selection is read from `?hospital=` client-side (mirroring the
 * `resolveNspHospital` fallback: an absent/unknown value collapses to the first
 * grant), so the layout that mounts this needs no `searchParams` of its own.
 */
export function NspHospitalSwitcher({
  grants,
}: {
  grants: NspHospitalGrant[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get("hospital");
  const current =
    (requested && grants.find((g) => g.hospitalId === requested)) ||
    grants[0] ||
    null;
  const currentHospitalId = current?.hospitalId ?? "";
  const currentLabel = current?.hospitalName ?? "Hospital";

  function selectHospital(hospitalId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("hospital", hospitalId);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex max-w-[16rem] items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        aria-label="Trocar de hospital"
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
          Hospitais do NSP
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {grants.map((grant) => {
          const isCurrent = grant.hospitalId === currentHospitalId;
          return (
            <DropdownMenuItem
              key={grant.hospitalId}
              onSelect={() => selectHospital(grant.hospitalId)}
            >
              <Check
                className={isCurrent ? "opacity-100" : "opacity-0"}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{grant.hospitalName}</span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABEL[grant.role]}
                </span>
              </span>
              {isCurrent ? <span className="sr-only">(atual)</span> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
