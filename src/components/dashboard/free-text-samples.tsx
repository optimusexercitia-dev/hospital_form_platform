import type { FreeTextSample } from "@/lib/queries/dashboard";

/**
 * Free-text questions are not chartable, so a `free_text` distribution is
 * surfaced as a read-only sample list with the total answer count. Server-safe
 * (no hooks). The samples are a server-capped subset — the heading states the
 * true total so the partial list is never mistaken for the whole.
 */
export function FreeTextSamples({ sample }: { sample: FreeTextSample }) {
  const headingId = `freetext-${sample.questionKey}`;

  return (
    <article
      aria-labelledby={headingId}
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <h4 id={headingId} className="text-sm font-semibold text-balance">
          {sample.label}
        </h4>
        <p className="text-xs text-muted-foreground">
          {sample.total} {sample.total === 1 ? "resposta aberta" : "respostas abertas"}
          {sample.samples.length < sample.total
            ? ` · amostra de ${sample.samples.length}`
            : ""}
        </p>
      </div>

      {sample.samples.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
          Sem respostas para esta pergunta.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sample.samples.map((text, i) => (
            <li
              key={i}
              className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm whitespace-pre-wrap text-foreground/90"
            >
              {text}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
