import type { CommissionRole } from "@/lib/queries/session";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<CommissionRole, string> = {
  staff: "Membro",
  staff_admin: "Coordenação",
};

const ROLE_STYLES: Record<CommissionRole, string> = {
  // Coordinators get the petrol accent fill; members a neutral pill — matching
  // the pill language already used across the shell.
  staff_admin: "bg-accent text-accent-foreground",
  staff: "bg-muted text-muted-foreground",
};

/**
 * Small role pill (Membro / Coordenação) reusing the shell's pill style. Pure
 * presentational, Server-Component-safe.
 */
export function RoleBadge({
  role,
  className,
}: {
  role: CommissionRole;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        ROLE_STYLES[role],
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
