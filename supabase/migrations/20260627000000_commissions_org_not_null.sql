-- ----------------------------------------------------------------------------
-- Multi-tenancy Phase C — flip commissions.{hospital_id, organization_id} to
-- NOT NULL. Every commission now belongs to exactly one hospital (and, via the
-- auto-derive trigger, exactly one organization). Forward-only.
--
-- Safe on a fresh `db reset`: migrations run against an EMPTY `commissions`
-- table (no rows to violate the constraint), and the reseed (seed.sql, which
-- runs AFTER all migrations) creates every commission WITH a hospital_id. The
-- Phase A columns landed nullable precisely so the world could be rebuilt
-- between Phase A and here; that rebuild is the reseed.
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

ALTER TABLE "public"."commissions"
  ALTER COLUMN "hospital_id" SET NOT NULL,
  ALTER COLUMN "organization_id" SET NOT NULL;

COMMENT ON COLUMN "public"."commissions"."hospital_id" IS 'The hospital this commission belongs to (NOT NULL since Phase C).';
COMMENT ON COLUMN "public"."commissions"."organization_id" IS 'DENORMALIZED from hospital_id via the commission_derive_organization_id trigger (non-app-writable, cannot drift). NOT NULL since Phase C. Single-hop org for per-org slug uniqueness + the org-admin predicates.';
