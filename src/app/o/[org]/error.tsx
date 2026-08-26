"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the `o/[org]/` segment — discharges the AMENDED, more
 * important half of FUP-MANAGE-ROUTES-HAVE-NO-ERROR-BOUNDARY.
 *
 * Why THIS file, not `manage/error.tsx`, is where the highest blast radius is
 * closed: `error.js` wraps `page.js` and nested `layout.js` files, but it does
 * **not** wrap the `layout.js`/`template.js` above it IN THE SAME SEGMENT
 * (this version's own docs,
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md:96`,
 * per CLAUDE.md's "this is NOT the Next.js you know"). So `manage/error.tsx`
 * cannot catch a throw from `manage/layout.tsx` — and that layout is exactly
 * where the risk concentrates: it awaits `getSessionContext()` and, in one
 * `Promise.all`, `getRawGrants()` and `listMyDsrHospitals()` (the newest of the
 * three, shipped alongside AFF2). A throw in any of them today takes down the
 * ENTIRE `manage` tree — the sidebar, the org switcher, and the DSR "Direitos
 * do Titular" console entry all disappear with it — because nothing between
 * that layout and the app root (`src/app/error.tsx`) previously caught it.
 *
 * This boundary sits one segment ABOVE `manage`, so it catches that layout's
 * failures without the entire app losing its shell to `global-error.tsx`.
 * Verified there is no further hidden layer: the only layouts on this chain
 * are `src/app/layout.tsx` (covered by `global-error.tsx`) and
 * `o/[org]/manage/layout.tsx` — `o/layout.tsx` and `o/[org]/layout.tsx` do not
 * exist, so this file, placed directly at `o/[org]/`, is the closest ancestor
 * boundary available.
 *
 * It also backstops any other `o/[org]/*` segment that has no boundary closer
 * to it (e.g. `documentos-pendentes`, `nsp-org`) — `manage`, `nsp`, `qualidade`,
 * `titulares` and `direcao-tecnica` already have their own nearer boundaries
 * and take precedence.
 *
 * ⚠ Copy is deliberately generic and does NOT assume the sidebar exists —
 * unlike `manage/usuarios/error.tsx`, this boundary can be exactly what took
 * the sidebar down, so nothing here should claim it is still there.
 *
 * ⛔ NOTHING FROM `error` IS RENDERED — not `message`, not `digest`, not a code
 * (CLAUDE.md §8: a raw Supabase/Postgres error string can carry table, column
 * and constraint names and must never reach the UI). Logged to the console for
 * the developer only.
 *
 * ⚠ UNVERIFIED BY A THROWN RENDER (recorded honestly, per the FUP body): the
 * ancestor walk above is mechanical and the docs are unambiguous, but nobody
 * has actually thrown from `manage/layout.tsx` to watch this file catch it.
 */
export default function OrgAreaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Move focus to the heading. React swaps this tree in place — there is no
  // navigation — so without it a screen-reader or keyboard user is left
  // focused on a control that no longer exists, on a page whose entire
  // content (possibly including the sidebar) silently changed.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-5 py-24 text-center">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="rounded-md text-2xl focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        Algo deu errado
      </h1>
      <p className="text-muted-foreground text-pretty">
        Não foi possível carregar esta área. Tente novamente em alguns
        instantes.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} size="lg">
          Tentar novamente
        </Button>
        {/* A route genuinely outside this failing tree: `/conta` is global,
            not org-scoped, and does not depend on `manage/layout.tsx`'s own
            data (session context, grants, DSR hospitals) — so it stays
            reachable even when THIS boundary exists because that layout threw.
            No `org` param is needed to build it, unlike the sibling
            `manage/error.tsx` and `manage/usuarios/error.tsx` boundaries. */}
        <Button asChild variant="outline" size="lg">
          <Link href="/conta">Ir para Minha conta</Link>
        </Button>
      </div>
    </div>
  );
}
