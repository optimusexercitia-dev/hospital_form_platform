"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ShieldAlert, TriangleAlert } from "lucide-react";

import type { ProfessionalCredential } from "@/lib/users/types";
import { formatCouncilRegistration } from "@/lib/users/types";
import { removeCredential, upsertCredential } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldError,
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
  CardFootnote,
  CardTextButton,
  RailCard,
} from "@/components/users/profile-cards";
import { ProfileDialogShell } from "@/components/users/profile-dialog-shell";

/**
 * The profile rail's "Registros profissionais" card + its editor, dialog 3b
 * (redesign 2a rail / 3b).
 *
 * ⚠ NEW COMPONENT, DELIBERATELY NOT A REDESIGN OF `CredentialsEditor`. That control is
 * SHARED with `register-person-wizard` in `mode="collect"`, where there is no user yet
 * and the draft is bubbled up into the create payload. This card owns the `live` half
 * only, so the registration wizard's credential step is untouched by the redesign.
 *
 * ⚠ ONE REGISTRY, NOT N (PO decision). The backend stays 1→N — `professional_credentials`
 * is unchanged and `upsertCredential` still targets one row by id — but the UI configures
 * exactly one. Legacy multi-credential people keep seeing the extra rows, read-only, so
 * an admin can converge to one without any backend change and without a row silently
 * disappearing from a person's record.
 *
 * ⛔ EDITING CLEARS THE VERIFICATION, and the dialog says so before the fields, not after
 * the save. `upsertCredential` sets `verified_at = null` on every update — that is
 * tamper-evidence, not a bug: a number that changed has not been checked against the
 * council under its new value.
 *
 * ⛔ THE DIALOG CARRIES `issuingCountry` AND `expiresOn` THROUGH UNTOUCHED. Neither has a
 * field in 3b, and `upsertCredential` writes `expires_on: input.expiresOn ?? null` — so a
 * dialog that simply omitted them would silently CLEAR a stored expiry and rewrite the
 * country to a default on the next edit of a perfectly good credential. They are held in
 * state and written back as they were read.
 *
 * ⚠ Architecture Rule 1: `authorizePersonScopedAdmin(userId, 'credentials')` re-derives
 * the caller's authority inside the action and refuses in pt-BR. `canEdit` only decides
 * whether the affordance is offered.
 */

/**
 * The councils offered in 3b's "Conselho" select.
 *
 * ⚠ NOT AN AUTHORITY, AND THE SELECT IS NOT CLOSED OVER IT. `issuing_authority` is a
 * free-text column with no CHECK behind it, so a stored value outside this list is
 * legitimate data. {@link councilOptions} therefore appends the current value when it is
 * missing here — a closed select would render an existing credential as if it held some
 * OTHER council, and saving would rewrite it silently. Widen this list freely; never
 * make it exclusive.
 */
const COUNCILS = [
  "CRM",
  "COREN",
  "CRF",
  "CRN",
  "CRP",
  "CRO",
  "CREFITO",
  "CRFa",
  "CRBM",
  "CRESS",
  "CRMV",
];

/** The 27 Brazilian federative units. Same open-list rule as {@link COUNCILS}. */
const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

/** The option list, with the stored value appended when it falls outside the canon. */
function withCurrent(options: string[], current: string): string[] {
  const value = current.trim();
  if (!value || options.includes(value)) return options;
  return [...options, value];
}

