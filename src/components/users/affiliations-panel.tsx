"use client";

import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";

import type { UserAffiliation } from "@/lib/users/types";
import {
  affiliatePerson,
  endAffiliation,
  updateAffiliation,
  voidAffiliation,
  type AffiliationActionState,
} from "@/lib/affiliations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { LiveBanner } from "@/components/auth/form-banner";
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
} from "@/components/users/profile-cards";
import {
  AffiliationStatusBadge,
  affiliationStatusOf,
} from "@/components/users/affiliation-status-badge";
import { ProfileDialogShell } from "@/components/users/profile-dialog-shell";
import {
  blockerKey,
  blockerLabel,
} from "@/components/users/affiliation-blocker-label";

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
 *
 * ⚠ AFF4 (ADR 0151 D6–D9). Three additions:
 * - `jobTitle` / `workEmail` / `workPhone` — per-EMPLOYMENT staff data, editable in the
 *   same dialog as matrícula/start date. Same authority as the rest of this panel
 *   (`canManage` — org_admin OR that hospital's admin), because they are hospital-owned
 *   employment facts, not person-level identity.
 * - **Anular** (void) — a THIRD tense, not a second spelling of Encerrar. `endAffiliation`
 *   says "this was true and stopped"; `voidAffiliation` says "this was never true" and
 *   revokes the read-visibility it granted (D7). Available on active AND ended rows
 *   (an already-ended row can still have been a mistake); refused on an already-voided
 *   one. The reason is MANDATORY, both client-side (disables submit) and server-side
 *   (HC0R7).
 * - `AffiliationStatusBadge` replaces the inline Ativo/Encerrado pill — voided now takes
 *   precedence over ended (a row can be both).
 */

/**
 * ⛔ MOVED, NOT DELETED — re-exported here so the import path every consumer already uses
 * (`@/components/users/affiliations-panel`) keeps resolving, `affiliations-panel.test.ts`
 * included. The definition now lives beside the blocker LABELLING it exists to serve, in
 * `./affiliation-blocker-label`, because the two render sites needed to share that logic
 * and a pure module importing this client component would have closed an import cycle.
 */
export { ROLE_LABELS } from "@/components/users/affiliation-blocker-label";

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
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const voidReasonField = useFieldIds("voidReason", { required: true });

  const ended = affiliation.endedOn != null;
  const voided = affiliation.voidedAt != null;
  const status = affiliationStatusOf(affiliation);
  const hospitalLabel = affiliation.hospitalName ?? "Hospital não visível";
  // ⛔ NARROWED ON THE FIELD ITSELF, never through `ended` plus a `!` assertion. The
  // assertion that used to sit here silenced the compiler about precisely the one case
  // that occurred — the ADR 0078 "keystone that could not fail", in miniature.
  const period =
    affiliation.endedOn != null
      ? `${formatMonthYear(affiliation.startedOn)} – ${formatMonthYear(affiliation.endedOn)}`
      : `desde ${formatDate(affiliation.startedOn)}`;
  const metaParts = [
    affiliation.jobTitle,
    affiliation.hospitalEmployeeId
      ? `Matrícula ${affiliation.hospitalEmployeeId}`
      : null,
  ].filter((p): p is string => Boolean(p));
  const meta =
    metaParts.length > 0
      ? `${metaParts.join(" · ")} · ${period}`
      : period.charAt(0).toUpperCase() + period.slice(1);
  // Work contact is optional and shown only when at least one part is present, so a
  // row with neither never reserves an empty second line.
  const contactParts = [affiliation.workEmail, affiliation.workPhone].filter(
    (p): p is string => Boolean(p),
  );

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

  function voidRow() {
    if (!voidReason.trim()) return;
    setState(null);
    startTransition(async () => {
      const result = await voidAffiliation({
        affiliationId: affiliation.id,
        reason: voidReason.trim(),
      });
      // Same reasoning as `end()`: close either way, render the refusal in the page.
      setVoidOpen(false);
      setState(result);
      if (result.ok) setVoidReason("");
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3 ${
          status !== "ativo" ? "opacity-60" : ""
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-[0.84rem] font-semibold">
            {hospitalLabel}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
          {contactParts.length > 0 ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {contactParts.join(" · ")}
            </p>
          ) : null}
          {voided && affiliation.voidReason ? (
            <p className="mt-0.5 text-xs text-destructive/90">
              Motivo da anulação: {affiliation.voidReason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <AffiliationStatusBadge status={status} />
          {canManage && !voided ? (
            <>
              {!ended ? (
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
              <CardTextButton
                tone="destructive"
                onClick={() => setVoidOpen(true)}
                disabled={isPending}
                aria-label={`Anular vínculo com ${hospitalLabel}`}
              >
                Anular
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
                {/* Shared by end (HC0R1) and void (HC0R9) — both refusals list active
                    seats, so the copy has to be true for either action. */}
                Remova estas funções antes de continuar:
              </p>
              {/* Labelling lives in `./affiliation-blocker-label`, shared with
                  `OrgOffboardingWizard` — the two lists render the same door payloads and
                  drifted apart into the same defect when each carried its own copy. */}
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {state.blockers.map((b, i) => (
                  <li key={blockerKey(b, i)}>{blockerLabel(b)}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <LiveBanner tone="success">{state?.ok ? state.error : null}</LiveBanner>

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

      {/* Anular — the THIRD tense (D7). A reason is MANDATORY: the submit button stays
          disabled until one is typed, and the door refuses without one anyway (HC0R7). */}
      <AlertDialog
        open={voidOpen}
        onOpenChange={(o) => {
          setVoidOpen(o);
          if (!o) setVoidReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Anular o vínculo de {personName} com {hospitalLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Use esta opção apenas para um vínculo registrado por engano — nunca para
              encerrar um emprego que de fato existiu. A anulação revoga o acesso que o
              vínculo concedeu à administração deste hospital e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={voidReasonField.controlProps.id}>
              Motivo da anulação
            </FieldLabel>
            <Textarea
              {...voidReasonField.controlProps}
              rows={3}
              placeholder="Ex.: vínculo cadastrado para o hospital errado."
              value={voidReason}
              disabled={isPending}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !voidReason.trim()}
              onClick={voidRow}
            >
              {isPending ? "Anulando…" : "Anular vínculo"}
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
  // AFF4 (ADR 0151 D9) — per-employment staff data. LIVE as of B4 (`2e040341`):
  // `affiliatePerson`/`updateAffiliation` persist these on both write paths (the
  // INSERT and the idempotent affiliate-again refresh). Clearing an existing value
  // is the explicit `clear*` flag below, never a bare `null` — "leave it alone" and
  // "clear it" cannot both be true of one argument, mirroring `clearEmployeeId`. A
  // whitespace-only value normalises to NULL server-side, so client trimming here
  // is good form, not load-bearing.
  const [jobTitle, setJobTitle] = useState(editing?.jobTitle ?? "");
  const [workEmail, setWorkEmail] = useState(editing?.workEmail ?? "");
  const [workPhone, setWorkPhone] = useState(editing?.workPhone ?? "");

  const hospitalField = useFieldIds("affiliationHospital", {
    required: true,
    hasDescription: activeHospitalNames.length > 0,
  });
  const employeeIdField = useFieldIds("affiliationEmployeeId");
  const startedOnField = useFieldIds("affiliationStartedOn");
  const jobTitleField = useFieldIds("affiliationJobTitle");
  const workEmailField = useFieldIds("affiliationWorkEmail");
  const workPhoneField = useFieldIds("affiliationWorkPhone");

  function submit() {
    setError(null);
    startTransition(async () => {
      let result: AffiliationActionState;

      if (editing) {
        const trimmed = employeeId.trim();
        const employeeIdChanged =
          trimmed !== (editing.hospitalEmployeeId ?? "");
        const startedOnChanged = startedOn !== editing.startedOn.slice(0, 10);
        const trimmedJobTitle = jobTitle.trim();
        const jobTitleChanged = trimmedJobTitle !== (editing.jobTitle ?? "");
        const trimmedWorkEmail = workEmail.trim();
        const workEmailChanged = trimmedWorkEmail !== (editing.workEmail ?? "");
        const trimmedWorkPhone = workPhone.trim();
        const workPhoneChanged = trimmedWorkPhone !== (editing.workPhone ?? "");
        if (
          !employeeIdChanged &&
          !startedOnChanged &&
          !jobTitleChanged &&
          !workEmailChanged &&
          !workPhoneChanged
        ) {
          onClose();
          return;
        }
        result = await updateAffiliation({
          userId,
          hospitalId: editing.hospitalId,
          // "Leave it alone" and "clear it" cannot both be `null`, so emptying any of
          // these fields is an explicit `clear*` flag — same rule for all four.
          employeeId: employeeIdChanged && trimmed ? trimmed : undefined,
          clearEmployeeId: employeeIdChanged && !trimmed,
          startedOn: startedOnChanged && startedOn ? startedOn : undefined,
          jobTitle: jobTitleChanged && trimmedJobTitle ? trimmedJobTitle : undefined,
          clearJobTitle: jobTitleChanged && !trimmedJobTitle,
          workEmail: workEmailChanged && trimmedWorkEmail ? trimmedWorkEmail : undefined,
          clearWorkEmail: workEmailChanged && !trimmedWorkEmail,
          workPhone: workPhoneChanged && trimmedWorkPhone ? trimmedWorkPhone : undefined,
          clearWorkPhone: workPhoneChanged && !trimmedWorkPhone,
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
          jobTitle: jobTitle.trim() || undefined,
          workEmail: workEmail.trim() || undefined,
          workPhone: workPhone.trim() || undefined,
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
      <LiveBanner tone="error">{error}</LiveBanner>

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
          <FieldLabel
            id={`${startedOnField.controlProps.id}-label`}
            htmlFor={startedOnField.controlProps.id}
          >
            Data de início
          </FieldLabel>
          <DatePicker
            id={startedOnField.controlProps.id}
            labelId={`${startedOnField.controlProps.id}-label`}
            value={startedOn}
            onChange={setStartedOn}
            disabled={isPending}
          />
        </Field>
      </div>

      {/* AFF4 (ADR 0151 D9) — per-employment staff data. Hospital-owned, same authority
          as the rest of this dialog; separate from the person-level identity fields in
          `PersonalDataCard`. */}
      <Field>
        <FieldLabel htmlFor={jobTitleField.controlProps.id}>
          Cargo <span className="font-normal text-muted-foreground">(opcional)</span>
        </FieldLabel>
        <Input
          {...jobTitleField.controlProps}
          type="text"
          className="h-10"
          placeholder="Ex.: Enfermeiro(a) coordenador(a)"
          value={jobTitle}
          disabled={isPending}
          onChange={(e) => setJobTitle(e.target.value)}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={workEmailField.controlProps.id}>
            E-mail de trabalho{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            {...workEmailField.controlProps}
            type="email"
            className="h-10"
            placeholder="pessoa@hospital.com.br"
            value={workEmail}
            disabled={isPending}
            onChange={(e) => setWorkEmail(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={workPhoneField.controlProps.id}>
            Telefone de trabalho{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            {...workPhoneField.controlProps}
            type="tel"
            className="h-10"
            placeholder="(11) 1234-5678"
            value={workPhone}
            disabled={isPending}
            onChange={(e) => setWorkPhone(e.target.value)}
          />
        </Field>
      </div>
    </ProfileDialogShell>
  );
}
