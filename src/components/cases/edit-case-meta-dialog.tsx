"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import type { Department } from "@/lib/hospitals/departments";
import { updateCaseMeta } from "@/lib/cases/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormBanner } from "@/components/auth/form-banner";
import { CaseDepartmentField } from "@/components/cases/case-department-field";

/**
 * Edit a case's META — its non-identifying `label` + `department` (ADR 0061). The
 * single audited edit surface for coordinators AND `create_cases` Administrativos:
 * it routes through the `updateCaseMeta` server action → the `update_case_meta`
 * DEFINER RPC, which is the authority (terminal cases refused; department shape /
 * hospital ownership re-validated; only label/department touched).
 *
 * Rendered ONLY on an OPEN case (the parent gates on `isOpen`, mirroring the
 * lifecycle actions) — a terminal case is frozen (HC025), so the affordance is
 * absent there. The RPC does a FULL replace, so the fields are PREFILLED with the
 * current values and submit the complete desired state (clearing a field is a valid
 * edit). `label` must stay NON-IDENTIFYING (no patient data) — the helper text says so.
 */
export function EditCaseMetaDialog({
  caseId,
  currentLabel,
  currentDepartmentId,
  currentDepartmentOther,
  departments,
}: {
  caseId: string;
  currentLabel: string | null;
  currentDepartmentId: string | null;
  currentDepartmentOther: string | null;
  /** The case's hospital ACTIVE departments; `[]` still allows the "Outros" value. */
  departments: Department[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reset the error each time the dialog opens (the form itself re-mounts via `key`,
  // restoring the prefilled current values so a cancelled edit never persists).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateCaseMeta(undefined, formData);
      if (!res.ok) {
        setError(
          res.error ??
            res.fieldErrors?.departmentId ??
            "Não foi possível salvar. Tente novamente.",
        );
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar caso</DialogTitle>
          <DialogDescription>
            Atualize a descrição e a unidade / setor deste caso. Estes campos não
            devem conter dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form
          ref={formRef}
          key={open ? "open" : "closed"}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="caseId" value={caseId} />

          {error && <FormBanner tone="error">{error}</FormBanner>}

          <label htmlFor="edit-case-label" className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Descrição{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <Input
              id="edit-case-label"
              name="label"
              type="text"
              defaultValue={currentLabel ?? ""}
              maxLength={200}
              autoComplete="off"
              placeholder="Uma breve descrição não identificável do caso"
              disabled={isPending}
            />
            <span className="text-xs text-muted-foreground">
              Não inclua nome, prontuário ou outros dados do paciente.
            </span>
          </label>

          <CaseDepartmentField
            departments={departments}
            disabled={isPending}
            idPrefix="edit-case-department"
            initialDepartmentId={currentDepartmentId}
            initialDepartmentOther={currentDepartmentOther}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Voltar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
