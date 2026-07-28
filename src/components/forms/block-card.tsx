"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Flag,
  Grid3x3,
  ShieldCheck,
  MoveRight,
  Pencil,
  Split,
  Trash2,
} from "lucide-react";

import type { Item, Section, ImageContent, SectionTextContent } from "@/lib/queries/forms";
import { deleteItem, moveItem, moveItemToSection } from "@/lib/forms/actions";
import { isContainerItem, isMatrixItem, isRepeatingGroup } from "@/lib/forms/item-tree";
import { AddBlockMenu } from "@/components/forms/add-block-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import {
  buildOptionLabelMap,
  buildQuestionLabelMap,
  describeVisibility,
} from "@/components/forms/describe-visibility";
import { TOKEN_COLOR_VAR } from "@/components/cases/case-status-badge";
import { ItemEditorDialog } from "@/components/forms/item-editor-dialog";
import { MatrixConfigDialog } from "@/components/forms/matrix-config-dialog";
import { ValidationsDialog } from "@/components/forms/validations-dialog";
import {
  itemAcceptsValidations,
  parentItemTypeOf,
} from "@/components/forms/validation-drafts";
import { useBuilderFlags } from "@/components/forms/builder-flags";
import { describeReferenceConfig } from "@/components/forms/reference-vocabulary";
import { MatrixGrid } from "@/components/responses/wizard/matrix-grid";
import { RiskMatrixPicker } from "@/components/responses/wizard/risk-matrix-picker";
import { ImagePreview } from "@/components/forms/image-preview";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { useBuilderAction } from "@/components/forms/use-builder-action";

/**
 * One block (input or display item) in a section: a compact preview plus its
 * controls — reorder up/down, edit (opens the type-specific editor),
 * "mover para seção" (only when the form has ≥2 sections), and delete. Every op
 * persists via its action and refreshes the view.
 */
