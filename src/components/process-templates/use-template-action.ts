"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/process-templates/actions";

/**
 * Runs a one-shot process-template builder action (add/move/remove/update) that
 * returns an `ActionState`, surfaces a pt-BR error on failure, and refreshes the
 * route on success (each action already revalidates; `router.refresh()`
 * re-renders the server component). Mirrors the form builder's `useBuilderAction`
 * but types against the process-template action module so this client tree never
 * couples to `@/lib/forms`.
 *
 * `run` accepts a thunk returning the action's promise, so callers build the
 * arguments at the call site.
 */
export function useBuilderAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = useCallback(
    (thunk: () => Promise<ActionState>, options?: { onSuccess?: () => void }) => {
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
