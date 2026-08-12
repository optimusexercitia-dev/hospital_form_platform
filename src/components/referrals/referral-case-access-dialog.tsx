"use client";

import { HeartPulse, ShieldCheck, UserRound, Users } from "lucide-react";

import type { ReferralCaseAccessSummary } from "@/lib/referrals/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Quem pode abrir este caso?" — the roster dialog a reader gets when the case
 * linked to this referral is one they cannot open (RDR D5; ADR 0109 D3).
 *
 * The payload comes from the audited `get_referral_case_access_summary` door, whose
 * groups are decided by calling `app.has_case_capability(…, 'read_case_content')`
 * per candidate — so this list is *definitionally* "the people for whom
 * `can_read_case` is true", grouped and de-duped into the highest group. FIVE groups
 * (plan amendment A7), not three: plain members and org_admins confer other
 * capability bits and therefore never appear here.
 *
 * PHI-FREE: full names only — never a grant reason, an expiry, or any patient
 * identifier. Radix `Dialog` supplies the focus trap + Esc/overlay dismissal.
 */
export function ReferralCaseAccessDialog({
  open,
  onOpenChange,
  summary,
  caseNumberLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The side-derived roster; `null` when the door refused or found no case. */
  summary: ReferralCaseAccessSummary | null;
  /** "Caso 0042" — names the case the roster is about. */
  caseNumberLabel: string;
}) {
  const groups: { key: string; label: string; icon: typeof UserRound; names: string[] }[] =
    [
      {
        key: "coordinators",
        label: "Coordenadores",
        icon: ShieldCheck,
        names: summary?.coordinators ?? [],
      },
      {
        key: "grantees",
        label: "Acesso concedido",
        icon: Users,
        names: summary?.grantees ?? [],
      },
      {
        key: "assignees",
        label: "Atribuídos",
        icon: UserRound,
        names: summary?.assignees ?? [],
      },
      {
        key: "patientSafety",
        label: "Segurança do paciente",
        icon: HeartPulse,
        names: summary?.patientSafety ?? [],
      },
      {
        key: "quality",
        label: "Qualidade",
        icon: ShieldCheck,
        names: summary?.quality ?? [],
      },
    ];

  // Empty groups are hidden entirely (plan D5) — an empty heading would read as
  // "nobody in this category has access", which the door does not assert.
  const visible = groups.filter((g) => g.names.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quem tem acesso a {caseNumberLabel}</DialogTitle>
          <DialogDescription>
            Você não tem acesso a este caso. Solicite acesso a um coordenador.
          </DialogDescription>
        </DialogHeader>

        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground text-pretty">
            Não foi possível identificar quem tem acesso a este caso.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((group) => {
              const Icon = group.icon;
              return (
                <section key={group.key} className="flex flex-col gap-1.5">
                  <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <Icon aria-hidden="true" className="size-3.5" />
                    {group.label}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {group.names.map((name) => (
                      <li
                        key={`${group.key}-${name}`}
                        className="rounded-lg border border-border/70 bg-muted/20 px-3 py-1.5 text-sm text-foreground"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
