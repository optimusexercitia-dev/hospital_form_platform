import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, ShieldCheck } from "lucide-react";

import { getOwnPersonRecord } from "@/lib/queries/own-person";
import { formatCouncilRegistration } from "@/lib/users/types";
import {
  CardFootnote,
  DefinitionRow,
  ProfileCard,
} from "@/components/users/profile-cards";
import {
  AffiliationStatusBadge,
  affiliationStatusOf,
} from "@/components/users/affiliation-status-badge";

export const metadata: Metadata = {
  title: "Meus dados",
};

/**
 * "Meus dados" — the personal self-record (F5, ADR 0151 D14). Read-only by design:
 * corrections are exercised administratively (ADR 0133 Amdt 1 r5's Art. 18 posture),
 * so this page carries NO edit controls and none should be added here.
 *
 * Reached through the self-only DEFINER door `get_own_person_record` — it keys on
 * `auth.uid()` alone, so there is no target parameter to get wrong. `/conta/layout.tsx`
 * already gates this whole area on `requireUser()`, so `null` (the door's "no session"
 * signal) is defensive rather than an expected branch here.
 *
 * ⚠ CPF ARRIVES ALREADY MASKED. `OwnPersonRecord.cpfMasked` is the only CPF field on
 * the type — there is no raw digit string to accidentally render, by construction.
 */
export default async function MeusDadosPage() {
  const record = await getOwnPersonRecord();
  if (!record) {
    notFound();
  }

  const displayName = record.fullName?.trim() || record.email || "Sem identificação";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1
          id="meus-dados-title"
          className="font-display text-2xl font-semibold tracking-tight text-balance"
        >
          Meus dados
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          O registro que a plataforma mantém sobre você: identidade, credenciais e
          vínculos. Esta página é apenas de leitura.
        </p>
      </header>

      <ProfileCard titleId="identidade-heading" title="Identidade">
        <dl className="flex flex-col gap-2 text-sm">
          <DefinitionRow label="Nome">{displayName}</DefinitionRow>
          <DefinitionRow label="E-mail">
            {record.email ?? "Não informado"}
          </DefinitionRow>
          <DefinitionRow label="Categoria profissional">
            {record.professionalCategory?.labelPt ?? "Não informada"}
          </DefinitionRow>
          <DefinitionRow label="CPF">
            {record.cpfMasked ?? "Não informado"}
          </DefinitionRow>
          <DefinitionRow label="Data de nascimento">
            {formatDateOnly(record.dateOfBirth)}
          </DefinitionRow>
          <DefinitionRow label="Telefone">
            {record.phone ?? "Não informado"}
          </DefinitionRow>
        </dl>
        <CardFootnote>
          Alguma informação incorreta? Correções de identidade são feitas pela
          administração da sua organização ou hospital, não diretamente aqui.
        </CardFootnote>
      </ProfileCard>

      <ProfileCard
        titleId="credenciais-heading"
        title="Registros profissionais"
        riseDelay="40ms"
      >
        {record.credentials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-pretty">
            Nenhum registro profissional cadastrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {record.credentials.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-4 py-3"
              >
                <span className="inline-flex items-center gap-1.5 font-mono text-[0.8rem] font-medium">
                  {formatCouncilRegistration(
                    c.issuingAuthority,
                    c.issuingState,
                    c.registrationNumber,
                  )}
                </span>
                {c.verifiedAt ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                    <BadgeCheck aria-hidden="true" className="size-3.5" />
                    Verificado
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Aguardando verificação
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </ProfileCard>

      <ProfileCard
        titleId="vinculos-heading"
        title="Vínculos hospitalares"
        caption="Onde você trabalha, com os dados que cada hospital mantém sobre o vínculo."
        riseDelay="80ms"
      >
        {record.affiliations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-pretty">
            Nenhum vínculo hospitalar registrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {record.affiliations.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-1 rounded-xl border border-border/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.84rem] font-semibold">
                    {a.hospitalName ?? "Hospital não identificado"}
                  </p>
                  <AffiliationStatusBadge status={affiliationStatusOf(a)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {[
                    a.jobTitle,
                    a.hospitalEmployeeId ? `Matrícula ${a.hospitalEmployeeId}` : null,
                  ]
                    .filter((p): p is string => Boolean(p))
                    .join(" · ") || "Sem cargo informado"}
                </p>
                {a.workEmail || a.workPhone ? (
                  <p className="text-xs text-muted-foreground">
                    {[a.workEmail, a.workPhone]
                      .filter((p): p is string => Boolean(p))
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ProfileCard>

      <ProfileCard
        titleId="organizacoes-heading"
        title="Organizações"
        riseDelay="120ms"
      >
        {record.orgAffiliations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-pretty">
            Nenhuma organização registrada.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {record.orgAffiliations.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-4 py-3"
              >
                <p className="text-[0.84rem] font-semibold">
                  {o.organizationName ?? "Organização não identificada"}
                </p>
                <AffiliationStatusBadge status={affiliationStatusOf(o)} />
              </li>
            ))}
          </ul>
        )}
        <CardFootnote>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
            Pertencer a uma organização não concede acesso por si só — o acesso vem
            das funções atribuídas a você nela.
          </span>
        </CardFootnote>
      </ProfileCard>
    </div>
  );
}

/**
 * `dateOfBirth` is a DATE column — parsed as LOCAL calendar parts, never as an
 * instant, matching `affiliations-panel.tsx`'s `formatDate`: reading a DATE column as
 * an instant shifts it a day west of UTC.
 */
function formatDateOnly(iso: string | null): string {
  if (!iso) return "Não informada";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(y, m - 1, d));
}
