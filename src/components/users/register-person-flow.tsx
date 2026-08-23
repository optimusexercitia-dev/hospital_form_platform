"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CircleSlash,
  Link2,
  Search,
  UserPlus,
} from "lucide-react";

import type { OrgPerson } from "@/lib/queries/affiliations";
import type { ProfessionalCategory } from "@/lib/users/types";
import type { OrgCommissionSummary } from "@/lib/queries/org";
import { affiliatePerson, lookupOrgPeople } from "@/lib/affiliations/actions";
import { isValidCpf } from "@/lib/users/cpf";
import { orgHref } from "@/lib/routing";
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
import { CpfField, formatCpf } from "@/components/users/cpf-field";
import { RegisterPersonWizard } from "@/components/users/register-person-wizard";

/**
 * Identifier-first registration (AFF W3/T3.1 — ADR 0097 D12).
 *
 * ONE flow, four outcomes. The original defect this replaces is that "Registrar
 * pessoa" was create-only, so an admin at a second hospital of the same organisation
 * hit `registerUser`'s e-mail-collision wall with no way forward — and, worse, had to
 * know in advance which case they were in. So this is deliberately NOT two buttons:
 * the first field resolves the identifier, and the screen then becomes whichever of
 * the four things is actually true.
 *
 *   A. not found in my org        → the three-step create wizard, CPF carried forward
 *   B. found, unaffiliated here   → offer to affiliate ("Vincular ao …")
 *   C. found, already affiliated  → link to their page; nothing to create
 *   D. collides OUTSIDE my org    → `registerUser`'s existing pt-BR block, verbatim
 *
 * ⚠ AFF2 F3 (ADR 0133 D6–D8): outcome A is now {@link RegisterPersonWizard} — three
 * steps, one atomic submit at the end — not the former single `RegisterUserForm`, which
 * this component was its only consumer of and which is retired. Outcomes B, C and D are
 * unchanged: they are terminal, so the stepper is deliberately absent from them. There
 * is no "Enviar convite agora" escape hatch (D8).
 *
 * D has no branch of its own on purpose. `list_org_people` never crosses the tenant
 * anchor, so a CPF held in another organisation looks exactly like "not found" here —
 * which is the point (naming the holder or their tenant would be the disclosure the
 * block exists to prevent). The admin proceeds into the create form and `registerUser`
 * refuses at submit, unchanged, as the backstop AND the race guard (D8).
 *
 * ⚠ Three contract facts this component is built ON, not around:
 *  1. `list_org_people` returns `[]` for an unauthorized caller and never raises, so a
 *     probe cannot distinguish "no results" from "not allowed". Empty is therefore
 *     rendered as "não encontrado" — NEVER as "você não tem permissão".
 *  2. The CPF matches EXACTLY or not at all (D11 refuses partial matching as an
 *     enumeration oracle over national IDs). The form therefore refuses to search at
 *     all until the CPF is complete and check-digit valid, and says so — it must never
 *     imply that a partial CPF narrows anything.
 *  3. `is_active` rides in the payload for a reason (ADR 0098 W2.2): without it this
 *     flow would cheerfully offer to affiliate a deactivated account, or push the
 *     admin into creating a duplicate. It gets its own outcome.
 */

type Step = "identify" | "resolved" | "create";

const LOOKUP_MESSAGES = {
  invalid: "Informe um CPF completo e válido (11 dígitos).",
  error: "Não foi possível consultar o CPF agora. Tente novamente.",
} as const;

function formatDate(iso: string): string {
  // `started_on` is a DATE (no time). Parsing it as an instant would shift it a day
  // west of UTC, so read the parts and format them as a local calendar date.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(y, m - 1, d),
  );
}

