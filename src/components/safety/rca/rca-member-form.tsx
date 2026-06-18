"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  RCA_MEMBER_ROLE_LABELS,
  type AssignableUser,
  type RcaMember,
  type RcaMemberInput,
  type RcaMemberRole,
} from "@/lib/safety/rca-types";
import type { ActionState } from "@/lib/safety/types";
import { addRcaMember, updateRcaMemberRole } from "@/lib/safety/rca-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { cn } from "@/lib/utils";

/** Display label for a roster user (name, falling back to email). */
function userLabel(user: AssignableUser): string {
  return user.name ?? user.email ?? "Usuário";
}

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

const ROLE_ORDER: RcaMemberRole[] = [
  "lead",
  "facilitator",
  "sme",
  "reviewer",
  "executive_sponsor",
  "observer",
];

/**
 * Add/edit an RCA team member (README track-doc). A platform USER (from the roster)
 * XOR an EXTERNAL participant (free-text name), with a fixed role. On `edit` only the
 * role is mutable (`updateRcaMemberRole`); identity is fixed once added. Mirrors the
 * interview interviewer form.
 */
export function RcaMemberForm({
  mode,
  open,
  onOpenChange,
  rcaId,
  member,
  users,
  usedUserIds,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rcaId: string;
  /** Required for `edit`. */
  member?: RcaMember;
  /** The admin/PQS-wide assignable-user roster (`listAssignableUsers`). */
  users: AssignableUser[];
  /** User ids already on the team (excluded from the picker). */
  usedUserIds: Set<string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [kind, setKind] = useState<"user" | "external">("user");
  const [userId, setUserId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [role, setRole] = useState<RcaMemberRole>(member?.role ?? "sme");

  const availableUsers = users.filter((u) => !usedUserIds.has(u.id));

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setKind(availableUsers.length > 0 ? "user" : "external");
      setUserId("");
      setExternalName("");
      setRole(member?.role ?? "sme");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (mode === "edit" && member) {
        setState(await updateRcaMemberRole(member.id, role));
        return;
      }
      const input: RcaMemberInput = {
        userId: kind === "user" ? userId || null : null,
        externalName: kind === "external" ? externalName.trim() || null : null,
        role,
      };
      setState(await addRcaMember(rcaId, input));
    });
  }

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar papel do integrante" : "Adicionar integrante"}
          </DialogTitle>
          <DialogDescription>
            A equipe da RCA conduz a análise. Integrantes registrados (exceto
            observadores) podem editar; observadores têm acesso somente leitura.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          {!isEdit && (
            <>
              <div
                role="radiogroup"
                aria-label="Tipo de integrante"
                className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5"
              >
                <KindTab
                  active={kind === "user"}
                  onClick={() => setKind("user")}
                  label="Membro da plataforma"
                  disabled={availableUsers.length === 0}
                />
                <KindTab
                  active={kind === "external"}
                  onClick={() => setKind("external")}
                  label="Externo"
                />
              </div>

              {kind === "user" ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Membro</span>
                  {availableUsers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Nenhum usuário disponível para seleção. Adicione um
                      participante externo pelo nome.
                    </p>
                  ) : (
                    <select
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      required
                      className={FIELD_CLASS}
                    >
                      <option value="">Selecione…</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              ) : (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Nome do participante externo</span>
                  <input
                    type="text"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    required
                    className={FIELD_CLASS}
                    placeholder="Ex.: Dra. Ana Okafor (consultora externa)"
                  />
                </label>
              )}
            </>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Papel</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RcaMemberRole)}
              className={FIELD_CLASS}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {RCA_MEMBER_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : isEdit
                  ? "Salvar papel"
                  : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KindTab({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
