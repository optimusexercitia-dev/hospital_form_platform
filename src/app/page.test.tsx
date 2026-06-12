/**
 * Phase 0 smoke test — updated in Phase 2.
 *
 * The root `page.tsx` was replaced with an async Server Component that calls
 * `getSessionContext()` and redirects based on the user's role. That component
 * cannot be unit-tested in jsdom (it needs a Supabase session + DB). The
 * "public entry renders content" smoke assertion has been moved to the public
 * entry: the `/login` page. The full auth and shell E2E suite lives in
 * `e2e/phase2-auth-shell.spec.ts`.
 */

import { render, screen } from '@testing-library/react'
import LoginPage from './(auth)/login/page'

// Minimal mock so the LoginForm (client island) doesn't crash in jsdom.
// It calls `useActionState` which needs React to be available, and imports
// from Next.js which are mocked automatically by the Vitest Next.js preset.
vi.mock('@/lib/auth/actions', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
}))

// Mock `next/navigation` (usePathname etc.) used transitively by LoginForm.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

describe('Login page (public entry smoke test)', () => {
  it('renders a heading with visible content', async () => {
    // LoginPage is async (reads searchParams).
    const jsx = await LoginPage({ searchParams: Promise.resolve({}) })
    render(jsx as React.ReactElement)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent).toBeTruthy()
  })

  it('renders at least one link', async () => {
    const jsx = await LoginPage({ searchParams: Promise.resolve({}) })
    render(jsx as React.ReactElement)
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
  })
})
