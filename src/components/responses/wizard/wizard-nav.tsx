"use client";

import { ArrowLeft, ArrowRight, ClipboardCheck, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Wizard navigation footer (F2): Voltar / Próximo (or "Revisar" on the last
 * section) and an explicit "Salvar e sair" (F4 wires its action). "Próximo"
 * runs per-section client validation in the parent before advancing — this
 * component only emits intent. All buttons are real `<button>`s: keyboard
 * operable with a visible focus ring (from the Button primitive).
 *
 * Sticky to the bottom of the wizard column so the controls are always reachable
 * on long sections without scrolling to the end.
 */
export function WizardNav({
  canGoBack,
  isLastSection,
  saving,
  onBack,
  onNext,
  onSaveAndExit,
}: {
  canGoBack: boolean;
  isLastSection: boolean;
  saving: boolean;
  onBack: () => void;
  onNext: () => void;
  onSaveAndExit: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-2 flex items-center justify-between gap-3 border-t border-border bg-background/85 py-4 backdrop-blur">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSaveAndExit}
        disabled={saving}
      >
        <LogOut aria-hidden="true" />
        Salvar e sair
      </Button>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={!canGoBack || saving}
        >
          <ArrowLeft aria-hidden="true" />
          Voltar
        </Button>
        <Button type="button" size="lg" onClick={onNext} disabled={saving}>
          {isLastSection ? (
            <>
              <ClipboardCheck aria-hidden="true" />
              Revisar
            </>
          ) : (
            <>
              Próximo
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
