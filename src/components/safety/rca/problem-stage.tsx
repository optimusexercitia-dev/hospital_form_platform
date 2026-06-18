"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CircleAlert,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import type { Rca, UpdateRcaInput } from "@/lib/safety/rca-types";
import { updateRca } from "@/lib/safety/rca-actions";
import { cn } from "@/lib/utils";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

const SAVE_DEBOUNCE_MS = 700;

/**
 * Stage 1 — Problem (README_rca §4). Two-column: the "what happened" / "what
 * should have happened" sanitized-Markdown cards (Rule 7) + an event-facts sidebar
 * (detected / impact / scope, plain text) and the "RCA obrigatória" callout.
 *
 * Autosaves the whole problem slice via `updateRca` (debounced), then re-reads the
 * server state (`router.refresh`). Read-only when `!canEdit` (an observer / frozen
 * RCA): the Markdown bodies render through {@link MarkdownRenderer}.
 */
export function ProblemStage({
  rca,
  canEdit,
  onSaving,
  onSaved,
  onError,
}: {
  rca: Rca;
  canEdit: boolean;
  onSaving: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const detectedId = useId();
  const impactId = useId();
  const scopeId = useId();

  const [whatMd, setWhatMd] = useState(rca.whatMd ?? "");
  const [expectedMd, setExpectedMd] = useState(rca.expectedMd ?? "");
  const [detected, setDetected] = useState(rca.detected ?? "");
  const [impact, setImpact] = useState(rca.impact ?? "");
  const [scope, setScope] = useState(rca.scope ?? "");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest slice, written only from event handlers + effects (never render), so
  // the debounced flush always sends the full current state (Rule: no ref in render).
  const latest = useRef<UpdateRcaInput>({
    whatMd: rca.whatMd,
    expectedMd: rca.expectedMd,
    detected: rca.detected,
    impact: rca.impact,
    scope: rca.scope,
    summaryMd: rca.summaryMd,
  });

  // Re-seed when the server returns a fresh RCA (sync signature on updatedAt).
  const [sig, setSig] = useState(rca.updatedAt);
  if (sig !== rca.updatedAt) {
    setSig(rca.updatedAt);
    setWhatMd(rca.whatMd ?? "");
    setExpectedMd(rca.expectedMd ?? "");
    setDetected(rca.detected ?? "");
    setImpact(rca.impact ?? "");
    setScope(rca.scope ?? "");
  }

  // Keep the flush snapshot in sync with the authoritative server state (effect, not
  // render) so a server-returned worksheet reseeds what the next debounced save sends.
  useEffect(() => {
    latest.current = {
      whatMd: rca.whatMd,
      expectedMd: rca.expectedMd,
      detected: rca.detected,
      impact: rca.impact,
      scope: rca.scope,
      summaryMd: rca.summaryMd,
    };
  }, [rca.whatMd, rca.expectedMd, rca.detected, rca.impact, rca.scope, rca.summaryMd]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const scheduleSave = useCallback(
    (patch: Partial<UpdateRcaInput>) => {
      latest.current = { ...latest.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onSaving();
        void updateRca(rca.id, latest.current).then((result) => {
          if (!result.ok) {
            onError(result.error ?? "Não foi possível salvar.");
            return;
          }
          onSaved();
          router.refresh();
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [rca.id, router, onSaving, onSaved, onError],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="flex flex-col gap-6">
        <ProblemCard
          tone="danger"
          icon={<CircleAlert aria-hidden="true" className="size-4" />}
          title="O que aconteceu"
          headingId="rca-what"
        >
          {canEdit ? (
            <SectionTextEditor
              value={whatMd}
              onChange={(v) => {
                setWhatMd(v);
                scheduleSave({ whatMd: v || null });
              }}
              textareaId="rca-what-input"
              placeholder="Descreva objetivamente o evento, em Markdown…"
            />
          ) : (
            <ReadOnlyMd value={whatMd} />
          )}
        </ProblemCard>

        <ProblemCard
          tone="success"
          icon={<ShieldCheck aria-hidden="true" className="size-4" />}
          title="O que deveria ter acontecido"
          headingId="rca-expected"
        >
          {canEdit ? (
            <SectionTextEditor
              value={expectedMd}
              onChange={(v) => {
                setExpectedMd(v);
                scheduleSave({ expectedMd: v || null });
              }}
              textareaId="rca-expected-input"
              placeholder="Descreva o curso ideal esperado, em Markdown…"
            />
          ) : (
            <ReadOnlyMd value={expectedMd} />
          )}
          <p className="text-xs text-muted-foreground text-pretty">
            A diferença entre estas duas declarações é o problema que esta análise
            investiga.
          </p>
        </ProblemCard>
      </div>

      <aside className="flex flex-col gap-4">
        <section
          aria-labelledby="rca-facts"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
        >
          <h3 id="rca-facts" className="text-sm font-semibold">
            Fatos do evento
          </h3>
          <div className="flex flex-col gap-3">
            <FactField
              id={detectedId}
              icon={CalendarClock}
              label="Quando detectado"
              value={detected}
              canEdit={canEdit}
              placeholder="Ex.: SRPA, ~25 min após o início"
              onChange={(v) => {
                setDetected(v);
                scheduleSave({ detected: v || null });
              }}
            />
            <FactField
              id={impactId}
              icon={CircleAlert}
              label="Impacto"
              value={impact}
              canEdit={canEdit}
              placeholder="Ex.: Óbito do paciente · evento sentinela"
              onChange={(v) => {
                setImpact(v);
                scheduleSave({ impact: v || null });
              }}
            />
            <FactField
              id={scopeId}
              icon={MapPin}
              label="Abrangência"
              value={scope}
              canEdit={canEdit}
              placeholder="Ex.: Perioperatório e SRPA · Cirurgia Geral"
              onChange={(v) => {
                setScope(v);
                scheduleSave({ scope: v || null });
              }}
            />
          </div>
        </section>

        <section
          aria-labelledby="rca-mandate"
          className="flex flex-col gap-2 rounded-2xl border border-primary/25 bg-accent p-5"
        >
          <h3
            id="rca-mandate"
            className="flex items-center gap-2 text-sm font-semibold text-primary"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            RCA obrigatória
          </h3>
          <p className="text-xs text-foreground/80 text-pretty">
            A triagem classificou este evento como sentinela. Uma análise de causa
            raiz completa é obrigatória antes do encerramento, com prazo definido
            pelo NSP.
          </p>
        </section>
      </aside>
    </div>
  );
}

function ProblemCard({
  tone,
  icon,
  title,
  headingId,
  children,
}: {
  tone: "danger" | "success";
  icon: React.ReactNode;
  title: string;
  headingId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <h3 id={headingId} className="flex items-center gap-2 text-base">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-lg",
            tone === "danger"
              ? "bg-destructive/10 text-destructive"
              : "bg-success/12 text-success",
          )}
        >
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function ReadOnlyMd({ value }: { value: string }) {
  if (!value.trim()) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Sem conteúdo registrado.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <MarkdownRenderer content={value} />
    </div>
  );
}

/** One plain-text event-fact field (detected / impact / scope). */
function FactField({
  id,
  icon: Icon,
  label,
  value,
  canEdit,
  placeholder,
  onChange,
}: {
  id: string;
  icon: typeof CalendarClock;
  label: string;
  value: string;
  canEdit: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </label>
      {canEdit ? (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={FIELD_CLASS}
        />
      ) : (
        <p className="text-sm text-foreground">{value || "—"}</p>
      )}
    </div>
  );
}
