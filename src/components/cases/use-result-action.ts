"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/cases/result-actions";

/**
 * Runs a one-shot per-phase RESULT-vocabulary action (reorder / archive — the
 * button-driven, plain-arg actions) that returns an `ActionState`, surfaces a
 * pt-BR error on failure, and refreshes the route on success. Mirrors
 * {@link useCaseAction}, typed against the result-actions module so this client
 * tree never couples to `@/lib/cases/actions`.
 */
export function useResultAction() {
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
