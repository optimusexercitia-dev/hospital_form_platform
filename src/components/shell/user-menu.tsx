"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
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
 * App-shell user menu: shows the signed-in identity and a logout control.
 * Logout is a `<form action={signOut}>` submit (the server action clears the
 * session and redirects to /login) — no inline supabase-js, no client fetch.
 */
export function UserMenu({
  fullName,
  email,
  roleLabel,
}: {
  fullName: string | null;
  email: string;
  /** Optional pt-BR role label shown under the name in the sidebar footer card. */
  roleLabel?: string;
}) {
  const displayName = fullName?.trim() || email;

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
          {roleLabel ? (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {roleLabel}
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
