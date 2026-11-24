import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { _electron } from "playwright";
import { testMain, assertIsolatedPiMain } from "../acceptance/build-root.mjs";
import { lessonDocument } from "./teaching-lesson-fixture.mjs";
import { lessonCard, openLessonFromChat } from "./teaching-lesson-task-journey.mjs";

const acceptance = process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance);
const useLive = process.env.OMNI_EDU_NATURAL_LESSON_LIVE === "1";
const testRevision = process.argv.includes("--revision");
const testAmbiguous = process.argv.includes("--ambiguous");
const testStageFields = process.argv.includes("--stage-fields");
const testAgenda = testStageFields || process.argv.includes("--agenda");
assert(!testRevision || !useLive);
assert(!testAmbiguous || testRevision);
assert(!testAgenda || !testRevision && !useLive);
const revisionBoardwork = "左侧列出观察事实，右侧列出解释与反例，中间用箭头连接证据。";
const revisedPractice = "学生独立写一条有依据的解释，再两人互查引用；各自指出一个未控制的条件。";
const stageEdits = {
  "agenda-stage-fields": {activity:"学生写下原文事实，再画线区分推测。",teacherPrompt:"哪一句原文事实能支持你的判断？"},
  "agenda-check-fields": {expectedEvidence:"从原文找出土壤条件不同的证据。",criterion:"引用真实线索，且说明未控制变量会影响归因。"},
  "agenda-check-choice": {checkPrompt:"选出一条原文事实，说明还要检查哪种其他因素。"},
};
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
const materials = [
  { title:"观察记录甲", text:"星期一我在操场附近看到两棵树。靠围墙的一棵得到更多日照。记录本上写着两棵树每周都浇了同样多的水。" },
  { title:"观察记录乙", text:"两棵树的树高记录只覆盖四周。我发现靠围墙一侧的泥土不同，无法排除土壤差异对树高变化也有影响。" },
];
const draftInput = {
  title:draft.title,totalMinutes:draft.totalMinutes,
  objectives:draft.objectives.map((goal,index)=>({goal,criterion:draft.lesson.goalCriteria[index]})),
  preparation:draft.lesson.preparation,details:{...draft.lesson.details},materials,
  scenes:draft.scenes.map(({title,activity,durationMinutes},index)=>{
    const {kind,objectiveIndices,teacherPrompt,checks}=draft.lesson.phases[index];
    return {title,kind,activity,durationMinutes,objectiveIndices,teacherPrompt,checks};
  }),
};
draft.lesson.details.content += materials.map(({title,text},index)=>
  `\n\n【模拟课堂材料 ${String.fromCharCode(65+index)}】${title}\n${text}`).join("");
