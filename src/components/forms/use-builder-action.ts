"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/forms/actions";

/**
 * Runs a one-shot builder server action (add/move/delete/update) that returns an
 * `ActionState`, surfaces a pt-BR error on failure, and refreshes the route on
 * success so the server re-pulls the draft tree (each action already
 * `revalidateBuilder()`s; `router.refresh()` re-renders the server component).
 *
 * Use for click-driven ops where a full `useActionState` <form> is overkill. For
 * editing flows with field validation, use `useActionState` directly.
 *
 * `run` accepts a thunk returning the action's promise, so callers build the
 * FormData (or pass plain args) at the call site.
 */
export function useBuilderAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = useCallback(
    (
      thunk: () => Promise<ActionState>,
      options?: { onSuccess?: () => void },
    ) => {
      setError(null);
      startTransition(async () => {
        const result = await thunk();
        if (!result.ok) {
          setError(result.error ?? "Não foi possível concluir. Tente novamente.");
          return;
        }
        options?.onSuccess?.();
        router.refresh();
      });
    },
    [router],
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isPending, error, clearError };
}
