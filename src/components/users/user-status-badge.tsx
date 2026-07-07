import { cn } from "@/lib/utils";
import type { UserStatus } from "@/lib/users/types";

/**
 * Status pill for a user's derived lifecycle state (`deriveUserStatus`).
 * Mirrors `@/components/forms/status-badge.tsx`'s pill language: pending reads
 * as a neutral/muted "awaiting" tone, active gets the accent fill (the "good"
 * state), suspended reads as warning amber, deactivated reads as
 * destructive-muted (locked out, not an active alarm). Status is also always
 * paired with the pt-BR text label — never color alone (accessibility).
 */

const STATUS_LABEL: Record<UserStatus, string> = {
  pending: "Pendente",
  active: "Ativo",
  suspended: "Suspenso",
  deactivated: "Desativado",
};

const STATUS_STYLES: Record<UserStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-accent text-accent-foreground",
  suspended: "bg-warning/15 text-warning",
  deactivated: "bg-destructive/10 text-destructive",
};

export function UserStatusBadge({
  status,
  className,
}: {
  status: UserStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
