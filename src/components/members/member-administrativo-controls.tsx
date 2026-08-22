"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";

import type { MemberCapability } from "@/lib/queries/members";
import {
  appointAdministrativo,
  revokeAdministrativo,
  grantMemberCapability,
  revokeMemberCapability,
} from "@/lib/members/actions";
import { Button } from "@/components/ui/button";

/**
 * Coordinator controls for the "Administrativo" delegation (ADR 0061), rendered per
 * `staff` row in the member manager. A coordinator may appoint a member as an
 * Administrativo and toggle a finite menu of capabilities on them; the appointment +
 * each capability route through guarded SECURITY DEFINER RPCs (the server actions),
 * which carry their own escalation gate — the UI is a convenience, RLS is the
 * authority. Coordinators already hold every capability, so this only renders on
 * non-coordinator `staff` rows (the parent decides).
 *
 * Minimum-necessary (Rule 12): on a PHI-bearing commission `create_cases` lets the
 * member enter and read patient context — `showPhiNotice` surfaces that plainly.
 *
 * This menu is one of the hand-maintained copies of the capability vocabulary
 * enumerated in `MemberCapability`'s doc comment — keep it in sync with that union.
 * A `hint` renders under its checkbox and is wired to it via `aria-describedby`.
 */

const CAPABILITIES: { key: MemberCapability; label: string; hint?: string }[] = [
  { key: "schedule_meetings", label: "Agendar e gerenciar reuniões" },
  {
    key: "create_cases",
    label: "Criar e editar casos",
  },
  { key: "assign_case_phases", label: "Ativar e atribuir fases dos casos" },
  { key: "view_signoffs", label: "Ver a fila de assinaturas pendentes" },
  {
    // ADR 0134 D6 + Amendment 4: read only, and bounded by the case's visibility
    // policy — an `explicit_grants_only` case is NOT reached by this capability.
    key: "read_cases",
    label: "Visualizar os casos da comissão",
    // The reach ("todos") is stated in the hint's FIRST clause, where the next
    // sentence bounds it — never in the label, which stands alone in the checklist
    // and is the text a coordinator decides on.
    //
    // ⚠ KNOWN, NOT AN OVERSIGHT: `explicit_grants_only` has TWO user-facing labels in
    // this codebase. The quoted one is the general-cases label
    // (`VISIBILITY_POLICY_LABELS` in `lib/cases/case-types.ts`), which is what a
    // coordinator sees on a case; the ethics module carries its own wording
    // ("Somente por concessão explícita", `components/ethics/ethics-labels.ts`). Do
    // NOT "unify" this to the ethics wording — this is a cases screen, and it must
    // name the policy with the words the case itself shows.
    hint:
      "Dá acesso de leitura a todos os casos da comissão, mesmo sem liberação " +
      "individual. Somente leitura: não permite criar, editar ou encerrar casos, " +
      "nem dá acesso a dados de paciente. Casos com visibilidade “Somente quem " +
      "receber acesso” ficam de fora — neles, o acesso continua dependendo de uma " +
      "liberação individual.",
  },
];

export function MemberAdministrativoControls({
  commissionId,
  userId,
  memberName,
  initialAppointed,
  initialCapabilities,
  showPhiNotice,
}: {
  commissionId: string;
  userId: string;
  memberName: string;
  initialAppointed: boolean;
  initialCapabilities: MemberCapability[];
  /** Whether to show the PHI/minimum-necessary note under `create_cases`. */
  showPhiNotice: boolean;
}) {
  const [appointed, setAppointed] = useState(initialAppointed);
  const [caps, setCaps] = useState<Set<MemberCapability>>(
    () => new Set(initialCapabilities),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fieldsFor(extra?: Record<string, string>): FormData {
    const fd = new FormData();
    fd.set("commissionId", commissionId);
    fd.set("userId", userId);
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
    return fd;
  }

  function toggleAppointment() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const action = appointed ? revokeAdministrativo : appointAdministrativo;
      const res = await action(undefined, fieldsFor());
      if (!res.ok) {
        setError(res.error ?? "Não foi possível concluir.");
        return;
      }
      if (appointed) {
        // Un-appointing cascades every capability away.
        setCaps(new Set());
        setAppointed(false);
      } else {
        setAppointed(true);
      }
      setMessage(res.error ?? null);
    });
  }

  function toggleCapability(cap: MemberCapability, next: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const action = next ? grantMemberCapability : revokeMemberCapability;
      const res = await action(undefined, fieldsFor({ capability: cap }));
      if (!res.ok) {
        setError(res.error ?? "Não foi possível concluir.");
        return;
      }
      setCaps((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(cap);
        else copy.delete(cap);
        return copy;
      });
      setMessage(res.error ?? null);
    });
  }

  const legendId = `admin-caps-${userId}`;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {appointed ? (
            <ShieldCheck
              aria-hidden="true"
              className="size-4 text-primary"
            />
          ) : (
            <ShieldOff
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          )}
          <span className="text-sm font-medium">
            {appointed
              ? "Administrativo desta comissão"
              : "Delegar tarefas administrativas"}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant={appointed ? "outline" : "default"}
          disabled={isPending}
          onClick={toggleAppointment}
        >
          {appointed ? "Remover delegação" : "Tornar Administrativo"}
        </Button>
      </div>

      {!appointed && (
        <p className="max-w-prose text-xs text-muted-foreground text-pretty">
          Um Administrativo ajuda na burocracia da comissão (reuniões, casos,
          fases, assinaturas) sem ter a autoridade da coordenação. Escolha, abaixo,
          exatamente quais permissões conceder.
        </p>
      )}

      {appointed && (
        <fieldset className="flex flex-col gap-2.5" aria-describedby={legendId}>
          <legend id={legendId} className="text-xs font-medium text-muted-foreground">
            Permissões de {memberName}
          </legend>
          {CAPABILITIES.map((c) => {
            const checked = caps.has(c.key);
            const inputId = `cap-${userId}-${c.key}`;
            const hintId = `cap-${userId}-${c.key}-hint`;
            const phiId = `cap-${userId}-${c.key}-phi`;
            const showPhi = c.key === "create_cases" && showPhiNotice;
            // Every note rendered under a checkbox is announced WITH it. The PHI
            // notice used to be a bare sibling <p>, so a screen-reader user toggling
            // `create_cases` never heard the warning it exists to give them.
            const describedBy =
              [c.hint ? hintId : null, showPhi ? phiId : null]
                .filter(Boolean)
                .join(" ") || undefined;
            return (
              <div key={c.key} className="flex flex-col gap-1">
                <label
                  htmlFor={inputId}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    disabled={isPending}
                    aria-describedby={describedBy}
                    onChange={(e) => toggleCapability(c.key, e.target.checked)}
                    className="size-4 rounded border-input text-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  />
                  <span>{c.label}</span>
                </label>
                {c.hint && (
                  <p
                    id={hintId}
                    className="ml-6.5 max-w-prose text-xs text-muted-foreground text-pretty"
                  >
                    {c.hint}
                  </p>
                )}
                {showPhi && (
                  <p
                    id={phiId}
                    className="ml-6.5 max-w-prose text-xs text-warning text-pretty"
                  >
                    Nesta comissão os casos podem registrar identificadores de
                    paciente. Esta permissão deixa a pessoa digitá-los apenas no
                    momento de criar um caso — individual ou em lote. Ela não pode
                    consultar, editar nem excluir identificadores depois, nem os que
                    ela mesma digitou (uso mínimo necessário — LGPD).
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      {!error && message && (
        <p role="status" className="text-xs font-medium text-success">
          {message}
        </p>
      )}
    </div>
  );
}
