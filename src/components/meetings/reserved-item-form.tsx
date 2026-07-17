"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderLock, Users } from "lucide-react";

import {
  addReservedItem,
  type ActionState,
  type ReservedItemInput,
} from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { LinkableCase } from "./case-linker";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A commission member who may be named as a reader of a case-less reserved item. */
export interface ReaderOption {
  userId: string;
  name: string;
}

function formatCaseNumber(n: number): string {
  return `Caso ${String(n).padStart(4, "0")}`;
}

/** Whether the item is tied to a case (visibility follows the case) or stands alone (explicit readers). */
type LinkMode = "case" | "readers";

/**
 * Add one item to an OPEN reserved (closed) session — coordinator-only authoring
 * (ADR 0078 Stage C). The item is either:
 *  - CASE-LINKED — its confidential substance/decision is visible to whoever may
 *    already read that case (the server projects each field to the caller's tier);
 *    the coordinator may also record members who declared an impediment.
 *  - CASE-LESS — visible only to an explicit reader list plus the coordination.
 *
 * The `add_reserved_item` RPC is the real gate (coordinator-only, case↔commission
 * match, recused-coordinator deny); this form surfaces its pt-BR error cleanly and
 * never leaks a raw Postgres string.
 */
export function ReservedItemForm({
  open,
  onOpenChange,
  sessionId,
  cases,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  /** Cases of this commission the coordinator may link (already excludes restricted). */
  cases: LinkableCase[];
  /** The commission roster, for the case-less reader list. */
  members: ReaderOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<(ActionState & { itemId?: string }) | null>(
    null,
  );

  const [mode, setMode] = useState<LinkMode>("case");
  const [caseId, setCaseId] = useState("");
  const [substance, setSubstance] = useState("");
  const [decision, setDecision] = useState("");
  const [withdrawals, setWithdrawals] = useState("");
  const [quorumMet, setQuorumMet] = useState(true);
  const [readerUids, setReaderUids] = useState<string[]>([]);

  // Reset the form each time it opens (mirrors AgendaItemForm / CaseLinker).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setMode(cases.length > 0 ? "case" : "readers");
      setCaseId("");
      setSubstance("");
      setDecision("");
      setWithdrawals("");
      setQuorumMet(true);
      setReaderUids([]);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  const caseMissing = mode === "case" && !caseId;

  function toggleReader(userId: string, checked: boolean) {
    setReaderUids((prev) =>
      checked ? [...prev, userId] : prev.filter((id) => id !== userId),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (caseMissing) return;
    const input: ReservedItemInput =
      mode === "case"
        ? {
            caseId,
            substance: substance.trim() || null,
            decision: decision.trim() || null,
            withdrawals: withdrawals.trim() || null,
            quorumMet,
          }
        : {
            caseId: null,
            substance: substance.trim() || null,
            decision: decision.trim() || null,
            quorumMet,
            readerUids,
          };
    startTransition(async () => {
      const result = await addReservedItem(sessionId, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar item reservado</DialogTitle>
          <DialogDescription>
            Registre um ponto tratado a portas fechadas. O que você escrever aqui
            só é revelado a quem tem autorização — os demais veem apenas que houve
            um item reservado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Vínculo do item</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                  mode === "case"
                    ? "border-primary/40 bg-accent/60"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="reserved-link-mode"
                  value="case"
                  checked={mode === "case"}
                  onChange={() => setMode("case")}
                  className="mt-0.5 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <FolderLock aria-hidden="true" className="size-3.5" />
                    Vinculado a um caso
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Visível a quem já pode ler o caso.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                  mode === "readers"
                    ? "border-primary/40 bg-accent/60"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="reserved-link-mode"
                  value="readers"
                  checked={mode === "readers"}
                  onChange={() => setMode("readers")}
                  className="mt-0.5 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users aria-hidden="true" className="size-3.5" />
                    Sem caso (lista de leitores)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Visível apenas aos leitores escolhidos.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {mode === "case" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Caso</span>
              <NativeSelect
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                required
                className="py-2"
                aria-invalid={caseMissing && state ? true : undefined}
              >
                <option value="" disabled>
                  Selecione um caso…
                </option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatCaseNumber(c.caseNumber)}
                    {c.label ? ` — ${c.label}` : ""}
                  </option>
                ))}
              </NativeSelect>
              {cases.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Nenhum caso desta comissão disponível para vincular.
                </span>
              )}
            </label>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">
                Leitores autorizados{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </legend>
              <p className="text-xs text-muted-foreground">
                Apenas os membros marcados poderão ler este item. A coordenação
                não tem acesso automático — adicione seu próprio nome à lista
                para manter o acesso.
              </p>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhum membro disponível.
                </p>
              ) : (
                <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-xl border border-border p-2">
                  {members.map((m) => {
                    const id = `reserved-reader-${m.userId}`;
                    const checked = readerUids.includes(m.userId);
                    return (
                      <li key={m.userId}>
                        <label
                          htmlFor={id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(v) =>
                              toggleReader(m.userId, v === true)
                            }
                          />
                          <span className="truncate">{m.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Substância{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={substance}
              onChange={(e) => setSubstance(e.target.value)}
              rows={3}
              className={FIELD_CLASS}
              placeholder="O que foi discutido a portas fechadas…"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Decisão{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              rows={2}
              className={FIELD_CLASS}
              placeholder="A deliberação ou encaminhamento…"
            />
          </label>

          {mode === "case" && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Impedimentos declarados{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <textarea
                value={withdrawals}
                onChange={(e) => setWithdrawals(e.target.value)}
                rows={2}
                className={FIELD_CLASS}
                placeholder="Membros que se declararam impedidos e se retiraram…"
              />
            </label>
          )}

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              id="reserved-quorum-met"
              checked={quorumMet}
              onCheckedChange={(v) => setQuorumMet(v === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Quórum mantido</span>
              <span className="text-xs text-muted-foreground">
                O quórum permaneceu durante esta parte reservada.
              </span>
            </span>
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
            <Button type="submit" size="lg" disabled={isPending || caseMissing}>
              {isPending ? "Adicionando…" : "Adicionar item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
