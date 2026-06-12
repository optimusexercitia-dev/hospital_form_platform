# 0012 — clone_form_version returns the existing draft (one draft per form)

Date: 2026-06-12
Status: Accepted
Phase: 4 (Form Builder & Versioning)

## Context

"Editar publicado" clones the current published version into a new draft the
staff_admin can edit, then publish (which archives the prior published version,
M5). If the action simply always created a new draft, repeated clicks — or
re-entering the flow on a form that already has an open draft — would
proliferate `draft` versions for the same form, each with a higher
`version_number`, none of them published. The builder would then have to choose
WHICH draft to open, and abandoned drafts would litter the version history.

`form_versions` already enforces at most one PUBLISHED version per form
(`form_versions_one_published_idx`), but nothing limits the number of drafts.

## Decision

A form has at most one editable draft at a time, enforced procedurally by the
clone RPC rather than by a new constraint. `clone_form_version(source_version_id)`:

1. resolves the source's `form_id`;
2. if a `status = 'draft'` version already exists for that form, **returns its
   id and does nothing else** — the builder routes the user to the existing
   draft;
3. otherwise creates the new draft (`version_number = max + 1`), copies all
   sections + items, and returns the new draft id.

We chose a procedural guard over a partial unique index
(`unique(form_id) where status = 'draft'`) because the desired behaviour is
"hand back the existing draft", not "raise a unique violation" — the RPC can
return the right id, whereas an index could only reject, forcing the caller to
re-query anyway.

## Consequences

- "Editar publicado" is idempotent: clicking it twice lands on the same draft;
  exactly two versions exist (the published/archived original + the one draft).
- The builder never has to disambiguate among multiple drafts.
- The contract is "at most one draft per form"; should a future flow need to
  insert a draft outside this RPC, it must honour the same invariant (or we add
  the partial unique index as a backstop then).
