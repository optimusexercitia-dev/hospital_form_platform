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
}: {
  fullName: string | null;
  email: string;
}) {
  const displayName = fullName?.trim() || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full p-1 pr-2 text-sm transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        aria-label="Abrir menu da conta"
      >
        <Avatar>
          <AvatarFallback>{initials(displayName)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[12rem] truncate font-medium sm:inline">
          {displayName}
        </span>
        <ChevronsUpDown
          className="hidden size-4 text-muted-foreground sm:inline"
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
