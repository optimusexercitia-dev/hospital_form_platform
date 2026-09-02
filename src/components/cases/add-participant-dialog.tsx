"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, UserPlus } from "lucide-react";

import type { ParticipantType } from "@/lib/queries/cases";
import type {
  CaseParticipantRoleOption,
  ParticipantSearchResult,
} from "@/lib/queries/participants";
// Client-safe by construction — @/lib/queries/participants is `server-only`, so a
// VALUE import from it here aborts `next build` (BUG-FBE-005). Types above erase.
import { EXTERNAL_PARTICIPANT_TYPES } from "@/lib/forms/reference-constants";
import type { AddableUser } from "@/lib/queries/members";
import type { ProfessionalLinkState } from "@/lib/participants/actions";
import {
  addCaseParticipant,
  createExternalParticipant,
  createProfessionalProfile,
  searchParticipantCandidates,
  setProfessionalLinkState,
} from "@/lib/participants/actions";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";

/** How long the field stays quiet after the last keystroke before searching. */
const DEBOUNCE_MS = 250;

/**
 * The pt-BR label set for the five NON-SENSITIVE registry types the external
 * lane may mint (ADR 0108 D8). Fixed by the locator contract (§2b) — do not
 * reorder or reword.
 */
const EXTERNAL_TYPE_LABELS: Record<string, string> = {
  external_person: "Pessoa externa",
  department: "Setor",
  institution: "Instituição",
  regulatory_body: "Órgão regulador",
  other: "Outro",
};

/**
 * The linkage-choice fieldset (ADR 0108 D6): shared byte-for-byte between the
 * "cadastrar novo profissional" form here and `resolve-linkage-dialog.tsx`, so
 * the two surfaces can never drift on the audited confirmation string.
 *
 * **No default** — `linkState` starts `null` and stays `null` until the
 * coordinator clicks a radio; the caller's submit-disabled logic keys off that.
 * `no_account` additionally requires the explicit consequence-naming checkbox.
 */
export function LinkageResolutionFieldset({
  linkState,
  onLinkStateChange,
  userId,
  onUserIdChange,
  confirmed,
  onConfirmedChange,
  users,
  disabled = false,
}: {
  linkState: Extract<ProfessionalLinkState, "linked" | "no_account"> | null;
  onLinkStateChange: (value: "linked" | "no_account") => void;
  userId: string | null;
  onUserIdChange: (value: string | null) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  /** The org roster to pick the platform user from. */
  users: AddableUser[];
  disabled?: boolean;
}) {
  const groupId = useId();
  const legendId = `${groupId}-legend`;
  const radioName = `${groupId}-link-state`;
  const userField = useFieldIds("platform-user", { id: `${groupId}-user` });

  return (
    <fieldset
      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/10 p-3.5"
      disabled={disabled}
    >
      <legend id={legendId} className="px-1 text-sm font-medium">
        Vínculo com conta na plataforma
      </legend>

      <div
        role="radiogroup"
        aria-labelledby={legendId}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <label
          className={cn(
            "flex cursor-pointer items-start gap-2 rounded-lg border border-input bg-card px-3 py-2.5 text-sm transition-colors",
            "has-[:checked]:border-primary has-[:checked]:bg-accent/40",
            "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
          )}
        >
          <input
            type="radio"
            name={radioName}
            value="linked"
            checked={linkState === "linked"}
            onChange={() => onLinkStateChange("linked")}
            className="mt-0.5 accent-primary"
          />
          Possui conta
        </label>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-2 rounded-lg border border-input bg-card px-3 py-2.5 text-sm transition-colors",
            "has-[:checked]:border-primary has-[:checked]:bg-accent/40",
            "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
          )}
        >
          <input
            type="radio"
            name={radioName}
            value="no_account"
            checked={linkState === "no_account"}
            onChange={() => onLinkStateChange("no_account")}
            className="mt-0.5 accent-primary"
          />
          Não possui conta
        </label>
      </div>

      {linkState === "linked" && (
        <PlatformUserField
          id={userField.controlProps.id}
          users={users}
          userId={userId}
          onUserIdChange={onUserIdChange}
          disabled={disabled}
        />
      )}

      {linkState === "no_account" && (
        <label className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-sm text-pretty">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(v) => onConfirmedChange(v === true)}
            className="mt-0.5 shrink-0"
          />
          Confirmo que este profissional não possui conta na plataforma e que,
          por isso, o impedimento automático no caso não será aplicado.
        </label>
      )}
    </fieldset>
  );
}

/**
 * BUG-ETHE4-FOCUS-1 fix (root cause, not a call-site patch). Radix's
 * `DismissableLayer` (behind `Dialog.Content`) listens for Escape on
 * `document` in the CAPTURE phase (`@radix-ui/react-use-escape-keydown`) —
 * BEFORE a nested `<input>`'s own bubble-phase `onKeyDown` ever runs. A child
 * widget's `event.stopPropagation()` is therefore always too late to stop the
 * Dialog from dismissing; the only lever Radix offers is `event.preventDefault()`
 * inside the Dialog's own `onEscapeKeyDown` prop (which `DismissableLayer`
 * checks via `!event.defaultPrevented` before calling `onDismiss`).
 *
 * Wire this to `<DialogContent onEscapeKeyDown={suppressEscapeWhilePopupOpen}>`.
 * It reads `aria-expanded` off `event.target` — the SAME state
 * {@link TypeaheadField} already keeps in sync via its `open` state, so this
 * needs no extra ref/prop plumbing to know whether a nested combobox popup is
 * open. When it IS: `preventDefault()` keeps the Dialog open; the event still
 * continues to bubble (this does not call `stopPropagation`), so
 * `TypeaheadField`'s own bubble-phase handler still runs afterward and closes
 * just the popup. When the popup is NOT open, this is a no-op and Escape does
 * whatever the Dialog primitive normally does (closes it) — never a silent
 * in-place state reset while staying open.
 */
