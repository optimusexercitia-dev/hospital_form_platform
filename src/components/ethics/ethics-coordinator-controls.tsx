"use client";

import { useState } from "react";
import { ShieldCheck, EyeOff, UserMinus, TriangleAlert } from "lucide-react";

import {
  declareConflict,
  recordRecusal,
  setCaseConfidentiality,
  setCaseVisibility,
} from "@/lib/case-recusals/actions";
import type {
  CaseConfidentialityLevel,
  ConflictType,
  VisibilityPolicy,
} from "@/lib/queries/cases";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";

import { EthicsSection } from "./ethics-section";
import { useEthicsAction } from "./use-ethics-action";
import {
  CONFIDENTIALITY_LEVEL_LABELS,
  CONFIDENTIALITY_LEVEL_OPTIONS,
  CONFLICT_TYPE_OPTIONS,
  VISIBILITY_POLICY_LABELS,
  VISIBILITY_POLICY_OPTIONS,
} from "./ethics-labels";

interface MemberOption {
  userId: string;
  name: string;
}

/**
 * The ethics coordinator controls (ETH·E2 Part 1 — AUTHZ handoff decision 8). Wires
 * the live coordinator doors in `src/lib/case-recusals/actions.ts`: the case
 * confidentiality ceiling, the case visibility model, a self conflict-of-interest
 * declaration, and recording a member recusal. Every mutation routes through a
 * SECURITY DEFINER RPC (RLS is the boundary — Rule 1); this UI only offers the
 * affordance and surfaces the door's pt-BR error, then refreshes.
 *
 * Lifting a recusal + the live-recusal roster live in {@link
 * import('./ethics-recusal-roster').EthicsRecusalRoster}, which reads the
 * coordinator recusal list (`listCaseRecusals`) — kept separate so this panel needs
 * no roster read.
 */
export function EthicsCoordinatorControls({
  caseId,
  confidentialityLevel,
  visibilityPolicy,
  members,
}: {
  caseId: string;
  confidentialityLevel: CaseConfidentialityLevel;
  visibilityPolicy: VisibilityPolicy;
  members: MemberOption[];
}) {
  return (
    <EthicsSection
      id="ethics-coordinator"
      title="Controles da coordenação"
      description="Gerencie o sigilo, o modelo de acesso, os conflitos de interesse e os impedimentos deste processo ético. Cada ação é registrada e auditada."
    >
      <div className="flex flex-col gap-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" />
              <dt className="text-sm font-medium">Confidencialidade</dt>
            </div>
            <dd className="text-sm text-muted-foreground">
              {CONFIDENTIALITY_LEVEL_LABELS[confidentialityLevel]}
            </dd>
            <ConfidentialityDialog caseId={caseId} current={confidentialityLevel} />
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4">
            <div className="flex items-center gap-2">
              <EyeOff aria-hidden="true" className="size-4 text-muted-foreground" />
              <dt className="text-sm font-medium">Modelo de acesso</dt>
            </div>
            <dd className="text-sm text-muted-foreground">
              {VISIBILITY_POLICY_LABELS[visibilityPolicy]}
            </dd>
            <VisibilityDialog caseId={caseId} current={visibilityPolicy} />
          </div>
        </dl>

        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <h3 className="text-sm font-medium">Impedimentos e conflitos de interesse</h3>
          <div className="flex flex-wrap gap-2">
            <DeclareConflictDialog caseId={caseId} />
            <RecordRecusalDialog caseId={caseId} members={members} />
          </div>
          <p className="text-xs text-muted-foreground">
            O membro impedido perde imediatamente o acesso ao processo e fica
            excluído da votação. Os impedimentos ativos e a reversão ficam abaixo, em
            &ldquo;Impedimentos do processo&rdquo;.
          </p>
        </div>
      </div>
    </EthicsSection>
  );
}

// ---------------------------------------------------------------------------
// Confidentiality ceiling
// ---------------------------------------------------------------------------

