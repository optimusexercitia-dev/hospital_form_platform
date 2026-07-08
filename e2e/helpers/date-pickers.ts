import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Shared helpers for driving the project's date/time picker components from E2E
 * specs. These replaced the native `<input type="datetime-local">` / `<input
 * type="date">` controls in a refactor:
 *
 *  - `DatePicker`      (src/components/ui/date-picker.tsx): a button
 *    (`aria-haspopup="dialog"`) that opens a react-day-picker calendar popover.
 *    When given a `name`, it ALSO renders a hidden `<input name=…>` carrying the
 *    selected value as `YYYY-MM-DD` (readable via `inputValue()`).
 *  - `TimeField`       (src/components/ui/time-field.tsx): a react-aria segmented
 *    time input (a group, aria-label "Hora" by default) with hour/minute
 *    spinbutton segments. With a `name` it renders a hidden `HH:mm` input.
 *  - `DateTimePicker`  (src/components/ui/date-time-picker.tsx): a `DatePicker`
 *    (flex-3) beside a `TimeField` (flex-2, aria-label "Hora"). When controlled
 *    (value/onChange, no `name`) it carries no hidden input — the parent form
 *    converts its React state to an ISO string on submit. In CONTROLLED mode the
 *    time only commits a combined value once a date is chosen, so always set the
 *    DATE first, then the time.
 *
 * The day actually picked is not load-bearing for most callers (they assert a
 * state transition, not a specific date). Callers that DO need the chosen value
 * read it back from the hidden input (`readHiddenDateValue`) and assert against
 * that, rather than navigating the calendar to an exact date.
 */

/**
 * Open a `DatePicker` (the popover button) inside `scope` and click an enabled
 * day cell, returning the resulting `YYYY-MM-DD` selection.
 *
 * @param scope   the dialog / region containing the DatePicker (or `page`).
 * @param page    the Page (needed to reach the calendar popover, which portals to body).
 * @param opts.trigger  an explicit trigger Locator (when several DatePickers share a scope).
 * @param opts.day      preferred day-of-month text to click (default "15" — always
 *                      present and enabled mid-month). Falls back to the first
 *                      enabled day if the preferred one is disabled/absent.
 */
