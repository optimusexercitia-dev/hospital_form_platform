"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DialogFocusRestoreProvider,
  useRestoreFocusOnClose,
} from "@/components/ui/dialog-focus-restore";

/**
 * Modal dialog built on Radix Dialog. Distinct from `AlertDialog` (destructive
 * confirmations): this is for content flows like "Novo formulário" and the
 * section/item editors. Styled to match the platform's popover/menu surfaces.
 *
 * **What Radix actually gives** (verified against
 * `@radix-ui/react-dialog/dist/index.mjs`, not assumed): focus TRAPPING while
 * open, `Escape`/outside-pointer dismissal, scroll-lock, and the
 * `role="dialog"` / `aria-modal` / `aria-labelledby` wiring.
 *
 * **What it does NOT give: focus RESTORATION** for a dialog that was not opened
 * through `DialogPrimitive.Trigger` — it restores to a null `triggerRef` and
 * focus lands on `<body>`. The comment that used to sit here claimed
 * restoration "comes for free"; that was false for every controlled call site
 * (BUG-RDR-001). Full mechanism + the Radix source it was read from:
 * `dialog-focus-restore.tsx`.
 *
 * **What this wrapper adds:** that file's capture-on-open / restore-on-close
 * pair, covering `Escape`, overlay click and programmatic close identically. A
 * caller that passes its own `onCloseAutoFocus` and calls `preventDefault()`
 * keeps control.
 */
function Dialog({
  open,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return (
    <DialogFocusRestoreProvider open={open}>
      <DialogPrimitive.Root data-slot="dialog" open={open} {...props} />
    </DialogFocusRestoreProvider>
  );
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>,
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogContent({
  className,
  children,
  showClose = true,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showClose?: boolean;
}) {
  const handleCloseAutoFocus = useRestoreFocusOnClose(onCloseAutoFocus);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className={cn(
          "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        )}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label="Fechar"
          >
            <X aria-hidden="true" className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 pr-6", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground text-pretty", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
