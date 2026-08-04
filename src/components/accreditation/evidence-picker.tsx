"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Link2, Loader2 } from "lucide-react";

import {
  linkEvidence,
  searchEvidenceCandidates,
  type LinkEvidenceState,
} from "@/lib/accreditation/actions";
import { ARTIFACT_KIND_LABELS, type ArtifactKind, type EvidenceCandidate } from "@/lib/accreditation/types";
import { cn } from "@/lib/utils";
import { plural } from "@/components/accreditation/format";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * Link an existing artifact as evidence for a standard (`link_evidence`).
 *
 * Two candidate pickers share the dialog, chosen per kind:
 *  - **`charter`** (and any other low-cardinality kind added later) uses a
 *    plain `<select>` fallback (mirrors `rca-evidence-forms.tsx`'s
 *    `EvidenceCitationForm`) — a commission has exactly one charter, so a
 *    searchable combobox there is pure friction, not a convenience.
 *  - Every other kind uses {@link EvidenceCombobox}, a debounced ARIA
 *    combobox+listbox (the pattern in
 *    `src/components/responses/wizard/reference-picker.tsx`, simplified to
 *    this picker's single-lane shape — no participant sub-lanes).
 *
 * Both feed `searchEvidenceCandidates` (`@/lib/accreditation/actions`),
 * which routes straight to the `evidence_candidates` RPC.
 */
const LOW_CARDINALITY_KINDS: ReadonlySet<ArtifactKind> = new Set(["charter"]);

export function LinkEvidenceDialogTrigger({
  commissionId,
  standardId,
}: {
  commissionId: string;
  standardId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Link2 aria-hidden="true" />
        Vincular evidência
      </Button>
      {open && (
        <LinkEvidenceDialog
          open={open}
          onOpenChange={setOpen}
          commissionId={commissionId}
          standardId={standardId}
        />
      )}
    </>
  );
}

function LinkEvidenceDialog({
  open,
  onOpenChange,
  commissionId,
  standardId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  standardId: string;
}) {
  const [state, formAction, isPending] = useActionState<LinkEvidenceState | undefined, FormData>(
    linkEvidence,
    undefined,
  );

  const [kind, setKind] = useState<ArtifactKind | "">("");
  const [candidate, setCandidate] = useState<EvidenceCandidate | null>(null);

  // Reset the picker each time the dialog (re)opens — the same render-phase
  // transition the case/narrative dialogs use, so a cancelled pick never
  // lingers into the next open.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKind("");
      setCandidate(null);
    }
  }

  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular evidência</DialogTitle>
          <DialogDescription>
            Selecione um item já registrado pela comissão para vinculá-lo como
            evidência deste padrão.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="commissionId" value={commissionId} />
          <input type="hidden" name="standardId" value={standardId} />
          <input type="hidden" name="artifactKind" value={kind} />
          <input type="hidden" name="artifactId" value={candidate?.id ?? ""} />

          {state && !state.ok && <FormBanner tone="error">{state.error}</FormBanner>}

          <label htmlFor="evidence-kind" className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo de evidência</span>
            <NativeSelect
              id="evidence-kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ArtifactKind);
                setCandidate(null);
              }}
              className="h-10"
              required
            >
              <option value="" disabled>
                Selecione…
              </option>
              {(Object.entries(ARTIFACT_KIND_LABELS) as [ArtifactKind, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </NativeSelect>
          </label>

          {kind && LOW_CARDINALITY_KINDS.has(kind) ? (
            <SimpleCandidateSelect
              key={kind}
              commissionId={commissionId}
              kind={kind}
              candidate={candidate}
              onSelect={setCandidate}
            />
          ) : kind ? (
            <EvidenceCombobox
              key={kind}
              commissionId={commissionId}
              kind={kind}
              value={candidate}
              onChange={setCandidate}
            />
          ) : null}

          <label htmlFor="evidence-note" className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Nota <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <Textarea
              id="evidence-note"
              name="note"
              rows={2}
              placeholder="Por que este item é evidência para o padrão…"
              aria-describedby="evidence-note-help"
            />
            <span id="evidence-note-help" className="text-xs text-muted-foreground">
              Não inclua nome, prontuário ou outros dados do paciente. Se a evidência
              exige contexto de paciente, vincule o caso/procedimento em si em vez de
              descrevê-lo aqui.
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending || !kind || !candidate}>
              {isPending ? "Vinculando…" : "Vincular"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Low-cardinality fallback — a plain <select>, fetched once per kind change.
// ---------------------------------------------------------------------------

function SimpleCandidateSelect({
  commissionId,
  kind,
  candidate,
  onSelect,
}: {
  commissionId: string;
  kind: ArtifactKind;
  candidate: EvidenceCandidate | null;
  onSelect: (candidate: EvidenceCandidate | null) => void;
}) {
  const [options, setOptions] = useState<EvidenceCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The parent keys this component on `kind` (remounts fresh on change), so
  // `options`/`error` already start at their initial `null` for a new kind —
  // no synchronous reset needed here (that would trip
  // react-hooks/set-state-in-effect: an effect should not setState eagerly at
  // its own start, only from the async result it is subscribing to).
  useEffect(() => {
    let cancelled = false;
    searchEvidenceCandidates(commissionId, kind, "").then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error ?? "Não foi possível buscar as opções.");
        setOptions([]);
        return;
      }
      setOptions(result.candidates ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [commissionId, kind]);

  return (
    <label htmlFor="evidence-candidate-simple" className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{ARTIFACT_KIND_LABELS[kind]}</span>
      {options === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Carregando opções…
        </p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item disponível.</p>
      ) : (
        <NativeSelect
          id="evidence-candidate-simple"
          value={candidate?.id ?? ""}
          onChange={(e) => {
            const next = options.find((o) => o.id === e.target.value) ?? null;
            onSelect(next);
          }}
          className="h-10"
          required
        >
          <option value="" disabled>
            Selecione…
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
              {o.subtitle ? ` — ${o.subtitle}` : ""}
            </option>
          ))}
        </NativeSelect>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// EvidenceCombobox — debounced ARIA combobox+listbox, single-select.
// A leaner sibling of reference-picker.tsx's pattern: one lane (one kind),
// no participant sub-lane copy, but the same ARIA contract + keyboard model
// (arrows move the highlight, Enter commits, Escape/Tab restore).
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 250;

function EvidenceCombobox({
  commissionId,
  kind,
  value,
  onChange,
}: {
  commissionId: string;
  kind: ArtifactKind;
  value: EvidenceCandidate | null;
  onChange: (candidate: EvidenceCandidate | null) => void;
}) {
  const reactId = useId();
  const inputId = `evidence-combobox-${reactId}`;
  const listboxId = `evidence-combobox-listbox-${reactId}`;
  const optionId = (index: number) => `evidence-combobox-opt-${reactId}-${index}`;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const query = draft ?? value?.label ?? "";
  const [candidates, setCandidates] = useState<EvidenceCandidate[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  const searchText = (draft ?? "").trim();

  const runSearch = useCallback(
    async (text: string) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      const result = await searchEvidenceCandidates(commissionId, kind, text);
      if (seq !== requestSeq.current) return; // superseded — drop it
      setLoading(false);
      if (!result.ok) {
        setSearchError(result.error ?? "Não foi possível buscar as opções. Tente novamente.");
        setCandidates([]);
        return;
      }
      setSearchError(null);
      const rows = result.candidates ?? [];
      setCandidates(rows);
      setActiveIndex(rows.length > 0 ? 0 : -1);
    },
    [commissionId, kind],
  );

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(
      () => {
        void runSearch(searchText);
      },
      searchText === "" ? 0 : DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [open, searchText, runSearch]);

  const settle = useCallback(() => {
    setDraft(null);
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const commit = useCallback(
    (c: EvidenceCandidate) => {
      onChange(c);
      settle();
    },
    [onChange, settle],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (candidates.length === 0) return;
        setActiveIndex((i) => (i + 1) % candidates.length);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (candidates.length === 0) return;
        setActiveIndex((i) => (i <= 0 ? candidates.length - 1 : i - 1));
        return;
      case "Enter": {
        if (!open) return;
        const c = candidates[activeIndex];
        if (!c) return;
        event.preventDefault();
        commit(c);
        return;
      }
      case "Escape":
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        settle();
        return;
      case "Tab":
        if (open) settle();
        return;
      default:
        if (
          !open &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete")
        ) {
          setOpen(true);
        }
    }
  }

  const showList = open && !loading && candidates.length > 0;
  const showEmpty = open && !loading && candidates.length === 0 && !searchError;
  const label = ARTIFACT_KIND_LABELS[kind];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder={`Buscar ${label.toLowerCase()}…`}
          value={query}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={settle}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-colors duration-(--dur-fast) ease-(--ease-out-soft) focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />

        {open ? (
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <ul
              id={listboxId}
              role="listbox"
              aria-label={`Opções de ${label.toLowerCase()}`}
              className="max-h-56 overflow-y-auto py-1"
            >
              {showList
                ? candidates.map((c, index) => {
                    const active = index === activeIndex;
                    const committed = value?.id === c.id;
                    return (
                      <li
                        key={c.id}
                        id={optionId(index)}
                        role="option"
                        aria-selected={active}
                        onClick={() => commit(c)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm transition-colors duration-(--dur-fast) ease-(--ease-out-soft)",
                          active && "bg-accent text-accent-foreground",
                        )}
                      >
                        <Check
                          aria-hidden="true"
                          className={cn("mt-0.5 size-4 shrink-0", committed ? "text-primary" : "invisible")}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{c.label}</span>
                          {c.subtitle ? (
                            <span className="truncate text-xs text-muted-foreground">{c.subtitle}</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })
                : null}
            </ul>
            {loading ? (
              <p aria-hidden="true" className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" />
                Buscando opções…
              </p>
            ) : searchError ? (
              <p className="px-3 py-3 text-sm text-destructive">{searchError}</p>
            ) : showEmpty ? (
              <p className="px-3 py-3 text-sm text-muted-foreground text-pretty">
                {searchText ? "Nenhum resultado para esta busca." : "Nenhum item disponível para vincular."}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {!open
          ? ""
          : loading
            ? "Buscando opções…"
            : searchError
              ? searchError
              : candidates.length === 0
                ? "Nenhum resultado."
                : `${candidates.length} ${plural(candidates.length, "opção disponível", "opções disponíveis")}. Use as setas para navegar e Enter para escolher.`}
      </p>
    </div>
  );
}
