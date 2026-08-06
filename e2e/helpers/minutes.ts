import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import type { Page } from "@playwright/test";

import { signCallbackBody } from "@/lib/audio-jobs/hmac";
import type { CallbackPayload, MeetingMinutesResult } from "@/lib/audio-jobs/types";

/**
 * Shared scaffolding for `meeting-audio-minutes.spec.ts` (ADR 0099, MIN plan T3).
 *
 * D16's "testing seam" — the spec drives the platform through the UI and then POSTs a
 * realistic SIGNED callback to the webhook — implicitly needs something listening at
 * `MINUTES_SERVICE_URL` too: `submitMinutesJob` calls out to the real service
 * SYNCHRONOUSLY before a job can ever reach `processing`, and with nothing configured
 * the client fails closed (`not_configured`). `startStubAudioService`/
 * `stopStubAudioService` below are that "something" — a tiny in-process HTTP stub, never
 * imported by app code, that only ever answers `POST /jobs` (202) and
 * `POST /jobs/:id/cancel` (202). `.env.local`'s `MINUTES_SERVICE_URL` points at it
 * (`tester` provisioned all three MIN env vars locally — see PROGRESS.md MIN row; none
 * were set before this spec).
 *
 * Local Supabase stack only; the `sql`/service-role REST helpers are fixture/flag/DB-truth
 * scaffolding ONLY — every mutation under test goes through the real UI or the signed
 * webhook, never a direct table write.
 */

export { cachedSignIn as signInAs } from "./auth";

export const SUPABASE_URL = "http://127.0.0.1:54321";
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).",
  );
}

const CALLBACK_SECRET = process.env.MINUTES_CALLBACK_HMAC_SECRET ?? "";
if (!CALLBACK_SECRET) {
  throw new Error(
    "MINUTES_CALLBACK_HMAC_SECRET ausente — defina-o em .env.local (tester provisionou o valor local; ver PROGRESS.md MIN).",
  );
}

const DB_CONTAINER = "supabase_db_azkbbhskturikxpgmafq";

export const COMM_CCIH_ID = "a0000000-0000-0000-0000-0000000000a1";
export const CHEFE_CCIH_ID = "00000000-0000-0000-0000-000000000002";
export const STAFF1_CCIH_ID = "00000000-0000-0000-0000-000000000003";
export const ORG_SLUG = "rede-a";
export const COMMISSION_SLUG = "ccih";

// ---------------------------------------------------------------------------
// DB-truth / fixture scaffolding (mirrors e2e/helpers/documents.ts's `sql`)
// ---------------------------------------------------------------------------

/** Run SQL as postgres via docker exec — flag scaffold ONLY (never data under test). */
export function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"');
  return execSync(`docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`, {
    encoding: "utf8",
  })
    .toString()
    .trim();
}

/** Flip `audio_minutes` (app.feature_flags has no PostgREST exposure). Seed ships it ON. */
export function setAudioMinutesFlag(enabled: boolean): void {
  sql(`update app.feature_flags set enabled = ${enabled} where key = 'audio_minutes';`);
}

/**
 * ⚠ `boolean::text` casts to the SQL-standard `'true'`/`'false'` words, NOT the `'t'`/`'f'`
 * abbreviation psql prints for a raw (uncast) boolean column — confirmed empirically
 * (`select true::text` → `true`). A `=== 't'` check here silently read `false` on every
 * call regardless of the real row value, which corrupted T3 #5's restore: `wasEnabled`
 * was always captured as `false`, so the `finally`'s "restore" re-applied `false` and the
 * flag stayed OFF for every test after #5 — a real bug this suite's own T3 #9 (seed
 * survival) would otherwise have caught by coincidence, not by design.
 */
export function readAudioMinutesFlag(): boolean {
  return sql(`select enabled::text from app.feature_flags where key = 'audio_minutes';`) === "true";
}

// ---------------------------------------------------------------------------
// Auth / RPC plumbing (mirrors e2e/meeting-held-time.spec.ts)
// ---------------------------------------------------------------------------

export async function getOwnerToken(page: Page, email: string, password = "Test1234!"): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, "Content-Type": "application/json" },
    data: { email, password },
  });
  if (!resp.ok()) throw new Error(`token for ${email}: ${resp.status()} ${await resp.text()}`);
  return ((await resp.json()) as { access_token: string }).access_token;
}

export async function callRPC(
  page: Page,
  token: string,
  rpcName: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    data: body,
  });
  const text = await resp.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: resp.status(), body: parsed };
}