function ConfidentialityDialog({
  caseId,
  current,
}: {
  caseId: string;
  current: CaseConfidentialityLevel;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<CaseConfidentialityLevel>(current);
  const { run, isPending, error, clearError } = useEthicsAction();
  const { controlProps } = useFieldIds("ethics-confidentiality");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLevel(current);
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg" className="mt-1 w-fit">
          Alterar sigilo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar confidencialidade</DialogTitle>
          <DialogDescription>
            Define o teto de sigilo do caso. Documentos acima do nível escolhido
            deixam de ser visíveis a quem não tem a devida habilitação.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={controlProps.id}>Nível de confidencialidade</FieldLabel>
          <NativeSelect
            {...controlProps}
            value={level}
            disabled={isPending}
            onChange={(e) => setLevel(e.target.value as CaseConfidentialityLevel)}
          >
            {CONFIDENTIALITY_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isPending || level === current}
            onClick={() =>
              run(() => setCaseConfidentiality(caseId, level), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Salvando…" : "Aplicar sigilo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Visibility policy
// ---------------------------------------------------------------------------

function VisibilityDialog({
  caseId,
  current,
}: {
  caseId: string;
  current: VisibilityPolicy;
}) {
  const [open, setOpen] = useState(false);
  const [policy, setPolicy] = useState<VisibilityPolicy>(current);
  const { run, isPending, error, clearError } = useEthicsAction();
  const { controlProps } = useFieldIds("ethics-visibility");
  const willRestrict =
    policy === "explicit_grants_only" && current !== "explicit_grants_only";

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPolicy(current);
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg" className="mt-1 w-fit">
          Alterar acesso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar modelo de acesso</DialogTitle>
          <DialogDescription>
            Define quem enxerga o processo: todos os membros da comissão ou apenas
            quem recebeu concessão explícita de acesso.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={controlProps.id}>Modelo de acesso</FieldLabel>
          <NativeSelect
            {...controlProps}
            value={policy}
            disabled={isPending}
            onChange={(e) => setPolicy(e.target.value as VisibilityPolicy)}
          >
            {VISIBILITY_POLICY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {willRestrict && (
          <FormBanner tone="info">
            Ao restringir o acesso, os membros sem concessão explícita deixarão de
            ver este processo imediatamente.
          </FormBanner>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isPending || policy === current}
            onClick={() =>
              run(() => setCaseVisibility(caseId, policy), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Salvando…" : "Aplicar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Declare conflict of interest (self-service)
// ---------------------------------------------------------------------------

function DeclareConflictDialog({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [conflictType, setConflictType] = useState<ConflictType>(
    CONFLICT_TYPE_OPTIONS[0].value,
  );
  const [description, setDescription] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const typeIds = useFieldIds("ethics-conflict-type");
  const descIds = useFieldIds("ethics-conflict-description");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setConflictType(CONFLICT_TYPE_OPTIONS[0].value);
      setDescription("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <TriangleAlert aria-hidden="true" />
          Declarar conflito
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declarar conflito de interesse</DialogTitle>
          <DialogDescription>
            Registre um conflito de interesse seu neste processo. A coordenação pode
            então avaliar a necessidade de impedimento.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={typeIds.controlProps.id}>Tipo de conflito</FieldLabel>
          <NativeSelect
            {...typeIds.controlProps}
            value={conflictType}
            disabled={isPending}
            onChange={(e) => setConflictType(e.target.value as ConflictType)}
          >
            {CONFLICT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={descIds.controlProps.id}>Descrição</FieldLabel>
          <Textarea
            {...descIds.controlProps}
            value={description}
            disabled={isPending}
            maxLength={2000}
            placeholder="Descreva a natureza do conflito."
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isPending || description.trim().length === 0}
            onClick={() =>
              run(() => declareConflict(caseId, conflictType, description.trim()), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Registrando…" : "Registrar conflito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Record a member recusal
// ---------------------------------------------------------------------------

function RecordRecusalDialog({
  caseId,
  members,
}: {
  caseId: string;
  members: MemberOption[];
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const memberIds = useFieldIds("ethics-recusal-member");
  const reasonIds = useFieldIds("ethics-recusal-reason");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setUserId("");
      setReason("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <UserMinus aria-hidden="true" />
          Registrar impedimento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar impedimento</DialogTitle>
          <DialogDescription>
            O membro impedido perde imediatamente o acesso ao processo e fica
            excluído da votação. Esta ação é registrada e auditada.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={memberIds.controlProps.id}>Membro</FieldLabel>
          <NativeSelect
            {...memberIds.controlProps}
            value={userId}
            disabled={isPending}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Selecione um membro…</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={reasonIds.controlProps.id}>Motivo</FieldLabel>
          <Textarea
            {...reasonIds.controlProps}
            value={reason}
            disabled={isPending}
            maxLength={2000}
            placeholder="Motivo do impedimento."
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isPending || userId === "" || reason.trim().length === 0}
            onClick={() =>
              run(() => recordRecusal(caseId, userId, reason.trim()), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Registrando…" : "Registrar impedimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
