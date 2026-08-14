"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** The known `?aviso=` keys the wizard sets when routing to the detail. */
const NOTICES: Record<
  string,
  { tone: "success" | "warning"; role: "status" | "alert"; text: string }
> = {
  enviado: {
    tone: "success",
    role: "status",
    text: "Documento enviado para aprovação.",
  },
  rascunho: {
    tone: "success",
    role: "status",
    text: "Rascunho salvo.",
  },
  incompleto: {
    tone: "warning",
    role: "alert",
    text: "O rascunho foi salvo, mas ainda falta concluir uma etapa. Verifique o arquivo e os aprovadores abaixo e finalize.",
  },
};

/**
 * Transient detail banner shown after the create wizard routes here with `?aviso=`
 * (Phase 17 v2, F-B/F-C). Success notices announce politely (`role="status"`); the
 * partial-failure notice alerts (`role="alert"`). Dismissing strips the query param
 * so a refresh doesn't re-show it.
 */
export function DetailNotice({ aviso }: { aviso: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  const notice = NOTICES[aviso];
  if (!notice || dismissed) return null;

  const Icon = notice.tone === "success" ? CheckCircle2 : TriangleAlert;

  return (
    <div
      role={notice.role}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        notice.tone === "success"
          ? "border-success/30 bg-success/10 text-foreground"
          : "border-warning/40 bg-warning/10 text-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          notice.tone === "success" ? "text-success" : "text-warning",
        )}
      />
      <p className="flex-1 text-pretty">{notice.text}</p>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          router.replace(pathname, { scroll: false });
        }}
        aria-label="Dispensar aviso"
        className="rounded-md p-0.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
