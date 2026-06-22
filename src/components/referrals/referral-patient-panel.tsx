"use client";

import { useState, useTransition } from "react";
import { Eye, Network, ShieldAlert } from "lucide-react";

import {
  REFERRAL_PATIENT_SEX_LABELS,
  type ReferralPatient,
} from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { formatDate } from "./format";

/**
 * The LAZY, AUDITED isolated-PHI panel on the B-side referral detail (Decision
 * 16; Rule 12). Direct SELECT on `referral_patient` is REVOKED; the only door is
 * the audited `revealReferralPatient` server action, which re-gates the tight
 * `can_read_referral_phi` predicate and emits a `referral_patient.read` audit row
 * SERVER-SIDE. So we load ON CLICK — never on page open — so the audited read
 * fires exactly when a reader chooses to see the identifiers.
 *
 * The reveal call is injected as a prop (`onReveal`) bound by the Server detail
 * page to `() => revealReferralPatient(referralId)`, keeping this client component
 * free of any server-only import (Rule 9 / the client-bundle boundary).
 *
 * Access nuance (plan): PHI is coordinator/QPS-gated until B links a case +
 * assigns an analyst. So a plain member (pre-link) gets `null` back and NO audit
 * row — we render a calm "sem acesso" state, never a raw error. `hasPatient`
 * gates whether the panel renders at all (no record → a quiet empty state).
 *
 * Cross-record hint (Phase 23 — `patient_index`; ADR 0039): when the page can
 * resolve it, `appearsInCount` is the COUNT of OTHER records across the hospital
 * that share this patient — surfaced as a calm, NON-IDENTIFYING note (a number
 * only, never names or a list). It is gated server-side to referral-PHI-entitled
 * viewers (`can_read_referral_phi`); the page passes `0`/omits it otherwise, and
 * we render the note only when `> 0`.
 */
export function ReferralPatientPanel({
  hasPatient,
  onReveal,
  appearsInCount,
}: {
  /** Denormalized flag — an isolated PHI record exists. Gates the affordance. */
  hasPatient: boolean;
  /** The audited reveal door, bound by the page to the referral id. */
  onReveal: () => Promise<ReferralPatient | null>;
  /**
   * Phase 23: count of OTHER records sharing this patient across the hospital
   * (PHI-free; count only). Rendered as a calm note when `> 0`; omitted/`0` hides
   * it. Pre-resolved server-side (gated to referral-PHI-entitled viewers).
   */
  appearsInCount?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState(false);
  const [patient, setPatient] = useState<ReferralPatient | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reveal() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onReveal();
        setRevealed(true);
        if (result) {
          setPatient(result);
          setDenied(false);
        } else {
          // null = out of scope OR no record (the page only mounts this when
          // hasPatient, so null here means the caller isn't entitled yet).
          setPatient(null);
          setDenied(true);
        }
      } catch {
        setError(
          "Não foi possível carregar a identificação do paciente. Tente novamente.",
        );
      }
    });
  }

  // No isolated PHI record on this referral at all — quiet empty state.
  if (!hasPatient) {
    return (
      <section
        aria-labelledby="referral-patient-empty-heading"
        className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-5"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="referral-patient-empty-heading"
            className="text-base font-semibold"
          >
            Identificação do paciente
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhum dado de paciente registrado neste encaminhamento.
        </p>
      </section>
    );
  }

  const fields: { label: string; value: string | null }[] = patient
    ? [
        { label: "Nome", value: patient.name },
        { label: "Prontuário", value: patient.mrn },
        {
          label: "Data de nascimento",
          value: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null,
        },
        {
          label: "Idade",
          value: patient.ageYears != null ? `${patient.ageYears} anos` : null,
        },
        { label: "Sexo", value: REFERRAL_PATIENT_SEX_LABELS[patient.sex] },
        { label: "Atendimento / internação", value: patient.encounterRef },
        { label: "Unidade / setor", value: patient.unit },
        { label: "Profissional responsável", value: patient.attending },
      ].filter((f) => f.value)
    : [];

  return (
    <section
      aria-labelledby="referral-patient-heading"
      className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning/8 p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert aria-hidden="true" className="size-4 text-warning" />
        <h2 id="referral-patient-heading" className="text-base font-semibold">
          Identificação do paciente
        </h2>
        <span className="rounded-full border border-warning/30 bg-warning/12 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-warning uppercase">
          Dados sensíveis
        </span>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Acesso registrado em trilha de auditoria. Use apenas para a análise do
        encaminhamento (mínimo necessário).
      </p>

      {appearsInCount != null && appearsInCount > 0 && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-xl border border-primary/20 bg-accent/50 px-3.5 py-2.5 text-sm text-accent-foreground text-pretty"
        >
          <Network
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          <span>
            Este paciente aparece em {appearsInCount}{" "}
            {appearsInCount === 1 ? "outro registro" : "outros registros"} nesta
            instituição.
          </span>
        </p>
      )}

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {!revealed ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground text-pretty">
            Os dados do paciente estão protegidos. Ao exibir, o acesso será
            registrado em seu nome.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reveal}
            disabled={isPending}
          >
            <Eye aria-hidden="true" />
            {isPending ? "Carregando…" : "Exibir identificação"}
          </Button>
        </div>
      ) : denied ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground text-pretty">
          Você ainda não tem acesso à identificação do paciente deste
          encaminhamento. O acesso é liberado à coordenação e ao responsável pela
          análise após o caso ser vinculado.
        </p>
      ) : fields.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
          Registro de paciente sem identificadores informados.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {f.label}
              </dt>
              <dd className="text-sm text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
