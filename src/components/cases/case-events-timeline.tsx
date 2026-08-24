"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  ClipboardCheck,
  FilePlus2,
  FileSearch,
  Gavel,
  Lock,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  Undo2,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";

import type { AnyCaseEventKind, CaseEvent } from "@/lib/queries/case-documents";
import { deleteCaseEvent } from "@/lib/cases/documents-actions";
import { isCaseEventKind } from "@/lib/cases/registro-kinds";
import { Button } from "@/components/ui/button";
import { RiseInGroup } from "@/components/motion/rise-in-group";
import { cn } from "@/lib/utils";
import { CaseEventForm } from "./case-event-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { EVENT_KIND_LABEL } from "./case-extras-labels";
import { formatDate, formatDueDate } from "./format";

/**
 * How ONE kind is drawn: its icon and the tint shared by the timeline's icon
 * circle and the row's type chip.
 *
 * ⛔ **Tokens only — never the handoff's raw oklch values.** The `case_activity_card`
 * handoff lists literal `oklch(...)` for every tint; those are the *source* of this
 * project's semantic tokens, so the correct adoption is `bg-accent` /
 * `text-warning` / `bg-primary/10`, not a re-declared colour. A bare `[--var]`
 * utility is Tailwind-v4 dead CSS and `lint:css-vars` fails the build on it.
 *
 * ⚠ The accent is PRECIOUS (design system §2), so exactly one manual kind carries
 * it: `decision`, the weightiest thing a committee records. Everything procedural
 * is deliberately muted — a system echo must never out-shout a person's note.
 *
 * Exhaustive over {@link AnyCaseEventKind} by TYPE — which is a guarantee about
 * THIS UNION, and nothing more.
 *
 * ⛔ **It is NOT a guarantee about `case_events_kind_check`, and an earlier version of
 * this comment claimed it was.** Widening the CHECK in SQL touches no TypeScript:
 * `tsc` stays green, `listCaseEvents`' `.returns<CaseEventRow[]>()` ASSERTS the new
 * row into the stale union, and the lookup below then yields `undefined` — whose
 * destructure threw and took the whole card down. The `Record` reds only when someone
 * widens {@link AnyCaseEventKind} ITSELF, which is a second, separate edit nothing
 * forces. Read {@link kindVisual} for what actually holds at runtime.
 *
 * Today the two agree — 16 kinds on both sides, verified 2026-08-24 against
 * `case_events_kind_check`. That is a MEASUREMENT with a date on it, not a mechanism.
 */
const KIND_VISUAL: Record<AnyCaseEventKind, { Icon: LucideIcon; tint: string }> = {
  // The SIX manual kinds (ADR 0137 D12) — `app.is_manual_case_event_kind`.
  note: { Icon: MessageSquare, tint: "bg-muted text-muted-foreground" },
  meeting: { Icon: Users, tint: "bg-accent text-accent-foreground" },
  decision: { Icon: Gavel, tint: "bg-primary/10 text-primary" },
  update: { Icon: RefreshCw, tint: "bg-accent text-accent-foreground" },
  follow_up: { Icon: CalendarClock, tint: "bg-warning/15 text-warning" },
  other: { Icon: MoreHorizontal, tint: "bg-muted text-muted-foreground" },
  // The TEN procedural kinds — emitted only by the SECURITY DEFINER RPCs.
  interview: { Icon: Mic, tint: "bg-muted text-muted-foreground" },
  safety_event: { Icon: ShieldAlert, tint: "bg-muted text-muted-foreground" },
  admissibility_decided: { Icon: ClipboardCheck, tint: "bg-muted text-muted-foreground" },
  allegation_added: { Icon: FilePlus2, tint: "bg-muted text-muted-foreground" },
  finding_recorded: { Icon: FileSearch, tint: "bg-muted text-muted-foreground" },
  notification_issued: { Icon: Send, tint: "bg-muted text-muted-foreground" },
  hearing_scheduled: { Icon: CalendarClock, tint: "bg-muted text-muted-foreground" },
  vote_cast: { Icon: Vote, tint: "bg-muted text-muted-foreground" },
  decision_issued: { Icon: Scale, tint: "bg-muted text-muted-foreground" },
  appeal_submitted: { Icon: Undo2, tint: "bg-muted text-muted-foreground" },
};

/**
 * The visual for a kind the TypeScript union does not know about — a row whose
 * `kind` the DB admits and this build has never heard of.
 *
 * Neutral on purpose: an unknown kind is by definition not classifiable as manual or
 * procedural, and giving it the accent would let a row the platform cannot describe
 * out-shout a committee decision.
 */
const UNKNOWN_KIND_VISUAL = {
  Icon: MoreHorizontal,
  tint: "bg-muted text-muted-foreground",
} as const;

