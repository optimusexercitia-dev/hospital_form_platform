"use client";

import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";

import type { UserAffiliation } from "@/lib/users/types";
import {
  affiliatePerson,
  endAffiliation,
  updateAffiliation,
  type AffiliationActionState,
} from "@/lib/affiliations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CardAddButton,
  CardTextButton,
  ProfileCard,
  StatusPill,
} from "@/components/users/profile-cards";
import { ProfileDialogShell } from "@/components/users/profile-dialog-shell";

/**
 * Hospital affiliations on the per-user profile page (AFF W3/T3.3 — ADR 0097
 * D1/D3/D4/D5/D14; redesign 2a + dialog 3c).
 *
 * An affiliation is the employment fact "this person works at this hospital". It is a
 * VISIBILITY input, never a capability input (D2): creating one grants the person
 * nothing, it only lets that hospital's administrators see them.
 *
 * ⚠ FIELD OWNERSHIP (D14). What this panel edits — matrícula, the hospital link, its
 * end — belongs to the HOSPITAL, so a hospital's admin owns their own rows. Person-level
 * facts (name, CPF, professional category, credentials) are org-scoped and live in
 * `PersonalDataCard` / `CredentialsCard`, not here.
 *
 * ⚠ `canManage` HIDES CONTROLS; IT DOES NOT AUTHORIZE ANYTHING (Architecture Rule 1).
 * Every refusal is re-derived in PostgreSQL inside `app.affiliate_person_impl` /
 * `app.update_affiliation_impl` / `app.end_affiliation_impl` for the actor resolved from
 * `auth.uid()`. This flag exists so the UI does not offer a button that will be refused;
 * the server refusal is the boundary, and when it fires it is rendered here in pt-BR.
 *
 * ⛔ EDITING AN EXISTING ROW GOES THROUGH `updateAffiliation`, NEVER `affiliatePerson`.
 * The latter is the idempotent CREATE door: on an existing active affiliation its kernel
 * refreshes the matrícula and IGNORES `p_started_on` entirely, so a start-date control
 * wired to it would silently no-op on every existing affiliation — and the create door
 * emits `affiliation.created` only, so the mutation would carry no audit row either
 * (Rule 11). `update_affiliation` is the edit path and emits `affiliation.updated`.
 * `affiliatePerson` is used below for exactly one thing: creating a row that is not
 * there yet. The redesign puts both behind ONE dialog (3c) with an `intent`, which is
 * precisely where a careless "it's the same form, use the same action" would recur — the
 * intent picks the door, and the two are not interchangeable.
 *
 * ⚠ ENDED ROWS ARE RENDERED, NOT FILTERED. `getOrgUser` returns active rows first, then
 * ended ones; a past employment is the history that ending a vínculo exists to preserve
 * (D5), so hiding it would make the destructive action look like a delete.
 */

/**
 * pt-BR labels for the seats `end_affiliation` reports as blockers (D5 — ending is
 * refused while the person holds active memberships of ANY tier under the hospital).
 *
 * ⚠ THE AUTHORITY FOR THIS SET IS `memberships_role_check`, not this file. The blocker
 * `role` arrives from PostgreSQL as the raw enum text, so a role added to that CHECK
 * without a label here leaks an English snake_case identifier into a pt-BR `role="alert"`
 * — the exact shape of the defect QA caught on the hospital-tier arm. Verified complete
 * against the live catalog (9 roles, 2026-08-06) and pinned executably by
 * `affiliations-panel.test.ts`, because a comment asserting completeness goes stale in
 * silence.
 *
 * The `?? role` fallback below is therefore unreachable today and is kept only as a
 * fail-soft: a blocker the admin cannot name is worse than one that is untranslated.
 */
export const ROLE_LABELS: Record<string, string> = {
  staff: "Membro",
  staff_admin: "Coordenação",
  hospital_admin: "Administração do hospital",
  org_admin: "Administração da organização",
  technical_director: "Direção técnica",
  technical_director_deputy: "Direção técnica (substituto)",
  nsp_coordinator: "Coordenação do NSP",
  nsp_org_admin: "Administração do NSP",
  pqs_member: "Membro do PQS",
  quality_reviewer: "Revisão da qualidade",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * `started_on` / `ended_on` are DATE columns. Parsing them as instants shifts them a day
 * west of UTC, so they are read as LOCAL calendar parts throughout this file.
 */
function formatDate(iso: string): string {
  // Total by construction: a caller that hands over a missing date gets empty text,
  // not a TypeError that unmounts the entire page around one malformed row.
  if (typeof iso !== "string" || iso === "") return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(y, m - 1, d));
}

