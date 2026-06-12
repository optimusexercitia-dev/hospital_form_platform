"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

import type { Membership } from "@/lib/queries/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<Membership["role"], string> = {
  staff: "Membro",
  staff_admin: "Coordenação",
};

/**
 * Commission switcher for users who belong to more than one commission. The
 * layout only renders this when `memberships.length > 1`, so it always has real
 * choices. Each entry links to that commission's area.
 */
export function CommissionSwitcher({
  memberships,
  currentSlug,
}: {
  memberships: Membership[];
  currentSlug: string;
}) {
  const current = memberships.find((m) => m.commission.slug === currentSlug);
  const currentName = current?.commission.name ?? currentSlug;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex max-w-[16rem] items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        aria-label="Trocar de comissão"
      >
        <span className="truncate">{currentName}</span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[16rem]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Suas comissões
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => {
          const isCurrent = m.commission.slug === currentSlug;
          return (
            <DropdownMenuItem key={m.commission.id} asChild>
              <Link href={`/c/${m.commission.slug}`}>
                <Check
                  className={isCurrent ? "opacity-100" : "opacity-0"}
                  aria-hidden="true"
                />
                <span className="flex flex-1 flex-col">
                  <span className="truncate">{m.commission.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABEL[m.role]}
                  </span>
                </span>
                {isCurrent ? <span className="sr-only">(atual)</span> : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
