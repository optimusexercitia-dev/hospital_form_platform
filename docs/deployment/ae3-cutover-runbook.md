# AE3 cutover runbook — restricted personal-detail extraction

- **Subject:** migrations `20261003006600` / `006700` / `006800` (ADR
  [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D4;
  plan [authz-evolution.md](../plans/authz-evolution.md) § *Phase AE3*, step AE3.2.6
  `[PA-F3]`).
- **What changes:** `profiles.cpf`, `.date_of_birth`, `.phone` are **dropped** and their values
  live in `public.profile_private_details`.
- **Why this file exists:** because the drop makes the previous application build **broken, not
  merely stale**. This is written down rather than improvised, per the plan's own requirement.

---

## 0. The one paragraph that matters

⛔ **This is a MAINTENANCE-WINDOW cutover, not a rolling deploy.** The moment `006800` commits,
every still-running instance of the old build fails on each `profiles.cpf` / `.date_of_birth` /
`.phone` read or write — the person-detail page, the registration wizard's CPF collision probe,
`getPersonAdminView`, and `updateUserProfile`'s change detector. PostgREST returns an error;
**nothing in the build fails earlier**, because a `.select('…')` column list is a runtime string
and `.maybeSingle<T>()` supplies its row type at the call site. `tsc`, `eslint` and `vitest` are
all green against a schema that no longer exists.

⚠ **"Pre-live" shrinks the audience; it does not make two deployment systems atomic.** ADR 0155
**G2** authorized a single-shot *data* migration. It did not authorize an unplanned outage.

## 1. Preconditions (verify, do not assume)

| # | Check | How | Blocks on |
| --- | --- | --- | --- |
| 1 | **G2 still holds** | `select count(*) from auth.users where email not like '%@test.local'` on the linked project | **non-zero ⇒ STOP.** G2 is void; AE3 re-plans onto the audit §7 Phase 3 dual-write contract. ⛔ Re-measure; never quote a previous run. |
| 2 | Remote head is `20261003006500` | `select max(version) from supabase_migrations.schema_migrations` | any other head ⇒ reconcile before starting |
| 3 | Local and remote agree on the AE3 subject | `scripts/authz-census-ae3.sql` blocks 1, 2, 7 on both | any drift ⇒ explain in writing or stop |
| 4 | The app build to be deployed is the **post-AE3** one | it must contain `profile_private_details` in `src/lib/users/actions.ts` and `person-footprint.ts` | a pre-AE3 build ⇒ step 5 will not recover you |
| 5 | A **rollback artifact** exists and has been read | § 4 below | missing ⇒ stop (ADR 0162 §1: rollback is a runbook, never a migration) |

## 2. Order — schema first, then code

The plan's rule 8 fixes the push order (*"schema first, then code"* — the AFF4 Record step
recorded a violation of exactly this). The window is between 2c and 2e.

1. **Announce the window.** Note it in PROGRESS.md § Now while it is open.
2. **Stop the app** in Coolify (scale to zero / stop the container). ⛔ Not "put up a banner" —
   a running instance keeps issuing the broken queries and each one is a user-visible 500.
3. **Take the pre-migration snapshot** (§ 4.1). This is the rollback artifact, and it is taken
   **while nothing is writing**.
4. **Apply the migration set:** `npm run db:push`. All three migrations, one push.
   - `006600` creates the table, moves the CHECK and the partial unique index, backfills, and
     **verifies with keyed per-row equality**, raising on the first mismatch.
   - ⭐ **This is the run where the backfill does its real work.** On a fresh local reset it
     matched zero rows by design, so a green local run is **not** evidence it works.
   - The `raise notice` reports how many rows moved. **Read it.** A count of 0 against a
     populated `profiles` means the `insert … select` matched nothing and the verification
     passed vacuously — stop and investigate rather than proceeding.
5. **Deploy the post-AE3 build** and start the app.
6. **Smoke** (§ 3). Only then close the window.

## 3. Smoke checks — the paths that break if anything is wrong

Run as a real signed-in user, not with service-role tooling; the whole point is the
`authenticated` path.

