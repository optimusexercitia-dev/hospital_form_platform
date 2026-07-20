"use server";

import { revalidatePath } from "next/cache";

import { upsertCharter } from "@/lib/queries/charters";
import { CHARTER_MESSAGES } from "@/lib/charters/messages";
import type { MeetingFrequency } from "@/lib/charters/types";
import { commissionHref } from "@/lib/routing";

/**
 * Charter page server actions (CH-FE-1; Architecture Rules 9, 10). The sole write
 * routes through `upsertCharter` → the `upsert_commission_charter` DEFINER RPC
 * (staff_admin authority HC0K0; valid regimento link or HC0K1). `useActionState`-
 * shaped `{ ok, error? }`; the error is a pt-BR string already resolved by
 * `mapCharterError` inside `upsertCharter` (raw Postgres text never reaches the UI —
 * §8, Rule 10). No PHI (Rule 12).
 */

/** `useActionState`-shaped result consumed by the client `CharterForm`. */
export interface CharterFormState {
  ok: boolean;
  error?: string;
}

const FREQUENCIES = new Set<MeetingFrequency>([
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
]);

/**
 * Create or update this commission's charter. Posts the meeting frequency together
 * with the linked-regimento id in a SINGLE upsert (the row carries both), so neither
 * field clobbers the other. Client-side pre-checks the frequency (the RPC re-checks);
 * an empty `controlledDocumentId` links no regimento (NULL). Revalidates the page so
 * the cadence badge + regimento panel re-render with the persisted state.
 */
export async function saveCharter(
  _prev: CharterFormState | undefined,
  formData: FormData,
): Promise<CharterFormState> {
  const commissionId = String(formData.get("commissionId") ?? "");
  const org = String(formData.get("org") ?? "");
  const commission = String(formData.get("commission") ?? "");
  const frequencyRaw = String(formData.get("meetingFrequency") ?? "");
  const docIdRaw = String(formData.get("controlledDocumentId") ?? "").trim();

  if (!commissionId) return { ok: false, error: CHARTER_MESSAGES.missingCommission };
  if (!frequencyRaw) return { ok: false, error: CHARTER_MESSAGES.frequencyRequired };
  if (!FREQUENCIES.has(frequencyRaw as MeetingFrequency)) {
    return { ok: false, error: CHARTER_MESSAGES.frequencyInvalid };
  }

  const result = await upsertCharter(
    commissionId,
    frequencyRaw as MeetingFrequency,
    docIdRaw ? docIdRaw : null,
  );
  if (!result.ok) return { ok: false, error: result.error };

  if (org && commission) {
    revalidatePath(commissionHref(org, commission, "manage", "charter"));
  }
  return { ok: true };
}
