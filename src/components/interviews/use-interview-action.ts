"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/interviews/actions";

/**
 * Runs a one-shot interviews action (the button-driven, plain-arg lifecycle /
 * participant / delete actions) that returns an {@link ActionState}, surfaces a
 * pt-BR error on failure, and refreshes the route on success (each action already
 * revalidates its path server-side).
 *
 * Mirrors the meetings `useMeetingAction` / cases `useCaseAction`, but typed
 * against the INTERVIEWS action module so this client tree never couples to
 * `@/lib/meetings` or `@/lib/cases`.
 */
export function useInterviewAction() {
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