export function suppressEscapeWhilePopupOpen(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (
    target?.getAttribute("role") === "combobox" &&
    target.getAttribute("aria-expanded") === "true"
  ) {
    event.preventDefault();
  }
}

/**
 * The polite announcement for {@link TypeaheadField}'s popup (FUP-ETH-A11Y-1
 * m4). The popup's loading row, empty hint and result list all sit OUTSIDE the
 * listbox `aria-controls` points at, so nothing about them ever reached a
 * screen reader.
 *
 * Deliberately worded so that **no string here duplicates a visible one** in
 * this dialog. Re-emitting "Buscando…" or "Nenhum resultado. Você pode
 * cadastrar um novo." into an `sr-only` node would give each of those a second
 * DOM match and put every future `getByText` on them into Playwright strict-mode
 * violation — the exact reason this item was filed rather than fixed in ETH·E4.
 * For the same reason the listbox's own `aria-label` ("Opções para {label}",
 * which `pickFromTypeahead` scopes on) is left byte-for-byte alone.
 *
 * The error path announces NOTHING: the visible message already carries
 * `role="alert"`, which is both louder and earlier than a polite region, and
 * mirroring it here would announce the same sentence twice.
 */
function typeaheadLiveStatus({
  open,
  loading,
  error,
  count,
  emptyAnnouncement,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  count: number;
  emptyAnnouncement: string | null;
}): string {
  if (!open) return "";
  if (loading) return "Carregando resultados…";
  if (error) return "";
  if (count === 0) return emptyAnnouncement ?? "";
  return count === 1
    ? "1 opção disponível. Use as setas para navegar e Enter para escolher."
    : `${count} opções disponíveis. Use as setas para navegar e Enter para escolher.`;
}

/**
 * A minimal accessible typeahead: combobox input + a listbox of options.
 * Generic over the item type so it serves both the async participant search
 * (§2a/§2b "Buscar profissional" / "Buscar participante externo") and the
 * client-side-filtered platform-user pick (§2a "Usuário da plataforma" — the
 * org roster is already fully loaded, so that one never hits the network).
 */
