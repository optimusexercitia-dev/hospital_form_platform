import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Email-link landing handler (backend logic under `src/app/auth/**`, owned by
 * backend per lead agreement). Supabase recovery/invite emails point here with
 * a `token_hash` + `type`; we verify the OTP, which establishes a session via
 * the cookie-wired server client, then forward to the right UI:
 *   - recovery → /redefinir-senha  (user sets a new password)
 *   - invite   → /convite          (invited user sets their first password)
 *   - other    → /                 (role-aware landing resolves from there)
 *
 * Any failure (missing params, expired/invalid token) lands on the login page
 * with a generic, non-revealing error flag rendered as pt-BR by the login page.
 */

const FAILURE_REDIRECT = '/login?error=link_invalido'

// Per-type destination after a successful verification.
const SUCCESS_REDIRECT: Partial<Record<EmailOtpType, string>> = {
  recovery: '/redefinir-senha',
  invite: '/convite',
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL(FAILURE_REDIRECT, origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })

  if (error) {
    return NextResponse.redirect(new URL(FAILURE_REDIRECT, origin))
  }

  const destination = SUCCESS_REDIRECT[type] ?? '/'
  return NextResponse.redirect(new URL(destination, origin))
}
