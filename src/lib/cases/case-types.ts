/**
 * Case-type MODEL — PURE, client-safe module (ADR 0064 Decision 4).
 *
 * Holds the `CaseType` shape plus the three constrained vocabularies, with NO server
 * import, so the case-type pickers (Client Components) may value-import the option
 * lists without dragging the server Supabase client into the client bundle
 * (BUG-FBE-005: a client value-import from a server-tainted module aborts
 * `next build`). Mirrors the split already used by `@/lib/cases/terminology` — the
 * RLS-backed readers live in `@/lib/queries/case-types`, the writers in
 * `@/lib/case-types/actions`.
 *
 * Each vocabulary mirrors a live CHECK constraint on `public.case_types`; keep them in
 * sync with the catalog, never with migration text (CLAUDE.md graphify exception).
 */

/** `case_types.primary_subject_kind` — what the type's cases are ABOUT. */
export type PrimarySubjectKind = 'patient' | 'professional' | 'entity' | 'none'

/** `case_types.default_visibility_policy` (= `cases.visibility_policy`). */
export type CaseVisibilityPolicy = 'commission_default' | 'explicit_grants_only'

/** `case_types.default_confidentiality_level` (= `cases.confidentiality_level`). */
export type CaseConfidentialityLevel =
  | 'non_phi_internal'
  | 'phi_standard'
  | 'phi_restricted'
  | 'peer_review_confidential'
  | 'legal_privileged'
  | 'ethics_investigation'
  | 'credentialing_sensitive'

/** pt-BR labels for the picker (Architecture Rule 10). */
export const PRIMARY_SUBJECT_KIND_LABELS: Record<PrimarySubjectKind, string> = {
  patient: 'Paciente',
  professional: 'Profissional',
  entity: 'Instituição / setor',
  none: 'Sem sujeito definido',
}

export const VISIBILITY_POLICY_LABELS: Record<CaseVisibilityPolicy, string> = {
  commission_default: 'Toda a comissão',
  explicit_grants_only: 'Somente quem receber acesso',
}

export const CONFIDENTIALITY_LEVEL_LABELS: Record<CaseConfidentialityLevel, string> = {
  non_phi_internal: 'Interno (sem dados de paciente)',
  phi_standard: 'Dados de paciente — padrão',
  phi_restricted: 'Dados de paciente — restrito',
  peer_review_confidential: 'Revisão por pares — confidencial',
  legal_privileged: 'Sigilo jurídico',
  ethics_investigation: 'Investigação ética',
  credentialing_sensitive: 'Credenciamento — sensível',
}

export const PRIMARY_SUBJECT_KINDS = Object.keys(
  PRIMARY_SUBJECT_KIND_LABELS,
) as PrimarySubjectKind[]

export const VISIBILITY_POLICIES = Object.keys(
  VISIBILITY_POLICY_LABELS,
) as CaseVisibilityPolicy[]

export const CONFIDENTIALITY_LEVELS = Object.keys(
  CONFIDENTIALITY_LEVEL_LABELS,
) as CaseConfidentialityLevel[]

/**
 * One org-scoped case type. A process template DECLARES one (ADR 0064 D4) and each
 * case created from that template SNAPSHOTS it, inheriting
 * {@link defaultVisibilityPolicy} / {@link defaultConfidentialityLevel} at creation —
 * so these two fields are the type's ACCESS posture, not decoration.
 */
export interface CaseType {
  id: string
  organizationId: string
  /** Stable machine key, unique per organization. */
  key: string
  /** pt-BR display name (e.g. "Ética"). */
  displayName: string
  primarySubjectKind: PrimarySubjectKind
  defaultVisibilityPolicy: CaseVisibilityPolicy
  defaultConfidentialityLevel: CaseConfidentialityLevel
  /** Optional pt-BR noun for a single case of this type (e.g. "Denúncia"). */
  defaultCaseLabel: string | null
  /** `false` = retired: hidden from pickers, existing references keep rendering. */
  isActive: boolean
}
