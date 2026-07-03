"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";

// Type from the client-safe canonical path (`titles.ts` is now `server-only`);
// the mutation from the `'use server'` actions module.
import type { MemberTitle } from "@/lib/commissions/titles-types";
import { assignMemberTitle } from "@/lib/commissions/titles-actions";
import { NativeSelect } from "@/components/ui/native-select";

const NONE_VALUE = "__none__";

/**
 * Per-member title-assignment control (ADR 0051 Decision 6) — a single native
 * `<select>` of the commission's title vocabulary + a "Sem título" option,
 * calling `assignMemberTitle(memberId, titleId | null)` on change. Fully
 * keyboard-operable (a native select is focusable/operable by keyboard by
 * default; this is the phase's designated keyboard-only flow candidate
 * alongside the title-create dialog).
 *
 * `memberId` is the `commission_members.id` row — NOT the user id — required by
 * the assignment action's contract. Callers must resolve it from the member
 * row before rendering this control.
 */
export function TitleAssignControl({
  memberId,
  currentTitleId,
  titles,
  memberName,
}: {
  memberId: string;
  currentTitleId: string | null;
  titles: MemberTitle[];
  /** For the accessible label (e.g. "Título de Dra. Ana Souza"). */
  memberName: string;
}) {
  const router = useRouter();
  const selectId = useId();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const titleId = value === NONE_VALUE ? null : value;
    startTransition(async () => {
      const result = await assignMemberTitle(memberId, titleId);
      if (result.ok) {
        router.refresh();
      }
      // A failed assignment silently reverts to the prior value on refresh (no
      // separate error banner here — this is a compact inline control embedded
      // in a list row; a page-level toast is a reasonable future enhancement).
    });
  }

  if (titles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="sr-only">
        Título de {memberName}
      </label>
      <NativeSelect
        id={selectId}
        className="h-8 min-w-36 py-1 text-xs"
        value={currentTitleId ?? NONE_VALUE}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
      >
        <option value={NONE_VALUE}>Sem título</option>
        {titles.map((title) => (
          <option key={title.id} value={title.id}>
            {title.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
