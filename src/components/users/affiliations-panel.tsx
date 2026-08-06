"use client";

import { useState, useTransition } from "react";
import { Building2, CalendarDays, IdCard, Link2, LogOut } from "lucide-react";

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

/**
 * Hospital affiliations on the per-user management page (AFF W3/T3.3 — ADR 0097
 * D1/D3/D4/D5/D14).
 *
 * An affiliation is the employment fact "this person works at this hospital". It is a
 * VISIBILITY input, never a capability input (D2): creating one grants the person
 * nothing, it only lets that hospital's administrators see them.
 *
 * ⚠ FIELD OWNERSHIP (D14). What this panel edits — matrícula, the hospital link, its
 * end — belongs to the HOSPITAL, so a hospital's admin owns their own rows. Person-level
 * facts (name, CPF, professional category, credentials) are `org_admin`-only and live in
 * `UserProfileEditForm`, not here.
 *
 * ⚠ `canManage` HIDES CONTROLS; IT DOES NOT AUTHORIZE ANYTHING (Architecture Rule 1).
 * Every refusal is re-derived in PostgreSQL inside `app.affiliate_person_impl` /
 * `app.end_affiliation_impl` for the actor resolved from `auth.uid()`. This flag exists
 * so the UI does not offer a button that will be refused; the server refusal is the
 * boundary, and when it fires it is rendered here in pt-BR.
 *
 * ⚠ EDITING AN EXISTING ROW GOES THROUGH `updateAffiliation`, NOT `affiliatePerson`.
 * The latter is the idempotent CREATE door: on an existing active affiliation its kernel
 * refreshes the matrícula and IGNORES `p_started_on` entirely, so a start-date control
 * wired to it would silently no-op on every existing affiliation — and the create door
 * emits `affiliation.created` only, so the mutation would carry no audit row either
 * (Rule 11). `update_affiliation` is the edit path and emits `affiliation.updated`.
 * `affiliatePerson` is used below for exactly one thing: creating a row that is not
 * there yet.
 */

/**
 * pt-BR labels for the seats `end_affiliation` reports as blockers (D5 — ending is
 * refused while the person holds active memberships of ANY tier under the hospital).
 * Unknown values fall through to the raw role rather than rendering blank: a blocker the
 * admin cannot name is worse than an untranslated one.
 */
const ROLE_LABELS: Record<string, string> = {
  staff: "Membro",
  staff_admin: "Coordenação",
  hospital_admin: "Administração do hospital",
  org_admin: "Administração da organização",
  technical_director: "Direção técnica",
  technical_director_deputy: "Direção técnica (substituto)",
  nsp_coordinator: "Coordenação do NSP",
  nsp_org_admin: "Administração do NSP",
  pqs_member: "Membro do PQS",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** `started_on` is a DATE; parsing it as an instant would shift it a day west of UTC. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(y, m - 1, d),
  );
}

