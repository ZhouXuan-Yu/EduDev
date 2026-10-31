import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";
import { testMain, assertIsolatedPiMain } from "./acceptance/build-root.mjs";
import { fingerprint, sha256 } from "./acceptance/evidence.mjs";
import { pairedScenario } from './acceptance/chat-paired-scenarios.mjs';
import { installChatPublicProbe } from './acceptance/chat-live-public-probe.mjs';
import { readOnlyRunBlocker, stopOwnedChatRun } from './acceptance/chat-live-blocker.mjs';
import { captureStyleProbe } from './acceptance/ui-style-probe.mjs';
const scenario = pairedScenario();
const PROMPT = scenario.prompt;
const EXPLANATION = scenario.explanation;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(process.env.UI_PAIRED_PDF || process.env.UI_CHAT_PDF || 'D:/WorkProject/小智智能体借鉴项目/_ui-review-runtime/20261101/buoyancy-review.pdf');
const limit = Number(process.env.UI_CHAT_TIMEOUT_MS || 18e4);
const focusMode = process.env.UI_CHAT_FOCUS || 'summary';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  assert(process.env.DEEPSEEK_API_KEY, "DEEPSEEK_API_KEY must be injected by the parent");
  assert(['summary', 'detail-link', 'composer'].includes(focusMode), 'UI_CHAT_FOCUS must be summary, detail-link or composer');
  assert(Number.isFinite(limit) && limit >= 1e4 && limit <= 9e5, "timeout must be 10–900 seconds");
  assert(fs.existsSync(source), "Synthetic PDF missing");
  const base = path.resolve(root, process.env.UI_CHAT_OUTPUT || `test-results/ui-goal-20261101/chat-live${scenario.name === 'default' ? '' : '-' + scenario.name}`);
  assert(base.startsWith(path.join(root, "test-results") + path.sep), "Output must be owned test-results");
  fs.mkdirSync(base, { recursive: true });
  const output = fs.mkdtempSync(path.join(base, "run-")), data = path.join(output, "data"), profile = path.join(output, "profile");
  const mainFile = testMain(root), build = fingerprint(path.dirname(path.dirname(mainFile)));
  const report = { success: false, output, scenario: scenario.name, promptOverride: scenario.promptOverride, prompt: PROMPT, promptSha256: sha256(Buffer.from(PROMPT)), focusMode, model: "deepseek-flash", pdf: { name: path.basename(source), sha256: sha256(fs.readFileSync(source)) }, buildSha256: build.sha256, scriptSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))), scenarioConfigSha256: sha256(fs.readFileSync(new URL('./acceptance/chat-paired-scenarios.mjs', import.meta.url))), publicProbeSha256:sha256(fs.readFileSync(new URL('./acceptance/chat-live-public-probe.mjs',import.meta.url))), checks: [], runs: [], events: [], consoleErrors: [], screens: [], styleProbes: [], humanAccepted: false };
  const check = (name) => {
    report.checks.push({ name, pass: true });
    console.log("PASS " + name);
  };
  let app, page, sessionId, ownedRun;
  const clean = (s) => String(s).replaceAll(process.env.DEEPSEEK_API_KEY, "[credential]").slice(0, 1200);
  const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + "\n");
  async function until(fn, name, timeout = limit) {
    const end = Date.now() + timeout;
    let lastLog = 0;
    while (Date.now() < end) {
      if (Date.now() - lastLog >= 5e3) {
        console.log("WAIT " + name);
        lastLog = Date.now();
      }
      let timer;
      try {
        if (await Promise.race([fn(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("Timed out: " + name)), Math.max(1, end - Date.now()));
        })])) return;
      } finally {
        clearTimeout(timer);
      }
      await delay(100);
    }
    throw Error("Timed out: " + name);
  }
  async function safeDOM() {
    assert.equal(await page.locator('[data-testid="agent-raw-reasoning"],[data-testid="model-reasoning"]').count(), 0, "private reasoning UI must be absent before capture");
  }
  async function noNativeChatDisclosure() {
    const chat=page.getByTestId('office-conversation');
    assert.equal(await chat.count(),1,'scope to the actual application conversation');
    // Playwright CSS does not pierce file-preview frames; composer lives outside this tree.
    assert.equal(await chat.locator('details,summary').count(),0,'application chat must use component disclosures');
  }
  async function shot(name) {
    await safeDOM();
    await noNativeChatDisclosure();
    const file = name + ".png";
    await page.screenshot({ path: path.join(output, file), animations: "disabled" });
    report.screens.push({file,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,devicePixelRatio}))});
  }
  async function sizes(name) {
    for (const [w, h] of [[1366, 768], [1920, 1080]]) {
      await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [w, h]);
      await page.waitForFunction(([w2, h2]) => innerWidth === w2 && innerHeight === h2, [w, h]);
      await shot(`${name}-${w}`);
    }
  }
  // Construct a public DTO inside the renderer; never return the snapshot itself.
  async function state() {
    return page.evaluate(async id => {
      const snapshot = await window.omniEdu.getXiaozhiSnapshot(id);
      const sourceView = value => ({
        title: value.title,
        kind: value.kind,
        material: value.material ? {
          resourceId: value.material.resourceId,
          offset: value.material.offset,
          version: value.material.version,
          bodyVersion: value.material.bodyVersion,
        } : undefined,
      });
      const toolView = item => ({
        id: item.id,
        name: item.toolName,
        status: item.status,
        label: item.label,
        summary: item.resultSummary ? {
          text: item.resultSummary.text,
          query: item.resultSummary.query,
          scope: item.resultSummary.scope,
        } : undefined,
        sources: (item.sources || []).map(sourceView),
        sourceCount: item.sources?.length || 0,
      });
      const turnView = turn => ({
        id: turn.id,
        status: turn.status,
        presentation: turn.presentation ? {
          version: turn.presentation.version,
          phase: turn.presentation.phase,
          processStartedAt: turn.presentation.processStartedAt,
          processEndedAt: turn.presentation.processEndedAt,
          processElapsedMs: turn.presentation.processElapsedMs,
          handoff: turn.presentation.handoff,
          toolAfterAnswer: turn.presentation.toolAfterAnswer,
        } : undefined,
        tools: turn.items.filter(item => item.kind === 'tool').map(toolView),
        questions: (snapshot.controls || []).filter(item => item.runId === turn.id && item.kind === 'question')
          .map(item => ({id:item.id,callId:item.callId,state:item.state,text:item.text,options:item.options})),
        // Deliberately exclude approval source/target filesystem paths.
        approvals: (snapshot.approvals || []).filter(item => item.runId === turn.id)
          .map(item => ({id:item.id,callId:item.callId,state:item.state})),
        modelRequests: (turn.modelRequests || []).map(request => ({
          request: request.request, attempt: request.attempt,
          state: request.state, at: request.at,
        })),
        publicProcessCount: turn.items.filter(item => item.kind === 'message'
          && item.role === 'assistant' && item.phase === 'commentary'
          && item.text?.trim()).length,
        answer: turn.items.filter(item => item.role === 'assistant'
          && ['final_answer', 'partial_answer'].includes(item.phase))
          .map(item => ({id:item.id, phase:item.phase, text:item.text || ''})),
        attachmentCount: turn.items.filter(item => item.role === 'user')
          .reduce((count, item) => count + (item.attachments?.length || 0), 0),
      });
      return {
        running: snapshot.running,
        model: snapshot.projection.model,
        sourceSequence: snapshot.projection.sourceSequence,
        turns: snapshot.projection.turns.map(turnView),
      };
    }, sessionId);
  }
  async function launch() {
    const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(root, "../.."), OMNI_EDU_XIAOZHI_PI: "1", OMNI_EDU_E2E_DIALOG_MODE: "1", DEEPSEEK_MODEL: "deepseek-flash" };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    app = await electron.launch({ args: [mainFile, `--user-data-dir=${profile}`], env, timeout: 6e4 });
    page = await app.firstWindow();
    page.on("pageerror", () => report.consoleErrors.push({ kind: "pageerror" }));
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push({ kind: "console.error" });
    });
    await page.getByTestId("xiaozhi-pi-workspace").waitFor({ state: "visible", timeout: 6e4 });
    await until(async () => !await page.getByTestId("office-prompt-input").isDisabled(), "composer ready", 6e4);
    report.runtime = await assertIsolatedPiMain(app, mainFile, profile);
    await page.evaluate(installChatPublicProbe);
    const current = await page.locator(".office-composer-container:visible").getAttribute("data-session-id");
    if (sessionId && current !== sessionId) {
      await page.locator('[data-testid="edu-navigation"]:visible').getByTestId(`workbench-session-${sessionId}`).click();
      await until(async () => await page.locator(".office-composer-container:visible").getAttribute("data-session-id") === sessionId, "restore target session", 3e4);
    }
    sessionId = await page.locator(".office-composer-container:visible").getAttribute("data-session-id");
    assert(sessionId, "visible composer must identify its session");
  }
  const events = () => page.evaluate((id) => (window.__uiChatEvents || []).filter((e) => e.sessionId === id), sessionId);
  const section = (id) => page.locator(`.office-turn[data-turn-id="${id}"]:visible`);
  // HeroUI Tooltip.Trigger also exposes role=button. Target the real control,
  // scoped to the visible composer; never mask ambiguity with .first().
  const composer = () => page.locator('.office-composer-container:visible');
  const attachButton = () => composer().locator('button[aria-label="添加本地附件"]');
  async function stopOwned() {
    if (!ownedRun || !page || page.isClosed()) return;
    let timer;
    try {
      report.ownedRunStop = { ...ownedRun, ...await Promise.race([
        page.evaluate(stopOwnedChatRun, ownedRun),
        new Promise(resolve => { timer = setTimeout(() => resolve({requested:false,reason:'stop_ack_timeout'}), 10000); }),
      ]) };
      if (report.ownedRunStop.requested && report.ownedRunStop.ok) {
        const deadline = Date.now() + 5000;
        report.ownedRunStop.confirmed = false;
        while (Date.now() < deadline) {
          const stopped = (await state()).turns.find(turn => turn.id === ownedRun.runId);
          if (stopped && ['interrupted','failed','completed'].includes(stopped.status)) {
            report.ownedRunStop.confirmed = true;
            report.ownedRunStop.observedStatus = stopped.status;
            break;
          }
          await delay(100);
        }
      }
    } catch {
      report.ownedRunStop = {...ownedRun,requested:false,reason:'stop_ipc_failed'};
    } finally { clearTimeout(timer); }
  }
  async function send(prompt) {
    const before = await state();
    await page.getByTestId("office-prompt-input").fill(prompt);
    await composer().locator('button[aria-label="发送消息"]').click();
    await until(async () => {
      const s2 = await state();
      return s2.turns.some((t) => !before.turns.some((old) => old.id === t.id));
    }, "new run admitted", 3e4);
    const s = await state();
    return s.turns.find((t) => !before.turns.some((old) => old.id === t.id)).id;
  }
  async function run(prompt, name, needsTools) {
    const start = Date.now(), id = await send(prompt), record = { name, sessionId, runId: id, prompt };
    ownedRun = {sessionId,runId:id};
    report.runs.push(record);
    const turn = section(id);
    let executing = false, handoff = false, reopened = false, focusArmed = false, stylesCaptured = false, firstBodyAt;
    await until(async () => {
      const s = await state(), t = s.turns.find((t2) => t2.id === id);
      assert(t, "bound run disappeared");
      const blocker = readOnlyRunBlocker(t);
      if (blocker) {
        record.failure = 'unexpected_' + blocker.kind;
        report.blocked = {sessionId,runId:id,scenario:scenario.name,observedAt:Date.now(),
          ...blocker,presentation:t.presentation,modelRequests:t.modelRequests};
        write(`${name}-public-blocker.json`, report.blocked);
        report.events.push(...await events());
        await stopOwned();
        throw Error(record.failure);
      }
      const own = (await events()).filter((e) => e.runId === id);
      const live = await turn.locator('[data-mode="live-prose"]').count();
      if (needsTools && !stylesCaptured && live && t.tools.length && s.running) {
        const tool=turn.locator('button[data-testid="agent-tool-trigger"]:visible').first();
        if(await tool.count()) {
          const probes=[];
          probes.push(await captureStyleProbe(page,turn.locator('[data-mode="live-prose"]:visible'),'streaming-public-process'));
          await tool.hover();probes.push(await captureStyleProbe(page,tool,'real-tool-hover'));
          await page.mouse.move(0,0);await tool.focus();
          await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
          assert(await tool.evaluate(node=>node.matches(':focus-visible')),'keyboard must produce real focus-visible');
          probes.push(await captureStyleProbe(page,tool,'real-tool-keyboard-focus'));
          const file=`${name}-styles.json`;write(file,{sessionId,runId:id,probes});
          report.styleProbes.push({file,runId:id,states:probes.map(probe=>probe.name)});stylesCaptured=true;
        }
      }
      if (needsTools && !focusArmed && live && t.tools.length && s.running) {
        const summary = turn.locator('button[data-testid="agent-tool-trigger"]:visible').first();
        if (focusMode === 'composer') await page.getByTestId('office-prompt-input').focus();
        else if (focusMode === 'detail-link') {
          if (await summary.getAttribute('aria-expanded') !== 'true') await summary.click();
          const link = turn.getByTestId('office-tool-evidence').locator('a:visible').first();
          assert(await link.count(), 'detail-link focus mode requires a real public source link; do not fabricate one');
          await link.focus();
        } else await summary.focus();
        focusArmed = true;
      }
      if (!executing && (t.publicProcessCount || t.tools.length) && live && (!needsTools || focusArmed)) {
        assert(await turn.getByTestId("agent-trace-timeline").isVisible(), "executing process is visible");
        await turn.getByTestId('agent-trace-timeline').scrollIntoViewIfNeeded();
        await sizes(`${name}-executing-expanded`);
        executing = true;
      }
      const explicit = own.some((e) => e.kind === "assistant_phase" && e.phase === "final_answer");
      if (explicit && !handoff && (t.publicProcessCount || t.tools.length)) {
        const observation = await page.evaluate(runId => window.__uiChatHandoffs.find(item => item.runId === runId), id);
        if (!observation) return false;
        assert.equal(t.presentation?.handoff, 'explicit', 'production projection must agree with explicit phase event');
        record.handoffEvidence = observation;
        assert(observation.beforeTerminal, 'actual DOM collapse must be observed before terminal, not inferred from completion');
        if (needsTools) {
          assert(focusArmed, 'focus case must be exercised before final');
          assert.equal(observation.focusBefore, focusMode, 'explicit event must see the requested focus case');
          assert.equal(observation.focusAfter, focusMode === 'composer' ? 'composer' : 'process-trigger', 'handoff restores tool focus without stealing composer focus');
        }
        await turn.getByTestId("agent-trace-toggle").waitFor({ state: "visible", timeout: 1e4 });
        assert.equal(await turn.getByTestId("agent-trace-toggle").getAttribute("aria-expanded"), "false", "explicit handoff must collapse process");
        record.handoffObservedWhileRunning = observation.beforeTerminal;
        record.handoffElapsedMs = Date.now() - start;
        await turn.getByTestId('agent-trace-toggle').scrollIntoViewIfNeeded();
        await sizes(`${name}-explicit-final-collapsed`);
        handoff = true;
        await turn.getByTestId("agent-trace-toggle").click();
        assert.equal(await turn.getByTestId("agent-trace-toggle").getAttribute("aria-expanded"), "true");
        record.manualReopenedWhileRunning = (await state()).running;
        record.manualReopenAfterSequence = Math.max(0, ...(await events()).filter(event=>event.runId===id).map(event=>event.sequence));
        reopened = true;
        await shot(`${name}-manual-reopen`);
      }
      if (t.answer.some((a) => a.text) && firstBodyAt === void 0) firstBodyAt = Date.now() - start;
      if (reopened) assert.equal(await turn.getByTestId("agent-trace-toggle").getAttribute("aria-expanded"), "true", "manual reopen must survive subsequent tokens and completion");
      if (s.running) return false;
      assert.equal(t.status, "completed", "real provider run must complete");
      record.completedMs = Date.now() - start;
      record.firstObservedBodyMs = firstBodyAt;
      record.publicProcessCount = t.publicProcessCount;
      record.tools = t.tools;
      record.presentation = t.presentation;
      record.publicDeltasAfterManualReopen = own.filter(event=>event.kind==='text_delta' && event.sequence > (record.manualReopenAfterSequence ?? Infinity)).length;
      write(`${name}-answer.json`, { scenario: scenario.name, sessionId, runId: id, prompt, promptSha256:sha256(Buffer.from(prompt)), model: s.model, answer: t.answer, tools: t.tools, sourcePdfSha256: report.pdf.sha256 });
      assert(t.answer.some((a) => a.text.trim()), "public answer is nonempty");
      if (needsTools) {
        assert(t.tools.length > 0, "attachment task must really use tools");
        const firstTool=own.findIndex(event=>event.kind==='tool_start');
        const firstPublicText=own.findIndex(event=>event.kind==='text_delta'&&event.publicCommentary);
        if (scenario.explainBeforeTools) assert(t.publicProcessCount>0&&firstPublicText>=0&&firstTool>firstPublicText,'requested explicit public commentary must precede the first real tool');
        assert(t.tools.some((t2) => t2.status === "completed" && /read_attachment|read_document|read_text/.test(t2.name || "")), "attachment content must actually be read");
        assert(executing, "real execution was observed");
        assert(stylesCaptured,"streaming, hover and keyboard style evidence was captured");
        assert(handoff, "explicit final handoff was observed");
        assert(record.handoffObservedWhileRunning, "handoff must be captured during streaming");
        assert(!t.tools.some((t2) => /web|browser|create|edit|copy|write|document_create/.test(t2.name || "")), "prompt prohibits web access and writes");
      } else {
        assert.equal(t.tools.length, 0, "explanation must not invent or invoke tools");
        assert(!await turn.getByTestId("office-tool-step").count(), "zero-tool answer has no tool UI");
        if (!t.publicProcessCount) assert(!await turn.getByTestId("agent-trace-toggle").count(), "no public process must not leave a fake completed disclosure");
      }
      if (t.tools.length) {
        if (await turn.getByTestId("agent-trace-toggle").getAttribute("aria-expanded") !== "true") await turn.getByTestId("agent-trace-toggle").click();
        for (const row of await turn.getByTestId("office-tool-step").all()) {
          const trigger=row.locator('button[data-testid="agent-tool-trigger"]');
          assert.equal(await trigger.count(),1,"one real tool button per row");
          if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
          const evidence = await row.getByTestId("office-tool-evidence").innerText();
          assert(evidence.trim(), "real tool has inspectable public content");
          assert(!/实际用时|本次排队|本次执行|执行用时|调用用时|\b\d+(?:\.\d+)?\s*ms\b/.test(evidence), "tool evidence must not display invocation duration");
          assert.equal(await row.locator('[data-testid="pi-tool-timing"],.office-step-duration').count(), 0);
        }
        await sizes(`${name}-tool-details`);
      }
      const body = await turn.getByTestId("agent-reply-body").allTextContents();
      write(`${name}-visible-body.json`, { sessionId, runId: id, body });
      assert(body.join("").trim(), "visible answer body must render");
      await sizes(`${name}-completed`);
      check(`${name}: real bound run / public process / body / tool details / dual-size captures`);
      return true;
    }, `${name} completion`, Math.max(1, limit - (Date.now() - start)));
    ownedRun = undefined;
    return (await state()).turns.find((t) => t.id === id);
  }
  try {
    await launch();
    assert.equal((await state()).model, "deepseek-flash", "isolated session uses requested model");
    await sizes("initial");
    const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 15e3 }), attachButton().click()]);
    await chooser.setFiles(source);
    await composer().getByRole("button", { name: `预览附件 ${path.basename(source)}`, exact: true }).and(composer().locator('button')).waitFor({ state: "visible", timeout: 3e4 });
    await until(async () => !await attachButton().isDisabled(), "attachment imported", 3e4);
    check("original local-attachment UI imports the exact synthetic PDF");
    const attachment = await run(PROMPT, "attachment", true);
    assert.equal(attachment.attachmentCount, 1, "uploaded attachment is bound to teacher message");
    const before = await state();
    report.events.push(...await events());
    await app.close();
    app = void 0;
    await launch();
    const restored = await state(), again = restored.turns.find((t) => t.id === attachment.id);
    assert(again, "cold restart restores exact run");
    assert.deepEqual(again.presentation, attachment.presentation, "cold restart preserves stage and measured boundaries");
    assert.deepEqual(again.answer, attachment.answer, "cold restart preserves same public answer");
    assert.deepEqual(again.modelRequests, attachment.modelRequests, "cold restart adds no model attempt even before renderer subscription");
    assert(!restored.running, "cold restart cannot restart model");
    await delay(500);
    assert(!(await events()).some((e) => e.kind === "model_request" || e.kind === "assistant_start" || e.kind === "tool_start"), "cold restart emits no model/tool replay");
    assert.equal((await state()).sourceSequence, before.sourceSequence, "cold restore does not append events");
    assert.equal((await state()).turns.length, before.turns.length, "cold restore adds no turn");
    assert.equal(await section(attachment.id).getByTestId("agent-trace-toggle").getAttribute("aria-expanded"), "false", "restored completed process starts collapsed");
    await sizes("cold-restored");
    check("cold restart: identical stage/time/body, collapsed, no model replay");
    if (EXPLANATION) {
    const nav = page.locator('[data-testid="edu-navigation"]:visible');
    await nav.getByTestId("workbench-new-session").click();
    const newDialog = page.getByTestId("workbench-new-dialog");
    await newDialog.getByRole("button", { name: "创建对话", exact: true }).and(newDialog.locator('button[type="submit"]')).click();
    await until(async () => await page.locator(".office-composer-container:visible").getAttribute("data-session-id") !== sessionId, "new explanation session", 3e4);
    report.events.push(...await events());
    sessionId = await page.locator(".office-composer-container:visible").getAttribute("data-session-id");
    await until(async () => !await page.getByTestId("office-prompt-input").isDisabled(), "new composer ready", 3e4);
    await run(EXPLANATION, "explanation", false);
    report.events.push(...await events());
    }
    assert.deepEqual(report.consoleErrors, [], "zero renderer pageerrors and console errors");
    check("no renderer or console errors");
    assert.equal(fingerprint(path.dirname(path.dirname(mainFile))).sha256, build.sha256, "build must remain frozen");
    check("formal build fingerprint unchanged");
    report.success = true;
  } catch (error) {
    report.failure = clean(error.message);
    process.exitCode = 1;
    if (ownedRun && !report.ownedRunStop) await stopOwned();
    try {
      await shot("failure");
    } catch {
      report.failureScreenshot = "withheld: private UI guard or closed window";
    }
  } finally {
    if (page && !page.isClosed()) try {
      report.events.push(...await events());
    } catch {
    }
    report.events = [...new Map(report.events.map((e) => [`${e.sessionId}:${e.runId}:${e.sequence}`, e])).values()];
    await app?.close().catch(() => {
    });
    write("report.json", report);
    console.log(JSON.stringify({ success: report.success, failure: report.failure, output, checks: report.checks.length }));
  }
}
if (process.argv.includes("--help") || process.argv.includes("--check")) console.log(JSON.stringify({preparedOnly:true,scenario:scenario.name,prompt:PROMPT,promptSha256:sha256(Buffer.from(PROMPT)),model:'deepseek-flash',source,zeroToolSecondRound:Boolean(EXPLANATION),focusMode,usage:'Inject DEEPSEEK_API_KEY; node scripts/ui-goal-chat-live.mjs [--scenario=default|misconception|practice]. Optional shared UI_PAIRED_PROMPT/UI_PAIRED_PDF/UI_PAIRED_SCENARIO; UI_CHAT_FOCUS=summary|detail-link|composer, UI_CHAT_TIMEOUT_MS=180000, UI_CHAT_OUTPUT under test-results. --check/--help never launch or call a model.'}));
else await main();