/**
 * Resolve a row's visual, falling back for a kind this build does not know.
 *
 * ⛔ **The parameter is `string`, DELIBERATELY, and narrowing it back to
 * {@link AnyCaseEventKind} silently re-arms the crash this exists to prevent.** With
 * the union as the parameter type the lookup is typed non-nullable, TypeScript prunes
 * the fallback as unreachable, and a reviewer reads dead code — while at runtime the
 * value that arrives is whatever `case_events_kind_check` admitted, asserted into the
 * union by a `.returns<>()` that verifies nothing. `string` is what makes the
 * `undefined` case exist for the type system as well as for the browser, which is
 * also what lets a unit test reach it without a cast.
 */
function kindVisual(kind: string): { Icon: LucideIcon; tint: string } {
  return (
    (KIND_VISUAL as Record<string, { Icon: LucideIcon; tint: string } | undefined>)[
      kind
    ] ?? UNKNOWN_KIND_VISUAL
  );
}

/**
 * The row's type chip, falling back for a kind this build does not know.
 *
 * ⚠ Swept as the SIBLING of {@link kindVisual}, not because it crashed: the same
 * unknown `kind` reaching `EVENT_KIND_LABEL` yields `undefined`, which React renders
 * as an EMPTY chip — quieter than the throw, and therefore likelier to ship. Fixing
 * one lookup on a row and leaving the other reads as having swept the class.
 *
 * The fallback shows the raw kind rather than a generic word: an operator debugging a
 * row the build cannot name needs to see WHICH kind it is, and a chip reading
 * "Registro" would hide exactly that.
 */
function kindLabel(kind: string): string {
  return (EVENT_KIND_LABEL as Record<string, string | undefined>)[kind] ?? kind;
}

type ActivityFilter = "all" | "updates" | "system";

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "updates", label: "Atualizações" },
  { key: "system", label: "Sistema" },
];

/** Pill styling for the Tudo / Atualizações / Sistema filter chips. */
function pillClass(active: boolean): string {
  return cn(
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "border border-border bg-card text-muted-foreground hover:text-foreground",
  );
}

/**
 * The case's **Atividade** card (ADR 0137 **D12**, replacing "Registros") — one
 * chronological feed of the committee's own working notes AND the procedural events
 * the platform emits, with a `Tudo / Atualizações / Sistema` partition, a
 * connector-spine timeline, and a single "Adicionar registro" action in its footer.
 *
 * ## ⛔ The INLINE COMPOSER is gone (2026-08-24) — superseding half of D12
 *
 * D12 shipped an inline composer here (kind pills + textarea + a "Mais detalhes"
 * escape hatch into {@link CaseEventForm}). It was removed by PO decision: a
 * permanently-open form sitting above the feed made the card read as a data-entry
 * surface with a history attached, when what a coordinator opens it for is the
 * chronology. The dialog is now the ONLY authoring path, and it always carried a
 * SUPERSET of the composer's fields — Tipo, Visibilidade, corpo, plus the título /
 * data / hora the composer never offered.
 * ⚠ {@link CaseEventForm}'s `initialKind` / `initialBody` props existed solely to
 * carry the composer's half-typed draft across that hand-off, and were deleted in the
 * same change — nothing else ever passed them. Re-adding a prefill prop is not the
 * way to re-open this question; the composer is a product decision, not a plumbing one.
 *
 * ## The partition is CLIENT-SIDE, on `kind` alone
 *
 * `listCaseEvents` has always returned every kind `case_events_kind_check` admits
 * and has never filtered them — the widening BE-5 deferred (`CaseEvent.kind`:
 * `CaseEventKind` → `AnyCaseEventKind`) only stopped the TYPE from lying about it.
 * So `isCaseEventKind(ev.kind)` splits the rows already in hand:
 *  - **Atualizações** — the six manual kinds (`app.is_manual_case_event_kind`);
 *  - **Sistema** — the ten procedural kinds, written only by the DEFINER RPCs that
 *    emit them.
 * ⛔ No new query, and no merge of lifecycle facts from other tables. "Sistema" is a
 * VIEW OF THIS TABLE, not a second timeline — the `Linha do tempo` tab is the
 * surface that assembles cross-table history, and duplicating it here would put two
 * disagreeing chronologies on one page.
 *
 * ## What the handoff contributed, and what was deliberately NOT taken
 *
 * Chrome adopted at high fidelity: header + subtitle, the three filter pills, the
 * `2rem 1fr` timeline grid with a connector spine, tinted icon circles and matching
 * type chips, and the empty-filter state. (The handoff's inline composer WAS adopted
 * and has since been removed — see the section above.)
 * ⛔ **The four-type authoring vocabulary was NOT adopted** — `Progresso / Nota /
 * Impedimento / Alteração de prazo` is the ACTION-ITEM vocabulary from the page the
 * handoff was lifted from. This card keeps the case's own six kinds, which are
 * mirrored in three places (`case_events_kind_check`,
 * `app.is_manual_case_event_kind` — the `kind` arm of four RLS write policies,
 * BUG-CASEKIND-001 — and the referral internal-notes picker). Adopting four new
 * kinds would be a three-place vocabulary migration for cosmetics.
 */
