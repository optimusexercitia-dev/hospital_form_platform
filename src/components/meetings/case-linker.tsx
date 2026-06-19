"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Link2, Lock, Plus } from "lucide-react";

import {
  linkMeetingCase,
  unlinkMeetingCase,
  type ActionState,
  type LinkCaseInput,
  type LinkCaseState,
} from "@/lib/meetings/actions";
import type {
  MeetingAgendaItem,
  MeetingCaseLink,
} from "@/lib/queries/meetings";
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
import { ConfirmDeleteButton } from "./confirm-delete-button";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A linkable commission case (id + number + non-identifying label). */
export interface LinkableCase {
  id: string;
  caseNumber: number;
  label: string | null;
}

function formatCaseNumber(n: number): string {
  return `Caso ${String(n).padStart(4, "0")}`;
}

function LinkCaseDialog({
  open,
  onOpenChange,
  meetingId,
  cases,
  agendaItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  cases: LinkableCase[];
  agendaItems: MeetingAgendaItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<(LinkCaseState & ActionState) | null>(null);

  const [caseId, setCaseId] = useState("");
  const [agendaItemId, setAgendaItemId] = useState("");
  const [summary, setSummary] = useState("");
  const [decision, setDecision] = useState("");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setCaseId("");
      setAgendaItemId("");
      setSummary("");
      setDecision("");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: LinkCaseInput = {
      caseId,
      agendaItemId: agendaItemId || null,
      summary: summary.trim() || null,
      decision: decision.trim() || null,
    };
    startTransition(async () => {
      const result = await linkMeetingCase(meetingId, input);
      setState(result);
    });
  }

  const ordered = [...agendaItems].sort((a, b) => a.position - b.position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular caso</DialogTitle>
          <DialogDescription>
            Vincule um caso desta comissão à reunião. Ao concluir a reunião, o
            vínculo será registrado na linha do tempo do caso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Caso</span>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              required
              className={FIELD_CLASS}
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
            </select>
          </label>

          {ordered.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Item de pauta{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <select
                value={agendaItemId}
                onChange={(e) => setAgendaItemId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Não vincular a um item</option>
                {ordered.map((a, i) => (
                  <option key={a.id} value={a.id}>
                    {i + 1}. {a.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Resumo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className={FIELD_CLASS}
              placeholder="O que foi discutido sobre este caso…"
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
              placeholder="A decisão ou encaminhamento…"
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
              {isPending ? "Vinculando…" : "Vincular caso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cases discussed panel (F3): the existing commission cases linked to this
 * meeting, with a per-link summary/decision and an optional attach to an agenda
 * item. staff_admin links/unlinks while the meeting is unlocked. The case is
 * identified by its NUMBER (never patient data).
 */
export function CaseLinker({
  meetingId,
  links,
  cases,
  agendaItems,
  canEdit,
  slug,
}: {
  meetingId: string;
  links: MeetingCaseLink[];
  /** Linkable commission cases (already excludes those already linked, computed here). */
  cases: LinkableCase[];
  agendaItems: MeetingAgendaItem[];
  canEdit: boolean;
  slug: string;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const linkedCaseIds = new Set(links.map((l) => l.caseId));
  const availableCases = cases.filter((c) => !linkedCaseIds.has(c.id));

  const agendaTitleById = new Map(agendaItems.map((a) => [a.id, a.title]));

  return (
    <section
      aria-labelledby="meeting-cases-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderOpen
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id="meeting-cases-heading" className="text-base font-semibold">
            Casos discutidos
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {links.length}
          </span>
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={availableCases.length === 0}
          >
            <Plus aria-hidden="true" />
            Vincular caso
          </Button>
        )}
      </div>

      {links.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhum caso vinculado. Vincule casos desta comissão discutidos na reunião."
            : "Nenhum caso vinculado."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {links.map((link) => {
            const agendaTitle = link.agendaItemId
              ? agendaTitleById.get(link.agendaItemId)
              : null;
            // A restricted link has no readable number; name it generically (the
            // junction row is still removable by a coordinator).
            const caseName =
              link.restricted || link.caseNumber == null
                ? "caso restrito"
                : formatCaseNumber(link.caseNumber);
            return (
              <li
                key={link.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {link.restricted ? (
                      // Case Access Control (ADR 0033, FE-7): the viewer may not read
                      // this linked case (the `cases` join was withheld by
                      // `can_read_case`). Show a muted chip instead of a broken
                      // "Caso 0" / a dead link to a 404.
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
                        <Lock aria-hidden="true" className="size-3" />
                        Caso restrito
                      </span>
                    ) : (
                      <a
                        href={`/c/${slug}/manage/cases/${link.caseId}`}
                        className="inline-flex items-center gap-1 font-mono text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        <Link2 aria-hidden="true" className="size-3" />
                        {caseName}
                      </a>
                    )}
                    {link.caseLabel && (
                      <span className="truncate text-sm text-foreground">
                        {link.caseLabel}
                      </span>
                    )}
                    {agendaTitle && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-medium text-secondary-foreground">
                        Pauta: {agendaTitle}
                      </span>
                    )}
                  </div>
                  {link.summary && (
                    <p className="text-xs text-pretty">
                      <span className="font-medium text-foreground">
                        Resumo:{" "}
                      </span>
                      <span className="text-muted-foreground">
                        {link.summary}
                      </span>
                    </p>
                  )}
                  {link.decision && (
                    <p className="text-xs text-pretty">
                      <span className="font-medium text-foreground">
                        Decisão:{" "}
                      </span>
                      <span className="text-muted-foreground">
                        {link.decision}
                      </span>
                    </p>
                  )}
                </div>

                {canEdit && (
                  <ConfirmDeleteButton
                    action={() => unlinkMeetingCase(link.id)}
                    label={`Remover vínculo com ${caseName}`}
                    title="Remover o vínculo do caso?"
                    description="O caso será desvinculado desta reunião. O caso em si não é afetado."
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <LinkCaseDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          meetingId={meetingId}
          cases={availableCases}
          agendaItems={agendaItems}
        />
      )}
    </section>
  );
}
