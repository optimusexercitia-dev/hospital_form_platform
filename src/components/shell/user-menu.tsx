"use client";

import { ChevronsUpDown, LogOut, Repeat } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { assumeRoleFormAction } from "@/lib/role-selection/actions";
import { getSelectableRoles, type SessionGrant } from "@/lib/queries/session-grants";
import {
  landingRouteForRole,
  platformRoleLabel,
  type PlatformRole,
} from "@/components/role/role-catalog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * App-shell user menu: shows the signed-in identity, the ACT (ADR 0106)
 * persistent hat indicator + "Trocar papel" switch, and a logout control.
 * Logout is a `<form action={signOut}>` submit (the server action clears the
 * session and redirects to /login) — no inline supabase-js, no client fetch.
 *
 * The hat switch is the SAME shape: each other-held role is its own
 * `<form action={assumeRole.bind(null, role, landingPath)}>` — a bound Server
 * Action reference, not a builder function returning UI (the RSC-crash trap
 * this codebase has hit before), so the switch works via a plain, keyboard-
 * native form submit with no extra client state.
 */
export function UserMenu({
  fullName,
  email,
  roleLabel,
  activeRole,
  grants,
}: {
  fullName: string | null;
  email: string;
  /**
   * Optional pt-BR role label shown under the name in the sidebar footer
   * card. When omitted and `activeRole` is given, defaults to the active
   * hat's own catalog label — callers that want finer per-shell nuance
   * (e.g. the commission shell's "Coordenação" vs. "Membro" split within the
   * single `staff_admin`/`staff` hat) keep passing this explicitly.
   */
  roleLabel?: string;
  /**
   * ACT (ADR 0106 D12) — the caller's active hat (`SessionContext.activeRole`),
   * or `null` for a session with no claim yet. Drives the default `roleLabel`
   * and is excluded from the "Trocar papel" list (never offered as a switch
   * target for itself).
   */
  activeRole?: string | null;
  /**
   * The caller's hat-blind grants (`getRawGrants()`), for the "Trocar papel"
   * section — the SAME source `getSelectableRoles` already serves the picker
   * and the D9 hint from. Omitted (or `[]`) callers simply get no switch
   * section, matching today's single-role `UserMenu` unchanged.
   */
  grants?: SessionGrant[];
}) {
  const displayName = fullName?.trim() || email;
  const effectiveRoleLabel =
    roleLabel ?? (activeRole ? platformRoleLabel(activeRole) : undefined);

  const otherRoles = (grants ? getSelectableRoles(grants) : []).filter(
    (option) => option.role !== activeRole,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm transition-colors hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        aria-label="Abrir menu da conta"
      >
        <Avatar className="size-8">
          <AvatarFallback>{initials(displayName)}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{displayName}</span>
          {effectiveRoleLabel ? (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {effectiveRoleLabel}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-[14rem]">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{displayName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>

        {otherRoles.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Trocar papel
            </DropdownMenuLabel>
            {otherRoles.map((option) => {
              const role = option.role as PlatformRole;
              const landingPath = landingRouteForRole(role, grants ?? []);
              return (
                <form
                  key={role}
                  action={assumeRoleFormAction.bind(null, role, landingPath)}
                >
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <Repeat aria-hidden="true" />
                      {platformRoleLabel(role)}
                    </button>
                  </DropdownMenuItem>
                </form>
              );
            })}
          </>
        ) : null}

        <DropdownMenuSeparator />
        {/* asChild lets the menu item BE the submit button, so keyboard
            activation (Enter/Space) submits the logout form. */}
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Two-letter initials from a display name, falling back to the first char. */
function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
