"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Focus restoration for the platform's modal primitives — the BUG-RDR-001 fix,
 * shared by `dialog.tsx` and `alert-dialog.tsx`.
 *
 * ## What Radix actually gives
 *
 * Verified against the installed source, not assumed. Radix's own
 * `DialogContentModal` (`@radix-ui/react-dialog/dist/index.mjs:146-149`) passes:
 *
 * ```js
 * onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
 *   event.preventDefault();
 *   context.triggerRef.current?.focus();
 * })
 * ```
 *
 * `AlertDialogContent` (`@radix-ui/react-alert-dialog/dist/index.mjs:65-77`)
 * spreads `...contentProps` into that same component and overrides only
 * `onOpenAutoFocus` / `onPointerDownOutside` / `onInteractOutside` — so BOTH
 * primitives share exactly this close path, and both inherit its defect.
 *
 * ## The defect
 *
 * That `preventDefault()` is unconditional, and it ALSO cancels `FocusScope`'s
 * own restore-to-previously-focused fallback
 * (`@radix-ui/react-focus-scope/dist/index.mjs:90-94` skips it once anything
 * prevents the event). So when `triggerRef` is null — which is every dialog
 * driven as a controlled `<Dialog open onOpenChange>` from a plain
 * `<Button onClick>`, 20+ components here — the `focus()` is a no-op and focus
 * lands on `<body>`. Both primitives' doc comments claimed restoration "comes
 * for free"; that claim had been false for every such call site since the first
 * one (BUG-RDR-001 — the repo's own *"a comment is an assertion that goes stale
 * silently"*).
 *
 * ## What this adds
 *
 * {@link DialogFocusRestoreProvider} wraps the primitive's ROOT and captures
 * `document.activeElement` in the LAYOUT phase of the commit that opens it.
 * That phase matters: `FocusScope` moves focus in a PASSIVE effect, and every
 * layout effect of a commit flushes before any passive one, so the opener is
 * still the active element when this runs.
 * {@link useRestoreFocusOnClose} builds the `onCloseAutoFocus` handler the
 * CONTENT passes down, which focuses that element back.
 *
 * Deliberately ONE implementation rather than two copies: the mechanism is
 * subtle (see the two-halves comment below), byte-identical across the two
 * primitives, and drift between two copies is the exact failure class this bug
 * came from. Nothing here touches dismissal, which is where the two primitives
 * genuinely differ — `AlertDialog` hard-`preventDefault`s outside-pointer
 * interaction and so has no overlay-click close at all.
 */

/** The element to return focus to, captured at open. */
const RestoreFocusContext = createContext<RefObject<HTMLElement | null> | null>(
  null,
);

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server. The capture
 * genuinely needs the layout phase, but every page that mounts a dialog
 * server-renders this component, and React logs a warning for a layout effect
 * during SSR.
 */
const useIsomorphicLayoutEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Wrap a dialog/alert-dialog ROOT. `open` is the primitive's controlled `open`
 * prop; `undefined` (an uncontrolled, `Trigger`-driven dialog) captures nothing,
 * because Radix's own trigger restore already covers that case correctly.
 */
function DialogFocusRestoreProvider({
  open,
  children,
}: {
  open: boolean | undefined;
  children: ReactNode;
}) {
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (open !== true) return;
    const active = document.activeElement;
    restoreFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
  }, [open]);

  return (
    <RestoreFocusContext.Provider value={restoreFocusRef}>
      {children}
    </RestoreFocusContext.Provider>
  );
}

/**
 * Build the `onCloseAutoFocus` handler for a dialog/alert-dialog CONTENT.
 * Pass the caller's own handler, if any — it runs first and keeps control if it
 * calls `preventDefault()`.
 */
function useRestoreFocusOnClose(callerHandler?: (event: Event) => void) {
  const restoreFocusRef = useContext(RestoreFocusContext);

  return useCallback(
    (event: Event) => {
      callerHandler?.(event);
      // A caller that took restoration over itself wins.
      if (event.defaultPrevented) return;

      const target = restoreFocusRef?.current;
      // Gone (the row that opened this was just deleted, or it was a menu item
      // whose menu has since unmounted) or no longer focusable: fall through
      // WITHOUT preventing, so Radix's own handler still runs and restores to a
      // `Trigger` if there is one. Never worse than the pre-fix behaviour.
      if (!target || !target.isConnected || target.hasAttribute("disabled")) {
        return;
      }
      // Both halves are load-bearing: without `preventDefault()` Radix's
      // handler re-points focus at a null trigger ref, and WITH it
      // `FocusScope`'s fallback restore is skipped — so this handler owns the
      // restore outright, it cannot delegate half of it.
      event.preventDefault();
      target.focus();
    },
    [callerHandler, restoreFocusRef],
  );
}

export { DialogFocusRestoreProvider, useRestoreFocusOnClose };
