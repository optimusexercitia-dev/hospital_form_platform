"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the `manage/` segment — discharges
 * FUP-MANAGE-ROUTES-HAVE-NO-ERROR-BOUNDARY's ORIGINAL (secondary) half.
 *
 * Covers every `manage/*` page that had no boundary of its own: `manage` itself
 * (the "Visão geral" overview), `acreditacao`, `audit`, `comissoes`, `documentos`,
 * `hospitais`, `hospitais/[hospitalId]`, `indicadores`, `painel`, `tipos-de-caso`.
 * The four routes that already carry their own boundary
 * (`administradores`, `comissoes/[commissionSlug]`, `equipe-nsp`, `usuarios`)
 * keep taking precedence — this file only catches what nothing closer already does.
 *
 * ⚠ WHAT THIS DOES **NOT** COVER, DELIBERATELY. A segment's `error.tsx` never
 * wraps that same segment's `layout.tsx` (verified against this Next.js
 * version's own docs, `node_modules/next/dist/docs/.../error.md:96` — see
 * `o/[org]/error.tsx` for the citation). `manage/layout.tsx` — which awaits
 * `getSessionContext()` and, in one `Promise.all`, `getRawGrants()` and
 * `listMyDsrHospitals()` — is therefore OUTSIDE this file's reach; a throw
 * there is caught one level up, by `o/[org]/error.tsx`. That is the file with
 * the larger blast radius (it takes the sidebar with it); this one does not,
 * because the layout renders fine above it.
 *
 * Copy is deliberately generic ("esta página de gestão") rather than naming a
 * specific screen, since one file covers ten different destinations and cannot
 * know which one threw.
 *
 * ⛔ NOTHING FROM `error` IS RENDERED — not `message`, not `digest`, not a code
 * (CLAUDE.md §8: a raw Supabase/Postgres error string can carry table, column
 * and constraint names and must never reach the UI). Logged to the console for
 * the developer only.
 */
export default function OrgManageError({
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
  // focused on a control that no longer exists.
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
        Não foi possível carregar esta página de gestão. Tente novamente em
        alguns instantes.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} size="lg">
          Tentar novamente
        </Button>
        {/* Deliberately NOT a link back into `manage` — one of the ten routes
            this boundary covers IS the manage overview itself, so that link
            would sometimes be the page the person is already on (which may not
            navigate at all). `/conta` is a different, always-reachable route
            that does not depend on this org's admin grants. */}
        <Button asChild variant="outline" size="lg">
          <Link href="/conta">Ir para Minha conta</Link>
        </Button>
      </div>
    </div>
  );
}
