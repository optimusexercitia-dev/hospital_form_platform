import type {
  ImageContent,
  Item,
  Section,
  SectionTextContent,
  VersionTree,
} from "@/lib/queries/forms";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import { ImagePreview } from "@/components/forms/image-preview";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

/**
 * Read-only, version-faithful render of a form version's structure — sections
 * with their condition/sign-off markers and ordered blocks. Server-Component-safe
 * (no hooks, no actions): used by the published-version view and the version
 * history page (Phase 4), and intended for reuse by the Phase 7 submission viewer.
 *
 * Honours the default-section rule: a version whose only section is the default
 * renders as a flat block list with no section chrome.
 */
export function ReadOnlyTree({
  tree,
  imageUrls,
}: {
  tree: VersionTree;
  imageUrls: Record<string, string>;
}) {
  const sections = tree.sections;
  const isFlat = sections.length === 1 && sections[0].isDefault;

  if (isFlat) {
    return (
      <div className="flex flex-col gap-3">
        {sections[0].items.length === 0 ? (
          <EmptySection />
        ) : (
          sections[0].items.map((item) => (
            <ReadOnlyBlock key={item.id} item={item} imageUrls={imageUrls} />
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section, index) => (
        <ReadOnlySection
          key={section.id}
          section={section}
          index={index}
          imageUrls={imageUrls}
        />
      ))}
    </div>
  );
}

function ReadOnlySection({
  section,
  index,
  imageUrls,
}: {
  section: Section;
  index: number;
  imageUrls: Record<string, string>;
}) {
  const heading = section.isDefault
    ? "Seção inicial"
    : section.title || "Seção sem título";

  return (
    <section
      aria-label={heading}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Seção {index + 1}
          </span>
          {section.visibleWhen && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              condicional
            </span>
          )}
          {section.requiresSignoff && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
              assinatura
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold">{heading}</h2>
        {section.description && (
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            {section.description}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {section.items.length === 0 ? (
          <EmptySection />
        ) : (
          section.items.map((item) => (
            <ReadOnlyBlock key={item.id} item={item} imageUrls={imageUrls} />
          ))
        )}
      </div>
    </section>
  );
}

function EmptySection() {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
      Seção sem blocos.
    </p>
  );
}

/** One block rendered read-only, faithful to its type. */
function ReadOnlyBlock({
  item,
  imageUrls,
}: {
  item: Item;
  imageUrls: Record<string, string>;
}) {
  const meta = ITEM_TYPE_META[item.itemType];

  if (item.itemType === "section_text" && item.content) {
    return (
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <MarkdownRenderer content={(item.content as SectionTextContent).markdown} />
      </div>
    );
  }

  if (item.itemType === "image" && item.content) {
    const content = item.content as ImageContent;
    return (
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <ImagePreview
          url={imageUrls[content.storage_path] ?? null}
          alt={content.alt}
          caption={content.caption ?? null}
        />
      </div>
    );
  }

  // Input item.
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4">
      <div className="flex items-start gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          {item.label}
          {item.required && (
            <span className="text-destructive" aria-label="obrigatória">
              *
            </span>
          )}
        </h3>
      </div>
      <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {meta.label}
      </span>
      {item.questionExplanation && (
        <p className="text-sm text-muted-foreground">{item.questionExplanation}</p>
      )}
      {item.options && item.options.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {item.options.map((opt, i) => (
            <li
              key={i}
              className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
      {item.itemType === "free_text" && (
        <div className="h-9 rounded-lg border border-dashed border-border bg-muted/30" />
      )}
    </article>
  );
}
