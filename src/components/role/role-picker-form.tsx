"use client";

import { useActionState, useRef, useState } from "react";

import { assumeRole, type AssumeRoleState } from "@/lib/role-selection/actions";
import type { SelectableRoleOption, SessionGrant } from "@/lib/queries/session-grants";
import {
  isPlatformRole,
  landingRouteForRole,
  platformRoleLabel,
  scopeSummary,
} from "@/lib/role/role-catalog";
import { RiseInGroup } from "@/components/motion/rise-in-group";
import { getMotionDurations, MOTION_EASE } from "@/components/motion/motion-tokens";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * ACT (ADR 0106) — the `/selecionar-perfil` role picker's form. Client
 * Component: the submit is a real interaction (radio selection + a pending
 * state), everything else on the page is server-rendered.
 *
 * `assumeRole` takes an explicit `(role, landingPath)` pair, not a bare
 * `FormData` shape — the wrapper below reads `role` from the submitted
 * `FormData` (native radio group), resolves `landingPath` from the SAME
 * role → route table `UserMenu`'s switcher and the D9 hint use
 * (`role-catalog.ts`), and calls the server action. `redirectTarget`
 * (validated by the page — a same-origin relative path only) takes priority
 * over the resolved route: it is the deep link the user was originally
 * headed to before the picker interrupted them (Stage 3 destination sweep,
 * `docs/plans/act-as-buildnotes.md` §9).
 */
export function RolePickerForm({
  options,
  grants,
  redirectTarget,
}: {
  options: SelectableRoleOption[];
  grants: SessionGrant[];
  redirectTarget: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLLabelElement | null>>({});
  const reducedMotion = useReducedMotion();

  async function submitRoleSelection(
    _prevState: AssumeRoleState | undefined,
    formData: FormData,
  ): Promise<AssumeRoleState> {
    const role = formData.get("role");
    if (typeof role !== "string" || !isPlatformRole(role)) {
      return { ok: false, error: "Selecione um papel para continuar." };
    }
    const landingPath = redirectTarget ?? landingRouteForRole(role, grants);
    return assumeRole(role, landingPath);
  }

  const [state, formAction, isPending] = useActionState(submitRoleSelection, undefined);

  // Decorative-only submit crossfade (design note §3.5) — best-effort, never
  // blocks the real submit/navigation. Runs alongside the form's own action,
  // not instead of it.
  function handleSubmit() {
    if (reducedMotion || !selected) return;
    const card = cardRefs.current[selected];
    if (!card) return;
    (async () => {
      try {
        const { gsap } = await import("gsap");
        const { durBase } = getMotionDurations();
        gsap.to(card, {
          opacity: 0.75,
          scale: 0.99,
          duration: durBase,
          ease: MOTION_EASE.outSoft,
        });
      } catch {
        // decorative only — a load/animation failure must never block the
        // actual assume_role call or navigation.
      }
    })();
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
      noValidate
    >
      <FormBanner tone="error">{state?.error}</FormBanner>

      <fieldset disabled={isPending} className="flex flex-col gap-3 border-0 p-0">
        <legend className="sr-only">Papéis disponíveis</legend>
        <RiseInGroup className="flex flex-col gap-3">
          {options.map((option) => {
            const label = platformRoleLabel(option.role);
            const summary = scopeSummary(option.role, grants);
            const inputId = `role-option-${option.role}`;
            const isChecked = selected === option.role;
            return (
              <div key={option.role} data-rise>
                <input
                  type="radio"
                  id={inputId}
                  name="role"
                  value={option.role}
                  checked={isChecked}
                  onChange={() => setSelected(option.role)}
                  className="peer sr-only"
                />
                <label
                  ref={(el) => {
                    cardRefs.current[option.role] = el;
                  }}
                  htmlFor={inputId}
                  className="flex cursor-pointer flex-col gap-0.5 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-xs transition-colors hover:border-primary/40 peer-checked:border-primary peer-checked:bg-accent/40 peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40"
                >
                  <span className="font-medium">{label}</span>
                  {summary ? (
                    <span className="text-sm text-muted-foreground">{summary}</span>
                  ) : null}
                </label>
              </div>
            );
          })}
        </RiseInGroup>
      </fieldset>

      <div role="status" aria-live="polite" className="sr-only">
        {isPending ? "Alternando papel…" : ""}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isPending || !selected}
      >
        {isPending ? "Alternando papel…" : "Continuar"}
      </Button>
    </form>
  );
}
