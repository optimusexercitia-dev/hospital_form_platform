"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ConditionOp,
  ItemType,
  Section,
  SignoffRole,
} from "@/lib/queries/forms";
import { updateSection, type ActionState } from "@/lib/forms/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FormBanner } from "@/components/auth/form-banner";

/** Choice inputs whose options can drive a condition. Declared locally so this
 *  client component never value-imports the server-only query module. */
const CHOICE_TYPES: ItemType[] = ["multiple_choice", "dropdown", "checkbox"];

const OP_LABELS: Record<ConditionOp, string> = {
  equals: "é igual a",
  not_equals: "é diferente de",
  in: "é uma das opções",
};

type Target = { questionKey: string; label: string; options: string[] };

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Per-section settings (F4): the `visible_when` condition editor and the
 * sign-off settings, for a non-default section. Both edits go through
 * {@link updateSection}; the section's current title + description are preserved
 * as hidden fields (the rename/describe dialog owns those), mirroring how
 * {@link SectionMetaDialog} preserves the condition/sign-off.
 *
 * Condition targets are computed from the in-memory tree: CHOICE-type questions
 * (`multiple_choice` / `dropdown` / `checkbox`) in STRICTLY EARLIER sections,
 * offered by label. The value picker is discrete — a single option for
 * equals/not_equals, a multi-select for `in` — so an author can only build a
 * structurally valid condition; publish-time `validate_visible_when` remains the
 * server-side authority.
 */
export function SectionSettingsDialog({
  open,
  onOpenChange,
  section,
  sections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: Section;
  sections: Section[];
}) {
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(updateSection, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  // CHOICE questions in strictly-earlier sections, by document order.
  const targets = useMemo<Target[]>(() => {
    const idx = sections.findIndex((s) => s.id === section.id);
    return sections.slice(0, Math.max(idx, 0)).flatMap((s) =>
      s.items
        .filter((it) => CHOICE_TYPES.includes(it.itemType) && it.questionKey)
        .map((it) => ({
          questionKey: it.questionKey as string,
          label: it.label ?? (it.questionKey as string),
          options: it.options ?? [],
        })),
    );
  }, [sections, section.id]);

  const initial = section.visibleWhen;
  const [conditionKey, setConditionKey] = useState<string>(
    initial?.question_key ?? "",
  );
  const [op, setOp] = useState<ConditionOp>(
    (initial?.op as ConditionOp) ?? "equals",
  );
  const [singleValue, setSingleValue] = useState<string>(
    typeof initial?.value === "string" ? initial.value : "",
  );
  const [multiValue, setMultiValue] = useState<string[]>(
    Array.isArray(initial?.value) ? initial.value.map(String) : [],
  );

  const [requiresSignoff, setRequiresSignoff] = useState<boolean>(
    section.requiresSignoff,
  );
  const [signoffRole, setSignoffRole] = useState<SignoffRole>(
    section.signoffRole ?? "respondent",
  );

  const selectedTarget =
    targets.find((t) => t.questionKey === conditionKey) ?? null;

  // The condition only counts when a (still-valid) target is selected.
  const hasCondition = conditionKey !== "" && selectedTarget !== null;
  const conditionValue =
    op === "in" ? JSON.stringify(multiValue) : singleValue;

  function toggleMulti(option: string) {
    setMultiValue((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Configurações da seção</DialogTitle>
          <DialogDescription>
            Defina quando esta seção aparece e se ela exige assinatura.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-6" noValidate>
          {/* Routing + preserve title/description (edited in the rename dialog). */}
          <input type="hidden" name="sectionId" value={section.id} />
          <input type="hidden" name="title" value={section.title ?? ""} />
          <input
            type="hidden"
            name="description"
            value={section.description ?? ""}
          />
          {hasCondition && (
            <>
              <input type="hidden" name="conditionKey" value={conditionKey} />
              <input type="hidden" name="conditionOp" value={op} />
              <input
                type="hidden"
                name="conditionValue"
                value={conditionValue}
              />
            </>
          )}
          {requiresSignoff && (
            <>
              <input type="hidden" name="requiresSignoff" value="on" />
              <input type="hidden" name="signoffRole" value={signoffRole} />
            </>
          )}

          {state && !state.ok && (
            <FormBanner tone="error">
              {state.error ?? state.fieldErrors?.title ?? state.fieldErrors?.signoffRole}
            </FormBanner>
          )}

          {/* --- Visibility condition --- */}
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">
              Visibilidade condicional
            </legend>
            {targets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                Não há perguntas de múltipla escolha em seções anteriores para
                criar uma condição. Esta seção é sempre exibida.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Mostrar a seção quando</span>
                  <select
                    className={SELECT_CLASS}
                    value={conditionKey}
                    onChange={(e) => {
                      setConditionKey(e.target.value);
                      setSingleValue("");
                      setMultiValue([]);
                    }}
                  >
                    <option value="">Sempre visível</option>
                    {targets.map((t) => (
                      <option key={t.questionKey} value={t.questionKey}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedTarget && (
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium">A resposta</span>
                      <select
                        className={SELECT_CLASS}
                        value={op}
                        onChange={(e) => {
                          const next = e.target.value as ConditionOp;
                          setOp(next);
                          // value shape differs between scalar and array ops.
                          setSingleValue("");
                          setMultiValue([]);
                        }}
                      >
                        {(["equals", "not_equals", "in"] as ConditionOp[]).map(
                          (o) => (
                            <option key={o} value={o}>
                              {OP_LABELS[o]}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    {selectedTarget.options.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Esta pergunta não tem opções definidas.
                      </p>
                    ) : op === "in" ? (
                      <fieldset className="flex flex-col gap-2">
                        <legend className="text-sm font-medium">
                          Opções selecionadas
                        </legend>
                        {selectedTarget.options.map((opt) => (
                          <label
                            key={opt}
                            className="flex items-center gap-2.5 text-sm"
                          >
                            <Checkbox
                              checked={multiValue.includes(opt)}
                              onCheckedChange={() => toggleMulti(opt)}
                            />
                            {opt}
                          </label>
                        ))}
                      </fieldset>
                    ) : (
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium">Valor</span>
                        <select
                          className={SELECT_CLASS}
                          value={singleValue}
                          onChange={(e) => setSingleValue(e.target.value)}
                        >
                          <option value="">Selecione…</option>
                          {selectedTarget.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </>
            )}
          </fieldset>

          {/* --- Sign-off --- */}
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">Assinatura</legend>
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox
                checked={requiresSignoff}
                onCheckedChange={(c) => setRequiresSignoff(c === true)}
              />
              Exigir assinatura para concluir esta seção
            </label>
            {requiresSignoff && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Quem assina</span>
                <select
                  className={SELECT_CLASS}
                  value={signoffRole}
                  onChange={(e) =>
                    setSignoffRole(e.target.value as SignoffRole)
                  }
                >
                  <option value="respondent">
                    Quem preenche (a própria pessoa)
                  </option>
                  <option value="staff_admin">Coordenação da comissão</option>
                </select>
              </label>
            )}
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
