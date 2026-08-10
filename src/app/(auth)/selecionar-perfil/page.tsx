import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getRawGrants, getSessionContext } from "@/lib/queries/session";
import { getSelectableRoles } from "@/lib/queries/session-grants";
import { RolePickerForm } from "@/components/role/role-picker-form";

export const metadata: Metadata = {
  title: "Selecionar perfil",
};

/**
 * Only allow a same-origin relative path — never an absolute URL or a
 * protocol-relative `//host` — as the post-selection landing target (open-
 * redirect guard on the `?redirect=` deep-link carried over from `signIn`,
 * `docs/plans/act-as-buildnotes.md` §9).
 */
function safeRedirectTarget(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * ACT (ADR 0106) — the "act as" role picker. Route name `/selecionar-perfil`
 * is a PO decision (2026-08-10); on-screen copy still says "papel" — the app's
 * word for role everywhere else — even though the route reads "perfil"
 * (deliberate split, recorded in `docs/plans/act-as-role-assumption.md` §4
 * Stage 3).
 *
 * Shown ONLY to a multi-role principal with no active hat yet
 * (`context.needsRoleSelection`, D5/D2). Self-guards exactly like
 * `/primeiro-acesso`: a caller for whom the gate doesn't apply is sent on
 * immediately — no picker flash, nothing rendered, matching D7 ("the hat is
 * set implicitly" for everyone else).
 *
 * Renders inside the shared split-canvas `AuthLayout` (`(auth)/layout.tsx`) —
 * the same authenticated-interstitial precedent `/primeiro-acesso` and
 * `/redefinir-senha` already establish for this route group.
 */
export default async function SelecionarPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const [{ redirect: redirectParam }, context] = await Promise.all([
    searchParams,
    getSessionContext(),
  ]);

  if (!context) {
    redirect("/login");
  }
  if (context.isInactive) {
    redirect("/conta-inativa");
  }
  if (context.mustChangePassword) {
    redirect("/primeiro-acesso");
  }

  const redirectTarget = safeRedirectTarget(redirectParam);

  if (!context.needsRoleSelection) {
    redirect(redirectTarget ?? "/");
  }

  // Hat-blind by design (D9) — `getSessionContext()`'s partitioned lists
  // cannot serve this: the picker needs the caller's FULL grant list before
  // any hat exists. See `src/lib/queries/session.ts` `getRawGrants()`.
  const grants = await getRawGrants();
  const options = getSelectableRoles(grants);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
          Quem está acessando
        </p>
        <h1 className="text-3xl text-balance">Escolha seu papel</h1>
        <p className="text-muted-foreground text-pretty">
          Você tem mais de um papel na plataforma. Escolha com qual vai
          trabalhar agora — é possível trocar a qualquer momento pelo menu da
          conta.
        </p>
      </header>
      <RolePickerForm
        options={options}
        grants={grants}
        redirectTarget={redirectTarget}
      />
    </div>
  );
}
