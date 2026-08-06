import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  COMM_CCIH_ID,
  CHEFE_CCIH_ID,
  STAFF1_CCIH_ID,
  ORG_SLUG,
  COMMISSION_SLUG,
  signInAs,
  setAudioMinutesFlag,
  readAudioMinutesFlag,
  getOwnerToken,
  callRPC,
  createHeldMeeting,
  addAttendee,
  addAgendaItem,
  getJobRow,
  getLatestJobForMeeting,
  waitForJobStatus,
  getMeetingRow,
  getAgendaItemsByMeeting,
  getActionItemsByMeeting,
  listStorageObjects,
  deleteMeeting,
  meetingExists,
  startStubAudioService,
  stopStubAudioService,
  buildDoneCallback,
  buildErrorCallback,
  postSignedCallback,
  tinyWavBuffer,
} from "./helpers/minutes";

/**
 * MIN — meeting audio → generated ata (ADR 0099). Plan T3, 9 scenarios.
 *
 * Runs against the LOCAL Supabase stack (seeded personas), `workers=1`-safe (declares
 * `mode: 'serial'` below because the stub audio service binds a fixed port per worker —
 * see helpers/minutes.ts). Run `supabase db reset --local` before a full run.
 *
 * D16's testing seam: the spec drives the platform through the real UI, then POSTs a
 * SIGNED callback to `/api/webhooks/audio-jobs` — never talking to a real
 * `minute_generator`. A tiny in-process stub answers the OUTBOUND `POST /jobs` call
 * `submitMinutesJob` makes (see helpers/minutes.ts's own doc comment for why one is
 * needed at all — `.env.local` had NO `MINUTES_SERVICE_URL`/`_API_KEY`/
 * `MINUTES_CALLBACK_HMAC_SECRET` before this spec; `tester` provisioned all three).
 *
 * Each test creates its OWN meeting and deletes it BY IDENTITY when done (never
 * positional) — cascade (B0 §6) takes the job/agenda/attendees/action-items with it.
 * Scenario 9 confirms the cleanup actually held and that seed rows survived the suite.
 */

test.describe.configure({ mode: "serial" });

test.use({ viewport: { width: 1280, height: 950 } });

test.beforeAll(async () => {
  await startStubAudioService();
  // Defensive: test 5 toggles `audio_minutes` off and restores it in a `finally`, but a
  // prior run that crashed mid-test (observed once: a Chromium renderer crash) can skip
  // that restore, leaving the flag OFF for every subsequent invocation — which then reads
  // as "the Usar áudio button never appears" with no useful error (a bare `.click()` with
  // no configured actionTimeout waits forever on an element that will never exist).
  // Self-heal to the seeded baseline rather than let stale cross-run state masquerade as a
  // UI bug.
  setAudioMinutesFlag(true);
});

test.afterAll(async () => {
  await stopStubAudioService();
});

