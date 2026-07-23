import type { Locator } from '@playwright/test'

/**
 * Shared helper for driving the platform's spreadsheet-paste grids from E2E
 * specs (first consumer: the bulk-case-creation grid, `case-bulk-grid.tsx` —
 * ADR 0084). There is no way to get a real block of TSV text onto the OS
 * clipboard from a headless CI runner, and granting `clipboard-read` /
 * `clipboard-write` permissions is unnecessary ceremony for what is really a
 * "does the `onPaste` handler receive this text" question.
 *
 * Instead this constructs a real `DataTransfer` + `ClipboardEvent('paste', …)`
 * INSIDE the page (Playwright's documented recipe for clipboard testing —
 * https://playwright.dev/docs/input#clipboard) and dispatches it on the target
 * element with `bubbles: true`. React's root-delegated event listener picks up
 * a genuinely-dispatched native event exactly like a real browser paste, so
 * this exercises the component's actual `onPaste` handler, not a mock.
 */

/**
 * Simulate pasting `text` (already tab/newline-delimited, i.e. copied straight
 * out of a spreadsheet) as if the user had focused `target` and pressed
 * Ctrl+V / Cmd+V. `target` may be any element inside the paste-handling
 * container (e.g. one grid cell) — the event bubbles up to it.
 */
export async function pasteText(target: Locator, text: string): Promise<void> {
  await target.evaluate((el, pasted) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', pasted)
    const event = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(event)
  }, text)
}

/** Build a TSV block from a matrix of cell values (one line per row, tab-joined). */
export function toTsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.join('\t')).join('\n')
}
