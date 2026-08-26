"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";

import type { ProfessionalCategory } from "@/lib/users/types";
import type { OrgCommissionSummary } from "@/lib/queries/org";
import type { CredentialInput, RegisterUserInput } from "@/lib/users/actions";
import { registerUser } from "@/lib/users/actions";
import { orgHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Stepper } from "@/components/ui/stepper";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { formatCpf } from "@/components/users/cpf-field";
import { PhoneField } from "@/components/users/phone-field";
import { CredentialsEditor } from "@/components/users/credentials-editor";
import {
  CommitteeRoleAssigner,
  type CommitteeAssignmentRow,
} from "@/components/users/committee-role-assigner";

/**
 * The CREATE path of identifier-first registration, as a three-step wizard
 * (AFF2 F3 — handoff §Screen 3 option 1b, ADR 0133 D6–D8).
 *
 * Reached only from {@link RegisterPersonFlow} and only for outcome A — nobody in this
 * organisation holds the CPF the admin searched. The CPF is therefore never re-typed:
 * it arrives resolved, is displayed read-only, and is submitted with everything else as
 * ONE atomic `registerUser` call at the end. There is no partial write; abandoning the
 * wizard creates nothing.
 *
 * ⛔ NO "ENVIAR CONVITE AGORA" ESCAPE HATCH (D8). The handoff draws a footnote that
 * submits early with "whatever is valid so far"; it is deliberately not built. Steps 2
 * and 3 are skippable, step 1 is not, and every registration walks the wizard.
 *
 * ⛔ A HOSPITAL_ADMIN'S REGISTRATION ALWAYS CREATES THE AFFILIATION (D8). Their hospital
 * is server-set and seeded into state here, so "Pular etapa" on step 2 skips the
 * *matrícula*, never the vínculo — and the step's own copy says so, because a skip
 * control that silently does less than its label is how someone registers a person they
 * then cannot manage. For an org_admin the same skip legitimately creates an
 * unaffiliated person, who is then org_admin-only by ADR 0133 Decision 2.
 *
 * ⚠ TWO FIELDS THE HANDOFF DRAWS ARE NOT BUILT, because the action cannot accept them:
 *   · **Nascimento / Telefone** (step 1) need `registerUser` to gain `dateOfBirth` /
 *     `phone` — backend task **B4**, not started. `RegisterUserInput` has no such
 *     fields, so rendering them would take a birth date from the admin, show it
 *     accepted, and drop it on submit under a success redirect. An input whose value
 *     the backend discards is worse than an absent one. Insertion point is marked below.
 *   · **Data de início** (step 2) is the same: `registerUser` takes `homeHospitalId` and
 *     `hospitalEmployeeId` and no start date, so the affiliation begins today — which is
 *     also the right default for someone being registered today. `affiliatePerson` (the
 *     existing-person path) does accept one; this action does not.
 */

export interface RegisterPersonWizardProps {
  org: string;
  organizationId: string;
  /** Digits-only CPF resolved by the identifier step; never re-typed here. */
  cpf: string;
  categories: ProfessionalCategory[];
  commissions: OrgCommissionSummary[];
  /**
   * Server-resolved onboarding flag (`@/lib/config/auth`). When `false` (the default)
   * the admin sets an initial password here and the account is created ACTIVE with no
   * e-mail sent; when `true` the invite flow owns password setup and this form must not
   * collect one. It also decides the final button's wording — see {@link submitLabel}.
   */
  emailVerificationEnabled: boolean;
  /** Hospitals this caller may employ someone at (org-wide, or the locked one). */
  affiliableHospitals: { id: string; name: string }[];
  /** Set for a `hospital_admin`: the hospital is fixed, so there is no picker at all. */
  lockedHospital?: { id: string; name: string };
}

const STEPS = [
  { label: "Identificação" },
  { label: "Vínculo hospitalar" },
  { label: "Comissões" },
];

