"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";

import type { MeetingFrequency } from "@/lib/charters/types";
import { CHARTER_MESSAGES } from "@/lib/charters/messages";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { MEETING_FREQUENCY_LABELS } from "./labels";
// Type-only import of the server-action module — the action is passed in as a prop
// by the server page (the WizardRunner boundary pattern), so this client component
// never value-imports a `"use server"` module.
import type { CharterFormState } from "@/app/o/[org]/c/[commission]/manage/charter/actions";

type SaveAction = (
  prev: CharterFormState | undefined,
  formData: FormData,
) => Promise<CharterFormState>;

/** Ordered frequency values (ADR 0080 D4); labels resolved via {@link MEETING_FREQUENCY_LABELS}. */
const FREQUENCIES: MeetingFrequency[] = [
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
];

interface RegimentoOption {
  id: string;
  code: string;
  title: string;
}

/**
 * The charter configuration form (CH-FE-1). One native `<form>` posting the
 * meeting frequency + the linked-regimento id to the `saveCharter` server action
 * (the sole write door — `upsert_commission_charter`, staff_admin authority) via
 * `useActionState`. Both fields post together in a SINGLE upsert (the row is
 * `{frequency NOT NULL, controlled_document_id NULL}`), so changing the frequency
 * never drops the regimento link and vice-versa.
 *
 * Coordinator-only surface (the RPC is the authority; the page already gates the
 * route on staff_admin + the `charters` flag). Accessible: labelled controls,
 * keyboard-operable native selects with the platform focus ring, a polite success
 * region and an assertive error region. pt-BR (Rule 10); the action returns a
 * pt-BR-resolved message so raw Postgres text never reaches the UI.
 */
export function CharterForm({
  action,
  commissionId,
  org,
  commission,
  initialFrequency,
  initialDocId,
  regimentoOptions,
}: {
  action: SaveAction;
  commissionId: string;
  org: string;
  commission: string;
  initialFrequency: MeetingFrequency | null;
  initialDocId: string | null;
  regimentoOptions: RegimentoOption[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const hasRegimentoDocs = regimentoOptions.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="commissionId" value={commissionId} />
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="commission" value={commission} />

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      {state?.ok ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/12 px-4 py-3 text-sm font-medium text-success"
        >
          <CheckCircle2 aria-hidden="true" className="size-4" />
          {CHARTER_MESSAGES.charterSaved}
        </p>
      ) : null}

      <Field>
        <FieldLabel htmlFor="meetingFrequency">
          Periodicidade das reuniões
        </FieldLabel>
        <NativeSelect
          id="meetingFrequency"
          name="meetingFrequency"
          required
          defaultValue={initialFrequency ?? ""}
          aria-describedby="meetingFrequency-description"
        >
          {initialFrequency ? null : (
            <option value="" disabled>
              Selecione a periodicidade
            </option>
          )}
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {MEETING_FREQUENCY_LABELS[f]}
            </option>
          ))}
        </NativeSelect>
        <FieldDescription id="meetingFrequency-description">
          Define a janela de cadência usada para avaliar se a comissão está em dia
          com suas reuniões.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="controlledDocumentId">
          Regimento vinculado
        </FieldLabel>
        {hasRegimentoDocs ? (
          <>
            <NativeSelect
              id="controlledDocumentId"
              name="controlledDocumentId"
              defaultValue={initialDocId ?? ""}
              aria-describedby="controlledDocumentId-description"
            >
              <option value="">Nenhum</option>
              {regimentoOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.title}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription id="controlledDocumentId-description">
              Vincule o documento controlado do tipo Regimento desta comissão. Para
              criar um novo regimento, use o botão em “Documento do regimento”.
            </FieldDescription>
          </>
        ) : (
          <>
            {/* No regimento documents exist yet — post an explicit empty link so the
                upsert keeps the row's `controlled_document_id` NULL. */}
            <input type="hidden" name="controlledDocumentId" value="" />
            <FieldDescription id="controlledDocumentId-description">
              Nenhum regimento controlado foi cadastrado nesta comissão ainda. Crie
              um em “Documento do regimento” para poder vinculá-lo.
            </FieldDescription>
          </>
        )}
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : "Salvar configuração"}
        </Button>
      </div>
    </form>
  );
}
