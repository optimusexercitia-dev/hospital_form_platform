"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Undo2,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";

import type { AnyCaseEventKind, CaseEvent } from "@/lib/queries/case-documents";
import {
  createCaseEvent,
  deleteCaseEvent,
  type ActionState,
} from "@/lib/cases/documents-actions";
import { CASE_EVENT_KINDS, isCaseEventKind } from "@/lib/cases/registro-kinds";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { NativeSelect } from "@/components/ui/native-select";
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
 * Exhaustive over {@link AnyCaseEventKind} by TYPE, so widening
 * `case_events_kind_check` cannot land without a visual for the new kind.
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

type ActivityFilter = "all" | "updates" | "system";

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "updates", label: "Atualizações" },
  { key: "system", label: "Sistema" },
];

/** Shared pill styling for the filter chips and the composer's kind segments. */
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
 * the platform emits, with a `Tudo / Atualizações / Sistema` partition, an inline
 * composer, and a connector-spine timeline.
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
 * inline composer, the `2rem 1fr` timeline grid with a connector spine, tinted icon
 * circles and matching type chips, and the empty-filter state.
 * ⛔ **The composer's four-type vocabulary was NOT adopted** — `Progresso / Nota /
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState<CaseEvent | null>(null);

  // Composer state. `kind` and `body` are lifted so the "Mais detalhes" escape
  // hatch can carry what has already been typed into the full dialog instead of
  // making the author retype it.
  const [kind, setKind] = useState<string>("note");
  const [body, setBody] = useState("");

  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(createCaseEvent, undefined);

  // Clear the textarea on a successful submit. Reconciled DURING RENDER (React's
  // "adjust state when a prop changes" idiom, already used by
  // `case-narrative-card.tsx`) rather than from an effect: a synchronous setState
  // inside an effect body cascades renders and `react-hooks/set-state-in-effect`
  // fails the lint gate on it.
  //
  // ⚠ The composer SURVIVES its own success — it stays mounted — which is what makes
  // owning this reset legitimate at all. A dialog could not: it unmounts in the same
  // commit, so anything it set would never paint.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state?.ok) setBody("");
  }

  // `router.refresh()` is a call into an external system, not a state update, so it
  // belongs in an effect and does not trip the rule above.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const shown = useMemo(
    () =>
      events.filter((ev) => {
        if (filter === "all") return true;
        const manual = isCaseEventKind(ev.kind);
        return filter === "updates" ? manual : !manual;
      }),
    [events, filter],
  );

  const bodyError = state && !state.ok ? state.fieldErrors?.body : undefined;
  const bannerError =
    state && !state.ok && !state.fieldErrors?.body ? state.error : null;

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

      {canWrite && (
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-xl border border-border bg-muted/35 p-3"
          noValidate
        >
          <input type="hidden" name="caseId" value={caseId} />

          {bannerError && <FormBanner tone="error">{bannerError}</FormBanner>}

          {/* Segmented kind picker. Real radios inside a fieldset: native
              arrow-key traversal and one accessible group name, which a row of
              `aria-pressed` buttons would not give (they read as six independent
              toggles). The input is `sr-only`; the visible pill takes the focus
              ring through `peer-focus-visible`. */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-medium text-muted-foreground">
              Tipo do registro
            </legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {CASE_EVENT_KINDS.map((k) => (
                <label key={k} className="cursor-pointer">
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                    disabled={isPending}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      pillClass(kind === k),
                      "peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40",
                    )}
                  >
                    {EVENT_KIND_LABEL[k]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="sr-only">Descrição do registro</span>
            <textarea
              name="body"
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isPending}
              placeholder="Descreva uma nota, reunião, decisão ou acompanhamento… Nunca inclua dados de paciente."
              aria-invalid={bodyError ? true : undefined}
              className="min-h-16 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {bodyError && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {bodyError}
              </span>
            )}
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* ETH·E3a: only a coordinator may narrow a record to the coordination.
                A non-coordinator's composer omits the control entirely and the row
                keeps the server-side default `case_readers`. */}
            {canSetVisibility && (
              <label className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Visibilidade</span>
                <NativeSelect
                  name="visibility"
                  defaultValue="case_readers"
                  disabled={isPending}
                  className="h-8 w-auto py-0 text-xs"
                >
                  <option value="case_readers">Todos os leitores do caso</option>
                  <option value="coordinator_only">Somente coordenação</option>
                </NativeSelect>
              </label>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDetailsOpen(true)}
              disabled={isPending}
            >
              <SlidersHorizontal aria-hidden="true" />
              Mais detalhes
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
              <Send aria-hidden="true" />
              {isPending ? "Registrando…" : "Registrar"}
            </Button>
          </div>
        </form>
      )}

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
              const { Icon, tint } = KIND_VISUAL[ev.kind];
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
                        {EVENT_KIND_LABEL[ev.kind]}
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

      {/* The full authoring form stays available for the fields the inline composer
          deliberately omits — título, data and hora. Mounted only while open so its
          uncontrolled `defaultValue`s pick up whatever the composer already holds
          (a fresh mount is the prefill mechanism). */}
      {canWrite && detailsOpen && (
        <CaseEventForm
          mode="create"
          open
          onOpenChange={(o) => {
            if (o) return;
            setDetailsOpen(false);
            // The dialog took over authorship of this draft; clearing the composer
            // stops the same text sitting in two places at once.
            setBody("");
          }}
          caseId={caseId}
          canSetVisibility={canSetVisibility}
          initialKind={kind}
          initialBody={body}
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
