import { Eye, PenLine, ShieldCheck } from "lucide-react";

import type { MyCaseRole } from "@/lib/queries/cases";
import { cn } from "@/lib/utils";

/**
 * The viewer's relationship to a case rendered as a small chip (Case Access
 * Control increment, ADR 0033 D7): `coordinator` (manages the case), `collaborator`
 * (case-wide content write grant), or `viewer` (read-only — a read grant or an
 * attribution-derived read). Conveys role by ICON + TEXT (never colour alone, per
 * the a11y rules). Shown on the "Meus Casos" card and the staff case-detail header.
 *
 * Pure presentational, Server-Component-safe.
 */
const ROLE_META: Record<
  MyCaseRole,
  { label: string; icon: typeof Eye; className: string }
> = {
  coordinator: {
    label: "Coordenação",
    icon: ShieldCheck,
    className: "bg-primary/10 text-primary dark:bg-primary/15",
  },
  collaborator: {
    label: "Colaboração",
    icon: PenLine,
    className: "bg-accent text-accent-foreground",
  },
  viewer: {
    label: "Leitura",
    icon: Eye,
    className: "bg-muted text-muted-foreground",
  },
};

export function CaseRoleChip({
  role,
  className,
}: {
  role: MyCaseRole;
  className?: string;
}) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        meta.className,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  );
}
