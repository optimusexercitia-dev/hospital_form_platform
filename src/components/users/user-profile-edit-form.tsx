"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { OrgUserDetail, ProfessionalCategory } from "@/lib/users/types";
import type { UpdateUserProfileInput } from "@/lib/users/actions";
import type { PersonPersonalData } from "@/lib/users/person-footprint";
import { updateUserProfile } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { CpfField } from "@/components/users/cpf-field";
import { PhoneField } from "@/components/users/phone-field";

/**
 * PERSON-LEVEL fields on the per-user management page (AFF2 F2 — ADR 0133 D3 + Amdt 1).
 *
 * Everything here is a fact about the HUMAN — name, CPF, professional category, and the
 * D9 columns (birth date, phone) — as opposed to employment facts (which hospital,
 * matrícula, start, end), which live in `AffiliationsPanel` where a hospital's own admin
 * owns them.
 *
 * ⚠ THE FORM IS NOW FORM-ONLY. Its former read-only branch moved to
 * `PersonalDataCard`, which owns the display/edit swap and the withheld case — because
 * after Amdt 1 "can this caller see the values" and "can this caller edit them" are no
 * longer the same question, and a component that answered both by rendering a different
 * tree was the wrong shape for that.
 *
 * ⚠ TWO CAPABILITIES, NOT ONE (ADR 0133 Amdt 1 ruling 1). `canEditPerson` is the
 * INTERSECTION bound and admits this form at all; `canEditCpf` is the SUBSET bound and
 * admits only the CPF field inside it. They genuinely disagree on the same target: a
 * hospital_admin editing a person who also works elsewhere may fix a name and may NOT
 * rewrite the person key. That disagreement is the amendment's entire point, so the CPF
 * field is gated separately rather than inheriting the form's own gate.
 *
 * ⚠ BOTH FLAGS ARE UX, NOT SECURITY (Architecture Rule 1). The boundary is
 * `updateUserProfile`, which re-derives authority server-side and applies the tighter
 * bound on an actual CPF CHANGE — comparing against the current row, so an absent key
 * and an unchanged value reach the same verdict. ⛔ That server comparison is the gate;
 * this form omitting `cpf` when untouched is defence in depth. If the form were the
 * mechanism, the bound would not be enforced.
 *
 * ⚠ CPF IS WRITE-ONLY HERE (D7 / D12 / audit HIGH-1). `cpf` is excluded from the
 * `authenticated` column grants on `profiles`, so no admin surface reads another
 * person's CPF — the row policies admit co-commission members and a national ID must
 * not ride along on a colleague's row read. Blank keeps the stored value.
 */
export function UserProfileEditForm({
  user,
  categories,
  personalData,
  canEditCpf,
  onSaved,
}: {
  user: OrgUserDetail;
  categories: ProfessionalCategory[];
  /** The column-locked values, read via B6 behind the `fields` authorizer. */
  personalData: PersonPersonalData;
  /** The SUBSET bound — gates ONLY the CPF field. See the note above. */
  canEditCpf: boolean;
  /** Called after a successful save so the card can drop back to its display rows. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [categoryId, setCategoryId] = useState(
    user.professionalCategoryId ?? "",
  );
  const [cpf, setCpf] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(personalData.dateOfBirth ?? "");
  const [phone, setPhone] = useState(personalData.phone ?? "");

  const fullNameField = useFieldIds("fullName", {
    hasError: Boolean(fieldErrors.fullName),
    required: true,
  });
  const categoryField = useFieldIds("professionalCategoryId");
  const dobField = useFieldIds("dateOfBirth", { hasDescription: true });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(false);

    const input: UpdateUserProfileInput = {
      userId: user.id,
      fullName: fullName.trim(),
      professionalCategoryId: categoryId || null,
      // Both are person-level fields under D3, so they ride the same write. Empty
      // means "clear it" here, unlike at registration — the admin is looking at the
      // current value and deleting it is a deliberate act.
      dateOfBirth: dateOfBirth || null,
      phone: phone || null,
      // Omit the key entirely when untouched. The server compares against the current
      // row, so this changes no verdict — it is defence in depth, not the mechanism.
      ...(cpf ? { cpf } : {}),
    };

    startTransition(async () => {
      const result = await updateUserProfile(input);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar as alterações.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSuccess(true);
      setCpf("");
      router.refresh();
      onSaved?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {success ? (
        <FormBanner tone="success">Perfil atualizado.</FormBanner>
      ) : (
        <FormBanner tone="error">{error}</FormBanner>
      )}

      <Field>
        <FieldLabel>E-mail</FieldLabel>
        <p className="text-sm text-muted-foreground">
          {user.email ?? "Sem e-mail"}
        </p>
      </Field>

      <Field>
        <FieldLabel htmlFor={fullNameField.controlProps.id}>
          Nome completo
        </FieldLabel>
        <Input
          {...fullNameField.controlProps}
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <FieldError id={fullNameField.errorId}>{fieldErrors.fullName}</FieldError>
      </Field>

      {canEditCpf ? (
        <CpfField
          value={cpf}
          onChange={setCpf}
          required={false}
          label="CPF"
          error={fieldErrors.cpf}
          description="Por privacidade, o CPF cadastrado não é exibido. Preencha apenas para substituí-lo; em branco, o valor atual é mantido."
        />
      ) : null}

      <Field>
        <FieldLabel htmlFor={dobField.controlProps.id}>Nascimento</FieldLabel>
        <DatePicker
          id={dobField.controlProps.id}
          value={dateOfBirth}
          onChange={setDateOfBirth}
          clearable
          max={todayIso()}
          placeholder="Não informado"
          aria-describedby={dobField.descriptionId}
        />
        <FieldDescription id={dobField.descriptionId}>
          Diferencia pessoas com o mesmo nome.
        </FieldDescription>
      </Field>

      <PhoneField
        value={phone}
        onChange={setPhone}
        label="Telefone"
        description="Contato direto da pessoa. Não é usado para login nem para notificações."
      />

      <Field>
        <FieldLabel htmlFor={categoryField.controlProps.id}>
          Categoria profissional
        </FieldLabel>
        <NativeSelect
          {...categoryField.controlProps}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Nenhuma</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.labelPt}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}

/**
 * Today as ISO `yyyy-mm-dd` in LOCAL calendar terms. `toISOString()` converts to UTC and
 * would return tomorrow west of Greenwich late in the day, letting a birth-date ceiling
 * drift one day into the future.
 */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
