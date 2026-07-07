"use client";

import { useState } from "react";
import { archiveDepartment, reorderDepartments } from "@/lib/hospitals/actions";
import type { Department } from "@/lib/hospitals/departments";
import { ArrowDown, ArrowUp, Archive, Pencil, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFlipReorder } from "@/components/forms/use-flip-reorder";
import { useDepartmentAction } from "./use-department-action";
import { DepartmentDefDialog } from "./department-def-dialog";

/**
 * Hospital Departments ("Unidade / setor") manager — create / rename / reorder /
 * archive the hospital's department vocabulary. Managed by org_admin (any
 * hospital in the org) + hospital_admin (own hospital); RLS is the write
 * authority. Mirrors {@link TitlesManager}'s up/down reorder + FLIP motion.
 *
 * Active departments (ordered by `position`) drive the Novo-caso dropdown;
 * archived ones drop out of the picker but are shown here (dimmed) so an admin
 * can reactivate them. Reorder applies to the ACTIVE set only.
 */
export function DepartmentsManager({
  hospitalId,
  departments,
}: {
  hospitalId: string;
  /** The hospital's full vocabulary, INCLUDING archived (management view). */
  departments: Department[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { run, isPending, error } = useDepartmentAction();
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLUListElement>();

  const active = departments.filter((d) => !d.archived);
  const archived = departments.filter((d) => d.archived);

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= active.length) return;
    const next = [...active];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() =>
      reorderDepartments(
        hospitalId,
        next.map((d) => d.id),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Defina as unidades / setores deste hospital (ex.: UTI Adulto,
          Pronto-Socorro). Elas ficam disponíveis ao criar um caso. Setores são
          apenas organizacionais e não contêm dados de paciente.
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Novo setor
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum setor ativo ainda. Crie o primeiro setor deste hospital.
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {active.map((dept, index) => (
            <li
              key={dept.id}
              data-flip-id={`department-${dept.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "up")}
                  disabled={index === 0 || isPending}
                  aria-label={`Mover ${dept.name} para cima`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "down")}
                  disabled={index === active.length - 1 || isPending}
                  aria-label={`Mover ${dept.name} para baixo`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <span className="min-w-0 truncate text-sm font-medium">
                {dept.name}
              </span>

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <DepartmentEditButton hospitalId={hospitalId} department={dept} />
                <ArchiveDepartmentButton department={dept} archived />
              </div>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="archived-departments-heading" className="mt-2 flex flex-col gap-2">
          <h3
            id="archived-departments-heading"
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Arquivados
          </h3>
          <ul className="flex flex-col gap-2">
            {archived.map((dept) => (
              <li
                key={dept.id}
                className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3"
              >
                <span className="min-w-0 truncate text-sm text-muted-foreground line-through">
                  {dept.name}
                </span>
                <div className="ml-auto shrink-0">
                  <ArchiveDepartmentButton department={dept} archived={false} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DepartmentDefDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        hospitalId={hospitalId}
      />
    </div>
  );
}

function DepartmentEditButton({
  hospitalId,
  department,
}: {
  hospitalId: string;
  department: Department;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Renomear o setor ${department.name}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <DepartmentDefDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        hospitalId={hospitalId}
        department={department}
      />
    </>
  );
}

/**
 * Archive (soft-delete) or reactivate a department. `archived` is the TARGET
 * state: `true` archives an active one, `false` reactivates an archived one.
 */
function ArchiveDepartmentButton({
  department,
  archived,
}: {
  department: Department;
  archived: boolean;
}) {
  const { run, isPending } = useDepartmentAction();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => run(() => archiveDepartment(department.id, archived))}
      aria-label={
        archived
          ? `Arquivar o setor ${department.name}`
          : `Reativar o setor ${department.name}`
      }
      className="text-muted-foreground hover:text-foreground"
    >
      {archived ? (
        <>
          <Archive aria-hidden="true" />
          Arquivar
        </>
      ) : (
        <>
          <RotateCcw aria-hidden="true" />
          Reativar
        </>
      )}
    </Button>
  );
}
