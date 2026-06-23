"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { Section, SignoffRole, Visibility } from "@/lib/queries/forms";
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
import { ConditionBuilder } from "@/components/forms/condition-builder";
import { sectionConditionTargets } from "@/components/forms/condition-targets";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Per-section settings (F4): the `visible_when` condition editor and the
 * sign-off settings, for a non-default section. Both edits go through
 * {@link updateSection}; the section's current title + description are preserved
 * as hidden fields (the rename/describe dialog owns those).
 *
 * form-builder-enhancements (decision #8): the visibility condition now uses the
 * shared {@link ConditionBuilder} — the SAME component questions use — so a
 * section can carry an AND/OR group over choice + number/date/time targets, not
 * just a single choice condition. Targets are input questions strictly earlier
 * in document order, computed from the in-memory tree. The serialized
 * {@link Visibility} is sent in the `visibleWhen` JSON field; a legacy single
 * condition round-trips (parsed in, normalized to a one-row group on save).
 * Publish-time `validate_visible_when` stays the server-side authority.
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

  // Eligible targets: input questions in strictly-earlier sections.
  const targets = sectionConditionTargets(sections, section.id);

  const [visibleWhen, setVisibleWhen] = useState<Visibility | null>(
    section.visibleWhen,
  );
  const [requiresSignoff, setRequiresSignoff] = useState<boolean>(
    section.requiresSignoff,
  );
  const [signoffRole, setSignoffRole] = useState<SignoffRole>(
    section.signoffRole ?? "respondent",
  );

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
          {/* The serialized visibility rule (legacy single OR group). */}
          {visibleWhen !== null && (
            <input
              type="hidden"
              name="visibleWhen"
              value={JSON.stringify(visibleWhen)}
            />
          )}
          {requiresSignoff && (
            <>
              <input type="hidden" name="requiresSignoff" value="on" />
              <input type="hidden" name="signoffRole" value={signoffRole} />
            </>
          )}

          {state && !state.ok && (
            <FormBanner tone="error">
              {state.error ??
                state.fieldErrors?.title ??
                state.fieldErrors?.signoffRole}
            </FormBanner>
          )}

          {/* --- Visibility condition (shared builder) --- */}
          <ConditionBuilder
            context="section"
            targets={targets}
            value={visibleWhen}
            onChange={setVisibleWhen}
          />

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
