import Link from "next/link";
import { Archive, PencilRuler, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TemplateVersionStatus } from "@/lib/queries/process-templates";

/**
 * The explanatory chrome that makes ADR 0096 D2's workflow visible.
 *
 * D2 is a real behavioural change for staff_admins: a published process can no
 * longer be edited in place. Pressing "Editar" clones it to a draft, and **new
 * cases keep using the published version until that draft is published**. That is
 * the single easiest thing to get wrong — an author edits, walks away satisfied,
 * and nothing they changed ever reaches a case. A status badge cannot carry that;
 * it needs a sentence. So this is a full explanatory card in the header spine, not
 * a pill, and it is present on EVERY state rather than only the dangerous one —
 * a warning that appears only sometimes teaches people to skim past it.
 *
 * The three states are mutually exclusive and answer one question each:
 *
 *  - `draft`     → "what you are editing is NOT what cases are using right now."
 *  - `published` → "this is what cases use; editing will fork it, not change it."
 *  - `archived`  → "this is history; it is preserved, not active."
 *
 * A Server Component. Every destination is a plain href string built by the caller
 * with `commissionHref` — no server function is ever passed as a prop (BUG-QI-001),
 * and no client JS ships for what is, correctly, static explanatory text.
 */

/** The visual + copy treatment for one lifecycle state. */
interface BannerTone {
  container: string;
  iconWrap: string;
  Icon: typeof PencilRuler;
}

const TONES: Record<TemplateVersionStatus, BannerTone> = {
  // Amber, matching the `Rascunho` badge: in progress, needs an action to land.
  draft: {
    container: "border-warning/30 bg-warning/8",
    iconWrap: "bg-warning/15 text-warning",
    Icon: PencilRuler,
  },
  // Petrol accent, matching the `Publicada` badge: this is the live, trusted state.
  published: {
    container: "border-primary/25 bg-accent/40",
    iconWrap: "bg-primary/12 text-primary",
    Icon: ShieldCheck,
  },
  // Neutral: history is not a problem to fix, so it gets no colour temperature.
  archived: {
    container: "border-border bg-muted/40",
    iconWrap: "bg-muted text-muted-foreground",
    Icon: Archive,
  },
};

/**
 * The archived state's second sentence, built whole rather than assembled from
 * inline ternaries: pt-BR agreement here spans the article, the noun, the verb AND
 * two participles, and interleaving five `{count === 1 ? … : …}` into JSX produced
 * a sentence no reviewer could check. One string per grammatical number instead.
 */
function preservedCasesSentence(count: number): string {
  if (count <= 0) {
    return "Nenhum caso chegou a ser aberto sob ela.";
  }
  if (count === 1) {
    return "O único caso aberto sob ela segue preservado exatamente como estava, com as fases definidas no momento da criação.";
  }
  return `Os ${count} casos abertos sob ela seguem preservados exatamente como estavam, com as fases definidas no momento da criação.`;
}

export function VersionWorkflowBanner({
  status,
  versionNumber,
  caseCount,
  publishedVersionNumber,
  publishedVersionHref,
  draftVersionNumber,
  draftVersionHref,
  className,
}: {
  status: TemplateVersionStatus;
  /** The version being viewed. */
  versionNumber: number;
  /** How many cases ran under the version being viewed. */
  caseCount: number;
  /**
   * The version currently IN FORCE for new cases, or `null` when the template has
   * never published. On a draft this is the whole point of the message.
   */
  publishedVersionNumber: number | null;
  /** Href of the published version, or `null` when there is none / it is in view. */
  publishedVersionHref: string | null;
  /** The open draft, when one exists and is not the version in view. */
  draftVersionNumber: number | null;
  draftVersionHref: string | null;
  className?: string;
}) {
  const tone = TONES[status];
  const { Icon } = tone;

  const headingId = "version-workflow-heading";

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "animate-rise-in flex items-start gap-4 rounded-2xl border p-5",
        tone.container,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          tone.iconWrap,
        )}
      >
        <Icon className="size-4.5" />
      </span>

      <div className="flex min-w-0 flex-col gap-2">
        {status === "draft" && (
          <>
            <h2 id={headingId} className="text-base font-semibold">
              Você está editando o rascunho da versão {versionNumber}
            </h2>
            {publishedVersionNumber != null ? (
              <p className="max-w-prose text-sm text-pretty">
                Novos casos continuam sendo abertos com a{" "}
                <strong className="font-semibold">
                  versão {publishedVersionNumber}
                </strong>
                , que permanece em vigor. Nada do que você alterar aqui chega aos
                casos enquanto este rascunho não for publicado.
              </p>
            ) : (
              <p className="max-w-prose text-sm text-pretty">
                Este processo ainda não tem nenhuma versão publicada, então ainda
                não é possível abrir casos com ele. Publique esta versão para
                colocá-lo em uso.
              </p>
            )}
            {publishedVersionHref && publishedVersionNumber != null && (
              <VersionLink href={publishedVersionHref}>
                Ver a versão {publishedVersionNumber}, em vigor
              </VersionLink>
            )}
          </>
        )}

        {status === "published" && (
          <>
            <h2 id={headingId} className="text-base font-semibold">
              Versão {versionNumber} — em vigor
            </h2>
            <p className="max-w-prose text-sm text-pretty">
              Esta é a versão usada para abrir novos casos, e por isso não pode
              mais ser alterada. Ao editar, criamos um rascunho a partir dela: a
              versão {versionNumber} continua valendo até que você publique esse
              rascunho.
            </p>
            {draftVersionNumber != null && draftVersionHref && (
              <>
                <p className="max-w-prose text-sm text-pretty">
                  Já existe um rascunho em aberto — a versão {draftVersionNumber},
                  ainda não publicada.
                </p>
                <VersionLink href={draftVersionHref}>
                  Continuar o rascunho da versão {draftVersionNumber}
                </VersionLink>
              </>
            )}
          </>
        )}

        {status === "archived" && (
          <>
            <h2 id={headingId} className="text-base font-semibold">
              Versão {versionNumber} — arquivada
            </h2>
            <p className="max-w-prose text-sm text-pretty">
              Esta versão não é mais usada para abrir novos casos.{" "}
              {preservedCasesSentence(caseCount)}
            </p>
            {publishedVersionHref && publishedVersionNumber != null && (
              <VersionLink href={publishedVersionHref}>
                Ver a versão {publishedVersionNumber}, em vigor
              </VersionLink>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** A quiet inline navigation affordance to another version of the same template. */
function VersionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="w-fit rounded text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