test.beforeEach(async ({ page }) => {
  // Several scenarios drive a real upload + signed callback + a full review/apply pass
  // in one test — comfortably past the 30s default, especially on a dev-mode server's
  // first (uncompiled) hit of each route. 120s matches this repo's convention for
  // similarly heavy specs (e.g. answer-model-v2.spec.ts, case-corrections.spec.ts).
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const deletedMeetingIds: string[] = [];

function meetingHref(meetingId: string): string {
  return `/o/${ORG_SLUG}/c/${COMMISSION_SLUG}/meetings/${meetingId}`;
}
function reviewHref(meetingId: string): string {
  return `${meetingHref(meetingId)}/revisao-ata`;
}

async function goToMeeting(page: Page, meetingId: string): Promise<void> {
  // Bounded generously: the meeting detail page's SSR reads agenda/attendees/cases/
  // signatures/attachments/action-items/closed-sessions/reserved-items/audio-job status
  // (plus coordinator-only member/type/settings/board reads) in one `Promise.all` — on
  // this local stack under test load that has been observed to take up to ~20s.
  await page.goto(meetingHref(meetingId), { timeout: 30_000 });
  await page.waitForURL(`**/meetings/${meetingId}`, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Ata" })).toBeVisible({ timeout: 15_000 });
}

/**
 * Follow a `<Link>`-rendered navigation element by its `href`, rather than clicking it.
 *
 * Observed failure mode (via `DEBUG=pw:api`), reproducible on this local stack: Next's
 * client-side transition can complete SO fast that the anchor detaches from the DOM
 * between Playwright's actionability "stable" check and the actual click dispatch;
 * Playwright then restarts the whole click action from scratch, re-resolving the SAME
 * locator. Two follow-on failure shapes were both seen empirically: (a) the restarted
 * action finds no match post-navigation and burns its entire timeout budget retrying a
 * click that, in every practical sense, already happened, and — worse — (b) a "fire the
 * click without awaiting it, then wait on the URL independently" workaround still lets
 * Playwright's internal retry dispatch a SECOND stray click at the same viewport
 * coordinates, which can land on a different control on the now-navigated page (the
 * meeting page's own "Concluir"/"Cancelar" buttons sit close to where the link was) and
 * silently produce the WRONG final state — observed here as the post-apply banner never
 * appearing because the second click's side effect navigated once more and dropped the
 * `?ata_aplicada=1` query param the first, real navigation had carried. Reading `href`
 * and navigating directly sidesteps the whole click/detach/retry category: it is a single,
 * unambiguous browser navigation with no room for a duplicate side effect.
 */
async function followLink(page: Page, link: Locator, timeout = 30_000): Promise<void> {
  const href = await link.getAttribute("href");
  if (!href) throw new Error("followLink: locator resolved but carries no href");
  await page.goto(href, { timeout });
}

/**
 * Click "Usar áudio", guarded.
 *
 * A bare `.click()` on a locator that never matches waits FOREVER on this repo's
 * `playwright.config.ts` (no `actionTimeout` configured anywhere, and Playwright's own
 * default is 0 = unbounded) — an intermittent render delay right after a fresh
 * navigation/reload then reads as a mystery hang attributed to whatever unrelated line
 * happens to be executing when the outer `test.setTimeout` finally fires, not to the
 * click that actually never resolved. Every call site in this file goes through this
 * helper instead, so a genuine miss fails FAST with a clear locator error.
 */
async function clickUsarAudio(page: Page): Promise<void> {
  const btn = page.getByRole("button", { name: "Usar áudio" });
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click({ timeout: 10_000 });
}

/**
 * Click `trigger` and verify `aria-expanded` reaches `expected`, retrying the click a
 * few times if it doesn't.
 *
 * Observed empirically: `transcript-panel.tsx`'s disclosure toggle occasionally does not
 * register a `.click()` — reproducible specifically when this spec file's total DECLARED
 * test count crosses a threshold (7 passes reliably every time, 8+ reproduces the miss on
 * every run; verified by bisection), even though the failing click is always in
 * scenario 1, which runs first and unconditionally in serial mode — nothing from a later
 * test's own execution has run yet. That rules out shared browser/DB state as the cause,
 * and points at something in this sandbox's Node/V8/Chromium resource scheduling tied to
 * how much test-file code got parsed at load time, not at anything this suite mutates.
 * Root cause not pinned down further; this keeps the suite green without either weakening
 * the assertion (still requires the real state transition) or trusting an un-verified click.
 */
async function clickAndVerifyExpanded(trigger: Locator, expected: "true" | "false"): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await trigger.click({ timeout: 10_000 });
    try {
      await expect(trigger).toHaveAttribute("aria-expanded", expected, { timeout: 3_000 });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
    }
  }
}

/** Drives the F2 dialog through file select + submit; asserts it closes (job reaches `processing`). */
async function uploadAudioAndSubmit(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: /Gerar ata a partir do áudio/i });
  await expect(dialog).toBeVisible({ timeout: 8_000 });
  await dialog.getByRole("button", { name: "Continuar" }).click();

  // N1 (QA a11y batch, cba04fd): a real <label htmlFor> now associates this input —
  // `getByLabel` only resolves through a genuine label/aria association, so every call
  // site through this shared helper re-proves the fix, not just scenario 1's dedicated check.
  const fileInput = dialog.getByLabel("Arquivo de áudio");
  await fileInput.setInputFiles({ name: "reuniao-e2e.wav", mimeType: "audio/wav", buffer: tinyWavBuffer() });
  await dialog.getByRole("button", { name: "Enviar e gerar ata" }).click();

  await expect(dialog).not.toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 1 — Happy path (incl. zero-attendee block + transcript audited door)
// ---------------------------------------------------------------------------

