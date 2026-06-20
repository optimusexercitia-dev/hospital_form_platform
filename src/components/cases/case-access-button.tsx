"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

import type { CaseDetail } from "@/lib/queries/cases";
import type { MemberListItem } from "@/lib/queries/members";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CaseAccessPanel } from "@/components/cases/case-access-panel";

/**
 * Top-bar **"Acesso ao caso"** action (Case Access Control increment, ADR 0033) —
 * mounted in the coordinator `(detail)` layout header NEXT TO the lifecycle buttons.
 * Opens a {@link Dialog} whose body is the member grant roster ({@link CaseAccessPanel}):
 * grant/revoke per-member read/write access.
 *
 * Rendered INDEPENDENTLY of {@link import('./case-lifecycle-actions').CaseLifecycleActions}
 * (which only renders on an OPEN case) so it STILL appears on a TERMINAL case — read
 * grants are allowed there (D6). The host layout already gates this on the
 * `case_access` flag and coordinator/admin presence (non-coordinators hit `notFound`),
 * so no extra capability check is needed here. `caseOpen` flows through to the roster
 * to disable WRITE grants on a terminal case (D6; the server enforces it regardless).
 */
export function CaseAccessButton({
  caseId,
  members,
  detail,
  caseOpen,
}: {
  caseId: string;
  /** The commission roster (already sorted by the layout). */
  members: MemberListItem[];
  detail: CaseDetail;
  /** Whether the case is non-terminal (gates WRITE grants in the roster). */
  caseOpen: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
      >
        <KeyRound aria-hidden="true" />
        Acesso ao caso
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acesso ao caso</DialogTitle>
          <DialogDescription>
            Conceda ou remova o acesso de leitura ou edição de cada membro da
            comissão a este caso.
          </DialogDescription>
        </DialogHeader>
        <CaseAccessPanel
          caseId={caseId}
          members={members}
          detail={detail}
          caseOpen={caseOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
