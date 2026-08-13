-- =============================================================================
-- DM2·S1 — the D15 confidentiality ceiling, part 1 of 2: column + CHECK + the
-- write-time seam guard (ADR 0114 Amendment 1 D15; restores ADR 0072 D7
-- semantics on the document model). Part 2 (20260924000200) adds the read-side
-- kernel arm — deliberately split (lead AMEND 1) so the behavioral keystones
-- (228 tests 36-39, 328 K14) could be observed RED against the REAL
-- post-column, pre-arm catalog. The substrate is inert (0 rows, no writers,
-- flags OFF), so the intermediate state carries no exposure.
--
-- Column name: confidentiality_level — matches the dominant sibling spelling
-- (cases, case_interviews, case_types.default_confidentiality_level); the
-- retired attachments spelling (confidentiality_label) died with its
-- substrate. NULL = unclassified = non-enforcing.
--
-- Seam ruling (S1 decisions record): an ENFORCING label (legal_privileged,
-- credentialing_sensitive) is representable only on a home that resolves to a
-- case (case, interview -> case_of_interview). meeting/action_item have no
-- clearance plane; the write is refused here and the kernel arm (part 2)
-- carries the matching fail-closed read backstop. action_item deliberately
-- gets NO source_* resolution — a partially-resolvable polymorphic source is a
-- half-open seam; a future widening is a deliberate, keystoned decision.
--
-- SQLSTATE: HC0D6. NOT the next-free-looking HC0D5 — that code is already
-- minted by revoke_printed_document (verified against comment-stripped
-- pg_proc.prosrc, 2026-08-13); a keystone matching a shared code could be
-- satisfied by the neighboring path (authz-handoff §7.1).
-- =============================================================================

alter table public.documents
  add column confidentiality_level text;

comment on column public.documents.confidentiality_level is
  'D15 interim confidentiality ceiling (ADR 0114 Amendment 1; ADR 0072 D7 '
  'semantics). NULL = unclassified (non-enforcing). Only legal_privileged and '
  'credentialing_sensitive gate above home-resource read; clearance rides '
  'case_access_grants.max_confidentiality via app.confidentiality_clearance_ok. '
  'Governance metadata, not PHI. Migrates into the Phase-19 access plane (D16).';

alter table public.documents
  add constraint documents_confidentiality_level_check
  check (confidentiality_level is null or confidentiality_level in
         ('non_phi_internal', 'phi_standard', 'phi_restricted',
          'peer_review_confidential', 'legal_privileged',
          'ethics_investigation', 'credentialing_sensitive'));

-- The seam guard. SECURITY DEFINER + pinned search_path + owner-only ACL,
-- matching the DM1 guard siblings (guard_document_transition et al., ADR 0116
-- §5: the writers here are DEFINER commands, the service role, and fixtures —
-- exactly the writers whose bugs guards exist to catch).
create or replace function app.guard_document_confidentiality()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_type text;
begin
  if new.confidentiality_level in ('legal_privileged', 'credentialing_sensitive') then
    select s.resource_type into v_type
      from public.securable_resources s
     where s.id = new.home_resource_id;
    if v_type is null or v_type not in ('case', 'interview') then
      raise exception
        'nível de confidencialidade restrito exige documento vinculado a um caso ou entrevista'
        using errcode = 'HC0D6';
    end if;
  end if;
  return new;
end;
$$;

alter function app.guard_document_confidentiality() owner to postgres;
revoke all on function app.guard_document_confidentiality() from public;

create trigger trg_guard_document_confidentiality
  before insert or update of confidentiality_level, home_resource_id
  on public.documents
  for each row execute function app.guard_document_confidentiality();