export function CaseEventsTimeline({
  caseId,
  events,
  canWrite = true,
  canSetVisibility = false,
}: {
  caseId: string;
  events: CaseEvent[];
  /**
   * Whether the viewer may add/edit/delete working notes (`canWriteContent`; ADR
   * 0033). Default `true`; a read-only viewer sees the feed without affordances.
   */
  canWrite?: boolean;
  /**
   * Whether the viewer is a coordinator (`canManageLifecycle`) and so may set a
   * record's visibility to "coordinator_only" (ETH·E3a). Default `false` — a
   * non-coordinator writer's composer omits the field and the record stays the
   * default `case_readers` visibility (server-side default).
   */
  canSetVisibility?: boolean;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CaseEvent | null>(null);

  const shown = useMemo(
    () =>
      events.filter((ev) => {
        if (filter === "all") return true;
        const manual = isCaseEventKind(ev.kind);
        return filter === "updates" ? manual : !manual;
      }),
    [events, filter],
  );

  return (
    <section
      aria-labelledby="case-events-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <header className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2
            id="case-events-heading"
            className="inline-flex items-center gap-2 text-base font-semibold"
          >
            <Activity aria-hidden="true" className="size-4 text-muted-foreground" />
            Atividade
            {/* ⛔ `aria-hidden` IS LOAD-BEARING — do not remove it to "expose the
                count". This badge sits INSIDE the `h2` that names the section via
                `aria-labelledby`, so without it the landmark's accessible name
                mutates with the data ("Atividade 3", "Atividade 4", …) every time a
                record is added or deleted. Nothing is lost: the count is visual
                redundancy over the list immediately below, and the subtitle already
                describes the region.
                ⚠ If the badge ever needs to leave the heading, move it OUT of the
                `h2` (where it lived before this card was rebuilt) rather than
                un-hiding it here. */}
            <span
              aria-hidden="true"
              className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums"
            >
              {events.length}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
            Registros da comissão e eventos do processo, em ordem cronológica.
          </p>
        </div>

        {/* Single-select partition. Toggle buttons with `aria-pressed` — the house
            pattern (`cases-view.tsx`), keyboard-native and announced as pressed.
            ⚠ The labels carry NO counts on purpose: a count inside the button
            becomes part of its accessible name, so every new record would rename
            the control the tester scopes to. The total lives in the header badge. */}
        <div
          role="group"
          aria-label="Filtrar atividade"
          className="flex flex-wrap items-center gap-1.5"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                pillClass(filter === f.key),
                "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {/* `runKey={filter}` re-runs the entrance when the partition changes, so a
          filter switch reads as the feed re-forming rather than as a silent swap.
          Decorative only — GSAP is a dynamic import, it bails under reduced motion,
          and the natural state is the no-JS baseline. */}
      <RiseInGroup runKey={filter}>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {canWrite
              ? "Nenhum registro ainda. Anote reuniões, decisões e notas de acompanhamento deste caso."
              : "Nenhum registro ainda."}
          </p>
        ) : shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nada por aqui com este filtro.
          </p>
        ) : (
          <ol className="flex flex-col">
            {shown.map((ev, index) => {
              const isLast = index === shown.length - 1;
              const { Icon, tint } = kindVisual(ev.kind);
              // ⛔ EDIT/DELETE ARE MANUAL-ONLY — and read the correction below before
              // trusting any claim about why.
              //
              // ⛔⛔ THIS SUPPRESSION IS CURRENTLY THE **ONLY** CONTROL, which means it
              // is doing a job Architecture Rule 1 says UI hiding must never do. Do not
              // remove it, and do not "simplify" it back to `canWrite`.
              //
              // ⚠ AN EARLIER VERSION OF THIS COMMENT CLAIMED THREE MECHANISMS REFUSE
              // THE WRITE. That was FALSE, and false in the reassuring direction. All
              // three constrain the **new** kind; none constrains **which row may be
              // touched** (measured from the live catalog 2026-08-23):
              //   · `case_events_writer_update` — USING is `app.can_write_case_content`
              //     with NO kind gate; `app.is_manual_case_event_kind(kind)` sits in
              //     WITH CHECK, so `decision_issued -> note` SATISFIES it (`note` is
              //     manual). It refuses SETTING a procedural kind, not EDITING a
              //     procedural row.
              //   · `case_events_writer_delete` — USING is `app.can_write_case_content`
              //     with no kind gate at all.
              //   · `updateCaseEvent`'s `isCaseEventKind` guard checks the SUBMITTED
              //     kind, which would be `note`. It passes too.
              // And there is no second lock: zero non-internal triggers on
              // `case_events`, no routine references both it and `audit_log`, and these
              // writes go direct-table over PostgREST rather than through a DEFINER.
              //
              // ⭐ So the consequence is WORSE than "an affordance that can only fail",
              // which is how the wrong version of this comment read. Un-suppressed, the
              // edit dialog would SUCCEED: its picker has no <option> for a procedural
              // kind, so the browser submits the first one and a `decision_issued` row
              // is silently rewritten to `Nota`. Delete would simply succeed.
              //
              // ⚠ The underlying authorization gap is PRE-EXISTING (D12's widening
              // exposed it; `listCaseEvents` has always returned these rows). Closing it
              // is a live authz change needing its own keystone and a diff-scoped door
              // sweep — deliberately NOT done in this batch; filed by the lead
              // 2026-08-23. `USING` and `WITH CHECK` answer different questions; quoting
              // whichever reads reassuringly is how a hole survives review.
              const manual = isCaseEventKind(ev.kind);
              const canModify = canWrite && manual;
              return (
                <li
                  key={ev.id}
                  data-rise
                  className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3"
                >
                  {/* Spine. Decorative: the kind is already stated by the row's
                      chip, so a screen reader gains nothing from the icon. */}
                  <div aria-hidden="true" className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        tint,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    {!isLast && <span className="my-1.5 w-px flex-1 bg-border" />}
                  </div>

                  <div className={cn("flex min-w-0 flex-col gap-1", !isLast && "pb-4")}>
                    <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase",
                          tint,
                        )}
                      >
                        {kindLabel(ev.kind)}
                      </span>
                      {/* ETH·E3a: an informational "coordinator only" marker. RLS
                          never delivers a coordinator_only row to a non-coordinator,
                          so the badge is a cue for coordinators, not a second gate. */}
                      {ev.visibility === "coordinator_only" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-warning uppercase">
                          <Lock aria-hidden="true" className="size-3" />
                          Somente coordenação
                        </span>
                      )}
                      {ev.title && (
                        <span className="text-sm font-medium text-foreground">
                          {ev.title}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-[0.7rem] whitespace-nowrap text-muted-foreground tabular-nums">
                        {ev.occurredAt
                          ? `${formatDueDate(ev.occurredAt)}${
                              ev.occurredTime ? ` · ${ev.occurredTime}` : ""
                            }`
                          : formatDate(ev.createdAt)}
                      </span>
                      {canModify && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditing(ev)}
                            aria-label={`Editar registro${ev.title ? ` ${ev.title}` : ""}`}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <ConfirmDeleteButton
                            action={() => deleteCaseEvent(ev.id)}
                            label={`Remover registro${ev.title ? ` ${ev.title}` : ""}`}
                            title="Remover este registro?"
                            description="O registro será removido permanentemente. Esta ação não pode ser desfeita."
                          />
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-foreground/90 text-pretty whitespace-pre-wrap">
                      {ev.body}
                    </p>

                    {ev.createdByName && (
                      <p className="text-xs text-muted-foreground">
                        {ev.createdByName}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </RiseInGroup>

      {/* Authoring footer — the SINGLE way in, replacing the inline composer
          (2026-08-24; supersedes the composer half of ADR 0137 D12). Bordered and
          below the feed, matching "Trabalho do caso" and "Trabalho do processo", so
          the card reads as a chronology with one action on it rather than a form
          wearing a timeline. Nothing is lost: `CaseEventForm` already offers Tipo,
          Visibilidade and the body the composer held, plus the título / data / hora
          the composer deliberately omitted. */}
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            className="w-fit"
          >
            <Plus aria-hidden="true" />
            Adicionar registro
          </Button>
        </div>
      )}

      {/* Mounted only while open — a fresh mount per open is what makes the dialog's
          uncontrolled `defaultValue`s reset between records instead of freezing on
          the first one. */}
      {canWrite && addOpen && (
        <CaseEventForm
          mode="create"
          open
          onOpenChange={(o) => !o && setAddOpen(false)}
          caseId={caseId}
          canSetVisibility={canSetVisibility}
        />
      )}
      {canWrite && editing && (
        <CaseEventForm
          mode="edit"
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          caseId={caseId}
          event={editing}
          canSetVisibility={canSetVisibility}
        />
      )}
    </section>
  );
}