export async function firstMeetingTypeId(page: Page): Promise<string> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/commission_meeting_types?commission_id=eq.${COMM_CCIH_ID}&archived=eq.false&limit=1`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  const types = (await resp.json()) as Array<{ id: string }>;
  if (types.length === 0) throw new Error("no active meeting type for CCIH");
  return types[0].id;
}

/** Create a `held` meeting (via `create_meeting` then `mark_meeting_held`). Returns its id. */
export async function createHeldMeeting(
  page: Page,
  token: string,
  opts: { title: string },
): Promise<string> {
  const typeId = await firstMeetingTypeId(page);
  const scheduledStart = new Date(Date.now() - 2 * 24 * 3600_000);
  const created = await callRPC(page, token, "create_meeting", {
    p_commission_id: COMM_CCIH_ID,
    p_meeting_type_id: typeId,
    p_title: opts.title,
    p_scheduled_start: scheduledStart.toISOString(),
    p_modality: "presencial",
  });
  if (created.status !== 200) {
    throw new Error(`create_meeting failed: ${created.status} ${JSON.stringify(created.body)}`);
  }
  const meetingId = (created.body as { id: string }).id;

  const held = await callRPC(page, token, "mark_meeting_held", {
    p_meeting_id: meetingId,
    p_held_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
  });
  if (held.status !== 200) {
    throw new Error(`mark_meeting_held failed: ${held.status} ${JSON.stringify(held.body)}`);
  }
  return meetingId;
}

/** Add an attendee (present) and return the `meeting_attendees.id` row — the service's `ref`. */
export async function addAttendee(
  page: Page,
  token: string,
  meetingId: string,
  userId: string,
  role: "presidente" | "membro" = "membro",
): Promise<string> {
  const added = await callRPC(page, token, "add_meeting_attendee", {
    p_meeting_id: meetingId,
    p_user_id: userId,
    p_role: role,
    p_attendance: "present",
  });
  if (added.status !== 200) {
    throw new Error(`add_meeting_attendee failed: ${added.status} ${JSON.stringify(added.body)}`);
  }
  const row = await page.request.get(
    `${SUPABASE_URL}/rest/v1/meeting_attendees?meeting_id=eq.${meetingId}&user_id=eq.${userId}&select=id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  const attendees = (await row.json()) as Array<{ id: string }>;
  if (attendees.length === 0) throw new Error("attendee row not found after add_meeting_attendee");
  return attendees[0].id;
}

/**
 * Add a live agenda item (via `create_meeting_agenda_item`) and return its id — a valid
 * `ref`. The RPC's `prorettype` is a bare `uuid` (verified against the catalog, not
 * assumed as a row) — PostgREST hands that back as the JSON-encoded scalar itself, NOT
 * `{id: uuid}`.
 */
export async function addAgendaItem(page: Page, token: string, meetingId: string, title: string): Promise<string> {
  const created = await callRPC(page, token, "create_meeting_agenda_item", {
    p_meeting_id: meetingId,
    p_title: title,
  });
  if (created.status !== 200) {
    throw new Error(`create_meeting_agenda_item failed: ${created.status} ${JSON.stringify(created.body)}`);
  }
  const id = created.body as string;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`create_meeting_agenda_item returned an unexpected shape: ${JSON.stringify(created.body)}`);
  }
  return id;
}

// ---------------------------------------------------------------------------
// DB-truth reads (service-role — bypasses RLS on purpose, for assertions only)
// ---------------------------------------------------------------------------

export interface JobRow {
  id: string;
  meeting_id: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  audio_path: string | null;
  audio_deleted_at: string | null;
  service_job_id: string | null;
  result: unknown;
  draft: unknown;
  transcript: string | null;
  applied_at: string | null;
  cancelled_at: string | null;
  purged_at: string | null;
  created_at: string;
}

export async function getJobRow(page: Page, jobId: string): Promise<JobRow | null> {
  const cols =
    "id,meeting_id,status,error_code,error_message,audio_path,audio_deleted_at,service_job_id,result,draft,transcript,applied_at,cancelled_at,purged_at,created_at";
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/meeting_minutes_jobs?id=eq.${jobId}&select=${cols}`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  const rows = (await resp.json()) as JobRow[];
  return rows.length > 0 ? rows[0] : null;
}

/** Poll `getJobRow` until `status` matches one of `statuses`, or throw after `timeoutMs`. */
export async function waitForJobStatus(
  page: Page,
  jobId: string,
  statuses: readonly string[],
  timeoutMs = 15_000,
): Promise<JobRow> {
  const start = Date.now();
  for (;;) {
    const row = await getJobRow(page, jobId);
    if (row && statuses.includes(row.status)) return row;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `job ${jobId} did not reach [${statuses.join(",")}] within ${timeoutMs}ms (last: ${row?.status ?? "missing"})`,
      );
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Most recent job row for a meeting (mirrors `getActiveMinutesJob`'s ordering, unfiltered). */
export async function getLatestJobForMeeting(page: Page, meetingId: string): Promise<JobRow | null> {
  const cols =
    "id,meeting_id,status,error_code,error_message,audio_path,audio_deleted_at,service_job_id,result,draft,transcript,applied_at,cancelled_at,purged_at,created_at";
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/meeting_minutes_jobs?meeting_id=eq.${meetingId}&select=${cols}&order=created_at.desc&limit=1`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  const rows = (await resp.json()) as JobRow[];
  return rows.length > 0 ? rows[0] : null;
}

