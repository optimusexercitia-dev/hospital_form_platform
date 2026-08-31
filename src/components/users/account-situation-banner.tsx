import { Info } from "lucide-react";

import { formatSuspensionDate } from "@/lib/users/suspension-date";
import type { UserStatus } from "@/lib/users/types";

/**
 * The "Situação" banner at the top of the profile's main column (redesign 2a).
 *
 * It answers the one question the identity band's pill can only hint at: what the
 * current state MEANS for this person's access, and which control is the right one to
 * change it. That distinction is the reason the banner exists rather than being folded
 * into the pill — the platform has two very different offboarding actions (deactivating
 * the ACCOUNT, which is platform-wide, and ending a HOSPITAL AFFILIATION, which is
 * local) and an admin reaching for the wrong one removes someone's access at hospitals
 * they had no business touching.
 *
 * ⚠ COPY IS TIED TO STATUS, NOT TO THE CALLER'S PERMISSIONS. Every admin who can see
 * this page sees the same explanation; whether they may ACT on it is decided by the
 * lifecycle controls above. Never hide data, only actions.
 *
 * Presentational and Server-Component-safe. No `role="status"`: the text is rendered
 * with the page, not announced on a change, and a live region that never updates only
 * adds noise.
 */
export function AccountSituationBanner({
  status,
  suspendedUntil,
}: {
  status: UserStatus;
  /** ISO timestamp of an active suspension's end, or null for an indefinite one. */
  suspendedUntil: string | null;
}) {
  const { lead, body } = situationCopy(status, suspendedUntil);

  return (
    <div className="animate-rise-in flex items-start gap-2.5 rounded-xl border border-border bg-muted/60 px-4.5 py-3">
      <Info
        aria-hidden="true"
        className="mt-px size-4 shrink-0 text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground text-pretty">
        <strong className="font-semibold text-foreground">{lead}</strong> {body}
      </p>
    </div>
  );
}

function situationCopy(
  status: UserStatus,
  suspendedUntil: string | null,
): { lead: string; body: string } {
  switch (status) {
    case "active":
      return {
        lead: "Situação: ativa.",
        body: "Suspender ou desativar encerra o acesso em toda a plataforma, inclusive em outros hospitais. Para desligar apenas de um hospital, encerre o vínculo hospitalar abaixo.",
      };
    case "pending":
      return {
        lead: "Situação: pendente.",
        body: "O convite foi enviado e ainda não foi aceito, então a pessoa ainda não acessa a plataforma. Se o link expirou, reenvie o convite.",
      };
    case "suspended":
      return {
        lead: suspendedUntil
          ? `Situação: suspensa até ${formatSuspensionDate(suspendedUntil)}.`
          : "Situação: suspensa.",
        body: suspendedUntil
          ? "O acesso está bloqueado em toda a plataforma até essa data, quando a conta é reativada automaticamente. Os vínculos hospitalares e as comissões continuam registrados."
          : "O acesso está bloqueado em toda a plataforma até que a conta seja reativada manualmente. Os vínculos hospitalares e as comissões continuam registrados.",
      };
    case "deactivated":
      return {
        lead: "Situação: desativada.",
        body: "A pessoa não acessa a plataforma em nenhum hospital. Os vínculos e o histórico foram preservados e voltam a valer se a conta for reativada.",
      };
  }
}

// BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY: `formatSuspensionDate` moved to
// `@/lib/users/suspension-date`, beside `endOfSuspensionDay`, so the render and
// the write cannot drift about what "suspenso até D" means. It formerly lived
// here with no `timeZone`, which rendered a midnight-UTC value as the PREVIOUS
// day in America/Sao_Paulo.
