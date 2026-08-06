import 'server-only'

import { headers } from 'next/headers'

/**
 * The absolute URL the `minute_generator` service POSTs its callback to (ADR 0099 D10).
 *
 * ⚠ **The plan said to reuse "the existing public-base-URL var" and not to mint a second
 * one. There is no such variable.** The codebase builds absolute URLs from the INCOMING
 * REQUEST (`appOrigin()` in `src/lib/auth/actions.ts` and `src/lib/admin/actions.ts`:
 * `origin` header, else `x-forwarded-proto` + `host`) — there is no `NEXT_PUBLIC_SITE_URL`
 * or equivalent anywhere in `src/` or `.env.example`.
 *
 * The request origin alone is NOT sufficient here, and this is the one place in the
 * codebase where that matters. Every other absolute URL we build is handed to a BROWSER
 * (an email confirmation link, a post-auth redirect), so "whatever host the user reached
 * us on" is exactly right. This URL is handed to a SERVICE on the other side of a network
 * boundary, and its view of us differs:
 *
 *   - local smoke (T5): the browser says `http://localhost:3000`, but the service runs in
 *     its own container and must call `http://host.docker.internal:3000`;
 *   - any deployment where the app sits behind a proxy that rewrites Host, or where the
 *     service reaches us on an internal address rather than the public one.
 *
 * So: an explicit `MINUTES_CALLBACK_BASE_URL` wins when set, and the request origin is the
 * fallback that keeps ordinary production deployments zero-config. This is a
 * callback-specific override, not a duplicate of a base-URL var that does not exist.
 */

export const CALLBACK_PATH = '/api/webhooks/audio-jobs'

export async function buildCallbackUrl(): Promise<string | null> {
  const configured = process.env.MINUTES_CALLBACK_BASE_URL
  if (configured) return `${configured.replace(/\/+$/, '')}${CALLBACK_PATH}`

  const h = await headers()
  const origin = h.get('origin')
  if (origin) return `${origin.replace(/\/+$/, '')}${CALLBACK_PATH}`

  const host = h.get('host')
  if (!host) return null
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}${CALLBACK_PATH}`
}
