"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";

import {
  createCaseFromTemplate,
  type CreateCaseState,
} from "@/lib/cases/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormBanner } from "@/components/auth/form-banner";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

interface TemplateOption {
  id: string;
  title: string;
}

/**
 * "Novo caso" create flow. Mints a case from a published process template
 * (snapshotting its phases + pinning published versions). On success the action
 * returns the new `{ caseId }` and we navigate into the case detail.
 *
 * The optional label carries a prominent pt-BR PII warning (guardrail 2): a case
 * is identified by its minted NUMBER; the label must NOT contain patient
 * identifiers (name, prontuário/MRN, data de nascimento, etc.). This is guidance
 * + a reminder — the platform never stores patient data by design.
 */
export function CreateCaseDialog({
  slug,
  templates,
}: {
  slug: string;
  templates: TemplateOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    CreateCaseState | undefined,
    FormData
  >(createCaseFromTemplate, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.caseId) {
      router.push(`/c/${slug}/manage/cases/${state.caseId}`);
    }
  }, [state, router, slug]);

  const labelField = useFieldIds("label", { hasDescription: true });
  const disabled = templates.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" disabled={disabled}>
          <Plus aria-hidden="true" />
          Novo caso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo caso</DialogTitle>
          <DialogDescription>
            Crie um caso a partir de um processo publicado. As fases do processo
            serão copiadas para o caso no estado atual.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.templateId && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Processo</span>
            <select
              name="templateId"
              className={SELECT_CLASS}
              required
              defaultValue=""
              aria-invalid={state?.fieldErrors?.templateId ? true : undefined}
            >
              <option value="" disabled>
                Selecione um processo…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.templateId && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.templateId}
              </span>
            )}
          </label>

          <Field>
            <FieldLabel htmlFor={labelField.controlProps.id}>
              Rótulo{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </FieldLabel>
            <Input
              {...labelField.controlProps}
              type="text"
              placeholder="Ex.: Óbito UTI leito 7"
              maxLength={120}
            />
            <FieldDescription id={labelField.descriptionId}>
              Uma referência curta e não identificável para você localizar o caso.
            </FieldDescription>
          </Field>

          {/* PII warning — prominent, role=note, never color-only. */}
          <p
            role="note"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive text-pretty"
          >
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Não inclua dados de paciente no rótulo (nome, prontuário, data de
              nascimento ou qualquer identificador). O caso é identificado pelo seu
              número.
            </span>
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Criando…" : "Criar caso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
