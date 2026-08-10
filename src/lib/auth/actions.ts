'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deriveUserStatus } from '@/lib/users/types'

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
  // Shown when a valid credential belongs to a suspended/deactivated account.
  // The session is signed out immediately so no session is established (the
  // primary gate; BE-6). Wording is the same for both states so it does not leak
  // which lifecycle state the account is in.
  accountInactive:
    'Sua conta está suspensa/desativada. Contate o administrador da sua organização.',
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
 * ACT Stage 3 (ADR 0106) — the post-authentication destination sweep, backend
 * half. `resolveLanding` is DELETED, not patched.
 *
 * Why deletion, not a patch (a decision this stage had to make, recorded per
 * the plan's own Open Question 1 — `docs/design/act-role-picker.md` §2/§7 Q1):
 * `resolveLanding` was a SECOND, independent, hand-rolled implementation of the
 * role→landing partition that `src/app/page.tsx` (via `getSessionContext()` /
 * `session-grants.ts`) already owns correctly and completely — it only ever
 * checked 4 of the 11 `platform_role` values (platform_admin, org_admin,
 * commission membership by count) and fell through to `/` for everything else,
 * which is exactly the "one seam updated, the other not" defect class ADR 0101
 * exists to close, one level up, and it would have let a real fraction of
 * multi-role sign-ins (anyone whose FIRST-checked role here is org_admin or a
 * commission membership — including the plan's own `dualhat.a@test.local`
 * persona) skip the picker entirely on the most common path into the app.
 * Patching a second copy of the partition to also check for a hat would
 * perpetuate the duplicate; deleting it and taking page.tsx's one extra hop
 * (previously optimized away for a session-revalidation race under load) is
 * the correctness-over-micro-optimization trade D10's own "big bang, not
 * shadow mode... pre-pilot" framing prefers. Flagged plainly: this DOES
 * reintroduce one extra request-response round trip on every sign-in
 * (single-role included), a real, deliberate regression from the removed
 * fast path — recorded as a candidate follow-up (a shared role→route resolver
 * both `signIn` and `page.tsx` could call) once the picker's shape settles,
 * not a Stage 3 blocker.
 *
 * `signIn` now checks only: does the freshly-minted session carry an
 * `active_role` claim? Minted implicitly by `custom_access_token_hook` for a
 * single-role-type principal (D11 break-glass) or absent for a hatless
 * multi-role principal (D5) — this is decided ONCE, at token-mint time, inside
 * the hook; nothing here re-derives it. No claim → the picker, preserving any
 * `?redirect=` target as its own `redirect` param so the chosen hat can honor
 * it afterward. A claim → one hop through `/`, which now performs the ONLY
 * role→landing computation in the app (chain A in the design note).
 */
const ACTIVE_ROLE_CLAIM_KEY = 'active_role'

/** Route backend posts for frontend to build the picker screen against (PO
 * decision, 2026-08-10 — do not rename). */
const ROLE_PICKER_PATH = '/selecionar-perfil'

function buildPickerRedirect(explicitTarget: string | null): string {
  return explicitTarget
    ? `${ROLE_PICKER_PATH}?redirect=${encodeURIComponent(explicitTarget)}`
    : ROLE_PICKER_PATH
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

  // Primary inactive-account gate (BE-6). Credentials are valid, but a
  // suspended/deactivated account must NOT get a session — sign out immediately
  // and return the pt-BR notice. Doing it here (no session established) avoids the
  // redirect loop a bare-null getSessionContext would cause against the
  // login-bounce middleware. Uses the SAME authenticated client (no extra GoTrue
  // round trip) to read the lifecycle columns.
  const { data: lifecycle } = await supabase
    .from('profiles')
    .select('is_active, suspended_until, email_confirmed_at, must_change_password')
    .eq('id', data.user.id)
    .maybeSingle()
  if (lifecycle) {
    const status = deriveUserStatus(
      lifecycle.is_active,
      lifecycle.suspended_until,
      lifecycle.email_confirmed_at,
    )
    if (status === 'suspended' || status === 'deactivated') {
      await supabase.auth.signOut()
      return { ok: false, error: MESSAGES.accountInactive }
    }
    // Forced initial-password change (ADR 0049): the account is active/pending
    // (inactive already returned above), so KEEP the session and send the user
    // to rotate the admin-set password before any landing. Precedence mirrors
    // requireUser: inactive > must-change > normal.
    if (lifecycle.must_change_password) {
      redirect('/primeiro-acesso')
    }
  }

  // ACT Stage 3 (ADR 0106 D5/D11/D12): the JUST-MINTED session either carries
  // an active_role claim (single-role-type principal, derived implicitly by
  // custom_access_token_hook at sign-in) or does not (multi-role, no picker
  // selection exists yet for this brand-new session — every sign-in mints a
  // fresh session_id, so there can never be a prior selection to inherit).
  // getClaims() does the SAME local JWT verification the middleware/session
  // helpers use elsewhere (ADR 0009) — no extra GoTrue round trip.
  const { data: claimsData } = await supabase.auth.getClaims()
  const hasActiveRole = Boolean(
    (claimsData?.claims as Record<string, unknown> | undefined)?.[
      ACTIVE_ROLE_CLAIM_KEY
    ],
  )

  if (!hasActiveRole) {
    redirect(buildPickerRedirect(explicitTarget))
  }

  // A hat exists (implicit single-role derivation) — an explicit target still
  // short-circuits; otherwise take the one hop through `/`, the app's single
  // remaining role→landing computation (see the comment above).
  redirect(explicitTarget ?? '/')
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

  // Clear the forced-change flag (ADR 0049). Service-role write scoped to the
  // caller's own row — consistent with users/actions.ts and independent of the
  // profiles self-update policy; the column is service-role-only writable
  // (guard_profile_privileged_columns). Idempotent/harmless for the recovery +
  // invite flows that also call this action (their flag is already false).
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id)

  redirect('/')
}