/** `fev 2021` — the abbreviated form the ended-row date range uses. */
function formatMonthYear(iso: string): string {
  // Total by construction: a caller that hands over a missing date gets empty text,
  // not a TypeError that unmounts the entire page around one malformed row.
  if (typeof iso !== "string" || iso === "") return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  })
    .format(new Date(y, m - 1, d))
    .replace(/\.$/, "");
}

/** Today as local ISO `yyyy-mm-dd`. `toISOString()` would return tomorrow west of UTC. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** What dialog 3c is doing right now. The intent picks the DOOR — see the note above. */
type AffiliationDialogState =
  | { intent: "add" }
  | { intent: "edit"; affiliation: UserAffiliation }
  | null;

export function AffiliationsPanel({
  userId,
  personName,
  affiliations,
  manageableHospitalIds,
  addableHospitals,
}: {
  userId: string;
  /** For the confirm dialogs and the 3c subtitle — never "este usuário". */
  personName: string;
  /** Active rows first, then ended ones. Both are rendered. */
  affiliations: UserAffiliation[];
  /** Hospitals this caller administers; rows outside it render without actions. */
  manageableHospitalIds: string[];
  /** Hospitals this caller may CREATE an affiliation at (minus the active ones). */
  addableHospitals: { id: string; name: string }[];
}) {
  const manageable = new Set(manageableHospitalIds);
  // `== null` NOT `=== null`. `endedOn` is typed `string | null`, but an affiliation
  // object built anywhere that omits the key arrives `undefined` — and `undefined !== null`
  // classifies an ACTIVE affiliation as ENDED, then crashes formatting its absent end date.
  // That is not hypothetical: it took the whole page down once. Absent means active here.
  const active = affiliations.filter((a) => a.endedOn == null);
  const available = addableHospitals.filter(
    (h) => !active.some((a) => a.hospitalId === h.id),
  );
  const [dialog, setDialog] = useState<AffiliationDialogState>(null);

  return (
    <ProfileCard
      titleId="vinculos-heading"
      title="Vínculos hospitalares"
      caption="Onde esta pessoa trabalha. Encerrar um vínculo preserva o histórico e não afeta a conta nem os outros hospitais."
      riseDelay="40ms"
      action={
        available.length > 0 ? (
          <CardAddButton onClick={() => setDialog({ intent: "add" })}>
            <span aria-hidden="true">＋</span>
            Adicionar vínculo
          </CardAddButton>
        ) : null
      }
    >
      {affiliations.length === 0 ? (
        /* ⛔ A LEGIBLE EXPECTED STATE, not a failure. A registered person employed
           nowhere yet is exactly the case ADR 0097 D2 exists to keep visible; an empty
           card would read as "this data failed to load". */
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-8 text-center">
          <Building2 aria-hidden="true" className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Sem vínculo hospitalar</p>
          <p className="max-w-prose text-xs text-muted-foreground text-pretty">
            Esta pessoa está cadastrada na organização, mas não consta como
            trabalhando em nenhum hospital. Registre um vínculo para que a
            administração do hospital passe a vê-la.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {affiliations.map((affiliation, index) => (
            <li
              key={affiliation.id}
              className="animate-rise-in"
              style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
            >
              <AffiliationRow
                userId={userId}
                personName={personName}
                affiliation={affiliation}
                canManage={manageable.has(affiliation.hospitalId)}
                onEdit={() => setDialog({ intent: "edit", affiliation })}
              />
            </li>
          ))}
        </ul>
      )}

      {dialog ? (
        <AffiliationDialog
          key={dialog.intent === "edit" ? dialog.affiliation.id : "add"}
          userId={userId}
          personName={personName}
          state={dialog}
          availableHospitals={available}
          activeHospitalNames={active
            .map((a) => a.hospitalName)
            .filter((n): n is string => Boolean(n))}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </ProfileCard>
  );
}

/** One employment row: hospital, matrícula + dates, its status pill, and its actions. */
function AffiliationRow({
  userId,
  personName,
  affiliation,
  canManage,
  onEdit,
}: {
  userId: string;
  personName: string;
  affiliation: UserAffiliation;
  canManage: boolean;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AffiliationActionState | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const ended = affiliation.endedOn != null;
  const hospitalLabel = affiliation.hospitalName ?? "Hospital não visível";
  // ⛔ NARROWED ON THE FIELD ITSELF, never through `ended` plus a `!` assertion. The
  // assertion that used to sit here silenced the compiler about precisely the one case
  // that occurred — the ADR 0078 "keystone that could not fail", in miniature.
  const period =
    affiliation.endedOn != null
      ? `${formatMonthYear(affiliation.startedOn)} – ${formatMonthYear(affiliation.endedOn)}`
      : `desde ${formatDate(affiliation.startedOn)}`;
  const meta = affiliation.hospitalEmployeeId
    ? `Matrícula ${affiliation.hospitalEmployeeId} · ${period}`
    : period.charAt(0).toUpperCase() + period.slice(1);

  function end() {
    setState(null);
    startTransition(async () => {
      const result = await endAffiliation({
        userId,
        hospitalId: affiliation.hospitalId,
      });
      // Close the confirm dialog EITHER WAY, and this is not cosmetic. The refusal —
      // including the blockers list the admin must act on — renders in the PAGE, and
      // Radix marks everything outside an open modal `aria-hidden`. Closing only on
      // success left the explanation greyed out behind the overlay and INERT to
      // assistive tech, so the admin saw a dialog that appeared to do nothing. The
      // seats also cannot be removed from inside the dialog, so staying there is
      // wrong even when the message is read.
      setConfirmEnd(false);
      setState(result);
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3 ${
          ended ? "opacity-60" : ""
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-[0.84rem] font-semibold">
            {hospitalLabel}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <StatusPill tone={ended ? "muted" : "success"} uppercase>
            {ended ? "Encerrado" : "Ativo"}
          </StatusPill>
          {canManage && !ended ? (
            <>
              <CardTextButton
                onClick={onEdit}
                disabled={isPending}
                aria-label={`Editar vínculo com ${hospitalLabel}`}
              >
                Editar
              </CardTextButton>
              <CardTextButton
                tone="destructive"
                onClick={() => setConfirmEnd(true)}
                disabled={isPending}
                aria-label={`Encerrar vínculo com ${hospitalLabel}`}
              >
                Encerrar
              </CardTextButton>
            </>
          ) : null}
        </div>
      </div>

      {state && !state.ok ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-xs text-destructive"
        >
          <p className="font-medium">{state.error}</p>
          {state.blockers && state.blockers.length > 0 ? (
            <>
              <p className="text-destructive/90">
                Remova estas funções antes de encerrar o vínculo:
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {state.blockers.map((b, i) => (
                  <li key={`${b.role}-${b.commission ?? "hospital"}-${i}`}>
                    {roleLabel(b.role)}
                    {/* A commission seat names its committee, so the admin knows where
                        to go to remove it. A HOSPITAL-TIER seat (technical_director,
                        nsp_coordinator, hospital_admin…) has no committee to name — it
                        is held at the hospital itself, and saying so is what tells the
                        admin to look outside the committee pages. */}
                    {b.commission ? ` — ${b.commission}` : " — cargo do hospital"}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {state?.ok ? <FormBanner tone="success">{state.error}</FormBanner> : null}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Encerrar o vínculo de {personName} com {hospitalLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O histórico é preservado: o vínculo é marcado como encerrado, nunca
              apagado. A conta da pessoa continua ativa e os vínculos com outros
              hospitais não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
              onClick={end}
            >
              {isPending ? "Encerrando…" : "Encerrar vínculo"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Dialog 3c — one panel, two doors.
 *
 * ⛔ `intent` PICKS THE ACTION, and the two are NOT interchangeable: `add` creates a row
 * with `affiliatePerson`, `edit` amends one with `updateAffiliation`. Wiring both to the
 * create door would silently drop every start-date change and emit the wrong audit verb.
 * See the file header.
 *
 * In `edit` the hospital is FIXED — an affiliation's hospital is its identity, and
 * "changing" it means ending one employment and starting another, which is two audited
 * facts and not one edit. It is rendered as read-only text rather than a disabled
 * select, so it reads as information instead of a control someone is being denied.
 */
function AffiliationDialog({
  userId,
  personName,
  state,
  availableHospitals,
  activeHospitalNames,
  onClose,
}: {
  userId: string;
  personName: string;
  state: NonNullable<AffiliationDialogState>;
  availableHospitals: { id: string; name: string }[];
  /** Hospitals already linked — named in the helper text so the omission is explained. */
  activeHospitalNames: string[];
  onClose: () => void;
}) {
  const editing = state.intent === "edit" ? state.affiliation : null;

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState(
    editing?.hospitalId ?? availableHospitals[0]?.id ?? "",
  );
  const [employeeId, setEmployeeId] = useState(
    editing?.hospitalEmployeeId ?? "",
  );
  const [startedOn, setStartedOn] = useState(
    editing ? editing.startedOn.slice(0, 10) : todayIso(),
  );

  const hospitalField = useFieldIds("affiliationHospital", {
    required: true,
    hasDescription: activeHospitalNames.length > 0,
  });
  const employeeIdField = useFieldIds("affiliationEmployeeId");
  const startedOnField = useFieldIds("affiliationStartedOn");

  function submit() {
    setError(null);
    startTransition(async () => {
      let result: AffiliationActionState;

      if (editing) {
        const trimmed = employeeId.trim();
        const employeeIdChanged =
          trimmed !== (editing.hospitalEmployeeId ?? "");
        const startedOnChanged = startedOn !== editing.startedOn.slice(0, 10);
        if (!employeeIdChanged && !startedOnChanged) {
          onClose();
          return;
        }
        result = await updateAffiliation({
          userId,
          hospitalId: editing.hospitalId,
          // "Leave it alone" and "clear it" cannot both be `null`, so emptying the
          // field is an explicit `clearEmployeeId`.
          employeeId: employeeIdChanged && trimmed ? trimmed : undefined,
          clearEmployeeId: employeeIdChanged && !trimmed,
          startedOn: startedOnChanged && startedOn ? startedOn : undefined,
        });
      } else {
        if (!hospitalId) {
          setError("Selecione um hospital.");
          return;
        }
        result = await affiliatePerson({
          userId,
          hospitalId,
          employeeId: employeeId.trim() || null,
          startedOn: startedOn || null,
        });
      }

      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar o vínculo.");
        return;
      }
      // The server action revalidates the affiliation surfaces, so the page re-renders
      // with the new row; closing is all this dialog owes.
      onClose();
    });
  }

  return (
    <ProfileDialogShell
      open
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
      title={editing ? "Editar vínculo hospitalar" : "Adicionar vínculo hospitalar"}
      subtitle={
        editing
          ? `${personName} · ${editing.hospitalName ?? "hospital não visível"}.`
          : `${personName} passa a aparecer para os administradores do hospital escolhido.`
      }
      onSubmit={submit}
      submitLabel={editing ? "Salvar vínculo" : "Adicionar vínculo"}
      pendingLabel="Salvando…"
      isPending={isPending}
      submitDisabled={!editing && !hospitalId}
    >
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {editing ? (
        <Field>
          <FieldLabel>Hospital</FieldLabel>
          <p className="text-[0.8rem] font-medium">
            {editing.hospitalName ?? "Hospital não visível"}
          </p>
          <FieldDescription className="text-[0.7rem]">
            O hospital de um vínculo não muda. Para transferir a pessoa, encerre
            este vínculo e registre outro.
          </FieldDescription>
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor={hospitalField.controlProps.id}>
            Hospital
          </FieldLabel>
          <NativeSelect
            {...hospitalField.controlProps}
            className="h-10"
            value={hospitalId}
            disabled={isPending}
            onChange={(e) => setHospitalId(e.target.value)}
          >
            <option value="" disabled>
              Selecione um hospital
            </option>
            {availableHospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </NativeSelect>
          {activeHospitalNames.length > 0 ? (
            <FieldDescription
              id={hospitalField.descriptionId}
              className="text-[0.7rem]"
            >
              Hospitais com vínculo ativo não aparecem na lista:{" "}
              {activeHospitalNames.join(", ")}.
            </FieldDescription>
          ) : null}
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={employeeIdField.controlProps.id}>
            Matrícula <span className="font-normal text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            {...employeeIdField.controlProps}
            type="text"
            className="h-10 font-mono text-[0.78rem]"
            placeholder="Ex.: 51.204"
            value={employeeId}
            disabled={isPending}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={startedOnField.controlProps.id}>
            Data de início
          </FieldLabel>
          <DatePicker
            id={startedOnField.controlProps.id}
            value={startedOn}
            onChange={setStartedOn}
            disabled={isPending}
          />
        </Field>
      </div>
    </ProfileDialogShell>
  );
}
