"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import type { OrgUserDetail, ProfessionalCategory } from "@/lib/users/types";
import type { PersonPersonalData } from "@/lib/users/person-footprint";
import { formatPhone } from "@/components/users/phone-field";
import { PersonalDataDialog } from "@/components/users/personal-data-dialog";
import {
  CardFootnote,
  CardTextButton,
  DefinitionRow,
  RailCard,
} from "@/components/users/profile-cards";

/**
 * The profile rail's "Dados pessoais" card (AFF2 F2; redesign 2a rail + dialog 3a).
 *
 * Owns the read view, the trigger for dialog 3a, and the three states this card
 * genuinely has — which is one more than a naive read/edit pair.
 *
 * ⛔ THE THREE STATES ARE NOT TWO. `personalData === null` means **WITHHELD** (the
 * caller lacks the `fields` capability); a `null` INSIDE it means **NOT INFORMED**.
 * Collapsing them renders "Não informado" for a person who has a birth date, which
 * manufactures exactly the "empty means no permission" ambiguity ADR 0133's own
 * Alternatives table cites as the reason the credentials RLS was widened. B6 returns the
 * nested shape specifically so the type forces this branch instead of leaving it to
 * memory — so the outer null is checked first, and it renders the scope note, never a
 * value.
 *
 * ⚠ CPF RENDERS AS A SERVER-COMPUTED MASK (`cpfMasked`, e.g. `412.•••.•84-20`), which
 * AMENDS ADR 0133 D12's "presence only". The raw digits still never cross the wire —
 * `cpf` remains outside the `authenticated` column grants and the mask is built
 * server-side in B6. `cpfMasked === null` means NOT INFORMED, and is a different fact
 * from the withheld branch above; the two must not converge on the same string.
 *
 * ⚠ PER-CAPABILITY, NOT PER-PERSON (ADR 0133 Amdt 1 ruling 1). `canEditPerson`
 * (INTERSECTION) admits the "Editar" affordance; `canManageAccountLifecycle` (SUBSET)
 * admits the CPF field inside the dialog. For a person who works at more than one
 * hospital these DISAGREE — a hospital_admin may fix the name and may not rewrite the
 * person key — and the footer note says which half is out of reach rather than the
 * retired "somente organização" absolute.
 *
 * ⚠ NO "Especialidade" ROW. The design asks for one; no column stores it. An omitted
 * row is honest, a placeholder row is a promise the data cannot keep.
 */
