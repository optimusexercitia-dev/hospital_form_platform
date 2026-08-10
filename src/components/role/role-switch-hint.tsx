"use client";

import { useActionState } from "react";

import { assumeRole, type AssumeRoleState } from "@/lib/role-selection/actions";
import type { SelectableRoleOption, SessionGrant } from "@/lib/queries/session-grants";
import {
  landingRouteForRole,
  platformRoleLabel,
  type PlatformRole,
} from "@/components/role/role-catalog";

/**
 * ACT (ADR 0106 D9) — the "you also hold another role" hint appended to a
 * choke-point guard's `notFound()` boundary. Computed PURELY from the
 * caller's own memberships: the not-found `page.tsx` that mounts this (the
 * "caller" — it already resolved the hat-blind grants for its own render)
 * passes `options`; this component does no I/O and never learns whether the
 * area it's mounted under actually exists (D4 — absence must stay
 * indistinguishable from non-existence at the ROW level; this only adds an
 * ADDITIONAL, self-sourced fact, never softens the base 404 copy).
 *
 * Renders nothing when `options` is empty — a caller with no other standing
 * anywhere gets the plain not-found copy, unchanged.
 */
export function RoleSwitchHint({
  options,
  grants,
}: {
  /** The caller's role types, hat-blind (`getSelectableRoles` over
   * `getRawGrants()`) — NOT filtered against this area's own requirement; the
   * hint may name a hat that doesn't fix THIS 404 (a different org/hospital
   * under the same role type), by design (D9). */
  options: SelectableRoleOption[];
  grants: SessionGrant[];
}) {
  if (options.length === 0) return null;

  return (
    <div className="mt-2 flex w-full flex-col gap-2 border-t border-border pt-4 text-sm">
      {options.map((option) => (
        <RoleSwitchLine key={option.role} option={option} grants={grants} />
      ))}
    </div>
  );
}

function RoleSwitchLine({
  option,
  grants,
}: {
  option: SelectableRoleOption;
  grants: SessionGrant[];
}) {
  const [state, formAction, isPending] = useActionState(
    async (
      _prevState: AssumeRoleState | undefined,
      _formData: FormData,
    ): Promise<AssumeRoleState> => {
      const role = option.role as PlatformRole;
      return assumeRole(role, landingRouteForRole(role, grants));
    },
    undefined,
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center"
    >
      <span className="text-muted-foreground">
        Seu papel de{" "}
        <strong className="font-medium text-foreground">
          {platformRoleLabel(option.role)}
        </strong>{" "}
        tem acesso mais amplo aqui.
      </span>
      <button
        type="submit"
        disabled={isPending}
        className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
      >
        {isPending ? "Trocando…" : "Trocar agora"}
      </button>
      {state?.error ? (
        <span role="alert" className="w-full text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