export function BlockCard({
  item,
  index,
  isFirst,
  isLast,
  sections,
  currentSectionId,
  commissionId,
  imageUrl,
  imageUrls,
  onBeforeReorder,
  isChild = false,
}: {
  item: Item;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  sections: Section[];
  currentSectionId: string;
  commissionId: string;
  imageUrl: string | null;
  /** The whole `storage_path → signed URL` map, for nested image children. */
  imageUrls?: Record<string, string>;
  onBeforeReorder: () => void;
  /** True when this card renders INSIDE a container (a child block). */
  isChild?: boolean;
}) {
  const { run, isPending, error } = useBuilderAction();
  const [editOpen, setEditOpen] = useState(false);
  // FF-2 — the axes editor, a SEPARATE write from the item editor: the axes are
  // persisted by `upsertMatrixAxes` (REPLACE, keyed on `code`), not by
  // addItem/updateItem. See `MatrixConfigDialog` for why they cannot share one
  // submit.
  const [axesOpen, setAxesOpen] = useState(false);
  // FF-3 — the validation rules, a THIRD separate write (`set_item_validations`,
  // REPLACE and wholesale). See `ValidationsDialog` for why it cannot ride the
  // item editor's submit.
  const [rulesOpen, setRulesOpen] = useState(false);

  const flags = useBuilderFlags();
  const meta = ITEM_TYPE_META[item.itemType];
  const isContainer = isContainerItem(item.itemType);
  const isMatrix = isMatrixItem(item.itemType);
  // The parent's TYPE, not merely `isChild`: `unique_within_group` is offered
  // only inside a `repeating_group`, never inside a plain `group`.
  const parentItemType = parentItemTypeOf(sections, item.id);
  const acceptsValidations =
    flags.validations && itemAcceptsValidations(item.itemType, parentItemType);
  const ruleCount = item.validations?.length ?? 0;
  const children = item.children;
  // "Mover para outra seção" is hidden for containers and for children: a
  // container's children live in the SAME section as their parent (they occupy
  // contiguous position slots right after it), so a cross-section move is not a
  // reorder but a restructure. The action still handles both correctly if
  // called — this only removes a misleading affordance.
  const otherSections =
    isContainer || isChild ? [] : sections.filter((s) => s.id !== currentSectionId);

  function handleMove(direction: "up" | "down") {
    onBeforeReorder();
    const fd = new FormData();
    fd.set("itemId", item.id);
    fd.set("direction", direction);
    run(() => moveItem(undefined, fd));
  }

  function handleMoveToSection(targetSectionId: string) {
    const fd = new FormData();
    fd.set("itemId", item.id);
    fd.set("targetSectionId", targetSectionId);
    run(() => moveItemToSection(undefined, fd));
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("itemId", item.id);
    run(() => deleteItem(undefined, fd));
  }

  return (
    <article
      data-flip-id={`item-${item.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <meta.Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
              {meta.label}
            </span>
            <BlockHeadline item={item} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleMove("up")}
            disabled={isFirst || isPending}
            aria-label={`Mover o bloco ${index + 1} para cima`}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleMove("down")}
            disabled={isLast || isPending}
            aria-label={`Mover o bloco ${index + 1} para baixo`}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          {isMatrix && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setAxesOpen(true)}
              aria-label={
                item.itemType === "risk_matrix"
                  ? "Editar severidade e probabilidade"
                  : "Editar linhas e colunas"
              }
              title={
                item.itemType === "risk_matrix"
                  ? "Severidade e probabilidade"
                  : "Linhas e colunas"
              }
            >
              <Grid3x3 aria-hidden="true" />
            </Button>
          )}
          {acceptsValidations && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setRulesOpen(true)}
              aria-label={
                ruleCount === 0
                  ? "Adicionar regras de validação"
                  : ruleCount === 1
                    ? "Editar regras de validação (1 regra)"
                    : `Editar regras de validação (${ruleCount} regras)`
              }
              title="Regras de validação"
              className="relative"
            >
              <ShieldCheck aria-hidden="true" />
              {ruleCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[0.6rem] font-semibold text-primary-foreground"
                >
                  {ruleCount}
                </span>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditOpen(true)}
            aria-label="Editar bloco"
          >
            <Pencil aria-hidden="true" />
          </Button>

          {otherSections.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  aria-label="Mover bloco para outra seção"
                >
                  <MoveRight aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Mover para a seção</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {otherSections.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => handleMoveToSection(s.id)}
                  >
                    {s.title || (s.isDefault ? "Seção inicial" : "Seção sem título")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                aria-label="Excluir bloco"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isContainer ? "Excluir este grupo?" : "Excluir este bloco?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isContainer && children.length > 0 ? (
                    <>
                      O grupo e as{" "}
                      <strong>
                        {children.length}{" "}
                        {children.length === 1 ? "pergunta" : "perguntas"} dentro
                        dele
                      </strong>{" "}
                      serão removidos definitivamente desta seção. Esta ação não
                      pode ser desfeita.
                    </>
                  ) : (
                    <>
                      O bloco será removido definitivamente desta seção. Esta
                      ação não pode ser desfeita.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  {isContainer ? "Excluir grupo" : "Excluir bloco"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {isContainer ? (
        <ContainerChildren
          item={item}
          sections={sections}
          currentSectionId={currentSectionId}
          commissionId={commissionId}
          imageUrls={imageUrls ?? {}}
          onBeforeReorder={onBeforeReorder}
        />
      ) : (
        <BlockPreview item={item} imageUrl={imageUrl} />
      )}

      <BlockConditionNote item={item} sections={sections} />

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <ItemEditorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        item={item}
        sectionId={currentSectionId}
        sections={sections}
        commissionId={commissionId}
        imageUrl={imageUrl}
      />

      {/* Mounted only while open so the dialog's axis state is seeded from the
          CURRENT item on every open — after a save the builder refreshes and the
          next open must read the persisted axes, not a stale first render. */}
      {isMatrix && axesOpen && (
        <MatrixConfigDialog
          open={axesOpen}
          onOpenChange={setAxesOpen}
          item={item}
        />
      )}

      {/* Mounted only while open, for the same reason as the axes dialog: the
          rule drafts are seeded from the CURRENT item, and after a save the
          builder refreshes — the next open must read the persisted rules. This
          matters more here than for the axes, because the write is REPLACE with
          no key to match on, so a stale seed would DELETE the rules it missed. */}
      {acceptsValidations && rulesOpen && (
        <ValidationsDialog
          open={rulesOpen}
          onOpenChange={setRulesOpen}
          item={item}
          sections={sections}
          parentItemType={parentItemType}
        />
      )}
    </article>
  );
}

/**
 * FF-1 — a container's contents: its ordered children, each a full
 * {@link BlockCard} (so editing, reordering and deleting a child work exactly as
 * they do at top level), plus the nested "Adicionar pergunta ao grupo" picker.
 *
 * A child's reorder controls are bounded by its SIBLINGS: `isFirst`/`isLast` are
 * computed within the child list, so the first child cannot be moved above its
 * own parent and the last cannot be moved past the container's boundary — which
 * would break the contiguity `validate_group_layout` checks at publish. The
 * `moveItem` action enforces the same bound server-side.
 */
function ContainerChildren({
  item,
  sections,
  currentSectionId,
  commissionId,
  imageUrls,
  onBeforeReorder,
}: {
  item: Item;
  sections: Section[];
  currentSectionId: string;
  commissionId: string;
  imageUrls: Record<string, string>;
  onBeforeReorder: () => void;
}) {
  const children = item.children;
  const cardinality = describeCardinality(item);

  return (
    <div className="ml-9 flex flex-col gap-3 border-l-2 border-dashed border-border pl-4">
      {item.questionExplanation ? (
        <p className="text-sm text-muted-foreground text-pretty">
          {item.questionExplanation}
        </p>
      ) : null}

      {cardinality ? (
        <p className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
          {cardinality}
        </p>
      ) : null}

      {children.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
          Nenhuma pergunta neste grupo ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {children.map((child, childIndex) => (
            <BlockCard
              key={child.id}
              item={child}
              index={childIndex}
              isFirst={childIndex === 0}
              isLast={childIndex === children.length - 1}
              sections={sections}
              currentSectionId={currentSectionId}
              commissionId={commissionId}
              imageUrls={imageUrls}
              imageUrl={
                child.itemType === "image" && child.content
                  ? (imageUrls[
                      (child.content as { storage_path?: string })
                        .storage_path ?? ""
                    ] ?? null)
                  : null
              }
              isChild
              onBeforeReorder={onBeforeReorder}
            />
          ))}
        </div>
      )}

      <AddBlockMenu
        sectionId={currentSectionId}
        sections={sections}
        commissionId={commissionId}
        parentItem={{ id: item.id, label: item.label }}
      />
    </div>
  );
}

/**
 * A repeating group's cardinality as pt-BR copy, or `null` when it is
 * unbounded. `minInstances` is what makes a repeating group required (it is
 * checked at submit AFTER empty repetitions are pruned — ruling 3), so it reads
 * as an obligation, not as a bound.
 */
function describeCardinality(item: Item): string | null {
  if (!isRepeatingGroup(item.itemType)) return null;
  const min = item.config?.minInstances ?? null;
  const max = item.config?.maxInstances ?? null;
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return min === max
      ? `Exatamente ${min} ${min === 1 ? "repetição" : "repetições"}`
      : `De ${min} a ${max} repetições`;
  }
  if (min !== null) {
    return `No mínimo ${min} ${min === 1 ? "repetição" : "repetições"}`;
  }
  return `No máximo ${max} ${max === 1 ? "repetição" : "repetições"}`;
}

/** The block's primary line — the question label, or the type for display
 *  blocks that have no label. */
function BlockHeadline({ item }: { item: Item }) {
  if (item.label) {
    return (
      <span className="flex items-center gap-1.5 truncate font-medium">
        {item.label}
        {item.required && (
          <span className="text-destructive" aria-label="obrigatória">
            *
          </span>
        )}
      </span>
    );
  }
  return null;
}

/**
 * A muted footnote shown only when the block has a conditional appearance
 * (`visibleWhen`), so an author sees AT A GLANCE — without opening the editor —
 * that the question is shown conditionally and exactly what triggers it. The
 * controlling question's `question_key` is resolved to its human label via the
 * full section tree; multiple conditions are joined by E/OU per the group's
 * combinator.
 */
function BlockConditionNote({
  item,
  sections,
}: {
  item: Item;
  sections: Section[];
}) {
  const summary = useMemo(
    () =>
      describeVisibility(
        item.visibleWhen,
        buildQuestionLabelMap(sections),
        buildOptionLabelMap(sections),
      ),
    [item.visibleWhen, sections],
  );
  if (!summary) return null;

  const combinatorWord = summary.combinator === "any" ? "ou" : "e";

  return (
    <div className="ml-9 flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
      <Split
        aria-hidden="true"
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Aparece quando</span>{" "}
        {summary.clauses.map((clause, i) => (
          <span key={i}>
            {i > 0 && (
              <span className="font-medium text-foreground"> {combinatorWord} </span>
            )}
            <span className="font-medium text-foreground">{clause.target}</span>{" "}
            {clause.op}
            {clause.value && (
              <>
                {" "}
                <span className="font-medium text-foreground">
                  {clause.value}
                </span>
              </>
            )}
          </span>
        ))}
      </p>
    </div>
  );
}

/** A pt-BR number for an option's score (drops the trailing ".0" of an integer). */
function formatScore(score: number): string {
  return new Intl.NumberFormat("pt-BR").format(score);
}

// FF-2 — stable no-ops for the read-only matrix previews (the grids require the
// handler props; a read-only grid never invokes them).
const NO_OP_CELL: (rowCode: string, colCode: string) => void = () => {};
const NO_OP_RISK: (next: { severity: string; likelihood: string }) => void =
  () => {};

/** A compact, faithful preview of the block's content. */
function BlockPreview({
  item,
  imageUrl,
}: {
  item: Item;
  imageUrl: string | null;
}) {
  if (item.questionExplanation) {
    // help text shown muted; rendered as plain text here (it's a short hint).
  }

  if (
    (item.itemType === "multiple_choice" ||
      item.itemType === "dropdown" ||
      item.itemType === "checkbox") &&
    item.options
  ) {
    return (
      <div className="flex flex-col gap-1.5 pl-9">
        {item.questionExplanation && (
          <p className="text-sm text-muted-foreground">
            {item.questionExplanation}
          </p>
        )}
        <ul className="flex flex-wrap gap-1.5">
          {item.options.map((opt) => {
            // Surface the optional analytics metadata (score / analytics_code)
            // only when set, so the common label-only option stays uncluttered.
            const meta = [
              opt.score !== null ? `${formatScore(opt.score)} pt` : null,
              opt.analyticsCode,
            ].filter(Boolean) as string[];
            return (
              <li
                // Frontend audit #8: this is a read-only preview of a persisted
                // item's options (not reorderable here), so the stable DB `id`
                // is the correct key — no client-side id needed.
                key={opt.id || opt.code}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {opt.flagged && (
                  <Flag
                    aria-label="Sinalizada"
                    className="size-3 shrink-0 fill-destructive text-destructive"
                  />
                )}
                {opt.color && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TOKEN_COLOR_VAR[opt.color] }}
                  />
                )}
                {opt.label}
                {meta.length > 0 && (
                  <span className="text-muted-foreground/70">
                    · {meta.join(" · ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // FF-5 (ADR 0091) — a reference block previews as its LANE, because that is
  // the only thing an author configures and the only thing that changes what the
  // filler will see. The candidate list itself is deliberately NOT previewed: it
  // is resolved per RESPONSE (case-scoped for patients, invoker-scoped for the
  // other two lanes), so any list shown here would be the author's own reach,
  // not the filler's — a preview that is confidently wrong.
  if (item.itemType === "reference") {
    return (
      <div className="flex flex-col gap-1.5 pl-9">
        {item.questionExplanation && (
          <p className="text-sm text-muted-foreground">
            {item.questionExplanation}
          </p>
        )}
        <p className="w-fit rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
          {describeReferenceConfig(
            item.config?.referenceKind ?? "participant",
            item.config?.participantTypes ?? null,
          )}
        </p>
      </div>
    );
  }

  if (item.itemType === "free_text") {
    return (
      <div className="flex flex-col gap-1.5 pl-9">
        {item.questionExplanation && (
          <p className="text-sm text-muted-foreground">
            {item.questionExplanation}
          </p>
        )}
        <div className="h-9 rounded-lg border border-dashed border-border bg-muted/30" />
      </div>
    );
  }

  // FF-2 — the matrix preview is the WIZARD's own grid in read-only mode, not a
  // second rendering of the same data: an author who cannot see the real grid
  // cannot tell that a scale reads badly, and two renderers would drift.
  if (isMatrixItem(item.itemType)) {
    const rows = item.matrixRows ?? [];
    const columns = item.matrixColumns ?? [];
    // An axis-less matrix is a real, publish-BLOCKING state (HC0P5), so it is
    // called out here rather than shown as an empty grid the author might read
    // as merely unstyled.
    if (rows.length === 0 || columns.length === 0) {
      return (
        <div className="flex flex-col gap-1.5 pl-9">
          {item.questionExplanation && (
            <p className="text-sm text-muted-foreground">
              {item.questionExplanation}
            </p>
          )}
          <p className="rounded-lg border border-dashed border-warning/40 bg-warning/12 px-3 py-2 text-sm font-medium text-warning text-pretty">
            {item.itemType === "risk_matrix"
              ? "Defina a severidade e a probabilidade antes de publicar."
              : "Defina as linhas e as colunas antes de publicar."}
          </p>
        </div>
      );
    }
    return (
      <div className="pl-9">
        {item.itemType === "risk_matrix" ? (
          <RiskMatrixPicker
            item={item}
            selection={undefined}
            onChange={NO_OP_RISK}
            readOnly
          />
        ) : (
          <MatrixGrid
            item={item}
            cells={undefined}
            onChange={NO_OP_CELL}
            readOnly
          />
        )}
      </div>
    );
  }

  if (item.itemType === "section_text" && item.content) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 pl-9">
        <MarkdownRenderer
          content={(item.content as SectionTextContent).markdown}
        />
      </div>
    );
  }

  if (item.itemType === "image" && item.content) {
    const content = item.content as ImageContent;
    return (
      <div className="pl-9">
        <ImagePreview
          url={imageUrl}
          alt={content.alt}
          caption={content.caption ?? null}
        />
      </div>
    );
  }

  return null;
}
