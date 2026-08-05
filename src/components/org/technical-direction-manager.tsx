"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Repeat, Stethoscope, UserCog } from "lucide-react";

import type { PqsEligibleUser } from "@/lib/pqs/roster-types";
import type { RoleHolder, TechnicalDirection } from "@/lib/queries/org";
import {
  appointTechnicalDirector,
  appointTechnicalDirectorDeputy,
  revokeTechnicalDirector,
  revokeTechnicalDirectorDeputy,
} from "@/lib/org/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { initials, formatGrantedAt } from "@/components/org/format";

function personLabel(p: {
  fullName: string | null;
  email: string | null;
}): string {
  return p.fullName?.trim() || p.email || "Sem identificação";
}

/**
 * The Diretor Técnico management surface for ONE hospital (ADR 0094 W4, FUP-MEM-3).
 *
 * Every Brazilian hospital has a Diretor Técnico: an elected physician technically
 * responsible for all of the hospital's committees. The office has an unusual shape
 * that this UI has to carry honestly rather than flatten into a generic role picker:
 *
 *  - **Exactly one titular.** Appointing over a seated one is a REPLACEMENT, not a
 *    second grant — `appoint_technical_director` revokes the incumbent and grants the
 *    successor in one transaction, so a handover is never observable as a hospital
 *    with two directors or with none. The affordance is therefore labelled
 *    "Substituir", and the dialog says what will happen to the incumbent. A plain
 *    grant over a seated office is refused by the kernel (HC0G4), so an "Adicionar"
 *    button here would be an affordance that cannot work.
 *  - **Deputies are unbounded and hold the SAME authority** (decision D1) — a
 *    substituto who cannot decide is decorative, and a referral would stall whenever
 *    the titular was away. The copy says so; it is not a lesser role.
 *  - **Physician-only**, resolved by the kernel against the professional-category
 *    VALUE. The picker cannot pre-filter (the eligible-user pool carries no category),
 *    so the dialog states the requirement up front and the action's mapped HC0G3
 *    message names it precisely if the choice was wrong.
 *
 * ⛔ platform_admin is NOT an authority here, unlike every other appointment screen:
 * the PO ruled this a tenant governance act with legal weight. The server action's
 * `authorizeTechnicalDirection` carries no `isAdmin` arm and the kernel's DT arm has
 * no `is_admin_for` branch. This component never asks — the page that mounts it and
 * the action both gate — but do not "fix" a platform admin's 42501 here.
 */
