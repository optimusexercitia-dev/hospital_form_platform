"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import {
  verifyAuditChainAction,
  type VerifyChainState,
} from "@/lib/audit/actions";
import { AUDIT_MESSAGES } from "@/lib/audit/messages";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * F3 — "Verificar integridade" control. Surfaces the `verify_audit_chain` DEFINER
 * RPC (via the backend-owned `verifyAuditChainAction` server action) and shows a
 * clear pt-BR verdict: OK, or a prominent warning naming the broken `seq`.
 *
 * The action is value-imported (it is a `'use server'` action — safe to import
 * into a client component; no `next/headers` leaks into the bundle). The result
 * region is `role="status"` with `aria-live="polite"` so assistive tech announces
 * the verdict; a failure (`brokenSeq`) escalates to `role="alert"` so it is read
 * assertively. The button is keyboard-operable with the project focus ring.
 *
 * `commissionId` scopes the check to one commission's chain; omitted (admin only)
 * verifies the whole trail.
 */
export function AuditIntegrityCheck({
  commissionId,
}: {
  commissionId?: string;
}) {
  const [state, setState] = useState<VerifyChainState | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const next = await verifyAuditChainAction(commissionId);
        setState(next);
      } catch {
        // The action degrades to a verdict on its own; this is the last-ditch
        // guard so a thrown error never leaves the UI without feedback.
        setState({ ok: false, result: null, message: AUDIT_MESSAGES.generic });
      }
    });
  }

  const broken =
    state?.result && state.result.ok === false ? state.result.brokenSeq : null;
  const isOk = state?.ok === true;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={run}
        disabled={pending}
        aria-busy={pending}
      >
        <ShieldCheck aria-hidden="true" />
        {pending ? "Verificando…" : "Verificar integridade"}
      </Button>

      {state ? (
        <p
          role={broken != null ? "alert" : "status"}
          aria-live={broken != null ? "assertive" : "polite"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium",
            isOk
              ? "bg-success/12 text-success dark:bg-success/15"
              : broken != null
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          {isOk ? (
            <CheckCircle2 aria-hidden="true" className="size-4" />
          ) : broken != null ? (
            <AlertTriangle aria-hidden="true" className="size-4" />
          ) : null}
          <span>
            {state.message}
            {broken != null ? ` (registro seq ${broken})` : ""}
          </span>
        </p>
      ) : null}
    </div>
  );
}
