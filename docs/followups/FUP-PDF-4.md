# FUP-PDF-4 — verification rate limiter: comment FIXED, availability lever still OPEN and re-scoped (QA P1 MINOR-3; owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-11 · status parked

⛔ **The filed premise was wrong in a way that mattered, corrected 2026-08-11 against the code.**
The entry said the limiter is *"one **global** 60/min counter"* and prescribed *"per-credential
granularity (keep the global cap as a backstop)"* — **that is already exactly what ships, and
has since the original commit `e1daba9`**: `PER_CREDENTIAL_LIMIT = 5` over a `perCredentialHits`
map, plus the global 60 backstop. Anyone executing the prescription literally would have written
a no-op and closed the item. The lesson is the standing one: **a prescription in a follow-up is a
claim about the code and ages like one** — re-measure before implementing, not after.

**DONE:** the false *"the page shows it verbatim"* comment is corrected. Confirmed against
`src/app/(public)/verificar/[token]/page.tsx:84-90`, which catches **every** error, logs it, and
returns `{ state: "unavailable" }` — so `VERIFICATION_RATE_LIMIT_MESSAGE` is never rendered and
reaches only the server log. (The comment-asserting-an-untruth family, invisible to every gate.)

**STILL OPEN — the availability lever, correctly described:** the per-credential arm bounds
brute-forcing ONE code; it does nothing about the actual DoS. One visitor cycling ~12 distinct
credentials × 5 each exhausts the **global** 60/min budget and throttles *every* anonymous
visitor on the public `/verificar` surface. Both windows are also module-level process memory, so
they are per-PROCESS — N app instances mean N× every budget.

⚠ **Deliberately not fixed in the FUP quick batch, because neither half is guessable:** closing
it needs per-**client** granularity (which needs a *trusted* client identity — `x-forwarded-for`
is only as trustworthy as the proxy in front of it, a Coolify deploy decision, ADR 0059) **plus**
shared cross-process state. Both are decisions, not code. The limitation is now recorded in the
module docblock so the next reader does not re-derive it. The RPC stays service_role-only.
