"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { FormBanner } from "@/components/auth/form-banner";
import { MINUTES_UI } from "./minutes-labels";

/**
 * F3's post-apply success banner, delivered across the redirect from the review page
 * via `?ata_aplicada=1` (design brief §7.5, lead-approved §9.5). Strips the param on
 * mount so a refresh — or a back-navigation — never resurrects the banner.
 */
export function MinutesAppliedBanner({ applied }: { applied: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(applied);

  useEffect(() => {
    if (!applied) return;
    router.replace(pathname);
  }, [applied, pathname, router]);

  if (!visible) return null;
  return (
    <FormBanner tone="success">
      <span className="inline-flex items-center gap-2">
        {MINUTES_UI.concludeSuccessBanner}
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-xs font-medium underline underline-offset-2"
        >
          Dispensar
        </button>
      </span>
    </FormBanner>
  );
}
