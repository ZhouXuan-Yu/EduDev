import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {productEntry} from '../product-navigation.mjs';

const [fixtures,evidence,mode]=process.argv.slice(2);
assert([fixtures,evidence].every(value=>value&&path.isAbsolute(value)));
assert(mode===undefined||mode==='J01'||mode==='J02'||mode==='low-disk');
const lowDisk=mode==='low-disk',journey=lowDisk?undefined:mode;
if(journey)assert(process.env.DEEPSEEK_API_KEY,'Built-in credential is required for the fixed journey probe');
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const root=fs.mkdtempSync(path.join(fs.realpathSync(evidence),'provider-question-fixture-'));
const scratch=process.env.OMNI_EDU_ACCEPTANCE_SCRATCH;
if(scratch)assert(path.isAbsolute(scratch),'Acceptance scratch must be an absolute directory');
const runtime=scratch?fs.mkdtempSync(path.join(fs.realpathSync(scratch),'edudev-provider-probe-')):root;
const data=path.join(runtime,'data'),profile=path.join(runtime,'profile');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=fs.readFileSync(path.join(fixtures,'questions.csv'));
const [header,...lines]=bytes.toString('utf8').trim().split(/\r?\n/u);
assert.equal(header,'id,stem,answer,points,source,subject,grade,knowledgePoint,questionType');
const fixturesById=lines.map(line=>{
  const fields=line.split(',');
  assert.equal(fields.length,9,'The frozen CSV uses unquoted fields');
  const [id,stem,answer,points,sourceTitle,subject,grade,knowledgePoint,questionType]=fields;
  assert(/^Q\d{2}$/u.test(id)&&stem&&answer&&Number(points)>0&&/^SYN-EQ-[AB]$/u.test(sourceTitle));
  return {id,points:Number(points),input:{stem,answer,sourceTitle,subject,grade,knowledgePoint,questionType,sourceKind:'teacher_resource',tags:[id]}};
});
assert.equal(fixturesById.length,8);
assert.equal(new Set(fixturesById.map(item=>item.id)).size,8);
const sourceFiles=[...new Set(fixturesById.map(item=>item.input.sourceTitle))].map(sourceTitle=>{
  const rows=fixturesById.filter(item=>item.input.sourceTitle===sourceTitle);
  const body=['# '+sourceTitle,'原创合成资料。',...rows.map(({id,input,points})=>
    id+' '+input.stem+'（'+points+' 分）\n答案：'+input.answer)].join('\n\n')+'\n';
  const file=path.join(root,sourceTitle+'.md');
  fs.writeFileSync(file,body);
  return {sourceTitle,file,hash:sha(body)};
});
const report={ok:false,root,runtime,build:sha(fs.readFileSync(main)),csvSha256:sha(bytes),sources:sourceFiles,questions:[],paidCalls:0};
const note=journey==='J02'?path.join(root,'SYN-LESSON-01.txt'):undefined;
if(note)fs.copyFileSync(path.join(fixtures,'lesson-source.txt'),note);
let app, page;
function rows(sql,...values) {
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(sql).all(...values);}finally{db.close();}
}
try {
  const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>
    !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(name)));
  if(journey)Object.assign(env,{DEEPSEEK_API_KEY:process.env.DEEPSEEK_API_KEY,DEEPSEEK_MODEL:process.env.DEEPSEEK_MODEL||'deepseek-flash'});
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',TEMP:runtime,TMP:runtime});
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  await assertIsolatedPiMain(app,main,profile);
  const files=[...sourceFiles.map(source=>source.file),...(note?[note]:[])];
  await app.evaluate(({dialog},files)=>{
    globalThis.journeyImportDialogs=0;
    dialog.showOpenDialog=async()=>{
      globalThis.journeyImportDialogs++;
      return {canceled:false,filePaths:files};
    };
  },files);
  page=await app.firstWindow();
  await productEntry(page,'materials').click();
  if(lowDisk){
    await app.evaluate((_electron,folder)=>{
      const promises=process.getBuiltinModule('node:fs/promises');
      const {syncBuiltinESMExports}=process.getBuiltinModule('node:module');
      const statfs=promises.statfs;
      promises.statfs=async function(target,...options){
        const actual=await statfs.call(this,target,...options);
        return target===folder?{...actual,bavail:0}:actual;
      };
      syncBuiltinESMExports();
      globalThis.restoreProbeDiskCapacity=()=>{promises.statfs=statfs;syncBuiltinESMExports();};
    },path.join(data,'teacher_resources'));
    await page.getByTestId('materials-import').click();
    const failures=page.getByTestId('materials-import-failures');
    await failures.waitFor({timeout:15000});
    report.diskFailureText=await failures.innerText();
    await page.screenshot({path:path.join(root,'disk-full.png')});
    assert.deepEqual(report.diskFailureText.split(/\r?\n/u),sourceFiles.map(source=>
      path.basename(source.file)+'：磁盘空间不足，请释放空间后重试。'));
    assert.equal(rows('SELECT COUNT(*) AS total FROM teacher_resources')[0].total,0);
    assert.deepEqual(fs.readdirSync(path.join(data,'teacher_resources')),[]);
    await app.evaluate(()=>globalThis.restoreProbeDiskCapacity());
  }
  await page.getByTestId('materials-import').click();
  const deadline=Date.now()+60000;
  while(Date.now()<deadline) {
    const resources=rows('SELECT id,original_file_name,local_path,parse_status FROM teacher_resources');
    if(resources.length===files.length&&resources.every(row=>row.parse_status==='ready')){
      for(const source of sourceFiles){
        const resource=resources.find(row=>row.original_file_name===path.basename(source.file));
        assert(resource);
        assert.equal(sha(fs.readFileSync(resource.local_path)),source.hash);
        source.resourceId=resource.id;
      }
      if(note){
        const material=resources.find(row=>row.original_file_name===path.basename(note));
        assert(material&&sha(fs.readFileSync(material.local_path))===sha(fs.readFileSync(note)));
        report.lessonSource=material.id;
      }
      break;
    }
    await delay(200);
  }
  assert(sourceFiles.every(source=>source.resourceId),'Both named resources must be persisted and parsed');
  if(note)assert(report.lessonSource,'The named lesson must be persisted and parsed');
  for(const {id,points,input} of fixturesById) {
    const item=await page.evaluate(input=>window.omniEdu.createQuestionBankItem(input),input);
    const [saved]=rows('SELECT stem,answer,source_title,source_kind,tags FROM question_bank_items WHERE id=?',item.id);
    assert.deepEqual([saved.stem,saved.answer,saved.source_title,saved.source_kind,JSON.parse(saved.tags)],
      [input.stem,input.answer,input.sourceTitle,input.sourceKind,[id]]);
    report.questions.push({fixtureId:id,id:item.id,points,source:input.sourceTitle});
  }
  assert.equal(rows('SELECT COUNT(*) AS total FROM question_bank_items')[0].total,8);
  if(journey){
    await app.evaluate(({net})=>{
      const remote=net.fetch.bind(net);
      const wire=globalThis.journeyProbeWire=[];
      globalThis.fetch=async()=>{throw Error('Use the owned Electron transport');};
      net.fetch=async(address,options)=>{
        const target=new URL(typeof address==='string'?address:address.url);
        const method=options?.method?.toUpperCase()??'GET';
        const completion=target.pathname.endsWith('/chat/completions')&&method==='POST';
        const catalogue=target.pathname.endsWith('/models')&&method==='GET';
        if(target.origin!=='https://api.deepseek.com'||(!completion&&!catalogue))
          throw Error('External operation outside the fixed journey');
        if(wire.filter(item=>item.completion===completion).length>=(completion?10:3))
          throw Error('Fixed journey request ceiling');
        const body=completion&&typeof options?.body==='string'?JSON.parse(options.body):null;
        const record={completion,status:null,model:body?.model,tools:body?.tools?.map(tool=>tool.function?.name)};
        wire.push(record);
        const response=await remote(address,options);
        record.status=response.status;
        return response;
      };
    });
    const line=fs.readFileSync(path.join(fixtures,'journeys.md'),'utf8').split(/\r?\n/u).find(line=>line.startsWith('| '+journey+' '));
    const prompt=line?.match(/“([^”]+)”/u)?.[1];
    assert(prompt);
    report.journey={id:journey,prompt,draft:null};
    await productEntry(page,'ask').click();
    await page.getByTestId('office-prompt-input').fill(prompt);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const draftDeadline=Date.now()+160000;
    while(Date.now()<draftDeadline){
      const [draft]=journey==='J01'
        ?rows("SELECT id,status,payload_json FROM ai_confirmation_items WHERE action_type='pi_paper_candidate'")
        :rows('SELECT book_id AS id,run_id,material_sources_json FROM teaching_handout_origins');
      if(draft)report.journey.draft=draft;
      const [question]=rows("SELECT payload_json FROM xiaozhi_pi_controls WHERE kind='question' AND state='pending'");
      if(question){report.journey.teacherQuestion=JSON.parse(question.payload_json).text;break;}
      const [run]=rows('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1');
      if(run&&run.status!=='running'){report.journey.terminal=run;break;}
      await delay(180);
    }
    report.journey.receipts=rows('SELECT tool,phase,success FROM xiaozhi_tool_receipts ORDER BY rowid');
    assert(report.journey.draft,'The fixed journey stopped before it saved a draft');
    assert.equal(report.journey.terminal?.status,'succeeded','Draft creation must reach a terminal successful run');
    if(journey==='J02')assert(report.journey.receipts.some(receipt=>
      receipt.tool==='education_create_teaching_handout'&&receipt.phase==='settled'&&receipt.success===1));
  }
  report.ok=true;
}catch(error){
  report.error=String(error.stack??error);
  await page?.screenshot({path:path.join(root,'failure.png'),timeout:5000}).catch(()=>undefined);
  process.exitCode=1;
}
finally {
  if(app){
    report.wire=await app.evaluate(()=>globalThis.journeyProbeWire).catch(()=>[])??[];
    report.paidCalls=report.wire.filter(item=>item.completion).length;
    report.importDialogs=await app.evaluate(()=>globalThis.journeyImportDialogs).catch(()=>undefined);
  }
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,root,questions:report.questions.length,error:report.error}));
}