export async function pickDate(
  scope: Locator | Page,
  page: Page,
  opts: { trigger?: Locator; day?: string; monthsBack?: number } = {},
): Promise<void> {
  // Both Locator and Page expose `.locator(...)`, so resolve the trigger uniformly.
  const trigger =
    opts.trigger ?? scope.locator('button[aria-haspopup="dialog"]').first()
  await expect(trigger).toBeVisible({ timeout: 5_000 })
  await trigger.click()

  const grid = page.getByRole('grid')
  await expect(grid).toBeVisible({ timeout: 5_000 })

  // Navigate to a prior month when the caller needs a day guaranteed to be in the
  // PAST (e.g. a `held_at` that must not be in the future regardless of today's
  // day-of-month). react-day-picker's "previous month" nav carries a pt-BR /
  // English aria-label; try the accessible name first, then a fallback.
  const monthsBack = opts.monthsBack ?? 0
  for (let i = 0; i < monthsBack; i++) {
    const prevBtn = page
      .getByRole('button', { name: /mês anterior|previous month|anterior/i })
      .first()
    if (await prevBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await prevBtn.click()
    } else {
      await page
        .locator('button[aria-label*="previous" i], button[name="previous-month"]')
        .first()
        .click()
    }
  }

  const dayText = opts.day ?? '15'
  // Day cells are buttons whose visible text is the day-of-month. Match exactly.
  const preferred = grid
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${dayText}$`) })
  if ((await preferred.count()) > 0 && (await preferred.first().isEnabled())) {
    await preferred.first().click()
  } else {
    // Fall back to the first enabled day button in the grid.
    const dayButtons = grid.getByRole('button')
    const count = await dayButtons.count()
    let clicked = false
    for (let i = 0; i < count; i++) {
      const btn = dayButtons.nth(i)
      if (await btn.isEnabled()) {
        await btn.click()
        clicked = true
        break
      }
    }
    if (!clicked) throw new Error('No enabled day cell found in the calendar grid')
  }

  // The popover closes on select; the trigger no longer shows the placeholder.
  await expect(trigger).not.toHaveText(/Selecionar data/i, { timeout: 5_000 })
}

/**
 * Read the `YYYY-MM-DD` value carried by a named `DatePicker`'s hidden input.
 * Works even though the input is `type="hidden"` (not "visible").
 */
export async function readHiddenDateValue(
  scope: Locator | Page,
  name: string,
): Promise<string> {
  const input = scope.locator(`input[name="${name}"]`)
  return input.inputValue()
}

/**
 * Type an `HH:mm` value into a react-aria `TimeField` (segmented). The field is a
 * group of spinbutton segments; clicking the first segment then typing the four
 * digits fills hour + minute in order (24-hour, no AM/PM).
 *
 * @param group  the TimeField group Locator (e.g. `dialog.getByRole('group', { name: /Hora/i })`).
 * @param page   the Page (for keyboard input).
 * @param hhmm   e.g. "09:30".
 */
export async function fillTimeField(
  group: Locator,
  page: Page,
  hhmm: string,
): Promise<void> {
  const [hh, mm] = hhmm.split(':')
  if (!hh || !mm) throw new Error(`fillTimeField: bad HH:mm value "${hhmm}"`)
  // Focus the first segment (hour) and type the digits; react-aria advances
  // segment focus automatically after a complete segment.
  const firstSegment = group.getByRole('spinbutton').first()
  await firstSegment.click()
  await page.keyboard.type(hh.padStart(2, '0'))
  await page.keyboard.type(mm.padStart(2, '0'))
}

/**
 * Genuinely keyboard-only date pick: focus the DatePicker trigger, Enter to open
 * the calendar, Tab into the grid until a day cell is focused (react-day-picker
 * lands focus on the nav buttons + month/year dropdowns first, then "today"),
 * and Enter to select it. No mouse. Asserts the trigger then shows a date.
 *
 * @param trigger  the DatePicker trigger button Locator.
 * @param page     the Page (for keyboard).
 */
export async function pickDateKeyboard(
  trigger: Locator,
  page: Page,
): Promise<void> {
  await trigger.focus()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 5_000 })

  // Tab until focus lands on a day cell inside the grid (its aria-label is a full
  // date ending in a 4-digit year), then Enter to select.
  let selected = false
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    const onDay = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      if (!a || !a.closest('[role="grid"]')) return false
      const label = a.getAttribute('aria-label') ?? ''
      return /\bde \d{4}\b/.test(label)
    })
    if (onDay) {
      await page.keyboard.press('Enter')
      selected = true
      break
    }
  }
  if (!selected) {
    throw new Error('Keyboard: could not reach a day cell in the calendar grid')
  }
  await expect(trigger).not.toHaveText(/Selecionar data/i, { timeout: 5_000 })
}

/**
 * Resolve the field CONTAINER for a `DateTimePicker` identified by its `<label>`
 * text. The `<label htmlFor=…>` and the picker are SIBLINGS inside a wrapper
 * <div>, so the DatePicker button + TimeField group are NOT descendants of the
 * label — they share the label's parent. Scope to that parent (`xpath=..`) so
 * `button[aria-haspopup="dialog"]` and the "Hora" group resolve unambiguously.
 */
export function fieldContainer(dialog: Locator, labelText: string): Locator {
  return dialog
    .locator('label')
    .filter({ hasText: labelText })
    .first()
    .locator('xpath=..')
}

/**
 * Genuinely keyboard-only `DateTimePicker` fill (date via the calendar keyboard
 * model, time by typing the digits into the focused segments). For the keyboard
 * AC flows. Sets DATE first, then TIME (controlled-mode ordering).
 */
export async function setDateTimeFieldKeyboard(
  page: Page,
  dialog: Locator,
  labelText: string,
  opts: { time?: string } = {},
): Promise<void> {
  const field = fieldContainer(dialog, labelText)
  await expect(field).toBeVisible({ timeout: 5_000 })
  const dateTrigger = field.locator('button[aria-haspopup="dialog"]').first()
  await pickDateKeyboard(dateTrigger, page)
  // Time: focus the first segment via keyboard and type HH then mm.
  const seg = field.getByRole('group', { name: /^Hora$/i }).first().getByRole('spinbutton').first()
  await seg.focus()
  const [hh, mm] = (opts.time ?? '10:00').split(':')
  await page.keyboard.type((hh ?? '10').padStart(2, '0'))
  await page.keyboard.type((mm ?? '00').padStart(2, '0'))
}

/**
 * Drive a `DateTimePicker` field identified by its `<label>` text (e.g. "Início",
 * "Término"). Sets the DATE (calendar pick) first, then the TIME segments — the
 * order CONTROLLED DateTimePicker requires to commit a combined value.
 *
 * @param page        the Page.
 * @param dialog      the dialog/region containing the field.
 * @param labelText   the field's label span text ("Início" | "Término" | …).
 * @param time        optional "HH:mm" to set (default "10:00").
 * @param day         optional preferred day-of-month text (default "15").
 */
export async function setDateTimeField(
  page: Page,
  dialog: Locator,
  labelText: string,
  opts: { time?: string; day?: string; monthsBack?: number } = {},
): Promise<void> {
  // The label and the DateTimePicker are SIBLINGS; scope to their shared parent
  // so the DatePicker button + TimeField group are reachable and unambiguous.
  const field = fieldContainer(dialog, labelText)
  await expect(field).toBeVisible({ timeout: 5_000 })

  // 1) Date via the DatePicker popover.
  const dateTrigger = field.locator('button[aria-haspopup="dialog"]').first()
  await pickDate(field, page, {
    trigger: dateTrigger,
    day: opts.day,
    monthsBack: opts.monthsBack,
  })

  // 2) Time via the segmented TimeField (aria-label "Hora").
  const timeGroup = field.getByRole('group', { name: /^Hora$/i }).first()
  await fillTimeField(timeGroup, page, opts.time ?? '10:00')
}
