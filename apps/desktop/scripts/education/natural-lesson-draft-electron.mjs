import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { _electron } from "playwright";
import { testMain, assertIsolatedPiMain } from "../acceptance/build-root.mjs";
import { lessonDocument } from "./teaching-lesson-fixture.mjs";
import { openLessonFromChat } from "./teaching-lesson-task-journey.mjs";

const acceptance = process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance);
const useLive = process.env.OMNI_EDU_NATURAL_LESSON_LIVE === "1";
const apiKey = useLive ? process.env.DEEPSEEK_API_KEY : "local-fixture-only";
assert(apiKey);
const root = fs.mkdtempSync(path.join(acceptance, "lesson-from-chat-"));
const desktop = path.resolve(import.meta.dirname, "../..");
const data = path.join(root, "data"), profile = path.join(root, "profile");
const main = testMain(desktop);
const draft = structuredClone(lessonDocument);
draft.lesson.mappings = [];
draft.lesson.missingSources = ["本轮未选用课标或教材，请教师对照适用版本。"];
draft.scenes.forEach((scene,index) => {
  scene.sceneId = draft.lesson.phases[index].sceneId = "lesson-" + (index+1);
});
const draftInput = {
  title:draft.title,totalMinutes:draft.totalMinutes,
  objectives:draft.objectives.map((goal,index)=>({goal,criterion:draft.lesson.goalCriteria[index]})),
  preparation:draft.lesson.preparation,details:draft.lesson.details,
  scenes:draft.scenes.map(({title,activity,durationMinutes},index)=>{
    const {kind,objectiveIndices,teacherPrompt,checks}=draft.lesson.phases[index];
    return {title,kind,activity,durationMinutes,objectiveIndices,teacherPrompt,checks};
  }),
};
const prompt = useLive
  ? "请编写一份七年级历史教案。整节课45分钟，主题是比较两份关于同一校史展品的回忆。请自拟两份简短、观点有出入的展品记录，明确标注为模拟史料。学生要区分史料记录与推断，并根据证据说明暂不能确认的结论。"
  : "请生成一份五年级语文教案，40分钟，主题是从观察到有依据的解释，包含正式教案的所有栏目。";
