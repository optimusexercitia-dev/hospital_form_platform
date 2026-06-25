'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { commissionHref, orgHref } from '@/lib/routing'
import type { Database } from '@/lib/types/database'

/**
 * Auth server actions (Architecture Rules 9 & 10). All supabase-js for auth
 * lives here so the frontend's form components stay free of data-access code and
 * the ownership boundary stays clean. Every user-facing string is pt-BR; raw
 * Supabase/Postgres errors NEVER reach the UI — failures are mapped to the
 * generic messages below (CLAUDE.md §8).
 *
 * Shaped for React's `useActionState`: `(prevState, formData) => newState`.
 */

export interface AuthState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

// Centralized pt-BR copy — single source so wording stays consistent and i18n
// could be lifted out later without hunting through logic.
const MESSAGES = {
  invalidCredentials: 'E-mail ou senha incorretos.',
  generic: 'Não foi possível concluir. Tente novamente.',
  emailRequired: 'Informe o seu e-mail.',
  emailInvalid: 'Informe um e-mail válido.',
  passwordRequired: 'Informe a nova senha.',
  passwordTooShort: 'A senha deve ter pelo menos 8 caracteres.',
  passwordMismatch: 'As senhas não coincidem.',
  // Reset request is intentionally non-committal: never reveal whether an
  // account exists for the given e-mail (account-enumeration guard).
  resetSent:
    'Se houver uma conta com esse e-mail, enviamos as instruções para redefinir a senha.',
} as const

const MIN_PASSWORD_LENGTH = 8
// Pragmatic shape check only — the auth server is the real validator.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validates a post-auth redirect target. Only same-origin absolute PATHS are
 * allowed: must start with a single `/` and not `//` (which the browser treats
 * as a protocol-relative URL to another host) — an open-redirect guard.
 */
function safeRedirectPath(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  // Reject backslash tricks and control chars that some browsers normalize.
  if (value.includes('\\')) return '/'
  return value
}

/** Builds an absolute URL on the app's own origin from the incoming request. */
async function appOrigin(): Promise<string> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('host') ?? '127.0.0.1:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/**
 * Resolves the post-login landing path for the just-authenticated user, using
 * the SAME authenticated client that `signInWithPassword` returned — no extra
 * `getUser()`/GoTrue round trip. Mirrors the root `/` Server Component's
 * landing logic (kept as the canonical landing for direct hits) so that signing
 * in redirects STRAIGHT to the destination instead of bouncing through `/`.
 * That removes one session-revalidating hop from the post-login critical path,
 * which under load is where the cookie set by this action races the immediately
 * following navigation (a missed cookie there bounces the user back to /login).
 *
 * Mirrors the root-landing precedence in `src/app/page.tsx` (multi-tenancy):
 *   platform_admin                 → /admin
 *   org_admin of exactly one org   → /o/<org>/manage
 *   org_admin of more than one org → /o            (org picker)
 *   exactly one commission         → /o/<org>/c/<commission>
 *   more than one commission       → /c            (grouped picker)
 *   none and not admin             → /             (root "sem acesso" screen)
 */
async function resolveLanding(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const [profileResult, membershipResult, orgAdminResult] = await Promise.all([
    supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
    supabase
      .from('commission_members')
      .select('commission:commissions(slug, organization:organizations(slug))')
      .eq('user_id', userId),
    supabase
      .from('organization_members')
      .select('organization:organizations(slug)')
      .eq('user_id', userId)
      .eq('role', 'org_admin'),
  ])

  if (profileResult.data?.is_admin) {
    return '/admin'
  }

  // org_admin precedence: a customer super-user lands on their org manage area.
  const orgSlugs = (orgAdminResult.data ?? [])
    .map((row) => row.organization?.slug)
    .filter((slug): slug is string => Boolean(slug))
  if (orgSlugs.length === 1) return orgHref(orgSlugs[0], 'manage')
  if (orgSlugs.length > 1) return '/o'

  // Commission memberships, now org-nested.
  const memberships = (membershipResult.data ?? [])
    .map((row) => ({
      slug: row.commission?.slug,
      orgSlug: row.commission?.organization?.slug,
    }))
    .filter(
      (m): m is { slug: string; orgSlug: string } =>
        Boolean(m.slug) && Boolean(m.orgSlug),
    )

  if (memberships.length === 1) {
    return commissionHref(memberships[0].orgSlug, memberships[0].slug)
  }
  if (memberships.length > 1) return '/c'
  return '/'
}

/**
 * Sign in with email + password. On success, performs a server-side redirect to
 * the validated `redirect` path when provided, otherwise straight to the user's
 * resolved landing area. On failure, returns a pt-BR error.
 */
export async function signIn(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  // Distinguish "explicit safe redirect supplied" from "none" — only an actual
  // param overrides the resolved landing (safeRedirectPath maps absent → '/').
  const redirectParam = formData.get('redirect')
  const explicitTarget =
    typeof redirectParam === 'string' && redirectParam.length > 0
      ? safeRedirectPath(redirectParam)
      : null

  const fieldErrors: Record<string, string> = {}
  if (!email) fieldErrors.email = MESSAGES.emailRequired
  if (!password) fieldErrors.password = MESSAGES.invalidCredentials
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    // `invalid_credentials` (and the generic 400) must read the same so we
    // don't disclose whether the e-mail exists.
    const message =
      error?.code === 'invalid_credentials' || error?.status === 400
        ? MESSAGES.invalidCredentials
        : MESSAGES.generic
    return { ok: false, error: message }
  }

  // Resolve the landing on the authenticated client we already hold (no extra
  // GoTrue round trip) UNLESS the caller passed an explicit safe redirect.
  const target = explicitTarget ?? (await resolveLanding(supabase, data.user.id))

  // redirect() throws NEXT_REDIRECT — must be outside any try/catch.
  redirect(target)
}

/** Clears the session and returns to the login page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Request a password-reset email. Always returns the same non-committal success
 * message regardless of whether the e-mail maps to an account. The recovery
 * link lands on `/auth/confirm`, which verifies the OTP and forwards to
 * `/redefinir-senha`.
 */
export async function requestPasswordReset(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()

  if (!email) {
    return { ok: false, fieldErrors: { email: MESSAGES.emailRequired } }
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, fieldErrors: { email: MESSAGES.emailInvalid } }
  }

  const supabase = await createClient()
  const origin = await appOrigin()
  // We deliberately ignore the result: success and "no such account" must be
  // indistinguishable to the caller.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  })

  return { ok: true, error: MESSAGES.resetSent }
}

/**
 * Set a new password. Requires an active recovery/invite session (established by
 * `/auth/confirm` verifying the OTP). On success, redirects to `/`.
 */
export async function updatePassword(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  const fieldErrors: Record<string, string> = {}
  if (!password) {
    fieldErrors.password = MESSAGES.passwordRequired
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = MESSAGES.passwordTooShort
  }
  if (password && confirmPassword !== password) {
    fieldErrors.confirmPassword = MESSAGES.passwordMismatch
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  const supabase = await createClient()

  // Guard: an active session is required (the recovery/invite link must have
  // been verified first). Without it, updateUser would fail with a raw error.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: MESSAGES.generic }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { ok: false, error: MESSAGES.generic }
  }

  redirect('/')
}