export function PersonalDataCard({
  user,
  categories,
  personalData,
  canEditPerson,
  canManageAccountLifecycle,
}: {
  user: OrgUserDetail;
  categories: ProfessionalCategory[];
  /** ⛔ `null` = WITHHELD, not "nothing informed". See the note above. */
  personalData: PersonPersonalData | null;
  canEditPerson: boolean;
  canManageAccountLifecycle: boolean;
}) {
  const [editing, setEditing] = useState(false);
  /**
   * The save confirmation lives HERE, in the component that survives the close.
   *
   * ⛔ BUG-AFF2-PROFILE-SAVE-BANNER-UNMOUNTS: the form used to set its own success flag
   * and then call `onSaved`, which tears down the editor — both in one React commit, so
   * the banner mounted and unmounted without painting. The write succeeded and the admin
   * was told nothing, which is why every functional assertion passed. Moving the editor
   * from a disclosure into a MODAL does not retire that hazard, it sharpens it: closing
   * a dialog unmounts its whole subtree just as surely.
   */
  const [saved, setSaved] = useState(false);

  return (
    <RailCard
      titleId="dados-pessoais-heading"
      title="Dados pessoais"
      riseDelay="100ms"
      action={
        personalData && canEditPerson ? (
          /* A DIALOG TRIGGER, announced as one. `aria-haspopup="dialog"` tells a screen
             reader that activating this opens a modal rather than revealing content in
             place — the disclosure's `aria-expanded`/`aria-controls` pair would now be a
             lie, because nothing expands and the panel it names is portaled out of this
             card's subtree entirely. */
          <CardTextButton
            aria-haspopup="dialog"
            onClick={() => {
              // Reopening to edit again retires the previous confirmation — leaving it
              // up would have it describe a save the admin has moved on from.
              setSaved(false);
              setEditing(true);
            }}
          >
            Editar
          </CardTextButton>
        ) : null
      }
    >
      {/* ⛔ PERMANENTLY MOUNTED, EMPTY UNTIL THERE IS SOMETHING TO SAY. A live region
          that mounts together with its content is announced unreliably — the same
          reason `register-person-flow` moves focus instead of wrapping its outcome in
          one. Rendering `{saved ? <p role="status">…</p> : null}` would put the text
          and the region in the same commit and reintroduce silence by a second route,
          after the first route was the banner unmounting before it painted. */}
      <p
        role="status"
        aria-live="polite"
        className={
          saved
            ? "rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[0.72rem] font-medium text-success"
            : "sr-only"
        }
      >
        {saved ? "Perfil atualizado." : ""}
      </p>

      {personalData === null ? (
        /* WITHHELD — no values exist to show, so none are invented.
           ⛔ The copy names the CARD, not a direction. This rail sits beside the main
           column only at `lg` and up and stacks BELOW it on narrow screens, so "ao
           lado" was false on every phone — copy that depends on the viewport is copy
           that is wrong half the time. */
        <ScopeNote>
          Os dados pessoais desta pessoa são administrados pela organização. O
          vínculo com o seu hospital e a matrícula você gerencia em “Vínculos
          hospitalares”.
        </ScopeNote>
      ) : (
        <>
          <dl className="flex flex-col gap-2.5 text-[0.78rem]">
            <DefinitionRow label="CPF">
              {personalData.cpfMasked ? (
                <span className="font-mono text-[0.72rem]">
                  {personalData.cpfMasked}
                </span>
              ) : (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </DefinitionRow>
            <DefinitionRow label="Nascimento">
              {personalData.dateOfBirth ? (
                <span>{formatIsoDatePtBr(personalData.dateOfBirth)}</span>
              ) : (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </DefinitionRow>
            <DefinitionRow label="Telefone">
              {personalData.phone ? (
                <span className="font-mono text-[0.72rem]">
                  {formatPhone(personalData.phone)}
                </span>
              ) : (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </DefinitionRow>
            <DefinitionRow label="Categoria">
              {user.categoryLabel ? (
                <span>{user.categoryLabel}</span>
              ) : (
                <span className="text-muted-foreground">Não informada</span>
              )}
            </DefinitionRow>
          </dl>

          {canEditPerson && !canManageAccountLifecycle ? (
            /* The Amdt 1 split, in words: fields yes, key and account no. */
            <ScopeNote>
              Esta pessoa atua em mais de um hospital. Alterações de CPF e a
              desativação ou reativação da conta são da administração da
              organização.
            </ScopeNote>
          ) : (
            <CardFootnote>
              Fatos sobre a pessoa — editáveis apenas pela administração da
              organização.
            </CardFootnote>
          )}
        </>
      )}

      {editing && personalData ? (
        <PersonalDataDialog
          user={user}
          categories={categories}
          personalData={personalData}
          canEditCpf={canManageAccountLifecycle}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </RailCard>
  );
}

/** Status carried by icon + wording together, never by colour alone. */
function ScopeNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[0.72rem] text-muted-foreground text-pretty">
      <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      {children}
    </p>
  );
}

/**
 * `yyyy-mm-dd` → pt-BR. Read as LOCAL calendar parts: `new Date(iso)` parses a bare date
 * as UTC midnight, which renders as the PREVIOUS day for anyone west of Greenwich — a
 * birth date silently off by one.
 */
function formatIsoDatePtBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(y, m - 1, d));
}
