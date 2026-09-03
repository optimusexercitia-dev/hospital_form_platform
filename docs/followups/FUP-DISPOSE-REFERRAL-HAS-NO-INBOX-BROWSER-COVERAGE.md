# FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE — three of the four erasure lanes are driven through the DSR inbox in a browser; the referral lane is not (owner: tester; **filed 2026-08-21 as the named residual of a bug that closed on removal**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-21 · status open

`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE` closed 2026-08-21 **on removal of its subject**, not on
achieved coverage — the `ReferralDisposeDialog` was deleted (no hat could reach it). What that close
does **not** cover, and what is recorded here so it is not inherited as coverage:

**`dispose_referral_phi`'s live pathway — the DSR task inbox — has no browser-level test anywhere.**
Grepped the whole `e2e/` tree: the only `dispose_referral` hit is `nsp-per-hospital.spec.ts`'s
**direct RPC POST**, which proves the door and the audit trail and says nothing about the inbox card,
its confirm flow, or the server action behind it. `dispose_case`, `dispose_event` and
`dispose_meeting` all gained inbox-driven browser coverage in this round; the referral lane alone did
not.

⚠ **Asymmetry worth stating plainly:** the lane whose UI was removed is the lane with the least
browser coverage, and the close of the removal bug is the document a future reader will find first.
