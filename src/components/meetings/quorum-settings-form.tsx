"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  CommissionMeetingSettings,
  QuorumRuleType,
} from "@/lib/queries/meetings";
import { updateMeetingSettings } from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import {
  describeQuorumRule,
  QUORUM_RULE_LABEL,
  QUORUM_RULE_ORDER,
} from "./meeting-labels";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** Whether the rule needs a numeric value (fixed_count / percentage). */
function ruleNeedsValue(rule: QuorumRuleType): boolean {
  return rule === "fixed_count" || rule === "percentage";
}

/**
 * Edit the commission's quorum rule (F5, staff_admin). Picks the rule type and,
 * for `fixed_count` / `percentage`, a value (the field is hidden for
 * `maioria_simples`). Calls `updateMeetingSettings`; pt-BR errors surface inline
 * and the route refreshes on success. A live description previews the rule.
 */
export function QuorumSettingsForm({
  commissionId,
  settings,
}: {
  commissionId: string;
  settings: CommissionMeetingSettings | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [ruleType, setRuleType] = useState<QuorumRuleType>(
    settings?.quorumRuleType ?? "maioria_simples",
  );
  const [value, setValue] = useState<string>(
    settings?.quorumValue != null ? String(settings.quorumValue) : "",
  );

  const needsValue = ruleNeedsValue(ruleType);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    let quorumValue: number | null = null;
    if (needsValue) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        setError(
          "Informe um valor de quórum válido para a regra escolhida.",
        );
        return;
      }
      if (ruleType === "percentage" && parsed > 100) {
        setError("O percentual deve estar entre 1 e 100.");
        return;
      }
      quorumValue = parsed;
    }

    startTransition(async () => {
      const result = await updateMeetingSettings(
        commissionId,
        ruleType,
        quorumValue,
      );
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  // The live value (parsed) for the preview description.
  const previewValue = needsValue
    ? Number.isNaN(Number.parseInt(value, 10))
      ? null
      : Number.parseInt(value, 10)
    : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && <FormBanner tone="error">{error}</FormBanner>}
      {saved && !error && <FormBanner tone="success">Regra de quórum salva.</FormBanner>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Regra</span>
          <select
            value={ruleType}
            onChange={(e) => {
              const next = e.target.value as QuorumRuleType;
              setRuleType(next);
              setSaved(false);
              // Clear a stale value when switching to a rule that ignores it.
              if (!ruleNeedsValue(next)) setValue("");
            }}
            className={FIELD_CLASS}
          >
            {QUORUM_RULE_ORDER.map((r) => (
              <option key={r} value={r}>
                {QUORUM_RULE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>

        {needsValue && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              {ruleType === "percentage"
                ? "Percentual (1–100)"
                : "Número de presentes"}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={ruleType === "percentage" ? 100 : undefined}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSaved(false);
              }}
              required
              className={FIELD_CLASS}
              placeholder={ruleType === "percentage" ? "Ex.: 50" : "Ex.: 5"}
            />
          </label>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-pretty">
        {describeQuorumRule(ruleType, previewValue)}
      </p>

      <div>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar regra de quórum"}
        </Button>
      </div>
    </form>
  );
}
