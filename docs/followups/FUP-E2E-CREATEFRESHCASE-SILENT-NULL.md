# FUP-E2E-CREATEFRESHCASE-SILENT-NULL

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-23 · status open

⚠ **PRE-EXISTING — not caused by ADR 0137.** Filed 2026-08-23 (tester) while auditing
`catch(() => null/[]/undefined)` sites for the ADR 0137 `case-patient` rewrite.

`e2e/case-narratives.spec.ts:192-207` — `createFreshCase(page, token)` resolves the M&M template via
`getMandMTemplateId` (itself a `.catch(() => null)` around `getPublishedTemplateVersion`), then calls
`create_case_from_template`. **Any failure along that chain — template not found, RPC non-2xx, malformed
body — returns `null`, with no thrown error and no logged reason.** Its only caller (verified: one call
site, `:193`) narrows on `if (!templateId) return null`, and the RPC branch likewise returns `null` on
`!resp.ok()`.

✅ **Not currently masking a live regression** — the M&M template resolution it wraps touches no name ADR
0137 touched (verified separately from `BUG-E2E-CP-HELPER-COLLECTSPATIENT`).

⭐ **But it is the same family, and that is why it is filed rather than left:** a test whose *setup*
silently degrades reads as *"this case genuinely has nothing to test"* rather than *"the fixture broke"* —
and **nothing distinguishes the two outcomes.** That is `lint:vacuous`'s own shape sitting outside what the
gate can trace into, because the vacuity lives in a helper.

**Decide between:**
- **(a)** throw with the underlying reason instead of returning `null`; or
- **(b)** keep null-on-failure but require **every** caller to assert non-null with a message naming the
  failure mode — mirroring the `restGet` / `expect(resp.ok())` discipline already used elsewhere in this
  suite.

**Owner:** tester.

---
