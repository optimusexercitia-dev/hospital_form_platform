"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import type { ProfessionalCategory } from "@/lib/users/types";
import type { OrgCommissionSummary } from "@/lib/queries/org";
import type { CredentialInput, RegisterUserInput } from "@/lib/users/actions";
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
import { formatCpf } from "@/components/users/cpf-field";
import { CredentialsEditor } from "@/components/users/credentials-editor";
import {
  CommitteeRoleAssigner,
  type CommitteeAssignmentRow,
} from "@/components/users/committee-role-assigner";

/**
 * The CREATE half of the identifier-first registration flow (AFF W3/T3.1).
 *
 * Reached only from {@link RegisterPersonFlow} and only for outcome A — no person in
 * this organisation holds the CPF the admin searched. The CPF is therefore not asked
 * for again: it is carried in, displayed read-only, and submitted with the rest of the
 * payload as ONE atomic `registerUser` call.
 *
 * ⚠ This is where D12's FOURTH outcome lands. A CPF (or e-mail) held OUTSIDE the
 * caller's organisation is indistinguishable from "not found" at lookup time — by
 * design, since naming the holder or their tenant is the disclosure the block exists to
 * prevent — so the admin arrives here and `registerUser`'s collision block refuses at
 * submit, unchanged, as both the backstop and the race guard (ADR 0097 D8). It surfaces
 * on `fieldErrors.cpf` / `fieldErrors.email` in the same words as before.
 *
 * The hospital field creates a `hospital_affiliations` row, not a `profiles` column
 * (D1/D3) — matrícula belongs to the EMPLOYMENT. Leaving it empty is legitimate and
 * meaningful: a person registered and employed nowhere yet is exactly the case D2
 * exists to keep visible.
 */
export function RegisterUserForm({
  organizationId,
  cpf,
  categories,
  commissions,
  emailVerificationEnabled,
  affiliableHospitals,
  lockedHospital,
}: {
  organizationId: string;
  /** Digits-only CPF resolved by the identifier step; never re-typed here. */
  cpf: string;
  categories: ProfessionalCategory[];
  commissions: OrgCommissionSummary[];
  /**
   * Server-resolved onboarding flag (see `@/lib/config/auth`). When `false`
   * (default), the admin sets an initial password here and the account is
   * created active; when `true`, the invite-email flow owns password setup and
   * this form must NOT collect (or send) a password.
   */
  emailVerificationEnabled: boolean;
  /** Hospitals this caller may employ someone at (org-wide, or the locked one). */
  affiliableHospitals: { id: string; name: string }[];
  /**
   * When set (a `hospital_admin` caller, ADR 0051 Decision 7 / Q2), the hospital is
   * LOCKED — rendered as a read-only display, not a chooser — so the UI never implies
   * a choice. The backend hard-sets it server-side regardless; this only keeps the UI
   * honest about what will happen.
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
    required: true,
  });
  const emailField = useFieldIds("email", {
    hasError: Boolean(fieldErrors.email),
    required: true,
  });
  const passwordField = useFieldIds("password", {
    hasError: Boolean(fieldErrors.password),
    hasDescription: true,
    required: true,
  });
  const categoryField = useFieldIds("professionalCategoryId", {
    hasError: Boolean(fieldErrors.professionalCategoryId),
    required: true,
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
      cpf,
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
        const fields = result.fieldErrors ?? {};
        setFieldErrors(fields);
        // Only fall back to a generic form-level message when nothing more specific
        // was returned. The collision block arrives as `fieldErrors.cpf`, and pairing
        // it with "não foi possível" adds noise above the sentence that explains why.
        setError(
          result.error ??
            (Object.keys(fields).length > 0
              ? null
              : "Não foi possível registrar a pessoa."),
        );
        return;
      }
      router.push("../usuarios");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
      {/* Form-level error rendered in an assertive `role="alert"` region so it is
          announced immediately and the tester can target it unambiguously. Not the
          shared `FormBanner` (role="status"/polite), which is intentionally used for
          success/info elsewhere and must not become assertive globally. */}
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
          <FieldLabel>CPF</FieldLabel>
          <p className="font-mono text-sm font-medium">{formatCpf(cpf)}</p>
          <FieldDescription>
            Já consultado nesta organização. Para corrigir, volte e busque outro
            CPF.
          </FieldDescription>
          {/* The cross-organisation collision block lands here (ADR 0097 D8). */}
          <FieldError>{fieldErrors.cpf}</FieldError>
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
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">Vínculo hospitalar</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Onde a pessoa trabalha nesta organização. Pode ficar em branco — e um
            vínculo pode ser adicionado depois, na página da pessoa.
          </p>
        </div>

        {lockedHospital ? (
          <Field>
            <FieldLabel>Hospital</FieldLabel>
            {/* Locked to the hospital_admin's hospital — a read-only display, not a
                chooser (ADR 0051 Decision 7 / Q2). The value is carried by the fixed
                `hospitalId` state; the backend hard-sets it server-side. */}
            <p className="flex items-center gap-2 text-sm font-medium">
              <Building2
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              {lockedHospital.name}
            </p>
            <FieldDescription>
              As pessoas registradas aqui são vinculadas ao seu hospital.
            </FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor={hospitalField.controlProps.id}>
              Hospital (opcional)
            </FieldLabel>
            <NativeSelect
              {...hospitalField.controlProps}
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
            >
              <option value="">Nenhum</option>
              {affiliableHospitals.map((h) => (
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
            Identificador funcional no hospital escolhido. A matrícula pertence ao
            vínculo, não à pessoa.
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
