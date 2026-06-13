"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/cases/actions";

/**
 * Runs a one-shot cases action (skip / close / cancel — the button-driven, plain
 * id-arg actions) that returns an `ActionState`, surfaces a pt-BR error on
 * failure, and refreshes the route on success (each action already revalidates).
 * Mirrors the form builder's `useBuilderAction`, typed against the cases action
 * module so this client tree never couples to `@/lib/forms`.
 */
export function useCaseAction() {
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
