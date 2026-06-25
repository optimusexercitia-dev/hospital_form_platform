import { commissionHref } from "@/lib/routing";
import { redirect } from "next/navigation";

/**
 * Settings hub (coordinator area) — redirects to the first settings tab
 * (outcomes). The settings sub-pages (`desfechos`, `etiquetas`) each gate access
 * themselves; this index just lands the "Configurações" nav item somewhere
 * concrete so the prefix-matched active state works for both tabs.
 */
export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  redirect(commissionHref(org, commission, "manage", "settings", "desfechos"));
}
