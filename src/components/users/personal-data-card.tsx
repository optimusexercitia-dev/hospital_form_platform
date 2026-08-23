"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import type { OrgUserDetail, ProfessionalCategory } from "@/lib/users/types";
import type { PersonPersonalData } from "@/lib/users/person-footprint";
import { formatPhone } from "@/components/users/phone-field";
import { UserProfileEditForm } from "@/components/users/user-profile-edit-form";

/**
 * The profile rail's "Dados pessoais" card (AFF2 F2 — handoff §Screen 2).
 *
 * Owns the display/edit swap so `UserProfileEditForm` can be form-only, and owns the
 * three states this card genuinely has — which is one more than the old page had.
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
 * ⚠ PER-CAPABILITY, NOT PER-PERSON (ADR 0133 Amdt 1 ruling 1). `canEditPerson`
 * (INTERSECTION) admits the "Editar" affordance; `canManageAccountLifecycle` (SUBSET)
 * admits the CPF field inside the form. For a person who works at more than one hospital
 * these DISAGREE — a hospital_admin may fix the name and may not rewrite the person key —
 * and the footer note says which half is out of reach rather than the retired
 * "somente organização" absolute.
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
   * The save confirmation lives HERE, in the component that survives the collapse.
   *
   * ⛔ BUG-AFF2-PROFILE-SAVE-BANNER-UNMOUNTS: the form used to set its own success flag
   * and then call `onSaved`, which collapses this disclosure — both in one React commit,
   * so the banner mounted and unmounted without painting. The write succeeded and the
   * admin was told nothing, which is why every functional assertion passed.
   */
  const [saved, setSaved] = useState(false);

  return (
    <section
      aria-labelledby="dados-pessoais-heading"
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
      style={{ ["--rise-delay" as string]: "100ms" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="dados-pessoais-heading" className="text-base font-semibold">
          Dados pessoais
        </h2>
        {personalData && canEditPerson ? (
          /* A DISCLOSURE, announced as one. `aria-expanded` + `aria-controls` tell a
             screen-reader user that this control reveals something and whether it is
             open — the alternative, moving focus into the form, steals it from a
             sighted keyboard user who only wanted to see the fields. The label change
             alone announces nothing about the form appearing below. */
          <button
            type="button"
            onClick={() => {
              // Reopening to edit again retires the previous confirmation — leaving it
              // up would have it describe a save the admin has moved on from.
              setSaved(false);
              setEditing((v) => !v);
            }}
            aria-expanded={editing}
            aria-controls="dados-pessoais-form"
            className="rounded-md text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {editing ? "Cancelar" : "Editar"}
          </button>
        ) : null}
      </div>

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
            ? "rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[0.75rem] font-medium text-success"
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
      ) : editing ? (
        <div id="dados-pessoais-form">
          <UserProfileEditForm
            user={user}
            categories={categories}
            personalData={personalData}
            canEditCpf={canManageAccountLifecycle}
            onSaved={() => {
              setEditing(false);
              setSaved(true);
            }}
          />
        </div>
      ) : (
        <>
          <dl className="flex flex-col gap-2.5 text-[0.8rem]">
            <Row label="CPF">
              {/* D12 — PRESENCE ONLY. No digits, masked or otherwise. */}
              {personalData.cpfPresent ? (
                <span className="inline-flex items-center gap-1 text-success">
                  Cadastrado
                  <span aria-hidden="true">✓</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </Row>
            <Row label="Nascimento">
              {personalData.dateOfBirth ? (
                <span>{formatIsoDatePtBr(personalData.dateOfBirth)}</span>
              ) : (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </Row>
            <Row label="Telefone">
              {personalData.phone ? (
                <span className="font-mono">{formatPhone(personalData.phone)}</span>
              ) : (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </Row>
            <Row label="Categoria">
              {user.categoryLabel ? (
                <span>{user.categoryLabel}</span>
              ) : (
                <span className="text-muted-foreground">Não informada</span>
              )}
            </Row>
          </dl>

          {canEditPerson && !canManageAccountLifecycle ? (
            /* The Amdt 1 split, in words: fields yes, key and account no. */
            <ScopeNote>
              Esta pessoa atua em mais de um hospital. Alterações de CPF e a
              desativação ou reativação da conta são da administração da
              organização.
            </ScopeNote>
          ) : (
            <p className="border-t border-border pt-3 text-[0.7rem] text-muted-foreground text-pretty">
              Fatos sobre a pessoa, não sobre um hospital.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}

/** Status carried by icon + wording together, never by colour alone. */
function ScopeNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[0.75rem] text-muted-foreground text-pretty">
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
