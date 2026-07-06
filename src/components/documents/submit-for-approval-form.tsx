"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, UserPlus, X } from "lucide-react";

import type { ApproverCandidate } from "@/lib/queries/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import type { ActionState } from "@/lib/documents/actions";

type SubmitAction = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

/** A chosen approver — the candidate id plus an editable title override. */
interface ChosenApprover {
  approverId: string;
  approverTitle: string;
}

/**
 * Submit-for-approval form (Phase 17, F3). Names 1..n approvers for a `rascunho`
 * version, then submits — moving it to `em_aprovacao` and freezing the approver
 * set (changing it later means re-submit). Each approver is any active
 * same-hospital user (from `listApproverCandidates`, so the picker may include
 * users OUTSIDE this commission).
 *
 * The chosen approvers serialize to a single hidden `approvers` JSON field (the
 * indicators `derivedConfig` pattern) that `submitDocumentForApproval` parses. The
 * action is passed in as a prop (never value-imported).
 */
export function SubmitForApprovalForm({
  documentVersionId,
  candidates,
  action,
}: {
  documentVersionId: string;
  candidates: ApproverCandidate[];
  action: SubmitAction;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [chosen, setChosen] = useState<ChosenApprover[]>([]);
  const [pickId, setPickId] = useState("");
  const doneRef = useRef(false);

  const candidateById = useMemo(() => {
    const map = new Map<string, ApproverCandidate>();
    for (const c of candidates) map.set(c.id, c);
    return map;
  }, [candidates]);

  const available = candidates.filter(
    (c) => !chosen.some((ch) => ch.approverId === c.id),
  );

  useEffect(() => {
    if (state?.ok && !doneRef.current) {
      doneRef.current = true;
      router.refresh();
    }
  }, [state, router]);

  function addApprover(id: string) {
    if (!id) return;
    const candidate = candidateById.get(id);
    if (!candidate) return;
    setChosen((prev) => [
      ...prev,
      { approverId: id, approverTitle: candidate.title ?? "" },
    ]);
    setPickId("");
  }

  function removeApprover(id: string) {
    setChosen((prev) => prev.filter((c) => c.approverId !== id));
  }

  function setTitle(id: string, title: string) {
    setChosen((prev) =>
      prev.map((c) => (c.approverId === id ? { ...c, approverTitle: title } : c)),
    );
  }

  // Serialize to the JSON blob the action expects; trim empty titles to null.
  const approversJson = JSON.stringify(
    chosen.map((c) => ({
      approverId: c.approverId,
      approverTitle: c.approverTitle.trim() || null,
    })),
  );

  const canSubmit = chosen.length > 0 && !pending;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <input type="hidden" name="versionId" value={documentVersionId} />
      <input type="hidden" name="approvers" value={approversJson} />

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Enviar para aprovação</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Indique quem deve assinar esta versão. Todos os aprovadores precisam
          aprovar antes da publicação. Depois de enviado, a lista de aprovadores
          fica bloqueada.
        </p>
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      {candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum usuário do hospital está disponível como aprovador.
        </p>
      ) : (
        <Field>
          <FieldLabel htmlFor="approver-pick">Adicionar aprovador</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              id="approver-pick"
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              className="min-w-56 flex-1"
              disabled={available.length === 0}
            >
              <option value="">
                {available.length === 0
                  ? "Todos os aprovadores já foram adicionados"
                  : "Selecione um usuário"}
              </option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.title ? ` — ${c.title}` : ""}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => addApprover(pickId)}
              disabled={!pickId}
            >
              <UserPlus aria-hidden="true" className="size-4" />
              Adicionar
            </Button>
          </div>
          <FieldDescription>
            O aprovador pode ser de qualquer comissão do hospital.
          </FieldDescription>
          <FieldError>{state?.fieldErrors?.approvers}</FieldError>
        </Field>
      )}

      {chosen.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {chosen.map((c) => {
            const candidate = candidateById.get(c.approverId);
            return (
              <li
                key={c.approverId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
              >
                <span className="font-medium">
                  {candidate?.name ?? "Aprovador"}
                </span>
                <label className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
                  <span className="sr-only">
                    Cargo de {candidate?.name ?? "aprovador"}
                  </span>
                  <Input
                    value={c.approverTitle}
                    onChange={(e) => setTitle(c.approverId, e.target.value)}
                    placeholder="Cargo (opcional)"
                    aria-label={`Cargo de ${candidate?.name ?? "aprovador"}`}
                    className="h-9 max-w-56"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeApprover(c.approverId)}
                  aria-label={`Remover ${candidate?.name ?? "aprovador"}`}
                >
                  <X aria-hidden="true" className="size-4" />
                  Remover
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div>
        <Button type="submit" size="lg" disabled={!canSubmit}>
          <Send aria-hidden="true" className="size-4" />
          {pending ? "Enviando…" : "Enviar para aprovação"}
        </Button>
      </div>
    </form>
  );
}
