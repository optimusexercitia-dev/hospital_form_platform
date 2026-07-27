"use client";

import { useId } from "react";
import { Ban, Check, Plus, Trash2 } from "lucide-react";

import type { ColorToken } from "@/lib/queries/forms";
import { type BandDraft, blankBand, formatRiskScore, toBandPayload } from "@/lib/forms/matrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TOKEN_COLOR_VAR } from "@/components/cases/case-status-badge";

/**
 * FF-2 (ADR 0089 ruling 2) — the `risk_matrix` score→band editor
 * (`config.riskBands`).
 *
 * A band is a THRESHOLD, not a range: `minScore` is inclusive and a score falls
 * in the LAST band it reaches. So the author states only where each band starts,
 * and the effective ranges are DERIVED and previewed beneath — showing "27 ou
 * mais" rather than making the author keep two ends in sync is the difference
 * between a rule with one source of truth and a rule with two.
 *
 * The band is a PRESENTATION of the stored `risk_score`, never stored on the
 * answer: re-banding a form re-colours history instead of rewriting it. An empty
 * list is a legitimate configuration — no banding, the raw score is shown.
 *
 * Rows are held in AUTHOR order while editing (re-sorting under a half-typed
 * number is hostile) and serialized ascending by `minScore` on save, which is
 * the order every consumer assumes.
 */
export function RiskBandsEditor({
  bands,
  onChange,
  disabled = false,
}: {
  bands: BandDraft[];
  onChange: (next: BandDraft[]) => void;
  disabled?: boolean;
}) {
  const groupId = useId();

  function updateAt(index: number, patch: Partial<BandDraft>) {
    const next = bands.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(bands.filter((_, i) => i !== index));
  }

  // The DERIVED ranges, in the order a score actually resolves them.
  const preview = toBandPayload(bands);

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">
        Faixas de risco{" "}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </legend>
      <p className="text-xs text-muted-foreground text-pretty">
        A pontuação é o produto dos pesos (severidade × probabilidade). Informe a
        pontuação mínima de cada faixa; a faixa exibida é a última que a
        pontuação alcança. Sem faixas, apenas a pontuação é mostrada.
      </p>

      {bands.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-sm text-muted-foreground">
          Nenhuma faixa definida.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bands.map((band, index) => {
            const position = index + 1;
            const minId = `${groupId}-${band.key}-min`;
            const labelId = `${groupId}-${band.key}-label`;
            return (
              <li
                key={band.key}
                className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 p-2.5"
              >
                <Label htmlFor={minId} className="sr-only">
                  {`Pontuação mínima da faixa ${position}`}
                </Label>
                <Input
                  id={minId}
                  type="text"
                  inputMode="decimal"
                  value={band.minScore}
                  onChange={(e) => updateAt(index, { minScore: e.target.value })}
                  placeholder="Ex.: 9"
                  className="h-9 w-20 shrink-0 text-center"
                />
                <Label htmlFor={labelId} className="sr-only">
                  {`Rótulo da faixa ${position}`}
                </Label>
                <Input
                  id={labelId}
                  value={band.label}
                  onChange={(e) => updateAt(index, { label: e.target.value })}
                  placeholder="Ex.: Alto"
                  className="h-9 flex-1"
                />
                <BandColorPicker
                  position={position}
                  value={band.color}
                  onChange={(color) => updateAt(index, { color })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeAt(index)}
                  aria-label={`Remover a faixa ${position}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {preview.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Resultado:{" "}
          {preview.map((band, index) => (
            <span key={`${band.minScore}-${band.label}`}>
              {index > 0 ? " · " : ""}
              <span className="font-medium text-foreground">{band.label}</span>{" "}
              {index === preview.length - 1
                ? `a partir de ${formatRiskScore(band.minScore)}`
                : `de ${formatRiskScore(band.minScore)} a ${formatRiskScore(
                    preview[index + 1].minScore,
                  )} (exclusivo)`}
            </span>
          ))}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...bands, blankBand()])}
        className="mt-1 w-fit"
      >
        <Plus aria-hidden="true" />
        Adicionar faixa
      </Button>
    </fieldset>
  );
}

/**
 * The band's palette token as an inline swatch row. Colour never carries meaning
 * on its own — the band's LABEL is always rendered beside it wherever a score is
 * shown — so "sem cor" is a first-class choice and every swatch names its colour
 * in pt-BR for a screen reader.
 */
const TOKENS: ColorToken[] = ["slate", "blue", "amber", "green", "red", "violet", "muted"];

const TOKEN_NAME: Record<ColorToken, string> = {
  slate: "Ardósia",
  blue: "Azul",
  amber: "Âmbar",
  green: "Verde",
  red: "Vermelho",
  violet: "Violeta",
  muted: "Neutro",
};

function BandColorPicker({
  position,
  value,
  onChange,
}: {
  position: number;
  value: ColorToken | null;
  onChange: (token: ColorToken | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Cor da faixa ${position}`}
      className="flex shrink-0 items-center gap-1"
    >
      <button
        type="button"
        aria-pressed={value === null}
        aria-label="Sem cor"
        title="Sem cor"
        onClick={() => onChange(null)}
        className={cn(
          "grid size-6 place-items-center rounded-full border border-input bg-card ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          value === null && "ring-2 ring-ring",
        )}
      >
        <Ban aria-hidden="true" className="size-3 text-muted-foreground" />
      </button>
      {TOKENS.map((token) => {
        const selected = token === value;
        return (
          <button
            key={token}
            type="button"
            aria-pressed={selected}
            aria-label={TOKEN_NAME[token]}
            title={TOKEN_NAME[token]}
            onClick={() => onChange(token)}
            className={cn(
              "grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              selected && "ring-2 ring-ring",
            )}
            style={{ backgroundColor: TOKEN_COLOR_VAR[token] }}
          >
            {selected && (
              <Check aria-hidden="true" className="size-3 text-white drop-shadow" />
            )}
          </button>
        );
      })}
    </div>
  );
}
