import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {_electron} from 'playwright';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
import {productEntry} from '../product-navigation.mjs';

const [mode,output,corpus,account]=process.argv.slice(2);
if(!['prepare','run'].includes(mode)||!path.isAbsolute(output||''))throw Error('prepare|run ABS_OUTPUT [ABS_CORPUS ABS_ACCOUNT]');
const desktop=process.cwd(),data=path.join(output,'data'),profile=path.join(output,'profile');
const stateFile=path.join(output,'run-state.json'),controlFile=path.join(output,'control.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const save=async(name,value)=>{
 const target=path.join(output,name),pending=target+'.pending';
 await fs.writeFile(pending,JSON.stringify(value,null,2)+'\n');
 await fs.rename(pending,target);
};
if(mode==='prepare'){
 if(!path.isAbsolute(corpus||'')||!path.isAbsolute(account||''))throw Error('Absolute corpus and existing sealed account required');
 await fs.mkdir(output,{recursive:true});
 if(syncFs.existsSync(path.join(output,'prepared.json')))throw Error('Existing prepared run must be resumed');
 const events=(await fs.readFile(path.join(corpus,'manifest.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 const latest=[...new Map(events.filter(row=>row.id).map(row=>[row.id,row])).values()];
 const selected=new Map();
 for(const row of latest){
  if(!['downloaded','extracted'].includes(row.status)||!row.path||! /\.(pdf|docx|png|jpe?g|webp|bmp|txt|md)$/i.test(row.path))continue;
  if(!selected.has(row.sha256))selected.set(row.sha256,row);
 }
 const mapped=[];
 for(const row of selected.values()){
  const source=path.resolve(corpus,row.path),relative=path.relative(path.resolve(corpus),source);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid source path');
  const target=path.join(output,'input',row.stage,row.subject,row.id+'-'+path.basename(source));
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(source,target,syncFs.constants.COPYFILE_EXCL);
  if((await fs.stat(target)).size!==row.bytes)throw Error('Incomplete source copy');
  mapped.push({id:row.id,source,target,bytes:row.bytes,sha256:row.sha256});
 }
 await fs.mkdir(data);await fs.mkdir(profile);
 const localState=JSON.parse(await fs.readFile(path.join(account,'profile','Local State'),'utf8'));
 await fs.writeFile(path.join(profile,'Local State'),JSON.stringify({os_crypt:localState.os_crypt}));
 const sourceDb=new DatabaseSync(path.join(account,'data','app.db'),{readOnly:true});
 let settings;
 try{settings=sourceDb.prepare("SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'").get()?.value_json;}
 finally{sourceDb.close();}
 if(!settings||!JSON.parse(settings).sealedKey)throw Error('Existing sealed DeepSeek setting unavailable');
 const seed=new DatabaseSync(path.join(data,'app.db'));
 try{
  seed.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
  seed.prepare('INSERT INTO app_settings VALUES(?,?,?)').run('xiaozhi.provider.v1',settings,new Date().toISOString());
 }finally{seed.close();}
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
 const runtime=path.join(desktop,'test-results','corpus-flow-1gb','runtime-'+commit.slice(0,8));
 if(!syncFs.existsSync(runtime))await fs.cp(path.join(desktop,'out'),path.join(runtime,'out'),{recursive:true,errorOnExist:true,force:false});
 const entry=path.join(runtime,'out/main/index.js');
 await save('input-map.json',mapped);
 await save('prepared.json',{commit,entry,buildSha256:hash(await fs.readFile(entry)),files:mapped.length,
  bytes:mapped.reduce((total,row)=>total+row.bytes,0),input:path.join(output,'input'),data,profile,
  scope:'Real public Shanghai corpus, isolated original UI import and real DeepSeek; no response substitution'});
 console.log(JSON.stringify({prepared:true,output,files:mapped.length,bytes:mapped.reduce((total,row)=>total+row.bytes,0),commit}));
}else{
 const prepared=JSON.parse(await fs.readFile(path.join(output,'prepared.json'),'utf8'));
 if(hash(await fs.readFile(prepared.entry))!==prepared.buildSha256)throw Error('Frozen runtime changed');
 const state={output,startedAt:new Date().toISOString(),pid:process.pid,phase:'launching',rendererErrors:[]};
 let app,page,batchId,phase='importing',lastControl='';
 const read=(sql,params=[])=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(sql).all(...params);}finally{db.close();}
 };
 const snapshot=async()=>{
  state.updatedAt=new Date().toISOString();state.phase=phase;
  if(batchId){
   state.batchId=batchId;
   state.import=await page.evaluate(id=>window.omniEdu.listMaterialBatches({schemaVersion:'xiaozhi.material-import-batch.v1',offset:0}).then(result=>result.batches.find(batch=>batch.id===id)),batchId);
   state.resources=read('SELECT parse_status,parse_engine,COUNT(*) count FROM teacher_resources GROUP BY parse_status,parse_engine');
   state.questions=read('SELECT COUNT(*) count FROM question_bank_items')[0].count;
   state.ai=await page.evaluate(id=>window.omniEdu.getMaterialFolderAi({schemaVersion:'xiaozhi.material-folder-ai.v1',batchId:id}),batchId);
  }
  await save('run-state.json',state);
 };
 try{
  await save('run-state.json',state);
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
   OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
  for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
  app=await _electron.launch({args:[prepared.entry,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  const exports=path.join(output,'exports');await fs.mkdir(exports,{recursive:true});
  await app.evaluate(({dialog},root)=>{
   const original=dialog.showOpenDialog.bind(dialog);
   dialog.showOpenDialog=async(...args)=>{
    const options=args.length>1?args[1]:args[0];
    return /试卷保存文件夹|教学工作目录/.test(options?.title||'')?{canceled:false,filePaths:[root]}:original(...args);
   };
  },exports);
  page=await app.firstWindow();page.setDefaultTimeout(60000);
  page.on('pageerror',error=>{state.rendererErrors.push(String(error).slice(0,1500));});
  await productEntry(page,'materials').click();
  const existing=read('SELECT id FROM material_import_batches WHERE root_path=? ORDER BY created_at DESC LIMIT 1',[prepared.input])[0];
  if(existing){batchId=existing.id;phase='processing';}
  else{
   await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},prepared.input);
   await page.getByTestId('materials-import-folder').click();
  }
  for(;;){
   batchId??=read('SELECT id FROM material_import_batches WHERE root_path=? ORDER BY created_at DESC LIMIT 1',[prepared.input])[0]?.id;
   await snapshot();
   if(batchId&&['completed','partial','failed'].includes(state.import?.status)&&!state.ai){
    const card=page.getByTestId('folder-ai-'+batchId);
    await openMaterialDisclosure(page.getByTestId('materials-batches'));
    await openMaterialDisclosure(card);
    await card.getByTestId('folder-ai-open-authorization').click();
    await card.getByTestId('folder-ai-budget').fill('1000000');
    await card.getByTestId('folder-ai-mode').selectOption('quality');
    await card.getByTestId('folder-ai-public').check();
    await card.getByTestId('folder-ai-consent').check();
    await card.getByTestId('folder-ai-authorize').click();
    phase='processing';
   }
   if(syncFs.existsSync(controlFile)){
    const command=JSON.parse(await fs.readFile(controlFile,'utf8'));
    if(command.id!==lastControl){
     lastControl=command.id;
     if(command.action==='screenshot')await page.screenshot({path:path.join(output,'current.png'),fullPage:true});
     if(command.action==='inspect')await fs.writeFile(path.join(output,'ui-text.txt'),await page.locator('body').innerText());
     if(['pause','resume'].includes(command.action)){
      await productEntry(page,'materials').click();
      await openMaterialDisclosure(page.getByTestId('materials-batches'));
      const card=page.getByTestId('folder-ai-'+batchId);await openMaterialDisclosure(card);
      await card.getByTestId(command.action==='pause'?'folder-ai-pause':'folder-ai-resume').click();
     }
     if(command.action==='close'){phase='closed';await snapshot();await app.close();break;}
     state.lastControl=command.id;
    }
   }
   if(state.ai&&['complete','attention','configuration_changed','budget_exhausted'].includes(state.ai.status))phase='needs-chain-review';
   await new Promise(resolve=>setTimeout(resolve,15000));
  }
 }catch(error){
  state.phase='runner_error';state.error=String(error.stack||error);
  await save('run-state.json',state);
  await page?.screenshot({path:path.join(output,'runner-error.png'),fullPage:true}).catch(()=>{});
  console.error(JSON.stringify({output,error:state.error}));
  if(app){await fs.writeFile(path.join(output,'ui-text.txt'),await page.locator('body').innerText().catch(()=>''));await app.close();}
  process.exitCode=1;
 }
}