function TypeaheadField<T>({
  id,
  label,
  placeholder,
  items,
  loading = false,
  error = null,
  query,
  onQueryChange,
  onPick,
  getKey,
  getLabel,
  renderOption,
  emptyHint,
  emptyAnnouncement = null,
  disabled = false,
}: {
  id: string;
  label: string;
  placeholder?: string;
  items: T[];
  /** Only the async (server-searched) fields pass this; the client-filtered
   *  platform-user picker has nothing to wait on. */
  loading?: boolean;
  /**
   * MAJOR-2(a) (QA r2) — a FAILED search, distinct from a search that
   * genuinely found nothing. Only the async (server-searched) fields pass
   * this. When set, it takes priority over `emptyHint`: "Nenhum resultado.
   * Você pode cadastrar um novo." is the wrong thing to tell a coordinator
   * whose search never actually ran — it invites minting a duplicate (or, on
   * the professional lane, reaching for "não possui conta", which makes the
   * case exclusion vacuously satisfied).
   */
  error?: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onPick: (item: T) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  renderOption?: (item: T) => React.ReactNode;
  /** Copy shown under the list when it is open, empty, AND not erroring. */
  emptyHint?: string;
  /**
   * The `sr-only` sentence for that same empty state (FUP-ETH-A11Y-1 m4).
   * Paired with `emptyHint` rather than derived from it: re-emitting the
   * visible hint verbatim would give that sentence a second DOM node and put
   * every `getByText` on it into a Playwright strict-mode violation, which is
   * exactly why m4 was deferred out of ETH·E4. `null` announces nothing — which
   * is what a search
   * that has not run yet ("Digite ao menos 2 letras") deserves, since "nenhuma
   * opção" would be a claim about a search nobody performed.
   */
  emptyAnnouncement?: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = `${id}-listbox`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (items.length === 0) return;
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (items.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (!open) return;
      const picked = items[activeIndex];
      if (!picked) return;
      e.preventDefault();
      onPick(picked);
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showList = open && !loading && !error && items.length > 0;
  const showError = open && !loading && Boolean(error);
  const showEmpty = open && !loading && !error && items.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <div className="relative flex items-center">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          />
          <input
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 0)}
            onKeyDown={handleKeyDown}
            className={cn(
              "h-10 w-full rounded-lg border border-input bg-card py-2 pr-9 pl-9 text-sm shadow-xs",
              "transition-colors duration-(--dur-fast) ease-(--ease-out-soft)",
              "placeholder:text-muted-foreground/70",
              "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          {loading && (
            <Loader2
              aria-hidden="true"
              className="absolute right-3 size-4 animate-spin text-muted-foreground"
            />
          )}
        </div>

        {open && (
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <ul
              id={listboxId}
              role="listbox"
              aria-label={`Opções para ${label}`}
              className="max-h-56 overflow-y-auto py-1"
            >
              {showList
                ? items.map((item, i) => (
                    <li
                      key={getKey(item)}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === activeIndex}
                      onClick={() => {
                        onPick(item);
                        setOpen(false);
                        setActiveIndex(-1);
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm",
                        i === activeIndex && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 invisible"
                      />
                      {renderOption ? (
                        renderOption(item)
                      ) : (
                        <span className="truncate font-medium">
                          {getLabel(item)}
                        </span>
                      )}
                    </li>
                  ))
                : null}
            </ul>
            {loading ? (
              <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
                Buscando…
              </p>
            ) : showError ? (
              <p
                role="alert"
                className="px-3 py-3 text-sm font-medium text-destructive text-pretty"
              >
                {error}
              </p>
            ) : showEmpty && emptyHint ? (
              <p className="px-3 py-3 text-sm text-muted-foreground text-pretty">
                {emptyHint}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* FUP-ETH-A11Y-1 m4. Mounted unconditionally, OUTSIDE the `{open && …}`
          popup: a live region inserted into the DOM already holding its text is
          not reliably announced — the region has to exist before the text
          changes. Mirrors `reference-picker.tsx`'s treatment of the same
          pattern. */}
      <p role="status" aria-live="polite" className="sr-only">
        {typeaheadLiveStatus({
          open,
          loading,
          error,
          count: items.length,
          emptyAnnouncement,
        })}
      </p>
    </div>
  );
}

/**
 * The "Usuário da plataforma" pick (§2a). The org roster (`users`) is already
 * fully loaded by the host page — this filters CLIENT-SIDE as the coordinator
 * types, never a network round trip, so it stays a real `combobox` + listbox
 * (not a `<select>`) without needing a server search action.
 */
function PlatformUserField({
  id,
  users,
  userId,
  onUserIdChange,
  disabled = false,
}: {
  id: string;
  users: AddableUser[];
  userId: string | null;
  onUserIdChange: (userId: string) => void;
  disabled?: boolean;
}) {
  const selected = users.find((u) => u.userId === userId) ?? null;
  const [query, setQuery] = useState(
    selected ? (selected.fullName ?? selected.email ?? "") : "",
  );
  const term = query.trim().toLowerCase();
  const filtered =
    term === ""
      ? users
      : users.filter((u) =>
          `${u.fullName ?? ""} ${u.email ?? ""}`.toLowerCase().includes(term),
        );

  return (
    <TypeaheadField
      id={id}
      label="Usuário da plataforma"
      placeholder="Nome ou e-mail…"
      items={filtered}
      query={query}
      onQueryChange={setQuery}
      onPick={(u) => {
        onUserIdChange(u.userId);
        setQuery(u.fullName ?? u.email ?? "");
      }}
      getKey={(u) => u.userId}
      getLabel={(u) => u.fullName ?? u.email ?? u.userId}
      emptyHint="Nenhum usuário encontrado."
      // This lane filters an already-loaded roster, so an empty list is always
      // a real, completed answer — never "not searched yet".
      emptyAnnouncement="Nenhuma opção disponível."
      disabled={disabled}
    />
  );
}

type Lane = "professional" | "external";
type LaneMode = "search" | "create";

const EMPTY_PROF_DRAFT = {
  fullName: "",
  professionalType: "",
  licenseNumber: "",
  licenseRegion: "",
  specialty: "",
};

/**
 * The single add-participant dialog behind two lanes (ADR 0108 D6/D8 · locator
 * contract §2/§2a/§2b): a professional (typeahead over `professional_profiles`,
 * or an inline "cadastrar novo profissional" form) or an external person/entity
 * (reuse-first search over the registry, or "cadastrar novo").
 *
 * The platform-account linkage choice (§2a) carries NO default (D6) — it is an
 * audited human assertion, so accepting a default must never be possible. It
 * shows inline whenever it is actually needed: for a brand-new professional
 * profile, or for an EXISTING profile picked from search whose linkage is
 * still `unknown` — so `HC0F0` is never reached in the normal add flow.
 */
export function AddParticipantDialog({
  caseId,
  organizationId,
  roles,
  platformUsers,
  roleVocabularyHref = null,
  open,
  onOpenChange,
}: {
  caseId: string;
  organizationId: string;
  /** The case's full active role vocabulary (org-wide + this case type's own). */
  roles: CaseParticipantRoleOption[];
  /** The org roster for the "possui conta" platform-user pick. */
  platformUsers: AddableUser[];
  /**
   * Href of the org vocabulary admin, or `null` when this viewer cannot reach it.
   *
   * Only the "no role accepts this type" empty state uses it. The host must pass
   * `null` unless BOTH gates on `/o/[org]/manage/tipos-de-caso` hold — org_admin of
   * THIS org and the `case_types` flag — because that page `notFound()`s on either,
   * and a dead link here is worse than the plain sentence it replaces.
   *
   * ⚠ The dead end this addresses is real and not seeded away: `department`,
   * `institution` and `other` are mintable by `create_external_participant` but no
   * seeded role accepts them, and `case_participants.role_id` is NOT NULL. Beyond the
   * local fixture the gap is wider still — the ethics role bundle lives only in
   * `supabase/seed.sql`, so a production org authors its whole vocabulary there.
   * PO-ratified 2026-08-11: name the remedy, do not filter the type list (the five
   * labels are fixed by the ETH·E4 locator contract §2b) and do not seed roles.
   */
  roleVocabularyHref?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [lane, setLane] = useState<Lane>("professional");
  const [profMode, setProfMode] = useState<LaneMode>("search");
  const [extMode, setExtMode] = useState<LaneMode>("search");

  // Professional lane
  const [profQuery, setProfQuery] = useState("");
  const [profResults, setProfResults] = useState<ParticipantSearchResult[]>([]);
  const [profSearching, setProfSearching] = useState(false);
  // MAJOR-2(a) (QA r2): a FAILED search is not "no results" — the empty-state
  // copy ("Nenhum resultado. Você pode cadastrar um novo.") is exactly the
  // sentence that walks a coordinator to minting a duplicate, or — on the
  // professional lane — to "não possui conta", which makes the case exclusion
  // vacuously satisfied. This must read as an error, distinctly.
  const [profSearchError, setProfSearchError] = useState<string | null>(null);
  const [selectedProf, setSelectedProf] = useState<ParticipantSearchResult | null>(null);
  const [profDraft, setProfDraft] = useState(EMPTY_PROF_DRAFT);
  /**
   * MAJOR-6 (QA r2 correction) — the professional lane's own mint-then-fail
   * memo. The 7900f51 commit note claiming this lane was "immune because its
   * mint is get-or-create" was WRONG: `ensure_professional_participant` (the
   * REGISTRY link) is get-or-create, but `createProfessionalProfile` — the
   * call this create-inline form actually makes — is a bare `insert …
   * returning id`, no `on conflict`, no lookup (verified against `pg_proc`).
   * A mint that succeeds followed by a failure in the linkage step or
   * `addCaseParticipant` therefore discards `profileId` exactly like the
   * external lane did, and retrying `submit()` mints a second profile —
   * silently when CRM is blank, or dead-ending on a `23505` when one is
   * entered. Same fix, same shape as `mintedExternalId` below: retain the id
   * and the (fullName, professionalType, licenseNumber, licenseRegion,
   * specialty) it was minted for — `userId`/linkage is deliberately EXCLUDED
   * from the identity, since picking a different platform account for the
   * SAME named profile is a linkage correction, not a different person.
   */
  const [mintedProfessionalId, setMintedProfessionalId] = useState<
    string | null
  >(null);
  const [mintedProfessionalIdentity, setMintedProfessionalIdentity] =
    useState<{
      fullName: string;
      professionalType: string | null;
      licenseNumber: string | null;
      licenseRegion: string | null;
      specialty: string | null;
    } | null>(null);

  // External lane
  const [extQuery, setExtQuery] = useState("");
  const [extResults, setExtResults] = useState<ParticipantSearchResult[]>([]);
  const [extSearching, setExtSearching] = useState(false);
  // MAJOR-2(a) — same distinction as `profSearchError`.
  const [extSearchError, setExtSearchError] = useState<string | null>(null);
  const [selectedExt, setSelectedExt] = useState<ParticipantSearchResult | null>(null);
  const [extType, setExtType] = useState<ParticipantType>("external_person");
  const [extName, setExtName] = useState("");
  // MAJOR-6 (QA): `createExternalParticipant` is create-always (ADR 0108 D8 —
  // an external person has no natural key, so dedup-by-name would silently
  // merge distinct people). If the mint succeeds but the subsequent
  // `addCaseParticipant` fails, the `participants` row is already committed;
  // retrying `submit()` must NOT mint a second one for the same pending
  // creation. `mintedExternalId` retains the id across a retry;
  // `mintedExternalIdentity` is the (type, name) it was minted FOR, so a
  // genuinely different identity (the user edited Tipo or Nome) is correctly
  // treated as a different person and mints afresh. Both clear via `resetAll`
  // when the dialog closes. Fixing this server-side would need an atomic
  // `seat_external` door duplicating `add_case_participant`'s authorization/
  // audit/`HC0F0` logic — exactly what ADR 0108 D1 rejected — so the retry
  // state belongs here, not in a new RPC.
  //
  // The professional lane needed the SAME fix — see `mintedProfessionalId`
  // below (`profDraft`). It is NOT covered by this one: `createExternalParticipant`
  // and `createProfessionalProfile` are two different doors with two different
  // memos, kept next to the state each one guards.
  const [mintedExternalId, setMintedExternalId] = useState<string | null>(null);
  const [mintedExternalIdentity, setMintedExternalIdentity] = useState<{
    type: ParticipantType;
    name: string;
  } | null>(null);

  // Linkage (D6) — shared by both professional paths that need it.
  const [linkState, setLinkState] = useState<"linked" | "no_account" | null>(null);
  const [linkUserId, setLinkUserId] = useState<string | null>(null);
  const [linkConfirmed, setLinkConfirmed] = useState(false);

  // Role + involvement
  const [roleId, setRoleId] = useState("");
  const [involvementSummary, setInvolvementSummary] = useState("");

  const summaryField = useFieldIds("participant-summary");
  const laneLegendId = useId();
  // FUP-ETH-A11Y-1 m3: every field that can carry an error declares it to
  // `useFieldIds`, so `aria-describedby` reaches the `FieldError` id below.
  // `FieldError`'s `role="alert"` only announces the message the moment it
  // appears; without the wiring, a user who tabs BACK to the invalid control
  // hears the label and nothing else.
  const nameField = useFieldIds("prof-full-name", {
    hasError: Boolean(fieldErrors.fullName),
  });
  const typeField = useFieldIds("prof-type");
  const licenseField = useFieldIds("prof-license");
  const regionField = useFieldIds("prof-license-region");
  const specialtyField = useFieldIds("prof-specialty");
  const extTypeField = useFieldIds("ext-type");
  const extNameField = useFieldIds("ext-name", {
    hasError: Boolean(fieldErrors.displayName),
  });

  const searchSeq = useRef(0);

  const resetAll = useCallback(() => {
    setLane("professional");
    setProfMode("search");
    setExtMode("search");
    setProfQuery("");
    setProfResults([]);
    setProfSearchError(null);
    setSelectedProf(null);
    setProfDraft(EMPTY_PROF_DRAFT);
    setMintedProfessionalId(null);
    setMintedProfessionalIdentity(null);
    setExtQuery("");
    setExtResults([]);
    setExtSearchError(null);
    setSelectedExt(null);
    setExtType("external_person");
    setExtName("");
    setMintedExternalId(null);
    setMintedExternalIdentity(null);
    setLinkState(null);
    setLinkUserId(null);
    setLinkConfirmed(false);
    setRoleId("");
    setInvolvementSummary("");
    setError(null);
    setFieldErrors({});
  }, []);

  // The state-setting logic lives in its own `useCallback`, invoked from the
  // effect only via `void runProfSearch(...)` inside the debounce timer — the
  // effect body itself never calls `setState` directly (mirrors
  // `reference-picker.tsx`'s `runSearch`/effect split; react-hooks/set-state-in-effect
  // flags a synchronous setState in the effect body, not one reached through a
  // separately-defined async callback).
  const runProfSearch = useCallback(
    async (term: string) => {
      const seq = ++searchSeq.current;
      setProfSearching(true);
      const res = await searchParticipantCandidates(organizationId, term, [
        "professional",
      ]);
      if (seq !== searchSeq.current) return;
      setProfSearching(false);
      if (res.ok) {
        setProfSearchError(null);
        setProfResults(res.candidates);
      } else {
        // MAJOR-2(a): a failed search must never fall through to the
        // "Nenhum resultado" empty state — that copy explicitly invites
        // creating a new profile, which is exactly wrong when the search
        // itself couldn't run. Drop any stale results so they can't be
        // mistaken for a completed, empty search.
        setProfSearchError(
          res.error ?? "Não foi possível buscar profissionais. Tente novamente.",
        );
        setProfResults([]);
      }
    },
    [organizationId],
  );

  // Debounced professional search. A too-short query is handled WITHOUT a
  // setState call: `profResults` / `profSearching` are only ever rendered
  // through the `visibleProfResults` / `profSearchVisible` derivations below,
  // which fold "query too short" into "nothing to show" directly.
  useEffect(() => {
    if (!open || lane !== "professional" || profMode !== "search") return;
    const term = profQuery.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      void runProfSearch(term);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, lane, profMode, profQuery, runProfSearch]);

  const runExtSearch = useCallback(
    async (term: string) => {
      const seq = ++searchSeq.current;
      setExtSearching(true);
      const res = await searchParticipantCandidates(
        organizationId,
        term,
        [...EXTERNAL_PARTICIPANT_TYPES],
      );
      if (seq !== searchSeq.current) return;
      setExtSearching(false);
      if (res.ok) {
        setExtSearchError(null);
        setExtResults(res.candidates);
      } else {
        // MAJOR-2(a) — same reasoning as the professional lane above: a
        // failed search must not present as "Nenhum resultado. Você pode
        // cadastrar um novo." and invite a duplicate mint.
        setExtSearchError(
          res.error ?? "Não foi possível buscar participantes. Tente novamente.",
        );
        setExtResults([]);
      }
    },
    [organizationId],
  );

  // Debounced external search — same derivation-over-reset approach.
  useEffect(() => {
    if (!open || lane !== "external" || extMode !== "search") return;
    const term = extQuery.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      void runExtSearch(term);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, lane, extMode, extQuery, runExtSearch]);

  // Rendered results/loading state — derived so a query shortened below the
  // 2-character floor reads as "nothing to show" without a matching setState
  // reset (the search effects above no longer clear state for that case).
  const visibleProfResults = profQuery.trim().length >= 2 ? profResults : [];
  const profSearchVisible =
    profQuery.trim().length >= 2 && profSearching;
  const visibleProfSearchError =
    profQuery.trim().length >= 2 ? profSearchError : null;
  const visibleExtResults = extQuery.trim().length >= 2 ? extResults : [];
  const extSearchVisible = extQuery.trim().length >= 2 && extSearching;
  const visibleExtSearchError =
    extQuery.trim().length >= 2 ? extSearchError : null;

  /**
   * The single place `open` transitions to `false` funnels through here — the
   * Dialog's own `onOpenChange`, the Cancel button, and a successful submit —
   * so the reset (a plain function call in an event handler, never inside a
   * `useEffect`) always fires exactly once per close.
   */
  function handleOpenChange(next: boolean) {
    if (isPending && !next) return;
    onOpenChange(next);
    if (!next) resetAll();
  }

  function switchLane(next: Lane) {
    setLane(next);
    setLinkState(null);
    setLinkUserId(null);
    setLinkConfirmed(false);
    setRoleId("");
  }

  // Whether the D6 linkage fieldset must show at all: a brand-new professional
  // profile always starts unresolved, and an EXISTING profile picked from
  // search whose linkage is already `unknown` must be resolved inline before
  // submit (ADR 0108 D6) rather than dead-ending on `HC0F0`.
  const needsLinkage =
    lane === "professional" &&
    (profMode === "create" ||
      (profMode === "search" && selectedProf?.linkState === "unknown"));

  const chosenType: ParticipantType | null =
    lane === "professional"
      ? "professional"
      : extMode === "search"
        ? (selectedExt?.participantType ?? null)
        : extType;

  const availableRoles = chosenType
    ? roles.filter((r) => r.allowedParticipantTypes.includes(chosenType))
    : [];

  // Declared here rather than with the other fields above because BOTH of its
  // wiring inputs are conditional and derived: the "nenhum papel aceita este
  // tipo" hint only renders for a chosen type with no roles, so the field's
  // `aria-describedby` must appear and disappear with it.
  const roleField = useFieldIds("participant-role", {
    hasError: Boolean(fieldErrors.roleId),
    hasDescription: Boolean(chosenType) && availableRoles.length === 0,
  });

  const hasParticipantSelection =
    lane === "professional"
      ? profMode === "search"
        ? selectedProf !== null
        : profDraft.fullName.trim() !== ""
      : extMode === "search"
        ? selectedExt !== null
        : extName.trim() !== "";

  const linkageOk =
    !needsLinkage ||
    (linkState === "linked" && Boolean(linkUserId)) ||
    (linkState === "no_account" && linkConfirmed);

  const canSubmit =
    hasParticipantSelection && roleId !== "" && linkageOk && !isPending;

  function submit() {
    if (!canSubmit) return;
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      try {
        let professionalProfileId: string | undefined;
        let participantId: string | undefined;

        if (lane === "professional") {
          if (profMode === "create") {
            const identity = {
              fullName: profDraft.fullName.trim(),
              professionalType: profDraft.professionalType || null,
              licenseNumber: profDraft.licenseNumber.trim() || null,
              licenseRegion: profDraft.licenseRegion.trim() || null,
              specialty: profDraft.specialty.trim() || null,
            };
            const alreadyMinted =
              mintedProfessionalId !== null &&
              mintedProfessionalIdentity !== null &&
              mintedProfessionalIdentity.fullName === identity.fullName &&
              mintedProfessionalIdentity.professionalType ===
                identity.professionalType &&
              mintedProfessionalIdentity.licenseNumber ===
                identity.licenseNumber &&
              mintedProfessionalIdentity.licenseRegion ===
                identity.licenseRegion &&
              mintedProfessionalIdentity.specialty === identity.specialty;

            if (alreadyMinted) {
              // MAJOR-6 (professional lane): same pending creation as the
              // last attempt — reuse the profile already minted rather than
              // calling createProfessionalProfile again, which would insert
              // a second row for the same person.
              professionalProfileId = mintedProfessionalId;
            } else {
              const created = await createProfessionalProfile({
                organizationId,
                ...identity,
                userId: linkState === "linked" ? linkUserId : null,
              });
              if (!created.ok || !created.profileId) {
                setError(
                  created.error ?? "Não foi possível cadastrar o profissional.",
                );
                setFieldErrors(created.fieldErrors ?? {});
                return;
              }
              professionalProfileId = created.profileId;
              setMintedProfessionalId(created.profileId);
              setMintedProfessionalIdentity(identity);
            }
          } else if (selectedProf) {
            professionalProfileId =
              selectedProf.professionalProfileId ?? undefined;
          }

          // BUG-AE47C-LINKAGE-001. In the create-inline arm with "possui
          // conta", step 1 has ALREADY decided the linkage: measured on a
          // fresh reset, `create_professional_profile` handed a non-null
          // `p_user_id` writes `link_state='linked'` and sets `user_id`
          // itself. A follow-up `set_professional_link_state` is therefore
          // not a completion but a MODIFY of an already-decided linkage,
          // which the AE4.7c bound (migration 20261003007230) correctly
          // refuses with 42501 for any caller below org authority — a
          // `staff_admin` may complete an add, never re-decide a linkage.
          // That 42501 mapped to MESSAGES.forbidden and left the dialog open.
          // The other two arms still need this call and are legal: search
          // (pick-existing) resolves a profile whose linkage is `unknown`,
          // and create + `no_account` leaves creation at `unknown`. Keyed on
          // profMode/linkState rather than on how the id was obtained, so the
          // `alreadyMinted` retry takes the same branch as a fresh create.
          const linkageDecidedAtCreation =
            profMode === "create" && linkState === "linked";

          if (
            needsLinkage &&
            linkState &&
            professionalProfileId &&
            !linkageDecidedAtCreation
          ) {
            const linkRes = await setProfessionalLinkState(
              professionalProfileId,
              linkState,
              linkState === "linked" ? (linkUserId ?? undefined) : undefined,
            );
            if (!linkRes.ok) {
              setError(
                linkRes.error ?? "Não foi possível registrar o vínculo.",
              );
              return;
            }
          }
        } else {
          if (extMode === "create") {
            const identity = { type: extType, name: extName.trim() };
            const alreadyMinted =
              mintedExternalId !== null &&
              mintedExternalIdentity !== null &&
              mintedExternalIdentity.type === identity.type &&
              mintedExternalIdentity.name === identity.name;

            if (alreadyMinted) {
              // MAJOR-6: same pending creation as the last attempt (the
              // subsequent addCaseParticipant failed) — reuse the id already
              // minted rather than calling createExternalParticipant again,
              // which would commit a second, duplicate `participants` row.
              participantId = mintedExternalId;
            } else {
              const created = await createExternalParticipant(
                organizationId,
                identity.type,
                identity.name,
              );
              if (!created.ok || !created.participantId) {
                setError(
                  created.error ?? "Não foi possível cadastrar o participante.",
                );
                setFieldErrors(created.fieldErrors ?? {});
                return;
              }
              participantId = created.participantId;
              setMintedExternalId(created.participantId);
              setMintedExternalIdentity(identity);
            }
          } else if (selectedExt) {
            participantId = selectedExt.participantId ?? undefined;
          }
        }

        if (!professionalProfileId && !participantId) {
          setError("Selecione ou cadastre um participante antes de continuar.");
          return;
        }

        const res = await addCaseParticipant(caseId, {
          ...(professionalProfileId
            ? { professionalProfileId }
            : { participantId: participantId! }),
          roleId,
          involvementSummary: involvementSummary.trim() || null,
        });
        if (!res.ok) {
          setError(res.error ?? "Não foi possível adicionar o participante.");
          setFieldErrors(res.fieldErrors ?? {});
          return;
        }
        handleOpenChange(false);
        router.refresh();
      } catch {
        setError("Não foi possível concluir. Tente novamente.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        aria-label="Adicionar participante"
        onEscapeKeyDown={suppressEscapeWhilePopupOpen}
      >
        <DialogHeader>
          <DialogTitle>Adicionar participante</DialogTitle>
          <DialogDescription>
            Vincule um profissional ou uma pessoa/entidade externa a este caso,
            em um papel.
          </DialogDescription>
        </DialogHeader>

        {error && <FormBanner tone="error">{error}</FormBanner>}

        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend id={laneLegendId} className="mb-1 text-sm font-medium">
              Tipo de participante
            </legend>
            <div
              role="radiogroup"
              aria-labelledby={laneLegendId}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2.5 text-sm transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-accent/40",
                )}
              >
                <input
                  type="radio"
                  name="participant-lane"
                  value="professional"
                  checked={lane === "professional"}
                  disabled={isPending}
                  onChange={() => switchLane("professional")}
                  className="accent-primary"
                />
                Profissional
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2.5 text-sm transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-accent/40",
                )}
              >
                <input
                  type="radio"
                  name="participant-lane"
                  value="external"
                  checked={lane === "external"}
                  disabled={isPending}
                  onChange={() => switchLane("external")}
                  className="accent-primary"
                />
                Pessoa externa ou órgão
              </label>
            </div>
          </fieldset>

          {lane === "professional" ? (
            profMode === "search" ? (
              <div className="flex flex-col gap-3">
                <TypeaheadField
                  id="prof-search"
                  label="Buscar profissional"
                  placeholder="Nome ou CRM…"
                  items={visibleProfResults}
                  loading={profSearchVisible}
                  error={visibleProfSearchError}
                  query={profQuery}
                  onQueryChange={(v) => {
                    setProfQuery(v);
                    setSelectedProf(null);
                  }}
                  onPick={(r) => {
                    setSelectedProf(r);
                    setProfQuery(r.displayName);
                    setLinkState(null);
                    setLinkUserId(null);
                    setLinkConfirmed(false);
                  }}
                  getKey={(r) =>
                    `${r.participantType}-${r.participantId ?? r.professionalProfileId}`
                  }
                  getLabel={(r) => r.displayName}
                  renderOption={(r) => (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {r.displayName}
                      </span>
                      {(r.licenseNumber || r.specialty) && (
                        <span className="truncate text-xs text-muted-foreground">
                          {[r.licenseNumber, r.specialty]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                  )}
                  emptyHint={
                    profQuery.trim().length >= 2
                      ? "Nenhum resultado. Você pode cadastrar um novo."
                      : "Digite ao menos 2 letras para buscar."
                  }
                  emptyAnnouncement={
                    profQuery.trim().length >= 2
                      ? "Nenhuma opção disponível."
                      : null
                  }
                  disabled={isPending}
                />
                {selectedProf && (
                  <p className="rounded-lg border border-border bg-accent/30 px-3 py-2 text-sm">
                    <span className="font-medium">{selectedProf.displayName}</span>
                    {selectedProf.licenseNumber && (
                      <span className="text-muted-foreground">
                        {" "}
                        · CRM {selectedProf.licenseNumber}
                        {selectedProf.licenseRegion
                          ? `/${selectedProf.licenseRegion}`
                          : ""}
                      </span>
                    )}
                  </p>
                )}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      setProfMode("create");
                      setSelectedProf(null);
                      setLinkState(null);
                      setLinkUserId(null);
                      setLinkConfirmed(false);
                    }}
                  >
                    <UserPlus aria-hidden="true" />
                    Cadastrar novo profissional
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 p-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={nameField.controlProps.id}>
                      Nome completo
                    </FieldLabel>
                    <Input
                      {...nameField.controlProps}
                      value={profDraft.fullName}
                      disabled={isPending}
                      onChange={(e) =>
                        setProfDraft({ ...profDraft, fullName: e.target.value })
                      }
                    />
                    <FieldError id={nameField.errorId}>
                      {fieldErrors.fullName}
                    </FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={typeField.controlProps.id}>
                      Tipo profissional
                    </FieldLabel>
                    <Input
                      {...typeField.controlProps}
                      value={profDraft.professionalType}
                      disabled={isPending}
                      placeholder="Ex.: Médico, Técnico de enfermagem…"
                      onChange={(e) =>
                        setProfDraft({
                          ...profDraft,
                          professionalType: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={licenseField.controlProps.id}>
                      CRM
                    </FieldLabel>
                    <Input
                      {...licenseField.controlProps}
                      value={profDraft.licenseNumber}
                      disabled={isPending}
                      onChange={(e) =>
                        setProfDraft({
                          ...profDraft,
                          licenseNumber: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={regionField.controlProps.id}>
                      UF do registro
                    </FieldLabel>
                    <Input
                      {...regionField.controlProps}
                      value={profDraft.licenseRegion}
                      disabled={isPending}
                      maxLength={2}
                      onChange={(e) =>
                        setProfDraft({
                          ...profDraft,
                          licenseRegion: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={specialtyField.controlProps.id}>
                      Especialidade
                    </FieldLabel>
                    <Input
                      {...specialtyField.controlProps}
                      value={profDraft.specialty}
                      disabled={isPending}
                      onChange={(e) =>
                        setProfDraft({ ...profDraft, specialty: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      setProfMode("search");
                      setProfDraft(EMPTY_PROF_DRAFT);
                      setLinkState(null);
                      setLinkUserId(null);
                      setLinkConfirmed(false);
                    }}
                  >
                    Buscar um profissional já cadastrado
                  </Button>
                </div>
              </div>
            )
          ) : extMode === "search" ? (
            <div className="flex flex-col gap-3">
              <TypeaheadField
                id="ext-search"
                label="Buscar participante externo"
                placeholder="Nome…"
                items={visibleExtResults}
                loading={extSearchVisible}
                error={visibleExtSearchError}
                query={extQuery}
                onQueryChange={(v) => {
                  setExtQuery(v);
                  setSelectedExt(null);
                }}
                onPick={(r) => {
                  setSelectedExt(r);
                  setExtQuery(r.displayName);
                }}
                getKey={(r) => `${r.participantType}-${r.participantId}`}
                getLabel={(r) => r.displayName}
                emptyHint={
                  extQuery.trim().length >= 2
                    ? "Nenhum resultado. Você pode cadastrar um novo."
                    : "Digite ao menos 2 letras para buscar."
                }
                emptyAnnouncement={
                  extQuery.trim().length >= 2
                    ? "Nenhuma opção disponível."
                    : null
                }
                disabled={isPending}
              />
              {selectedExt && (
                <p className="rounded-lg border border-border bg-accent/30 px-3 py-2 text-sm">
                  <span className="font-medium">{selectedExt.displayName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {EXTERNAL_TYPE_LABELS[selectedExt.participantType] ??
                      selectedExt.participantType}
                  </span>
                </p>
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setExtMode("create");
                    setSelectedExt(null);
                  }}
                >
                  <UserPlus aria-hidden="true" />
                  Cadastrar novo
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-border/70 p-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={extTypeField.controlProps.id}>
                    Tipo
                  </FieldLabel>
                  <NativeSelect
                    {...extTypeField.controlProps}
                    value={extType}
                    disabled={isPending}
                    onChange={(e) =>
                      setExtType(e.target.value as ParticipantType)
                    }
                  >
                    {EXTERNAL_PARTICIPANT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EXTERNAL_TYPE_LABELS[t] ?? t}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={extNameField.controlProps.id}>
                    Nome
                  </FieldLabel>
                  <Input
                    {...extNameField.controlProps}
                    value={extName}
                    disabled={isPending}
                    onChange={(e) => setExtName(e.target.value)}
                  />
                  <FieldError id={extNameField.errorId}>
                    {fieldErrors.displayName}
                  </FieldError>
                </Field>
              </div>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setExtMode("search");
                    setExtName("");
                  }}
                >
                  Buscar um participante já cadastrado
                </Button>
              </div>
            </div>
          )}

          {needsLinkage && (
            <LinkageResolutionFieldset
              linkState={linkState}
              onLinkStateChange={(v) => {
                setLinkState(v);
                if (v !== "linked") setLinkUserId(null);
                if (v !== "no_account") setLinkConfirmed(false);
              }}
              userId={linkUserId}
              onUserIdChange={setLinkUserId}
              confirmed={linkConfirmed}
              onConfirmedChange={setLinkConfirmed}
              users={platformUsers}
              disabled={isPending}
            />
          )}

          <Field>
            <FieldLabel htmlFor={roleField.controlProps.id}>Papel</FieldLabel>
            <NativeSelect
              {...roleField.controlProps}
              value={roleId}
              disabled={isPending || availableRoles.length === 0}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName}
                </option>
              ))}
            </NativeSelect>
            {chosenType && availableRoles.length === 0 && (
              <FieldDescription id={roleField.descriptionId}>
                Nenhum papel cadastrado aceita este tipo de participante.{" "}
                {roleVocabularyHref ? (
                  <>
                    Cadastre um papel para este tipo em{" "}
                    <Link
                      href={roleVocabularyHref}
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      Tipos de caso
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    A administração da organização pode cadastrar um papel para
                    este tipo em Tipos de caso.
                  </>
                )}
              </FieldDescription>
            )}
            <FieldError id={roleField.errorId}>{fieldErrors.roleId}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor={summaryField.controlProps.id}>
              Resumo do envolvimento
            </FieldLabel>
            <Textarea
              {...summaryField.controlProps}
              value={involvementSummary}
              disabled={isPending}
              rows={3}
              onChange={(e) => setInvolvementSummary(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            {isPending ? "Adicionando…" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
