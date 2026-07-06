"use client";

import { useState } from "react";
import { LayoutTemplate } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IndicatorKindBadge } from "@/components/indicators/indicator-format";
import {
  INDICATOR_TEMPLATES,
  INDICATOR_TEMPLATE_CATEGORIES,
  type IndicatorTemplate,
} from "@/components/indicators/indicator-templates";

/**
 * "Criar a partir de modelo" (Phase 15, F2). Opens the static pt-BR template
 * catalog; picking a template prefills the builder's definition fields via
 * `onApply` and closes. Pure client interaction over a code-level constant — no
 * backend call, no schema.
 */
export function TemplateCatalogDialog({
  onApply,
}: {
  onApply: (template: IndicatorTemplate) => void;
}) {
  const [open, setOpen] = useState(false);

  function choose(template: IndicatorTemplate) {
    onApply(template);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <LayoutTemplate aria-hidden="true" className="size-4" />
          Criar a partir de modelo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modelos de indicadores</DialogTitle>
          <DialogDescription>
            Escolha um modelo para preencher a definição automaticamente. Você
            poderá ajustar todos os campos e a origem dos dados em seguida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {INDICATOR_TEMPLATE_CATEGORIES.map((category) => {
            const items = INDICATOR_TEMPLATES.filter(
              (t) => t.category === category,
            );
            if (items.length === 0) return null;
            return (
              <section
                key={category}
                aria-label={category}
                className="flex flex-col gap-2"
              >
                <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {category}
                </h3>
                <ul className="flex flex-col gap-2">
                  {items.map((template) => (
                    <li key={template.id}>
                      <button
                        type="button"
                        onClick={() => choose(template)}
                        className="group flex w-full flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-foreground">
                            {template.name}
                          </span>
                          <IndicatorKindBadge kind={template.kind} />
                        </div>
                        <span className="text-sm text-muted-foreground text-pretty">
                          {template.description}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