/**
 * Today as ISO `yyyy-mm-dd`, in LOCAL calendar terms — `toISOString()` would convert to
 * UTC and hand back tomorrow's date for anyone west of Greenwich late in the day, which
 * for a birth-date ceiling means silently allowing one day into the future.
 */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function RegisterPersonWizard({
  org,
  organizationId,
  cpf,
  categories,
  commissions,
  emailVerificationEnabled,
  affiliableHospitals,
  lockedHospital,
}: RegisterPersonWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 1 — identification.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // ADR 0133 D9 — both optional at registration. `dateOfBirth` is ISO `yyyy-mm-dd`;
  // `phone` is held digits-only, the storage form (Amdt 1 r6).
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [credentials, setCredentials] = useState<CredentialInput[]>([]);
  // Step 2 — hospital link. Seeded from the locked hospital so a hospital_admin's
  // affiliation survives "Pular etapa" (D8).
  const [hospitalId, setHospitalId] = useState(lockedHospital?.id ?? "");
  const [employeeId, setEmployeeId] = useState("");
  // Step 3 — committees.
  const [committees, setCommittees] = useState<CommitteeAssignmentRow[]>([]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  /**
   * Move focus to the step heading whenever the step changes. The card's whole content
   * is replaced, so a keyboard or screen-reader user must land on the new step rather
   * than be left on a "Continuar" button whose surroundings silently became something
   * else. Skipped on first render — arriving here is already a focus event of its own.
   */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const step1Complete =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    categoryId.length > 0 &&
    (emailVerificationEnabled || password.length >= 8);

  /**
   * The final action's wording follows what will actually happen.
   *
   * ⚠ The handoff fixes this as "Registrar e enviar convite", but that is only true when
   * email verification is ON. It is OFF by default, and in that mode the admin sets an
   * initial password and the account is created active with NO e-mail sent — so the
   * drawn copy would promise a message nobody receives. The page's own description
   * already branches on the same flag.
   */
  const submitLabel = emailVerificationEnabled
    ? "Registrar e enviar convite"
    : "Registrar pessoa";

  function goTo(next: number) {
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  }

  function handleContinue() {
    if (step === 0 && !step1Complete) {
      // Surface the same field errors the action would, without a round trip.
      setFieldErrors({
        ...(fullName.trim() ? {} : { fullName: "Informe o nome completo." }),
        ...(email.trim() ? {} : { email: "Informe o e-mail." }),
        ...(categoryId ? {} : { professionalCategoryId: "Selecione a categoria profissional." }),
        ...(emailVerificationEnabled || password.length >= 8
          ? {}
          : { password: "Defina uma senha inicial de pelo menos 8 caracteres." }),
      });
      return;
    }
    setFieldErrors({});
    goTo(step + 1);
  }

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    const input: RegisterUserInput = {
      homeOrganizationId: organizationId,
      cpf,
      fullName: fullName.trim(),
      email: email.trim(),
      professionalCategoryId: categoryId,
      // Optional (D9). Empty means "not provided", so send null rather than "" — the
      // column is nullable and an empty string is not a birth date or a phone number.
      dateOfBirth: dateOfBirth || null,
      phone: phone || null,
      homeHospitalId: hospitalId || null,
      hospitalEmployeeId: employeeId.trim() || null,
      // Only carry an initial password when the invite-email flow is disabled;
      // when verification is ON the action ignores it, so it is omitted entirely.
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
        // Only fall back to a generic message when nothing more specific came back.
        // The cross-organisation collision block arrives as `fieldErrors.cpf`, and
        // pairing it with "não foi possível" adds noise above the sentence that
        // explains why.
        setError(
          result.error ??
            (Object.keys(fields).length > 0
              ? null
              : "Não foi possível registrar a pessoa."),
        );
        // A server-side field error always belongs to step 1's fields (identity and
        // the collision block), so send the admin back to where the fix is.
        if (Object.keys(fields).length > 0) setStep(0);
        return;
      }
      // Straight to the new person's page (B4 — `RegisterUserState.userId`). Status
      // reads Pendente until the invite is accepted, or Ativo when the admin set an
      // initial password.
      //
      // ⚠ The guard is not defensive noise: `userId` is `string | undefined` on the
      // state and `ok: true` does not narrow it, so the type genuinely admits an
      // ok-without-id. Falling back to the filtered directory keeps the admin looking
      // at the person they just created instead of routing them to `/usuarios/undefined`.
      router.push(
        result.userId
          ? orgHref(org, "manage", "usuarios", result.userId)
          : `${orgHref(org, "manage", "usuarios")}?search=${encodeURIComponent(email.trim())}`,
      );
      router.refresh();
    });
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="flex flex-col gap-5">
      <Stepper
        steps={STEPS}
        current={step}
        maxReached={maxReached}
        onStepClick={isPending ? undefined : goTo}
      />

      {/* Form-level error in an assertive region so it is announced immediately.
          Not the shared `FormBanner` (role="status"/polite), which is used for
          success/info elsewhere and must not become assertive globally. */}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      <section
        aria-labelledby="wizard-step-heading"
        className="animate-rise-in flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-xs"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="wizard-step-heading"
            ref={headingRef}
            tabIndex={-1}
            className="rounded-md text-base font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {step === 0
              ? "Dados pessoais"
              : step === 1
                ? "Vínculo hospitalar"
                : "Comissões"}
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            {step === 0
              ? "Quem é esta pessoa. O CPF já foi consultado e não precisa ser digitado de novo."
              : step === 1
                ? lockedHospital
                  ? `A pessoa será vinculada ao ${lockedHospital.name}. Pular esta etapa deixa a matrícula em branco — o vínculo é criado de qualquer forma.`
                  : "Onde a pessoa trabalha nesta organização. Você pode pular — a pessoa fica registrada sem vínculo hospitalar, e um vínculo pode ser criado depois."
                : "Atribua a pessoa a uma ou mais comissões, com o papel de cada uma. Você pode registrar sem nenhuma e fazer isso depois, na página da pessoa."}
          </p>
        </div>

        {step === 0 ? (
          <StepIdentification
            cpf={cpf}
            fullName={fullName}
            setFullName={setFullName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            categories={categories}
            dateOfBirth={dateOfBirth}
            setDateOfBirth={setDateOfBirth}
            phone={phone}
            setPhone={setPhone}
            credentials={credentials}
            setCredentials={setCredentials}
            emailVerificationEnabled={emailVerificationEnabled}
            fieldErrors={fieldErrors}
          />
        ) : null}

        {step === 1 ? (
          <StepHospital
            affiliableHospitals={affiliableHospitals}
            lockedHospital={lockedHospital}
            hospitalId={hospitalId}
            setHospitalId={setHospitalId}
            employeeId={employeeId}
            setEmployeeId={setEmployeeId}
          />
        ) : null}

        {step === 2 ? (
          <CommitteeRoleAssigner
            mode="collect"
            commissions={commissions}
            assignments={committees}
            onChange={setCommittees}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => goTo(step - 1)}
            >
              <ArrowLeft aria-hidden="true" />
              Voltar
            </Button>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {step > 0 && !isLastStep ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => goTo(step + 1)}
              >
                Pular etapa
              </Button>
            ) : null}
            {/* ⚠ NO "Pular etapa" ON THE LAST STEP. Skipping committees and
                submitting with none assigned are the same act, and offering both
                would be two controls with one effect — the admin then has to work
                out whether they differ. The step's caption carries the skip
                instead. */}
            {isLastStep ? (
              <Button type="button" disabled={isPending} onClick={handleSubmit}>
                {isPending ? "Registrando…" : submitLabel}
              </Button>
            ) : (
              <Button type="button" disabled={isPending} onClick={handleContinue}>
                Continuar
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Step 1 — who this person is. The only non-skippable step. */
function StepIdentification({
  cpf,
  fullName,
  setFullName,
  email,
  setEmail,
  password,
  setPassword,
  categoryId,
  setCategoryId,
  categories,
  dateOfBirth,
  setDateOfBirth,
  phone,
  setPhone,
  credentials,
  setCredentials,
  emailVerificationEnabled,
  fieldErrors,
}: {
  cpf: string;
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  categories: ProfessionalCategory[];
  /** ISO `yyyy-mm-dd`, or "" when not provided. */
  dateOfBirth: string;
  setDateOfBirth: (v: string) => void;
  /** Digits only — the storage form (ADR 0133 Amdt 1 r6). */
  phone: string;
  setPhone: (v: string) => void;
  credentials: CredentialInput[];
  setCredentials: (v: CredentialInput[]) => void;
  emailVerificationEnabled: boolean;
  fieldErrors: Record<string, string>;
}) {
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
  const dobField = useFieldIds("dateOfBirth", { hasDescription: true });

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel>CPF</FieldLabel>
        <p className="font-mono text-sm font-medium">{formatCpf(cpf)}</p>
        <FieldDescription>
          Já consultado nesta organização. Para corrigir, volte e busque outro CPF.
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
        <FieldError id={fullNameField.errorId}>{fieldErrors.fullName}</FieldError>
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

      {/* ADR 0133 D9 — both optional, and both column-locked (D10): they are readable
          only on the admin management surface, never by a co-commission colleague. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel
            id={`${dobField.controlProps.id}-label`}
            htmlFor={dobField.controlProps.id}
          >
            Nascimento (opcional)
          </FieldLabel>
          <DatePicker
            id={dobField.controlProps.id}
            labelId={`${dobField.controlProps.id}-label`}
            value={dateOfBirth}
            onChange={setDateOfBirth}
            clearable
            // A birth date in the future is not a typo worth storing.
            max={todayIso()}
            placeholder="Selecionar data"
            aria-describedby={dobField.descriptionId}
          />
          <FieldDescription id={dobField.descriptionId}>
            Diferencia pessoas com o mesmo nome — comum o bastante para ser o
            desempate prático quando o CPF não está à vista.
          </FieldDescription>
        </Field>

        <PhoneField
          value={phone}
          onChange={setPhone}
          label="Telefone (opcional)"
          description="Contato direto da pessoa. Não é usado para login nem para notificações."
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div>
          <h3 className="text-sm font-semibold">Registro profissional</h3>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
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
    </div>
  );
}

/** Step 2 — the hospital link. Skippable; for a hospital_admin the skip keeps the vínculo. */
function StepHospital({
  affiliableHospitals,
  lockedHospital,
  hospitalId,
  setHospitalId,
  employeeId,
  setEmployeeId,
}: {
  affiliableHospitals: { id: string; name: string }[];
  lockedHospital?: { id: string; name: string };
  hospitalId: string;
  setHospitalId: (v: string) => void;
  employeeId: string;
  setEmployeeId: (v: string) => void;
}) {
  const hospitalField = useFieldIds("homeHospitalId");
  const employeeIdField = useFieldIds("hospitalEmployeeId", {
    hasDescription: true,
  });

  return (
    <div className="flex flex-col gap-5">
      {lockedHospital ? (
        <Field>
          <FieldLabel>Hospital</FieldLabel>
          {/* Locked to the hospital_admin's hospital — a read-only display, not a
              chooser (ADR 0051 Decision 7 / Q2). The backend hard-sets it server-side;
              this only keeps the UI honest about what will happen. */}
          <p className="flex items-center gap-2 text-sm font-medium">
            <Building2 aria-hidden="true" className="size-4 text-muted-foreground" />
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
  );
}