export async function getMeetingRow(
  page: Page,
  meetingId: string,
): Promise<{ id: string; status: string; minutes_md: string | null } | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/meetings?id=eq.${meetingId}&select=id,status,minutes_md`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  const rows = (await resp.json()) as Array<{ id: string; status: string; minutes_md: string | null }>;
  return rows.length > 0 ? rows[0] : null;
}

export async function getAgendaItemsByMeeting(
  page: Page,
  meetingId: string,
): Promise<Array<{ id: string; title: string; discussion_notes: string | null; resolution: string | null }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/meeting_agenda_items?meeting_id=eq.${meetingId}&select=id,title,discussion_notes,resolution&order=position.asc`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  return (await resp.json()) as Array<{
    id: string;
    title: string;
    discussion_notes: string | null;
    resolution: string | null;
  }>;
}

export async function getActionItemsByMeeting(
  page: Page,
  meetingId: string,
): Promise<Array<{ id: string; title: string; assigned_to: string | null }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/action_items?source_meeting_id=eq.${meetingId}&select=id,title,assigned_to`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  return (await resp.json()) as Array<{ id: string; title: string; assigned_to: string | null }>;
}

/** Storage object listing under a prefix (private bucket — service-role only). */
export async function listStorageObjects(page: Page, prefix: string): Promise<Array<{ name: string }>> {
  const resp = await page.request.post(`${SUPABASE_URL}/storage/v1/object/list/meeting-audio`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    data: { prefix, limit: 100 },
  });
  if (!resp.ok()) return [];
  return (await resp.json()) as Array<{ name: string }>;
}

/** Delete a meeting BY IDENTITY (cascades jobs/agenda/attendees/action_items — B0 §6). */
export async function deleteMeeting(page: Page, meetingId: string): Promise<void> {
  await page.request.delete(`${SUPABASE_URL}/rest/v1/meetings?id=eq.${meetingId}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=minimal",
    },
    // Bounded so a genuinely stuck delete (e.g. a lock held by an unrelated in-flight
    // transaction) fails with its OWN clear "Timeout Xms exceeded" instead of silently
    // consuming the rest of the outer test.setTimeout budget with no diagnostic value.
    timeout: 15_000,
  });
}