export function RegisterPersonFlow({
  org,
  organizationId,
  organizationName,
  isOrgAdmin,
  affiliableHospitals,
  lockedHospital,
  categories,
  commissions,
  emailVerificationEnabled,
}: {
  /** Org slug, for links. */
  org: string;
  organizationId: string;
  organizationName: string;
  isOrgAdmin: boolean;
  /**
   * The hospitals this caller may affiliate someone INTO — the whole organisation for
   * an `org_admin`, exactly one for a `hospital_admin`. Never a list the caller cannot
   * act on: offering a hospital the door will refuse is a lie the UI tells.
   */
  affiliableHospitals: { id: string; name: string }[];
  /** Set for a `hospital_admin`: the target is fixed, so there is no picker at all. */
  lockedHospital?: { id: string; name: string };
  categories: ProfessionalCategory[];
  commissions: OrgCommissionSummary[];
  emailVerificationEnabled: boolean;
}) {
  const router = useRouter();
  const cpfInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("identify");
  const [cpf, setCpf] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [person, setPerson] = useState<OrgPerson | null>(null);
  const [isLooking, startLookup] = useTransition();

  // Affiliation sub-form (outcome B).
  const [targetHospitalId, setTargetHospitalId] = useState(
    lockedHospital?.id ?? "",
  );
  const [employeeId, setEmployeeId] = useState("");
  const [startedOn, setStartedOn] = useState("");
  const [affiliationError, setAffiliationError] = useState<string | null>(null);
  const [isAffiliating, startAffiliation] = useTransition();

  const employeeIdField = useFieldIds("employeeId", { hasDescription: true });
  const hospitalField = useFieldIds("targetHospitalId", { required: true });
  const startedOnField = useFieldIds("startedOn", { hasDescription: true });

  const cpfComplete = isValidCpf(cpf);

  /**
   * Move focus to the outcome heading when a step replaces the view.
   *
   * The result of the lookup IS the screen now, so a screen-reader user must land on
   * it rather than be left on a submit button whose surroundings silently changed.
   * Focus movement is used INSTEAD of an `aria-live` region on purpose: a live region
   * wrapping the whole panel would read the affiliation form aloud too, and a region
   * that mounts together with its content is announced unreliably anyway.
   *
   * A callback ref (not an effect) so it fires exactly when the heading attaches.
   */
  const focusOutcomeHeading = useCallback((node: HTMLElement | null) => {
    node?.focus();
  }, []);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);

    // Refuse locally before spending a round trip AND an audit row — every
    // CPF-parameterised call to the door writes one (D11).
    if (!cpfComplete) {
      setLookupError(LOOKUP_MESSAGES.invalid);
      cpfInputRef.current?.focus();
      return;
    }

    startLookup(async () => {
      // The action rethrows a failed RPC; catch it here so a raw Postgres error can
      // never reach the screen (CLAUDE.md §8). CPF is unique platform-wide, so an
      // exact-match lookup returns at most one person.
      let people;
      try {
        people = await lookupOrgPeople({ orgId: organizationId, cpf });
      } catch {
        setLookupError(LOOKUP_MESSAGES.error);
        return;
      }
      const found = people[0] ?? null;
      setPerson(found);
      if (found) {
        // Default the target to a hospital they are ALREADY at, so "já vinculado"
        // surfaces immediately rather than hiding behind a picker the admin has to
        // guess at. A hospital_admin's target is locked and never re-derived.
        setTargetHospitalId(
          lockedHospital?.id ??
            found.affiliations.find((a) =>
              affiliableHospitals.some((h) => h.id === a.hospitalId),
            )?.hospitalId ??
            "",
        );
        setStep("resolved");
      } else {
        setStep("create");
      }
    });
  }

  function restart() {
    setStep("identify");
    setPerson(null);
    setLookupError(null);
    setAffiliationError(null);
    setEmployeeId("");
    setStartedOn("");
    // Focus follows the admin back to the field they are about to retype into.
    window.requestAnimationFrame(() => cpfInputRef.current?.focus());
  }

  function handleAffiliate() {
    if (!person || !targetHospitalId) return;
    setAffiliationError(null);
    startAffiliation(async () => {
      const result = await affiliatePerson({
        userId: person.userId,
        hospitalId: targetHospitalId,
        employeeId: employeeId.trim() || null,
        startedOn: startedOn || null,
      });
      if (!result.ok) {
        setAffiliationError(result.error ?? "Não foi possível vincular a pessoa.");
        return;
      }
      // Once affiliated the person is visible to this admin, so send them where the
      // rest of the work is (committees, matrícula, credentials).
      router.push(orgHref(org, "manage", "usuarios", person.userId));
      router.refresh();
    });
  }

  // ---------------------------------------------------------------- step 1
  if (step === "identify") {
    return (
      <section
        aria-labelledby="identificar-heading"
        className="animate-rise-in max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
      >
        <form onSubmit={handleLookup} className="flex flex-col gap-6" noValidate>
          <div className="flex flex-col gap-1.5">
            <h2 id="identificar-heading" className="text-lg font-semibold">
              Comece pelo CPF
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground text-pretty">
              O CPF identifica a pessoa em toda a plataforma. Se ela já estiver
              cadastrada em {organizationName}, você poderá vinculá-la em vez de
              criar um cadastro duplicado.
            </p>
          </div>

          <CpfField
            value={cpf}
            onChange={(v) => {
              setCpf(v);
              setLookupError(null);
            }}
            inputRef={cpfInputRef}
            error={lookupError ?? undefined}
            description="A busca é exata: informe os 11 dígitos. Um CPF parcial não retorna resultados."
          />

          <Button
            type="submit"
            size="lg"
            className="self-start"
            disabled={isLooking}
          >
            <Search aria-hidden="true" />
            {isLooking ? "Buscando…" : "Buscar pessoa"}
          </Button>
        </form>
      </section>
    );
  }

  // ------------------------------------------------------- step 2, outcome A
  if (step === "create") {
    return (
      <div className="flex max-w-2xl flex-col gap-5">
        <SearchedCpfSummary cpf={cpf} onRestart={restart} />

        <div className="animate-rise-in flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-5">
          <UserPlus
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          />
          <div className="flex flex-col gap-1">
            <h2
              ref={focusOutcomeHeading}
              tabIndex={-1}
              className="text-sm font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              Nenhuma pessoa com este CPF em {organizationName}.
            </h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Preencha os dados abaixo para criar o cadastro.
            </p>
          </div>
        </div>

        <RegisterPersonWizard
          org={org}
          organizationId={organizationId}
          cpf={cpf}
          categories={categories}
          commissions={commissions}
          emailVerificationEnabled={emailVerificationEnabled}
          affiliableHospitals={affiliableHospitals}
          lockedHospital={lockedHospital}
        />
      </div>
    );
  }

  // -------------------------------------------- step 2, outcomes B / C / dead
  if (!person) return null;

  const displayName = person.fullName?.trim() || person.email || "Esta pessoa";
  const affiliationNames = person.affiliations
    .map((a) => a.hospitalName)
    .filter(Boolean);
  const targetHospital = affiliableHospitals.find(
    (h) => h.id === targetHospitalId,
  );
  const existingAtTarget = person.affiliations.find(
    (a) => a.hospitalId === targetHospitalId,
  );
  // A hospital_admin can only open the page of someone their hospital already sees;
  // for anyone else the link would 404, so it is not offered (Rule 1 — the RLS scope
  // is the authority; this only keeps the UI honest about it).
  const canOpenPersonPage =
    isOrgAdmin ||
    person.affiliations.some((a) =>
      affiliableHospitals.some((h) => h.id === a.hospitalId),
    );

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <SearchedCpfSummary cpf={cpf} onRestart={restart} />

      <section
        aria-labelledby="pessoa-heading"
        className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
      >
        <div className="flex flex-col gap-1">
          <h2 id="pessoa-heading" className="text-lg font-semibold">
            {displayName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {person.email ?? "Sem e-mail"}
            {person.professionalCategory ? ` · ${person.professionalCategory}` : ""}
          </p>
        </div>

        <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <dt className="text-muted-foreground">Organização</dt>
            <dd className="font-medium">{organizationName}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <dt className="text-muted-foreground">Vínculos ativos</dt>
            <dd className="font-medium">
              {affiliationNames.length > 0
                ? affiliationNames.join(", ")
                : "Nenhum"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Outcome: the account is deactivated. This is checked FIRST and short-circuits
          both other branches — affiliating a deactivated account would produce a
          roster row for someone who cannot sign in, and creating a second account
          for the same human is worse. */}
      {!person.isActive ? (
        <OutcomePanel
          tone="warning"
          icon={<CircleSlash aria-hidden="true" className="size-5 shrink-0" />}
          title={`A conta de ${displayName} está desativada.`}
          delay="60ms"
          headingRef={focusOutcomeHeading}
        >
          <p className="text-sm text-muted-foreground text-pretty">
            Não é possível vincular uma conta desativada a um hospital. Reative a
            conta antes de registrar o vínculo.
          </p>
          {isOrgAdmin ? (
            <Button asChild variant="outline" className="self-start">
              <Link href={orgHref(org, "manage", "usuarios", person.userId)}>
                Abrir a página de {displayName}
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground text-pretty">
              A reativação de contas é feita por um administrador da organização.
            </p>
          )}
        </OutcomePanel>
      ) : existingAtTarget ? (
        /* Outcome C — already affiliated to the target hospital. */
        <OutcomePanel
          tone="success"
          icon={<BadgeCheck aria-hidden="true" className="size-5 shrink-0" />}
          title={`${displayName} já está vinculado a ${
            existingAtTarget.hospitalName
          } desde ${formatDate(existingAtTarget.startedOn)}.`}
          delay="60ms"
          headingRef={focusOutcomeHeading}
        >
          <p className="text-sm text-muted-foreground text-pretty">
            Não há nada a criar. Comissões, matrícula e registros profissionais são
            gerenciados na página da pessoa.
          </p>
          {canOpenPersonPage ? (
            <Button asChild className="self-start">
              <Link href={orgHref(org, "manage", "usuarios", person.userId)}>
                Abrir a página de {displayName}
              </Link>
            </Button>
          ) : null}
          {isOrgAdmin && affiliableHospitals.length > 1 ? (
            <HospitalPicker
              field={hospitalField}
              hospitals={affiliableHospitals}
              value={targetHospitalId}
              onChange={setTargetHospitalId}
              person={person}
              label="Vincular a outro hospital"
            />
          ) : null}
        </OutcomePanel>
      ) : (
        /* Outcome B — registered here, not employed at the target hospital yet. */
        <OutcomePanel
          tone="accent"
          icon={<Link2 aria-hidden="true" className="size-5 shrink-0" />}
          title={
            affiliationNames.length > 0
              ? `${displayName} já está cadastrado em ${organizationName} (${affiliationNames.join(
                  ", ",
                )}).`
              : `${displayName} já está cadastrado em ${organizationName}, sem vínculo hospitalar ativo.`
          }
          delay="60ms"
          headingRef={focusOutcomeHeading}
        >
          <p className="text-sm text-pretty">
            {targetHospital
              ? `Vincular ao ${targetHospital.name}?`
              : "Escolha o hospital ao qual vincular esta pessoa."}
          </p>

          {affiliationError ? (
            <FormBanner tone="error">{affiliationError}</FormBanner>
          ) : null}

          <div className="flex flex-col gap-4">
            {lockedHospital ? (
              <Field>
                <FieldLabel>Hospital</FieldLabel>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Building2
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  {lockedHospital.name}
                </p>
              </Field>
            ) : (
              <HospitalPicker
                field={hospitalField}
                hospitals={affiliableHospitals}
                value={targetHospitalId}
                onChange={setTargetHospitalId}
                person={person}
                label="Hospital"
              />
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
                Identificador funcional neste hospital. Cada vínculo tem a sua — a
                matrícula pertence ao emprego, não à pessoa.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={startedOnField.controlProps.id}>
                Início do vínculo (opcional)
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
            type="button"
            size="lg"
            className="self-start"
            disabled={isAffiliating || !targetHospitalId}
            onClick={handleAffiliate}
          >
            <Link2 aria-hidden="true" />
            {isAffiliating
              ? "Vinculando…"
              : targetHospital
                ? `Vincular ao ${targetHospital.name}`
                : "Vincular"}
          </Button>
        </OutcomePanel>
      )}
    </div>
  );
}

/** The "you searched X" strip, with the way back to the identifier step. */
function SearchedCpfSummary({
  cpf,
  onRestart,
}: {
  cpf: string;
  onRestart: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        CPF consultado:{" "}
        <span className="font-mono font-medium text-foreground">
          {formatCpf(cpf)}
        </span>
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Buscar outro CPF
      </button>
    </div>
  );
}

/**
 * The outcome card. Status is carried by icon + heading + border tone together, never
 * by colour alone (design system §6). The heading is the focus target for the step
 * change, so it is programmatically focusable and shows a focus ring when reached.
 */
function OutcomePanel({
  tone,
  icon,
  title,
  delay,
  headingRef,
  children,
}: {
  tone: "accent" | "success" | "warning";
  icon: React.ReactNode;
  title: string;
  delay: string;
  headingRef: (node: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const headingId = useId();
  const toneClass = {
    accent: "border-primary/30 bg-accent/40 text-primary",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
  }[tone];

  return (
    <section
      aria-labelledby={headingId}
      className={`animate-rise-in flex flex-col gap-4 rounded-2xl border p-6 shadow-xs sm:p-7 ${toneClass}`}
      style={{ ["--rise-delay" as string]: delay }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="rounded-md text-base font-semibold text-balance text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-4 text-foreground">{children}</div>
    </section>
  );
}

/** Hospital chooser for an `org_admin`, flagging the ones already linked. */
function HospitalPicker({
  field,
  hospitals,
  value,
  onChange,
  person,
  label,
}: {
  field: ReturnType<typeof useFieldIds>;
  hospitals: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  person: OrgPerson;
  label: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={field.controlProps.id}>{label}</FieldLabel>
      <NativeSelect
        {...field.controlProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Selecione um hospital
        </option>
        {hospitals.map((h) => {
          const linked = person.affiliations.some((a) => a.hospitalId === h.id);
          return (
            <option key={h.id} value={h.id}>
              {linked ? `${h.name} (já vinculado)` : h.name}
            </option>
          );
        })}
      </NativeSelect>
    </Field>
  );
}
