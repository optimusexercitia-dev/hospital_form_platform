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
 * Why the regimento picker is (or is not) offering a choice. A three-member union
 * rather than a boolean, because the two non-picker cases need DIFFERENT copy and
 * arise for unrelated reasons — collapsing them would tell a coordinator whose
 * tenant simply has the module switched off to go and create a document, in an
 * area that 404s for them.
 *
 * - `available`   — options exist; render the select.
 * - `empty`       — the controlled-documents module is ON, but this commission has
 *                   no `bylaws` document yet. The fix is to create one.
 * - `unavailable` — the module is OFF for this tenant (DM3 lead ruling Q6). There
 *                   is nothing the coordinator can do here, so the copy says so
 *                   instead of pointing at an action.
 */
export type RegimentoPickerState = "available" | "empty" | "unavailable";

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
  pickerState,
}: {
  action: SaveAction;
  commissionId: string;
  org: string;
  commission: string;
  initialFrequency: MeetingFrequency | null;
  initialDocId: string | null;
  regimentoOptions: RegimentoOption[];
  /** Why the picker is or is not offering a choice — see {@link RegimentoPickerState}. */
  pickerState: RegimentoPickerState;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

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
        {pickerState === "available" ? (
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
            {/* No picker is rendered, so the user cannot have CHANGED the link —
                post the CURRENT value back, not an empty one.

                This upholds the invariant stated at the top of this file ("changing
                the frequency never drops the regimento link"), which a hardcoded ""
                broke in two reachable ways: (1) with the module off (DM3 Q6), every
                cadence save would silently unlink an existing regimento; and (2)
                even with it on, a link whose document is not in the filtered list
                would be cleared by a save the coordinator never aimed at it. The
                FK is ON DELETE SET NULL, so a non-null id here always names a row
                that still exists — echoing it back cannot resurrect a dead one. */}
            <input
              type="hidden"
              name="controlledDocumentId"
              value={initialDocId ?? ""}
            />
            <FieldDescription id="controlledDocumentId-description">
              {pickerState === "unavailable"
                ? "O módulo de documentos controlados não está ativo nesta instituição, portanto não é possível vincular um regimento no momento. A periodicidade continua sendo salva normalmente."
                : "Nenhum regimento controlado foi cadastrado nesta comissão ainda. Crie um em “Documento do regimento” para poder vinculá-lo."}
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
