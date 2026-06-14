"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CaseTag, CaseTagColorToken } from "@/lib/queries/case-tags";
import {
  createCaseTag,
  renameCaseTag,
  type ActionState,
} from "@/lib/cases/tags-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { ColorTokenPicker } from "./color-token-picker";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "./case-status-badge";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / rename + recolour a case tag (Cases-Extras R3). Arg-based actions run
 * inside a transition; errors stay on screen and the route refreshes on success.
 * A live chip previews the name + colour.
 */
export function TagDefDialog({
  mode,
  open,
  onOpenChange,
  commissionId,
  tag,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  /** Required for `edit`. */
  tag?: CaseTag;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [name, setName] = useState(tag?.name ?? "");
  const [colorToken, setColorToken] = useState<CaseTagColorToken>(
    tag?.colorToken ?? "blue",
  );

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setName(tag?.name ?? "");
      setColorToken(tag?.colorToken ?? "blue");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCaseTag(commissionId, trimmed, colorToken)
          : await renameCaseTag(tag!.id, trimmed, colorToken);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova etiqueta" : "Editar etiqueta"}
          </DialogTitle>
          <DialogDescription>
            Use etiquetas para agrupar casos em tendências e relatórios anuais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.name && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder="Ex.: Surto"
              aria-invalid={state?.fieldErrors?.name ? true : undefined}
            />
            {state?.fieldErrors?.name && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.name}
              </span>
            )}
          </label>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Cor</span>
            <ColorTokenPicker value={colorToken} onChange={setColorToken} />
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Pré-visualização</span>
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                TOKEN_STYLES[colorToken] ?? TOKEN_STYLES.muted,
              )}
            >
              {name.trim() || "Sem nome"}
            </span>
          </div>

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
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Criar etiqueta"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
