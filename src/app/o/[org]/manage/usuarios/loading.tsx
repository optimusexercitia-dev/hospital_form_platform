import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming placeholder for the user directory. Mirrors `OrgUsersPage`'s real
 * layout — header, pill/search toolbar, the six-column table card with its footer —
 * so the rows land in place instead of shifting the page under someone who is
 * mid-read.
 *
 * Announced politely: a directory that is still resolving must not read to a
 * screen-reader user as a directory that came back empty, which is the same
 * "empty never means anything but empty" contract the list itself keeps.
 *
 * ⚠ The column track is duplicated from `user-directory-list.tsx` rather than
 * imported: a skeleton that imports from the component it stands in for makes the
 * component's module graph a dependency of the loading boundary. It is eight
 * repeated bars — if the track changes and this drifts, the cost is a placeholder
 * whose columns sit a few pixels off for one frame.
 */
const ROW_GRID =
  "lg:grid lg:grid-cols-[minmax(230px,1.5fr)_96px_minmax(150px,0.9fr)_minmax(190px,1.2fr)_118px_22px] lg:items-center lg:gap-3";

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

export default function OrgUsersLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Carregando os usuários…</span>

      <header className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-11 w-46 rounded-lg" />
        </div>
        <Skeleton className="h-5 w-full max-w-prose" />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-22 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-30 rounded-full" />
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
          <Skeleton className="h-9 flex-1 rounded-lg sm:w-[250px] sm:flex-none" />
          <Skeleton className="h-9 w-22 rounded-lg" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="h-9 border-b border-border bg-muted/55" />

        <ul>
          {ROWS.map((row) => (
            <li
              key={row}
              className={`flex flex-col gap-2.5 border-t border-border/60 px-4.5 py-3 first:border-t-0 ${ROW_GRID}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-8.5 shrink-0 rounded-full" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-40 max-w-full" />
                  <Skeleton className="h-3 w-52 max-w-full" />
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2 lg:contents">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-5 w-32 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
                <span className="hidden lg:block" />
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4.5 py-2.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    </div>
  );
}
