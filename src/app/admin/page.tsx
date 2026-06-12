import type { Metadata } from "next";

import { listCommissionsForAdmin } from "@/lib/queries/commissions";
import { CommissionList } from "@/components/admin/commission-list";
import { CommissionCreateForm } from "@/components/admin/commission-create-form";

export const metadata: Metadata = {
  title: "Comissões",
};

/**
 * Admin landing — the commission registry. Lists every commission (name, slug,
 * member count, coordinators) and offers a "Nova comissão" create form. Admin
 * access is enforced by `admin/layout.tsx` (server-side `notFound()` for
 * non-admins); RLS scopes the data regardless.
 */
export default async function AdminCommissionsPage() {
  const commissions = await listCommissionsForAdmin();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração global
        </p>
        <h1 className="text-3xl text-balance">Comissões</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Crie e administre as comissões hospitalares. Abra uma comissão para
          editar seus dados e gerenciar a coordenação.
        </p>
      </header>

      <section
        aria-labelledby="nova-comissao-heading"
        className="animate-rise-in rounded-2xl border border-border bg-card p-6 sm:p-7"
      >
        <h2
          id="nova-comissao-heading"
          className="text-lg font-semibold"
        >
          Nova comissão
        </h2>
        <p className="mt-1 mb-5 max-w-prose text-sm text-muted-foreground">
          Cada comissão tem um identificador único usado no seu endereço.
        </p>
        <CommissionCreateForm />
      </section>

      <section aria-labelledby="comissoes-heading" className="flex flex-col gap-4">
        <h2 id="comissoes-heading" className="text-lg font-semibold">
          Todas as comissões
        </h2>
        <CommissionList commissions={commissions} />
      </section>
    </div>
  );
}
