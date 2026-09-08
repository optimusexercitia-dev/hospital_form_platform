# FUP-AUTHZ-NO-BEHAVIOURAL-PROOF-APP-SCHEMA-UNREACHABLE-OVER-POSTGREST — the whole `app`-unreachability posture is asserted in prose and gated only as TEXT; nothing observes the behaviour (owner: backend; filed 2026-09-08, unit PRIVILEGE-SURFACE / pre-AE5 Batch 7, rulings R12 + R18)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-08 · status open

**Filed 🟡 medium, deliberately, and it is NOT a report of a hole.** Every available signal says
`app` is unreachable over PostgREST today. What is missing is a *measurement* of it. The item exists
because a premise this load-bearing, held only by prose plus a text gate, is one silent config change
away from being false with nothing able to say so.

## What IS proven, so the gap is not overstated

`npm run lint` gate 14 (`lint:config-schemas`, `scripts/check-supabase-config-schemas.mjs`, built
under ruling R2 in this unit) reds if `supabase/config.toml`'s `[api].schemas` gains `app`, or
changes at all. It self-tests on ten mutations of the real file and three good ones each run, and
both failure texts were observed on planted copies (exit 1 each). ⇒ **The FILE cannot silently gain
`app`.**

## ⛔ THE BOUND — what that does NOT buy (ruling R18, in the plan's own terms)

The gate proves the **FILE**. It does **not** prove the **DEPLOYED** PostgREST configuration matches
the file. `supabase/config.toml` configures the LOCAL stack; the hosted project's exposed-schema
setting lives outside this repo and can diverge with no commit and no gate run. ⛔ Probing production
is a network action against the live project and is the PO's to authorise — deliberately not done at
build time. ⇒ **The gate is a PROXY for reachability, not the property.** A closure, record or review
that does not carry this sentence claims more than the gate buys.

## Six in-tree prose premises rest on the unmeasured property

Each was read at its own site and quoted, not taken from a summary
(*a-paraphrase-can-invert-the-sentence-it-summarizes*):

| # | site | the sentence that depends on it |
|---|---|---|
| 1 | `supabase/tests/320_act_expiry_and_acl_hardening.sql:285-287` (and `:186-188`) | *"`config.toml` exposes ONLY the `public` schema, so an `app` function with PUBLIC EXECUTE is not PostgREST-reachable. This is defence-in-depth."* — ⭐ the severity calibration of the **LIVE §U1 assertion** pinning the `app` PUBLIC-executable set at 236 |
| 2 | `docs/backend-state.md:3547-3549` | why `session_context()` lives in `public`: *"an `app.*` function is unreachable from `supabase.rpc()`"* |
| 3 | `docs/design/authz-ae1-revoke-partition.md:44` | the UNCHANGED partition's rationale — *"no sweep — old or new — has ever looked at it"* |
| 4 | `docs/design/authz-definer-classification-ae1.md:41`, `:484-486` | *"no `app` function is client-invocable"*, under 320 `app` DEFINER `authenticated` grants and **213 of the 233** AE1 revokes |
| 5 | `docs/followups/FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE.md:15-18` | why the `public` wrappers *"are NOT redundant, and must not be 'simplified' away"* |
| 6 | `docs/phases/ethics-e4-participant-seating.md:40-43` | *"an `app.*` RPC is a PostgREST 404 no client can reach"* |

⚠ **Six is a floor, not a census.** `grep -rn graphql_public` finds further citations in reviews and
progress records; these are the six verified at their own line on 2026-09-08.

## The one place that ever exercised it was removed — CORRECTLY, and that is the point

`e2e/orphan-administrativo-reachability.spec.ts:306-313` records the rewrite verbatim:

> The door refuses them. Rewritten (QA `case-surface-split-increment-2-review.md` B5a): this used to
> probe `rpc/member_can` guarded by `if (rpc.ok())`. `member_can` exists ONLY as `app.member_can` …
> so that POST always 404s (PGRST202), `rpc.ok()` is always false, and the assertion inside NEVER RAN.

⛔ **Do not read this as "we deleted our proof".** The removed probe was never a proof — it was a
vacuous assertion wrapped in a condition that could not hold, and removing it was right. The
*consequence* is what this item is about: it was also the only place in the suite where an `app.*`
RPC was ever POSTed over PostgREST at all, and **nothing deliberate replaced it**. A vacuous witness
was retired and the property went from accidentally-observed to not-observed. ⭐ *Absence of a verdict
is not absence of coverage — and it is not coverage either.*

## Closing this — and the trap that makes a naive version worthless

⭐ **A bare 404 assertion proves nothing.** `POST /rest/v1/rpc/<app fn>` → 404 is exactly what a
typo'd function name, a wrong `baseURL`, a stale apikey or a stopped stack also produce. That is the
whole reason the original probe was vacuous, and a closure that re-introduces the same shape one
layer out closes nothing. The assertion needs a **discrimination half in the same run, same client,
same headers**: a `public.*` RPC that IS reachable, observed returning a real PostgREST response
(200, or a *semantic* refusal such as `42501`/`PGRST` business error — never a transport 404) beside
the `app.*` call observed returning `PGRST202`. Only the PAIR distinguishes "not exposed" from "the
test could not reach anything".

⚠ **And a local probe closes only half.** The local stack's PostgREST is configured *from* this
file, so a local e2e pair proves the FILE→LOCAL path. The hosted divergence in the bound above is a
separate question and needs PO authorisation to even ask.

**Not closed by:** ⛔ gate 14 (that is the proxy this item exists to bound) · ⛔ a pgTAP assertion —
pgTAP runs *inside* the database and cannot see PostgREST at all, so it can never witness
reachability · ⛔ a single 404 without its positive control · ⛔ another prose statement in a seventh
document.
