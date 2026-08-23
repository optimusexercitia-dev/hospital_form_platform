"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { orgHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the user-management surface (AFF2 F4, pulled forward).
 * Friendly pt-BR message + retry — never the raw Supabase/Postgres error.
 *
 * ⚠ SCOPE, STATED DELIBERATELY RATHER THAN LEFT INCIDENTAL. Sitting at `usuarios/`,
 * this boundary replaces the CONTENT of the manage shell and not the shell itself:
 * `manage/layout.tsx` renders above it and is outside its reach (a segment's
 * `error.tsx` never catches its own layout), so the sidebar, the org switcher and the
 * DSR console entry all survive. That is the property that matters — whatever this
 * screen says, the person is never trapped, because the navigation they arrived by is
 * still on screen.
 *
 * ⚠ IT ALSO COVERS `[userId]` AND `novo`, which have no boundary of their own. That is
 * a current fact about the tree, not an assumption: the profile page and the register
 * wizard are F2/F3 surfaces and their boundaries are decisions for those rounds. So the
 * copy here has to be true for all three — it says "esta página de usuários", never
 * "a lista", and the recovery actions are chosen for the same reason (below).
 *
 * ⛔ NOTHING FROM `error` IS RENDERED. Not `message`, not `digest`, not a code
 * (CLAUDE.md §8 — a raw Supabase/Postgres error must never reach the UI, and a
 * Postgres error string can carry table, column and constraint names). The detail goes
 * to the console for the developer; the person gets a sentence and two ways forward.
 */
export default function OrgUsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ org: string }>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
  }, [error]);

  /**
   * Move focus to the heading. React swaps this tree in place — there is no
   * navigation — so without it a screen-reader or keyboard user is left focused on a
   * control that no longer exists, on a page whose entire content silently changed.
   */
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // `useParams` reads the router context, which lives ABOVE this boundary and is
  // therefore intact. Guarded anyway: a link built from a missing slug would point at
  // `/o/undefined`, and a recovery action that goes nowhere is worse than one absent.
  const org = typeof params?.org === "string" ? params.org : null;

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
        Não foi possível carregar esta página de usuários. Tente novamente em
        alguns instantes.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} size="lg">
          Tentar novamente
        </Button>
        {/* The second way out is deliberately NOT "voltar para a lista": when it is the
            directory itself that failed, that link is the page the person is already
            on, and Next may not navigate at all — a control that does nothing. "Visão
            geral" (the manage root, label copied from `org-manage-sidebar`) is a
            different route from all three surfaces this boundary covers, so it always
            goes somewhere. */}
        {org ? (
          <Button asChild variant="outline" size="lg">
            <Link href={orgHref(org, "manage")}>Ir para Visão geral</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
