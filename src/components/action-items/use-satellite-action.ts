"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/action-items/satellite-actions";

/**
 * Runs one satellite write action (create/toggle/edit/delete a reminder, update,
 * or checklist row) that returns an {@link ActionState}, surfaces the pt-BR error
 * on failure, and — on success — refreshes the client-fetched satellite data via
 * the caller's `onSuccess` (the satellite lists are loaded lazily on the client,
 * so `router.refresh()` alone would not re-fetch them) and then refreshes the
 * route so the parent panel's counts/status stay in sync.
 *
 * Mirrors `useCaseAction` / `useMeetingAction`, but typed against the satellite
 * action module so this tree never couples to `@/lib/cases` or `@/lib/meetings`.
 * Note: the satellite actions overload `error` with a success message on `ok`;
 * we only surface it when `!ok`, so a success string never renders as an error.
 */
export function useSatelliteAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = useCallback(
    (
      thunk: () => Promise<ActionState>,
      options?: { onSuccess?: () => void | Promise<void> },
    ) => {
      setError(null);
      startTransition(async () => {
        const result = await thunk();
        if (!result.ok) {
          setError(result.error ?? "Não foi possível concluir. Tente novamente.");
          return;
        }
        await options?.onSuccess?.();
        router.refresh();
      });
    },
    [router],
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isPending, error, clearError };
}
