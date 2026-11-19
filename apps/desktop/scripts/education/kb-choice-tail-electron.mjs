import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync,backup} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const from=fs.realpathSync(process.argv[2]);
assert.equal(path.basename(path.dirname(from)),'flow-1gb-20261111');
assert.equal(path.basename(from),'data');
const output=fs.mkdtempSync(path.resolve('test-results','choice-tail-ui-')),data=path.join(output,'data');
console.log('OUTPUT '+output);
fs.mkdirSync(data);
const sha=value=>createHash('sha256').update(value).digest('hex');
const original=new DatabaseSync(path.join(from,'app.db'),{readOnly:true});
const old='aibatch_beeb42f0-318b-4fd2-a7e5-bd009f640e4c';
const saved=original.prepare('SELECT * FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(old),unit=JSON.parse(saved.input_json);
const resource=original.prepare('SELECT * FROM teacher_resources WHERE id=?').get(unit.pageSource.resourceId);
const page3=JSON.parse(original.prepare('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=3').get(unit.pageSource.generation).result_json);
const tail=page3.text.slice(0,page3.text.indexOf('\n6.')).trim();
const head=unit.text.slice(unit.text.lastIndexOf('\n5. ')+1).split('\n')[0],stem=head.replace(/^5\.\s*/,'')+'\n'+tail;
assert(head.startsWith('5. ')&&tail.startsWith('A. ')&&tail.includes('\nD.'));
assert.equal(sha(fs.readFileSync(resource.local_path)),resource.content_hash);
await backup(original,path.join(data,'app.db'));original.close();
const destination=path.join(data,'teacher_resources');
fs.mkdirSync(destination);
const file=path.join(destination,path.basename(resource.local_path));
fs.copyFileSync(resource.local_path,file);
for(const dir of ['material-layout','material-page-blocks']){
 const target=path.join(data,'cache',dir);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.cpSync(path.join(from,'cache',dir),target,{recursive:true,errorOnExist:true,force:false});
}
const init=new DatabaseSync(path.join(data,'app.db'));
init.prepare('UPDATE teacher_resources SET local_path=? WHERE id=?').run(file,resource.id);
assert.equal(init.prepare("SELECT COUNT(*) n FROM material_ai_batches WHERE status IN ('running','pending')").get().n,0);
assert.equal(init.prepare("SELECT COUNT(*) n FROM material_folder_ai WHERE status='running'").get().n,0);
init.close();
const sql=(q,args=[])=>{const ro=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return ro.prepare(q).all(...args);}finally{ro.close();}};
const oldFacts=()=>sha(JSON.stringify(sql('SELECT * FROM material_ai_units WHERE batch_id=? ORDER BY ordinal',[old])));
const baseline=oldFacts();
const ledger=path.join(output,'provider.json'),stubErrors=path.join(output,'provider-errors.txt');
const report={output,success:false,checks:[],rendererErrors:[],buildSha256:sha(fs.readFileSync('out/main/index.js')),networkModelCalls:0};
let app,page,batchId;
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_VISIBLE:'0'};
 for(const key of ['DEEPSEEK_API_KEY','ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','OMNI_EDU_AI_CONTINUATION_CHOICES','OMNI_EDU_AI_SOURCE_READING'])delete env[key];
 app=await _electron.launch({args:[path.resolve('out/main/index.js'),'--user-data-dir='+path.join(output,'profile')],env,cwd:process.cwd(),timeout:90000});
 await app.evaluate(({net},{head,tail,stem,page3,ledger,stubErrors,cold})=>{
  const fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto');
  const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
  for(const owner of [net,globalThis]){
   const invoke=owner.fetch.bind(owner);
   owner.fetch=(url,options)=>{
    if(!String(url).includes('api.deepseek.com'))return invoke(url,options);
    if(/\/models$/.test(String(url)))return Promise.resolve(new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',input_modalities:['text','image'],context_window:1048576,max_output_tokens:65536}]})));
    if(cold||!String(url).includes('/chat/completions'))throw Error('Unexpected provider request during cold validation');
    try{
     const request=JSON.parse(options.body),p=JSON.parse(request.messages[1].content[0].text);
     const before=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];
     if(before.length>=6)throw Error('Unexpected seventh request');
     const current=p.pageContext.continuation?.number==='5'||p.firstDraft?.questions?.some(q=>q.number==='5');
     const sourceOnly=p.phase==='仅转录原图来源，不解题';
     const first=!p.firstDraft;
     const labels=['statement','formulas','tables','figures','choices','subquestions'];
     const present=key=>['statement','formulas','choices'].includes(key);
     let body;
     if(!first&&!current&&p.cropReview?.questions&&!p.cropReview.questions.length){
      const wire=request.messages[0].content.includes('xiaozhi.material-ai-literal.v5')?'xiaozhi.material-ai-literal.v5':'xiaozhi.material-ai-literal.v4';
      body={schemaVersion:wire,pageText:page3,pageIssues:[],questions:[]};
     }else if(first||!p.cropReview?.questions?.length){
      const block=current?p.pageContext.blockTexts.find(x=>/^\s*5[.．、]/u.test(x.text)):null;
      if(current&&(!block||p.pageContext.continuation.policy!=='page-continuation.choices.v1'||p.pageContext.continuation.text!==tail))throw Error('Actual crop selection did not select the entire real option group');
      const question={number:'5',stem,answer:'A',analysis:'对照原页保留题面，答案仅供受控测试。',subject:'物理',grade:'九年级',knowledgePoint:'欧姆定律',questionType:'单选题',difficulty:'medium',answerOrigin:'ai_generated',analysisOrigin:'ai_generated',requiresImage:false,issues:[],
       projection:Object.fromEntries(labels.map(key=>[key,{state:present(key)?'provided':'not_applicable',text:present(key)?stem:''}]))};
      body={schemaVersion:'xiaozhi.material-ai-page-readings.v2',outcome:current?'questions':'no_questions',questions:current?[question]:[],pageText:current?'5. '+stem:page3,pageIssues:[],fragments:current?[{number:'5',complete:true,blockIds:[block.blockId]}]:[],readings:[]};
     }else{
      const crops=p.cropReview.questions[0]?.crops||[];
      if(!current||crops.length!==2||!request.messages[0].content.includes('[跨页选项 page-continuation.choices.v1]'))throw Error('Actual literal reply must receive both owned crops');
      const wire=request.messages[0].content.includes('xiaozhi.material-ai-literal.v5')?'xiaozhi.material-ai-literal.v5':'xiaozhi.material-ai-literal.v4';
      body={schemaVersion:wire,pageText:'5. '+stem,pageIssues:[],questions:[{number:'5',crops:[{index:0,text:head,issues:[]},{index:1,text:tail,issues:[]}],
       coverage:{formulas:'provided',tables:'not_applicable',choices:'provided',subquestions:'not_applicable'},figure:{state:'not_applicable',text:''},requiresImage:false,issues:[],
       answer:{origin:sourceOnly?'missing':'ai_generated',text:sourceOnly?'':'A'},analysis:{origin:sourceOnly?'missing':'ai_generated',text:sourceOnly?'':'对照原页保留题面，答案仅供受控测试。'}}]};
     }
     const images=request.messages[1].content.filter(x=>x.type==='image_url').map(x=>sha(Buffer.from(x.image_url.url.split(',')[1],'base64')));
     before.push({first,current,sourceOnly,policy:p.pageContext.continuation?.policy,sha:sha(JSON.stringify(body)),images});
     fs.writeFileSync(ledger,JSON.stringify(before));
     return Promise.resolve(new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(body)}}]})));
    }catch(error){
     fs.appendFileSync(stubErrors,String(error.stack||error)+'\n');throw error;
    }
   };
  }
 },{head,tail,stem,page3:page3.text,ledger,stubErrors,cold});
 page=await app.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.rendererErrors.push(e.message));
}
async function until(test,limit=180000){
 const end=Date.now()+limit;
 while(Date.now()<end){const value=await test();if(value)return value;await new Promise(r=>setTimeout(r,350));}
 throw Error('Timed out before the persisted acceptance condition');
}
try{
 await launch();
 const settings=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings().then(s=>window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:s.value.version,defaultModel:'deepseek-flash',apiKey:'controlled-choice-tail-no-cloud'})));
 assert(settings.ok);
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill(resource.title);
 await page.getByTestId('materials-refresh').click();
 await page.getByTestId('material-'+resource.id).getByRole('button').click();
 await page.getByRole('button',{name:'题目与校正',exact:true}).click();
 await openMaterialDisclosure(page.getByTestId('material-structure-panel'));
 const panel=page.getByTestId('material-ai-panel');
 await openMaterialDisclosure(panel);
 await panel.getByTestId('material-ai-start').fill('2');
 await panel.getByTestId('material-ai-count').fill('2');
 await panel.getByTestId('material-ai-budget').fill('6');
 await panel.getByTestId('material-ai-images').check();
 await panel.getByTestId('material-ai-public').check();
 await panel.getByTestId('material-ai-consent').check();
 const oldIds=new Set(sql('SELECT id FROM material_ai_batches').map(x=>x.id));
 await panel.getByTestId('material-ai-create').click();
 batchId=await until(async()=>{
  const row=sql('SELECT id FROM material_ai_batches WHERE resource_id=? ORDER BY created_at DESC',[resource.id]).find(row=>!oldIds.has(row.id));
  if(row)return row.id;
  if(await panel.getByRole('alert').count())throw Error(await panel.getByRole('alert').first().innerText());
 });
 report.batchId=batchId;
 const units=await until(()=>{
  const rows=sql('SELECT * FROM material_ai_units WHERE batch_id=? ORDER BY ordinal',[batchId]);
  fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(rows.map(r=>({ordinal:r.ordinal,status:r.status,error:r.error}))));
  if(rows.some(r=>['failed','outcome_unknown'].includes(r.status)))throw Error(JSON.stringify(rows.map(r=>({status:r.status,error:r.error}))));
  return rows.length===2&&rows.every(r=>['review','complete','no_questions'].includes(r.status))&&rows;
 });
 const extra=JSON.parse(units[0].input_json).pagePrompt.continuation;
 assert.equal(extra.schemaVersion,'page-continuation.choices.v1');
 assert.equal(extra.source.page,3);assert.equal(extra.nextNumber,'6');
 assert.deepEqual(extra.blockIds,['block-1']);assert.equal(extra.text,tail);
 const attempts=JSON.parse(fs.readFileSync(ledger,'utf8'));
 assert.equal(attempts.filter(r=>r.current).length,3);
 assert(attempts.filter(r=>r.current).every(r=>r.images.includes(extra.image.sha256)));
 report.controlledCalls=attempts.length;
 const q=sql(`SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=? AND m.ordinal=1 AND m.number='5'`,[batchId])[0];
 assert(q&&q.stem===stem);assert.equal(q.stem.includes('某导线的电阻为'),false);
 const archive=JSON.parse(q.archive_json);
 report.archived={state:archive.state,issues:archive.issues,completeDocument:!!q.document_json};
 assert(q.document_json,JSON.stringify(report.archived));
 assert.deepEqual(JSON.parse(q.document_json).blocks.filter(b=>b.kind==='image').map(b=>b.anchors[0].page),[2,3]);
 const crops=sql('SELECT * FROM material_ai_page_crops WHERE batch_id=? AND ordinal=1 AND number=?',[batchId,'5'])[0];
 assert.deepEqual(JSON.parse(crops.image_json).fragments.map(f=>f.image.page),[2,3]);
 report.checks.push('Real PDF second and third pages produced exactly one selected parent with every option and one image per page; no following parent text');
 await app.close();app=undefined;await launch(true);
 const view=await page.evaluate(input=>window.omniEdu.getMaterialAiPage(input),{schemaVersion:'xiaozhi.material-ai-page.v1',batchId,ordinal:1});
 assert.equal(view.continuation.source.page,3);assert.equal(view.continuation.ocrText,tail);
 assert(view.sourceReadings.some(r=>r.number==='5'&&r.crops.some(c=>c.text===tail)));
 const crop=await page.evaluate(input=>window.omniEdu.getMaterialAiPage(input),{schemaVersion:'xiaozhi.material-ai-page.v1',batchId,ordinal:1,cropPreview:{number:'5',index:1}});
 assert(crop.cropPreview);
 assert.equal(sha(Buffer.from(crop.cropPreview.dataUrl.split(',')[1],'base64')),extra.image.sha256);
 assert.equal(oldFacts(),baseline);
 assert.equal(sha(fs.readFileSync(file)),resource.content_hash);
 assert.equal(JSON.parse(fs.readFileSync(ledger,'utf8')).length,attempts.length);
 assert.deepEqual(report.rendererErrors,[]);
 report.checks.push('Cold typed source reader revalidates the exact next-page crop PNG, original PDF and prior response facts');
 report.success=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{
 await app?.close();
 fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
