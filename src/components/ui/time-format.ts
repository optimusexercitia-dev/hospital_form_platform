/**
 * Shared `HH:mm` (24h) time-format helpers, reused by every time control:
 * {@link TimeField} (and therefore the whole {@link DateTimePicker} family —
 * meetings, interviews, RCA timeline), the wizard time input, and the form
 * builder's time default-value control. Pure + framework-free so both client
 * components and any future server check can share one definition of "valid".
 */

/** Strict `HH:mm` in the 24h range 00:00–23:59. Blank is NOT valid (use a
 *  separate empty check where blank is allowed). */
export function isValidHhmm(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Format the digits a user types into a partial/complete `HH:mm` mask: keep only
 * digits (max 4), auto-insert the colon after the 2nd digit. `"930"` → `"09:30"`
 * is NOT done here (no zero-padding of a 3-digit run) — this is the LIVE typing
 * mask: `"9"`→`"9"`, `"93"`→`"93"`, `"930"`→`"93:0"`, `"9302"`→`"93:02"`. Padding
 * a short hour like `"9"`→`"09"` happens on blur via {@link normalizeHhmm}.
 */
export function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Build a canonical `HH:mm` from an in-range (hours, minutes) pair, or `null`
 *  when either is out of the 24h range. */
function hhmmOrNull(hours: number, minutes: number): string | null {
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Interpret a RAW digit run (no colon) as `HH:mm` by digit count. Used both as the
 * no-colon path and as the FALLBACK when an explicit-colon parse is out of range —
 * this is what makes the live mask self-consistent (the mask splits `"930"` into
 * `"93:0"`, whose colon-parse is out of range, so we re-read the raw digits
 * `9`+`30` → `09:30`). Returns `null` when unsalvageable.
 *   - 1–2 digits → hour only (`"9"` → 09:00, `"09"` → 09:00);
 *   - 3 digits   → 1-digit hour + 2-digit minute (`"930"` → 09:30);
 *   - 4 digits   → `HHmm` (`"0930"` → 09:30).
 */
function normalizeDigits(digits: string): string | null {
  if (digits.length === 0) return null;
  if (digits.length <= 2) return hhmmOrNull(Number(digits), 0);
  if (digits.length === 3) {
    return hhmmOrNull(Number(digits.slice(0, 1)), Number(digits.slice(1)));
  }
  // 4+ digits: take the first four as HHmm (the mask caps input at 4 anyway).
  return hhmmOrNull(Number(digits.slice(0, 2)), Number(digits.slice(2, 4)));
}

/**
 * Normalize a finished entry to a canonical `HH:mm` on blur, or `""` when it
 * cannot be salvaged. The live mask ({@link maskTimeInput}) splits the colon
 * after the 2nd DIGIT, so a short entry like `"930"` arrives here as `"93:0"`;
 * this function is the twin that must resolve that back to the intended value.
 *
 * Strategy: an explicit colon whose parse is IN range wins (preserves the
 * deliberate short form `"9:3"` → `"09:03"`); otherwise — no colon, or an
 * out-of-range colon parse — fall back to interpreting the RAW digit run by count
 * ({@link normalizeDigits}). This makes the mask→normalize pipeline
 * self-consistent (`"930"` → mask `"93:0"` → normalize `"09:30"`) while genuinely
 * out-of-range entries (`"2560"`, `"2400"`) still normalize to `""`.
 *
 *   - `"9"`    → `"09:00"`   (hour only)
 *   - `"9:3"`  → `"09:03"`   (explicit single-digit minute)
 *   - `"930"`  → `"09:30"`   (mask leaves `"93:0"`; digit fallback recovers it)
 *   - `"0930"` → `"09:30"`
 *   - `"2560"` / `"2400"` → `""` (out of range, not salvageable)
 */
export function normalizeHhmm(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";

  if (trimmed.includes(":")) {
    const [h, m] = trimmed.split(":");
    const hDigits = h.replace(/\D/g, "");
    const mDigits = m.replace(/\D/g, "");
    if (hDigits !== "") {
      // Try the explicit-colon boundary first; only accept it when IN range so a
      // deliberate short form (`"9:3"`) resolves as the author meant.
      const viaColon = hhmmOrNull(
        Number(hDigits),
        mDigits === "" ? 0 : Number(mDigits),
      );
      if (viaColon !== null) return viaColon;
    }
    // Out-of-range colon parse (e.g. the mask's `"93:0"` for `"930"`): fall back
    // to re-reading the raw digits by count.
    return normalizeDigits(trimmed.replace(/\D/g, "")) ?? "";
  }

  return normalizeDigits(trimmed.replace(/\D/g, "")) ?? "";
}
