"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  EyeOff,
  Lock,
  Pencil,
  PenLine,
  User,
  UserPlus,
  X,
} from "lucide-react";

import {
  concludeReferralNote,
  assignReferralNote,
  redactReferralNote,
  unassignReferralNote,
  updateReferralInternalNote,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type { ReferralInternalNote } from "@/lib/referrals/types";
import {
  CASE_EVENT_KINDS,
  CASE_EVENT_KIND_LABELS,
  type CaseEventKind,
} from "@/lib/cases/registro-kinds";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { FormBanner } from "@/components/auth/form-banner";
import { cn } from "@/lib/utils";
import { ReferralRedactDialog } from "./referral-redact-dialog";
import { REFERRAL_META_CHIP_BASE, referralTypeChipClass } from "./format";
import { formatDateTime } from "./format";
import type { AssignableMember } from "./referral-assignment-panel";

const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * One "Registro interno" (`referral_internal_notes`, promoted by RDR / ADR 0109) —
 * the referral-side mirror of {@link import('@/components/cases/case-narrative-card').CaseNarrativeCard}:
 * a titled, typed, assignable Markdown record with a one-way `open → concluded`
 * lifecycle.
 *
 * 🔴 Rule 7 (stored-XSS) is enforced at RENDER, not at write: registro bodies are
 * stored VERBATIM (plan amendment A11 — the "write-time sanitizer" the plan referred
 * to does not exist). {@link MarkdownRenderer} (react-markdown + `rehype-sanitize`,
 * no `rehype-raw`) is therefore the ONLY thing standing between a pasted `<script>`
 * and execution. `bodyMd` must never be rendered as bare text into HTML-bearing
 * markup, through `dangerouslySetInnerHTML`, or through a second renderer.
 *
 * K-R5-1 is untouched: this card only ever receives notes the audited door already
 * scoped to the viewer's OWN committee side. Every control mirrors an RPC gate,
 * which re-checks (42501 / HC0A9) — the UI gating only keeps dead affordances away.
 */
export function ReferralNoteCard({
  note,
  canEdit,
  canAssign,
  canRedact,
  members,
}: {
  note: ReferralInternalNote;
  /**
   * Whether the viewer may edit AND conclude this registro — the UI mirror of
   * `app.can_edit_referral_internal_note`: the registro is open and un-redacted, and
   * the viewer is its author, its assignee, or a coordinator of its own side. Edit
   * and conclude share that exact authority set, so they share one flag rather than
   * two that can silently disagree.
   */
  canEdit: boolean;
  /** Whether the viewer may set/clear the assignee (side coordinator, open note). */
  canAssign: boolean;
  /** Whether the viewer may redact (side coordinator; open OR concluded — D10). */
  canRedact: boolean;
  /** The viewer's-side roster for the assignee menu; `[]` when !canAssign. */
  members: AssignableMember[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [redactOpen, setRedactOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.bodyMd);
  const [kind, setKind] = useState<CaseEventKind>(note.kind);

  const redacted = Boolean(note.redactedAt);
  const concluded = note.status === "concluded";
  const headingId = `referral-note-${note.id}-heading`;
  const kindLabel = CASE_EVENT_KIND_LABELS[note.kind];
  const heading = note.title || kindLabel;

  function startEdit() {
    setError(null);
    setTitle(note.title ?? "");
    setBody(note.bodyMd);
    setKind(note.kind);
    setEditing(true);
  }

  function save() {
    setError(null);
    if (!body.trim()) {
      setError(REFERRAL_MESSAGES.noteBodyRequired);
      return;
    }
    startTransition(async () => {
      const result = await updateReferralInternalNote({
        noteId: note.id,
        title: title.trim() || null,
        bodyMd: body.trim(),
        kind,
      });
      if (!result.ok) {
        setError(
          result.fieldErrors?.bodyMd ?? result.error ?? REFERRAL_MESSAGES.generic,
        );
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  /** Run a one-shot lifecycle action, surfacing its pt-BR error on failure. */
  function run(thunk: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await thunk();
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3.5"
      aria-labelledby={headingId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <RegistroStatusPill concluded={concluded} />
            <span
              className={cn(REFERRAL_META_CHIP_BASE, referralTypeChipClass(null))}
            >
              {kindLabel}
            </span>
            {redacted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                <EyeOff aria-hidden="true" className="size-3" />
                Tarjado
              </span>
            ) : null}
          </div>
          <h3 id={headingId} className="text-sm font-semibold text-pretty">
            {heading}
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{note.authorName ?? "Membro"}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatDateTime(note.createdAt)}</span>
            {note.assignedToName ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <User aria-hidden="true" className="size-3" />
                  {note.assignedToName}
                </span>
              </>
            ) : null}
          </p>
        </div>

        {!editing && canEdit && !redacted ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={startEdit}
            aria-label={`Editar o registro ${heading}`}
          >
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        ) : null}
      </div>

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {editing ? (
        <div className="flex flex-col gap-3">
          {/* Explicit `htmlFor`/`id` association: a `<label>` WRAPPING a `<select>`
              absorbs every option's text into its own text content and corrupts the
              computed accessible name. */}
          <div className="flex flex-col gap-1.5 text-sm">
            <label
              htmlFor={`referral-note-title-${note.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Título <span className="font-normal">(opcional)</span>
            </label>
            <input
              id={`referral-note-title-${note.id}`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FIELD_CLASS}
              disabled={isPending}
              placeholder="Ex.: Alinhamento com a farmácia"
            />
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <label
              htmlFor={`referral-note-type-${note.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Tipo
            </label>
            <NativeSelect
              id={`referral-note-type-${note.id}`}
              value={kind}
              onChange={(e) => setKind(e.target.value as CaseEventKind)}
              disabled={isPending}
              className="py-2"
            >
              {CASE_EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CASE_EVENT_KIND_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* `SectionTextEditor` owns the textarea, so its label points at it by id
              rather than wrapping it. */}
          <label
            htmlFor={`referral-note-body-${note.id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Registro
          </label>
          <SectionTextEditor
            value={body}
            onChange={setBody}
            disabled={isPending}
            textareaId={`referral-note-body-${note.id}`}
            placeholder="Escreva este registro em Markdown… Visível apenas à sua comissão."
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : redacted ? (
        <p className="inline-flex items-start gap-1.5 text-sm text-muted-foreground italic">
          <EyeOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="text-pretty">
            [redigido]
            {note.redactedReason ? ` — ${note.redactedReason}` : ""}
          </span>
        </p>
      ) : (
        // 🔴 A11 — the ONLY sanitizing surface for a verbatim-stored body (Rule 7).
        <div className="rounded-lg border border-border bg-card p-3">
          <MarkdownRenderer content={note.bodyMd} />
        </div>
      )}

      {!editing && (canAssign || canEdit || canRedact) ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {canAssign ? (
            <AssignMenu
              heading={heading}
              members={members}
              assignedTo={note.assignedTo}
              assigneeName={note.assignedToName}
              disabled={isPending}
              onAssign={(userId) => run(() => assignReferralNote(note.id, userId))}
              onUnassign={() => run(() => unassignReferralNote(note.id))}
            />
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => concludeReferralNote(note.id))}
            >
              <CheckCircle2 aria-hidden="true" />
              Concluir
            </Button>
          ) : null}
          {canRedact && !redacted ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRedactOpen(true)}
            >
              <EyeOff aria-hidden="true" />
              Tarjar
            </Button>
          ) : null}
        </div>
      ) : null}

      {canRedact && !redacted ? (
        <ReferralRedactDialog
          open={redactOpen}
          onOpenChange={setRedactOpen}
          kind="note"
          onRedact={(reason) => redactReferralNote({ noteId: note.id, reason })}
        />
      ) : null}
    </li>
  );
}

/**
 * The registro lifecycle pill — icon + text + shape, never colour alone (design
 * system §2/§6). Cribbed from `narrative-status-pill.tsx`; the referral lifecycle
 * has only two states (there is no reopen and no void — plan D10).
 */
function RegistroStatusPill({ concluded }: { concluded: boolean }) {
  const Icon = concluded ? Lock : PenLine;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        concluded
          ? "bg-success/12 text-success dark:bg-success/15"
          : "bg-warning/15 text-warning",
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {concluded ? "Concluído" : "Aberto"}
    </span>
  );
}

/** Set / change / clear the registro's responsible member (side coordinator). */
function AssignMenu({
  heading,
  members,
  assignedTo,
  assigneeName,
  disabled,
  onAssign,
  onUnassign,
}: {
  heading: string;
  members: AssignableMember[];
  assignedTo: string | null;
  assigneeName: string | null;
  disabled: boolean;
  onAssign: (userId: string) => void;
  onUnassign: () => void;
}) {
  const assigned = assignedTo != null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || members.length === 0}
          aria-label={`Responsável pelo registro ${heading}`}
        >
          {assigned ? (
            <>
              <User aria-hidden="true" />
              {assigneeName ?? "Responsável"}
            </>
          ) : (
            <>
              <UserPlus aria-hidden="true" />
              Atribuir
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Responsável</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {members.map((m) => {
          const isCurrent = m.userId === assignedTo;
          return (
            <DropdownMenuItem
              key={m.userId}
              className="gap-2"
              onSelect={() => {
                if (!isCurrent) onAssign(m.userId);
              }}
            >
              <Check
                aria-hidden="true"
                className={cn("size-4", isCurrent ? "opacity-100" : "opacity-0")}
              />
              {m.fullName ?? "Membro"}
            </DropdownMenuItem>
          );
        })}
        {assigned ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onSelect={onUnassign}
            >
              <X aria-hidden="true" className="size-4" />
              Remover responsável
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
