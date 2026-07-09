import { NextResponse } from 'next/server'

/**
 * Liveness probe for the container orchestrator (Coolify health check + Docker
 * HEALTHCHECK). Intentionally DEPENDENCY-FREE: it reports that the Next.js
 * process is up and serving, and deliberately does NOT touch Supabase — a
 * transient DB blip must not fail the container's health check and trigger a
 * restart loop. It is a PUBLIC path (excluded from the auth gate in
 * `src/proxy.ts`'s matcher), so it must never read a session or leak data.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export function GET() {
  return NextResponse.json(
    { status: 'ok', service: 'hospital-form-platform', timestamp: new Date().toISOString() },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
