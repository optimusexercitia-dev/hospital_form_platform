import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { TopNav } from "@/components/shell/top-nav";

/**
 * Commission area shell. Server Component.
 *
 * `getCommissionAccess(slug)` returns null for an unknown slug OR a commission
 * the caller may not access — the two are indistinguishable by design (RLS),
 * so we render `notFound()` for both and leak nothing about which commissions
 * exist (Phase 2 acceptance: foreign/unknown commission → 404).
 */
export default async function CommissionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);

  if (!access) {
    notFound();
  }

  return (
    <div className="flex min-h-svh flex-col">
      <TopNav
        context={access.context}
        commission={access.commission}
        role={access.role}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
