import "server-only";

import { listForms, listVersions, getVersionTree } from "@/lib/queries/forms";
import type { InputItemType } from "@/lib/queries/forms";
import type {
  PickerForm,
  PickerQuestion,
} from "@/components/indicators/derived-picker-types";

/**
 * Server-side composition of the derived-config picker data (Phase 15, F1).
 *
 * Composes the EXISTING typed form-tree readers (`listForms` + `listVersions` +
 * `getVersionTree`) into the client-safe {@link PickerForm}[] the builder's picker
 * binds to — no raw supabase-js here (Rule 9; all data still flows through
 * `src/lib/queries`). For each form we resolve its LATEST PUBLISHED version (the
 * derived config always references the published spine — `code`s are validated
 * against it on save, backend §3.5) and flatten its answerable inputs into
 * `{ questionKey, label, kind, options[{code,label}] }`.
 *
 * A derived indicator can reference:
 *   - CHOICE questions (`multiple_choice`/`dropdown`/`checkbox`) — numerator via
 *     option `code`s, or a denominator question; and
 *   - NUMBER questions — the `tempo_medio` averaged source.
 * Other input types are surfaced as `kind: 'other'` (shown but not selectable for
 * a numerator/denominator that needs codes) so the picker can hint clearly.
 */

const CHOICE_TYPES: ReadonlySet<InputItemType> = new Set([
  "multiple_choice",
  "dropdown",
  "checkbox",
]);

function questionKindOf(itemType: string): PickerQuestion["kind"] {
  if (CHOICE_TYPES.has(itemType as InputItemType)) return "choice";
  if (itemType === "number") return "number";
  return "other";
}

/** All forms of a commission, each with its published version's answerable questions. */
export async function getDerivedPickerForms(
  commissionId: string,
): Promise<PickerForm[]> {
  const forms = await listForms(commissionId);

  // Resolve each form's latest published version id, then its tree, in parallel.
  const built = await Promise.all(
    forms.map(async (form): Promise<PickerForm> => {
      if (form.publishedVersionNumber == null) {
        return {
          formId: form.id,
          title: form.title,
          hasPublishedVersion: false,
          questions: [],
        };
      }

      const versions = await listVersions(form.id);
      const published = versions.find((v) => v.status === "published");
      if (!published) {
        return {
          formId: form.id,
          title: form.title,
          hasPublishedVersion: false,
          questions: [],
        };
      }

      const tree = await getVersionTree(published.id);
      const questions: PickerQuestion[] = (tree?.sections ?? [])
        .flatMap((section) => section.items)
        .filter((item) => item.questionKey != null)
        .map((item) => ({
          questionKey: item.questionKey as string,
          label: item.label ?? (item.questionKey as string),
          kind: questionKindOf(item.itemType),
          options: (item.options ?? []).map((o) => ({
            code: o.code,
            label: o.label,
          })),
        }));

      return {
        formId: form.id,
        title: form.title,
        hasPublishedVersion: true,
        questions,
      };
    }),
  );

  return built.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}