export async function meetingExists(page: Page, meetingId: string): Promise<boolean> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/meetings?id=eq.${meetingId}&select=id`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  const rows = (await resp.json()) as Array<{ id: string }>;
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Stub audio service (D16's implied "something listening at MINUTES_SERVICE_URL")
// ---------------------------------------------------------------------------

export const STUB_SERVICE_PORT = 8891;

let stubServer: Server | null = null;
/** service_job_id -> the AudioJobRequest body the app POSTed. For inspection only. */
export const stubSubmittedJobs = new Map<string, unknown>();
export const stubCancelledJobIds = new Set<string>();

export function startStubAudioService(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (stubServer) return resolve();
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const url = req.url ?? "";
        if (req.method === "POST" && url === "/jobs") {
          const serviceJobId = randomUUID();
          try {
            stubSubmittedJobs.set(serviceJobId, JSON.parse(body));
          } catch {
            // malformed body from the app would be an app bug; still ack so the
            // spec's assertion (not this stub) is what fails.
          }
          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ job_id: serviceJobId, status: "queued" }));
          return;
        }
        const cancelMatch = /^\/jobs\/([^/]+)\/cancel$/.exec(url);
        if (req.method === "POST" && cancelMatch) {
          stubCancelledJobIds.add(cancelMatch[1]);
          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ job_id: cancelMatch[1], status: null }));
          return;
        }
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not_found" }));
      });
    });
    server.on("error", reject);
    server.listen(STUB_SERVICE_PORT, "127.0.0.1", () => {
      stubServer = server;
      resolve();
    });
  });
}

export function stopStubAudioService(): Promise<void> {
  return new Promise((resolve) => {
    if (!stubServer) return resolve();
    stubServer.close(() => {
      stubServer = null;
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Signed callback fixtures (D16) — adapted from minute_generator's
// tests/fixtures/callback_v2_{meeting_minutes,error}.json, with `metadata` corrected
// to the platform's OWN contract ({platform_job_id, job_type} — the fixtures' raw
// `meeting_id`/`generation_id` keys are the SERVICE's internal echo shape, not what
// `parseAudioJobMetadata` reads; see src/lib/audio-jobs/metadata.ts).
// ---------------------------------------------------------------------------

export interface DoneCallbackRefs {
  jobId: string;
  matchedAgendaRef: string;
  strikeAgendaRef: string;
  ownerAttendeeRef: string;
}

export function buildDoneCallback(refs: DoneCallbackRefs): CallbackPayload {
  const result: MeetingMinutesResult = {
    minutes: {
      committee: "Comissão de Controle de Infecção Hospitalar",
      attendees: [{ ref: refs.ownerAttendeeRef, spoke: true, confidence: 0.9, evidence: "presente" }],
      unidentified_speakers: [{ label: "SPEAKER_02", utterances: 1 }],
      agenda_items: [
        {
          ref: refs.matchedAgendaRef,
          title: "Item existente — mantido",
          discussion: "Discussão extraída do áudio para o item existente.",
        },
        {
          ref: refs.strikeAgendaRef,
          title: "Item existente — será excluído na revisão",
          discussion: "Este texto não deve ser aplicado — o item é excluído na revisão E2E.",
        },
        {
          ref: null,
          title: "Item novo levantado na reunião",
          discussion: "Discussão de um assunto trazido fora da pauta original.",
        },
      ],
      resolutions: [
        { text: "Resolução aprovada para o item existente.", agenda_item_index: 0 },
        { text: "Decisão sem item de pauta associado.", agenda_item_index: null },
      ],
      action_items: [
        {
          title: "Ação com responsável identificado",
          description: "Descrição da ação um.",
          owner_ref: refs.ownerAttendeeRef,
          owner_text: "Responsável indicado em áudio",
          due_date: "2026-09-15",
          deadline_text: null,
        },
        {
          title: "Ação sem responsável identificado",
          description: null,
          owner_ref: null,
          owner_text: "alguém do setor de qualidade",
          due_date: null,
          deadline_text: "assim que possível",
        },
      ],
      next_meeting: {
        starts_at: "2026-09-20T14:00:00",
        location_text: "Sala de reuniões da CCIH",
        raw: "Ficamos para o dia 20 de setembro, às 14h.",
      },
      summary: "Resumo de teste E2E.",
      minutes_md:
        "# Ata gerada por áudio (E2E)\n\nConteúdo de teste gerado para a suíte automatizada.",
    },
    transcript: "[0000.00] Falante: transcrição de teste E2E.",
  };

  return {
    schema_version: "2.1",
    job_id: refs.jobId,
    job_type: "meeting_minutes",
    status: "done",
    metadata: { platform_job_id: refs.jobId, job_type: "meeting_minutes" },
    audio_release: true,
    result,
    metrics: null,
    error: null,
    error_code: null,
  };
}

export function buildErrorCallback(jobId: string): CallbackPayload {
  return {
    schema_version: "2.1",
    job_id: jobId,
    job_type: "meeting_minutes",
    status: "error",
    metadata: { platform_job_id: jobId, job_type: "meeting_minutes" },
    audio_release: true,
    result: null,
    metrics: null,
    error: "audio_url returned 404",
    error_code: "audio_unreachable",
  };
}

/**
 * POST a signed callback to `/api/webhooks/audio-jobs`.
 *
 * Signs the EXACT string sent as the body (byte-exact — hmac.ts's own load-bearing
 * property #2), never a re-serialization of `payload`.
 */
export async function postSignedCallback(
  page: Page,
  payload: unknown,
  opts: { secret?: string; timestamp?: string; signature?: string } = {},
): Promise<{ status: number; body: unknown }> {
  const rawBody = JSON.stringify(payload);
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const signature = opts.signature ?? signCallbackBody(rawBody, timestamp, opts.secret ?? CALLBACK_SECRET);

  const resp = await page.request.post("/api/webhooks/audio-jobs", {
    headers: { "Content-Type": "application/json", "x-signature": signature, "x-timestamp": timestamp },
    data: rawBody,
  });
  const text = await resp.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: resp.status(), body };
}

// ---------------------------------------------------------------------------
// Audio fixture — a tiny, valid WAV (a few hundred bytes; the 500 MB ceiling is
// not the thing under test here, see B1's own separate size-ceiling risk note).
// ---------------------------------------------------------------------------

export function tinyWavBuffer(): Buffer {
  const numSamples = 400;
  const sampleRate = 8000;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buf.writeUInt16LE(bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin(i / 10) * 1000);
    buf.writeInt16LE(sample, 44 + i * 2);
  }
  return buf;
}
