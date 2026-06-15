"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/meetings/actions";

/**
 * Runs a one-shot meetings action (the button-driven, plain-arg lifecycle /
 * advance / delete actions) that returns an {@link ActionState}, surfaces a
 * pt-BR error on failure, and refreshes the route on success (each action
 * already revalidates its path server-side).
 *
 * Mirrors the cases feature's `useCaseAction`, but typed against the MEETINGS
 * action module so this client tree never couples to `@/lib/cases`.
 */
export function useMeetingAction() {
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
          setError(
            result.error ?? "Não foi possível concluir. Tente novamente.",
          );
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
