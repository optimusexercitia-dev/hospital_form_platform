"use client";

import type { Json } from "@/lib/types/database";
import type { Item } from "@/lib/queries/forms";

import { isEmptyValue } from "./use-wizard";

/**
 * Renders one answered input as a read-only label/value pair for the review
 * screen (F5). Display blocks are not summarized here. A blank answer reads
 * "Sem resposta" in muted text so the reviewer sees the gap.
 */
export function AnswerSummary({
  item,
  value,
}: {
  item: Item;
  value: Json | undefined;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-2.5 last:border-b-0">
      <dt className="flex items-center gap-1 text-sm font-medium">
        {item.label ?? "Pergunta"}
        {item.required && (
          <span className="text-destructive" aria-label="obrigatória">
            *
          </span>
        )}
      </dt>
      <dd className="text-sm text-foreground/90">
        {renderValue(value)}
      </dd>
    </div>
  );
}

function renderValue(value: Json | undefined) {
  if (value === undefined || isEmptyValue(value)) {
    return <span className="text-muted-foreground italic">Sem resposta</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <li
            key={i}
            className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs"
          >
            {String(v)}
          </li>
        ))}
      </ul>
    );
  }
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}