const prompt = useLive
  ? "请编写一份七年级历史教案。整节课45分钟，主题是比较两份关于同一校史展品的回忆。请自拟两份简短、观点有出入的展品记录，明确标注为模拟史料。学生要区分史料记录与推断，并根据证据说明暂不能确认的结论。"
  : "请生成一份五年级语文教案，40分钟，主题是从观察到有依据的解释，包含正式教案的所有栏目。请自拟两份观察记录。";
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
        if(wire.mode === "clone") {
          if(stage===0){
            if(!tool) throw Error("Second draft did not use the original classroom tool");
            toolCall={name:tool.name,arguments:JSON.stringify({...input.draft,title:"独立的合成课观察复习",details:{...input.draft.details,boardwork:"第二份教案专用板书，保持原样。"}})};
          }else message="第二份独立教案草稿已保存。";
        } else if(wire.mode.startsWith("agenda-")) {
          const edit=request.tools?.find(entry=>entry.function.name==="education_propose_classroom_outline")?.function;
          const activity=wire.mode==="agenda-activity";
          const patch=input.stageEdits[wire.mode];
          const expectedFields=activity?["activity"]:wire.mode==="agenda-no-check"?["criterion"]:Object.keys(patch??{});
          if(JSON.stringify(edit?.parameters.required)!==JSON.stringify(expectedFields)) throw Error("Agenda tool admits unexpected fields");
          if(stage===0)toolCall={name:"education_read_classroom_plan",arguments:"{}"};
          else{
            const toolText=request.messages.filter(entry=>entry.role==="tool").at(-1)?.content||"{}";
            const rejectedExtraField=wire.mode==="agenda-stage-fields"&&stage===2&&
              toolText.startsWith('Validation failed for tool "education_propose_classroom_outline"')&&toolText.includes('objectiveIndices');
            const latest=rejectedExtraField?{success:false,error:"invalid_input"}:JSON.parse(toolText.split("\n")[0]);
            if(wire.mode==="agenda-conflict"){
              if(latest.error!=="lesson_timing_mismatch"||!latest.message.includes("40 分钟")||!latest.message.includes("43 分钟"))throw Error("Missing precise lesson-time mismatch");
              message=latest.message;
            }else if(wire.mode==="agenda-no-check"){
              if(latest.error!=="lesson_check_unresolved")throw Error("The missing check should stay unresolved");
              message=latest.message;
            }else if(wire.mode==="agenda-check-choice"&&stage===1){
              if(latest.error!=="lesson_check_required"||latest.choices.length!==3)throw Error("Three real check choices expected");
              toolCall={name:"ask_teacher",arguments:JSON.stringify({question:"请选择要修改的检查题。",options:latest.choices})};
            }else if(wire.mode==="agenda-check-choice"&&stage===2){
              toolCall={name:"education_read_classroom_plan",arguments:"{}"};
            }else if(wire.mode==="agenda-check-choice"&&stage===3){
              if(!latest.success||latest.stage.checkNumber!==2||latest.stage.check.criterion!==input.stageEdits["agenda-check-fields"].criterion)throw Error("Teacher selection did not bind check two of the current revision");
              toolCall={name:edit.name,arguments:JSON.stringify(patch)};
            }else if(wire.mode==="agenda-stage-fields"&&stage===1){
              if(!latest.success||latest.current.teacherPrompt!==input.draft.scenes[2].teacherPrompt)throw Error("Read did not return the existing teacher prompt");
              toolCall={name:edit.name,arguments:JSON.stringify({...patch,objectiveIndices:[0]})};
            }else if(wire.mode==="agenda-stage-fields"&&stage===2){
              if(latest.success!==false||latest.error!=="invalid_input")throw Error("Out-of-scope goal change was not rejected");
              toolCall={name:edit.name,arguments:JSON.stringify(patch)};
            }else if(wire.mode==="agenda-check-fields"&&stage===1){
              if(!latest.success||latest.stage.checkNumber!==2||latest.current.criterion!==input.draft.scenes[3].checks[1].criterion)throw Error("Read did not bind the explicit check number");
              toolCall={name:edit.name,arguments:JSON.stringify(patch)};
            }else if(stage===1){
              if(latest.success!==true)throw Error("Agenda reading failed: "+JSON.stringify(latest));
              if(activity && (latest.current.activity!==input.draft.scenes[2].activity||!latest.stage.teacherPrompt))throw Error("Activity context does not identify the existing practice stage");
              if(!activity && latest.proposedTotalMinutes!==(wire.mode==="agenda-total"?41:40))throw Error("Agenda did not calculate the expected lesson total");
              toolCall={name:edit.name,arguments:JSON.stringify(activity?{activity:input.revisedPractice}:{})};
            }else{
              if(latest.success!==true||latest.status!=="draft")throw Error("Agenda version did not save: "+JSON.stringify(latest));
              message="指定的教案环节已保存为下一版草稿，请打开教案核对。";
            }
          }
        } else if(wire.mode === "revision") {
          const methods = request.tools?.map(entry=>entry.function.name).sort();
          if(JSON.stringify(methods)!==JSON.stringify(["ask_teacher","education_propose_classroom_outline","education_read_classroom_plan"])) throw Error("Revision admitted a different tool set");
          const edit = request.tools.find(entry=>entry.function.name==="education_propose_classroom_outline").function;
          if(JSON.stringify(edit.parameters.required)!==JSON.stringify(["boardwork"])) throw Error("Revision schema is not limited to boardwork");
          const latest = request.messages.filter(entry=>entry.role==="tool").at(-1)?.content || "{}";
          const editStep=input.testAmbiguous&&stage>0?stage-2:stage;
          if(input.testAmbiguous&&stage===1){
            const candidates=JSON.parse(latest.split("\n")[0]);
            if(candidates.error!=="lesson_target_required" || candidates.choices?.length!==2) throw Error("Ambiguous target was not handed to the teacher");
            toolCall={name:"ask_teacher",arguments:JSON.stringify({question:"请选要修订的教案。",options:candidates.choices})};
          }else if(editStep===0) toolCall={name:"education_read_classroom_plan",arguments:"{}"};
          else if(editStep===1){
            if(JSON.parse(latest.split("\n")[0]).current?.boardwork!==input.draft.details.boardwork) throw Error("Revision tool did not read the original boardwork");
            toolCall={name:edit.name,arguments:JSON.stringify({boardwork:input.revisionBoardwork,homework:"不应保存的字段"})};
          }else if(editStep===2){
            if(latest.includes('"status":"draft"')) throw Error("The out-of-scope patch saved a draft");
            toolCall={name:edit.name,arguments:JSON.stringify({boardwork:input.revisionBoardwork})};
          }else if(editStep===3){
            receipt=JSON.parse(latest.split("\n")[0]);
            if(receipt.success!==true || receipt.revision!==2 || receipt.status!=="draft") throw Error("Revision did not return the new local draft receipt");
            message="教案第 2 版已保存为草稿，只修改了板书设计。";
          }else throw Error("Unexpected revision stage");
        } else if(wire.mode === "draft" && stage < 2) {
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
        } else if(wire.mode === "no-materials") {
          const attempt = structuredClone(input.draft);
          if(stage > 0) {
            const rejection = JSON.parse(request.messages.filter(item => item.role === "tool").at(-1)?.content?.split("\n")[0] || "{}");
            if(rejection.error !== "lesson_materials_incomplete" ||
               !(stage===1 ? rejection.message.includes("当前 materials 提交 0 份") : rejection.message.includes("材料 B 缺少独立正文"))) {
              throw Error("Missing exact materials correction receipt");
            }
            wire.materialsCorrection = rejection;
          }
          if(stage < 2) {
            attempt.materials = stage===0 ? [] : [attempt.materials[0],{...attempt.materials[1],text:attempt.materials[0].text}];
            toolCall = {name:tool.name,arguments:JSON.stringify(attempt)};
          } else {
            if(request.tool_choice !== "none") throw Error("Unusable materials exceeded the bounded correction budget");
            message = "自拟材料还缺正文，未保存草稿。";
          }
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
  }, { prompt, draft:draftInput, cold, live: useLive, revisionBoardwork, testAmbiguous, revisedPractice, stageEdits });
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
  const savedContent = payload.document.lesson.details.content;
  const bodies = savedContent.split(/【模拟课堂材料 [AB]】[^\r\n]+\n/u).slice(1).map(body=>body.trim());
  assert.equal(bodies.length,2);
  assert(bodies.every(body=>body.replace(/[^\p{L}\p{N}]/gu,"").length>=24));
  assert.notEqual(bodies[0],bodies[1]);
  report.materialBodies=bodies;
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
  const content = details.getByTestId("lesson-detail-content");
  assert.equal(await content.inputValue(),savedContent);
  await content.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(root,"lesson-from-chat.png")});
  check("Both labelled full texts are stored in the editable Teaching Content field");
  let expectedHead=record.id;
  if(testAgenda){
    await page.getByTestId("classroom-plan-source-chat").click();
    const cases=[
      ["agenda-activity","请只修改这份教案的练习环节活动，改为先独立写一条解释，再交流。", "succeeded"],
      ["agenda-conflict","请把这份教案的导入环节改为8分钟。", "failed"],
      ["agenda-time","请把这份教案的导入环节改为8分钟，练习环节改为7分钟。", "succeeded"],
      ["agenda-total","请把这份教案的总结环节改为6分钟，全课总时长改为41分钟。", "succeeded"],
    ];
    if(testStageFields)cases.push(
      ["agenda-stage-fields","请修改这份教案的练习环节的学生活动和教师提示语。让学生先区分原文事实和推测。", "succeeded"],
      ["agenda-check-fields",`请修改《${payload.document.title}》教案中的评价环节检查2的预期证据和判断标准。聚焦未控制的土壤条件。`, "succeeded"],
      ["agenda-check-choice","请修改这份教案的评价环节检查题。请把题干改得适合课堂口头回答。", "succeeded"],
      ["agenda-no-check","请修改这份教案的练习环节判断标准。", "failed"],
    );
    let previousRun=record.run_id;
    let expectedCount=1;
    const expected=structuredClone(payload.document);
    for(const [mode,text,status] of cases){
      await until(async()=>!await page.getByTestId("office-prompt-input").isDisabled());
      await app.evaluate((_electron,name)=>{globalThis.lessonDraftWire.mode=name;}, mode);
      await send(page,text);
      if(mode==="agenda-check-choice"){
        const panel=page.getByTestId("pi-composer-pending-panel");
        const question=panel.getByTestId("pi-teacher-question");
        await question.waitFor({state:"visible"});
        assert.equal(await page.getByTestId("pi-teacher-question").count(),1);
        assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,expectedCount);
        await page.screenshot({path:path.join(root,"lesson-check-choice.png")});
        await question.getByTestId("pi-question-option-1").click();
        await question.getByTestId("pi-question-submit").click();
      }
      const run=await until(()=>{
        const next=query("SELECT id,status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1")[0];
        return next?.id!==previousRun&&["failed","succeeded"].includes(next?.status)?next:undefined;
      });
      assert.equal(run.status,status,run.error_message);
      previousRun=run.id;
      const rows=query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_classroom_plan' ORDER BY rowid");
      if(mode==="agenda-conflict"){
        assert.equal(rows.length,expectedCount);
        const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),record.session_id);
        assert(snapshot.projection.turns.find(turn=>turn.id===run.id).items.some(item=>item.kind==='message'&&item.text.includes('43 分钟')));
        check("A 43-minute subtotal conflicting with the 40-minute plan is shown to the teacher and adds no revision");
      }else if(mode==="agenda-no-check"){
        assert.equal(rows.length,expectedCount);
        check("An absent evaluation check leaves the original revision unchanged");
      }else{
        assert.equal(rows.length,++expectedCount);
        if(mode==="agenda-activity")expected.scenes[2].activity=revisedPractice;
        if(mode==="agenda-time"){expected.scenes[0].durationMinutes=8;expected.scenes[2].durationMinutes=7;}
        if(mode==="agenda-total"){expected.scenes[4].durationMinutes=6;expected.totalMinutes=41;}
        if(mode==="agenda-stage-fields"){
          expected.scenes[2].activity=stageEdits[mode].activity;
          expected.lesson.phases[2].teacherPrompt=stageEdits[mode].teacherPrompt;
        }
        if(mode==="agenda-check-fields")Object.assign(expected.lesson.phases[3].checks[1],stageEdits[mode]);
        if(mode==="agenda-check-choice")expected.lesson.phases[3].checks[1].prompt=stageEdits[mode].checkPrompt;
        const row=rows.at(-1), version=JSON.parse(row.payload_json);
        assert.equal(version.previous,expectedHead);
        assert.equal(version.root,record.id);
        assert.equal(version.revision,rows.length);
        assert.deepEqual(version.document,expected);
        assert.deepEqual(version.context,payload.context);
        assert.equal(JSON.parse(row.result_json).state,"draft");
        expectedHead=row.id;
        const checks={
          "agenda-activity":"The requested practice activity changes only its original scene",
          "agenda-time":"Two named durations change and preserve the 40-minute subtotal",
          "agenda-total":"An explicit matching full-course total saves as 41 minutes",
          "agenda-stage-fields":"Activity and teacher prompt change together after rejecting an extra objective field",
          "agenda-check-fields":"The explicitly numbered check changes evidence and criterion only",
          "agenda-check-choice":"The composer popup binds check two and applies the change only after teacher selection",
        };
        check(checks[mode]);
      }
    }
    await until(()=>{
      const taskRow=query("SELECT value_json FROM app_settings WHERE key=?",`xiaozhi.task.v1:${task.view.id}`)[0];
      return taskRow&&JSON.parse(taskRow.value_json).view.lastRunId===previousRun;
    });
    await lessonCard(page,record.id).and(page.locator(`[data-plan-id="${expectedHead}"]`)).waitFor();
    await openLessonFromChat(page,record.id,expectedHead);
    await page.screenshot({path:path.join(root,"lesson-agenda-revision.png")});
    report.wire=await app.evaluate(()=>globalThis.lessonDraftWire);
    assert.deepEqual(report.wire.errors,[]);
  }else if(testRevision){
    await page.getByTestId("classroom-plan-source-chat").click();
    await until(async()=>!await page.getByTestId("office-prompt-input").isDisabled());
    let independent;
    if(testAmbiguous){
      await app.evaluate(()=>{globalThis.lessonDraftWire.mode="clone";});
      await send(page,"新任务：请生成一份独立的五年级语文教案，40分钟。主题是观察复习。");
      independent=await until(()=>{
        const [other]=query("SELECT c.* FROM ai_confirmation_items c JOIN ai_agent_runs r ON r.id=c.run_id WHERE c.action_type='pi_classroom_plan' AND c.id<>? AND r.status='succeeded'",record.id);
        return other;
      });
      await until(async()=>!(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),record.session_id)).running);
    }
    await app.evaluate(()=>{globalThis.lessonDraftWire.mode="revision";});
    await send(page,"请只修改这份教案的板书设计，改成左侧列观察、右侧列解释与反例，其他栏目保持原样。");
    if(testAmbiguous){
      const pending=page.getByTestId("pi-composer-pending-panel").getByTestId("pi-teacher-question");
      await pending.waitFor({timeout:60000});
      assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,2);
      await pending.getByRole("button").filter({hasText:payload.document.title}).click();
      await pending.getByTestId("pi-question-submit").click();
    }
    const nextRun=await until(()=>{
      const [row]=query("SELECT id,status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1");
      return row?.id!==(independent?.run_id||record.run_id)&&["failed","succeeded"].includes(row?.status)?row:undefined;
    });
    assert.equal(nextRun.status,"succeeded",nextRun.error_message);
    const saved=query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_classroom_plan' ORDER BY rowid");
    assert.equal(saved.length,testAmbiguous?3:2);
    const original=saved[0], revised=saved.at(-1);
    const version=JSON.parse(revised.payload_json);
    assert.equal(original.payload_json,record.payload_json);
    assert.equal(revised.run_id,nextRun.id);
    assert.equal(version.root,record.id);
    assert.equal(version.previous,record.id);
    assert.equal(version.revision,2);
    assert.deepEqual(version.context,payload.context);
    const expected=structuredClone(payload.document);
    expected.lesson.details.boardwork=revisionBoardwork;
    assert.deepEqual(version.document,expected);
    assert.equal(JSON.parse(revised.result_json).state,"draft");
    const finalTask=query("SELECT value_json FROM app_settings WHERE key=?",`xiaozhi.task.v1:${task.view.id}`)[0];
    if(testAmbiguous){
      assert.equal(saved[1].payload_json,independent.payload_json);
      const prior=JSON.parse(finalTask.value_json).view;
      assert.equal(prior.lastRunId??prior.origin.runId,record.run_id);
      assert.equal(prior.requirementsVersion,task.view.requirementsVersion);
      const sibling=query("SELECT value_json FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:xitask_%'")
        .map(row=>JSON.parse(row.value_json).view).find(view=>view.origin.runId===independent.run_id);
      assert.equal(sibling.lastRunId??sibling.origin.runId,independent.run_id);
      check("Two drafts require the existing teacher-selection popup; choosing the older one changes neither independent draft nor task");
    }else assert.equal(JSON.parse(finalTask.value_json).view.lastRunId,nextRun.id);
    await until(async()=>!(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),record.session_id)).running);
    expectedHead=revised.id;
    await lessonCard(page,record.id).and(page.locator(`[data-plan-id="${expectedHead}"]`)).waitFor({timeout:30000});
    await openLessonFromChat(page,record.id,expectedHead);
    const fields=page.getByTestId("lesson-content-toggle");
    await fields.locator("button[aria-expanded]").first().click();
    assert.equal(await fields.getByTestId("lesson-detail-boardwork").inputValue(),revisionBoardwork);
    await page.screenshot({path:path.join(root,"lesson-local-revision.png")});
    report.wire=await app.evaluate(()=>globalThis.lessonDraftWire);
    assert.deepEqual(report.wire.errors,[]);
    check("Natural revision rejects an extra field, preserves the original task, lesson and evidence, and opens the exact next draft");
  }else if(!useLive) {
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
    await until(async () => !(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),record.session_id)).running);
    await app.evaluate(()=>{globalThis.lessonDraftWire.mode="no-materials";});
    await send(page,"新任务：请生成一份五年级语文教案。请自拟两份模拟材料。");
    const missing=await until(()=>{
      const [other]=query("SELECT id,status FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1");
      return other?.id!==uncovered.id&&["failed","succeeded"].includes(other.status)?other:null;
    });
    assert.equal(missing.status,"failed");
    const correction=await app.evaluate(()=>globalThis.lessonDraftWire.materialsCorrection);
    assert.equal(correction.error,"lesson_materials_incomplete");
    assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,1);
    check("Missing and duplicated source bodies are rejected before saving, with no silent extra retries");

  } else check("Real model draft opens the original editor with its actual board plan and six populated fields");

  await app.close(); app=undefined;
  const cold=await launch(true);
  await openLessonFromChat(cold,record.id,expectedHead);
  const coldDetails = cold.getByTestId("lesson-content-toggle");
  await coldDetails.locator("button[aria-expanded]").first().click();
  assert.equal(await coldDetails.getByTestId("lesson-detail-content").inputValue(),savedContent);
  if(testStageFields){
    const practice=cold.getByTestId("lesson-phase-lesson-3");
    await practice.locator("button[aria-expanded]").first().click();
    assert.equal(await practice.getByTestId("lesson-teacher-prompt-lesson-3").inputValue(),stageEdits["agenda-stage-fields"].teacherPrompt);
    const evaluation=cold.getByTestId("lesson-phase-lesson-4");
    await evaluation.locator("button[aria-expanded]").first().click();
    const selectedCheck=evaluation.locator("section").filter({has:cold.getByText("检查2",{exact:true})});
    const fields=selectedCheck.locator("textarea");
    assert.equal(await fields.count(),3);
    const expected=[stageEdits["agenda-check-choice"].checkPrompt,stageEdits["agenda-check-fields"].expectedEvidence,stageEdits["agenda-check-fields"].criterion];
    for(const [index,value] of expected.entries())assert.equal(await fields.nth(index).inputValue(),value);
    const window=await app.browserWindow(cold);
    for(const [width,height] of [[1366,768],[1920,1080]]){
      await window.evaluate((win,size)=>win.setContentSize(...size),[width,height]);
      await cold.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
      await fields.last().scrollIntoViewIfNeeded();
      await cold.screenshot({path:path.join(root,`lesson-assessment-cold-${width}.png`)});
    }
  }
  assert.equal((await app.evaluate(()=>globalThis.lessonDraftWire.stages)).length,0);
  assert.equal(query("SELECT id FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").length,testStageFields?7:testAgenda?4:testAmbiguous?3:testRevision?2:1);
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
