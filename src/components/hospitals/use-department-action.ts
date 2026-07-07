"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { DepartmentActionState } from "@/lib/hospitals/actions";

/**
 * Runs a one-shot department mutation (create / rename / reorder / archive —
 * Hospital Departments) that returns {@link DepartmentActionState}, surfaces a
 * pt-BR error on failure, and refreshes the route on success (so the server
 * re-reads the list — the same client-refresh pattern as `useTitleAction`, kept
 * independent of the action's own `revalidatePath`). Mirrors `useTitleAction`,
 * typed against the departments module's return shape (which also carries
 * `fieldErrors`).
 */
export function useDepartmentAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = useCallback(
    (
      thunk: () => Promise<DepartmentActionState>,
      options?: { onSuccess?: (result: DepartmentActionState) => void },
    ) => {
      setError(null);
      startTransition(async () => {
        const result = await thunk();
        if (!result.ok) {
          setError(
            result.error ??
              result.fieldErrors?.name ??
              "Não foi possível concluir. Tente novamente.",
          );
          return;
        }
        options?.onSuccess?.(result);
        router.refresh();
      });
    },
    [router],
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isPending, error, clearError };
}
