# door-sweep selftest fixtures

Committed inputs for `SELFTEST=1 bash scripts/door-sweep-cases.sh`. Each file is copied,
UNTRACKED, into a throwaway `git init` repo under `$TMPDIR` that also holds `cmp`-verified
copies of the real `scripts/door-sweep-cases.sh` and the two audit harnesses. ⛔ Nothing
here is ever placed in `supabase/migrations/`, and the selftest touches no database except
read-only catalog queries the deriver itself makes.

⚠ Every function and policy named below EXISTS in the live catalog, deliberately: the
deriver classifies by the catalog, so a made-up name would only ever exercise the
UNRESOLVED branch. The fixtures pin what each catalog fact makes the deriver do.
