-- Phase 10 / B2 (2 of 3): Meetings SIGNATURES.
--
-- Internal electronic signatures on a meeting's ata. A signature asserts "I
-- attended and approve these minutes." Every PRESENT PLATFORM attendee must sign
-- (resolved design decision 8); guests and absentees never sign. The signature
-- is based on the user's platform authentication (the authenticated participant
-- clicks "Assinar"), with the schema PREPARED for future third-party providers
-- (gov.br / ICP-Brasil / DocuSign) WITHOUT a disruptive migration — hence the
-- full provider-abstraction columns (method / provider_ref / provider_payload /
-- ip_address / user_agent) even though v1 only writes method='internal_eauth'.
--
-- RLS (member SELECT; sign-own-row INSERT via app.can_sign_meeting) lands in the
-- consolidated RLS migration (…090003). The sign_meeting RPC (content_hash +
-- the auto-flip em_assinatura->assinada) lands in B3.
--
-- content_hash is the sha256 hex of the LOCKED minutes (meetings.minutes_md) at
-- signing time — a tamper-evidence anchor: re-opening a meeting (which revokes
-- signatures) and editing the minutes changes the hash, so a later signature's
-- hash differs from a revoked one's. status: signed / declined / revoked. A
-- reopen flips all active signatures to 'revoked' (rows KEPT for the audit
-- trail). signer_id is denormalized (= the attendee's user_id) so a member's
-- "have I signed?" check and my_pending_meeting_signatures can read it directly.

create table public.meeting_signatures (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  attendee_id uuid not null references public.meeting_attendees (id) on delete cascade,
  -- Denormalized signer (the platform user). = meeting_attendees.user_id; the
  -- sign-own-row policy requires it to equal auth.uid().
  signer_id uuid not null references public.profiles (id),
  method text not null default 'internal_eauth',
  status text not null default 'signed'
    check (status in ('signed', 'declined', 'revoked')),
  signed_at timestamptz not null default now(),
  -- sha256 hex of the locked minutes at signing time (tamper-evidence).
  content_hash text,
  -- Future third-party provider abstraction (unused by internal_eauth).
  provider_ref text,
  provider_payload jsonb,
  ip_address inet,
  user_agent text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.meeting_signatures enable row level security;
create index meeting_signatures_meeting_idx on public.meeting_signatures (meeting_id);
create index meeting_signatures_attendee_idx on public.meeting_signatures (attendee_id);
create index meeting_signatures_signer_idx on public.meeting_signatures (signer_id);

-- At most ONE ACTIVE (status='signed') signature per attendee. A revoked/declined
-- row does not block a later re-sign (after a reopen, the attendee can sign the
-- amended minutes again, creating a NEW signed row alongside the revoked one).
-- The double-sign attempt (HC035) collides with this partial-unique.
create unique index meeting_signatures_active_key
  on public.meeting_signatures (meeting_id, attendee_id)
  where status = 'signed';
