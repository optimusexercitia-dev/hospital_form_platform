"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/meetings/actions";

/** Shown when an action fails without its own pt-BR message (CLAUDE.md §8 — a raw
 *  Supabase/Postgres/runtime error NEVER reaches the UI). */
const FALLBACK_ERROR = "Não foi possível concluir. Tente novamente.";

/**
 * Next.js signals `redirect()` / `notFound()` from a Server Action by THROWING a
 * control-flow error carrying a `NEXT_*` digest. Those must reach the framework —
 * swallowing one would silently break the navigation. No meetings action redirects
 * today; this keeps the shared hook safe if one ever does.
 */
function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

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
        try {
          const result = await thunk();
          if (!result.ok) {
            setError(result.error ?? FALLBACK_ERROR);
            return;
          }
          options?.onSuccess?.();
          router.refresh();
        } catch (err) {
          // A Server Action can REJECT (runtime/serialization/network failure)
          // instead of returning `{ ok: false }`. Without this catch the rejection
          // escapes the transition: no message is surfaced AND `isPending` never
          // clears, leaving the trigger stuck on its pending label. Defensive
          // hardening — NOT the cause of BUG-STAGEC-OPEN (verified: with this
          // catch in a prod build the alert region stays empty, i.e. the action
          // does not reject; that hang is the in-transition `router.refresh()`
          // never committing).
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
