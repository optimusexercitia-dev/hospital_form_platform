"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AddableUser } from "@/lib/queries/members";
import { setProfessionalLinkState } from "@/lib/participants/actions";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { LinkageResolutionFieldset } from "@/components/cases/add-participant-dialog";

/**
 * Remediation for a professional profile already sitting at platform-account
 * linkage `unknown` (ADR 0108 D6, item ④ of FUP-ETH-1). Reachable from the
 * roster row's "Resolver vínculo" affordance (only rendered when the row's
 * link state is `unknown` — {@link import('./case-participants-panel')}).
 *
 * Reuses the SAME radiogroup / user-picker / confirmation strings as the
 * add-participant dialog's "cadastrar novo profissional" form (§2a) — sharing
 * the one {@link LinkageResolutionFieldset} component keeps the audited
 * `no_account` sentence byte-identical everywhere it can appear.
 */
export function ResolveLinkageDialog({
  professionalProfileId,
  professionalName,
  platformUsers,
  open,
  onOpenChange,
}: {
  professionalProfileId: string;
  /** For the dialog's description — the profile being resolved. */
  professionalName: string;
  /** The org roster for the "possui conta" platform-user pick. */
  platformUsers: AddableUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<"linked" | "no_account" | null>(
    null,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  /**
   * The single place `open` transitions to `false` funnels through here — the
   * Dialog's own `onOpenChange`, the Cancel button, and a successful submit —
   * so the reset is a plain function call in an event handler (never inside a
   * `useEffect`), firing exactly once per close.
   */
  function handleOpenChange(next: boolean) {
    if (isPending && !next) return;
    onOpenChange(next);
    if (!next) {
      setError(null);
      setLinkState(null);
      setUserId(null);
      setConfirmed(false);
    }
  }

  const canSubmit =
    !isPending &&
    ((linkState === "linked" && Boolean(userId)) ||
      (linkState === "no_account" && confirmed));

  function submit() {
    if (!canSubmit || !linkState) return;
    setError(null);
    startTransition(async () => {
      const res = await setProfessionalLinkState(
        professionalProfileId,
        linkState,
        linkState === "linked" ? (userId ?? undefined) : undefined,
      );
      if (!res.ok) {
        setError(res.error ?? "Não foi possível registrar o vínculo.");
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-label="Resolver vínculo">
        <DialogHeader>
          <DialogTitle>Resolver vínculo</DialogTitle>
          <DialogDescription>
            {professionalName} ainda não tem o vínculo com conta na plataforma
            resolvido. Informe se possui conta ou confirme que não possui.
          </DialogDescription>
        </DialogHeader>

        {error && <FormBanner tone="error">{error}</FormBanner>}

        <LinkageResolutionFieldset
          linkState={linkState}
          onLinkStateChange={(v) => {
            setLinkState(v);
            if (v !== "linked") setUserId(null);
            if (v !== "no_account") setConfirmed(false);
          }}
          userId={userId}
          onUserIdChange={setUserId}
          confirmed={confirmed}
          onConfirmedChange={setConfirmed}
          users={platformUsers}
          disabled={isPending}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            {isPending ? "Registrando…" : "Registrar vínculo com conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
