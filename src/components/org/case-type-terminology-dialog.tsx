"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

import type { CaseType } from "@/lib/cases/case-types";
import {
  DEFAULT_CASE_TERMINOLOGY,
  type CaseTypeTerm,
  type CaseTypeTerminology,
  type CaseTypeTermKey,
} from "@/lib/cases/terminology";
import {
  clearCaseTypeTerminology,
  upsertCaseTypeTerminology,
} from "@/lib/vocabulary/actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";

/** The five slots, in the order they read best to an admin. */
const TERM_KEYS: readonly CaseTypeTermKey[] = [
  "case",
  "primary_subject",
  "timeline",
  "document",
  "decision",
];

/** `CaseTypeTermKey` → the matching property on the resolved bundle. Not a
 *  1:1 string match (`primary_subject` vs `primarySubject`), so this is a
 *  real lookup, not a cast. */
function termFor(bundle: CaseTypeTerminology, key: CaseTypeTermKey): CaseTypeTerm {
  switch (key) {
    case "case":
      return bundle.case;
    case "primary_subject":
      return bundle.primarySubject;
    case "timeline":
      return bundle.timeline;
    case "document":
      return bundle.document;
    case "decision":
      return bundle.decision;
  }
}

/**
 * One slot's editor: singular / plural / help text + its own Salvar and
 * Restaurar padrão (ETH·E4 §4). Deliberately per-slot, not a single form for
 * all five — `upsertCaseTypeTerminology`/`clearCaseTypeTerminology` take ONE
 * `termKey` at a time, matching how `getCaseTypeTerminology` merges: a
 * missing row falls back to the platform default for THAT key alone. A
 * single "save everything" button would turn "leave this slot at the
 * default" into "pin the default", so each slot commits independently.
 */
function TerminologySlotEditor({
  organizationId,
  caseTypeId,
  termKey,
  initial,
}: {
  organizationId: string;
  caseTypeId: string;
  termKey: CaseTypeTermKey;
  initial: CaseTypeTerm;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [singular, setSingular] = useState(initial.singular);
  const [plural, setPlural] = useState(initial.plural ?? "");
  const [helpText, setHelpText] = useState(initial.helpText ?? "");

  const singularField = useFieldIds(`term-${termKey}-singular`);
  const pluralField = useFieldIds(`term-${termKey}-plural`);
  const helpField = useFieldIds(`term-${termKey}-help`);

  const slotLabel = DEFAULT_CASE_TERMINOLOGY[
    termKey === "primary_subject" ? "primarySubject" : termKey
  ].singular;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await upsertCaseTypeTerminology(
        organizationId,
        caseTypeId,
        termKey,
        {
          singularLabel: singular,
          pluralLabel: plural.trim() || null,
          helpText: helpText.trim() || null,
        },
      );
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar.");
        return;
      }
      router.refresh();
    });
  }

  function restore() {
    setError(null);
    startTransition(async () => {
      const res = await clearCaseTypeTerminology(
        organizationId,
        caseTypeId,
        termKey,
      );
      if (!res.ok) {
        setError(res.error ?? "Não foi possível restaurar o padrão.");
        return;
      }
      const dflt = termFor(DEFAULT_CASE_TERMINOLOGY, termKey);
      setSingular(dflt.singular);
      setPlural(dflt.plural ?? "");
      setHelpText(dflt.helpText ?? "");
      router.refresh();
    });
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-border/70 p-3.5">
      <legend className="px-1 text-sm font-medium">{slotLabel}</legend>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={singularField.controlProps.id}>
            Singular
          </FieldLabel>
          <Input
            id={singularField.controlProps.id}
            value={singular}
            disabled={isPending}
            onChange={(e) => setSingular(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={pluralField.controlProps.id}>
            Plural{" "}
            <span className="font-normal text-muted-foreground">
              (opcional)
            </span>
          </FieldLabel>
          <Input
            id={pluralField.controlProps.id}
            value={plural}
            disabled={isPending}
            onChange={(e) => setPlural(e.target.value)}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor={helpField.controlProps.id}>
          Texto de apoio{" "}
          <span className="font-normal text-muted-foreground">
            (opcional)
          </span>
        </FieldLabel>
        <Textarea
          id={helpField.controlProps.id}
          value={helpText}
          disabled={isPending}
          rows={2}
          onChange={(e) => setHelpText(e.target.value)}
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={restore}
        >
          Restaurar padrão
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending || !singular.trim()}
          onClick={save}
        >
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </fieldset>
  );
}

/**
 * The `case_type_terminology` editor for ONE case type (ETH·E4 §4) — the five
 * overridable UI label slots (`case_type_terminology.term_key`). Opened from
 * a "Terminologia" action alongside each case type's "Editar" in
 * `case-type-manager.tsx`.
 *
 * `terminology` is the RESOLVED bundle (`getCaseTypeTerminology`, fetched
 * server-side by the host page) — each slot pre-fills with whatever is live
 * today, override or platform default, so the admin always sees what the
 * product actually renders. Nothing here can touch the `caseTypeId = null`
 * fallback every non-Ethics case depends on: `case_type_terminology.case_type_id`
 * is `NOT NULL`, so this dialog only ever exists per a real, typed case type.
 */
export function CaseTypeTerminologyDialog({
  organizationId,
  caseType,
  terminology,
}: {
  organizationId: string;
  caseType: CaseType;
  /** The case type's resolved terminology (overrides merged over defaults). */
  terminology: CaseTypeTerminology;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Languages aria-hidden="true" className="size-4" />
          Terminologia
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Terminologia — {caseType.displayName}</DialogTitle>
          <DialogDescription>
            Personalize como cada termo aparece nos casos deste tipo. Um slot
            deixado no padrão acompanha futuras atualizações da plataforma;
            &quot;Restaurar padrão&quot; o remove desta personalização.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          {TERM_KEYS.map((key) => (
            <TerminologySlotEditor
              key={key}
              organizationId={organizationId}
              caseTypeId={caseType.id}
              termKey={key}
              initial={termFor(terminology, key)}
            />
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