test("1 — happy path: upload → done callback → review edits → Concluir → meeting + action items updated, job terminal", async ({
  page,
}) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — happy path" });

  try {
    // --- Zero-attendee block (F2 step 1, D1/D13) ---
    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    const dialog = page.getByRole("dialog", { name: /Gerar ata a partir do áudio/i });
    await expect(dialog).toBeVisible({ timeout: 8_000 });
    await expect(dialog.getByText("Adicione ao menos um participante antes de gerar a ata por áudio.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // --- Seed the fixtures under test: attendees + 2 LIVE agenda items ---
    const chefeAttendeeRef = await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");
    await addAttendee(page, token, meetingId, STAFF1_CCIH_ID, "membro");
    const matchedRef = await addAgendaItem(page, token, meetingId, "Item existente — mantido");
    const strikeRef = await addAgendaItem(page, token, meetingId, "Item existente — será excluído na revisão");

    // --- Upload + submit (F2), with the N1/N2 a11y checks (QA batch cba04fd) live ---
    await page.reload();
    await clickUsarAudio(page);
    const uploadDialog = page.getByRole("dialog", { name: /Gerar ata a partir do áudio/i });
    await expect(uploadDialog).toBeVisible({ timeout: 8_000 });
    await uploadDialog.getByRole("button", { name: "Continuar" }).click();

    // N1: the file input now has a REAL associated <label> (was an unassociated <span>
    // with no `for`/`aria-label`) — `getByLabel` only resolves through a genuine
    // label/htmlFor, aria-labelledby, or aria-label association, so this line itself is
    // the proof the fix landed.
    const fileInput = uploadDialog.getByLabel("Arquivo de áudio");
    await fileInput.setInputFiles({ name: "reuniao-e2e.wav", mimeType: "audio/wav", buffer: tinyWavBuffer() });

    // N2: delay the signed-upload PUT just long enough to observe the progress UI mid-
    // flight — the fixture is a few hundred bytes and would otherwise finish before any
    // assertion below could run.
    // The browser sends a CORS preflight OPTIONS ahead of the real PUT (PUT itself is
    // never a CORS-simple method) — both match this pattern, so only delay the PUT, pass
    // everything else straight through, and never delay more than once even if the
    // network layer retries.
    const uploadUrlPattern = "**/storage/v1/object/upload/sign/meeting-audio/**";
    let delayedOnce = false;
    await page.route(uploadUrlPattern, async (route) => {
      const isFirstPut = !delayedOnce && route.request().method() === "PUT";
      if (isFirstPut) {
        delayedOnce = true;
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      // The delayed PUT can race a browser-level retry/redirect that resolves the same
      // logical request out from under this handler ("Route is already handled") —
      // harmless here since the assertions below depend on the UI state the delay
      // bought, not on this call itself succeeding.
      await route.continue().catch(() => {});
    });
    await uploadDialog.getByRole("button", { name: "Enviar e gerar ata" }).click();

    const progressbar = uploadDialog.getByRole("progressbar", { name: "Progresso do envio" });
    await expect(progressbar).toBeVisible({ timeout: 5_000 });
    await expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    await expect(progressbar).toHaveAttribute("aria-valuemax", "100");
    // The percentage itself lives OUTSIDE any live region (a continuous stream would
    // otherwise hit a screen reader on every `onprogress` tick, on a 500 MB upload many
    // times a second) — only the PHASE text sits inside `role="status" aria-live="polite"`.
    await expect(uploadDialog.getByRole("status")).toContainText("Enviando");
    await page.unroute(uploadUrlPattern);

    await expect(uploadDialog).not.toBeVisible({ timeout: 30_000 });

    // Chip reflects `processing` immediately (dialog only closes after submitMinutesJob succeeds).
    await expect(page.getByText("Processando áudio…")).toBeVisible({ timeout: 10_000 });

    const job = await getLatestJobForMeeting(page, meetingId);
    expect(job).not.toBeNull();
    const jobId = job!.id;
    expect(job!.status).toBe("processing");
    expect(job!.service_job_id).toBeTruthy();

    // Bonus — the column-grant gap (transcript unreachable except via the audited door,
    // D8/D15) holds through the E2E layer too: a direct authenticated REST select naming
    // `transcript` must be refused, never silently null.
    const directTranscript = await page.request.get(
      `${SUPABASE_URL}/rest/v1/meeting_minutes_jobs?id=eq.${jobId}&select=id,transcript`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` } },
    );
    expect(directTranscript.ok()).toBe(false);

    // --- The signed done-callback (D16) ---
    const callback = buildDoneCallback({
      jobId,
      matchedAgendaRef: matchedRef,
      strikeAgendaRef: strikeRef,
      ownerAttendeeRef: chefeAttendeeRef,
    });
    const posted = await postSignedCallback(page, callback);
    expect(posted.status).toBe(200);

    await waitForJobStatus(page, jobId, ["done"]);

    // audio_release=true on the fixture — the object is deleted right on completion,
    // not waiting for apply/cancel.
    const afterDone = await listStorageObjects(page, `${meetingId}/${jobId}`);
    expect(afterDone.length).toBe(0);

    // --- Notification + "Revisar ata gerada" ---
    await page.reload();
    const reviewLink = page.getByRole("link", { name: "Revisar ata gerada" });
    await expect(reviewLink).toBeVisible({ timeout: 10_000 });
    await followLink(page, reviewLink);
    await expect(page.getByRole("heading", { name: "Revisão da ata" })).toBeVisible({ timeout: 30_000 });

    // --- Transcript audited door: first expand fetches + logs exactly once ---
    // I6 (QA a11y batch, cba04fd): the trigger's `aria-controls` target is now always
    // mounted (`hidden`, not conditional) — assert the STATE transition explicitly via
    // `aria-expanded` rather than trusting a bare `.click()` fired, since a disclosure
    // whose body is always in the DOM gives no other feedback that the toggle registered.
    const transcriptTrigger = page.getByRole("button", { name: "Transcrição completa" });
    await expect(transcriptTrigger).toBeVisible({ timeout: 10_000 });
    await expect(transcriptTrigger).toHaveAttribute("aria-expanded", "false");
    await clickAndVerifyExpanded(transcriptTrigger, "true");
    await expect(page.getByText(/transcrição de teste E2E/i)).toBeVisible({ timeout: 10_000 });
    const auditRows = await page.request.get(
      `${SUPABASE_URL}/rest/v1/audit_log?entity_id=eq.${jobId}&action=eq.minutes_transcript.read&select=id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    );
    const auditBody = (await auditRows.json()) as unknown[];
    expect(auditBody.length).toBe(1);
    // Collapsing and re-expanding must NOT log a second row (the `useRef` latch).
    await clickAndVerifyExpanded(transcriptTrigger, "false");
    await clickAndVerifyExpanded(transcriptTrigger, "true");
    const auditRowsAfter = await page.request.get(
      `${SUPABASE_URL}/rest/v1/audit_log?entity_id=eq.${jobId}&action=eq.minutes_transcript.read&select=id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    );
    expect(((await auditRowsAfter.json()) as unknown[]).length).toBe(1);

    // --- Edit: ata text, strike one agenda item, fix one action owner ---
    const ataTextarea = page.locator("#revisao-ata-minutes-md");
    await ataTextarea.fill("# Ata revisada manualmente\n\nTexto final após revisão E2E.");

    // NOTE: an agenda card's title renders as plain text ONLY when matched (`ref` set);
    // an action item's title is ALWAYS an `<input value=…>` (actions-review.tsx has no
    // matched/new distinction) — an input's value is never part of `textContent`, so
    // `.filter({ hasText })` cannot see it. Anchor on each row's own unique aria-labelled
    // field instead (`Discussão — <title>` / `Descrição — <title>`), which Playwright's
    // `:has()` resolves via the accessible name, not textContent.
    const strikeCard = page.locator(
      'li:has(textarea[aria-label="Discussão — Item existente — será excluído na revisão"])',
    );
    await expect(strikeCard).toBeVisible();
    // I6 fix (QA a11y batch, cba04fd): the include checkbox keeps a STABLE accessible
    // name ("Incluir na ata") across toggle — state is conveyed by `aria-checked` alone,
    // not by renaming the label (which would announce as a different control each time).
    const strikeCheckbox = strikeCard.getByRole("checkbox", { name: "Incluir na ata" });
    await expect(strikeCheckbox).toBeChecked();
    await strikeCheckbox.click();
    await expect(strikeCheckbox).not.toBeChecked();
    // Name unchanged post-toggle — this is the property the fix exists to guarantee.
    await expect(strikeCard.getByRole("checkbox", { name: "Incluir na ata" })).toBeVisible();

    const unresolvedAction = page.locator(
      'li:has(textarea[aria-label="Descrição — Ação sem responsável identificado"])',
    );
    await expect(unresolvedAction).toBeVisible();
    await unresolvedAction.getByRole("combobox", { name: "Responsável" }).selectOption({ label: "Enfermeiro CCIH Um" });

    // N4 (QA a11y batch, cba04fd): the deadline picker announces "Prazo — <title>" per
    // row — previously every row's trigger announced only "Selecionar data", identical
    // across every action item.
    await expect(
      page.getByRole("button", { name: "Prazo — Ação com responsável identificado" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Prazo — Ação sem responsável identificado" }),
    ).toBeVisible();

    // N3 (QA a11y batch, cba04fd): every loose-resolution "attach" button carries a
    // DISTINCT accessible name (previously every one announced the identical "Anexar a
    // um item", N times, indistinguishable to a screen reader). The fixture's one loose
    // resolution ("Decisão sem item de pauta associado." — agenda_item_index: null)
    // renders an attach affordance on all three agenda cards.
    const attachButtonName = "Anexar: Decisão sem item de pauta associado.";
    await expect(page.getByRole("button", { name: attachButtonName })).toHaveCount(3);
    // Exercise it too: attaching folds the resolution into the target card and removes
    // the shared pool, so the affordance disappears everywhere at once.
    const newItemCard = page.locator(
      'li:has(textarea[aria-label="Discussão — Item novo levantado na reunião"])',
    );
    await newItemCard.getByRole("button", { name: attachButtonName }).click();
    await expect(page.getByRole("button", { name: attachButtonName })).toHaveCount(0);
    await expect(page.getByText("Decisões sem item de pauta associado")).toHaveCount(0);

    // Autosave indicator settles before Concluir.
    await expect(page.getByText("Salvo")).toBeVisible({ timeout: 10_000 });

    // --- Concluir revisão ---
    await page.getByRole("button", { name: "Concluir revisão" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Concluir a revisão da ata?" });
    await expect(confirm).toBeVisible({ timeout: 5_000 });
    await confirm.getByRole("button", { name: "Concluir", exact: true }).click();

    await expect(page.getByText("Ata aplicada com sucesso.")).toBeVisible({ timeout: 15_000 });
    // 1 updated + 1 created (the struck item is skipped entirely).
    await expect(page.getByText(/2 itens de pauta · 2 itens de ação/)).toBeVisible();

    await followLink(page, page.getByRole("link", { name: "Voltar à reunião" }));
    // The meeting page's own SSR — the same slow `Promise.all` noted on `goToMeeting` —
    // has to resolve before the banner (or anything else on the page) actually paints.
    await expect(page.getByText("Ata aplicada com sucesso.")).toBeVisible({ timeout: 30_000 });
    // The banner strips its own query param (never resurrects on refresh).
    await expect.poll(() => new URL(page.url()).searchParams.has("ata_aplicada"), { timeout: 10_000 }).toBe(false);

    // --- DB truth ---
    const meetingRow = await getMeetingRow(page, meetingId);
    expect(meetingRow?.minutes_md).toBe("# Ata revisada manualmente\n\nTexto final após revisão E2E.");

    const agendaRows = await getAgendaItemsByMeeting(page, meetingId);
    const kept = agendaRows.find((r) => r.id === matchedRef);
    const struck = agendaRows.find((r) => r.id === strikeRef);
    const created = agendaRows.find((r) => r.title === "Item novo levantado na reunião");
    expect(kept?.discussion_notes).toBe("Discussão extraída do áudio para o item existente.");
    expect(kept?.resolution).toBe("Resolução aprovada para o item existente.");
    // Struck item was skipped by apply — untouched (still whatever it was seeded as).
    expect(struck?.discussion_notes ?? null).toBeNull();
    expect(created).toBeTruthy();
    expect(created?.discussion_notes).toBe("Discussão de um assunto trazido fora da pauta original.");
    // The N3-attached loose resolution persisted through apply onto the item it was
    // folded into (proves the attach UI, not just its accessible name).
    expect(created?.resolution).toBe("Decisão sem item de pauta associado.");

    const actionRows = await getActionItemsByMeeting(page, meetingId);
    expect(actionRows.length).toBe(2);
    const autoAssigned = actionRows.find((r) => r.title === "Ação com responsável identificado");
    const manuallyAssigned = actionRows.find((r) => r.title === "Ação sem responsável identificado");
    expect(autoAssigned?.assigned_to).toBe(CHEFE_CCIH_ID);
    expect(manuallyAssigned?.assigned_to).toBe(STAFF1_CCIH_ID);

    const finalJob = await getJobRow(page, jobId);
    expect(finalJob?.status).toBe("applied");
    expect(finalJob?.applied_at).toBeTruthy();
    expect(finalJob?.purged_at).toBeTruthy();
    expect(finalJob?.result).toBeNull();
    expect(finalJob?.draft).toBeNull();
    expect(finalJob?.transcript).toBeNull();
    // BLOCKER B1 (fixed in 0939437): apply re-stamps `audio_deleted_at` even on the
    // audio_release=true path, where the callback already deleted the object — idempotent
    // (Storage DELETE on an already-gone object is treated as success). The scenario that
    // actually PROVES apply performs the deletion itself — object present through `done`,
    // gone only after Concluir — is scenario 1b below (audio_release=false).
    expect(finalJob?.audio_deleted_at).toBeTruthy();
  } finally {
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 1b — BLOCKER B1 regression: audio_release=false retains the object through `done`;
// apply (Concluir), not the callback, is what reclaims it (fixed in 0939437)
// ---------------------------------------------------------------------------

test("1b — audio_release=false: object retained through done, reclaimed only at Concluir", async ({
  page,
}) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — audio_release false" });

  try {
    const attendeeRef = await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");

    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);
    await expect(page.getByText("Processando áudio…")).toBeVisible({ timeout: 10_000 });

    const job = await getLatestJobForMeeting(page, meetingId);
    expect(job).not.toBeNull();
    const jobId = job!.id;
    expect(job!.status).toBe("processing");
    expect(job!.audio_path).toBeTruthy();
    const audioPath = job!.audio_path as string;
    const prefix = audioPath.split("/").slice(0, 2).join("/");

    // Baseline: the object genuinely exists right after upload, before any callback.
    expect((await listStorageObjects(page, prefix)).length).toBe(1);

    const posted = await postSignedCallback(
      page,
      buildDoneCallback({
        jobId,
        matchedAgendaRef: "no-ref",
        strikeAgendaRef: "no-ref-2",
        ownerAttendeeRef: attendeeRef,
        audioRelease: false,
      }),
    );
    expect(posted.status).toBe(200);
    await waitForJobStatus(page, jobId, ["done"]);

    // THE PRE-FIX GAP (QA BLOCKER B1): audio_release=false is the documented pilot
    // shadow-run mode (service ADR 0003) — the callback must NOT delete the object while
    // something downstream still needs it. Before 0939437 the normal journey (callback →
    // review → Concluir) ended here with the recording retained indefinitely, because
    // nothing downstream of `done` ever reached an `applied` row to reclaim it.
    expect((await listStorageObjects(page, prefix)).length).toBe(1);
    const afterDone = await getJobRow(page, jobId);
    expect(afterDone?.audio_deleted_at).toBeNull();
    expect(afterDone?.audio_path).toBe(audioPath);

    await page.reload();
    const reviewLink = page.getByRole("link", { name: "Revisar ata gerada" });
    await expect(reviewLink).toBeVisible({ timeout: 10_000 });
    await followLink(page, reviewLink);
    await expect(page.getByRole("heading", { name: "Revisão da ata" })).toBeVisible({ timeout: 30_000 });

    // No edits needed — this scenario proves the deletion trigger, not the draft edit
    // paths (scenario 1 already covers those). Concluir with the extracted draft as-is.
    await page.getByRole("button", { name: "Concluir revisão" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Concluir a revisão da ata?" });
    await expect(confirm).toBeVisible({ timeout: 5_000 });
    await confirm.getByRole("button", { name: "Concluir", exact: true }).click();
    await expect(page.getByText("Ata aplicada com sucesso.")).toBeVisible({ timeout: 15_000 });

    // THE PROOF THAT WAS MISSING: gone, and stamped, only now.
    expect((await listStorageObjects(page, prefix)).length).toBe(0);
    const finalJob = await getJobRow(page, jobId);
    expect(finalJob?.status).toBe("applied");
    expect(finalJob?.audio_deleted_at).toBeTruthy();
  } finally {
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 2 — Overwrite warning shown when minutes_md pre-existing
// ---------------------------------------------------------------------------

test("2 — overwrite warning is shown on the review page when the meeting already has ata text", async ({ page }) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — overwrite warning" });

  try {
    const existingText = "Ata pré-existente antes do envio de áudio.";
    const updated = await callRPC(page, token, "update_meeting_minutes", {
      p_meeting_id: meetingId,
      p_minutes_md: existingText,
    });
    expect(updated.status).toBe(200);

    const attendeeRef = await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");

    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);

    const job = await getLatestJobForMeeting(page, meetingId);
    const jobId = job!.id;
    const callback = buildDoneCallback({
      jobId,
      matchedAgendaRef: "no-such-ref",
      strikeAgendaRef: "no-such-ref-2",
      ownerAttendeeRef: attendeeRef,
    });
    await postSignedCallback(page, callback);
    await waitForJobStatus(page, jobId, ["done"]);

    await page.goto(reviewHref(meetingId));
    await expect(page.getByRole("heading", { name: "Revisão da ata" })).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText("Esta reunião já tem uma ata registrada")).toBeVisible();
    const showCurrent = page.getByRole("button", { name: "Ver ata atual" });
    await showCurrent.click();
    await expect(page.getByText(existingText)).toBeVisible({ timeout: 5_000 });
  } finally {
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 3 — Cancel mid-processing: button returns, storage object deleted, re-run allowed
// ---------------------------------------------------------------------------

test("3 — cancel mid-processing returns the button, deletes the audio object, and allows a fresh attempt", async ({
  page,
}) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — cancel mid-processing" });

  try {
    await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");

    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);
    await expect(page.getByText("Processando áudio…")).toBeVisible({ timeout: 10_000 });

    const job = await getLatestJobForMeeting(page, meetingId);
    const jobId = job!.id;
    expect(job!.audio_path).toBeTruthy();
    const audioPath = job!.audio_path as string;

    await page.getByRole("button", { name: "Cancelar processamento de áudio" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Cancelar o processamento do áudio?" });
    await expect(confirm).toBeVisible({ timeout: 5_000 });
    await confirm.getByRole("button", { name: "Cancelar processamento" }).click();
    await expect(confirm).not.toBeVisible({ timeout: 10_000 });

    // Button returns.
    await expect(page.getByRole("button", { name: "Usar áudio" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Processando áudio…")).toHaveCount(0);

    const cancelled = await getJobRow(page, jobId);
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.cancelled_at).toBeTruthy();
    expect(cancelled?.audio_deleted_at).toBeTruthy();

    // Acceptance criterion 4 — the storage object is actually gone.
    const remaining = await listStorageObjects(page, audioPath.split("/").slice(0, 2).join("/"));
    expect(remaining.length).toBe(0);

    // Re-run allowed — the one-active-job partial unique index no longer blocks.
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);
    await expect(page.getByText("Processando áudio…")).toBeVisible({ timeout: 10_000 });
    const second = await getLatestJobForMeeting(page, meetingId);
    expect(second!.id).not.toBe(jobId);
    expect(second!.status).toBe("processing");
  } finally {
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 4 — Failure callback → error chip + retry
// ---------------------------------------------------------------------------

test("4 — a signed error callback shows the failed chip with a retry that opens a fresh dialog", async ({ page }) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — failure callback" });

  try {
    await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");

    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);

    const job = await getLatestJobForMeeting(page, meetingId);
    const jobId = job!.id;

    const posted = await postSignedCallback(page, buildErrorCallback(jobId));
    expect(posted.status).toBe(200);
    await waitForJobStatus(page, jobId, ["failed"]);

    await page.reload();
    await expect(page.getByText("Não foi possível gerar a ata a partir deste áudio.")).toBeVisible({
      timeout: 10_000,
    });
    const retryButton = page.getByRole("button", { name: "Tentar novamente" });
    await expect(retryButton).toBeVisible();
    await retryButton.click({ timeout: 10_000 });

    const dialog = page.getByRole("dialog", { name: /Gerar ata a partir do áudio/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole("button", { name: "Continuar" })).toBeEnabled();

    const failedRow = await getJobRow(page, jobId);
    expect(failedRow?.status).toBe("failed");
    expect(failedRow?.error_code).toBe("audio_unreachable");
  } finally {
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 5 — Flag OFF: no button, review route redirects, webhook 200-drops
// ---------------------------------------------------------------------------

test("5 — flag OFF hides the slot, redirects the review route, and the webhook 200-drops the callback", async ({
  page,
}) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — flag off" });
  const wasEnabled = readAudioMinutesFlag();

  try {
    await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");

    // Reach `processing` WHILE the flag is still on, so the flag-off callback drop has a
    // real row to (not) touch.
    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);
    const job = await getLatestJobForMeeting(page, meetingId);
    const jobId = job!.id;
    expect(job!.status).toBe("processing");

    setAudioMinutesFlag(false);

    await page.reload();
    await expect(page.getByRole("button", { name: "Usar áudio" })).toHaveCount(0);
    await expect(page.getByText("Processando áudio…")).toHaveCount(0);
    await expect(page.getByText("Marque a reunião como realizada para usar áudio.")).toHaveCount(0);

    await page.goto(reviewHref(meetingId));
    await page.waitForURL((url) => url.pathname.endsWith(`/meetings/${meetingId}`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Ata" })).toBeVisible({ timeout: 10_000 });

    const posted = await postSignedCallback(page, buildDoneCallback({
      jobId,
      matchedAgendaRef: "no-ref",
      strikeAgendaRef: "no-ref-2",
      ownerAttendeeRef: "no-ref-3",
    }));
    expect(posted.status).toBe(200);
    expect((posted.body as { note?: string }).note).toBe("feature disabled");

    const unchanged = await getJobRow(page, jobId);
    expect(unchanged?.status).toBe("processing");
  } finally {
    setAudioMinutesFlag(wasEnabled);
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 6 — Non-canEdit persona: no button, redirected from review
// ---------------------------------------------------------------------------

test("6 — a plain staff persona sees no audio affordance and is redirected out of the review route", async ({
  page,
}) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — non-canEdit" });

  try {
    const attendeeRef = await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");

    // Drive a real `done` job as chefe first, so staff1's redirect is proven against a
    // job that genuinely exists — not merely absent.
    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);
    const job = await getLatestJobForMeeting(page, meetingId);
    const jobId = job!.id;
    await postSignedCallback(page, buildDoneCallback({
      jobId,
      matchedAgendaRef: "no-ref",
      strikeAgendaRef: "no-ref-2",
      ownerAttendeeRef: attendeeRef,
    }));
    await waitForJobStatus(page, jobId, ["done"]);

    // Now as staff1 (plain staff, not staff_admin) — canEdit is false.
    await signInAs(page, "staff1.ccih@test.local");
    await goToMeeting(page, meetingId);
    await expect(page.getByRole("button", { name: "Usar áudio" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Revisar ata gerada" })).toHaveCount(0);

    await page.goto(reviewHref(meetingId));
    await page.waitForURL((url) => url.pathname.endsWith(`/meetings/${meetingId}`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Ata" })).toBeVisible({ timeout: 10_000 });
  } finally {
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 7 — Invalid-signature webhook → 401, no state change (request-level, no UI)
// ---------------------------------------------------------------------------

test("7 — a callback with an invalid signature is rejected 401 and changes nothing", async ({ page }) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — invalid signature" });

  try {
    await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");

    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);
    const job = await getLatestJobForMeeting(page, meetingId);
    const jobId = job!.id;
    expect(job!.status).toBe("processing");

    const badSecret = await postSignedCallback(
      page,
      buildDoneCallback({ jobId, matchedAgendaRef: "x", strikeAgendaRef: "y", ownerAttendeeRef: "z" }),
      { secret: "wrong-secret-entirely" },
    );
    expect(badSecret.status).toBe(401);

    const garbled = await postSignedCallback(
      page,
      buildDoneCallback({ jobId, matchedAgendaRef: "x", strikeAgendaRef: "y", ownerAttendeeRef: "z" }),
      { signature: "sha256=" + "0".repeat(64) },
    );
    expect(garbled.status).toBe(401);

    const unchanged = await getJobRow(page, jobId);
    expect(unchanged?.status).toBe("processing");
    expect(unchanged?.result).toBeNull();
  } finally {
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 8 — Keyboard-only: full review + conclude flow
// ---------------------------------------------------------------------------

test("8 — keyboard-only: review the generated ata and conclude it without a mouse", async ({ page }) => {
  const token = await getOwnerToken(page, "chefe.ccih@test.local");
  const meetingId = await createHeldMeeting(page, token, { title: "Reunião MIN E2E — keyboard only" });

  try {
    const attendeeRef = await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, "presidente");
    await addAttendee(page, token, meetingId, STAFF1_CCIH_ID, "membro");
    // The live row's title here is fixture setup only — `apply_minutes_review` matches by
    // `ref` (this id), never by title. The DRAFT title (what F3 actually renders for a
    // matched item) always comes from `buildDoneCallback`'s hardcoded
    // "Item existente — mantido" — the locator below anchors on that, not this string.
    const matchedRef = await addAgendaItem(page, token, meetingId, "Item existente — teclado (linha viva)");

    // Setup (upload + callback) is UI-driven but not the flow under test — the keyboard
    // contract begins at "Revisar ata gerada".
    await signInAs(page, "chefe.ccih@test.local");
    await goToMeeting(page, meetingId);
    await clickUsarAudio(page);
    await uploadAudioAndSubmit(page);
    const job = await getLatestJobForMeeting(page, meetingId);
    const jobId = job!.id;
    await postSignedCallback(page, buildDoneCallback({
      jobId,
      matchedAgendaRef: matchedRef,
      strikeAgendaRef: "no-ref",
      ownerAttendeeRef: attendeeRef,
    }));
    await waitForJobStatus(page, jobId, ["done"]);
    await page.reload();

    // --- Keyboard-only from here ---
    const reviewLink = page.getByRole("link", { name: "Revisar ata gerada" });
    await expect(reviewLink).toBeVisible({ timeout: 10_000 });
    await reviewLink.focus();
    await expect(reviewLink).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(`**${reviewHref(meetingId)}`, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Revisão da ata" })).toBeVisible({ timeout: 30_000 });

    // Ata textarea: focus + type (replacing the extracted text).
    const ataTextarea = page.locator("#revisao-ata-minutes-md");
    await expect(ataTextarea).toBeVisible();
    await ataTextarea.focus();
    await expect(ataTextarea).toBeFocused();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("# Ata revisada via teclado\n\nConteúdo digitado sem mouse.");

    // Toggle the matched agenda item's include checkbox via Space. (See the happy-path
    // test's comment on why this anchors on the row's aria-labelled textarea rather than
    // `hasText` — an action/agenda title can render inside an `<input value=…>`, which
    // carries no `textContent` for `hasText` to match.)
    const agendaCard = page.locator('li:has(textarea[aria-label="Discussão — Item existente — mantido"])');
    await expect(agendaCard).toBeVisible();
    // I6 fix (QA a11y batch, cba04fd): the accessible name is STABLE ("Incluir na ata")
    // across toggle; state lives in `aria-checked` alone, so drive/assert through that,
    // never through a renaming label.
    const includeCheckbox = agendaCard.getByRole("checkbox", { name: "Incluir na ata" });
    await includeCheckbox.focus();
    await expect(includeCheckbox).toBeFocused();
    await expect(includeCheckbox).toBeChecked();
    await page.keyboard.press("Space");
    await expect(includeCheckbox).not.toBeChecked();
    // Toggle it back on with a second Space — proves the control is genuinely operable,
    // not merely focusable — and the name is still unchanged (the property under test).
    await page.keyboard.press("Space");
    await expect(includeCheckbox).toBeChecked();
    await expect(agendaCard.getByRole("checkbox", { name: "Incluir na ata" })).toBeVisible();

    // Owner select on the unresolved action item, via keyboard.
    const unresolvedAction = page.locator(
      'li:has(textarea[aria-label="Descrição — Ação sem responsável identificado"])',
    );
    await expect(unresolvedAction).toBeVisible();
    const ownerSelect = unresolvedAction.getByRole("combobox", { name: "Responsável" });
    await ownerSelect.focus();
    await expect(ownerSelect).toBeFocused();
    await ownerSelect.selectOption({ label: "Enfermeiro CCIH Um" });

    await expect(page.getByText("Salvo")).toBeVisible({ timeout: 10_000 });

    // Concluir revisão → confirm dialog → Concluir, all via keyboard.
    const concludeButton = page.getByRole("button", { name: "Concluir revisão" });
    await concludeButton.focus();
    await expect(concludeButton).toBeFocused();
    await page.keyboard.press("Enter");

    const confirm = page.getByRole("alertdialog", { name: "Concluir a revisão da ata?" });
    await expect(confirm).toBeVisible({ timeout: 5_000 });
    const confirmAction = confirm.getByRole("button", { name: "Concluir", exact: true });
    await confirmAction.focus();
    await expect(confirmAction).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Ata aplicada com sucesso.")).toBeVisible({ timeout: 15_000 });

    const finalJob = await getJobRow(page, jobId);
    expect(finalJob?.status).toBe("applied");
    const meetingRow = await getMeetingRow(page, meetingId);
    expect(meetingRow?.minutes_md).toBe("# Ata revisada via teclado\n\nConteúdo digitado sem mouse.");
  } finally {
    await deleteMeeting(page, meetingId);
    deletedMeetingIds.push(meetingId);
  }
});

// ---------------------------------------------------------------------------
// 9 — Fresh-reset seed survival: fixtures cleaned up by identity, seed rows intact
// ---------------------------------------------------------------------------

test("9 — every meeting this suite created was deleted by identity, and seed rows survived", async ({ page }) => {
  expect(deletedMeetingIds.length).toBeGreaterThanOrEqual(9);
  for (const id of deletedMeetingIds) {
    expect(await meetingExists(page, id)).toBe(false);
  }

  const commission = await page.request.get(
    `${SUPABASE_URL}/rest/v1/commissions?id=eq.${COMM_CCIH_ID}&select=id,name`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  const commissionRows = (await commission.json()) as Array<{ id: string; name: string }>;
  expect(commissionRows).toHaveLength(1);
  expect(commissionRows[0].name).toMatch(/CCIH|Controle de Infecção/i);

  const chefe = await page.request.get(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${CHEFE_CCIH_ID}&select=id,full_name`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  const chefeRows = (await chefe.json()) as Array<{ id: string; full_name: string }>;
  expect(chefeRows).toHaveLength(1);
  expect(chefeRows[0].full_name).toBe("Chefe CCIH");

  // The flag is back to its seeded value (test 5 restores it in `finally`, but a fresh
  // read here catches a restore that silently no-opped).
  expect(readAudioMinutesFlag()).toBe(true);
});
