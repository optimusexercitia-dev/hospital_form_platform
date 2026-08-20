import { expect, type APIRequestContext } from '@playwright/test'

/**
 * The service-role REST client shared by specs that must assert against the TABLE
 * rather than the screen.
 *
 * ⭐ WHY SPECS REACH PAST THE UI AT ALL. A success banner is the UI's CLAIM; the
 * row is the FACT, and a controlled form wired to nothing renders the first
 * without producing the second. Every "it persisted" assertion in this suite is a
 * read through here for that reason.
 *
 * ⛔ SERVICE ROLE BYPASSES RLS, so it is a MEASUREMENT instrument only — never the
 * subject. A boundary assertion (who may read what) must be made through a real
 * session in a browser; proving isolation with a key that ignores isolation proves
 * nothing.
 */

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export function svcHeaders(extra: Record<string, string> = {}) {
  if (!SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
  }
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export async function svcInsert<T>(
  req: APIRequestContext,
  table: string,
  row: Record<string, unknown>,
): Promise<T> {
  const res = await req.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: svcHeaders({ Prefer: 'return=representation' }),
    data: row,
  })
  expect(res.ok(), `insert ${table}: ${await res.text()}`).toBeTruthy()
  return ((await res.json()) as T[])[0]
}

/**
 * ⚠ ASSERTS `res.ok()` RATHER THAN RETURNING `[]` ON FAILURE. A helper that
 * swallows a failed read turns "the request errored" into "the table is empty",
 * and an emptiness assertion downstream then passes for the wrong reason — the
 * silent-return family this repo has already paid for.
 */
export async function svcSelect<T = Record<string, unknown>>(
  req: APIRequestContext,
  table: string,
  qs: string,
): Promise<T[]> {
  const res = await req.get(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: svcHeaders(),
  })
  expect(res.ok(), `select ${table}?${qs}: ${await res.text()}`).toBeTruthy()
  return (await res.json()) as T[]
}

export async function svcUpdate(
  req: APIRequestContext,
  table: string,
  qs: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await req.patch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: svcHeaders(),
    data: patch,
  })
  expect(res.ok(), `update ${table}?${qs}: ${await res.text()}`).toBeTruthy()
}

/** ⛔ Delete BY IDENTITY only — a positional cleanup has eaten seed rows here. */
export async function svcDelete(
  req: APIRequestContext,
  table: string,
  qs: string,
): Promise<void> {
  await req.delete(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: svcHeaders(),
  })
}
