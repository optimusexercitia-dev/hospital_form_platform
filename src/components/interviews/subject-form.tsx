"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addInterviewSubject,
  updateInterviewSubject,
  type ActionState,
  type AddSubjectState,
  type InterviewSubjectInput,
} from "@/lib/interviews/actions";
import type {
  InterviewSubject,
  RelationshipToCase,
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
import { NativeSelect } from "@/components/ui/native-select";
import {
  RELATIONSHIP_TO_CASE_LABEL,
  RELATIONSHIP_TO_CASE_ORDER,
} from "./interview-labels";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A platform-member option for the picker (already filtered to non-subjects on add). */
export interface SubjectMemberOption {
  userId: string;
  name: string;
}

type Kind = "member" | "external";

/**
 * Add / edit an interviewee (subject): a platform MEMBER (picked from the roster)
 * XOR an external person (free-text name). Both carry a FREE-TEXT clinical role
 * (e.g. "Enfermeira da UTI") — deliberately not an enum. On edit the kind is fixed
 * (you cannot turn a member into an external person); on add a toggle chooses.
 * **No patient data** — subjects are staff, never patients.
 */
export function SubjectForm({
  mode,
  open,
  onOpenChange,
  interviewId,
  subject,
  members,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  /** Required for `edit`. */
  subject?: InterviewSubject;
  /** Members available to add (already excludes those already added, on create). */
  members: SubjectMemberOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<(AddSubjectState & ActionState) | null>(
    null,
  );

  const initialKind: Kind =
    mode === "edit" && subject && subject.userId == null ? "external" : "member";
  const [kind, setKind] = useState<Kind>(initialKind);
  const [userId, setUserId] = useState(subject?.userId ?? "");
  const [externalName, setExternalName] = useState(subject?.externalName ?? "");
  const [relationship, setRelationship] = useState<RelationshipToCase | "">(
    subject?.relationshipToCase ?? "",
  );
  const [relationshipError, setRelationshipError] = useState(false);
  const [clinicalRole, setClinicalRole] = useState(subject?.clinicalRole ?? "");
  const [note, setNote] = useState(subject?.note ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setRelationshipError(false);
      setKind(initialKind);
      setUserId(subject?.userId ?? "");
      setExternalName(subject?.externalName ?? "");
      setRelationship(subject?.relationshipToCase ?? "");
      setClinicalRole(subject?.clinicalRole ?? "");
      setNote(subject?.note ?? "");
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
    if (!relationship) {
      setRelationshipError(true);
      return;
    }
    setRelationshipError(false);
    const isExternal = kind === "external";
    const input: InterviewSubjectInput = {
      userId: isExternal ? null : userId || null,
      externalName: isExternal ? externalName.trim() || null : null,
      relationshipToCase: relationship,
      clinicalRole: clinicalRole.trim() || null,
      note: note.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await addInterviewSubject(interviewId, input)
          : await updateInterviewSubject(subject!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Adicionar entrevistado" : "Editar entrevistado"}
          </DialogTitle>
          <DialogDescription>
            Registre o profissional entrevistado e sua função clínica. Nunca
            inclua dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          {!lockKind && (
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <legend className="font-medium">Tipo de entrevistado</legend>
              <div className="flex gap-1.5">
                {(
                  [
                    ["member", "Membro da comissão"],
                    ["external", "Profissional externo"],
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
              <NativeSelect
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                disabled={lockKind}
                className="h-10"
              >
                <option value="" disabled>
                  Selecione um membro…
                </option>
                {/* When editing, the current member may not be in `members`
                    (excluded as already-added), so include it. */}
                {mode === "edit" && subject?.userId && (
                  <option value={subject.userId}>
                    {subject.displayName ?? "Membro"}
                  </option>
                )}
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Nome do profissional</span>
              <input
                type="text"
                value={externalName}
                onChange={(e) => setExternalName(e.target.value)}
                required
                className={FIELD_CLASS}
                placeholder="Ex.: Dra. Ana Lima"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Relação com o caso</span>
            <NativeSelect
              value={relationship}
              onChange={(e) => {
                setRelationship(e.target.value as RelationshipToCase);
                setRelationshipError(false);
              }}
              required
              aria-invalid={relationshipError ? true : undefined}
              className="h-10"
            >
              <option value="" disabled>
                Selecione a relação com o caso…
              </option>
              {RELATIONSHIP_TO_CASE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {RELATIONSHIP_TO_CASE_LABEL[r]}
                </option>
              ))}
            </NativeSelect>
            {relationshipError && (
              <span role="alert" className="text-sm font-medium text-destructive">
                Selecione a relação do entrevistado com o caso.
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Função clínica{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              type="text"
              value={clinicalRole}
              onChange={(e) => setClinicalRole(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Ex.: Enfermeira da UTI"
            />
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
              placeholder="Ex.: estava de plantão no dia"
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
