"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/case-narratives/actions";

/**
 * Runs a one-shot case-narratives action (reorder / archive — the button-driven,
 * plain-arg actions) that returns an `ActionState`, surfaces a pt-BR error on
 * failure, and refreshes the route on success (each action already revalidates).
 * Mirrors {@link useCaseAction}, typed against the case-narratives action module
 * so this client tree never couples to `@/lib/cases`.
 */
export function useNarrativeAction() {
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
