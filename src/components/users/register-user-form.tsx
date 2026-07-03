"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ProfessionalCategory } from "@/lib/users/types";
import type { HospitalSummary, OrgCommissionSummary } from "@/lib/queries/org";
import type {
  CredentialInput,
  RegisterUserInput,
} from "@/lib/users/actions";
import { registerUser } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { CredentialsEditor } from "@/components/users/credentials-editor";
import {
  CommitteeRoleAssigner,
  type CommitteeAssignmentRow,
} from "@/components/users/committee-role-assigner";

/**
 * Register-user form (FE-2). Required: full name, e-mail, professional
 * category (plan Q10); everything else optional. Submits the whole payload
 * (profile + credentials + committees) as ONE atomic `registerUser` call —
 * the action is a plain typed function (contract-first stub), not
 * `useActionState`-shaped, so submission is driven by `useTransition` here
 * (mirrors `NspCoordinatorManager`). On the e-mail-collision error the action
 * returns via `ActionState.error`/`fieldErrors.email`, surfaced inline. On
 * success the new user exists with status `pending`; we navigate to the
 * directory so it's visible immediately.
 */
export function RegisterUserForm({
  organizationId,
  categories,
  hospitals,
  commissions,
  emailVerificationEnabled,
  lockedHospital,
}: {
  organizationId: string;
  categories: ProfessionalCategory[];
  hospitals: HospitalSummary[];
  commissions: OrgCommissionSummary[];
  /**
   * Server-resolved onboarding flag (see `@/lib/config/auth`). When `false`
   * (default), the admin sets an initial password here and the account is
   * created active; when `true`, the invite-email flow owns password setup and
   * this form must NOT collect (or send) a password.
   */
  emailVerificationEnabled: boolean;
  /**
   * When set (a `hospital_admin` caller, ADR 0051 Decision 7 / Q2), the home
   * hospital is LOCKED to this hospital — rendered as a read-only display, not a
   * chooser — so the UI never implies a choice. The backend hard-sets the home
   * hospital to the admin's hospital server-side regardless; this keeps the UI
   * honest. An org_admin passes `undefined` and gets the free hospital picker.
   */
  lockedHospital?: { id: string; name: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [hospitalId, setHospitalId] = useState(lockedHospital?.id ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [credentials, setCredentials] = useState<CredentialInput[]>([]);
  const [committees, setCommittees] = useState<CommitteeAssignmentRow[]>([]);

  const fullNameField = useFieldIds("fullName", {
    hasError: Boolean(fieldErrors.fullName),
  });
  const emailField = useFieldIds("email", {
    hasError: Boolean(fieldErrors.email),
  });
  const passwordField = useFieldIds("password", {
    hasError: Boolean(fieldErrors.password),
    hasDescription: true,
  });
  const categoryField = useFieldIds("professionalCategoryId", {
    hasError: Boolean(fieldErrors.professionalCategoryId),
  });
  const hospitalField = useFieldIds("homeHospitalId");
  const employeeIdField = useFieldIds("hospitalEmployeeId", {
    hasDescription: true,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const input: RegisterUserInput = {
      homeOrganizationId: organizationId,
      fullName: fullName.trim(),
      email: email.trim(),
      professionalCategoryId: categoryId,
      homeHospitalId: hospitalId || null,
      hospitalEmployeeId: employeeId.trim() || null,
      // Only carry an initial password when the invite-email flow is disabled;
      // when verification is ON the action ignores it, so we omit it entirely.
      password: emailVerificationEnabled ? undefined : password,
      credentials: credentials.length > 0 ? credentials : undefined,
      committees:
        committees.length > 0
          ? committees.map((c) => ({ commissionId: c.commissionId, role: c.role }))
          : undefined,
    };

    startTransition(async () => {
      const result = await registerUser(input);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível registrar a pessoa.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.push("../usuarios");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
      {/* Form-level error (e.g. the e-mail-collision block) rendered in an
          assertive `role="alert"` region so it is announced immediately and the
          tester can target it unambiguously. Not the shared `FormBanner`
          (role="status"/polite), which is intentionally used for success/info
          elsewhere and must not become assertive globally. */}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold">Dados pessoais</h2>

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
          <FieldError id={fullNameField.errorId}>
            {fieldErrors.fullName}
          </FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor={emailField.controlProps.id}>E-mail</FieldLabel>
          <Input
            {...emailField.controlProps}
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError id={emailField.errorId}>{fieldErrors.email}</FieldError>
        </Field>

        {!emailVerificationEnabled ? (
          <Field>
            <FieldLabel htmlFor={passwordField.controlProps.id}>
              Senha inicial
            </FieldLabel>
            <Input
              {...passwordField.controlProps}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldDescription id={passwordField.descriptionId}>
              Repasse esta senha à pessoa com segurança. A conta é ativada
              imediatamente e a pessoa poderá alterá-la depois. Mínimo de 8
              caracteres.
            </FieldDescription>
            <FieldError id={passwordField.errorId}>
              {fieldErrors.password}
            </FieldError>
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor={categoryField.controlProps.id}>
            Categoria profissional
          </FieldLabel>
          <NativeSelect
            {...categoryField.controlProps}
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="" disabled>
              Selecione uma categoria
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.labelPt}
              </option>
            ))}
          </NativeSelect>
          <FieldError id={categoryField.errorId}>
            {fieldErrors.professionalCategoryId}
          </FieldError>
        </Field>

        {lockedHospital ? (
          <Field>
            <FieldLabel htmlFor={hospitalField.controlProps.id}>
              Hospital de origem
            </FieldLabel>
            {/* Locked to the hospital_admin's hospital — a read-only display, not
                a chooser (ADR 0051 Decision 7 / Q2). The value is carried by the
                fixed `hospitalId` state; the backend hard-sets it server-side. */}
            <Input
              {...hospitalField.controlProps}
              type="text"
              value={lockedHospital.name}
              readOnly
              aria-readonly="true"
              tabIndex={-1}
              className="bg-muted/50 text-muted-foreground"
            />
            <FieldDescription id={`${hospitalField.controlProps.id}-locked`}>
              As pessoas registradas aqui pertencem ao seu hospital.
            </FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor={hospitalField.controlProps.id}>
              Hospital de origem (opcional)
            </FieldLabel>
            <NativeSelect
              {...hospitalField.controlProps}
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
            >
              <option value="">Nenhum</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

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
          <FieldDescription id={employeeIdField.descriptionId}>
            Identificador funcional no hospital, se houver.
          </FieldDescription>
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Registros profissionais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conselhos de classe (CRM, COREN, CRF…). Opcional, pode ser
            adicionado depois.
          </p>
        </div>
        <CredentialsEditor
          mode="collect"
          credentials={credentials}
          onChange={setCredentials}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Comissões</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Atribua a pessoa a uma ou mais comissões, com o papel de cada uma.
            Opcional, pode ser feito depois.
          </p>
        </div>
        <CommitteeRoleAssigner
          mode="collect"
          commissions={commissions}
          assignments={committees}
          onChange={setCommittees}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="self-start"
        disabled={isPending}
      >
        {isPending ? "Registrando…" : "Registrar pessoa"}
      </Button>
    </form>
  );
}
