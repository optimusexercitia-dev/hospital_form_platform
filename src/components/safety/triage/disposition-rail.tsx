"use client";

import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  REACH_LABELS,
  HARM_SEVERITY_LABELS,
  REVIEW_PATHWAY_LABELS,
  type ReviewPathway,
  type TriageDisposition,
} from "@/lib/safety/triage-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDate } from "../format";
import { type TriageDraft, deriveVerdict, isSentinel, pathwayForcedToRca } from "./triage-derive";
import { REACH_TONE, HARM_TONE } from "./triage-visuals";

const NON_RCA_PATHWAYS: ReviewPathway[] = [
  "peer_review",
  "mm",
  "fmea",
  "tracking_only",
];

/**
 * The DISPOSITION rail (right pane, README_triage §6). Summary rows fill in live,
 * then the verdict block (rca / review / closed / pending) + the 45-day RCA due
 * chip + actions. The verdict is driven by the SERVER `getTriageDisposition` once
 * available; while editing, the local `deriveVerdict` mirror keeps the rail honest.
 *
 * Sentinel ⇒ pathway forced to `rca` (non-overridable). When NOT sentinel, the NSP
 * picks one of the lighter pathways.
 */
export function DispositionRail({
  draft,
  disposition,
  commissionName,
  reportedAtLabel,
  reporterName,
  frozen,
  isSaving,
  isConfirming,
  onChangePathway,
  onConfirm,
  onReopen,
  onOpenRca,
  hasRca = false,
}: {
  draft: TriageDraft;
  /** Authoritative disposition from the server (null until first save). */
  disposition: TriageDisposition | null;
  commissionName: string | null;
  reportedAtLabel: string;
  reporterName: string | null;
  frozen: boolean;
  isSaving: boolean;
  isConfirming: boolean;
  onChangePathway: (value: ReviewPathway) => void;
  onConfirm: () => void;
  onReopen: () => void;
  onOpenRca: () => void;
  /** Whether the RCA shell exists yet (minted on confirm) — gates the workspace link. */
  hasRca?: boolean;
}) {
  const localSentinel = isSentinel(draft);
  // Prefer the server verdict; fall back to the live mirror while it catches up.
  const verdict = disposition?.verdict ?? deriveVerdict(draft);
  const dueDate = disposition?.rcaDueDate ?? null;
  const forcedRca = pathwayForcedToRca(draft);

  return (
    <aside
      aria-labelledby="disposition-heading"
      className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <h2
        id="disposition-heading"
        className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase"
      >
        Disposição da triagem
      </h2>

      <dl className="flex flex-col divide-y divide-border/60 text-sm">
        <Row label="Origem">
          <span className="text-right">
            <span className="block font-medium">{commissionName ?? "Comissão"}</span>
            <span className="block text-xs text-muted-foreground">
              {reportedAtLabel}
              {reporterName ? ` · ${reporterName}` : ""}
            </span>
          </span>
        </Row>

        <Row label="Evento de segurança">
          {draft.isPse == null ? (
            <Dash />
          ) : draft.isPse ? (
            <Pill className="border-primary/30 bg-primary/10 text-primary">
              Confirmado
            </Pill>
          ) : (
            <Pill className="border-border bg-muted text-muted-foreground">
              Não é evento
            </Pill>
          )}
        </Row>

        <Row label="Classificação">
          {draft.reach ? (
            <Pill className={REACH_TONE[draft.reach].chip}>
              {REACH_LABELS[draft.reach]}
            </Pill>
          ) : (
            <Dash />
          )}
        </Row>

        <Row label="Dano">
          {draft.harmSeverity ? (
            <Pill className={HARM_TONE[draft.harmSeverity].chip}>
              {HARM_SEVERITY_LABELS[draft.harmSeverity]}
            </Pill>
          ) : (
            <Dash />
          )}
        </Row>

        <Row label="Sentinela">
          {draft.reach == null ? (
            <Dash />
          ) : localSentinel ? (
            <Pill className="border-destructive/30 bg-destructive/10 text-destructive">
              Sentinela
            </Pill>
          ) : (
            <Pill className="border-success/30 bg-success/12 text-success">
              Não
            </Pill>
          )}
        </Row>
      </dl>

      {/* Verdict block */}
      <VerdictBlock verdict={verdict} dueDate={dueDate} />

      {/* Pathway selector (non-sentinel PSE) */}
      {draft.isPse === true && verdict !== "pending" && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="triage-pathway"
            className="text-xs font-medium text-muted-foreground"
          >
            Encaminhamento
          </label>
          {forcedRca ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {REVIEW_PATHWAY_LABELS.rca} (obrigatório)
            </p>
          ) : (
            <select
              id="triage-pathway"
              value={draft.reviewPathway ?? ""}
              disabled={frozen}
              onChange={(e) => onChangePathway(e.target.value as ReviewPathway)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Selecione…</option>
              {NON_RCA_PATHWAYS.map((p) => (
                <option key={p} value={p}>
                  {REVIEW_PATHWAY_LABELS[p]}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        {frozen ? (
          <>
            {verdict === "rca" && (
              <Button
                type="button"
                onClick={onOpenRca}
                disabled={!hasRca}
                title={
                  hasRca
                    ? undefined
                    : "Disponível após confirmar a triagem"
                }
                className="bg-destructive text-primary-foreground hover:bg-destructive/90"
              >
                Abrir workspace de RCA
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onReopen}
              disabled={isConfirming}
            >
              <RefreshCw aria-hidden="true" />
              Reabrir triagem
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming || isSaving || verdict === "pending"}
          >
            {isConfirming ? "Confirmando…" : "Confirmar disposição"}
          </Button>
        )}
      </div>
    </aside>
  );
}

function VerdictBlock({
  verdict,
  dueDate,
}: {
  verdict: TriageDisposition["verdict"];
  dueDate: string | null;
}) {
  if (verdict === "rca") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <RefreshCw aria-hidden="true" className="size-4" />
          RCA obrigatória
        </span>
        <p className="text-xs text-destructive/90 text-pretty">
          Uma análise de causa raiz abrangente deve ser concluída em até 45 dias
          do evento.
        </p>
        {dueDate && (
          <span className="w-fit rounded-full border border-destructive/30 bg-destructive/12 px-2 py-0.5 text-xs font-medium text-destructive tabular-nums">
            Prazo: {formatDate(dueDate)}
          </span>
        )}
      </div>
    );
  }
  if (verdict === "review") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
        <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
        <p className="text-pretty">
          RCA não exigida — encaminhar ao comitê de origem para revisão padrão.
        </p>
      </div>
    );
  }
  if (verdict === "closed") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        <XCircle aria-hidden="true" className="size-4 shrink-0" />
        <p className="text-pretty">
          Encerrar e encaminhar — não é um evento de segurança do paciente.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
      <CircleDashed aria-hidden="true" className="size-4 shrink-0" />
      <p className="text-pretty">
        Disposição pendente — conclua as etapas para determinar o encaminhamento.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center">{children}</dd>
    </div>
  );
}

function Pill({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}