1. **`/conta/meus-dados`** renders the caller's own CPF (masked), date of birth and phone.
   Exercises `get_own_person_record`'s two-relation projection, and its **LEFT JOIN** — a person
   with no restricted details on file must render empty fields, not "not found".
2. **Person detail page** (`/o/[org]/manage/usuarios/[userId]`) as an org admin: personal data
   visible, CPF masked. Exercises `getPersonAdminView`'s split existence check.
3. **Edit a person's phone**, save, reload. Exercises `update_person_fields_impl`'s upsert.
4. **Edit a person's CPF** as an org admin. Exercises the `cpf_change` authority arm against the
   re-pointed change-detection read.
5. **Register a new person** with a CPF already held by someone else → must be refused with the
   collision message, and **one** `person.cpf_lookup` audit row must be emitted.
6. **Directory CPF search** finds the person by exact CPF, and emits exactly one
   `person.cpf_lookup` row.

Any failure ⇒ § 4.

## 4. Rollback

⛔ **The rollback trigger is named, so nobody has to decide under pressure:** *the migration set
succeeded and the code deploy then failed, or a § 3 smoke check fails.*

Two options. **Roll forward is preferred** and is usually right, because the data is already
migrated and correct.

### 4.1 The artifact (taken at step 2.3, before anything runs)

A pre-migration dump of the three columns, keyed by profile id.

⛔ **ENCRYPTED AT CREATION, IN ONE PIPELINE — the plaintext never touches a disk.** The
`psql` output is piped straight into the encryptor; there is no intermediate `.csv` to
forget to delete. Substitute `age -r <recipient>` for `gpg` if that is what the operator
holds; the invariant is that **no step of the typed command produces a readable file**.

⛔⛔ **AND IT MUST TARGET THE REMOTE. `docker exec supabase_db_<ref>` IS THE LOCAL STACK.**
This runbook's cutover applies to the **linked Supabase Cloud project**, which has no container
to `exec` into. The first version of this command was a `docker exec` — so an operator following
it would have produced a confident, correctly-encrypted artifact **of the wrong database**, and
discovered it only when a rollback failed to restore anything. QA r2 finding **B5**; ⚠ round 1
looked at this command and flagged only the plaintext, so *the shape survived one review*.

This repo reaches the remote through the Supabase CLI (`--linked`), and has **no** committed
connection-string variable — so the URI is fetched deliberately, not assumed:

⛔⛔ **AND THE CREDENTIAL MUST NOT PERSIST.** An inline `REMOTE_DB_URL='postgresql://…:<password>@…'`
puts the **production database password** into shell history — plaintext, indefinitely, on the
same machine the artifact is required to leave. QA r3 finding **B7**, and the *third* instance of
B2's class: a rule the command contradicts is not a rule. `read -rs` keeps it out of history and
off the screen.

```bash
# Supabase dashboard -> Project Settings -> Database -> Connection string (URI).
# ⛔ NOT 127.0.0.1:54322. If the URI contains "localhost" or "127.0.0.1", STOP.
read -rsp 'Remote DB URI: ' REMOTE_DB_URL; echo

psql "$REMOTE_DB_URL" -tA -c "copy (select id, cpf, date_of_birth, phone from public.profiles) to stdout with (format csv, header)" | gpg --symmetric --cipher-algo AES256 --output "$HOME/ae3-preimage.csv.gpg"
```

⭐ **AN ACCIDENTAL FAILSAFE, RECORDED SO IT IS KEPT DELIBERATELY** (QA r3): after AE3, aiming this
snapshot at the *local* stack fails **loudly** with `42703 column "cpf" does not exist`, because
local `profiles` no longer has the column. That is a second, independent guard against B5's
wrong-database defect — ⚠ but it holds only while the local stack is post-AE3, so it is a
backstop, never the reason the guard above can be skipped.

**The gpg passphrase** is a maintenance-window secret with the same lifetime as the artifact: it
is chosen at step 2.3, held only by the operator running the window, never written into the
runbook, a ticket, or the deploy log — and it dies with the artifact at step 6. If the artifact
outlives the window, the passphrase is the reason it is still readable, so destroying one without
the other discharges nothing.

⛔ **After the window closes: ROTATE THE DATABASE PASSWORD.** It was typed on a workstation during
an incident-shaped procedure; treat it as exposed rather than reasoning about whether it was.

