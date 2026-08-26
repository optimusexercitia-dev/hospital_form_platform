import 'server-only'

import type { OwnPersonRecord } from '@/lib/users/types'

/**
 * "Meus dados" — the `/conta` self record (ADR 0151 D14), read through the self-only
 * DEFINER door `public.get_own_person_record`.
 *
 * ⚠ WHY A DOOR AND NOT A QUERY OVER `profiles`. Three columns are COLUMN-LOCKED even for
 * their owner: measured on the live catalog, `profiles.cpf`, `profiles.date_of_birth` and
 * `profiles.phone` carry NULL `attacl` and the table grants `authenticated` only `dxtm`
 * (no `r`). So `select cpf from profiles where id = auth.uid()` returns 42501 for the
 * person the row is about. The door is how a person reads their own record — not a
 * loophole around a restriction, but the only path the grants leave open.
 *
 * ⚠ THE DOOR TAKES NO TARGET PARAMETER, and that is the whole security argument. It keys
 * on `auth.uid()`, so "self-only" is a property of its SHAPE rather than of a check
 * inside it that a later edit could weaken. For the same reason there is deliberately NO
 * `get_own_person_record_for(p_actor)` service twin — that function would by definition
 * be "fetch any person's column-locked fields", which is exactly the door this design
 * exists to not build. A pgTAP assertion pins its ABSENCE, because prose cannot stop
 * someone from later "completing the pattern".
 *
 * ⚠ CPF MASKING HAPPENS HERE, at this boundary, and {@link OwnPersonRecord} carries no
 * raw `cpf` field at all. The door returns the digits — they are the caller's own, so
 * masking is a shoulder-surfing and screenshot mitigation, not a confidentiality boundary
 * against the owner — and this layer applies ADR 0147's SINGLE `maskCpf` mechanism before
 * the value reaches any caller. Do not add a second mask in SQL, and do not widen the
 * return type to expose the digits: the absence of the field is what makes "we remembered
 * to mask" a type-level guarantee instead of a convention.
 *
 * ⚠ READ-ONLY BY DESIGN. Corrections are administrative (ADR 0133 Amdt 1 r5's Art. 18
 * posture). There is no self-edit counterpart to this function and none should be added
 * beside it.
 *
 * Reads here are UNAUDITED, stated rather than assumed (ADR 0151 D9): this is ordinary
 * personal data read by its own subject, not the Class-2 professional-identity register,
 * and not PHI. Silence about that is how the previous gap got missed.
 *
 * @returns the caller's own record, or `null` when there is no authenticated session.
 */
export async function getOwnPersonRecord(): Promise<OwnPersonRecord | null> {
  // AFF4 B4 lands `public.get_own_person_record`; B8 wires this to it and applies
  // `maskCpf` (today module-private at `src/lib/users/person-footprint.ts`, moving beside
  // `normalizeCpf` in `src/lib/users/cpf.ts` so both directions of the CPF rule live in
  // one module).
  //
  // This throws rather than returning `null`, deliberately: `null` is a MEANINGFUL value
  // here ("no session"), so a stub returning it would render as a legitimately empty
  // page and the missing implementation would look like a working feature.
  throw new Error('not implemented: AFF4 B4/B8 (get_own_person_record)')
}
