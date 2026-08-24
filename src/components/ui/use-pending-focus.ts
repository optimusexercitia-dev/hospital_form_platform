"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Keep a keyboard user's place across a **persist-on-change** write.
 *
 * ## The mechanism, measured — and it is NOT the one the follow-up named
 *
 * `FUP-0137-PERSIST-REFRESH-DROPS-FOCUS` attributed the lost focus to
 * `persist()` + `router.refresh()`. Measured in Chromium (2026-08-24), the three
 * candidates behave like this:
 *
 * | what happens | `document.activeElement` after |
 * |---|---|
 * | an ancestor `<fieldset>` is `disabled` while a descendant holds focus | **`BODY`** |
 * | siblings churn around the focused node (what reconciliation does) | unchanged |
 * | the focused node is REPLACED by an equivalent one | `BODY` |
 *
 * So the culprit is the `disabled={isPending}` that the transition toggles — it
 * fires the instant `startTransition` runs, *before* any refresh — and
 * `router.refresh()` is innocent: React reuses the DOM node, and focus rides along.
 *
 * ⛔ **That distinction changes the sweep.** "Does this component refresh the route
 * on an input event?" matches ~146 files and still MISSES a component that disables
 * on pending without refreshing. The property that actually predicts the defect is:
 * **a control whose own change starts a transition that then disables it (directly or
 * through an ancestor `<fieldset>`), on a surface that stays mounted.** Swept
 * 2026-08-24, that is exactly three components — the two mode/field pickers in
 * `collects-patient-picker.tsx`, `commission-oversight-toggle.tsx`, and
 * `submissions-filters.tsx` — all three of which adopt this hook. A dialog whose
 * SUBMIT starts the transition is not in the class: it unmounts and Radix restores
 * focus to the trigger (`dialog-focus-restore.tsx`).
 *
 * ## Contract
 *
 * Call the returned `park()` at the top of the handler, **before** the state update
 * that disables anything. When `isPending` falls the hook restores that element —
 * but only if focus actually landed on `<body>`, so it can never steal focus from a
 * user who moved on, and never fights the dialog restorer.
 *
 * @param isPending the `useTransition` pending flag that drives the `disabled` prop
 * @returns `park` — capture the currently focused element for later restoration
 */
export function usePendingFocus(isPending: boolean): () => void {
  const parked = useRef<HTMLElement | null>(null);

  const park = useCallback(() => {
    const active = document.activeElement;
    // `body` is not a place a user was, so parking it would make the restore
    // below a no-op that LOOKS like coverage. Park nothing instead.
    parked.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);

  useEffect(() => {
    if (isPending) return;
    const el = parked.current;
    parked.current = null;
    if (!el) return;
    // ⛔ Reclaim ONLY focus we actually lost. If anything still holds it, either the
    // control was never disabled (nothing to fix) or the user moved on — and pulling
    // focus back from under them is a worse defect than the one being fixed.
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    if (!el.isConnected) return;
    el.focus();
  }, [isPending]);

  return park;
}
