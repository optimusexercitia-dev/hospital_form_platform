import { redirect } from "next/navigation";

/**
 * Settings hub (coordinator area) — redirects to the first settings tab
 * (case statuses). The settings sub-pages (`statuses`, `etiquetas`) each gate
 * access themselves; this index just lands the "Configurações" nav item somewhere
 * concrete so the prefix-matched active state works for both tabs.
 */
export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/c/${slug}/manage/settings/statuses`);
}
