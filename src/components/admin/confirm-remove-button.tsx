"use client";

import { useActionState, useState } from "react";

// The remove actions (`removeStaffAdmin`, `removeStaff`) return this shape;
// `@/lib/members/actions`' ActionState is structurally identical, so a member
// action stays assignable to this prop type.
import type { ActionState } from "@/lib/admin/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * A destructive "remove" control guarded by an AlertDialog confirmation, wired
 * to a `useActionState`-shaped server action. Reused for removing a coordinator
 * (`removeStaffAdmin`) and a staff member (`removeStaff`).
 *
 * The hidden inputs (`hiddenFields`) carry whatever the action needs to identify
 * the target (e.g. `{ commissionId, userId }`). On a returned error we surface
 * the pt-BR `error` inside the open dialog and keep it open; on success the
 * action revalidates the page and the dialog closes (see the derived `open`).
 */
export function ConfirmRemoveButton({
  action,
  hiddenFields,
  triggerLabel,
  triggerAriaLabel,
  title,
  description,
  confirmLabel = "Remover",
}: {
  action: (
    prevState: ActionState | undefined,
    formData: FormData,
  ) => Promise<ActionState>;
  hiddenFields: Record<string, string>;
  triggerLabel: string;
  triggerAriaLabel?: string;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [userOpen, setUserOpen] = useState(false);

  // Derive open from user intent AND the action result — no effect needed: a
  // successful action (`state.ok`) forces the dialog closed (the page revalidates
  // and the row disappears), while an error keeps it open so the message shows.
  const open = userOpen && !state?.ok;

  return (
    <AlertDialog open={open} onOpenChange={setUserOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={triggerAriaLabel ?? triggerLabel}
        >
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* Only show the error when the action FAILED. On success the action
            also populates `error` (with success copy), but the dialog is already
            closing (open derives `!state.ok`), so we must not style that as an
            error. */}
        {state && !state.ok && state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            {state.error}
          </p>
        ) : null}

        {/* The confirm button submits this form; hidden fields identify the
            target. We deliberately do NOT use Radix's `AlertDialogAction` for
            the submit — its built-in close-on-click would dismiss the dialog
            before the server action returns, hiding any pt-BR error. Instead the
            dialog closes only on success, via the effect above. */}
        <form action={formAction}>
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Removendo…" : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
