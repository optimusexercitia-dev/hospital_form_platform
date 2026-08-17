# PDF renderer sidecar (Gotenberg) — dev recipe + production runbook

**Module:** PDF document printing (ADR [0104](../decisions/0104-pdf-document-printing-module.md) D14;
plan [pdf-document-printing.md](../plans/pdf-document-printing.md) §2.7).
**Pinned image: `gotenberg/gotenberg:8.24.0`** — an upgrade is a deliberate
template-regression-test event (rendering may shift; acceptable — the registry
hash pins mint-time bytes and we never re-render for verification), never a
routine bump.

The renderer is an off-the-shelf Chromium container that converts the app's
fully self-contained HTML (fonts, QR, CSS all inline — it fetches nothing) into
PDF bytes. It holds no state, no keys, no data at rest; **the HTML it receives
IS the PHI** (from P3 onward), which is why privacy of the network path is the
load-bearing property.

The app reaches it via **`PDF_RENDERER_URL`** only (server-only env; see
`.env.example`). The mint is synchronous with a 30 s budget and a 3-permit
in-process semaphore (ADR 0104 D5) — Gotenberg's internal queue sits behind
those permits; no job pipeline exists.

## Local dev + E2E

```bash
docker run -d --name gotenberg-pdf -p 3010:3000 gotenberg/gotenberg:8.24.0
# health check:
curl -s -o /dev/null -w "%{http_code}" http://localhost:3010/health   # → 200
```

`.env.local`:

```
PDF_RENDERER_URL=http://localhost:3010
PDF_VERIFICATION_BASE_URL=http://localhost:3000
```

- Port `3010` on the host because `3000` is `next dev`. Container-internal it is
  always `3000`.
- **The E2E gate treats the sidecar as a PRECONDITION, like Supabase itself** —
  `e2e:prod` does not start or stop it. If it is down, mint specs fail with the
  pt-BR "serviço de geração de PDF está indisponível" (nothing is minted —
  all-or-nothing, D5), which is the intended failure shape, not a hang.
- Smoke check of the whole pipeline (mint → hash-match → verify) once the stack
  and the sidecar are up:
  `npx vitest run --config vitest.smoke.config.ts`
  (deliberately OUTSIDE the default Vitest suite — it needs both services.)

## Production (Coolify) — runbook, USER performs the clicks

Per ADR 0104 D14 + ADR 0059 (the MIN deploy-topology precedent — own resource,
same host). The agent does not operate Coolify; hand this list to the operator:

1. **New resource** on the same Coolify server as the app: type *Docker Image*,
   image **`gotenberg/gotenberg:8.24.0`** (the pinned tag verbatim — no
   `latest`, no `8`).
2. **No public domain / no HTTPS route.** The service must be reachable ONLY on
   the internal Docker network (Coolify: skip the FQDN/domain field entirely).
   If the topology cannot guarantee network privacy, add basic-auth via
   Gotenberg's `--api-basic-auth-username/-password` flags at deploy time and
   put the credentials in `PDF_RENDERER_URL` — a deploy concern, not an ADR
   change.
3. **Resource caps** (the OOM-blast-radius rationale: a render OOM must kill
   the renderer cgroup, never the web app): memory limit ~1 GB, CPU limit ~1.
4. **Connect the app**: put the app and the renderer on the same Coolify
   network; set the app's env `PDF_RENDERER_URL=http://<coolify-service-name>:3000`.
5. **Set `PDF_VERIFICATION_BASE_URL`** on the app to the platform's public
   origin (e.g. `https://plataforma.<domain>`), no trailing slash — it is
   printed inside every QR.
6. **Health**: Coolify healthcheck GET `/health` on port 3000.
7. **Upgrading the pin** (rare, deliberate): change the tag, redeploy, then
   re-run the template regression pass (`fingerprint.test.ts` + a visual check
   of one document per kind) before considering the upgrade done. Old
   documents are NOT re-rendered — their bytes are immutable and hash-pinned.

## Operational notes

- **Nothing to back up** — the sidecar is stateless; printed documents live in
  Storage, never deleted (20-yr posture, D15).
  ⚠ **CORRECTED 2026-08-17 (DM5·S4).** This line named the **`printed-documents`
  bucket, which no longer exists** — migration `20260927000400` retired its row
  and its policies. Since DM5·S3 a print's bytes are a `file_objects` row in
  **`documents-standard` / `documents-phi`**, chosen server-side by
  `file_objects_bucket_from_tier` from the print's `contains_phi`. Do not restore
  the old name; **resolve the bucket from the catalog, never from this file** —
  a deployment runbook asserting a dead bucket under a 20-yr retention claim is
  the worst place for a stale noun.
- **Failure mode:** renderer down ⇒ mints fail cleanly in pt-BR, downloads and
  verification KEEP WORKING (they never touch the renderer).
- The renderer receives PHI-bearing HTML from P3 onward: never point
  `PDF_RENDERER_URL` at a shared/public Gotenberg instance.