const consultation = "如何写五年级语文教案？请解释板书通常起什么作用。";
const report = { ok: false, useLive, root, prompt, mainSha: createHash("sha256").update(fs.readFileSync(main)).digest("hex"), checks: [] };
let app;
const check = name => { report.checks.push(name); console.log("PASS " + name); };
async function until(read, timeout = 80000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await read();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw Error("Lesson observation deadline");
}
function query(sql, ...values) {
  const db = new DatabaseSync(path.join(data, "app.db"), { readOnly: true, timeout: 5000 });
  try { return db.prepare(sql).all(...values); }
  finally { db.close(); }
}
async function launch(cold) {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop,"../.."),
    OMNI_EDU_SKIP_DOTENV: "1", OMNI_EDU_E2E_VISIBLE: "0", OMNI_EDU_XIAOZHI_PI: "1",
    DEEPSEEK_API_KEY: apiKey, DEEPSEEK_MODEL: "deepseek-flash" };
  for(const key of ["NODE_OPTIONS","ELECTRON_RUN_AS_NODE","ELECTRON_RENDERER_URL"]) delete env[key];
  app = await _electron.launch({ args: [main, "--user-data-dir=" + profile], env, cwd: desktop, timeout: 60000 });
  await assertIsolatedPiMain(app, main, profile);
  await app.evaluate(({net}, input)=>{
    const wire = globalThis.lessonDraftWire = { stages: [], errors: [], mode: "draft" };
    const remote = net.fetch.bind(net);
    globalThis.fetch = async () => { throw Error("External fetch forbidden"); };
    net.fetch = async (address, init) => {
      const url = new URL(typeof address === "string" ? address : address.url ?? address.href);
      if (url.hostname === "api.deepseek.com" && url.pathname.endsWith("/models")) return Response.json({ object:"list", data:[{
        id:"deepseek-flash", context_window:1048576,max_output_tokens:32768,input_modalities:["text"],
        effort:{supported_levels:["low","high","max"],default_level:"high"},
      }] });
      try {
        if (input.cold || url.hostname !== "api.deepseek.com" || !url.pathname.endsWith("/chat/completions")) throw Error("Unexpected request: " + url.origin + url.pathname);
        const request = JSON.parse(init.body), stage = wire.stages.filter(item => item.mode === wire.mode).length;
        const tool = request.tools?.find(candidate => candidate.function.name === "education_propose_natural_lesson")?.function;
        if(wire.mode === "draft" && stage === 0 &&
            (request.tool_choice?.function?.name !== "education_propose_natural_lesson" ||
             request.thinking?.type !== "disabled")) throw Error("Missing exact classroom tool choice on first call");
        if(input.live) {
          if(stage >= 6) throw Error("Live synthetic request limit reached");
          if(!tool?.parameters.required.includes("details")) throw Error("Live run lost lesson binding");
          wire.stages.push({mode:wire.mode,stage,lessonTool:!!tool});
          return remote(address,init);
        }
        let toolCall, message, receipt;
        if(wire.mode === "draft" && stage < 2) {
          if(!JSON.stringify(request.messages).includes(input.prompt) ||
             !tool?.parameters.required.includes("details") || !tool.parameters.properties.scenes.items.required.includes("kind")) {
            throw Error("Normal chat did not bind the structured lesson tool");
          }
          const attempt = structuredClone(input.draft);
          if(stage === 0) {
            attempt.scenes[0].durationMinutes += 5;
          } else {
            const rejection = JSON.parse(request.messages.filter(item => item.role === "tool").at(-1)?.content?.split("\n")[0] || "{}");
            if(rejection.success !== false || rejection.error !== "lesson_duration_mismatch" ||
               !rejection.message.includes("教师要求 40 分钟，当前总时长 40 分钟、环节合计 45 分钟")) {
              throw Error("Missing exact draft duration correction receipt");
            }
            wire.durationCorrection = rejection;
          }
          if(request.tool_choice?.function?.name !== tool.name) throw Error("Missing bounded lesson tool retry");
          toolCall = {name:tool.name,arguments:JSON.stringify(attempt)};
        } else if(wire.mode === "draft" && stage === 2) {
          receipt = JSON.parse(request.messages.filter(item => item.role === "tool").at(-1)?.content?.split("\n")[0] || "{}");
          if(receipt.success !== true || receipt.status !== "draft" || receipt.teacherConfirmed) throw Error("Missing owned lesson receipt");
          message = "结构化教案草稿已保存，请打开教案卡片核对。";
        } else if(wire.mode === "no-coverage") {
          if(stage > 0) {
            const rejection = JSON.parse(request.messages.filter(item => item.role === "tool").at(-1)?.content?.split("\n")[0] || "{}");
            if(rejection.success !== false || rejection.error !== "lesson_objective_coverage" ||
               !rejection.message.includes("编号 2 的目标缺少")) throw Error("Missing actionable objective coverage rejection");
            wire.coverageCorrection = rejection;
          }
          if(stage < 2) {
            const attempt = structuredClone(input.draft);
            const practice = attempt.scenes.find(scene => scene.kind === "practice");
            practice.objectiveIndices = [1];
            toolCall = {name:tool.name,arguments:JSON.stringify(attempt)};
          } else {
            if(request.tool_choice !== "none") throw Error("Invalid lesson exceeded the bounded correction budget");
            message = "有目标尚未安排练习，未保存草稿。";
          }
        } else if(wire.mode === "no-effect" && stage === 0) {
          if(request.tool_choice?.function?.name !== "education_propose_natural_lesson") throw Error("False completion case did not bind the tool");
          message = "教案草稿已保存。";
        } else if (wire.mode === "consultation" && stage === 0) {
          if(tool?.parameters.required.includes("details")) throw Error("Ordinary consultation granted lesson draft binding");
          message = "板书把教学重点、示例和学生需要复述的线索留在同一视图。";
        } else throw Error("Unexpected model stage");
        wire.stages.push({ mode:wire.mode,stage,receipt,lessonTool:!!tool });
        const chunk=(delta,finish_reason=null)=>"data: "+ JSON.stringify({
          id:"lesson-from-chat",object:"chat.completion.chunk",created:0,model:request.model,choices:[{index:0,delta,finish_reason}],
        })+"\n\n";
        return new Response(chunk({role:"assistant"})+chunk(toolCall?{tool_calls:[{
          index:0,id:`owned-lesson-${wire.mode}-${stage}`,type:"function",function:toolCall,
        }]}:{content:message})+chunk({},toolCall?"tool_calls":"stop")+"data: [DONE]\n\n",
        {headers:{"Content-Type":"text/event-stream"}});
      } catch(error) { wire.errors.push(String(error)); throw error; }
    };
  }, { prompt, draft:draftInput, cold, live: useLive });
  const page = await app.firstWindow();
  await page.getByTestId("office-prompt-input").waitFor({ timeout: 60000 });
  await until(async () => !await page.getByTestId("office-prompt-input").isDisabled());
  return page;
}
async function send(page, text) {
  await page.getByTestId("office-prompt-input").fill(text);
  await page.getByRole("button",{name:"发送消息",exact:true}).click();
}

