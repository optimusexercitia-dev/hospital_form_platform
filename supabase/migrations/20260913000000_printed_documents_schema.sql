-- =============================================================================
-- PDF·P1 M1 — printed_documents registry + can_view_printed_document dispatch
-- door + verification_lookups (ADR 0104 D1/D3/D6/D10/D12; plan §2.1, lead-
-- approved 2026-08-07 with amendments A/B — those land in M2, the doors file).
--
-- A generated PDF is a RECORD (D1): bytes in Storage under service-role-only
-- reach (M3), identity + mint metadata + content hash here. ONE generic
-- registry for all four source kinds (D3): polymorphic (source_kind,
-- source_id) — deliberately NOT a real FK (accepted cost; integrity by the
-- doors + the storage-path CHECK below).
--
-- Vocabulary is text + CHECK, not native enums (lead-acked deviation 1): the
-- house dialect for code-coupled vocab (`responses.status`, `memberships.role`,
-- `form_items.item_type`), and the D11-anglicization scar (an enum re-key
-- stranded pg_policy predicates) argues against native enums here.
--
-- ZERO-PHI COLUMN RULE (D3 — review invariant, not a CHECK): no titles, no
-- source content, no free text except `revoked_reason` (governance text about
-- the record; kept PHI-free by instruction in the revoke dialog). Only the
-- storage OBJECT is PHI-bearing (P3+).
-- =============================================================================

create table public.printed_documents (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null
    check (source_kind in ('form_response', 'case', 'meeting', 'interview')),
  source_id uuid not null,
  -- Denormalized owner for RLS/admin-chain checks (the polymorphic source
  -- cannot be FK'd — ADR 0104 D3; every v1 kind resolves to exactly one
  -- commission).
  commission_id uuid not null references public.commissions (id),
  template_key text not null,
  template_version int not null check (template_version >= 1),
  -- sha-256 hex of the CANONICAL mint bytes (D8: overlaid copies are derived
  -- and will not hash-match — stated once, in the ADR).
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  storage_path text not null,
  contains_phi boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'superseded', 'revoked')),
  -- Dedicated verification credential (D10) — never the registry id; the paper
  -- never carries a registry key. URL-safe, >= 192-bit (format enforced by the
  -- mint door, uniqueness here).
  verification_token text not null unique,
  -- Human-typable damage fallback printed beside the QR (unambiguous alphabet,
  -- exact length 10 — mint-door enforced).
  verification_short_code text not null unique,
  minted_by uuid not null references public.profiles (id),
  minted_at timestamptz not null default now(),
  superseded_at timestamptz,
  revoked_reason_class text,
  revoked_reason text,
  revoked_by uuid references public.profiles (id),
  revoked_at timestamptz,

  -- Status/timestamp coherence. `superseded` is one-directional on purpose: a
  -- superseded document may LATER be revoked (status moves on, superseded_at
  -- stays as history), so the biconditional would reject a legal transition.
  constraint pd_superseded_has_ts check (status <> 'superseded' or superseded_at is not null),
  constraint pd_superseded_ts_status check (superseded_at is null or status in ('superseded', 'revoked')),
  constraint pd_revoked_iff_ts check ((status = 'revoked') = (revoked_at is not null)),
  constraint pd_revocation_complete check (
    revoked_at is null
    or (revoked_reason_class is not null and revoked_reason is not null and revoked_by is not null)
  ),

  -- ⛔ SECURITY (lead-acked deviation 2): the storage path is DERIVED from the
  -- row identity, never accepted free-form. Without this, a direct RPC caller
  -- could mint a row for a source he can view whose path points at ANOTHER
  -- document's object — open_printed_document would then serve someone else's
  -- bytes under his own source's authority (exfiltration-by-reference). The
  -- mint door derives the same value; this CHECK holds against ANY writer.
  constraint pd_storage_path_derived check (
    storage_path = (case when contains_phi then 'phi/' else 'std/' end) || id::text || '.pdf'
  )
);

comment on table public.printed_documents is
  'PDF print registry (ADR 0104). One row per MINT (record-semantics, D1). '
  'ZERO PHI in columns (D3 review invariant): pointers + metadata only; the '
  'storage object is the only PHI-bearing artifact. Writes ONLY through the '
  'DEFINER doors (mint/revoke) — no authenticated DML grant exists.';
comment on column public.printed_documents.storage_path is
  'Derived object path (std/<id>.pdf, phi/<id>.pdf from P3). Deliberately '
  'EXCLUDED from the authenticated column-list GRANT: bytes are reached only '
  'through the serving route after open_printed_document authorizes (D8). '
  'NOTE (lead Note C): with id + contains_phi granted the path is derivable, '
  'so the exclusion is defense-in-depth + posture, not a secret.';
comment on column public.printed_documents.verification_token is
  'Verification credential (D10). EXCLUDED from the authenticated GRANT: '
  'bulk-readable tokens would be a widening; resolution goes through the '
  'service-role-only lookup door.';
comment on column public.printed_documents.revoked_reason is
  'Governance text about the RECORD, never source content. PHI-free by '
  'instruction in the revoke dialog (D3). Not granted to authenticated yet — '
  'a future UI consumer adds its own column GRANT (house posture).';

-- Supersession's anchor (D6): at most ONE active print per
-- (source, template) — the mint door flips prior actives in-transaction.
create unique index printed_documents_one_active
  on public.printed_documents (source_kind, source_id, template_key)
  where status = 'active';

