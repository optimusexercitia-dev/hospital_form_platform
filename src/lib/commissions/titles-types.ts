/**
 * Committee member-title types (ADR 0051 Decision 6). CLIENT-SAFE by design — no
 * `server-only` import, no `createClient` — so a Client Component (a title badge,
 * an assignment control) may import `MemberTitle` without pulling the server read.
 *
 * The canonical type-import path is THIS module: `@/lib/commissions/titles-types`.
 * The server read (`listMemberTitles`) and the mutation actions live in
 * `@/lib/commissions/titles` (which is `server-only`) and re-export this type for
 * server callers' convenience.
 */

/** One member title, as the UI consumes it. DISPLAY-ONLY (zero access semantics). */
export interface MemberTitle {
  id: string
  commissionId: string
  name: string
  /** Sort order within the commission's title list (1-based). */
  position: number
}
