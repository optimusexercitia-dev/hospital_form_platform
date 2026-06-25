import type { Metadata } from "next";

import { listOrganizationsForPlatform } from "@/lib/queries/org";
import { OrganizationList } from "@/components/platform/organization-list";
import { OrganizationCreateForm } from "@/components/platform/organization-create-form";
import { HospitalCreateForm } from "@/components/platform/hospital-create-form";
import { OrgAdminAssignForm } from "@/components/platform/org-admin-assign-form";

export const metadata: Metadata = {
  title: "Organizações",
};

/**
 * Platform-admin landing — the organizations registry. The vendor provisioning
 * surface: create an organization, create a hospital under one, and seat an
 * org_admin. Platform access is enforced by `admin/layout.tsx` (server-side
 * `notFound()` for non-admins); RLS scopes the data regardless. The
 * platform_admin is walled off from all tenant data — there is no drill-in into a
 * commission from here; in-org administration is the org_admin's job at
 * `/o/[org]/manage`.
 */
export default async function AdminOrganizationsPage() {
  const organizations = await listOrganizationsForPlatform();
  const orgOptions = organizations.map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração da plataforma
        </p>
        <h1 className="text-3xl text-balance">Organizações</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Provisione as organizações clientes: crie uma organização, cadastre
          seus hospitais e nomeie o administrador que cuidará das comissões. A
          administração interna de cada organização fica a cargo do seu
          administrador.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="nova-organizacao-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs"
        >
          <div>
            <h2 id="nova-organizacao-heading" className="text-lg font-semibold">
              Nova organização
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O identificador é único em toda a plataforma e compõe o endereço.
            </p>
          </div>
          <OrganizationCreateForm />
        </section>

        <section
          aria-labelledby="novo-hospital-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs"
          style={{ ["--rise-delay" as string]: "60ms" }}
        >
          <div>
            <h2 id="novo-hospital-heading" className="text-lg font-semibold">
              Novo hospital
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre um hospital dentro de uma organização existente.
            </p>
          </div>
          <HospitalCreateForm organizations={orgOptions} />
        </section>

        <section
          aria-labelledby="novo-org-admin-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs"
          style={{ ["--rise-delay" as string]: "120ms" }}
        >
          <div>
            <h2 id="novo-org-admin-heading" className="text-lg font-semibold">
              Administrador da organização
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nomeie quem administrará as comissões de uma organização.
            </p>
          </div>
          <OrgAdminAssignForm organizations={orgOptions} />
        </section>
      </div>

      <section
        aria-labelledby="organizacoes-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="organizacoes-heading" className="text-lg font-semibold">
          Todas as organizações
        </h2>
        <OrganizationList organizations={organizations} />
      </section>
    </div>
  );
}