create index printed_documents_source_idx
  on public.printed_documents (source_kind, source_id);
create index printed_documents_commission_idx
  on public.printed_documents (commission_id);

-- ---------------------------------------------------------------------------
-- Grants — house column-list posture (the profiles/case_referral precedent:
-- every column enumerated; a LATER column addition needs its own GRANT or
-- authenticated reads fail 42501). No DML grants at all: writes are through
-- the M2 DEFINER doors — impossible, not unguarded (Architecture Rule 1).
-- Excluded deliberately: storage_path, verification_token (comments above),
-- revoked_reason, revoked_by (no UI consumer yet).
-- ---------------------------------------------------------------------------
revoke all on public.printed_documents from public, anon, authenticated;
grant select (
  id, source_kind, source_id, commission_id, template_key, template_version,
  content_hash, contains_phi, status, verification_short_code,
  minted_by, minted_at, superseded_at, revoked_reason_class, revoked_at
) on public.printed_documents to authenticated;

-- ---------------------------------------------------------------------------
-- The dispatch door (ADR 0104 D3.2) — can_view_printed_document.
--
-- ⛔ This function is a DOOR (prosecdef boolean): it enters the ADR 0079 ARM
-- census immediately and the diff-scoped door sweep of every phase that
-- touches it. It is BOTH the registry RLS predicate and the authority check
-- inside the M2 doors, which is exactly why it must NOT be an invoker-RLS
-- EXISTS delegation: inside a SECURITY DEFINER door an invoker-style read of
-- public.responses runs as the table owner — RLS never applies — and the
-- authority check would be vacuously true (fail-open). Explicit arms,
-- mirrored from the LIVE policy surface, are the only safe shape.
--
-- The form_response arm mirrors the live read surface of public.responses
-- (catalog-verified 2026-08-07): responses_select + responses_select_targeted
-- + responses_admin_all(SELECT half). No is_admin() anywhere — platform_admin
-- holds no arm (D11 noun rule), inherited from the source surface AND
-- keystoned in 312.
-- ---------------------------------------------------------------------------
create or replace function app.can_view_printed_document(
  p_source_kind text,
  p_source_id uuid,
  p_uid uuid
) returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_resp public.responses;
begin
  if p_uid is null or p_source_id is null then
    return false;
  end if;

  case p_source_kind
    when 'form_response' then
      select * into v_resp from public.responses where id = p_source_id;
      if v_resp.id is null then
        return false;
      end if;
      -- Mirror of the LIVE responses read policies (parity, not improvement —
      -- over-reach breaks legitimate surface):
      --   responses_select: own row OR commission-admin chain OR
      --     (submitted AND staff_admin) OR correction-corridor
      --   responses_select_targeted: targeted-respondent corridor
      --   responses_admin_all: commission-admin chain (already covered)
      return v_resp.created_by = p_uid
          or app.is_commission_admin_of_for(v_resp.commission_id, p_uid)
          or (v_resp.status = 'submitted'
              and app.is_staff_admin_of_for(v_resp.commission_id, p_uid))
          or app.can_read_correction_response(p_source_id, p_uid)
          or app.can_access_targeted_response(p_source_id, p_uid);
    else
      -- case | meeting | interview arms land in P2..P4 (one per phase).
      -- ELSE_FAIL_CLOSED: an unhandled kind is UNREADABLE, not exposed
      -- (ADR 0104 D3) — a new printable kind that forgets its arm fails shut.
      return false;
  end case;
end;
$$;

comment on function app.can_view_printed_document(text, uuid, uuid) is
  'ADR 0104 D3 per-kind visibility dispatch. The module never grants sight of '
  'anything: each arm delegates to the source domain''s live read surface; '
  'unhandled kinds return false (fail closed). Used by printed_documents RLS '
  'AND as the authority check of the mint/open doors (D11: mint right = source '
  'visibility; download re-evaluated at call time).';

revoke all on function app.can_view_printed_document(text, uuid, uuid) from public;
grant execute on function app.can_view_printed_document(text, uuid, uuid)
  to authenticated, service_role;

alter table public.printed_documents enable row level security;

create policy printed_documents_select on public.printed_documents
  for select to authenticated
  using (app.can_view_printed_document(source_kind, source_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- verification_lookups — the D12 rate-limit log for the public /verificar
-- surface. Deliberately NOT audit_log (anonymous internet noise stays out of
-- the hash-chained ledger). Stores a sha-256 of the PRESENTED credential,
-- never the raw token. Rate limiting itself is app-layer in the route/page;
-- this table is the record, not the limiter.
-- ---------------------------------------------------------------------------
create table public.verification_lookups (
  id bigint generated always as identity primary key,
  looked_up_at timestamptz not null default now(),
  -- Kind of the matched document; null when nothing matched.
  source_kind text,
  token_hash text not null,
  matched boolean not null
);

comment on table public.verification_lookups is
  'Minimal verification-scan log (ADR 0104 D12): kind + credential-hash + '
  'timestamp + matched. Never the raw token, never an actor, never audit_log. '
  'Written only inside the service-role-only lookup door (M2).';

alter table public.verification_lookups enable row level security;
revoke all on public.verification_lookups from public, anon, authenticated;
-- RLS on + zero policies + zero authenticated ACL: the audited-single-door
-- shape (Architecture Rule 1) — a policy here would be unreachable code.
