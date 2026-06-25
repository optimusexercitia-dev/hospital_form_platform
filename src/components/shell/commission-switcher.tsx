"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

import type { Membership } from "@/lib/queries/session";
import { commissionHref } from "@/lib/routing";
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
 * choices. Each entry links to that commission's org-scoped area.
 *
 * The current commission is identified by `currentCommissionId` (NOT slug — a
 * commission slug is unique only per org now, so two memberships in different
 * orgs may share a slug). When the user's memberships span more than one
 * organization, entries are grouped under an org heading so the org context is
 * never ambiguous; a single-org user sees a flat list.
 */
export function CommissionSwitcher({
  memberships,
  currentCommissionId,
}: {
  memberships: Membership[];
  currentCommissionId: string;
}) {
  const current = memberships.find(
    (m) => m.commission.id === currentCommissionId,
  );
  const currentName = current?.commission.name ?? "Comissão";

  // Group by organization, preserving the pt-BR-sorted membership order.
  const byOrg = new Map<string, { name: string; items: Membership[] }>();
  for (const m of memberships) {
    const org = m.commission.organization;
    const group = byOrg.get(org.id);
    if (group) {
      group.items.push(m);
    } else {
      byOrg.set(org.id, { name: org.name, items: [m] });
    }
  }
  const groups = [...byOrg.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const multiOrg = groups.length > 1;

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
        {multiOrg ? (
          groups.map((group, gi) => (
            <div key={group.name}>
              {gi > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {group.name}
              </DropdownMenuLabel>
              {group.items.map((m) => (
                <SwitcherItem
                  key={m.commission.id}
                  membership={m}
                  isCurrent={m.commission.id === currentCommissionId}
                />
              ))}
            </div>
          ))
        ) : (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Suas comissões
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {memberships.map((m) => (
              <SwitcherItem
                key={m.commission.id}
                membership={m}
                isCurrent={m.commission.id === currentCommissionId}
              />
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SwitcherItem({
  membership,
  isCurrent,
}: {
  membership: Membership;
  isCurrent: boolean;
}) {
  const { commission, role } = membership;
  return (
    <DropdownMenuItem asChild>
      <Link
        href={commissionHref(commission.organization.slug, commission.slug)}
      >
        <Check
          className={isCurrent ? "opacity-100" : "opacity-0"}
          aria-hidden="true"
        />
        <span className="flex flex-1 flex-col">
          <span className="truncate">{commission.name}</span>
          <span className="text-xs text-muted-foreground">
            {ROLE_LABEL[role]}
          </span>
        </span>
        {isCurrent ? <span className="sr-only">(atual)</span> : null}
      </Link>
    </DropdownMenuItem>
  );
}