export function TechnicalDirectionManager({
  hospitalId,
  hospitalName,
  direction,
  eligibleUsers,
}: {
  hospitalId: string;
  hospitalName: string;
  direction: TechnicalDirection;
  eligibleUsers: PqsEligibleUser[];
}) {
  const { titular, deputies } = direction;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Titular ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Diretor(a) técnico(a)
          </h3>
          <AppointDialog
            hospitalId={hospitalId}
            hospitalName={hospitalName}
            eligibleUsers={eligibleUsers}
            excludeUserIds={
              new Set(
                [titular?.userId, ...deputies.map((d) => d.userId)].filter(
                  (id): id is string => Boolean(id),
                ),
              )
            }
            kind="titular"
            replacing={titular}
          />
        </div>

        {titular ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            <HolderRow
              person={titular}
              badge="Titular"
              hospitalId={hospitalId}
              hospitalName={hospitalName}
              kind="titular"
            />
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-pretty text-muted-foreground">
            Nenhum(a) diretor(a) técnico(a) designado(a). Encaminhamentos à
            direção técnica deste hospital não terão destinatário.
          </p>
        )}
      </div>

      {/* ── Substitutos ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Substitutos(as)
          </h3>
          <AppointDialog
            hospitalId={hospitalId}
            hospitalName={hospitalName}
            eligibleUsers={eligibleUsers}
            excludeUserIds={
              new Set(
                [titular?.userId, ...deputies.map((d) => d.userId)].filter(
                  (id): id is string => Boolean(id),
                ),
              )
            }
            kind="deputy"
            replacing={null}
          />
        </div>

        {deputies.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-pretty text-muted-foreground">
            Nenhum(a) substituto(a) designado(a).
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {deputies.map((person) => (
              <HolderRow
                key={person.userId}
                person={person}
                badge="Substituto(a)"
                hospitalId={hospitalId}
                hospitalName={hospitalName}
                kind="deputy"
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HolderRow({
  person,
  badge,
  hospitalId,
  hospitalName,
  kind,
}: {
  person: RoleHolder;
  badge: string;
  hospitalId: string;
  hospitalName: string;
  kind: "titular" | "deputy";
}) {
  const label = personLabel(person);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
        >
          {initials(label)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{label}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              {badge}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {person.email ? `${person.email} · ` : ""}
            desde {formatGrantedAt(person.grantedAt)}
          </p>
        </div>
      </div>
      <RevokeButton
        hospitalId={hospitalId}
        hospitalName={hospitalName}
        userId={person.userId}
        label={label}
        kind={kind}
      />
    </li>
  );
}

/**
 * One dialog for all three appointments (seat a titular, REPLACE a titular, add a
 * deputy) — they differ only in copy and which action runs, and three near-identical
 * dialogs would drift.
 */
function AppointDialog({
  hospitalId,
  hospitalName,
  eligibleUsers,
  excludeUserIds,
  kind,
  replacing,
}: {
  hospitalId: string;
  hospitalName: string;
  eligibleUsers: PqsEligibleUser[];
  /** Already seated in the office — offering them again would only earn a refusal. */
  excludeUserIds: Set<string>;
  kind: "titular" | "deputy";
  /** The incumbent this appointment will REPLACE (titular only); `null` when vacant. */
  replacing: RoleHolder | null;
}) {
  const router = useRouter();
  const personFieldId = useId();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedPerson, setSelectedPerson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () =>
      eligibleUsers
        .filter((u) => !excludeUserIds.has(u.userId))
        .sort((a, b) => personLabel(a).localeCompare(personLabel(b), "pt-BR")),
    [eligibleUsers, excludeUserIds],
  );

  const isReplacement = kind === "titular" && replacing !== null;
  const triggerLabel =
    kind === "deputy"
      ? "Adicionar substituto(a)"
      : isReplacement
        ? "Substituir"
        : "Designar diretor(a) técnico(a)";

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      setSelectedPerson("");
    }
  }

  function handleAppoint(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPerson) return;
    setError(null);
    startTransition(async () => {
      const result =
        kind === "titular"
          ? await appointTechnicalDirector(hospitalId, selectedPerson)
          : await appointTechnicalDirectorDeputy(hospitalId, selectedPerson);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível concluir a designação.");
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant={isReplacement ? "outline" : "default"}>
          {isReplacement ? (
            <Repeat aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={handleAppoint}
          className="flex flex-col gap-4"
          noValidate
        >
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <UserCog aria-hidden="true" className="size-4 text-primary" />
              {kind === "deputy"
                ? "Designar substituto(a) da direção técnica"
                : isReplacement
                  ? "Substituir a direção técnica"
                  : "Designar direção técnica"}
            </DialogTitle>
            <DialogDescription>
              {kind === "deputy" ? (
                <>
                  O(a) substituto(a) responde por {hospitalName} com a mesma
                  autoridade do(a) titular, inclusive nos encaminhamentos
                  dirigidos à direção técnica.
                </>
              ) : isReplacement ? (
                <>
                  {personLabel(replacing)} deixará a direção técnica de{" "}
                  {hospitalName} no mesmo instante em que a nova designação
                  entrar em vigor — o hospital nunca fica com dois titulares nem
                  sem nenhum.
                </>
              ) : (
                <>
                  O(a) diretor(a) técnico(a) é o(a) responsável técnico(a) por
                  todas as comissões de {hospitalName}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {error && <FormBanner tone="error">{error}</FormBanner>}

          <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-accent/30 p-3.5 text-sm text-foreground">
            <Stethoscope
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            <p className="text-pretty">
              A designação exige registro profissional de médico(a).
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={personFieldId} className="text-sm font-medium">
              Pessoa
            </label>
            <NativeSelect
              id={personFieldId}
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              disabled={isPending || candidates.length === 0}
            >
              <option value="">
                {candidates.length === 0
                  ? "Nenhuma pessoa disponível"
                  : "Selecione uma pessoa"}
              </option>
              {candidates.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {personLabel(u)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !selectedPerson}>
              {isPending ? "Designando…" : "Designar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevokeButton({
  hospitalId,
  hospitalName,
  userId,
  label,
  kind,
}: {
  hospitalId: string;
  hospitalName: string;
  userId: string;
  label: string;
  kind: "titular" | "deputy";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const result =
        kind === "titular"
          ? await revokeTechnicalDirector(hospitalId, userId)
          : await revokeTechnicalDirectorDeputy(hospitalId, userId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover a designação.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remover ${label} da direção técnica de ${hospitalName}`}
        >
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover a designação?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} deixará{" "}
            {kind === "titular"
              ? "a direção técnica"
              : "a suplência da direção técnica"}{" "}
            de {hospitalName}.
            {kind === "titular"
              ? " O hospital ficará sem titular até uma nova designação."
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleRevoke}
          >
            {isPending ? "Removendo…" : "Remover"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
