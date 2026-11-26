import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {productEntry} from '../product-navigation.mjs';

const [fixtures,evidence]=process.argv.slice(2);
assert([fixtures,evidence].every(value=>value&&path.isAbsolute(value)));
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const root=fs.mkdtempSync(path.join(fs.realpathSync(evidence),'provider-question-fixture-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
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
const report={ok:false,root,build:sha(fs.readFileSync(main)),csvSha256:sha(bytes),sources:sourceFiles,questions:[],paidCalls:0};
let app;
function rows(sql,...values) {
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(sql).all(...values);}finally{db.close();}
}
try {
  const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>
    !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(name)));
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',TEMP:root,TMP:root});
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({dialog,net},files)=>{
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});
    net.fetch=async()=>{throw Error('The fixed question preparation is offline');};
  },sourceFiles.map(source=>source.file));
  const page=await app.firstWindow();
  await productEntry(page,'materials').click();
  await page.getByTestId('materials-import').click();
  const deadline=Date.now()+60000;
  while(Date.now()<deadline) {
    const resources=rows('SELECT id,original_file_name,local_path,parse_status FROM teacher_resources');
    if(resources.length===sourceFiles.length&&resources.every(row=>row.parse_status==='ready')){
      for(const source of sourceFiles){
        const resource=resources.find(row=>row.original_file_name===path.basename(source.file));
        assert(resource);
        assert.equal(sha(fs.readFileSync(resource.local_path)),source.hash);
        source.resourceId=resource.id;
      }
      break;
    }
    await delay(200);
  }
  assert(sourceFiles.every(source=>source.resourceId),'Both named resources must be persisted and parsed');
  for(const {id,points,input} of fixturesById) {
    const item=await page.evaluate(input=>window.omniEdu.createQuestionBankItem(input),input);
    const [saved]=rows('SELECT stem,answer,source_title,source_kind,tags FROM question_bank_items WHERE id=?',item.id);
    assert.deepEqual([saved.stem,saved.answer,saved.source_title,saved.source_kind,JSON.parse(saved.tags)],
      [input.stem,input.answer,input.sourceTitle,input.sourceKind,[id]]);
    report.questions.push({fixtureId:id,id:item.id,points,source:input.sourceTitle});
  }
  assert.equal(rows('SELECT COUNT(*) AS total FROM question_bank_items')[0].total,8);
  report.ok=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally {
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,root,questions:report.questions.length,error:report.error}));
}
