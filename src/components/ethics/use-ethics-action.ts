"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * The minimal result the ethics + coordinator server actions all share
 * (`src/lib/ethics/actions.ts` + `src/lib/case-recusals/actions.ts` both export a
 * structurally-identical `ActionState`). Typed locally so this client hook never
 * value-imports a server action module just for its result type.
 */
export interface EthicsActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Runs a one-shot ethics/coordinator server action that returns an
 * {@link EthicsActionResult}, surfaces a pt-BR error on failure, and refreshes the
 * route on success (each action already `revalidatePath`s its own case surface).
 * Mirrors `useCaseAction` but decoupled from `@/lib/cases/actions`. Pass
 * `onSuccess` to close a dialog / reset a form before the refresh lands.
 */
export function useEthicsAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = useCallback(
    (
      thunk: () => Promise<EthicsActionResult>,
      options?: { onSuccess?: (result: EthicsActionResult) => void },
    ) => {
      setError(null);
      startTransition(async () => {
        let result: EthicsActionResult;
        try {
          result = await thunk();
        } catch {
          // A thrown action (e.g. an unimplemented RPC wrapper) must never crash
          // the panel — surface a calm pt-BR message instead of a stack trace.
          setError("Não foi possível concluir. Tente novamente.");
          return;
        }
        if (!result.ok) {
          setError(result.error ?? "Não foi possível concluir. Tente novamente.");
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
