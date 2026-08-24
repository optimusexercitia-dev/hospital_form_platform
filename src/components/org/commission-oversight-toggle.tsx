"use client";

import { useId, useState, useTransition } from "react";

import {
  setCommissionOversight,
  type QualityOversight,
} from "@/lib/quality/actions";
import { Switch } from "@/components/ui/switch";
import { usePendingFocus } from "@/components/ui/use-pending-focus";

/**
 * Opt a commission in/out of quality-office oversight (ADR 0100 D8/D9).
 *
 * Authority is the DEFINER door `set_commission_oversight`
 * (`is_hospital_admin_of OR is_org_admin_of`), and a BEFORE trigger blocks every
 * raw write to the column — so this control cannot be the boundary and does not
 * try to be. It renders only on `/o/[org]/manage/comissoes`, which the manage
 * layout already gates to exactly those two principals; the committee cannot opt
 * ITSELF out, and platform_admin is out by the noun rule.
 *
 * `'excluded'` is the DEFAULT and fails closed (D8), so the off state is styled
 * as neutral, never as a warning: a commission outside oversight is the normal
 * starting condition, not a misconfiguration.
 *
 * Optimistic, with rollback: the switch flips immediately (a governance toggle
 * that lags feels broken), and reverts with a pt-BR message if the door refuses.
 */
export function CommissionOversightToggle({
  commissionId,
  commissionName,
  oversight,
}: {
  commissionId: string;
  /** For the accessible name — never a bare "Supervisão" on a list of rows. */
  commissionName: string;
  oversight: QualityOversight;
}) {
  const [current, setCurrent] = useState<QualityOversight>(oversight);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hintId = useId();
  const errorId = useId();
  // FUP-0137-PERSIST-REFRESH-DROPS-FOCUS, same class as the patient-mode picker:
  // the Switch disables ITSELF while its own write is in flight, which blows focus
  // to `<body>`. On this page that is a LIST of commissions, so the cost is a Tab
  // walk back down the list for every row a hospital admin toggles.
  const parkFocus = usePendingFocus(isPending);

  const isOn = current === "visible";

  function onCheckedChange(next: boolean) {
    const target: QualityOversight = next ? "visible" : "excluded";
    const previous = current;
    parkFocus();
    setCurrent(target);
    setError(null);
    startTransition(async () => {
      const result = await setCommissionOversight(commissionId, target);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.error ?? "Não foi possível alterar a supervisão.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2.5">
        <span className="flex flex-col items-end">
          <span className="text-xs font-medium text-foreground">
            Supervisão da qualidade
          </span>
          <span id={hintId} className="text-[0.7rem] text-muted-foreground">
            {isOn
              ? "Casos e painéis visíveis ao Escritório da Qualidade"
              : "Fora do alcance do Escritório da Qualidade"}
          </span>
        </span>
        <Switch
          checked={isOn}
          onCheckedChange={onCheckedChange}
          disabled={isPending}
          aria-label={`Supervisão da qualidade — ${commissionName}`}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        />
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="max-w-xs text-right text-[0.7rem] text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
