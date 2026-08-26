"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldOff, TriangleAlert } from "lucide-react";

import type { PlatformFootprint } from "@/lib/users/person-footprint";
import {
  endOrgAffiliation,
  type AffiliationActionState,
} from "@/lib/affiliations/actions";
import { deactivateUser } from "@/lib/users/actions";
import { ROLE_LABELS } from "@/components/users/affiliations-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Org offboarding wizard (F3, ADR 0151 D3/D12). "Desligar da organização" —
 * ORG-tier offboarding, distinct from BOTH the account-lifecycle actions above it
 * (platform-wide, in `UserLifecycleActions`) and the per-hospital "Encerrar vínculo"
 * (in `AffiliationsPanel`). This is the middle tier: ends the person's employment
 * relationship with the ORGANIZATION itself.
 *
 * Three steps, exactly as D12 specifies — never fewer:
 * 1. **Confirm** — attempt `endOrgAffiliation`. A refusal (HC0R6, active hospital
 *    affiliations or memberships still held in this org) renders inline and the
 *    wizard STAYS here; nothing advances until the admin clears the blockers
 *    elsewhere and reopens. This mirrors `AffiliationsPanel`'s established pattern
 *    (attempt-then-show, never a separate pre-check query) rather than inventing a
 *    second one.
 * 2. **Resolved** — the org affiliation is now ended. Read from the FRESH
 *    `PlatformFootprint` the page already resolved (see the prop doc below): if the
 *    platform-wide footprint is now empty, step 3 OFFERS deactivation; if not, it
 *    explains what still holds the person, by name, and offers nothing.
 * 3. **Offer** (conditional) — an EXPLICIT, REFUSABLE deactivation offer. Never
 *    automatic: D12 is unambiguous that ending the org affiliation must never itself
 *    deactivate the account.
 *
 * ⚠ `footprint` IS COMPUTED ONCE, BEFORE THE WIZARD EVER OPENS, and does not
 * re-resolve after `endOrgAffiliation` succeeds within this component. That is
 * deliberate for this shape (not a shortcut): `endOrgAffiliation` itself REFUSES
 * unless every hospital affiliation and membership in THIS org is already inactive
 * (D3), so by the time step 1 succeeds, this org can contribute nothing further to
 * the footprint — the only way `footprint.isEmpty` could still be wrong is a tie in
 * ANOTHER org changing state in the few seconds the dialog was open, which the
 * platform-wide, non-RLS-scoped resolver already accounts for at the moment the page
 * loaded. `router.refresh()` on close re-derives everything for the NEXT visit.
 *
 * ⚠ `isEmpty` GATES THE OFFER, NEVER PERMISSION (backend's own caveat, repeated here
 * because it is the one a reviewer will reach for first). The actual "Desativar
 * conta" button still goes through `deactivateUser`, which re-derives the SUBSET
 * bound server-side and refuses in pt-BR exactly like the identity-band action does.
 * This wizard's own gate (`canEndOrgAffiliation` at the call site) is UX only.
 *
 * ⚠ NO CALLBACK PROP ON `AccountSituationBanner`. The plan's own draft asked for one
 * ("banners set before an unmounting callback never paint"), but that precondition
 * requires the banner to OWN a message across an unmount — this banner is
 * presentational and takes no props beyond `status`/`suspendedUntil`; the wizard
 * closes by calling `router.refresh()`, exactly like the identity-band actions above
 * it, which re-renders the whole page (banner included) with fresh server data. A
 * callback here would exist for no consumer.
 *
 * ⚠ EACH STEP IS WRAPPED IN `<div key={step} className="animate-fade-in">` — the
 * design system names step cross-fades explicitly for exactly this shape (a
 * multi-step flow inside one already-open dialog), and an instant content swap
 * costs comprehension, not just polish: nothing else signals to the user that the
 * step actually changed. The `key` forces a fresh mount per step so the CSS
 * animation retriggers every transition, not just the first. `.animate-fade-in`
 * (a plain opacity fade, `--dur-slow`) already collapses under the global
 * `prefers-reduced-motion` rule (`globals.css:310`), so no separate guard is
 * needed here.
 */
