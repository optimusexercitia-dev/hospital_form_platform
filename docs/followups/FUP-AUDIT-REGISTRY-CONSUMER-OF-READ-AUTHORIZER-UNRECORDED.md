# FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED — `app._audit_access_authorized` routes a permission to a re-keyed authorizer and appears in no manifest row

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

`app._audit_access_authorized` routes `professional_profile.read` to `app.can_read_professional_profile`,
making it a **fourth consumer** of that authorizer. It is absent from every manifest `enforcementSites`
list — correctly, because it is the Rule-11 audit registry and not an enforcement site. But nothing
anywhere records that **changing that authorizer moves the audit gate too**.

**How it was measured.** `prosrc` caller scan over the live catalog while writing the rollback runbook's
§6 worked example.

**What would close it.** A named note wherever the authorizer's consumers are enumerated — the manifest
row's qualifier, or `../backend-state.md`'s authz section — saying the audit registry is a consumer and
is deliberately not an enforcement site.

⛔ **What must NOT be mistaken for closing it.** Adding it to `enforcementSites`. That would make the
manifest claim an enforcement site that does not enforce, and `FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE`'s
eventual closure check would then be measuring a fiction.
