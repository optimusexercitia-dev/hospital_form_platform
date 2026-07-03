"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState as MutationActionState } from "@/lib/safety/types";

/**
 * Runs a one-shot committee-title mutation (create/rename/reorder/delete/assign
 * — ADR 0051 Decision 6) that returns the shared `MutationActionState`, surfaces
 * a pt-BR error on failure, and refreshes the route on success. Mirrors
 * {@link useResultAction}, typed against the titles module's return shape.
 */
export function useTitleAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = useCallback(
    (
      thunk: () => Promise<MutationActionState>,
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
