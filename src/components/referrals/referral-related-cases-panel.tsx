"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Link2, X } from "lucide-react";

import {
  linkReferralRelatedCase,
  unlinkReferralCase,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import {
  REFERRAL_CASE_RELATIONSHIP_LABELS,
  type ReferralCaseLink,
  type ReferralCaseRelationship,
} from "@/lib/referrals/types";
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
import { NativeSelect } from "@/components/ui/native-select";
import { REFERRAL_META_CHIP_BASE, referralTypeChipClass } from "./format";
import { formatCaseNumber } from "./format";

const RELATIONSHIP_ORDER: ReferralCaseRelationship[] = [
  "related_case",
  "follow_up_case",
  "escalated_case",
  "duplicate_case",
];

/** A case of the viewer's side the coordinator may relate (id + number + label). */
export interface RelatableCase {
  id: string;
  caseNumber: number;
  label: string | null;
}

/**
 * The related-cases panel on the referral detail (RV2 R4). TYPED, PHI-free pointers
 * from this referral to other cases (distinct from the PRIMARY target-case link).
 * A pointer ONLY — it grants NO access to the linked case (the read predicates never
 * consult it). Any metadata-tier reader sees the links; a coordinator of EITHER side
 * may add one, and remove a link their own side recorded (the RPCs re-check: 42501
 * for a non-coordinator, HC0A8 for an invalid/duplicate link).
 */
export function ReferralRelatedCasesPanel({
  referralId,
  links,
  canManage,
  myCommissionId,
  relatableCases,
}: {
  referralId: string;
  links: ReferralCaseLink[];
  /** Whether the viewer coordinates a side (may add/remove links). */
  canManage: boolean;
  /** The viewer's side commission (links they may remove carry this id). */
  myCommissionId: string;
  /** Cases of the viewer's side for the relate picker. `[]` when !canManage. */
  relatableCases: RelatableCase[];
}) {
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <section
      aria-labelledby="referral-related-cases-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id="referral-related-cases-heading"
            className="text-sm font-semibold"
          >
            Casos relacionados
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {links.length}
          </span>
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLinkOpen(true)}
            disabled={relatableCases.length === 0}
          >
            <Link2 aria-hidden="true" />
            Relacionar caso
          </Button>
        )}
      </div>

      {links.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground text-pretty">
          Nenhum caso relacionado. Um vínculo é apenas um ponteiro — não concede
          acesso ao caso relacionado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((l) => {
            const mine = l.commissionId === myCommissionId && canManage;
            return (
              <li
                key={l.id}
                className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/20 p-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground tabular-nums">
                    <FolderOpen aria-hidden="true" className="size-4" />
                    {formatCaseNumber(l.caseNumber)}
                  </span>
                  <span
                    className={REFERRAL_META_CHIP_BASE + " " + referralTypeChipClass(null)}
                  >
                    {REFERRAL_CASE_RELATIONSHIP_LABELS[l.relationshipType]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {l.createdByName && (
                    <span className="text-xs text-muted-foreground">
                      por {l.createdByName}
                    </span>
                  )}
                  {mine && <UnlinkButton linkId={l.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <LinkRelatedCaseDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          referralId={referralId}
          cases={relatableCases}
        />
      )}
    </section>
  );
}

/** Remove a typed related-case pointer (RV2 R4). */
function UnlinkButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function unlink() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkReferralCase(linkId);
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={unlink}
        disabled={isPending}
      >
        <X aria-hidden="true" />
        Remover
      </Button>
      {error && (
        <span role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

/** Record a typed related-case pointer (RV2 R4). */
function LinkRelatedCaseDialog({
  open,
  onOpenChange,
  referralId,
  cases,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
  cases: RelatableCase[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [caseId, setCaseId] = useState("");
  const [relationshipType, setRelationshipType] =
    useState<ReferralCaseRelationship>("related_case");
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCaseId("");
      setRelationshipType("related_case");
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!caseId) return setError(REFERRAL_MESSAGES.relatedCaseRequired);
    startTransition(async () => {
      const result = await linkReferralRelatedCase({
        referralId,
        caseId,
        relationshipType,
      });
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Relacionar caso</DialogTitle>
          <DialogDescription>
            Registre um vínculo tipado com outro caso. O vínculo é apenas um
            ponteiro de referência — não concede acesso ao caso relacionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Caso</span>
            <NativeSelect
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              required
              className="py-2"
            >
              <option value="" disabled>
                Selecione um caso…
              </option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCaseNumber(c.caseNumber)}
                  {c.label ? ` — ${c.label}` : ""}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo de relação</span>
            <NativeSelect
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(e.target.value as ReferralCaseRelationship)
              }
              className="py-2"
            >
              {RELATIONSHIP_ORDER.map((r) => (
                <option key={r} value={r}>
                  {REFERRAL_CASE_RELATIONSHIP_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isPending || cases.length === 0}
            >
              {isPending ? "Vinculando…" : "Relacionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
