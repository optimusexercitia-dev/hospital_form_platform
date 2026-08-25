"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * The shared chrome of the four user-profile dialogs (redesign 3a–3d): a bordered
 * header carrying the title and a subtitle that always NAMES THE PERSON, a scrolling
 * body, and a bordered footer with Cancelar + one primary CTA.
 *
 * ⚠ Built on `@/components/ui/dialog`, and that choice carries the accessibility
 * budget: Radix supplies the focus trap, `Escape`/overlay dismissal, scroll lock and the
 * `role="dialog"` + `aria-labelledby` wiring, and the project's wrapper adds focus
 * RESTORATION for controlled dialogs — which Radix does NOT give when the dialog was not
 * opened through its own `Trigger` (BUG-RDR-001). Every dialog here is controlled from a
 * card's own button, i.e. exactly the case that regressed. Do not hand-roll a panel.
 *
 * ⛔ THE SUBTITLE IS NOT OPTIONAL DECORATION. These dialogs are opened from a page about
 * one person and they mutate that person's record; naming them in the subtitle is what
 * makes the dialog readable out of context — a screen-reader user hears the person's
 * name as part of the dialog's description rather than having to recall which row they
 * came from. It is wired as `DialogDescription`, so Radix announces it with the title.
 *
 * ⚠ THE FORM WRAPS THE FOOTER, not the other way round. The CTA is a real
 * `type="submit"` inside the same `<form>` as the fields, so Enter in any text input
 * submits exactly as the button does. A footer parked outside the form would need a
 * `form=` attribute or a click handler, and the keyboard path would quietly differ from
 * the pointer path.
 */
export function ProfileDialogShell({
  open,
  onOpenChange,
  title,
  subtitle,
  onSubmit,
  submitLabel,
  pendingLabel,
  isPending,
  submitDisabled,
  footerNote,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Always names the person — see the note above. */
  subtitle: string;
  onSubmit: () => void;
  submitLabel: string;
  /** The CTA's label while the action is in flight (e.g. "Salvando…"). */
  pendingLabel: string;
  isPending: boolean;
  submitDisabled?: boolean;
  /** Optional muted line above the buttons (3a's audit-trail note). */
  footerNote?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[29rem] gap-0 p-0">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex min-h-0 flex-col"
        >
          <DialogHeader className="gap-1 border-b border-border/60 px-5.5 py-4.5 pr-11">
            <DialogTitle className="text-[1.05rem] font-semibold">
              {title}
            </DialogTitle>
            <DialogDescription className="text-[0.72rem]">
              {subtitle}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 px-5.5 py-4.5">{children}</div>

          <DialogFooter className="items-center gap-2.5 border-t border-border/60 px-5.5 py-3.5 sm:justify-end">
            {footerNote ? (
              <p className="mr-auto max-w-[16rem] text-[0.7rem] text-muted-foreground text-pretty">
                {footerNote}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isPending || submitDisabled}
            >
              {isPending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
