/** Detail-pane empty state before a standard is selected in the master tree. */
export default function FrameworkOverviewPage() {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <p className="max-w-prose text-sm text-muted-foreground text-pretty">
        Selecione um padrão na árvore ao lado para autoavaliar a conformidade e
        vincular evidências.
      </p>
    </div>
  );
}
