"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addInterviewInterviewer,
  updateInterviewInterviewer,
  type ActionState,
  type AddInterviewerState,
  type InterviewInterviewerInput,
} from "@/lib/interviews/actions";
import type {
  InterviewInterviewer,
  InterviewerRole,
} from "@/lib/queries/interviews";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import {
  INTERVIEWER_ROLE_LABEL,
  INTERVIEWER_ROLE_ORDER,
} from "./interview-labels";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A platform-member option for the picker (already filtered to non-interviewers on add). */
export interface InterviewerMemberOption {
  userId: string;
  name: string;
}

type Kind = "member" | "external";

/**
 * Add / edit an interviewer: a platform MEMBER (picked from the roster) XOR an
 * external fallback (free-text name + org), each with a FIXED committee role. A
 * registered (member) interviewer must be a member of the commission (HC021,
 * enforced server-side) and gains row-level write on the interview. On edit the
 * kind is fixed; on add a toggle chooses.
 */
export function InterviewerForm({
  mode,
  open,
  onOpenChange,
  interviewId,
  interviewer,
  members,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  /** Required for `edit`. */
  interviewer?: InterviewInterviewer;
  /** Members available to add (already excludes those already added, on create). */
  members: InterviewerMemberOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<
    (AddInterviewerState & ActionState) | null
  >(null);

  const initialKind: Kind =
    mode === "edit" && interviewer && interviewer.userId == null
      ? "external"
      : "member";
  const [kind, setKind] = useState<Kind>(initialKind);
  const [userId, setUserId] = useState(interviewer?.userId ?? "");
  const [externalName, setExternalName] = useState(
    interviewer?.externalName ?? "",
  );
  const [externalOrg, setExternalOrg] = useState(
    interviewer?.externalOrg ?? "",
  );
  const [role, setRole] = useState<InterviewerRole>(
    interviewer?.role ?? "entrevistador",
  );
  const [note, setNote] = useState(interviewer?.note ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setKind(initialKind);
      setUserId(interviewer?.userId ?? "");
      setExternalName(interviewer?.externalName ?? "");
      setExternalOrg(interviewer?.externalOrg ?? "");
      setRole(interviewer?.role ?? "entrevistador");
      setNote(interviewer?.note ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  const lockKind = mode === "edit";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isExternal = kind === "external";
    const input: InterviewInterviewerInput = {
      userId: isExternal ? null : userId || null,
      externalName: isExternal ? externalName.trim() || null : null,
      externalOrg: isExternal ? externalOrg.trim() || null : null,
      role,
      note: note.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await addInterviewInterviewer(interviewId, input)
          : await updateInterviewInterviewer(interviewer!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Adicionar entrevistador"
              : "Editar entrevistador"}
          </DialogTitle>
          <DialogDescription>
            Adicione um membro da comissão ou um entrevistador externo, e defina
            sua função. Um membro registrado poderá editar esta entrevista.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          {!lockKind && (
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <legend className="font-medium">Tipo de entrevistador</legend>
              <div className="flex gap-1.5">
                {(
                  [
                    ["member", "Membro da comissão"],
                    ["external", "Externo"],
                  ] as const
                ).map(([k, label]) => {
                  const selected = kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setKind(k)}
                      className={
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none " +
                        (selected
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border text-muted-foreground hover:text-foreground")
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {kind === "member" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Membro</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                disabled={lockKind}
                className={FIELD_CLASS}
              >
                <option value="" disabled>
                  Selecione um membro…
                </option>
                {mode === "edit" && interviewer?.userId && (
                  <option value={interviewer.userId}>
                    {interviewer.displayName ?? "Membro"}
                  </option>
                )}
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Nome do entrevistador</span>
                <input
                  type="text"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  required
                  className={FIELD_CLASS}
                  placeholder="Ex.: Dr. Paulo Mendes"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">
                  Organização{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </span>
                <input
                  type="text"
                  value={externalOrg}
                  onChange={(e) => setExternalOrg(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="Ex.: Hospital parceiro"
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Função</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as InterviewerRole)}
              className={FIELD_CLASS}
            >
              {INTERVIEWER_ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {INTERVIEWER_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Observação{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Ex.: conduziu a primeira parte"
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Adicionar"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
