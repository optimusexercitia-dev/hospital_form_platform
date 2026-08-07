"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Eye, PenLine, UserCog, X } from "lucide-react";

import type { CaseAccessGrant, CaseDetail } from "@/lib/queries/cases";
import type { MemberListItem } from "@/lib/queries/members";
import {
  grantCaseAccess,
  revokeCaseAccess,
  type CaseAccessLevel,
} from "@/lib/case-access/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";
import { useCaseAction } from "@/components/cases/use-case-action";
import { initials, formatDate } from "@/components/cases/format";
import { cn } from "@/lib/utils";

/**
 * Coordinator-only ACCESS roster (Case Access Control increment, ADR 0033 D6/D7;
 * FE-5; expiry + reason added in the action-items-fold work, ADR 0050). The
 * per-member read/write grant control over a case's access surface — grant any
 * commission member read or write access (`grantCaseAccess`) with an optional
 * expiry and justification, or remove an explicit grant (`revokeCaseAccess`).
 * Each row shows whether the member is ATTRIBUTED (a phase/narrative assignee) —
 * which auto-grants full-case read that a revoke CANNOT remove (D6: unassign to
 * remove it). Attribution is derived here from the loaded phases + narratives.
 *
 * This is the BODY of the "Acesso ao caso" dialog opened from {@link CaseAccessButton}
 * in the coordinator `(detail)` layout header; it no longer renders its own card
 * chrome (the Dialog provides the frame). Narrative ASSIGNMENT moved onto each
 * narrative card ({@link import('./case-narrative-card').CaseNarrativeCard}).
 *
 * Only NON-coordinator members are listed: a `staff_admin` already holds full-case
 * access by role, so a grant/revoke control on them (including the viewing coordinator
 * on themselves) is meaningless/misleading. This inherently removes the current viewer.
 *
 * Each row shows the member's STORED grant level — `Leitura` (read) or `Edição`
 * (write) — its expiry (`Expira em dd/mm/aaaa`, or an `Expirada` badge once past),
 * and its justification when present, from {@link CaseAccessGrant} rows the parent
 * loads server-side, beside the DERIVED `Atribuído` chip; a member may show both
 * (an attributed member can also hold an explicit grant) or neither. Authorization
 * is the DB's (coordinator/admin; `HC021` member check); each action surfaces a
 * pt-BR error inline. A grant/revoke refreshes the server layout (via `useCaseAction`
 * → `router.refresh()`), re-loading the grants so the row updates live. Rendered
 * only when the viewer holds `canManageLifecycle` and the `case_access` flag is on
 * (the parent gates this).
 */