export function AffiliationsPanel({
  userId,
  personName,
  affiliations,
  manageableHospitalIds,
  addableHospitals,
}: {
  userId: string;
  /** For the confirm dialogs — never "este usuário". */
  personName: string;
  affiliations: UserAffiliation[];
  /** Hospitals this caller administers; rows outside it render read-only. */
  manageableHospitalIds: string[];
  /** Hospitals this caller may CREATE an affiliation at (minus the active ones). */
  addableHospitals: { id: string; name: string }[];
}) {
  const manageable = new Set(manageableHospitalIds);
  const available = addableHospitals.filter(
    (h) => !affiliations.some((a) => a.hospitalId === h.id),
  );

  return (
    <div className="flex flex-col gap-5">
      {affiliations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
          <Building2 aria-hidden="true" className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium">Sem vínculo hospitalar ativo</p>
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            Esta pessoa está cadastrada na organização, mas não consta como
            trabalhando em nenhum hospital. Registre um vínculo para que a
            administração do hospital passe a vê-la.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {affiliations.map((affiliation, index) => (
            <li
              key={affiliation.id}
              className="animate-rise-in"
              style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
            >
              <AffiliationRow
                userId={userId}
                personName={personName}
                affiliation={affiliation}
                canManage={manageable.has(affiliation.hospitalId)}
              />
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <AddAffiliationForm userId={userId} hospitals={available} />
      ) : null}
    </div>
  );
}

/** One employment row: hospital, matrícula, start date, and the end action. */
function AffiliationRow({
  userId,
  personName,
  affiliation,
  canManage,
}: {
  userId: string;
  personName: string;
  affiliation: UserAffiliation;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AffiliationActionState | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [employeeId, setEmployeeId] = useState(
    affiliation.hospitalEmployeeId ?? "",
  );
  const [startedOn, setStartedOn] = useState(affiliation.startedOn.slice(0, 10));

  const employeeIdField = useFieldIds("hospitalEmployeeId", {
    hasDescription: true,
  });
  const startedOnField = useFieldIds("startedOn", { hasDescription: true });

  const employeeIdChanged =
    employeeId.trim() !== (affiliation.hospitalEmployeeId ?? "");
  const startedOnChanged = startedOn !== affiliation.startedOn.slice(0, 10);
  // The date picker is non-clearable here (an employment always has a start), so
  // `startedOnChanged` can only ever mean "moved to another date".
  const dirty = employeeIdChanged || startedOnChanged;

  function save() {
    setState(null);
    startTransition(async () => {
      const trimmed = employeeId.trim();
      setState(
        await updateAffiliation({
          userId,
          hospitalId: affiliation.hospitalId,
          // Only send what actually changed. "Leave it alone" and "clear it" cannot
          // both be `null`, so emptying the field is an explicit `clearEmployeeId`.
          employeeId: employeeIdChanged && trimmed ? trimmed : undefined,
          clearEmployeeId: employeeIdChanged && !trimmed,
          startedOn: startedOnChanged && startedOn ? startedOn : undefined,
        }),
      );
    });
  }

  function end() {
    setState(null);
    startTransition(async () => {
      const result = await endAffiliation({
        userId,
        hospitalId: affiliation.hospitalId,
      });
      setState(result);
      if (result.ok) setConfirmEnd(false);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Building2
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">
              {affiliation.hospitalName ?? "Hospital não visível"}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              Desde {formatDate(affiliation.startedOn)}
            </p>
          </div>
        </div>

        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmEnd(true)}
            disabled={isPending}
          >
            <LogOut aria-hidden="true" />
            Encerrar vínculo
          </Button>
        ) : null}
      </div>

      {state && !state.ok ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm text-destructive"
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
                    {b.commission ? ` — ${b.commission}` : " — no hospital"}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {state?.ok ? <FormBanner tone="success">{state.error}</FormBanner> : null}

      {canManage ? (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={employeeIdField.controlProps.id}>
                Matrícula
              </FieldLabel>
              <Input
                {...employeeIdField.controlProps}
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
              <FieldDescription id={employeeIdField.descriptionId}>
                Identificador funcional neste hospital. Pertence ao vínculo, não à
                pessoa — a mesma pessoa pode ter matrículas diferentes em cada
                hospital.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={startedOnField.controlProps.id}>
                Início do vínculo
              </FieldLabel>
              <DatePicker
                id={startedOnField.controlProps.id}
                value={startedOn}
                onChange={setStartedOn}
                aria-describedby={startedOnField.descriptionId}
              />
              <FieldDescription id={startedOnField.descriptionId}>
                Corrija a data se o registro não corresponde ao início real do
                emprego.
              </FieldDescription>
            </Field>
          </div>

          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={save}
            disabled={isPending || !dirty}
          >
            {isPending ? "Salvando…" : "Salvar vínculo"}
          </Button>
        </div>
      ) : (
        <p className="flex items-start gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground text-pretty">
          <IdCard aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {affiliation.hospitalEmployeeId
            ? `Matrícula ${affiliation.hospitalEmployeeId}. Somente a administração deste hospital pode alterar o vínculo.`
            : "Somente a administração deste hospital pode alterar o vínculo."}
        </p>
      )}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Encerrar o vínculo de {personName} com{" "}
              {affiliation.hospitalName ?? "este hospital"}?
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

/** Create a new employment row. The start date IS honoured here (the insert path). */
function AddAffiliationForm({
  userId,
  hospitals,
}: {
  userId: string;
  hospitals: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AffiliationActionState | null>(null);
  const [hospitalId, setHospitalId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [startedOn, setStartedOn] = useState("");

  const hospitalField = useFieldIds("newHospitalId", { required: true });
  const employeeIdField = useFieldIds("newEmployeeId");
  const startedOnField = useFieldIds("newStartedOn", { hasDescription: true });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalId) return;
    setState(null);
    startTransition(async () => {
      const result = await affiliatePerson({
        userId,
        hospitalId,
        employeeId: employeeId.trim() || null,
        startedOn: startedOn || null,
      });
      setState(result);
      if (result.ok) {
        setHospitalId("");
        setEmployeeId("");
        setStartedOn("");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-5"
    >
      <h3 className="text-sm font-semibold">Registrar vínculo</h3>

      {state ? (
        <FormBanner tone={state.ok ? "success" : "error"}>
          {state.error}
        </FormBanner>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={hospitalField.controlProps.id}>
            Hospital
          </FieldLabel>
          <NativeSelect
            {...hospitalField.controlProps}
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
          >
            <option value="" disabled>
              Selecione um hospital
            </option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor={employeeIdField.controlProps.id}>
            Matrícula (opcional)
          </FieldLabel>
          <Input
            {...employeeIdField.controlProps}
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={startedOnField.controlProps.id}>
            Início (opcional)
          </FieldLabel>
          <DatePicker
            id={startedOnField.controlProps.id}
            value={startedOn}
            onChange={setStartedOn}
            clearable
            placeholder="Hoje"
            aria-describedby={startedOnField.descriptionId}
          />
          <FieldDescription id={startedOnField.descriptionId}>
            Em branco, o vínculo começa hoje.
          </FieldDescription>
        </Field>
      </div>

      <Button
        type="submit"
        className="self-start"
        disabled={isPending || !hospitalId}
      >
        <Link2 aria-hidden="true" />
        {isPending ? "Registrando…" : "Registrar vínculo"}
      </Button>
    </form>
  );
}
