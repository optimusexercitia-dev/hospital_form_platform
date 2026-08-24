"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * `onOpenAutoFocus` is a real, runtime-supported prop on Radix's
 * `MenuContentImpl` (it flows straight through to FocusScope's
 * `onMountAutoFocus`, typed `(event: Event) => void` —
 * `@radix-ui/react-focus-scope`'s `.d.mts`), but
 * `@radix-ui/react-dropdown-menu`'s PUBLIC `DropdownMenuContentProps` type
 * omits it: it's stripped as "private" via `Omit<MenuContentImplProps, keyof
 * MenuContentImplPrivateProps>` (`@radix-ui/react-menu`'s `.d.mts`) — verified
 * against the installed package's own type declarations, not assumed. This
 * widens ONLY `Content`'s accepted-props type to restore that one prop; every
 * other prop keeps its real Radix type unchanged.
 */
const DropdownMenuContentPrimitive = DropdownMenuPrimitive.Content as React.ForwardRefExoticComponent<
  React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
    onOpenAutoFocus?: (event: Event) => void;
  } & React.RefAttributes<HTMLDivElement>
>;

/**
 * Dropdown menu built on Radix — keyboard navigation, focus trapping, typeahead
 * and `aria-*` wiring come for free. Used by the app-shell user menu and the
 * commission switcher.
 */
function DropdownMenu(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>,
) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>,
) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  onOpenAutoFocus?: (event: Event) => void;
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuContentPrimitive
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        onOpenAutoFocus={(event: Event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          // Defensive fallback for a measured Radix mount-order race (not
          // app-introduced): on a keyboard-driven open, Radix's own
          // RovingFocusGroup is SUPPOSED to advance focus from the content
          // container onto the first menuitem, but that hand-off can lose its
          // effect-ordering race — observed reliably under `next dev`, not
          // under the production build — leaving focus stranded on the
          // container. `requestAnimationFrame` runs after that whole mount
          // dance settles, so this only fires once Radix's own hand-off has
          // had its chance to run.
          //
          // Gated on `:focus-visible` so a POINTER-driven open (where Radix
          // deliberately withholds the item hand-off — a mouse user gets no
          // forced focus ring) is never touched: the browser's own keyboard-
          // vs-pointer heuristic already backs that pseudo-class, so this
          // fallback only ever fires for the keyboard case it exists to fix.
          const content = event.currentTarget as HTMLElement;
          requestAnimationFrame(() => {
            if (document.activeElement !== content) return;
            if (!content.matches(":focus-visible")) return;
            content
              .querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
              ?.focus();
          });
        }}
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[inset]:pl-8 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-2.5 py-1.5 text-sm font-medium", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1.5 my-1.5 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
