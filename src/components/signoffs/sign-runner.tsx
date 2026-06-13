"use client";

import { useMemo } from "react";

import { signSection } from "@/lib/responses/actions";

import type { ClientResponseForSignoff } from "./types";
import { ReviewAndSign } from "./review-and-sign";

/**
 * Thin client wrapper that binds B3's `signSection` server action and adapts it
 * to the review screen's `onSign` surface (the `WizardRunner` pattern). Server
 * actions are importable from a client component (Next wires the RPC), so this
 * keeps the action-signature plumbing in one place and `ReviewAndSign`
 * decoupled from B3's exact signature — a shape change is a one-file adjust.
 */
export function SignRunner({
  data,
  imageUrls,
  isAdminViewer,
}: {
  data: ClientResponseForSignoff;
  imageUrls: Record<string, string>;
  isAdminViewer?: boolean;
}) {
  const onSign = useMemo(
    () =>
      (input: { responseId: string; sectionId: string; note: string | null }) =>
        signSection(input),
    [],
  );

  return (
    <ReviewAndSign
      data={data}
      imageUrls={imageUrls}
      isAdminViewer={isAdminViewer}
      onSign={onSign}
    />
  );
}
