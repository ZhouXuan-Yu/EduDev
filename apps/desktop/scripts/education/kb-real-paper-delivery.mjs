import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron} from 'playwright';
const output=process.argv[2];if(!path.isAbsolute(output)||!fs.existsSync(path.join(output,'ai-inspect-report.json')))throw Error('Pass the existing isolated real-material journey output');
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),data=path.join(output,'data'),profile=path.join(output,'profile'),root=path.join(output,'real-paper-exports'),ledger=path.join(output,'real-paper-cloud-ledger.json');
fs.mkdirSync(root,{recursive:true});
const report={output,root,checks:[],deliveries:[],rendererErrors:[],scope:'Actual isolated Electron UI and real DeepSeek Pi export. Automated teacher decisions exercise the test fixture only, not actual teacher sign-off or answer certification.'};
let app,page,session;
async function until(fn,ms=180000){const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await delay(500);}throw Error('Timed out');}
const sql=(query,params=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(query).all(...params);}finally{db.close();}};
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:data};for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY'].includes(key))delete env[key];
 Object.assign(env,{OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'});
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net,dialog},{ledger,root})=>{
  const fs=process.getBuiltinModule('fs');
  for(const owner of [globalThis,net]){const ordinary=owner.fetch.bind(owner);owner.fetch=async(url,options)=>{
   const target=new URL(typeof url==='string'?url:url.url||url.href);
   if(!/chat\/completions/.test(target.pathname))return ordinary(url,options);
   if(target.origin!=='https://api.deepseek.com'||!['/chat/completions','/v1/chat/completions'].includes(target.pathname))throw Error('Only the authorized DeepSeek account may be called');
   const rows=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];if(rows.length>=32)throw Error('Bounded delivery journey call ceiling reached');
   const body=JSON.parse(typeof options?.body==='string'?options.body:await url.clone().text());rows.push({call:rows.length+1,model:body.model,at:new Date().toISOString(),scope:'confirmed two-question paper export'});fs.writeFileSync(ledger,JSON.stringify(rows,null,2));
   const response=await ordinary(url,options);rows.at(-1).status=response.status;fs.writeFileSync(ledger,JSON.stringify(rows,null,2));return response;
  };}
  const original=dialog.showOpenDialog;dialog.showOpenDialog=async function(...args){const options=args.length>1?args[1]:args[0];if(/试卷保存文件夹|教学工作目录/.test(options?.title||''))return{canceled:false,filePaths:[root]};return original.apply(dialog,args);};
 },{ledger,root});
 page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.setViewportSize({width:1366,height:768});
 await page.getByRole('button',{name:'组卷',exact:true}).click();
 await page.getByTestId('paper-saved').filter({hasText:'真实资料物理流程核对 · 2题'}).first().click();await page.getByTestId('paper-question').nth(1).waitFor();
 if(!await page.getByTestId('paper-confirmed').count())await page.getByTestId('paper-confirm').click();await page.getByTestId('paper-confirmed').waitFor();report.checks.push('Controlled test teacher confirms the actual two-question source-only paper');
 const paper=sql("SELECT * FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' AND status='confirmed' ORDER BY created_at DESC,id DESC")[0];if(!paper)throw Error('Confirmed paper not persisted');session=paper.session_id;report.paper={id:paper.id,session,count:JSON.parse(paper.payload_json).selection.items.length};
 const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
 await page.getByTestId('paper-export-student-docx').click();await page.getByTestId('office-prompt-input').waitFor();
 await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===session);
 report.outputOnly=!(await snapshot()).workspace;if(!report.outputOnly)throw Error('This journey must exercise only the native paper-output grant');
 for(const[audience,format]of[['student','docx'],['teacher','docx'],['student','pdf'],['teacher','pdf']]){
  const filename='真实资料物理流程核对-'+audience+'.'+format,oldTurn=(await snapshot()).projection.turns.at(-1)?.id,input=page.getByTestId('office-prompt-input');
  await until(async()=>!await input.isDisabled());await input.fill(`请实际调用 education_export_paper，把本会话最新已确认试卷原样导出，audience=${audience}，format=${format}，path=${filename}。使用已授权的试卷保存位置，等待我审批；不要改题、重抄题或创建其他文件。`);await input.press('Enter');
  const row=await until(async()=>{const s=await snapshot(),row=s.officeArtifacts?.find(a=>a.path===filename&&a.state==='pending');if(row)return row;if(!s.running&&s.projection.turns.at(-1)?.id!==oldTurn)throw Error('Export ended without an approval draft: '+JSON.stringify(s.projection.turns.at(-1)));return false;});
  const card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${row.id}"]`);await card.getByTestId('pi-office-review').waitFor();await until(async()=>!await card.getByTestId('pi-office-approve').isDisabled());await card.getByTestId('pi-office-approve').click();
  const saved=await until(async()=>{const s=await snapshot(),item=s.officeArtifacts?.find(a=>a.id===row.id);return !s.running&&item?.state==='saved'?item:null;});
  const file=path.join(root,filename),bytes=fs.readFileSync(file),hash=createHash('sha256').update(bytes).digest('hex'),fact=sql('SELECT * FROM document_artifacts WHERE id=?',[saved.artifactId])[0];
  if(bytes.length<1000||fact?.content_hash!==hash)throw Error('Output bytes or persisted hash mismatch');
  const lineage=sql('SELECT * FROM document_artifact_paper_sources WHERE artifact_id=?',[saved.artifactId]);if(lineage.length!==1||lineage[0].audience!==audience||lineage[0].paper_digest!==JSON.parse(paper.result_json).digest)throw Error('Paper lineage mismatch');
  report.deliveries.push({audience,format,file,bytes:bytes.length,sha256:hash,artifactId:saved.artifactId});console.log(JSON.stringify(report.deliveries.at(-1)));
 }
 const selected=JSON.parse(paper.payload_json).selection.items.map(i=>i.question),expected=report.deliveries.map(d=>({path:path.basename(d.file),audience:d.audience,markers:selected.flatMap(q=>d.audience==='teacher'?[q.stem,q.answer,q.analysis]:[q.stem]),forbiddenMarkers:d.audience==='student'?selected.map(q=>q.analysis):[]}));
 const manifest=path.join(output,'real-paper-expected.json');fs.writeFileSync(manifest,JSON.stringify(expected));
 const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 report.fileReadback=JSON.parse(execFileSync(python,[path.join(desktop,'scripts/education/verify-paper-export.py'),root,manifest,output],{encoding:'utf8',windowsHide:true}));if(!report.fileReadback.success)throw Error('Independent Office readback failed');
 await page.screenshot({path:path.join(output,'real-paper-delivery.png'),fullPage:true});report.success=report.deliveries.length===4&&report.rendererErrors.length===0;
}catch(e){report.success=false;report.error=String(e.stack||e);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'real-paper-delivery-failure.png'),fullPage:true}).catch(()=>{});}
finally{if(app)await app.close();report.calls=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];fs.writeFileSync(path.join(output,'real-paper-delivery-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,error:report.error,calls:report.calls.length,deliveries:report.deliveries.length,output}));}
