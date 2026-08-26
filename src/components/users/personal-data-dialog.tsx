"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { OrgUserDetail, ProfessionalCategory } from "@/lib/users/types";
import type { UpdateUserProfileInput } from "@/lib/users/actions";
import type { PersonPersonalData } from "@/lib/users/person-footprint";
import { updateUserProfile } from "@/lib/users/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { LiveBanner } from "@/components/auth/form-banner";
import { CpfField } from "@/components/users/cpf-field";
import { PhoneField } from "@/components/users/phone-field";
import { ProfileDialogShell } from "@/components/users/profile-dialog-shell";

/**
 * Dialog 3a — the PERSON-LEVEL fields (AFF2 F2 — ADR 0133 D3 + Amdt 1; redesign 3a).
 *
 * Everything here is a fact about the HUMAN — name, CPF, professional category, and the
 * D9 columns (birth date, phone) — as opposed to employment facts (which hospital,
 * matrícula, start, end), which live in `AffiliationsPanel` where a hospital's own admin
 * owns them.
 *
 * ⚠ RENAMED FROM `UserProfileEditForm`, AND THE NAME CHANGE IS THE POINT. The redesign
 * moves these fields out of an inline disclosure and into a modal, so the component is
 * now a DIALOG that happens to contain a form — it owns the panel, the CTA and the
 * cancel path. Keeping "…EditForm" would have been a name that lies about its content,
 * which is a debt this codebase has already paid for once.
 *
 * ⚠ TWO CAPABILITIES, NOT ONE (ADR 0133 Amdt 1 ruling 1). `canEditPerson` is the
 * INTERSECTION bound and admits this dialog at all — the CARD decides that, by only
 * rendering the trigger; `canEditCpf` is the SUBSET bound and admits only the CPF field
 * inside it. They genuinely disagree on the same target: a hospital_admin editing a
 * person who also works elsewhere may fix a name and may NOT rewrite the person key.
 * That disagreement is the amendment's entire point, so the CPF field is gated
 * separately rather than inheriting the dialog's own gate.
 *
 * ⚠ BOTH FLAGS ARE UX, NOT SECURITY (Architecture Rule 1). The boundary is
 * `updateUserProfile`, which re-derives authority server-side and applies the tighter
 * bound on an actual CPF CHANGE — comparing against the current row, so an absent key
 * and an unchanged value reach the same verdict. ⛔ That server comparison is the gate;
 * this dialog omitting `cpf` when untouched is defence in depth. If the form were the
 * mechanism, the bound would not be enforced.
 *
 * ⚠ CPF IS WRITE-ONLY HERE (D7 / audit HIGH-1). `cpf` is excluded from the
 * `authenticated` column grants on `profiles`, so no admin surface reads another
 * person's raw CPF. The rail card now shows a SERVER-COMPUTED MASK
 * (`personalData.cpfMasked`, ADR 0133 D12 as amended) — the digits still never cross the
 * wire, and this field still starts blank, because a masked value is not something you
 * can edit into. Blank keeps the stored value.
 *
 * ⛔ NO SUCCESS BANNER LIVES HERE, and that is a fix rather than a style preference
 * (BUG-AFF2-PROFILE-SAVE-BANNER-UNMOUNTS). A successful save closes the dialog, which
 * unmounts this component in the same React commit — so a success banner owned here
 * would mount and unmount without ever painting. The write succeeded, every functional
 * assertion passed, and the admin was told nothing. `onSaved` hands that job to
 * `PersonalDataCard`, which survives the close. No timing tweak can fix it: state that
 * lives inside the unmounting tree dies with it.
 */
export function PersonalDataDialog({
  user,
  categories,
  personalData,
  canEditCpf,
  onSaved,
  onClose,
}: {
  user: OrgUserDetail;
  categories: ProfessionalCategory[];
  /** The column-locked values, read via B6 behind the `fields` authorizer. */
  personalData: PersonPersonalData;
  /** The SUBSET bound — gates ONLY the CPF field. See the note above. */
  canEditCpf: boolean;
  /**
   * Called after a successful save, BEFORE this dialog unmounts.
   *
   * ⛔ REQUIRED. Whoever mounts this dialog owns telling the admin the save worked,
   * because this component cannot — see the header. Making it optional would let the
   * next consumer mount the dialog, show nothing on success, and reproduce the bug
   * invisibly, since the write itself succeeds and every functional assertion passes.
   */
  onSaved: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  const dobField = useFieldIds("dateOfBirth");

  function submit() {
    setError(null);
    setFieldErrors({});

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
        // A failed save KEEPS this dialog open, so it can own that message; a
        // successful one destroys it, so it cannot own that one.
        setError(result.error ?? "Não foi possível salvar as alterações.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setCpf("");
      router.refresh();
      onSaved();
    });
  }

  return (
    <ProfileDialogShell
      open
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
      title="Editar dados pessoais"
      subtitle={`${user.fullName?.trim() || user.email || "Esta pessoa"} · fatos sobre a pessoa, visíveis em toda a organização.`}
      onSubmit={submit}
      submitLabel="Salvar alterações"
      pendingLabel="Salvando…"
      isPending={isPending}
      footerNote="Alterações ficam registradas na trilha de auditoria da organização."
    >
      <LiveBanner tone="error">{error}</LiveBanner>

      <Field>
        <FieldLabel htmlFor={fullNameField.controlProps.id}>
          Nome completo
        </FieldLabel>
        <Input
          {...fullNameField.controlProps}
          type="text"
          className="h-10"
          autoComplete="name"
          required
          value={fullName}
          disabled={isPending}
          onChange={(e) => setFullName(e.target.value)}
        />
        <FieldError id={fullNameField.errorId}>
          {fieldErrors.fullName}
        </FieldError>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {canEditCpf ? (
          <CpfField
            value={cpf}
            onChange={setCpf}
            required={false}
            label="CPF"
            error={fieldErrors.cpf}
            disabled={isPending}
            description="Preencha apenas para substituir o CPF cadastrado; em branco, o valor atual é mantido."
          />
        ) : null}

        <Field>
          <FieldLabel
            id={`${dobField.controlProps.id}-label`}
            htmlFor={dobField.controlProps.id}
          >
            Nascimento
          </FieldLabel>
          <DatePicker
            id={dobField.controlProps.id}
            labelId={`${dobField.controlProps.id}-label`}
            value={dateOfBirth}
            onChange={setDateOfBirth}
            clearable
            max={todayIso()}
            placeholder="Não informado"
            disabled={isPending}
          />
        </Field>
      </div>

      <PhoneField
        value={phone}
        onChange={setPhone}
        label="Telefone"
        disabled={isPending}
      />

      <Field>
        <FieldLabel htmlFor={categoryField.controlProps.id}>
          Categoria profissional
        </FieldLabel>
        <NativeSelect
          {...categoryField.controlProps}
          className="h-10"
          value={categoryId}
          disabled={isPending}
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
    </ProfileDialogShell>
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