export function CaseAccessPanel({
  caseId,
  members,
  detail,
  grants,
  caseOpen,
}: {
  caseId: string;
  /** The commission roster (already sorted by the parent). */
  members: MemberListItem[];
  detail: CaseDetail;
  /** The stored read/write grant rows, loaded server-side by the parent. */
  grants: CaseAccessGrant[];
  /**
   * Whether the case is non-terminal. Read grants are allowed on terminal cases
   * (ADR 0033 D6); only WRITE grants require an open case, so on a terminal case the
   * write option is disabled (the server enforces this regardless).
   */
  caseOpen: boolean;
}) {
  const { run, isPending, error } = useCaseAction();

  // The member whose grant dialog is open (null = closed). Reused for grant + edit.
  const [dialogMember, setDialogMember] = useState<MemberListItem | null>(null);

  // Members attributed on at least one phase or narrative (derived) → auto full read.
  const attributedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of detail.phases) if (p.assignedTo) ids.add(p.assignedTo);
    for (const n of detail.narratives) if (n.assignedTo) ids.add(n.assignedTo);
    return ids;
  }, [detail.phases, detail.narratives]);

  // The stored explicit grant per member (level/expiry/reason), keyed by user id.
  const grantByUser = useMemo(() => {
    const map = new Map<string, CaseAccessGrant>();
    for (const g of grants) map.set(g.userId, g);
    return map;
  }, [grants]);

  // Coordinators (`staff_admin`) already hold full-case access by role, so a
  // grant/revoke control on them is meaningless — and revoking your OWN access is
  // misleading. List only non-coordinator members (this also drops the viewer).
  const grantableMembers = members.filter((m) => m.role !== "staff_admin");

  const activeGrant = dialogMember
    ? grantByUser.get(dialogMember.userId)
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground text-pretty">
        Conceda leitura ou edição a qualquer membro, com um prazo e uma
        justificativa opcionais. Quem tem uma fase ou narrativa atribuída já
        enxerga o caso inteiro (remova a atribuição para retirar esse acesso).
      </p>
      {grantableMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-pretty">
          Nenhum outro membro para conceder acesso.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {grantableMembers.map((m) => {
            const name = m.fullName ?? m.email ?? "Membro";
            const attributed = attributedIds.has(m.userId);
            const grant = grantByUser.get(m.userId);
            return (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                  >
                    {initials(name)}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {name}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      Membro
                      {/* Stored explicit grant level (D1: shown alongside — not
                          instead of — `Atribuído`; a member may carry both). Same
                          pill shape as `Atribuído`, distinct fill + label. */}
                      {grant && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
                            grant.level === "write"
                              ? "bg-primary/12 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {grant.level === "write" ? "Edição" : "Leitura"}
                        </span>
                      )}
                      {attributed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
                          Atribuído
                        </span>
                      )}
                      {grant && <GrantExpiry grant={grant} />}
                    </span>
                    {grant?.reason && (
                      <span className="truncate text-xs text-muted-foreground text-pretty">
                        Motivo: {grant.reason}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setDialogMember(m)}
                  >
                    <UserCog aria-hidden="true" />
                    {grant ? "Editar acesso" : "Conceder acesso"}
                  </Button>
                  {grant && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending}
                      onClick={() =>
                        run(() => revokeCaseAccess(caseId, m.userId))
                      }
                      aria-label={`Remover acesso de ${name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialogMember && (
        <GrantDialog
          key={dialogMember.userId}
          onOpenChange={(open) => {
            if (!open) setDialogMember(null);
          }}
          caseId={caseId}
          member={dialogMember}
          grant={activeGrant}
          caseOpen={caseOpen}
        />
      )}
    </div>
  );
}

/**
 * The expiry state of a stored grant: a muted "Expira em dd/mm/aaaa" when a future
 * expiry is set, or a distinct (icon + text, not colour-alone) "Expirada" badge
 * once past. Renders nothing for an open-ended grant ("sem prazo").
 */
function GrantExpiry({ grant }: { grant: CaseAccessGrant }) {
  if (!grant.expiresAt) return null;
  const expired = new Date(grant.expiresAt).getTime() <= new Date().getTime();
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-destructive uppercase">
        <CalendarClock aria-hidden="true" className="size-3" />
        Expirada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 tabular-nums normal-case">
      <CalendarClock aria-hidden="true" className="size-3" />
      Expira em {formatDate(grant.expiresAt)}
    </span>
  );
}

/** ISO `YYYY-MM-DD` `n` days from today (local date parts, no TZ shift). */
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO `YYYY-MM-DD` for tomorrow — the earliest a `Data específica` may be. */
function isoTomorrow(): string {
  return isoDaysFromNow(1);
}

/** Strip the time part of an ISO timestamptz to `YYYY-MM-DD` (local parts). */
function ymdFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Turn a `YYYY-MM-DD` date (from a preset or the picker) into the ISO timestamptz
 * the action expects, pinned to the END of that day (local) so a "30 dias" grant
 * stays valid through the whole target day rather than expiring at midnight.
 */
function endOfDayIso(dateYmd: string): string {
  const [y, m, d] = dateYmd.split("-").map((n) => Number.parseInt(n, 10));
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** The expiry-preset options for the dialog's select. */
type ExpiryPreset = "none" | "30" | "90" | "date";

/**
 * The grant/edit dialog: pick a level (Leitura/Edição), an expiry (a preset —
 * Sem prazo / 30 dias / 90 dias — or a specific date via the calendar picker),
 * and an optional justification. Prefilled from an existing grant when editing.
 * A re-grant is an UPSERT server-side, so this doubles as the edit affordance.
 * Fully keyboard-operable + labelled (the tester runs a keyboard-only grant flow).
 */
function GrantDialog({
  onOpenChange,
  caseId,
  member,
  grant,
  caseOpen,
}: {
  onOpenChange: (open: boolean) => void;
  caseId: string;
  member: MemberListItem;
  grant: CaseAccessGrant | undefined;
  caseOpen: boolean;
}) {
  const { run, isPending, error } = useCaseAction();
  const name = member.fullName ?? member.email ?? "Membro";

  // A stored WRITE grant on a now-terminal case can be edited down to read, but a
  // new write is blocked (the server enforces). Default to the existing level, else read.
  const [level, setLevel] = useState<CaseAccessLevel>(grant?.level ?? "read");
  const [preset, setPreset] = useState<ExpiryPreset>(
    grant?.expiresAt == null ? "none" : "date",
  );
  const [customDate, setCustomDate] = useState<string>(
    grant?.expiresAt ? ymdFromIso(grant.expiresAt) : "",
  );
  const [reason, setReason] = useState(grant?.reason ?? "");
  const [dateError, setDateError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDateError(null);

    // Resolve the chosen expiry to an ISO timestamptz (or null = "sem prazo").
    let expiresAt: string | null;
    if (preset === "none") {
      expiresAt = null;
    } else if (preset === "30") {
      expiresAt = endOfDayIso(isoDaysFromNow(30));
    } else if (preset === "90") {
      expiresAt = endOfDayIso(isoDaysFromNow(90));
    } else {
      if (!customDate) {
        setDateError("Escolha uma data de expiração.");
        return;
      }
      expiresAt = endOfDayIso(customDate);
    }

    run(
      () =>
        grantCaseAccess(
          caseId,
          member.userId,
          level,
          expiresAt,
          reason.trim() || null,
        ),
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {grant ? "Editar acesso" : "Conceder acesso"}
          </DialogTitle>
          <DialogDescription>
            Defina o nível de acesso de{" "}
            <span className="font-medium">{name}</span> a este caso, com um prazo
            e uma justificativa opcionais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          {/* Level — radios in a fieldset/legend for correct grouping + keyboard nav. */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">
              Nível de acesso
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <LevelOption
                checked={level === "read"}
                onSelect={() => setLevel("read")}
                icon={<Eye aria-hidden="true" className="size-4" />}
                title="Leitura"
                hint="Visualizar o caso"
              />
              <LevelOption
                checked={level === "write"}
                onSelect={() => setLevel("write")}
                disabled={!caseOpen}
                icon={<PenLine aria-hidden="true" className="size-4" />}
                title="Edição"
                hint={caseOpen ? "Editar o caso" : "Indisponível (encerrado)"}
              />
            </div>
          </fieldset>

          {/* Expiry — preset select + a date picker shown only for "Data específica". */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="grant-expiry" className="text-sm font-medium">
              Expiração{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            <NativeSelect
              id="grant-expiry"
              className="h-10 py-2"
              aria-describedby="grant-expiry-hint"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as ExpiryPreset);
                setDateError(null);
              }}
            >
              <option value="none">Sem prazo</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="date">Data específica</option>
            </NativeSelect>
            {/* FUP-QO-7 (PO ruling 2026-08-07): permanent access must be STATED, not
                inferred — a coordinator should never grant or extend permanent access to
                a case (and its PHI) without reading that they did. Note the permanent
                option here is the explicit “Sem prazo” preset: this dialog has no
                blank-means-permanent field, and a cleared date under “Data específica”
                is a validation error, not a permanent grant.
                The second wording is the re-grant case, and it is not a guess — the door
                overwrites the expiry unconditionally (`expires_at = excluded.expires_at`
                in `app._grant_case_access_unchecked`, read from the catalog), so picking
                “Sem prazo” while editing a grant that HAS a prazo drops it. */}
            <p id="grant-expiry-hint" className="text-xs text-muted-foreground">
              {grant?.expiresAt
                ? "“Sem prazo” torna o acesso permanente e remove o prazo atual — válido até ser revogado."
                : "“Sem prazo” concede acesso permanente — válido até ser revogado."}
            </p>
            {preset === "date" && (
              <div className="mt-1">
                <DatePicker
                  value={customDate}
                  onChange={(v) => {
                    setCustomDate(v);
                    setDateError(null);
                  }}
                  min={isoTomorrow()}
                  clearable
                  placeholder="Selecionar data de expiração"
                  aria-invalid={dateError ? true : undefined}
                  aria-describedby={dateError ? "grant-expiry-error" : undefined}
                />
              </div>
            )}
            {dateError && (
              <span
                id="grant-expiry-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {dateError}
              </span>
            )}
          </div>

          {/* Reason — optional pt-BR justification (LGPD / accreditation evidence). */}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Motivo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              name="reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Apoio à análise da fase de investigação."
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Salvando…" : "Conceder acesso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A single selectable access level, rendered as an accessible radio (label wraps a
 * visually-hidden native input so the whole card is keyboard-focusable and the
 * selection is conveyed by border + fill + text, never colour alone).
 */
function LevelOption({
  checked,
  onSelect,
  disabled = false,
  icon,
  title,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-[color,box-shadow,border-color]",
        "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
        checked
          ? "border-primary bg-primary/8 text-foreground"
          : "border-input bg-card text-foreground hover:border-ring/60",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="radio"
        name="grant-level"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex items-center gap-1.5 font-medium">
        {icon}
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  );
}