try {
  const page = await launch(false);
  await send(page, prompt);
  const record = await until(() => {
    const [saved] = query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'");
    if(saved) return saved;
    const [failed] = query("SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1");
    if(["failed","interrupted","succeeded"].includes(failed?.status)) throw Error(failed.error_message || failed.status);
  });
  const terminal = await until(async () => {
    const snapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), record.session_id);
    const turn = snapshot.projection?.turns.find(item => item.id === record.run_id);
    return !snapshot.running && turn?.status !== "running" ? turn : undefined;
  });
  assert.equal(terminal.status,"completed");
  const payload = JSON.parse(record.payload_json);
  if(useLive) {
    const {document} = payload;
    assert.equal(document.totalMinutes,45);
    assert.equal(document.scenes.reduce((sum,scene)=>sum+scene.durationMinutes,0),45);
    assert.equal(document.lesson.subject,"历史");
    assert.equal(document.lesson.grade,"七年级");
    assert(Object.keys(draft.lesson.details).every(key=>document.lesson.details[key].trim()));
    assert(document.lesson.missingSources.length>0);
    assert.deepEqual(document.lesson.mappings,[]);
    report.generatedDocument=document;
    report.wire=await app.evaluate(()=>globalThis.lessonDraftWire);
    assert.deepEqual(report.wire.errors,[]);
  } else {
    assert.deepEqual(payload.document,draft);
    const correction = await app.evaluate(() => globalThis.lessonDraftWire.durationCorrection);
    assert.equal(correction.error,"lesson_duration_mismatch");
    assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,1);
    check("Wrong scene subtotal is rejected with exact feedback, corrected once, and never saved as a second draft");
  }
  assert.equal(JSON.parse(record.result_json||"{}").state,"draft");
  assert.equal((payload.context.adopted||[]).length,0);
  const task = query("SELECT value_json FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:xitask_%'")
    .map(row => JSON.parse(row.value_json)).find(row => row.view.origin.runId === record.run_id);
  assert(task && task.view.sessionId === record.session_id,"Task and lesson must share the original run");
  check("Normal composer creates an owned teaching task and structured draft without selecting an invented source");

  await openLessonFromChat(page,record.id,record.id);
  assert.equal(await page.getByTestId("classroom-plan-detail").getAttribute("data-status"),"draft");
  const details = page.getByTestId("lesson-content-toggle");
  await details.locator("button[aria-expanded]").first().click();
  assert.equal(await details.getByTestId("lesson-detail-boardwork").inputValue(),payload.document.lesson.details.boardwork);
  await page.screenshot({path:path.join(root,"lesson-from-chat.png")});
  if(!useLive) {
    await page.getByTestId("classroom-plan-source-chat").click();
    await until(async () => !await page.getByTestId("office-prompt-input").isDisabled());
    await app.evaluate(()=>{globalThis.lessonDraftWire.mode="consultation";});
    await send(page,consultation);
    await until(async()=> (await app.evaluate(()=>globalThis.lessonDraftWire.stages)).some(stage=>stage.mode==="consultation"));
    report.wire=await app.evaluate(()=>globalThis.lessonDraftWire);
    assert.deepEqual(report.wire.errors,[]);
    assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,1);
    check("Original chat card opens the correct editor and a same-word consultation creates no second draft");
    await until(async () => {
      const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),record.session_id);
      return !snapshot.running;
    });
    const latestRun=query("SELECT id FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1")[0].id;
    await app.evaluate(()=>{globalThis.lessonDraftWire.mode="no-effect";});
    await send(page,"新任务：请生成一份五年级语文教案，题目为看见和推测。");
    const unsupported=await until(()=>{
      const [other]=query("SELECT id,status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1");
      return other?.id!==latestRun&&["failed","succeeded"].includes(other?.status)?other:null;
    });
    assert.equal(unsupported.status,"failed");
    assert.match(unsupported.error_message,/未保存成可编辑教案/);
    assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,1);
    check("A model claim without a persisted classroom draft is reported as a failed delivery");
    await until(async () => {
      const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),record.session_id);
      return !snapshot.running;
    });
    await app.evaluate(()=>{globalThis.lessonDraftWire.mode="no-coverage";});
    await send(page,"新任务：请生成一份五年级语文教案，主题为记录和判断。");
    const uncovered=await until(()=>{
      const [other]=query("SELECT id,status FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1");
      return other?.id!==unsupported.id&&["failed","succeeded"].includes(other.status)?other:null;
    });
    assert.equal(uncovered.status,"failed");
    const coverage=await app.evaluate(()=>globalThis.lessonDraftWire.coverageCorrection);
    assert.equal(coverage.error,"lesson_objective_coverage");
    assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,1);
    check("An objective assessed without prior practice names the missing link and cannot persist after the retry");

  } else check("Real model draft opens the original editor with its actual board plan and six populated fields");

  await app.close(); app=undefined;
  const cold=await launch(true);
  await openLessonFromChat(cold,record.id,record.id);
  assert.equal((await app.evaluate(()=>globalThis.lessonDraftWire.stages)).length,0);
  assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,1);
  check("Cold start opens the same stored lesson without replaying the provider request");
  report.ok = true;
} catch(error) {
  report.error = error.stack;
  if(app) report.wire = await app.evaluate(()=>globalThis.lessonDraftWire).catch(()=>null);
  const page = await app?.firstWindow().catch(()=>null);
  if(page) await page.screenshot({path:path.join(root,"failure.png")}).catch(()=>{});
  process.exitCode = 1;
} finally {
  await app?.close();
  fs.writeFileSync(path.join(root,"report.json"),JSON.stringify(report,null,2));
  console.log(root);
}