⚠ **WHY THE COMMAND AND NOT THE PROSE CARRIES THIS.** The first version of this runbook wrote
the CSV in the clear and put "encrypt at creation" in a paragraph underneath — which makes the
safe path the one the operator has to *remember*, under maintenance-window pressure, at the one
moment they are least able to. QA finding **B2**. A rule a command contradicts is not a rule.

⚠ **The artifact is restricted personal data** (CPF, date of birth, phone) for every person on
the platform. It is written **outside the repo** (`$HOME`, never the working directory, where a
stray `git add -A` would stage it), stored off the app host, and **destroyed** once the window
closes and the deploy is confirmed — with the destruction recorded the way
`phi-backup-run-log.md` does. Do not paste it into a chat, a ticket, or a build log.

⚠ **Verify the artifact before trusting it as a rollback path** — an encrypted file that does
not decrypt is not a backup, and one taken from the wrong database is worse than none. Both
numbers must match, and the second is read from the **remote**:

```bash
gpg --decrypt "$HOME/ae3-preimage.csv.gpg" | tail -n +2 | wc -l
psql "$REMOTE_DB_URL" -tA -c "select count(*) from public.profiles"
```

⛔ **Counts, never rows.** An earlier version printed `head -2`, which renders **a real person's
CPF, date of birth and phone to the terminal** — into scrollback, and into any transcript or
screen-share of the maintenance window. A row count proves the pipeline decrypts *and* binds the
artifact to the database it was supposed to come from; a printed row proves the same thing while
disclosing exactly what the artifact exists to protect.

### 4.2 Roll FORWARD (preferred)

Fix the build and redeploy. The schema is already correct; nothing in the database needs undoing.
This is the right answer for every failure whose cause is the application.

### 4.3 Roll BACK (only if the schema itself is wrong)

Reversing `006800` means re-adding three columns and copying values back — the data has not been
destroyed, it moved:

```sql
alter table public.profiles add column cpf text;
alter table public.profiles add column date_of_birth date;
alter table public.profiles add column phone text;

update public.profiles p
   set cpf = d.cpf, date_of_birth = d.date_of_birth, phone = d.phone
  from public.profile_private_details d
 where d.profile_id = p.id;

-- ⛔ THE CONSTRAINTS AND THE GRANT POSTURE DO NOT COME BACK ON THEIR OWN, and this is the
-- half a rollback forgets. Without them `profiles` carries the three columns with NO CHECK,
-- NO unique index, and -- because AE3 left the per-column grants alone -- no grant either,
-- which is safe but makes them unreadable to the old build too. Restore all three:
alter table public.profiles
  add constraint profiles_cpf_valid check (cpf is null or app.is_valid_cpf(cpf));
create unique index profiles_cpf_key on public.profiles using btree (cpf) where (cpf is not null);
-- ... and re-add the three columns to guard_profile_privileged_columns' identity arm
-- (see 20261003006700 for the pre-AE3 body; take it from the catalog, not the file).
```

⚠ **Verify the copy-back the same way the forward migration verified itself** — keyed per-row
`IS NOT DISTINCT FROM`, not a row count. A count matches under a value swap.

⛔ **Do not `git revert` the migration files and re-push.** Editing or removing an applied
migration creates the drift that blocks every future `db push` (restore, don't repair).

## 5. What AE3 deliberately did NOT change

Stated so a reviewer does not go looking:

- **`professional_profiles.cpf` is untouched** — a second, independently-governed CPF column
  (Class-2 professional identity, ADR 0064/0065). After AE3, *"CPF lives in one place"* is still
  **false**.
- **The per-column grants on `profiles` were left in place**, now with nothing withheld. Left
  deliberately: collapsing them into one table-level grant would auto-publish every **future**
  column of `profiles`, which is a widening nobody asked for. pgTAP `301` § 0.10a pins the
  retirement; `0.10b` pins the successor tripwire.
- **No authorization decision moved.** `can_administer_person_for`'s `fields` / `cpf_change`
  arms, `list_org_people`'s inline D10 gate, and the `person.cpf_lookup` audit semantics are
  byte-identical.
