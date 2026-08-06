"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/minutes-jobs/actions";

/** Shown when an action fails without its own pt-BR message (CLAUDE.md §8). */
const FALLBACK_ERROR = "Não foi possível concluir. Tente novamente.";

/**
 * Runs a one-shot MIN action (`@/lib/minutes-jobs/actions`) that returns an
 * {@link ActionState}, surfaces a pt-BR error on failure, and refreshes the route on
 * success. Mirrors `src/components/meetings/use-meeting-action.ts` 1:1, typed against
 * the minutes-jobs action module instead — the same house pattern, kept separate so
 * this client tree never couples to `@/lib/meetings`.
 */
export function useMinutesAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = useCallback(
    <T extends ActionState>(
      thunk: () => Promise<T>,
      options?: { onSuccess?: (result: T) => void; skipRefresh?: boolean },
    ) => {
      setError(null);
      startTransition(async () => {
        try {
          const result = await thunk();
          if (!result.ok) {
            setError(result.error ?? FALLBACK_ERROR);
            return;
          }
          options?.onSuccess?.(result);
          if (!options?.skipRefresh) router.refresh();
        } catch (err) {
          // A Server Action can REJECT (runtime/serialization/network failure) instead
          // of returning `{ ok: false }` — surface the fallback rather than leaving the
          // trigger stuck pending (mirrors `use-meeting-action.ts`'s documented fix).
          if (isNextControlFlowError(err)) throw err;
          setError(FALLBACK_ERROR);
        }
      });
    },
    [router],
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isPending, error, clearError };
}

/**
 * Next.js signals `redirect()`/`notFound()` from a Server Action by THROWING a
 * control-flow error carrying a `NEXT_*` digest. Those must reach the framework —
 * swallowing one would silently break the navigation.
 */
function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}
