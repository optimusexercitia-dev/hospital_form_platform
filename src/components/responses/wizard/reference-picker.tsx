"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Eraser, Loader2, Search } from "lucide-react";

import type { Item } from "@/lib/queries/forms";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import {
  REFERENCE_LANE_COPY,
  isCaseScopedOnlyLane,
  reachesCaseScopedLane,
} from "@/components/forms/reference-vocabulary";

import {
  participantTypesOf,
  referenceKindOf,
  type ReferenceAnswerRecord,
  type ReferenceCandidateRow,
} from "./references";

/**
 * FF-5 (ADR 0091) — the entity-reference picker: a debounced, SINGLE-select
 * typeahead over the three lanes (`participant` / `commission` / `user`).
 *
 * ## Why a hand-rolled combobox
 *
 * There is no Radix combobox, and the two alternatives are both wrong here: a
 * native `<select>` cannot search (the participant lane is org-wide) and a
 * `<datalist>` cannot render the SUBLABEL, which is not decoration — on the
 * case-scoped patient lane every candidate's label is the identical surrogate
 * string `'Paciente'` (ADR 0091's substrate finding), so the case ROLE in the
 * sublabel is the ONLY thing distinguishing two rows. It is therefore visible
 * text inside the option, never a `title` attribute or a tooltip.
 *
 * So this implements the ARIA 1.2 combobox-with-listbox pattern directly:
 *  - the text field is `role="combobox"` with `aria-expanded` / `aria-controls` /
 *    `aria-autocomplete="list"`, and points `aria-activedescendant` at the
 *    highlighted option — focus never leaves the input, which is what keeps
 *    typing and arrowing in one continuous interaction;
 *  - the popup is a real `<ul role="listbox">` of `<li role="option">` with
 *    `aria-selected`, so a screen reader announces "2 de 7" style position;
 *  - ↓/↑ move the highlight (wrapping), Enter selects, Escape closes and
 *    restores the committed text, Tab leaves without committing a highlight;
 *  - result counts and the two empty states are announced through a polite live
 *    region, because a list that appears below the caret is invisible to a
 *    screen-reader user otherwise.
 *
 * `aria-required` reflects EFFECTIVE required-ness (`requiredNow`), so an item
 * mandatory only through `required_if` is announced mandatory exactly while it
 * is — the same rule `InputItem` and `MatrixGrid` follow.
 *
 * ## Two different kinds of "nothing here"
 *
 * A filtered search that matches nothing and a lane that HAS nothing are
 * different facts and get different sentences. The distinction is derived, not
 * guessed: the picker fetches once with an EMPTY query when it opens, and that
 * baseline decides which of the two the user is looking at. For the case-scoped
 * patient lane the empty-lane copy names the cause, because "vazio" with no
 * explanation reads as a broken field when it is in fact correct behaviour on a
 * form that is not a case phase (ruling 2).
 *
 * Motion: the option list uses the shared `.animate-rise-in` entrance with a
 * per-row `--rise-delay` stagger. It is CSS-only and therefore collapses to a
 * single frame under the global `prefers-reduced-motion` rule; nothing here
 * gates selection on an animation finishing.
 */

/** How long the field stays quiet after the last keystroke before searching. */
const DEBOUNCE_MS = 250;