export function OrgOffboardingWizard({
  userId,
  organizationId,
  organizationName,
  fullName,
  footprint,
  onClose,
}: {
  userId: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  /**
   * Resolved server-side, ONCE, by the page — see `resolvePlatformFootprint`
   * (`src/lib/users/person-footprint.ts`, server-only, NOT `'use server'`). Passed
   * down as a plain prop, never fetched from this Client Component.
   */
  footprint: PlatformFootprint;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"confirm" | "resolved" | "done">("confirm");
  const [endState, setEndState] = useState<AffiliationActionState | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus the step's own heading on every transition — the same convention the F1
  // error boundaries use, and for the same reason: Radix keeps the dialog mounted
  // and swaps its content in place, which is not a navigation, so nothing else moves
  // focus for a keyboard or screen-reader user.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function confirm() {
    setEndState(null);
    startTransition(async () => {
      const result = await endOrgAffiliation({ userId, organizationId });
      setEndState(result);
      if (result.ok) setStep("resolved");
      // On refusal: stay on "confirm". The blockers render below, in the same step,
      // exactly like `AffiliationsPanel`'s end/void refusals.
    });
  }

  function finish() {
    onClose();
    router.refresh();
  }

  function deactivate() {
    setDeactivateError(null);
    startTransition(async () => {
      const result = await deactivateUser(userId);
      if (!result.ok) {
        setDeactivateError(result.error ?? "Não foi possível desativar a conta.");
        return;
      }
      setStep("done");
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent className="max-w-[29rem] gap-0 p-0">
        {step === "confirm" ? (
          <div key="confirm" className="animate-fade-in flex min-h-0 flex-col">
            <DialogHeader className="gap-1 border-b border-border/60 px-5.5 py-4.5 pr-11">
              <DialogTitle
                ref={headingRef}
                tabIndex={-1}
                className="text-[1.05rem] font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                Desligar {fullName} de {organizationName}?
              </DialogTitle>
              <DialogDescription className="text-[0.72rem]">
                Isto encerra o vínculo da pessoa com a organização em si — diferente
                de encerrar um vínculo hospitalar ou de desativar a conta. É recusado
                enquanto houver vínculos hospitalares ou funções ativas nesta
                organização.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 px-5.5 py-4.5">
              {endState && !endState.ok ? (
                <div
                  role="alert"
                  className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-xs text-destructive"
                >
                  <p className="flex items-start gap-1.5 font-medium">
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                    {endState.error}
                  </p>
                  {endState.blockers && endState.blockers.length > 0 ? (
                    <>
                      <p className="text-destructive/90">
                        Remova estas funções e vínculos antes de desligar:
                      </p>
                      <ul className="flex list-disc flex-col gap-1 pl-5">
                        {endState.blockers.map((b, i) => (
                          <li key={`${b.role}-${b.commission ?? "hospital"}-${i}`}>
                            {ROLE_LABELS[b.role] ?? b.role}
                            {b.commission ? ` — ${b.commission}` : " — cargo do hospital"}
                          </li>
                        ))}
                      </ul>
                      <p className="text-destructive/80">
                        Consulte as seções{" "}
                        <a href="#vinculos-heading" className="underline underline-offset-2">
                          Vínculos hospitalares
                        </a>{" "}
                        e{" "}
                        <a href="#comissoes-heading" className="underline underline-offset-2">
                          Comissões
                        </a>{" "}
                        nesta página.
                      </p>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-[0.8rem] text-muted-foreground text-pretty">
                  O histórico é preservado — a organização passa a constar como
                  encerrada, nunca apagada.
                </p>
              )}
            </div>

            <DialogFooter className="items-center gap-2.5 border-t border-border/60 px-5.5 py-3.5 sm:justify-end">
              <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={isPending}
                onClick={confirm}
              >
                {isPending ? "Desligando…" : "Desligar da organização"}
              </Button>
            </DialogFooter>
          </div>
        ) : step === "resolved" ? (
          <div key="resolved" className="animate-fade-in flex min-h-0 flex-col">
            <ResolvedStep
              headingRef={headingRef}
              footprint={footprint}
              isPending={isPending}
              deactivateError={deactivateError}
              onKeepActive={finish}
              onDeactivate={deactivate}
            />
          </div>
        ) : (
          <div key="done" className="animate-fade-in flex min-h-0 flex-col">
            <DialogHeader className="gap-1 border-b border-border/60 px-5.5 py-4.5 pr-11">
              <DialogTitle
                ref={headingRef}
                tabIndex={-1}
                className="flex items-center gap-2 text-[1.05rem] font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <ShieldOff aria-hidden="true" className="size-4.5 text-muted-foreground" />
                Conta desativada
              </DialogTitle>
              <DialogDescription className="text-[0.72rem]">
                {fullName} foi desligado(a) de {organizationName} e a conta foi
                desativada.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="items-center gap-2.5 border-t border-border/60 px-5.5 py-3.5 sm:justify-end">
              <Button type="button" size="lg" onClick={finish}>
                Concluir
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** pt-BR label for one platform-wide footprint tie, in the "why not offered" list. */
function tieLabel(tie: PlatformFootprint["ties"][number]): string {
  if (tie.kind === "org_affiliation") return "Vínculo com outra organização";
  if (tie.kind === "hospital_affiliation") return "Vínculo hospitalar";
  // membership — role is always set for this kind.
  const role = tie.role ? (ROLE_LABELS[tie.role] ?? tie.role) : "Função";
  return tie.commissionId ? `${role} (comissão)` : role;
}

/**
 * Step 2/3 combined: reports the org-end succeeded, then either OFFERS deactivation
 * (footprint empty) or explains why it is not offered (footprint not empty) —
 * always ONE OF THE TWO, since both are legitimate outcomes of the same successful
 * action and neither should read as a dead end.
 */
function ResolvedStep({
  headingRef,
  footprint,
  isPending,
  deactivateError,
  onKeepActive,
  onDeactivate,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  footprint: PlatformFootprint;
  isPending: boolean;
  deactivateError: string | null;
  onKeepActive: () => void;
  onDeactivate: () => void;
}) {
  return (
    <>
      <DialogHeader className="gap-1 border-b border-border/60 px-5.5 py-4.5 pr-11">
        <DialogTitle
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 text-[1.05rem] font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <LogOut aria-hidden="true" className="size-4.5 text-muted-foreground" />
          Desligamento registrado
        </DialogTitle>
        <DialogDescription className="text-[0.72rem]">
          O vínculo com a organização foi encerrado. O histórico é preservado.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 px-5.5 py-4.5">
        {footprint.isEmpty ? (
          <p className="text-[0.8rem] text-muted-foreground text-pretty">
            Esta pessoa não possui mais nenhum vínculo ativo na plataforma — nenhuma
            organização, hospital ou comissão. Você pode, opcionalmente, desativar a
            conta agora; isso é sempre uma escolha explícita, nunca automático.
          </p>
        ) : (
          <div className="flex flex-col gap-2 text-[0.8rem] text-muted-foreground">
            <p className="text-pretty">
              A conta continua com acesso à plataforma: a pessoa ainda possui os
              seguintes vínculos.
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {footprint.ties.map((tie, i) => (
                <li key={`${tie.kind}-${tie.organizationId ?? ""}-${tie.hospitalId ?? ""}-${tie.commissionId ?? ""}-${i}`}>
                  {tieLabel(tie)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {deactivateError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {deactivateError}
          </p>
        ) : null}
      </div>

      <DialogFooter className="items-center gap-2.5 border-t border-border/60 px-5.5 py-3.5 sm:justify-end">
        <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={onKeepActive}>
          {footprint.isEmpty ? "Manter conta ativa" : "Concluir"}
        </Button>
        {footprint.isEmpty ? (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={isPending}
            onClick={onDeactivate}
          >
            {isPending ? "Desativando…" : "Desativar conta"}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
