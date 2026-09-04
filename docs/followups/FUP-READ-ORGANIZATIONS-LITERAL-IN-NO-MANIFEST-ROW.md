# FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW — a function carries a permission literal that no manifest row declares

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open

`app.current_professional_read_organizations` carries the permission literal `org.professionals.read` and
appears in **no** `enforcementSites` entry of `supabase/tests/vectors/authz-enforcement-manifest.json`.
It is ADR [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md)'s deliberate **second site**
for that permission — deliberate, but undeclared.

**How it was found.** By the site-axis closure arm added to pgTAP `410` § 8 on 2026-09-03 (the fix for
`FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE`). § 8.5 surfaces it as `[UNDECLARED]`. ⭐ **This is the new
arm finding something on its first real run that no previous arm could see** — the reverse direction
(catalog object carrying a literal ⇒ must appear in exactly one manifest row) is exactly the half that did
not exist before, and it paid for itself immediately.

It is currently **pinned by name as a disclosure** rather than either declared or excluded, so the arm
stays green while the question is open. ⚠ That pin is a deliberate, visible debt — not a silent one — but
it is still a hand-maintained exception, and a second one would start a list.

**What would close it — a PO call, because both answers are defensible.** Either add
`app.current_professional_read_organizations` to the `org.professionals.read` row's `enforcementSites`
(making it a declared site, measured like any other), **or** record a reviewed exclusion saying why a
second site for one permission is correct here and what bounds it. ⛔ Deleting the pin without doing
either re-opens the blindness the arm was built to remove.

⛔ **What must NOT be mistaken for closing it.** A green `410` — it is green *now*, by virtue of the pin.
The pin is the thing being tracked.
