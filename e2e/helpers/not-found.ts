import { expect, type Page } from '@playwright/test'

/**
 * WHICH 404 rendered — and it is not cosmetic, it names the GATE that fired.
 *
 * `notFound()` streams as HTTP 200 on a standalone server (see
 * `docs/testing/`/the streamed-notFound record), so the status line cannot be keyed
 * on. What distinguishes the two boundaries is their copy, and the distinction is
 * load-bearing:
 *
 *   'root'       — `src/app/not-found.tsx`, h1 "Não encontramos esta página."
 *                  A LAYOUT called `notFound()`. Per that file's own docblock
 *                  (ACT/ADR 0106 D9, verified live on a production standalone
 *                  build), a `notFound()` thrown from within a layout component's
 *                  body is caught only by an ancestor boundary ABOVE where that
 *                  layout renders — never by that segment's own `not-found.tsx`.
 *                  For the commission area that means: the commission SHELL itself
 *                  refused ⇒ the resolver returned `null` (no readable commission
 *                  row).
 *   'commission' — `src/app/o/[org]/c/[commission]/not-found.tsx`, h1
 *                  "Página não encontrada". The shell RENDERED (this boundary can
 *                  only paint inside the commission layout) and a PAGE within the
 *                  already-entered area called `notFound()` ⇒ the page's own gate
 *                  refused.
 *   null         — neither boundary is on the page.
 *
 * ⛔ WHY THIS EXISTS AT ALL. An earlier draft of
 * `orphan-administrativo-reachability.spec.ts` matched only the root copy and
 * reported C2 as "still reaching the board" when it was in fact correctly 404'd —
 * a wrong matcher reads exactly like a live defect. And the generic
 * `getByText(/não encontr/i)` matches BOTH copies, so a test written on it passes
 * whichever boundary refused, including one firing for a reason that has nothing to
 * do with the gate under test. Assert the KIND, never "some 404 happened".
 *
 * ⚠ QUERIED BY ROLE + NAME, deliberately, not by text over `body`. A serialization
 * fuses sibling elements with no separator, so a phrase match over the whole body
 * is blind at element edges and can also be satisfied by page CONTENT that merely
 * quotes the phrase. Both copies live in exactly one `<h1>` each, so the accessible
 * name of a level-1 heading is the precise, structural signal.
 *
 * Extracted here (rather than exported from the spec that first defined it) because
 * importing a `*.spec.ts` from another spec re-registers every `test()` in it into
 * the importing file's suite.
 */
export type NotFoundKind = 'root' | 'commission' | null

const ROOT_H1 = /^Não encontramos esta página\.?$/i
const COMMISSION_H1 = /^Página não encontrada$/i

/**
 * SNAPSHOT read — no waiting. Correct after the caller has already settled the
 * navigation (an explicit `waitForTimeout`, or a preceding auto-waiting assertion).
 * When the page may still be rendering, use {@link expectNotFoundKind}, which polls.
 */
export async function notFoundKind(page: Page): Promise<NotFoundKind> {
  // `count()` rather than `.first()` + strict mode: the commission boundary paints
  // inside the shell chrome, which may carry headings of its own.
  if ((await page.getByRole('heading', { level: 1, name: ROOT_H1 }).count()) > 0) return 'root'
  if ((await page.getByRole('heading', { level: 1, name: COMMISSION_H1 }).count()) > 0) {
    return 'commission'
  }
  return null
}

/**
 * The AUTO-WAITING form, and the one specs should reach for after a bare
 * `page.goto()`.
 *
 * Polls {@link notFoundKind} until it equals `expected`. Because the subject is a
 * KIND rather than a boolean, a failure reports what actually rendered — `'root'`
 * where `'commission'` was required (the shell refused, a broader and different
 * failure than the one under test), or `null` (nothing 404'd at all, i.e. the page
 * RENDERED). A boolean `isVisible` matcher collapses all three into "false".
 */
export async function expectNotFoundKind(
  page: Page,
  expected: NotFoundKind,
  message: string,
  timeout = 15_000,
): Promise<void> {
  await expect.poll(() => notFoundKind(page), { message, timeout }).toBe(expected)
}
