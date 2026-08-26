"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserRoundMinus } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  INCLUDE_ENDED_PARAM,
  includeEndedValue,
} from "@/components/users/user-directory-ended-filter";

/**
 * "Incluir desligados" — widens the ORG user directory to people whose organization
 * affiliation has ENDED (AFF4 F6; ADR 0151 D10 as amended by ADR 0154).
 *
 * ⛔ THIS CONTROL MUST NEVER RENDER ON THE HOSPITAL-SCOPED DIRECTORY, and "never render"
 * is the requirement — not "render disabled", not "render and do nothing". PO-ruled
 * 2026-08-26 (plan §F6). A `hospital_admin` cannot read `organization_affiliations` at
 * all (ADR 0151 D1; measured: 1 row, their own, against an org_admin's 29), so
 * `listHospitalUsers` cannot honour it. A switch that flips and changes nothing is worse
 * than an absent one — it actively ASSERTS that a filter is being applied. The page owns
 * that decision; this component has no `scope` prop precisely so the choice cannot be
 * made twice.
 *
 * ⚠ A SWITCH, NOT A `<Link>`, and that departs from the status pills next to it on
 * purpose. The pills are navigation between four mutually-exclusive views and get a real
 * `aria-current`; this is one BOOLEAN, whose state has to be perceivable while it is OFF.
 * A link can carry neither `aria-pressed` nor `aria-checked` (`role="switch"` on an
 * anchor promises Space, which anchors do not honour), so the honest control is the
 * platform's own on/off primitive — Radix Switch, keyboard-operable with BOTH Space and
 * Enter, with `aria-checked` handled for us. The URL stays the single source of truth
 * either way.
 *
 * ⚠ NOT DISABLED WHILE PENDING. Disabling the control the user is standing on drops
 * focus to `<body>` mid-interaction and a keyboard user loses their place; the pending
 * state is carried by opacity + `aria-busy` instead. (`UserDirectorySearch` disables its
 * SUBMIT button, which is a different control — you are not standing on it after
 * pressing it.)
 *
 * ⚠ NO COUNT, deliberately, though the pills beside it carry one. Nothing in
 * `OrgUserPage` reports how many people are ended, and the directory's own rule is that a
 * fabricated "· 0" is a false measurement — worse than a missing one.
 */
export function UserDirectoryEndedToggle({
  includeEnded,
}: {
  /** Current state, parsed by the PAGE from `?includeEnded=` — never read here. */
  includeEnded: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const switchId = useId();
  const hintId = useId();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    const value = includeEndedValue(next);
    if (value) {
      params.set(INCLUDE_ENDED_PARAM, value);
    } else {
      params.delete(INCLUDE_ENDED_PARAM);
    }
    // A changed roster always starts at page 1 — the same rule `?search=` and the status
    // pills follow. Widening the set while holding page 7 lands the user somewhere that
    // reads as a different filter's results.
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <span
      aria-busy={isPending || undefined}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-2.5 pl-3.5",
        "transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
        "has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40",
        isPending && "opacity-60",
      )}
    >
      <UserRoundMinus
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      {/* A real `<label htmlFor>` rather than an `aria-label`: `button` is a labelable
          element, so the association is native, and the visible text IS the accessible
          name (WCAG 2.5.3 — no invisible name that disagrees with the visible one). */}
      <label
        htmlFor={switchId}
        className="cursor-pointer text-xs font-semibold whitespace-nowrap text-muted-foreground"
      >
        Incluir desligados
      </label>
      <Switch
        id={switchId}
        checked={includeEnded}
        onCheckedChange={handleChange}
        aria-describedby={hintId}
      />
      {/* The label names the control; this says what flipping it DOES. "Desligado" is
          the org-offboarding word used by the offboarding wizard and the account
          banner — the hint keeps the short label from being the only place a user can
          learn which of the several "inactive" senses is meant. */}
      <span id={hintId} className="sr-only">
        Mostra também as pessoas cujo vínculo com a organização foi encerrado.
      </span>
    </span>
  );
}