export function CredentialsCard({
  userId,
  personName,
  credentials,
  canEdit,
}: {
  userId: string;
  personName: string;
  credentials: ProfessionalCredential[];
  /** The INTERSECTION bound (ADR 0133 Amdt 1). UX only — see the note above. */
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const primary = credentials[0] ?? null;
  const legacy = credentials.slice(1);

  return (
    <RailCard
      titleId="credenciais-heading"
      title="Registros profissionais"
      riseDelay="140ms"
      action={
        canEdit ? (
          <CardTextButton
            onClick={() => setEditing(true)}
            /* A bare "Editar" is ambiguous read out of context — three cards on this
               page offer one. The visible label stays short; the accessible name says
               which card it belongs to. */
            aria-label="Editar registros profissionais"
          >
            Editar
          </CardTextButton>
        ) : null
      }
    >
      {primary ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
          <span className="min-w-0 truncate font-mono text-xs">
            {formatCouncilRegistration(
              primary.issuingAuthority,
              primary.issuingState,
              primary.registrationNumber,
            )}
          </span>
          {primary.verifiedAt ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[0.7rem] font-semibold text-success">
              <BadgeCheck aria-hidden="true" className="size-3.5" />
              Verificado
            </span>
          ) : (
            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
              Não verificado
            </span>
          )}
        </div>
      ) : (
        /* ⛔ "None registered" is NOT "you may not see this". The read policy was widened
           precisely so an empty list means an empty list (ADR 0133 D13), and the wording
           has to keep that unambiguous. */
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground text-pretty">
          Nenhum registro profissional cadastrado.
        </p>
      )}

      {legacy.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.7rem] text-muted-foreground text-pretty">
            Registros adicionais — este cadastro passou a ter um único registro;
            os anteriores continuam visíveis até serem removidos.
          </p>
          <ul className="flex flex-col gap-1.5">
            {legacy.map((c) => (
              <li
                key={c.id}
                className="truncate rounded-lg border border-dashed border-border bg-muted/30 px-3 py-1.5 font-mono text-[0.7rem] text-muted-foreground"
              >
                {formatCouncilRegistration(
                  c.issuingAuthority,
                  c.issuingState,
                  c.registrationNumber,
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canEdit ? (
        <CardFootnote>
          Conselhos de classe (CRM, COREN, CRF…). Editar limpa a verificação
          atual.
        </CardFootnote>
      ) : (
        <p className="flex items-start gap-2 border-t border-border pt-2.5 text-[0.7rem] text-muted-foreground text-pretty">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Registros de conselho são dados da pessoa e são alterados pela
          administração da organização.
        </p>
      )}

      {editing ? (
        <CredentialsDialog
          userId={userId}
          personName={personName}
          credential={primary}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </RailCard>
  );
}

/** Dialog 3b — one registry: Conselho · UF · Número, over a warning that says why. */
function CredentialsDialog({
  userId,
  personName,
  credential,
  onClose,
}: {
  userId: string;
  personName: string;
  /** `null` registers the person's first council registration. */
  credential: ProfessionalCredential | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // ⛔ FIELD-LEVEL, NOT THE FORM BANNER. "Informe o número do registro." is a fact about
  // ONE input, and a banner cannot carry `aria-invalid` / `aria-describedby` back to it:
  // a screen-reader user landing on the field heard a valid, unremarkable text box and
  // was refused with no explanation attached to the thing that was wrong. Same wiring as
  // `PersonalDataDialog`'s `fieldErrors.fullName`. The banner keeps the SERVER's
  // messages, which are about the write, not about a field.
  const [numberError, setNumberError] = useState<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [authority, setAuthority] = useState(
    credential?.issuingAuthority ?? "CRM",
  );
  const [state, setState] = useState(credential?.issuingState ?? "SP");
  const [number, setNumber] = useState(credential?.registrationNumber ?? "");

  const authorityField = useFieldIds("credentialAuthority", { required: true });
  const stateField = useFieldIds("credentialState", { required: true });
  const numberField = useFieldIds("credentialNumber", {
    required: true,
    hasError: Boolean(numberError),
  });

  function save() {
    if (!number.trim()) {
      setNumberError("Informe o número do registro.");
      // The refusal is ABOUT this input, so put the caret in it. Focus makes the
      // now-wired `aria-invalid` + `aria-describedby` audible on arrival rather than
      // only to someone who happens to navigate back over the field.
      numberRef.current?.focus();
      return;
    }
    setNumberError(null);
    setError(null);
    startTransition(async () => {
      const result = await upsertCredential({
        userId,
        id: credential?.id,
        // ⛔ Carried through, not defaulted — 3b has no field for either, and the action
        // writes both unconditionally. See the file header.
        issuingCountry: credential?.issuingCountry ?? "BR",
        expiresOn: credential?.expiresOn ?? null,
        issuingAuthority: authority,
        issuingState: state,
        registrationNumber: number.trim(),
      });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar o registro.");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  function remove() {
    if (!credential) return;
    setNumberError(null);
    setError(null);
    startTransition(async () => {
      const result = await removeCredential(credential.id);
      // Close the confirm either way: its refusal renders behind this dialog, and
      // everything outside an open modal is `aria-hidden`.
      setConfirmRemove(false);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover o registro.");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const label = credential
    ? formatCouncilRegistration(
        credential.issuingAuthority,
        credential.issuingState,
        credential.registrationNumber,
      )
    : "";

  return (
    <ProfileDialogShell
      open
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
      title="Editar registros profissionais"
      subtitle={`${personName} · conselhos de classe (CRM, COREN, CRF…).`}
      onSubmit={save}
      submitLabel="Salvar registros"
      pendingLabel="Salvando…"
      isPending={isPending}
    >
      <LiveBanner tone="error">{error}</LiveBanner>

      <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2.5 text-[0.72rem] text-warning text-pretty">
        <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        <span>
          Alterar o número ou o conselho{" "}
          <strong className="font-semibold">limpa a verificação atual</strong> —
          o registro volta a ser verificado no conselho.
        </span>
      </p>

      <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase">
            Registro
            {credential?.verifiedAt ? (
              <span className="ml-1.5 inline-flex items-center gap-1 text-success normal-case">
                · <BadgeCheck aria-hidden="true" className="size-3" /> verificado
              </span>
            ) : null}
          </p>
          {credential ? (
            <CardTextButton
              tone="destructive"
              disabled={isPending}
              onClick={() => setConfirmRemove(true)}
              aria-label={`Remover registro ${label}`}
            >
              Remover
            </CardTextButton>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.1fr_0.7fr_1.2fr]">
          <Field>
            <FieldLabel htmlFor={authorityField.controlProps.id}>
              Conselho
            </FieldLabel>
            <NativeSelect
              {...authorityField.controlProps}
              className="h-10"
              value={authority}
              disabled={isPending}
              onChange={(e) => setAuthority(e.target.value)}
            >
              {withCurrent(COUNCILS, authority).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor={stateField.controlProps.id}>UF</FieldLabel>
            <NativeSelect
              {...stateField.controlProps}
              className="h-10"
              value={state}
              disabled={isPending}
              onChange={(e) => setState(e.target.value)}
            >
              {withCurrent(UFS, state).map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor={numberField.controlProps.id}>Número</FieldLabel>
            <Input
              {...numberField.controlProps}
              ref={numberRef}
              type="text"
              className="h-10 font-mono text-[0.78rem]"
              value={number}
              disabled={isPending}
              onChange={(e) => {
                setNumber(e.target.value);
                // Retire the refusal as soon as the admin acts on it — leaving
                // `aria-invalid` on a field that now has a value announces the input
                // as broken while they are still typing into it.
                if (numberError) setNumberError(null);
              }}
            />
            <FieldError id={numberField.errorId}>{numberError}</FieldError>
          </Field>
        </div>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o registro {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro profissional deixa de constar no cadastro de{" "}
              {personName}. Ele pode ser cadastrado novamente depois, e voltará a
              ser verificado do zero.
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
              onClick={remove}
            >
              {isPending ? "Removendo…" : "Remover"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProfileDialogShell>
  );
}
