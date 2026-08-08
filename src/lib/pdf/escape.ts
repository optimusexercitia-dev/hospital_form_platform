/**
 * HTML escaping for the PDF renderer (PURE module — ADR 0104 D14).
 *
 * EVERY payload-sourced string interpolated into template HTML goes through
 * {@link esc} — the payload carries user-authored text (labels, answers,
 * names) and the rendered HTML is executed by Chromium inside Gotenberg
 * (Rule 7's stored-XSS surface, aimed at the renderer instead of a browser).
 */
export function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
