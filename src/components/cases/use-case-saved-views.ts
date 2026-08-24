"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_CASE_FILTERS,
  type CaseFilterState,
  type CaseSavedView,
} from "./case-filters";

/**
 * Per-commission persistence for the board's USER-DEFINED saved views.
 *
 * Stored in `localStorage`, keyed by commission id, deliberately: a view is a private
 * scanning habit ("my triage queue"), not shared governance state, so it earns no
 * table, no migration and no RLS surface. The trade-off is stated rather than hidden —
 * views do not follow the user to another device. Promoting them to a
 * `user_case_views` table later only changes this module.
 *
 * ⚠ Read through `useSyncExternalStore`, NOT an effect. `localStorage` does not exist
 * on the server, so the server snapshot is a stable empty list and the client snapshot
 * is the stored one: React reconciles the difference itself instead of hydrating with
 * one value and then tearing when an effect writes another. That also makes the
 * snapshot IDENTITY-STABLE a hard requirement — `getSnapshot` must return the same
 * array reference until the underlying string actually changes, or React re-renders
 * forever. The raw-string cache below is what guarantees it.
 */

const STORAGE_PREFIX = "hcf:cases:views:";

/** The persisted shape. Anything that does not match is discarded, not repaired. */
interface StoredView {
  id: string;
  name: string;
  filters: CaseFilterState;
}

/** The server + empty-storage snapshot. A module constant so its identity is stable. */
const NO_VIEWS: CaseSavedView[] = [];

const listeners = new Set<() => void>();

/** key → the raw string it was parsed from, and the parsed result to hand back. */
const snapshotCache = new Map<
  string,
  { raw: string | null; views: CaseSavedView[] }
>();

function storageKey(commissionId: string): string {
  return `${STORAGE_PREFIX}${commissionId}`;
}

/**
 * Coerce a parsed JSON blob into views, dropping anything malformed. `localStorage` is
 * user-writable and survives across deploys, so a shape from an older build (or edited
 * by hand) must degrade to "no views", never to a crash inside the filter predicate.
 * Every field is defaulted against {@link DEFAULT_CASE_FILTERS}, so a view saved before
 * a new filter field existed still loads.
 */
function parseViews(raw: string | null): CaseSavedView[] {
  if (!raw) return NO_VIEWS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NO_VIEWS;
  }
  if (!Array.isArray(parsed)) return NO_VIEWS;
  const views = parsed.flatMap((entry): CaseSavedView[] => {
    const v = entry as Partial<StoredView> | null;
    if (!v || typeof v.id !== "string" || typeof v.name !== "string") return [];
    if (typeof v.filters !== "object" || v.filters === null) return [];
    return [
      {
        id: v.id,
        name: v.name,
        // A view never carries a search query (see `sameFilters`).
        filters: { ...DEFAULT_CASE_FILTERS, ...v.filters, q: "" },
      },
    ];
  });
  return views.length === 0 ? NO_VIEWS : views;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private-browsing / storage-disabled: the board still works, views just do not
    // persist. Never surface a storage error to a coordinator.
    return null;
  }
}

function getSnapshot(key: string): CaseSavedView[] {
  const raw = readRaw(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.views;
  const views = parseViews(raw);
  snapshotCache.set(key, { raw, views });
  return views;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another TAB writing the same key is a legitimate change too — without this, two
  // open boards for one commission silently disagree about which views exist.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(key: string, views: CaseSavedView[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(views));
  } catch {
    // Quota / storage disabled. Seed the cache anyway so the tab appears for this
    // session; it simply will not come back next time.
    snapshotCache.set(key, { raw: null, views });
  }
  for (const listener of listeners) listener();
}

export function useCaseSavedViews(commissionId: string): {
  views: CaseSavedView[];
  saveView: (name: string, filters: CaseFilterState) => void;
  removeView: (id: string) => void;
} {
  const key = storageKey(commissionId);
  const views = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key),
    () => NO_VIEWS,
  );

  const saveView = useCallback(
    (name: string, filters: CaseFilterState) => {
      // `Date.now()` is unique enough here (one user, one click) and keeps the id
      // stable in storage; the `user:` prefix is what the tab strip keys the delete
      // affordance off, so it must never collide with `builtin:`.
      const view: CaseSavedView = {
        id: `user:${Date.now()}`,
        name,
        filters: { ...filters, q: "" },
      };
      write(key, [...getSnapshot(key), view]);
    },
    [key],
  );

  const removeView = useCallback(
    (id: string) => write(key, getSnapshot(key).filter((v) => v.id !== id)),
    [key],
  );

  return { views, saveView, removeView };
}