export const ReferencePicker = memo(function ReferencePicker({
  item,
  instanceId,
  value,
  onChange,
  onSearch,
  error,
  requiredNow,
  readOnly = false,
}: {
  item: Item;
  /** The repeating-group instance this picker renders inside, or undefined at
   *  top level. Namespaces every id so two repetitions never collide. */
  instanceId?: string;
  /** The committed reference, `null`/undefined when there is none. */
  value: ReferenceAnswerRecord | null | undefined;
  /** Commit a pick, or `null` to CLEAR. Absent in read-only contexts. */
  onChange: (next: ReferenceAnswerRecord | null) => void;
  /**
   * Search this item's candidates. Injected (never imported) so the wizard tree
   * keeps its rule of not value-importing a data module; the runner binds it to
   * the `searchReferenceCandidates` server action, which wraps the
   * INVOKER-rights `reference_candidates` RPC (ruling 3 — it inherits the
   * caller's own read perimeter and cannot widen it).
   */
  onSearch: (query: string) => Promise<{
    ok: boolean;
    error?: string;
    candidates?: ReferenceCandidateRow[];
  }>;
  error?: string;
  /** FF-3 semantics — effective required-ness now; drives the marker AND
   *  `aria-required`. Absent → the static `item.required`. */
  requiredNow?: boolean;
  /** Render the committed value only — the review summary and read-only views. */
  readOnly?: boolean;
}) {
  const reactId = useId();
  const kind = referenceKindOf(item);
  const participantTypes = participantTypesOf(item);
  const copy = REFERENCE_LANE_COPY[kind];
  const required = requiredNow ?? item.required;
  const label = item.label ?? "Referência";

  const scope = instanceId
    ? `reference-${item.id}-inst-${instanceId}`
    : `reference-${item.id}`;
  const inputId = `${scope}-input`;
  const listboxId = `${scope}-listbox`;
  const descriptionId = `${scope}-description`;
  const errorId = `${scope}-error`;
  const selectionId = `${scope}-selection`;
  const optionId = (index: number) => `${scope}-opt-${index}-${reactId}`;

  const [open, setOpen] = useState(false);
  /**
   * What the user has TYPED, or `null` when they have typed nothing since the
   * field was last settled.
   *
   * Deliberately not "the text in the box": the text in the box is DERIVED
   * ({@link query} below) as the draft when there is one, else the committed
   * label. That inversion is what removes the mirror-the-prop-into-state effect
   * this component started with — an effect that both tripped
   * `react-hooks/set-state-in-effect` and was genuinely wrong, because it
   * repainted the field one render LATE whenever the value changed from outside
   * (resume, the block header's "Limpar", an orphan clear). Deriving makes those
   * update on the same frame and makes the "restore on Escape/Tab/blur" paths a
   * single `setDraft(null)` rather than a copy of the label.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const query = draft ?? value?.label ?? "";
  const [candidates, setCandidates] = useState<ReferenceCandidateRow[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /**
   * Whether the UNFILTERED lane came back empty. `null` until the baseline fetch
   * lands. This is what separates "a busca não encontrou nada" from "esta faixa
   * não tem nada" — two different sentences for two different situations, and
   * the only honest way to tell them apart is to have asked without a filter.
   */
  const [laneEmpty, setLaneEmpty] = useState<boolean | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * Monotonic request id. Every resolved search compares against it and drops
   * itself if a newer one has started — without this, a slow request for "ma"
   * can land after a fast one for "maria" and repopulate the list with the wrong
   * rows while the field reads "maria".
   */
  const requestSeq = useRef(0);

  const runSearch = useCallback(
    async (text: string, { baseline }: { baseline: boolean }) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      const result = await onSearch(text);
      if (seq !== requestSeq.current) return; // superseded — drop it
      setLoading(false);
      if (!result.ok) {
        // The action already maps SQLSTATEs to pt-BR; never a raw PG message.
        setSearchError(
          result.error ?? "Não foi possível buscar as opções. Tente novamente.",
        );
        setCandidates([]);
        return;
      }
      setSearchError(null);
      const rows = result.candidates ?? [];
      setCandidates(rows);
      setActiveIndex(rows.length > 0 ? 0 : -1);
      if (baseline) setLaneEmpty(rows.length === 0);
    },
    [onSearch],
  );

  /**
   * The SEARCH text, which is the draft and never the committed label.
   *
   * Opening a field that already holds a value therefore searches UNFILTERED,
   * not "filtered by what is already chosen" — otherwise the list would show the
   * single row the user picked last time and hide every alternative, which is
   * the opposite of what opening a picker is for.
   */
  const searchText = (draft ?? "").trim();
  const filtered = searchText !== "";

  // Debounced search on every draft change WHILE open. The baseline (empty
  // query) fetch is the one that runs on open, and it is what `laneEmpty`
  // records — so the empty-state copy is derived rather than guessed.
  useEffect(() => {
    if (!open || readOnly) return;
    const baseline = searchText === "";
    const timer = setTimeout(
      () => {
        void runSearch(searchText, { baseline });
      },
      baseline ? 0 : DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [open, readOnly, searchText, runSearch]);

  /** Settle the field: stop editing, close the list, drop the highlight. The
   *  displayed text falls back to the committed label by derivation. */
  const settle = useCallback(() => {
    setDraft(null);
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const commit = useCallback(
    (candidate: ReferenceCandidateRow) => {
      onChange({
        kind,
        targetId: candidate.targetId,
        label: candidate.label,
        sublabel: candidate.sublabel,
      });
      settle();
    },
    [kind, onChange, settle],
  );

  const clear = useCallback(() => {
    onChange(null);
    settle();
    inputRef.current?.focus();
  }, [onChange, settle]);

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
      case "Home":
        if (!open || candidates.length === 0) return;
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        if (!open || candidates.length === 0) return;
        event.preventDefault();
        setActiveIndex(candidates.length - 1);
        return;
      case "Enter": {
        if (!open) return;
        const candidate = candidates[activeIndex];
        if (!candidate) return;
        // Only swallow the key when it actually selects something, so Enter in a
        // field with nothing highlighted still behaves as the page expects.
        event.preventDefault();
        commit(candidate);
        return;
      }
      case "Escape":
        if (!open) return;
        event.preventDefault();
        // Stop the dialog/wizard ancestors from also reacting: Escape's nearest
        // meaning here is "close this list", not "leave this screen".
        event.stopPropagation();
        settle();
        return;
      case "Tab":
        // Leaving the field never commits a mere highlight — only Enter or a
        // click does. Restore so the text can never claim a value that was not
        // actually selected.
        if (open) settle();
        return;
      default:
        // m-4: open only for keys that actually EDIT the field. The previous
        // catch-all fired on Shift, Ctrl, Alt, CapsLock, F5 and every other
        // non-editing key, so merely holding Shift re-opened a closed list and
        // kicked off a baseline search.
        //
        // `key.length === 1` is the printable-character test; Backspace/Delete
        // are the editing keys that are not printable. A chord (Ctrl/Meta/Alt)
        // is a command, not typing, so it is excluded even when its key is a
        // single character — Ctrl+C must not open a listbox.
        if (
          !open &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          (event.key.length === 1 ||
            event.key === "Backspace" ||
            event.key === "Delete")
        ) {
          setOpen(true);
        }
    }
  }

  const describedBy =
    [
      item.questionExplanation ? descriptionId : null,
      value ? selectionId : null,
      error ? errorId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  // ----- READ-ONLY (review summary, submitted views) -----
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1 text-sm font-medium">
          {label}
          {required ? <RequiredMark /> : null}
        </p>
        {value ? (
          <SelectedReference value={value} />
        ) : (
          <p className="text-sm text-muted-foreground italic">Sem resposta</p>
        )}
      </div>
    );
  }

  const showList = open && !loading && candidates.length > 0;
  const showEmpty = open && !loading && candidates.length === 0 && !searchError;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required ? <RequiredMark /> : null}
      </label>

      {item.questionExplanation ? (
        <FieldDescription id={descriptionId}>
          {/* The author's own help text, rendered as TEXT — never markup (Rule 7). */}
          {item.questionExplanation}
        </FieldDescription>
      ) : null}

      <div className="relative">
        <div className="relative flex items-center">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            // m-1: only reference the listbox while it is actually MOUNTED. The
            // popup below renders iff `open`, so pointing at `listboxId` when
            // closed left a dangling IDREF (axe `aria-valid-attr-value`).
            aria-controls={open ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            placeholder={copy.searchPlaceholder}
            value={query}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Any blur here means the user genuinely left the field, so close
              // without committing a mere highlight.
              //
              // i-1: there is deliberately NO `currentTarget.contains(relatedTarget)`
              // guard. `currentTarget` is this `<input>` — a void element that
              // can never contain another node — so such a check is always false
              // and does nothing. What actually keeps an option click alive is
              // the popup's `onMouseDown` preventDefault below: focus never
              // leaves the input, so this handler does not fire at all.
              settle();
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "h-10 w-full rounded-lg border border-input bg-card py-2 pr-10 pl-9 text-sm shadow-xs",
              "transition-colors duration-(--dur-fast) ease-(--ease-out-soft)",
              "placeholder:text-muted-foreground/70",
              "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              "aria-invalid:border-destructive/60",
            )}
          />
          {loading ? (
            <Loader2
              aria-hidden="true"
              className="absolute right-3 size-4 animate-spin text-muted-foreground"
            />
          ) : value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 text-muted-foreground hover:text-foreground"
              onClick={clear}
              aria-label={`Remover a referência de ${label}`}
              title="Remover"
            >
              <Eraser aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {/*
          m-1: the popup renders whenever the field is OPEN — including while the
          baseline fetch is in flight. It previously rendered only once a result
          had landed, which made `aria-expanded="true"` a lie for the duration of
          every fetch (expanded, but nothing to expand into) and left
          `aria-controls` dangling. Rendering a real loading row instead keeps the
          three signals — `aria-expanded`, `aria-controls`, and what is on screen
          — describing the same state at every instant, and gives sighted users
          the progress feedback that was previously only a spinner in the input.
        */}
        {open ? (
          <div
            // Suppressing mousedown keeps focus on the combobox while an option
            // is clicked — the input stays the focused element throughout, which
            // is exactly what `aria-activedescendant` promises.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <ul
              id={listboxId}
              role="listbox"
              aria-label={`Opções para ${label}`}
              className="max-h-64 overflow-y-auto py-1"
            >
              {showList
                ? candidates.map((candidate, index) => {
                    const active = index === activeIndex;
                    const committed = value?.targetId === candidate.targetId;
                    return (
                      <li
                        key={candidate.targetId}
                        id={optionId(index)}
                        role="option"
                        // m-2: `aria-selected` tracks the ACTIVE option — the one
                        // `aria-activedescendant` points at — not the committed
                        // value. APG's combobox+listbox pattern defines selection
                        // as following focus in a single-select listbox, so
                        // binding it to the committed value made a screen reader
                        // announce "not selected" on the very row the user was
                        // arrowing onto, while the visual highlight said
                        // otherwise. Audible and visual now agree.
                        //
                        // The committed value is still conveyed: it is the
                        // input's own text, it is wired via `aria-describedby` →
                        // the selection block, and the check icon carries an
                        // sr-only label below.
                        aria-selected={active}
                        onClick={() => commit(candidate)}
                        onMouseEnter={() => setActiveIndex(index)}
                        style={{ ["--rise-delay" as string]: `${index * 20}ms` }}
                        className={cn(
                          "animate-rise-in flex cursor-pointer items-start gap-2 px-3 py-2 text-sm",
                          "transition-colors duration-(--dur-fast) ease-(--ease-out-soft)",
                          active && "bg-accent text-accent-foreground",
                        )}
                      >
                        <Check
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            committed ? "text-primary" : "invisible",
                          )}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {candidate.label}
                            {committed ? (
                              // The check icon is `aria-hidden`, so without this
                              // the "this is the one already chosen" signal would
                              // be visual-only — and it can no longer ride
                              // `aria-selected`, which now tracks the active row.
                              <span className="sr-only">
                                {" "}
                                (referência atual)
                              </span>
                            ) : null}
                          </span>
                          {candidate.sublabel ? (
                            // Load-bearing, not decoration: on the patient lane
                            // every label is the same surrogate string, so this
                            // is the only disambiguator. Always visible.
                            //
                            // Rendered RAW: the sublabel arrives already pt-BR
                            // (`app.participant_type_label` normalizes it at the
                            // source). Never re-map it here — see the note in
                            // `reference-vocabulary.ts` for why a render-layer
                            // guard is worse than none.
                            <span className="truncate text-xs text-muted-foreground">
                              {candidate.sublabel}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })
                : null}
            </ul>

            {loading ? (
              // The popup is mounted for the whole open state now (m-1), so the
              // in-flight case needs something to show. `aria-hidden` because the
              // polite live region below already announces "Buscando opções…" —
              // announcing it twice is noise, not redundancy.
              <p
                aria-hidden="true"
                className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 shrink-0 animate-spin" />
                Buscando opções…
              </p>
            ) : searchError ? (
              <p className="px-3 py-3 text-sm text-destructive">{searchError}</p>
            ) : showEmpty ? (
              <p className="px-3 py-3 text-sm text-muted-foreground text-pretty">
                {emptyStateMessage({
                  kind,
                  participantTypes,
                  filtered,
                  laneEmpty,
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* The committed pick, restated below the field so the sublabel survives
          after the list closes — the input alone shows only the label. */}
      {value ? (
        <div id={selectionId}>
          <SelectedReference value={value} />
        </div>
      ) : null}

      {/* A list that opens under the caret is invisible to a screen reader
          otherwise; announce the count and the empty states politely. */}
      <p role="status" aria-live="polite" className="sr-only">
        {liveStatus({
          open,
          loading,
          count: candidates.length,
          kind,
          participantTypes,
          filtered,
          laneEmpty,
          searchError,
        })}
      </p>

      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});

/** The committed reference as a compact card: label + the disambiguating
 *  sublabel. Shared by the editable field and every read-only view so the two
 *  can never render the same answer differently. */
function SelectedReference({ value }: { value: ReferenceAnswerRecord }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-border bg-accent/30 px-3 py-2 text-sm">
      <span className="font-medium">{value.label}</span>
      {value.sublabel ? (
        <span className="text-xs text-muted-foreground">{value.sublabel}</span>
      ) : null}
    </p>
  );
}

/** The "* obrigatória" marker — same shape and accessible name the scalar
 *  inputs and the matrix grids use, so the three read identically. */
function RequiredMark() {
  return (
    <span className="text-destructive" aria-label="obrigatória">
      *
    </span>
  );
}

/**
 * Which of the two "nothing here" sentences applies.
 *
 * A filtered search that found nothing is the user's own doing and says so. An
 * EMPTY LANE is a fact about the form, and on the case-scoped patient lane it
 * has a specific, non-obvious cause worth naming (ruling 2): a standalone
 * response has no case, therefore no case participants, therefore no patients —
 * correct behaviour that reads as a broken field if left unexplained.
 */
function emptyStateMessage({
  kind,
  participantTypes,
  filtered,
  laneEmpty,
}: {
  kind: ReturnType<typeof referenceKindOf>;
  participantTypes: ReturnType<typeof participantTypesOf>;
  filtered: boolean;
  laneEmpty: boolean | null;
}): string {
  const copy = REFERENCE_LANE_COPY[kind];
  // A filtered miss over a lane that DOES have candidates is a search miss.
  if (filtered && laneEmpty === false) return copy.noMatches;

  if (kind === "participant" && reachesCaseScopedLane(participantTypes)) {
    return isCaseScopedOnlyLane(participantTypes)
      ? "Nenhum paciente para referenciar. Este campo lista apenas os pacientes do caso — em um formulário avulso, sem caso vinculado, ele fica vazio."
      : "Nenhum participante para referenciar. Pacientes aparecem aqui apenas em formulários vinculados a um caso.";
  }
  return filtered ? copy.noMatches : copy.noCandidates;
}

/** The polite announcement for the open list: a count, or the empty reason. */
function liveStatus({
  open,
  loading,
  count,
  kind,
  participantTypes,
  filtered,
  laneEmpty,
  searchError,
}: {
  open: boolean;
  loading: boolean;
  count: number;
  kind: ReturnType<typeof referenceKindOf>;
  participantTypes: ReturnType<typeof participantTypesOf>;
  filtered: boolean;
  laneEmpty: boolean | null;
  searchError: string | null;
}): string {
  if (!open) return "";
  if (loading) return "Buscando opções…";
  if (searchError) return searchError;
  if (count === 0) {
    return emptyStateMessage({ kind, participantTypes, filtered, laneEmpty });
  }
  return count === 1
    ? "1 opção disponível. Use as setas para navegar e Enter para escolher."
    : `${count} opções disponíveis. Use as setas para navegar e Enter para escolher.`;
}
