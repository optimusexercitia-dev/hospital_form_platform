"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setStandardOwnership } from "@/lib/accreditation/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";

/**
 * Per-standard responsible-commission override (`set_standard_ownership`,
 * D7). Rendered ONLY for a `hospital_admin` of the row's own hospital — an
 * org_admin sees a read-only chip instead (`hospital-readiness-register.tsx`
 * decides which to render). This is a CONVENIENCE gate: the RPC itself
 * re-checks `is_hospital_admin_of` and rejects an org_admin regardless of
 * what this component renders, so a UI bug here can degrade to an error
 * banner, never a write.
 */
export function OwnershipEditor({
  hospitalId,
  standardId,
  currentCommissionId,
  commissionOptions,
}: {
  hospitalId: string;
  standardId: string;
  currentCommissionId: string | null;
  commissionOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentCommissionId ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== (currentCommissionId ?? "");

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await setStandardOwnership(hospitalId, standardId, value || null);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <NativeSelect
          aria-label={`Comissão responsável pelo padrão`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          className="h-8 py-1 text-xs"
        >
          <option value="">Nenhuma (pior caso)</option>
          {commissionOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        {dirty && (
          <Button type="button" size="xs" onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        )}
      </div>
      {error && (
        <span role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
