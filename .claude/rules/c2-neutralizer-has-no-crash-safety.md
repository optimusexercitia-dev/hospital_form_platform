---
paths:
  - "supabase/tests/mutation/c2-command-door-neutralizer.sh"
anchors:
  - supabase/tests/mutation/c2-command-door-neutralizer.sh
  - docs/followups/FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE.md
source: C2 Phase B2a incident 2026-09-04 — a sweep killed by a 10-minute tool timeout left cancel_event's HC044 custody gate open ~4 min, with no sentinel and no preflight red
---

# ⛔ Run this harness DETACHED — never under a tool timeout

Its sibling rule says a kill is *caught*. **Not here.** Measured 2026-09-04:

- `restore_inflight` (`:88-93`) truncates `$INFLIGHT` **unconditionally**. A kill takes the
  restoring `psql` too, so the restore never happens **and the sentinel is erased with it**.
- **`RECOVER=1` does not exist** in this script.
- `DEGEN` matches only a whole body replaced by a constant; a `raise → null;` rewrite matches none.

⇒ A kill leaves **an open authorization gate and no trace**. "Do not kill it" is the only defence,
and a tool timeout breaks it without anyone choosing to.

✅ Launch outside the tool's job tree, own `WORK` + `C2_INFLIGHT`, no timeout. Full sweep ≈ 8 h.
✅ Detector, if you suspect a strand: live anchored-raise count vs `worklist.tsv`'s `nraise`.
