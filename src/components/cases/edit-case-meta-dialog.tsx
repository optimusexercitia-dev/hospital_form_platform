"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

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

/**
 * Edit a case's META — its non-identifying `label` (ADR 0061). The single audited
 * edit surface for coordinators AND `create_cases` Administrativos: it routes through
 * the `updateCaseMeta` server action → the `update_case_meta` DEFINER RPC, which is
 * the authority (terminal cases refused; department shape / hospital ownership
 * re-validated; only label/department touched).
 *
 * ⛔ **The "Unidade / setor" INPUT is gone (ADR 0137 D9) — the DEPARTMENT is not.**
 * The RPC still takes both arguments and does a FULL replace, so this form carries
 * the case's current department through as hidden mirrors; editing a label must never
 * clear a department nobody was shown. The stored value keeps rendering read-only in
 * the case header.
 *
 * ⚠ With Novo-caso's copy of the field gone too, `CaseDepartmentField` was left with
 * NO non-test consumer — and its own test kept it green forever, which no gate in the
 * eight can distinguish from "exercised by the product". PO-ruled DELETED 2026-08-24
 * (FUP-CASE-DEPARTMENT-FIELD-HAS-NO-CONSUMER). The hospital-admin surface is
 * unaffected: it uses `DepartmentsManager`, a different component. If a per-case
 * department input is ever wanted again, that is a reversal of D9 and needs its own
 * decision — recover the component from git rather than re-deriving this history.
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
}: {
  caseId: string;
  currentLabel: string | null;
  /**
   * The case's CURRENT department, carried through unchanged (never edited here since
   * ADR 0137 D9). At most one of the two is non-null — the DB enforces the XOR — so
   * the hidden mirrors below can never trip the action's "both set" guard.
   */
  currentDepartmentId: string | null;
  currentDepartmentOther: string | null;
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
            Atualize a descrição deste caso. Este campo não deve conter dados de
            paciente.
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

          {/* ⛔ DO NOT DELETE THESE TWO HIDDEN INPUTS AS CRUFT. They are the whole
              reason removing the "Unidade / setor" field (ADR 0137 D9) is safe here.

              `update_case_meta` does a FULL REPLACE of label + department: an absent
              `departmentId`/`departmentOther` is read as "clear it", not as "leave it"
              (`departmentFromForm` maps '' -> null, and the RPC's
              `nullif(btrim(...),'')` clears). So deleting the input WITHOUT these
              mirrors would wipe a stored department on every unrelated label edit —
              silent data loss, no error, no failing test.

              ⭐ The mirrors PRESERVE THE PRE-EXISTING SEMANTICS EXACTLY: the field was
              already a control pre-filled with the current value and re-submitted on
              every save. A hidden mirror is that, minus editability. Nothing about
              what reaches the RPC changes — which is what keeps this inside D9's
              ⛔ "no backend change" constraint.

              ⚠ The hazard is UNIQUE to this dialog (measured): the three CREATE paths
              — `createCaseFromTemplate`, `createCase` and the bulk wizard — mint a new
              row, so there is no prior value an omission could clear.

              Exactly one of the two is ever non-empty (DB-enforced XOR), so the pair
              can never trip the action's "both set" guard. */}
          <input
            type="hidden"
            name="departmentId"
            value={currentDepartmentId ?? ""}
          />
          <input
            type="hidden"
            name="departmentOther"
            value={currentDepartmentOther ?? ""}
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
