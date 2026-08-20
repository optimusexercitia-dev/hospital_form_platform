"use client";

import Link from "next/link";

import type { DsrHospital, DsrRequestRow, DsrTaskRow } from "@/lib/queries/dsr";
import { dsrHref } from "@/lib/routing";
import { RiseInGroup } from "@/components/motion/rise-in-group";
import { DsrTaskInbox } from "@/components/dsr/dsr-task-inbox";
import { DsrRequestPanel } from "@/components/dsr/dsr-request-panel";

/**
 * The DSR console shell: the hospital selector, the executor inbox, and — for an
 * Encarregado — the request lane.
 *
 * The two lanes are rendered from server-resolved data; `isDpo` only decides
 * whether the request lane is DRAWN. It is not the access boundary: RLS is, and
 * `listDsrRequests` returns `[]` for a non-DPO regardless of what this component
 * renders (CLAUDE.md Rule 1 — never rely on UI hiding).
 */
export function DsrConsole({
  org,
  hospitals,
  selectedHospitalId,
  isDpo,
  tasks,
  requests,
}: {
  org: string;
  hospitals: DsrHospital[];
  selectedHospitalId: string;
  isDpo: boolean;
  tasks: DsrTaskRow[];
  requests: DsrRequestRow[];
}) {
  const selected = hospitals.find((h) => h.hospitalId === selectedHospitalId);

  return (
    <RiseInGroup runKey={selectedHospitalId} className="flex flex-col gap-8">
      <header data-rise className="animate-rise-in flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Direitos do Titular
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Solicitações de titulares de dados (LGPD, art. 18). Cada solicitação é
          analisada caso a caso, com consulta jurídica registrada; a retenção de
          20 anos é a política institucional padrão, e não uma recusa automática.
        </p>
        {selected ? (
          <p className="text-sm font-medium">{selected.hospitalName}</p>
        ) : null}
      </header>

      {hospitals.length > 1 ? (
        <nav
          data-rise
          className="animate-rise-in flex flex-wrap items-center gap-2"
          aria-label="Selecionar hospital"
        >
          {hospitals.map((h) => (
            <Link
              key={h.hospitalId}
              href={`${dsrHref(org)}?hospital=${encodeURIComponent(h.hospitalId)}`}
              aria-current={
                h.hospitalId === selectedHospitalId ? "page" : undefined
              }
              className={
                h.hospitalId === selectedHospitalId
                  ? "rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  : "rounded-full border border-border px-3 py-1 text-sm hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              }
            >
              {h.hospitalName}
            </Link>
          ))}
        </nav>
      ) : null}

      <section data-rise className="animate-rise-in">
        <DsrTaskInbox org={org} tasks={tasks} />
      </section>

      {isDpo ? (
        <section data-rise className="animate-rise-in">
          <DsrRequestPanel
            org={org}
            hospitalId={selectedHospitalId}
            requests={requests}
          />
        </section>
      ) : null}
    </RiseInGroup>
  );
}
