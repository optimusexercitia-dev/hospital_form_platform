import { CheckCircle2, Clock } from "lucide-react";

import type { SignoffRole } from "@/lib/queries/forms";
import { cn } from "@/lib/utils";

/**
 * Reusable sign-off status badge (F4). Renders the canonical "assinado por X em
 * DATA" line for a signed section, or a role-aware pending line for an unsigned
 * one. Used by the wizard review screen (F3), the staff_admin review-and-sign
 * screen (F2), and any read-only submission view (Phase 7 reuses it).
 *
 * Pure presentation — no data access, no actions. Inputs are the minimal
 * `{ signedByName, signedAt, note? }` plus a `role`/`pendingFor` hint, so this
 * component compiles and renders AHEAD of the backend data contracts.
 */

/** A recorded sign-off, as surfaced by `getResponseForSignoff` / fill helpers. */
export interface Signoff {
  signedByName: string;
  /** ISO timestamp; formatted to pt-BR here. */
  signedAt: string;
  note?: string | null;
}

export interface SignoffStatusProps {
  /** The recorded sign-off, or null/undefined when the section is unsigned. */
  signoff?: Signoff | null;
  /**
   * Who must sign this section (drives the unsigned label). Optional: when
   * omitted, an unsigned section reads the generic "Pendente".
   */
  role?: SignoffRole | null;
  /**
   * For a `respondent`-role section, whether the current viewer is the
   * respondent. When true the pending label reads "Pendente — sua assinatura";
   * otherwise the section just awaits the respondent. Ignored for staff_admin.
   */
  isRespondent?: boolean;
  className?: string;
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Format an ISO timestamp to pt-BR; falls back to the raw string if invalid. */
function formatSignedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FMT.format(date);
}

/** The pt-BR pending label for an unsigned section, role-aware. */
function pendingLabel(role: SignoffRole | null | undefined, isRespondent: boolean): string {
  if (role === "staff_admin") return "Pendente — chefia";
  if (role === "respondent") {
    return isRespondent ? "Pendente — sua assinatura" : "Pendente — responsável";
  }
  return "Pendente";
}

export function SignoffStatus({
  signoff,
  role,
  isRespondent = false,
  className,
}: SignoffStatusProps) {
  if (signoff) {
    return (
      <div
        className={cn(
          "flex flex-col gap-1 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5",
          className,
        )}
      >
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CheckCircle2
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
          <span>
            Assinado por {signoff.signedByName} em{" "}
            <time dateTime={signoff.signedAt}>
              {formatSignedAt(signoff.signedAt)}
            </time>
          </span>
        </p>
        {signoff.note && signoff.note.trim() !== "" && (
          <p className="pl-6 text-sm text-muted-foreground text-pretty">
            “{signoff.note.trim()}”
          </p>
        )}
      </div>
    );
  }

  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      <Clock aria-hidden="true" className="size-4 shrink-0" />
      {pendingLabel(role, isRespondent)}
    </p>
  );
}
